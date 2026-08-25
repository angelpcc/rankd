import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useSEO } from '@/hooks/useSEO';
import ShareProgress from '@/pages/mi-esquina/components/ShareProgress';
import { DocumentExpiryAlert } from '@/pages/mi-esquina/components/DocumentsPanel';
import TodayCard from '@/pages/mi-esquina/components/TodayCard';
import SummaryMetrics from '@/pages/mi-esquina/components/SummaryMetrics';
import SummaryAiLine from '@/pages/mi-esquina/components/SummaryAiLine';
import PhysicalProfileCard from '@/pages/mi-esquina/components/PhysicalProfileCard';
import AgendaHub from '@/pages/mi-esquina/components/AgendaHub';
import ProgressHub from '@/pages/mi-esquina/components/ProgressHub';
import RingHub from '@/pages/mi-esquina/components/RingHub';
import { GearReplacementAlert } from '@/pages/mi-esquina/components/GearChecklist';
import GymLink from '@/pages/mi-esquina/components/GymLink';
import NutritionHub from '@/pages/mi-esquina/components/NutritionHub';
import GearHub from '@/pages/mi-esquina/components/GearHub';
import Reveal from '@/components/base/Reveal';
import PageBreadcrumb from '@/components/base/PageBreadcrumb';
import NotificationBell from '@/components/feature/NotificationBell';

// R12-T0: la barra lateral se reorganizó de 17/13 a 11/9 secciones fusionando
// grupos que se solapaban. 'agenda' = calendario+diario+rutinas,
// 'progreso' = peso+fuerza, 'ring' = sparring+combates+notas técnicas.
// 'compartir' deja de ser sección de barra lateral y vive como acción del
// resumen (sigue siendo un destino válido, por eso se mantiene en el tipo).
// R17: Coach IA como sección propia se retiró — la IA vive DENTRO de cada
// bloque (nutrición, material, objetivos), donde ya trae contexto de lo que
// el peleador está haciendo. Un asistente genérico duplicaba entradas.
type Section =
  | 'resumen' | 'agenda' | 'progreso' | 'ring' | 'objetivos' | 'documentos'
  | 'compartir' | 'material' | 'nutricion' | 'timer';

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
  { id: 'material', labelKey: 'mc_nav_gear', icon: 'ri-t-shirt-line' },
  { id: 'nutricion', labelKey: 'mc_nav_nutrition', icon: 'ri-restaurant-line' },
  { id: 'timer', labelKey: 'mc_nav_timer', icon: 'ri-timer-flash-line' },
];

// El aficionado ve menos, pero todo lo que ve es suyo: nada de Ring ni
// documentos de competición, que solo serían ruido. Objetivos vive en Progreso.
const HOBBY_SECTIONS: SectionDef[] = [
  { id: 'resumen', labelKey: 'mc_nav_summary', icon: 'ri-dashboard-line' },
  { id: 'agenda', labelKey: 'mc_nav_agenda', icon: 'ri-calendar-todo-line' },
  { id: 'progreso', labelKey: 'mc_nav_progress_hub', icon: 'ri-line-chart-line' },
  { id: 'material', labelKey: 'mc_nav_gear', icon: 'ri-t-shirt-line' },
  { id: 'nutricion', labelKey: 'mc_nav_nutrition', icon: 'ri-restaurant-line' },
  { id: 'timer', labelKey: 'mc_nav_timer', icon: 'ri-timer-flash-line' },
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
    description: 'Tu espacio de entrenamiento en RANKD: diario, calendario, peso, plan personalizado por objetivo y agenda.',
  });

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Antes se redirigía a /esquina cuando no había sesión, pero ahora la
  // propia página se queda visible con un preview borroso + overlay de
  // login (ver bloque `!user || !profile` más abajo). Así el visitante
  // llega desde el menú y ve exactamente lo que va a desbloquear.

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

  // Mientras rehidrata la sesión, spinner: aún no sabemos si hay usuario.
  if (authLoading) {
    return (
      <div className="min-h-screen rk-screen-bg flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Sin sesión: preview de la página con el layout real (top bar, barra
  // lateral, cards) pero difuminado y sin interacción, y encima un
  // overlay centrado que invita a iniciar sesión. No se monta el
  // MiEsquinaPage real porque necesita perfil y datos de Supabase.
  if (!user || !profile) {
    return <LoggedOutPreview onSignIn={() => navigate('/auth')} />;
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

  return (
    <div className="min-h-screen text-white rk-screen-bg">
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
              {/* Alertas y elementos auxiliares — mantienen su estilo actual */}
              {!isHobby && (
                <DocumentExpiryAlert profile={profile} onOpen={() => go('ring', 'documentos')} />
              )}
              <GearReplacementAlert profile={profile} onOpen={() => setSection('material')} />

              {/* ── PILOTO TEMA CLARO (PROMPT_DISEÑO_CLARO_GRAFICAS) ──
                  Envuelve las 3 cards principales del Resumen. Fondo crema, cards
                  blancas, textos oscuros, mini gráficos Recharts integrados.
                  Solo aplica dentro de este scope; el resto de Mi Esquina y de
                  la app sigue con la estética oscura cinematográfica. */}
              <div className="rk-light-scope space-y-4">
                {/* 1. HOY — card primaria con borde izquierdo rojo */}
                <Reveal>
                  <TodayCard profile={profile}
                    onStart={() => go('agenda', 'plan')}
                    onCreatePlan={() => go('progreso', 'objetivos')} />
                </Reveal>

                {/* 2. Métricas: Peso (línea) · Entrenamientos (barras) · Objetivo/Combate */}
                <Reveal delay={90}>
                  <SummaryMetrics profile={profile} weekSessions={stats.week}
                    onOpenAgenda={() => go('agenda', 'diario')} onOpenWeight={() => go('progreso', 'peso')} />
                </Reveal>

                {/* 3. Plan activo (card clara con acento oro) */}
                <Reveal delay={160}>
                  <SummaryAiLine profile={profile} onOpen={() => go('progreso', 'objetivos')} />
                </Reveal>
              </div>

              {/* Perfil físico incompleto (A.3): discreto, se oculta al 100% */}
              <PhysicalProfileCard profileId={profile.id} showToast={showToast} hideWhenComplete />

              {/* Consentimiento del gimnasio (condicional, subordinado) */}
              <GymLink profile={profile} showToast={showToast} />
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

          {/* R17: bloque "Coach IA" retirado. El coach de entrenamiento se
              accede ahora desde Progreso › Objetivos, con contexto del plan
              en curso. Nutrición y Material siguen teniendo su IA dentro. */}

          {/* ══ MATERIAL ══ (R17b: sección por pestañas dentro de GearHub) */}
          {activeSection === 'material' && (
            <GearHub profile={profile} showToast={showToast} mode={mode} />
          )}

          {/* ══ NUTRICIÓN ══ (R17b: sección por pestañas dentro de NutritionHub) */}
          {activeSection === 'nutricion' && (
            <NutritionHub profile={profile} showToast={showToast} isHobby={isHobby}
              onGoWeight={() => go('progreso', 'peso')} />
          )}
        </main>
      </div>
    </div>
  );
}

/**
 * Preview de Mi Esquina cuando no hay sesión.
 *
 * Se pinta un layout estático parecido a la página real (top bar, barra
 * lateral y cards) con `filter: blur(8px)` y `pointer-events: none`, y
 * encima un overlay centrado con el CTA para iniciar sesión. No monta
 * ni consulta datos reales de Supabase: es puramente visual.
 */
function LoggedOutPreview({ onSignIn }: { onSignIn: () => void }) {
  const { t } = useTranslation();

  // Contenido puramente decorativo del preview: 3 stats + 4 cards + una
  // gráfica de barras falsa. Cualquier cambio aquí es sólo visual.
  const fakeStats = [
    { n: 128, l: 'Sesiones' },
    { n: 6, l: 'Esta semana' },
    { n: 340, l: 'Minutos' },
  ];
  const fakeCards = [
    { icon: 'ri-calendar-check-line', t: 'Diario', d: 'Registra tu entrenamiento de hoy en 5 s' },
    { icon: 'ri-boxing-line', t: 'Ring', d: 'Sparrings, combates y notas técnicas' },
    { icon: 'ri-scales-2-line', t: 'Peso', d: 'Progresión y objetivos por semana' },
    { icon: 'ri-sparkling-2-line', t: 'Mi plan', d: 'Genera un plan a medida por tu objetivo' },
  ];
  const bars = [22, 45, 30, 55, 12, 40, 60];

  return (
    <div className="min-h-screen rk-screen-bg text-white relative overflow-hidden">
      {/* ── Preview borroso y no interactivo ── */}
      <div aria-hidden style={{ filter: 'blur(8px)', pointerEvents: 'none', userSelect: 'none' }}>
        {/* Top bar decorativa */}
        <div className="fixed top-0 left-0 w-full z-10 bg-zinc-950/80 backdrop-blur-sm border-b border-zinc-800 rk-safe-top">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <i className="ri-arrow-left-line" />
              <span className="hidden sm:inline">Volver</span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 3 }} className="text-white">MI</span>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 3 }} className="text-[#E10600]">ESQUINA</span>
            </div>
            <div style={{ width: 40 }} />
          </div>
        </div>

        <div className="flex min-h-screen max-w-[1400px] mx-auto" style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
          {/* Sidebar fake (escritorio) */}
          <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 border-r border-zinc-800/70 py-6 px-3">
            <nav className="space-y-1 flex-1">
              {['Resumen', 'Agenda', 'Progreso', 'Ring', 'Material', 'Nutrición', 'Timer', 'Mensajes'].map((s, i) => (
                <div key={s} className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium ${i === 0 ? 'bg-red-600 text-white' : 'text-zinc-400'}`}>
                  <span className="w-4 h-4 bg-current opacity-40 rounded-sm" />
                  <span className="flex-1">{s}</span>
                </div>
              ))}
            </nav>
          </aside>

          {/* Main fake */}
          <main className="flex-1 px-4 sm:px-6 lg:px-10 py-8 pt-24 lg:pt-8 min-w-0 space-y-6">
            <div>
              <p className="rk-eyebrow">TU ESQUINA</p>
              <h1 className="rk-h1" style={{ margin: 0, color: '#fff' }}>
                BIENVENIDO DE VUELTA, <span className="rk-red-glow">PELEADOR</span>
              </h1>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {fakeStats.map((s) => (
                <div key={s.l} className="rk-card" style={{ padding: '22px 14px', textAlign: 'center' }}>
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(28px,5vw,40px)', lineHeight: 1, color: '#fff' }}>{s.n}</p>
                  <p className="rk-body" style={{ fontSize: '0.72rem', letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 8 }}>{s.l}</p>
                </div>
              ))}
            </div>

            <div className="rk-card" style={{ padding: 20 }}>
              <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-zinc-600 mb-3">Últimos 7 días</p>
              <div className="flex items-end justify-between gap-1.5" style={{ height: 76 }}>
                {bars.map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[9px] text-zinc-600">{h > 20 ? h : ''}</span>
                    <div className="w-full rounded-md" style={{ height: h, background: i === bars.length - 1 ? '#E10600' : 'rgba(225,6,0,0.45)' }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {fakeCards.map((c) => (
                <div key={c.t} className="rk-card flex items-center gap-3.5" style={{ padding: 18 }}>
                  <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-red-600/12 border border-red-500/25" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">{c.t}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{c.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>

      {/* ── Overlay centrado ── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('nav_my_corner')}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
          background: 'radial-gradient(ellipse at center, rgba(3,3,3,0.55) 0%, rgba(3,3,3,0.75) 100%)',
        }}
      >
        <div className="card-primary" style={{ width: '100%', maxWidth: 420, padding: '32px 26px 28px', textAlign: 'center' }}>
          <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-red-600/12 border border-red-500/30 text-red-400">
            <i className="ri-boxing-line text-3xl" />
          </div>
          <h2 className="rk-title-card" style={{ fontSize: '1.4rem', marginBottom: 10 }}>
            Inicia sesión para acceder a Mi Esquina
          </h2>
          <p className="rk-body-14" style={{ marginBottom: 22 }}>
            Tu diario de entrenamiento, agenda, peso, sparring y plan personalizado — todo tuyo con una cuenta gratuita.
          </p>
          <button
            onClick={onSignIn}
            className="rk-cta"
            style={{ width: '100%', fontSize: '0.95rem', padding: '0.9rem 1.5rem' }}
          >
            {t('nav_sign_in')}
          </button>
        </div>
      </div>
    </div>
  );
}
