import { useState, useEffect, useCallback } from 'react';
import { SkeletonDashboard } from '@/components/base/Skeleton';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { isViewingAs } from '@/lib/viewAs';
import { useSEO } from '@/hooks/useSEO';
import { isMissingTable } from '@/lib/dbState';
import PageBreadcrumb from '@/components/base/PageBreadcrumb';
import ClubPlan from './components/ClubPlan';
import ClubRoster from './components/ClubRoster';
import MessagesPanel from '@/pages/dashboard/components/messages/MessagesPanel';

type Section = 'resumen' | 'plan' | 'roster' | 'mensajes' | 'timer';

interface SectionDef { id: Section; labelKey: string; icon: string }
// Mensajes usa la mensajería que ya existe en los paneles (MessagesPanel), no
// una nueva: es la misma bandeja, vista desde aquí.
const SECTIONS: SectionDef[] = [
  { id: 'resumen', labelKey: 'cl_nav_summary', icon: 'ri-dashboard-line' },
  { id: 'plan', labelKey: 'cl_nav_plan', icon: 'ri-calendar-todo-line' },
  { id: 'roster', labelKey: 'cl_nav_roster', icon: 'ri-group-line' },
  { id: 'mensajes', labelKey: 'cl_nav_messages', icon: 'ri-chat-3-line' },
  { id: 'timer', labelKey: 'cl_nav_timer', icon: 'ri-timer-flash-line' },
];

function weekStartISO(): string {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ClubPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, profile, loading: authLoading } = useAuth();

  const [section, setSection] = useState<Section>('resumen');
  const [resolving, setResolving] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  // Entrenador que trabaja por su cuenta (su club es él mismo).
  const [freelance, setFreelance] = useState(false);
  // Entrenador sin gimnasio Y sin haber elegido todavía cómo trabaja.
  const [freelanceChoice, setFreelanceChoice] = useState(false);
  const [starting, setStarting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [stats, setStats] = useState({ boxers: 0, sessionsWeek: 0 });

  useSEO({ title: 'Espacio de entrenador | RANKD', description: 'Dirige el trabajo de tu grupo: plan semanal del club, tus boxeadores y el temporizador de asaltos.' });

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => { if (!authLoading && !user && !isViewingAs()) navigate('/esquina'); }, [authLoading, user, navigate]);

  /**
   * ¿De qué "club" es este espacio?
   *
   *  · Gimnasio  → él mismo es el club.
   *  · Entrenador de un gimnasio → el gimnasio al que le vincula gym_staff.
   *  · Entrenador POR SU CUENTA → él mismo. Es un club de uno: se apunta con
   *    una fila de gym_staff consigo mismo, que es lo que deja constancia de
   *    que ha elegido trabajar así. No hace falta nada más en la base porque
   *    rk_is_gym_staff(org) ya da permiso cuando org = auth.uid(), así que la
   *    lista de alumnos, el plan y las asignaciones funcionan igual.
   *
   * Si es entrenador y todavía no ha elegido, `freelanceChoice` pone la
   * pantalla de elección en vez del callejón sin salida de antes.
   */
  const resolveOrg = useCallback(async () => {
    if (!profile) return;
    setResolving(true);
    setFreelanceChoice(false);
    if (profile.user_type === 'gym') {
      setOrgId(profile.id);
      const { data } = await supabase.from('organizations').select('org_name').eq('profile_id', profile.id).maybeSingle();
      setOrgName(data?.org_name || profile.full_name || '');
      setResolving(false);
      return;
    }
    const { data, error } = await supabase.from('gym_staff').select('org_profile_id')
      .eq('coach_profile_id', profile.id).eq('status', 'active');
    if (isMissingTable(error)) { setOrgId(null); setResolving(false); return; }

    const rows = data || [];
    // Un gimnasio de verdad manda sobre el espacio propio: si le han invitado,
    // lo normal es que quiera trabajar allí.
    const gym = rows.find((r) => r.org_profile_id !== profile.id);
    if (gym) {
      setOrgId(gym.org_profile_id);
      const { data: org } = await supabase.from('organizations').select('org_name').eq('profile_id', gym.org_profile_id).maybeSingle();
      setOrgName(org?.org_name || '');
      setResolving(false);
      return;
    }
    if (rows.some((r) => r.org_profile_id === profile.id)) {
      setOrgId(profile.id);
      setOrgName(profile.full_name || '');
      setFreelance(true);
      setResolving(false);
      return;
    }
    setOrgId(null);
    setFreelanceChoice(profile.user_type === 'coach');
    setResolving(false);
  }, [profile]);

  // Empezar a trabajar por su cuenta: deja la fila consigo mismo y entra.
  const startFreelance = useCallback(async () => {
    if (!profile) return;
    setStarting(true);
    const { error } = await supabase.from('gym_staff').upsert({
      org_profile_id: profile.id, coach_profile_id: profile.id,
      role: 'owner', status: 'active',
    }, { onConflict: 'org_profile_id,coach_profile_id' });
    setStarting(false);
    if (error) { showToast(t('error_save'), 'error'); return; }
    await resolveOrg();
  }, [profile, resolveOrg, t]);

  useEffect(() => { resolveOrg(); }, [resolveOrg]);

  // Cifras del resumen.
  const loadStats = useCallback(async () => {
    if (!orgId) return;
    const [{ count: boxers }, { count: sessionsWeek }] = await Promise.all([
      supabase.from('gym_roster').select('id', { count: 'exact', head: true }).eq('org_profile_id', orgId).eq('status', 'active'),
      supabase.from('club_sessions').select('id', { count: 'exact', head: true }).eq('org_profile_id', orgId).gte('session_date', weekStartISO()),
    ]);
    setStats({ boxers: boxers || 0, sessionsWeek: sessionsWeek || 0 });
  }, [orgId]);

  useEffect(() => { loadStats(); }, [loadStats, section]);

  if (authLoading || !user || !profile || resolving) {
    return (
      <div className="min-h-screen bg-zinc-950"><SkeletonDashboard /></div>
    );
  }

  const firstName = (profile.full_name || '').split(' ')[0] || 'RANKD';

  // Entrenador sin gimnasio: ANTES era un callejón sin salida ("aún no
  // perteneces a ningún club, espera la invitación"). Ahora elige: montar su
  // propio espacio o meter el código que le hayan pasado.
  if (!orgId && freelanceChoice) {
    return (
      <div className="min-h-screen bg-[#070707] text-white flex items-center justify-center px-5 py-10">
        <div className="rk-card max-w-md w-full" style={{ padding: '32px 24px' }}>
          <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
            <i className="ri-user-voice-line text-3xl text-red-400" />
          </div>
          <h2 className="rk-h3 text-center" style={{ fontSize: '1.4rem', color: '#fff' }}>{t('cl_setup_title')}</h2>
          <p className="text-sm text-zinc-400 mt-2 leading-relaxed text-center">{t('cl_setup_desc')}</p>

          <div className="space-y-2.5 mt-6">
            <button onClick={startFreelance} disabled={starting}
              className="w-full text-left rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-red-600/[0.07] hover:border-red-500/40 transition-all cursor-pointer px-4 py-4 flex items-center gap-3 disabled:opacity-60"
              style={{ minHeight: 64 }}>
              <i className="ri-user-star-line text-red-400 text-lg flex-shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-white font-bold text-sm">{t('cl_setup_own')}</span>
                <span className="block text-white/50 text-xs leading-relaxed mt-0.5">{t('cl_setup_own_desc')}</span>
              </span>
              {starting
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
                : <i className="ri-arrow-right-line text-zinc-600 flex-shrink-0" />}
            </button>

            <button onClick={() => navigate('/unirse')}
              className="w-full text-left rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/25 transition-all cursor-pointer px-4 py-4 flex items-center gap-3"
              style={{ minHeight: 64 }}>
              <i className="ri-building-4-line text-zinc-400 text-lg flex-shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-white font-bold text-sm">{t('cl_setup_join')}</span>
                <span className="block text-white/50 text-xs leading-relaxed mt-0.5">{t('cl_setup_join_desc')}</span>
              </span>
              <i className="ri-arrow-right-line text-zinc-600 flex-shrink-0" />
            </button>
          </div>

          <p className="text-[11px] text-zinc-600 mt-4 text-center leading-relaxed">{t('cl_setup_switch_note')}</p>
        </div>
      </div>
    );
  }

  // Cualquier otro caso sin club (p. ej. un tipo de cuenta que no toca aquí).
  if (!orgId) {
    return (
      <div className="min-h-screen bg-[#070707] text-white flex items-center justify-center px-5">
        <div className="rk-card text-center max-w-md" style={{ padding: '48px 28px' }}>
          <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
            <i className="ri-building-4-line text-3xl text-red-400" />
          </div>
          <h2 className="rk-h3" style={{ fontSize: '1.4rem', color: '#fff' }}>{t('cl_no_gym_title')}</h2>
          <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{t('cl_no_gym_desc')}</p>
          <button onClick={() => navigate('/beta')} className="rk-btn rk-btn-ghost mt-5" style={{ fontSize: '0.85rem' }}>{t('cl_back_home')}</button>
        </div>
      </div>
    );
  }

  const isOwner = profile.user_type === 'gym';

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      {/* Top bar */}
      <div className="fixed top-0 left-0 w-full z-40 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800 rk-safe-top">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button onClick={() => navigate(isOwner ? '/dashboard/org' : '/beta')} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer">
            <i className="ri-arrow-left-line" />
            <span className="hidden sm:inline">{isOwner ? t('cl_back_dashboard') : t('cl_back_home')}</span>
          </button>
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 3 }} className="text-white">{t('cl_brand_space')}</span>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 3 }} className="text-[#E10600]">{t('cl_brand_club')}</span>
            {orgName && <span className="hidden sm:inline text-[10px] text-zinc-500 truncate max-w-[160px]">· {orgName}</span>}
          </div>
          <a href="/beta" className="hidden sm:flex items-center gap-0 cursor-pointer">
            <span className="font-unbounded font-black tracking-tighter leading-none text-[15px] text-white" style={{ letterSpacing: '-0.04em' }}>RAN</span>
            <span className="font-unbounded font-black tracking-tighter leading-none text-[15px] text-[#E10600]" style={{ letterSpacing: '-0.04em' }}>KD</span>
          </a>
        </div>
      </div>

      {toast && (
        <div role="status" className={`anim-fade-up fixed z-50 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm text-white text-sm px-4 py-3.5 rounded-2xl flex items-center gap-3 ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}
          style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
          <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-white/20 anim-scale-in">
            <i className={`text-lg ${toast.type === 'error' ? 'ri-error-warning-line' : 'ri-check-line'}`} />
          </span>
          <span className="flex-1 min-w-0 font-semibold leading-snug">{toast.msg}</span>
        </div>
      )}

      <div className="flex min-h-screen max-w-[1400px] mx-auto" style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
        {/* Sidebar (escritorio) */}
        <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 border-r border-zinc-800/70 py-6 px-3 sticky h-[calc(100vh-3.5rem)] overflow-y-auto" style={{ top: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
          <nav className="space-y-1 flex-1">
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => (s.id === 'timer' ? navigate('/mi-esquina/timer') : setSection(s.id))}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer text-left ${section === s.id ? 'bg-red-600 text-white shadow-lg shadow-red-600/25' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'}`}>
                <i className={`${s.icon} text-base flex-shrink-0`} />
                <span className="flex-1">{t(s.labelKey)}</span>
              </button>
            ))}
          </nav>
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800">
            <p className="text-xs font-bold text-white flex items-center gap-1.5"><i className="ri-user-voice-line text-red-400" />{firstName}</p>
            <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{t('cl_sum_sub')}</p>
          </div>
        </aside>

        {/* Tabs móvil */}
        <div className="lg:hidden fixed left-0 right-0 z-30 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 overflow-x-auto" style={{ top: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
          <div className="flex px-3 py-2 gap-1 min-w-max">
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => (s.id === 'timer' ? navigate('/mi-esquina/timer') : setSection(s.id))}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${section === s.id ? 'bg-red-600 text-white' : 'text-zinc-400'}`}>
                <i className={s.icon} />{t(s.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Main */}
        <main key={section} className="rk-section-in flex-1 px-4 sm:px-6 lg:px-10 py-8 pt-24 lg:pt-8 pb-16 min-w-0">
          {/* Migas de pan: dónde estoy dentro del club y cómo volver (bloque 4). */}
          {section !== 'resumen' && (
            <PageBreadcrumb
              root={t('cl_here_root')}
              section={t(SECTIONS.find((s) => s.id === section)?.labelKey || 'cl_nav_summary')}
              onRoot={() => setSection('resumen')}
            />
          )}
          {section === 'resumen' && (
            <div className="space-y-6 max-w-3xl">
              {/* Quien trabaja por su cuenta no tiene "club": tiene alumnos.
                  Hablarle de gimnasio sería hablarle de algo que no existe. */}
              <div>
                <p className="rk-eyebrow">
                  {freelance ? t('cl_sum_eyebrow_own') : t('cl_sum_eyebrow')}
                  {!freelance && orgName ? ` · ${orgName}` : ''}
                </p>
                <h1 className="rk-h1" style={{ margin: '4px 0 0', color: '#fff' }}>
                  {t('cl_sum_welcome')}, <span className="rk-red-glow">{firstName.toUpperCase()}</span>
                </h1>
                <p className="text-zinc-400 text-sm mt-2 max-w-md">{freelance ? t('cl_sum_sub_own') : t('cl_sum_sub')}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setSection('roster')} className="rk-card text-left cursor-pointer" style={{ padding: '22px 18px' }}>
                  <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-600/10 border border-red-500/25 text-red-400 mb-3"><i className="ri-group-line text-lg" /></div>
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(28px,5vw,40px)', lineHeight: 1, color: '#fff' }}>{stats.boxers}</p>
                  <p className="text-[11px] text-zinc-400 mt-1 uppercase tracking-wider">{freelance ? t('cl_sum_students') : t('cl_sum_boxers')}</p>
                </button>
                <button onClick={() => setSection('plan')} className="rk-card text-left cursor-pointer" style={{ padding: '22px 18px' }}>
                  <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 mb-3"><i className="ri-calendar-todo-line text-lg" /></div>
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(28px,5vw,40px)', lineHeight: 1, color: '#4ade80' }}>{stats.sessionsWeek}</p>
                  <p className="text-[11px] text-zinc-400 mt-1 uppercase tracking-wider">{t('cl_sum_sessions_week')}</p>
                </button>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { s: 'plan' as Section, icon: 'ri-calendar-todo-line', label: t('cl_sum_quick_plan') },
                  { s: 'roster' as Section, icon: 'ri-group-line', label: t('cl_sum_quick_roster') },
                  { s: 'timer' as Section, icon: 'ri-timer-flash-line', label: t('cl_sum_quick_timer') },
                ].map((c) => (
                  <button key={c.s} onClick={() => (c.s === 'timer' ? navigate('/mi-esquina/timer') : setSection(c.s))} className="rk-card text-left group flex items-center gap-3.5" style={{ padding: 18, cursor: 'pointer' }}>
                    <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-red-600/12 border border-red-500/25 text-red-400"><i className={`${c.icon} text-lg`} /></div>
                    <p className="text-sm font-bold text-white flex-1">{c.label}</p>
                    <i className="ri-arrow-right-line text-zinc-600 group-hover:text-red-400 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {section === 'plan' && <ClubPlan orgId={orgId} coachId={profile.id} showToast={showToast} />}
          {section === 'roster' && <ClubRoster orgId={orgId} showToast={showToast} />}
          {section === 'mensajes' && (
            <div className="max-w-4xl">
              <div className="mb-5">
                <p className="rk-eyebrow">{t('cl_msg_eyebrow')}</p>
                <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
                  {t('cl_nav_messages')}
                </h2>
                <p className="text-sm text-zinc-400 mt-2 max-w-lg leading-relaxed">{t('cl_msg_desc')}</p>
              </div>
              <MessagesPanel currentUserId={profile.id} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
