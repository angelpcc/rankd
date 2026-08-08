import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { isViewingAs } from '@/lib/viewAs';
import { useSEO } from '@/hooks/useSEO';
import MessagesPanel from '@/pages/dashboard/components/messages/MessagesPanel';
import NutritionTracker from '@/pages/mi-esquina/components/NutritionTracker';
import ShareProgress from '@/pages/mi-esquina/components/ShareProgress';
import { DocumentExpiryAlert } from '@/pages/mi-esquina/components/DocumentsPanel';
import DailyCheckin from '@/pages/mi-esquina/components/DailyCheckin';
import QuickRoutines from '@/pages/mi-esquina/components/QuickRoutines';
import LastStrengthSession from '@/pages/mi-esquina/components/LastStrengthSession';
import QuickStatsRow from '@/pages/mi-esquina/components/QuickStatsRow';
import WeeklySummary from '@/pages/mi-esquina/components/WeeklySummary';
import FightPrep from '@/pages/mi-esquina/components/FightPrep';
import AgendaHub from '@/pages/mi-esquina/components/AgendaHub';
import ProgressHub from '@/pages/mi-esquina/components/ProgressHub';
import RingHub from '@/pages/mi-esquina/components/RingHub';
import GearChecklist, { GearReplacementAlert } from '@/pages/mi-esquina/components/GearChecklist';
import GymLink from '@/pages/mi-esquina/components/GymLink';
import GearBrands from '@/pages/mi-esquina/components/GearBrands';
import SectionCoach from '@/pages/mi-esquina/components/SectionCoach';
import MealLog from '@/pages/mi-esquina/components/MealLog';
import FoodPhotoAnalyzer from '@/pages/mi-esquina/components/FoodPhotoAnalyzer';
import Reveal from '@/components/base/Reveal';
import PageBreadcrumb from '@/components/base/PageBreadcrumb';
import CountUp from '@/components/base/CountUp';
import NotificationBell from '@/components/feature/NotificationBell';

// R12-T0: la barra lateral se reorganizó de 17/13 a 11/9 secciones fusionando
// grupos que se solapaban. 'agenda' = calendario+diario+rutinas,
// 'progreso' = peso+fuerza, 'ring' = sparring+combates+notas técnicas.
// 'compartir' deja de ser sección de barra lateral y vive como acción del
// resumen (sigue siendo un destino válido, por eso se mantiene en el tipo).
type Section =
  | 'resumen' | 'agenda' | 'progreso' | 'ring' | 'objetivos' | 'documentos'
  | 'compartir' | 'coach' | 'material' | 'nutricion' | 'timer' | 'mensajes';

interface SectionDef { id: Section; labelKey: string; icon: string }

// Secciones alcanzables por botón (no viven en la barra lateral) pero que
// siguen siendo destinos válidos que deben renderizarse.
const EXTRA_SECTIONS: Section[] = ['compartir'];

// ── Qué ve cada perfil ──
// El que compite lo tiene TODO: el Ring (sparring, combates y libreta técnica)
// es suyo, y la Agenda y el Peso van enfocados al combate.
// R15-B7: menos categorías de primer nivel. Objetivos pasa a ser subsección de
// Progreso y Documentos de Ring; así la barra es más corta y agrupada.
const PRO_SECTIONS: SectionDef[] = [
  { id: 'resumen', labelKey: 'mc_nav_summary', icon: 'ri-dashboard-line' },
  { id: 'agenda', labelKey: 'mc_nav_agenda', icon: 'ri-calendar-todo-line' },
  { id: 'progreso', labelKey: 'mc_nav_progress_hub', icon: 'ri-line-chart-line' },
  { id: 'ring', labelKey: 'mc_nav_ring', icon: 'ri-boxing-line' },
  { id: 'coach', labelKey: 'mc_nav_coach', icon: 'ri-sparkling-2-line' },
  { id: 'material', labelKey: 'mc_nav_gear', icon: 'ri-t-shirt-line' },
  { id: 'nutricion', labelKey: 'mc_nav_nutrition', icon: 'ri-restaurant-line' },
  { id: 'timer', labelKey: 'mc_nav_timer', icon: 'ri-timer-flash-line' },
  { id: 'mensajes', labelKey: 'mc_nav_messages', icon: 'ri-message-3-line' },
];

// El aficionado ve menos, pero todo lo que ve es suyo: nada de Ring ni
// documentos de competición, que solo serían ruido. Objetivos vive en Progreso.
const HOBBY_SECTIONS: SectionDef[] = [
  { id: 'resumen', labelKey: 'mc_nav_summary', icon: 'ri-dashboard-line' },
  { id: 'agenda', labelKey: 'mc_nav_agenda', icon: 'ri-calendar-todo-line' },
  { id: 'progreso', labelKey: 'mc_nav_progress_hub', icon: 'ri-line-chart-line' },
  { id: 'coach', labelKey: 'mc_nav_coach', icon: 'ri-sparkling-2-line' },
  { id: 'material', labelKey: 'mc_nav_gear', icon: 'ri-t-shirt-line' },
  { id: 'nutricion', labelKey: 'mc_nav_nutrition', icon: 'ri-restaurant-line' },
  { id: 'timer', labelKey: 'mc_nav_timer', icon: 'ri-timer-flash-line' },
  { id: 'mensajes', labelKey: 'mc_nav_messages', icon: 'ri-message-3-line' },
];

export default function MiEsquinaPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const i18nLocale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const { user, profile, loading: authLoading } = useAuth();
  const [section, setSection] = useState<Section>('resumen');
  // Pestaña con la que abrir un hub (Agenda/Progreso/Ring) desde un acceso rápido.
  const [pendingTab, setPendingTab] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [stats, setStats] = useState({
    total: 0, week: 0, weekMin: 0, todayLogged: false, streak: 0, lastWeekMin: 0,
    last7: [] as { key: string; min: number; today: boolean }[],
  });
  // Se incrementa al registrar algo, para que el resumen semanal se recalcule
  const [refreshKey, setRefreshKey] = useState(0);

  useSEO({
    title: 'Mi Esquina | RANKD',
    description: 'Tu espacio de entrenamiento en RANKD: diario, calendario, peso, objetivos y Coach IA.',
  });

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    // No expulsar al admin en modo "Ver como" mientras su sesión rehidrata.
    if (!authLoading && !user && !isViewingAs()) navigate('/esquina');
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!profile?.id) return;
    const load = async () => {
      const { data } = await supabase
        .from('training_sessions')
        .select('session_date, duration_min')
        .eq('fighter_profile_id', profile.id);
      if (!data) return;
      const now = new Date();
      const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - day);
      weekStart.setHours(0, 0, 0, 0);
      const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(weekStart.getDate() - 7);
      const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const week = data.filter((s) => new Date(s.session_date + 'T12:00:00') >= weekStart);
      const lastWeek = data.filter((s) => { const dt = new Date(s.session_date + 'T12:00:00'); return dt >= lastWeekStart && dt < weekStart; });
      const days = new Set(data.map((s) => s.session_date));
      const todayLogged = days.has(iso(now));
      // Racha de días consecutivos (si hoy no hay, cuenta desde ayer)
      let streak = 0;
      const cursor = new Date(now);
      if (!todayLogged) cursor.setDate(cursor.getDate() - 1);
      for (;;) { if (days.has(iso(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); } else break; }
      // Minutos de cada uno de los últimos 7 días, para la mini gráfica
      const last7: { key: string; min: number; today: boolean }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
        const key = iso(d);
        last7.push({
          key,
          min: data.filter((s) => s.session_date === key).reduce((a, s) => a + (s.duration_min || 0), 0),
          today: i === 0,
        });
      }

      setStats({
        total: data.length,
        week: week.length,
        weekMin: week.reduce((a, s) => a + (s.duration_min || 0), 0),
        lastWeekMin: lastWeek.reduce((a, s) => a + (s.duration_min || 0), 0),
        todayLogged,
        streak,
        last7,
      });
    };
    load();
  }, [profile?.id, section, refreshKey]);

  if (authLoading || !user || !profile) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isHobby = profile.athlete_mode === 'hobby';
  const mode: 'pro' | 'hobby' = isHobby ? 'hobby' : 'pro';
  const SECTIONS = isHobby ? HOBBY_SECTIONS : PRO_SECTIONS;
  const firstName = (profile.full_name || '').split(' ')[0] || 'RANKD';

  // Si el perfil cambia de modo, una sección que ya no existe dejaría la
  // pantalla en blanco: en ese caso volvemos al resumen. Las EXTRA_SECTIONS
  // (compartir) no están en la barra pero siguen siendo destinos válidos.
  const activeSection: Section =
    SECTIONS.some((s) => s.id === section) || EXTRA_SECTIONS.includes(section) ? section : 'resumen';

  // Navega a una sección y, opcionalmente, abre un hub en una pestaña concreta.
  const go = (s: Section, tab?: string) => { setPendingTab(tab); setSection(s); };

  // Guía de nutrición: el bloque de peso cambia según el perfil.
  const NUTRITION_GUIDE = [
    { icon: 'ri-drop-line', t: 'mc_ng_hydration_t', b: 'mc_ng_hydration_b' },
    { icon: 'ri-restaurant-2-line', t: 'mc_ng_before_t', b: 'mc_ng_before_b' },
    { icon: 'ri-flashlight-line', t: 'mc_ng_after_t', b: 'mc_ng_after_b' },
    isHobby
      ? { icon: 'ri-heart-pulse-line', t: 'mc_ng_fatloss_t', b: 'mc_ng_fatloss_b' }
      : { icon: 'ri-scales-2-line', t: 'mc_ng_cut_t', b: 'mc_ng_cut_b' },
    { icon: 'ri-capsule-line', t: 'mc_ng_supp_t', b: 'mc_ng_supp_b' },
    { icon: 'ri-moon-line', t: 'mc_ng_sleep_t', b: 'mc_ng_sleep_b' },
  ];

  // Accesos rápidos del resumen, distintos por perfil. `tab` abre el hub en la
  // pestaña indicada. Compartir vive aquí ahora que dejó la barra lateral.
  const QUICK_CARDS: { s: Section; tab?: string; icon: string; titleKey: string }[] = isHobby
    ? [
        { s: 'agenda', tab: 'diario', icon: 'ri-calendar-check-line', titleKey: 'mc_nav_diary' },
        { s: 'agenda', tab: 'rutinas', icon: 'ri-repeat-line', titleKey: 'mc_nav_routines' },
        { s: 'progreso', tab: 'peso', icon: 'ri-line-chart-line', titleKey: 'mc_nav_progress' },
        { s: 'coach', icon: 'ri-sparkling-2-line', titleKey: 'mc_nav_coach' },
        { s: 'compartir', icon: 'ri-share-forward-line', titleKey: 'mc_nav_share' },
      ]
    : [
        { s: 'agenda', tab: 'diario', icon: 'ri-calendar-check-line', titleKey: 'mc_nav_diary' },
        { s: 'ring', tab: 'sparring', icon: 'ri-boxing-line', titleKey: 'mc_nav_sparring' },
        { s: 'progreso', tab: 'peso', icon: 'ri-scales-2-line', titleKey: 'mc_nav_weight' },
        { s: 'agenda', tab: 'plan', icon: 'ri-calendar-2-line', titleKey: 'mc_nav_calendar' },
        { s: 'coach', icon: 'ri-sparkling-2-line', titleKey: 'mc_nav_coach' },
        { s: 'compartir', icon: 'ri-share-forward-line', titleKey: 'mc_nav_share' },
      ];

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      {/* Top bar propia */}
      <div className="fixed top-0 left-0 w-full z-40 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800 rk-safe-top">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button onClick={() => navigate(isHobby ? '/beta' : '/dashboard')} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer">
            <i className="ri-arrow-left-line"></i>
            <span className="hidden sm:inline">{isHobby ? t('mc_back_home') : t('mc_back_dashboard')}</span>
          </button>
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 3 }} className="text-white">{t('mc_brand_my')}</span>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 3 }} className="text-[#E10600]">{t('mc_brand_corner')}</span>
            <span className={`hidden sm:inline text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${isHobby ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-[#C9A84C] bg-[#C9A84C]/10 border-[#C9A84C]/30'}`}>
              {isHobby ? t('mc_mode_hobby') : t('mc_mode_pro')}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <NotificationBell userId={profile.id} reminders />
            <a href="/beta" className="hidden sm:flex items-center gap-0 cursor-pointer">
              <span className="font-unbounded font-black tracking-tighter leading-none text-[15px] text-white" style={{ letterSpacing: '-0.04em' }}>RAN</span>
              <span className="font-unbounded font-black tracking-tighter leading-none text-[15px] text-[#E10600]" style={{ letterSpacing: '-0.04em' }}>KD</span>
            </a>
          </div>
        </div>
      </div>

      {/* Confirmación: en móvil ocupa el ancho y sube desde abajo, donde está
          el pulgar; el icono entra con su propia animación para que se note
          que la acción ha ido bien sin tener que leer el texto. */}
      {toast && (
        <div
          role="status"
          className={`anim-fade-up fixed z-50 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm text-white text-sm px-4 py-3.5 rounded-2xl flex items-center gap-3 ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}
          style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}
        >
          <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-white/20 anim-scale-in">
            <i className={`text-lg ${toast.type === 'error' ? 'ri-error-warning-line' : 'ri-check-line'}`}></i>
          </span>
          <span className="flex-1 min-w-0 font-semibold leading-snug">{toast.msg}</span>
        </div>
      )}

      <div className="flex min-h-screen max-w-[1400px] mx-auto" style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
        {/* Sidebar (escritorio) */}
        <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 border-r border-zinc-800/70 py-6 px-3 sticky h-[calc(100vh-3.5rem)] overflow-y-auto" style={{ top: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
          <nav className="space-y-1 flex-1">
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => (s.id === 'timer' ? navigate('/mi-esquina/timer') : go(s.id))}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer text-left ${activeSection === s.id ? 'bg-red-600 text-white shadow-lg shadow-red-600/25' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'}`}>
                <i className={`${s.icon} text-base flex-shrink-0`}></i>
                <span className="flex-1">{t(s.labelKey)}</span>
              </button>
            ))}
          </nav>
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800">
            <p className="text-xs font-bold text-white flex items-center gap-1.5"><i className="ri-fire-line text-orange-400"></i>{firstName}</p>
            <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{isHobby ? t('mc_hb_consistency_desc') : t('mc_sum_sub_pro')}</p>
          </div>
        </aside>

        {/* Tabs móvil */}
        <div className="lg:hidden fixed left-0 right-0 z-30 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 overflow-x-auto" style={{ top: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
          <div className="flex px-3 py-2 gap-1 min-w-max">
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => (s.id === 'timer' ? navigate('/mi-esquina/timer') : go(s.id))}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${activeSection === s.id ? 'bg-red-600 text-white' : 'text-zinc-400'}`}>
                <i className={s.icon}></i>{t(s.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Main */}
        {/* key = sección: React remonta el contenido y la animación de entrada
            se reproduce en cada cambio, dando sensación de navegación real */}
        <main key={activeSection} className="rk-section-in flex-1 px-4 sm:px-6 lg:px-10 py-8 pt-24 lg:pt-8 pb-16 min-w-0">

          {/* Migas de pan: dónde estoy dentro de Mi Esquina y cómo volver al
              resumen (bloque 4). En el propio resumen no hace falta. */}
          {activeSection !== 'resumen' && (
            <PageBreadcrumb
              root={t('mc_here_root')}
              section={t(SECTIONS.find((s) => s.id === activeSection)?.labelKey || (activeSection === 'compartir' ? 'mc_nav_share' : 'mc_nav_summary'))}
              onRoot={() => go('resumen')}
            />
          )}

          {/* ══════════ RESUMEN ══════════ */}
          {activeSection === 'resumen' && (
            <div className="space-y-6 max-w-3xl">
              {/* PRO: lo primero es el combate que viene */}
              {!isHobby && (
                <Reveal>
                  <FightPrep profile={profile} onOpenCalendar={() => go('agenda', 'plan')} />
                </Reveal>
              )}

              {/* PRO: si un papel caduca, que se entere ANTES de que le toque pelear */}
              {!isHobby && (
                <DocumentExpiryAlert profile={profile} onOpen={() => go('ring', 'documentos')} />
              )}

              {/* Si toca renovar material, avisar desde el resumen */}
              <GearReplacementAlert profile={profile} onOpen={() => setSection('material')} />

              {/* Tu gimnasio en RANKD: consentimiento para compartir actividad */}
              <GymLink profile={profile} showToast={showToast} />

              {/* Check-in del día */}
              <Reveal delay={40}>
                <DailyCheckin profile={profile} showToast={showToast} />
              </Reveal>

              {/* Estado de un vistazo: semana, última sesión, objetivo de peso */}
              <Reveal delay={55}>
                <QuickStatsRow profile={profile} weekSessions={stats.week}
                  onOpenAgenda={() => go('agenda', 'diario')} onOpenStrength={() => go('progreso', 'fuerza')} />
              </Reveal>

              {/* Resumen automático de la semana + objetivos */}
              <Reveal delay={70}>
                <WeeklySummary profile={profile} refreshKey={refreshKey} onOpenGoals={() => go('progreso', 'objetivos')} />
              </Reveal>

              {/* Registro de un toque */}
              <Reveal delay={100}>
                <QuickRoutines profile={profile} showToast={showToast} compact onLogged={() => setRefreshKey((k) => k + 1)} />
              </Reveal>

              {/* Última sesión de fuerza registrada (si hay alguna) */}
              <Reveal delay={110}>
                <LastStrengthSession profile={profile} onOpen={() => go('progreso', 'fuerza')} />
              </Reveal>

              {/* Hábito diario */}
              <Reveal delay={120}>
                {stats.todayLogged ? (
                  <div className="rk-card relative overflow-hidden" style={{ padding: '18px 20px', borderColor: 'rgba(34,197,94,0.25)' }}>
                    <div className="rk-glow-red" style={{ width: 160, height: 160, top: -70, right: -50, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,197,94,0.14) 0%, transparent 68%)' }} />
                    <div className="relative flex items-center gap-4">
                      <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl bg-green-500/12 border border-green-500/30 text-green-400"><i className="ri-check-double-line text-2xl"></i></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">{t('mc_today_logged')}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {stats.streak > 1 ? `${t('mc_streak_of', { n: stats.streak })} ` : ''}
                          {stats.week === 1 ? t('mc_week_session_one') : t('mc_week_sessions', { n: stats.week })}
                          {stats.lastWeekMin > 0 && (
                            <span className={stats.weekMin >= stats.lastWeekMin ? 'text-green-400' : 'text-orange-400'}>
                              {' · '}{stats.weekMin >= stats.lastWeekMin ? '▲' : '▼'} {t('mc_vs_last_week', { n: Math.abs(stats.weekMin - stats.lastWeekMin) })}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rk-card relative overflow-hidden" style={{ padding: '18px 20px', borderColor: 'rgba(225,6,0,0.28)' }}>
                    <div className="rk-glow-red" style={{ width: 180, height: 180, top: -80, right: -50, borderRadius: '50%' }} />
                    <div className="relative flex items-center gap-4 flex-wrap sm:flex-nowrap">
                      <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl bg-red-600/12 border border-red-500/30 text-red-400 anim-pulse-glow"><i className="ri-fire-line text-2xl"></i></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">{t('mc_today_pending')}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">{stats.streak > 0 ? t('mc_today_streak_risk', { n: stats.streak }) : t('mc_today_streak_start')}</p>
                      </div>
                      <button onClick={() => go('agenda', 'diario')} className="rk-btn rk-btn-primary flex-shrink-0 w-full sm:w-auto" style={{ fontSize: '0.8rem', padding: '0.6rem 1.2rem' }}>
                        {t('mc_today_cta')}
                      </button>
                    </div>
                  </div>
                )}
              </Reveal>

              {/* Titular */}
              <Reveal delay={140}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                    <span className="rk-index">{t('mc_sum_eyebrow')}</span>
                    <span style={{ flex: '0 0 38px', height: 1, background: 'rgba(255,255,255,0.16)' }} />
                    <span className="rk-eyebrow">{isHobby ? t('mc_mode_hobby') : t('mc_mode_pro')}</span>
                  </div>
                  <h1 className="rk-h1" style={{ margin: 0, color: '#fff' }}>
                    {t('mc_sum_welcome')} <span className="rk-red-glow">{t('mc_sum_corner_word')}</span>,<br />{firstName.toUpperCase()}
                  </h1>
                  <p className="text-zinc-400 text-sm mt-2">{isHobby ? t('mc_sum_sub_hobby') : t('mc_sum_sub_pro')}</p>
                </div>
              </Reveal>

              {/* Cifras: cuentan al aparecer, para que se lean en vez de pasar
                  desapercibidas como un dato estático más */}
              <Reveal delay={160}>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { n: stats.total, suf: '', l: t('mc_stat_total'), c: '#ffffff' },
                    { n: isHobby ? stats.streak : stats.week, suf: '', l: isHobby ? t('mc_stat_streak') : t('mc_stat_week'), c: '#E10600' },
                    { n: stats.weekMin, suf: 'min', l: t('mc_stat_time'), c: '#4ade80' },
                  ].map((s) => (
                    <div key={s.l} className="rk-card" style={{ padding: '22px 14px', textAlign: 'center' }}>
                      <CountUp value={s.n} suffix={s.suf}
                        style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(28px,5vw,40px)', lineHeight: 1, color: s.c }} />
                      <p className="rk-body" style={{ fontSize: '0.72rem', letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 8 }}>{s.l}</p>
                    </div>
                  ))}
                </div>
              </Reveal>

              {/* Últimos 7 días: la carga de la semana de un vistazo, sin leer cifras */}
              {stats.last7.some((d) => d.min > 0) && (
                <Reveal delay={175}>
                  <div className="rk-card" style={{ padding: '18px 20px', transform: 'none' }}>
                    <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-zinc-600 mb-3">{t('mc_ws_title')}</p>
                    <div className="flex items-end justify-between gap-1.5" style={{ height: 76 }}>
                      {stats.last7.map((d) => {
                        const max = Math.max(...stats.last7.map((x) => x.min), 1);
                        const h = d.min > 0 ? Math.max(8, Math.round((d.min / max) * 62)) : 3;
                        const dayLabel = new Date(d.key + 'T12:00:00')
                          .toLocaleDateString(i18nLocale, { weekday: 'narrow' }).toUpperCase();
                        return (
                          <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                            <span className="text-[9px] text-zinc-600 tabular-nums">{d.min > 0 ? d.min : ''}</span>
                            <div className="w-full rounded-md rk-bar-fill" style={{
                              height: h,
                              background: d.min === 0
                                ? 'rgba(255,255,255,0.06)'
                                : d.today ? '#E10600' : 'rgba(225,6,0,0.45)',
                            }} />
                            <span className={`text-[10px] font-bold ${d.today ? 'text-red-400' : 'text-zinc-600'}`}>{dayLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Reveal>
              )}

              {/* AFICIONADO: en qué se enfoca su esquina */}
              {isHobby && (
                <Reveal delay={180}>
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-zinc-600 mb-3">{t('mc_hb_focus_title')}</p>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {[
                        { icon: 'ri-fire-line', t: 'mc_hb_consistency', d: 'mc_hb_consistency_desc', c: '#E10600' },
                        { icon: 'ri-line-chart-line', t: 'mc_hb_progress', d: 'mc_hb_progress_desc', c: '#4ade80' },
                        { icon: 'ri-heart-pulse-line', t: 'mc_hb_wellbeing', d: 'mc_hb_wellbeing_desc', c: '#38bdf8' },
                      ].map((f) => (
                        <div key={f.t} className="rk-card" style={{ padding: 18 }}>
                          <div className="w-10 h-10 flex items-center justify-center rounded-xl border mb-3"
                            style={{ background: `${f.c}14`, borderColor: `${f.c}3a`, color: f.c }}>
                            <i className={`${f.icon} text-lg`}></i>
                          </div>
                          <p className="text-sm font-bold text-white">{t(f.t)}</p>
                          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{t(f.d)}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-zinc-600 mt-3 leading-relaxed flex items-start gap-1.5">
                      <i className="ri-information-line mt-0.5 flex-shrink-0"></i>{t('mc_hb_no_competition')}
                    </p>
                  </div>
                </Reveal>
              )}

              {/* Accesos rápidos */}
              <Reveal delay={200}>
                <div className="grid sm:grid-cols-2 gap-3">
                  {QUICK_CARDS.map((c) => (
                    <button key={`${c.s}-${c.tab || ''}`} onClick={() => go(c.s, c.tab)} className="rk-card text-left group flex items-center gap-3.5" style={{ padding: 18, cursor: 'pointer' }}>
                      <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-red-600/12 border border-red-500/25 text-red-400"><i className={`${c.icon} text-lg`}></i></div>
                      <p className="text-sm font-bold text-white flex-1">{t(c.titleKey)}</p>
                      <i className="ri-arrow-right-line text-zinc-600 group-hover:text-red-400 transition-colors"></i>
                    </button>
                  ))}
                </div>
              </Reveal>
            </div>
          )}

          {/* ══════════ SECCIONES ══════════ */}
          {/* Agenda: plan + diario + rutinas (R12-T0) */}
          {activeSection === 'agenda' && (
            <AgendaHub profile={profile} showToast={showToast} mode={mode}
              onLogged={() => setRefreshKey((k) => k + 1)} initialTab={pendingTab} />
          )}

          {/* Progreso: peso + fuerza (R12-T0) */}
          {activeSection === 'progreso' && (
            <ProgressHub profile={profile} showToast={showToast} mode={mode} initialTab={pendingTab} />
          )}

          {/* Ring: sparring + combates + notas técnicas (R12-T0, solo competición) */}
          {activeSection === 'ring' && !isHobby && (
            <RingHub profile={profile} showToast={showToast} initialTab={pendingTab} />
          )}

          {activeSection === 'compartir' && <ShareProgress profile={profile} mode={mode} showToast={showToast} />}

          {activeSection === 'mensajes' && <div className="max-w-5xl"><MessagesPanel currentUserId={profile.id} /></div>}

          {/* ══ COACH IA ══ */}
          {activeSection === 'coach' && (
            <div className="space-y-5 max-w-3xl">
              <Reveal>
                <div>
                  <p className="rk-eyebrow">{t('mc_coach_eyebrow')}</p>
                  <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
                    {t('mc_coach_training_title')} <span className="rk-red-glow">{t('mc_coach_training_title_2')}</span>
                  </h2>
                  <p className="text-zinc-400 text-sm mt-1.5 max-w-md">{isHobby ? t('mc_coach_sub_hobby') : t('mc_coach_sub_pro')}</p>
                </div>
              </Reveal>
              <Reveal delay={80}>
                <SectionCoach
                  section="training"
                  profile={profile}
                  showToast={showToast}
                  accent="red"
                  title={t('mc_nav_coach')}
                  intro={isHobby ? t('mc_coach_intro_hobby') : t('mc_coach_intro_pro')}
                  suggestions={isHobby
                    ? [t('mc_coach_sug_hobby_1'), t('mc_coach_sug_hobby_2'), t('mc_coach_sug_hobby_3'), t('mc_coach_sug_hobby_4')]
                    : [t('mc_coach_sug_pro_1'), t('mc_coach_sug_pro_2'), t('mc_coach_sug_pro_3'), t('mc_coach_sug_pro_4')]}
                />
              </Reveal>
            </div>
          )}

          {/* ══ MATERIAL ══ */}
          {activeSection === 'material' && (
            <div className="space-y-8 max-w-4xl">
              <GearChecklist profile={profile} showToast={showToast} />

              <div className="rk-rule" style={{ width: '100%', opacity: 0.5 }} />

              <GearBrands profile={profile} mode={mode} />

              <div className="rk-rule" style={{ width: '100%', opacity: 0.5 }} />

              <Reveal>
                <div className="mb-4">
                  <p className="rk-eyebrow">{t('mc_gear_ask_ai')}</p>
                  <h2 className="rk-h2" style={{ fontSize: 'clamp(1.6rem,3.5vw,2.1rem)', margin: '4px 0 0', color: '#fff' }}>
                    {t('mc_nav_gear')}
                  </h2>
                  <p className="text-zinc-400 text-sm mt-1.5">{t('mc_gear_ask_ai_desc')}</p>
                </div>
                <SectionCoach
                  section="gear"
                  profile={profile}
                  showToast={showToast}
                  accent="red"
                  title={t('mc_nav_gear')}
                  intro={t('mc_gear_ask_ai_desc')}
                  suggestions={[t('mc_gear_sug_1'), t('mc_gear_sug_2'), t('mc_gear_sug_3'), t('mc_gear_sug_4')]}
                />
              </Reveal>
            </div>
          )}

          {/* ══ NUTRICIÓN ══ */}
          {activeSection === 'nutricion' && (
            <div className="space-y-8 max-w-4xl">
              {/* Aviso sanitario permanente y visible desde el primer momento */}
              <div className="flex items-start gap-3 rounded-2xl border border-[#C9A84C]/30 bg-[#C9A84C]/[0.07] px-4 py-3.5">
                <i className="ri-heart-pulse-line text-[#C9A84C] text-lg mt-0.5 flex-shrink-0"></i>
                <p className="text-xs text-zinc-300 leading-relaxed">{t('mc_ng_safety_banner')}</p>
              </div>

              <NutritionTracker profile={profile} showToast={showToast} onGoWeight={() => go('progreso', 'peso')} />

              <div className="rk-rule" style={{ width: '100%', opacity: 0.5 }} />

              <Reveal>
                <div className="mb-4">
                  <p className="rk-eyebrow">{t('mc_ng_log_title')}</p>
                  <h2 className="rk-h2" style={{ fontSize: 'clamp(1.6rem,3.5vw,2.1rem)', margin: '4px 0 0', color: '#fff' }}>
                    {t('mc_ng_log_head')} <span className="rk-red-glow">{t('mc_ng_log_head_2')}</span>
                  </h2>
                  <p className="text-zinc-400 text-sm mt-1.5">{t('mc_ng_log_sub')}</p>
                </div>
                {/* Analizar comida con foto (IA, disponible pronto) */}
                <div className="mb-4">
                  <FoodPhotoAnalyzer showToast={showToast} />
                </div>
                <div className="grid lg:grid-cols-2 gap-4 items-start">
                  <MealLog profile={profile} showToast={showToast} />
                  <SectionCoach
                    section="nutrition"
                    profile={profile}
                    showToast={showToast}
                    accent="sky"
                    title={t('mc_ng_coach_title')}
                    intro={isHobby ? t('mc_ng_coach_intro_hobby') : t('mc_ng_coach_intro_pro')}
                    suggestions={isHobby
                      ? [t('mc_ng_sug_hobby_1'), t('mc_ng_sug_hobby_2'), t('mc_ng_sug_hobby_3')]
                      : [t('mc_ng_sug_pro_1'), t('mc_ng_sug_pro_2'), t('mc_ng_sug_pro_3')]}
                  />
                </div>
              </Reveal>

              <div className="rk-rule" style={{ width: '100%', opacity: 0.5 }} />

              <Reveal>
                <div>
                  <p className="rk-eyebrow">{t('mc_ng_eyebrow')}</p>
                  <h2 className="rk-h2" style={{ fontSize: 'clamp(1.6rem,3.5vw,2.1rem)', margin: '4px 0 0', color: '#fff' }}>
                    {t('mc_ng_title')} <span className="rk-red-glow">{t('mc_ng_title_2')}</span>
                  </h2>
                  <p className="text-zinc-400 text-sm mt-1.5">{t('mc_ng_sub')}</p>
                </div>
              </Reveal>
              <div className="grid sm:grid-cols-2 gap-4">
                {NUTRITION_GUIDE.map((n, i) => (
                  <Reveal key={n.t} delay={Math.min(i, 5) * 60}>
                    <div className="rk-card" style={{ padding: 20 }}>
                      <div className="flex items-center gap-3 mb-2.5">
                        <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-green-500/10 border border-green-500/25 text-green-400"><i className={`${n.icon} text-lg`}></i></div>
                        <h3 className="text-base font-bold text-white">{t(n.t)}</h3>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">{t(n.b)}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
              <div className="rk-card flex items-start gap-3" style={{ padding: 16 }}>
                <i className="ri-information-line text-zinc-500 mt-0.5"></i>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{t('mc_ng_disclaimer')}</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
