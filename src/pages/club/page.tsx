import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useSEO } from '@/hooks/useSEO';
import { isMissingTable } from '@/lib/dbState';
import ClubPlan from './components/ClubPlan';
import ClubRoster from './components/ClubRoster';

type Section = 'resumen' | 'plan' | 'roster' | 'timer';

interface SectionDef { id: Section; labelKey: string; icon: string }
const SECTIONS: SectionDef[] = [
  { id: 'resumen', labelKey: 'cl_nav_summary', icon: 'ri-dashboard-line' },
  { id: 'plan', labelKey: 'cl_nav_plan', icon: 'ri-calendar-todo-line' },
  { id: 'roster', labelKey: 'cl_nav_roster', icon: 'ri-group-line' },
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
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [stats, setStats] = useState({ boxers: 0, sessionsWeek: 0 });

  useSEO({ title: 'Espacio de entrenador | RANKD', description: 'Dirige el trabajo de tu grupo: plan semanal del club, tus boxeadores y el temporizador de asaltos.' });

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => { if (!authLoading && !user) navigate('/esquina'); }, [authLoading, user, navigate]);

  // Resuelve a qué gimnasio pertenece: el dueño es su propio org; el coach lo
  // encuentra por su vínculo en gym_staff.
  const resolveOrg = useCallback(async () => {
    if (!profile) return;
    setResolving(true);
    if (profile.user_type === 'gym') {
      setOrgId(profile.id);
      const { data } = await supabase.from('organizations').select('org_name').eq('profile_id', profile.id).maybeSingle();
      setOrgName(data?.org_name || profile.full_name || '');
      setResolving(false);
      return;
    }
    const { data, error } = await supabase.from('gym_staff').select('org_profile_id')
      .eq('coach_profile_id', profile.id).eq('status', 'active').limit(1).maybeSingle();
    if (isMissingTable(error) || !data) { setOrgId(null); setResolving(false); return; }
    setOrgId(data.org_profile_id);
    const { data: org } = await supabase.from('organizations').select('org_name').eq('profile_id', data.org_profile_id).maybeSingle();
    setOrgName(org?.org_name || '');
    setResolving(false);
  }, [profile]);

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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const firstName = (profile.full_name || '').split(' ')[0] || 'RANKD';

  // Coach sin gimnasio: estado cuidado, sin errores.
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
            <p className="text-xs font-bold text-white flex items-center gap-1.5"><i className="ri-whistle-line text-red-400" />{firstName}</p>
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
          {section === 'resumen' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <p className="rk-eyebrow">{t('cl_sum_eyebrow')}{orgName ? ` · ${orgName}` : ''}</p>
                <h1 className="rk-h1" style={{ margin: '4px 0 0', color: '#fff' }}>
                  {t('cl_sum_welcome')}, <span className="rk-red-glow">{firstName.toUpperCase()}</span>
                </h1>
                <p className="text-zinc-400 text-sm mt-2 max-w-md">{t('cl_sum_sub')}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setSection('roster')} className="rk-card text-left cursor-pointer" style={{ padding: '22px 18px' }}>
                  <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-600/10 border border-red-500/25 text-red-400 mb-3"><i className="ri-group-line text-lg" /></div>
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(28px,5vw,40px)', lineHeight: 1, color: '#fff' }}>{stats.boxers}</p>
                  <p className="text-[11px] text-zinc-400 mt-1 uppercase tracking-wider">{t('cl_sum_boxers')}</p>
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
        </main>
      </div>
    </div>
  );
}
