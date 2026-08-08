import { useState, useEffect } from 'react';
import { Profile } from '@/lib/supabase';
import HubTabs, { HubTab } from '@/pages/mi-esquina/components/HubTabs';
import WeeklyAgenda from '@/pages/mi-esquina/components/WeeklyAgenda';
import FighterTraining from '@/pages/dashboard/components/FighterTraining';
import QuickRoutines from '@/pages/mi-esquina/components/QuickRoutines';
import AgendaWeekStrip from '@/pages/mi-esquina/components/AgendaWeekStrip';
import FightPrep from '@/pages/mi-esquina/components/FightPrep';
import Reveal from '@/components/base/Reveal';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  mode: 'pro' | 'hobby';
  onLogged?: () => void;
  /** Pestaña con la que abrir (para accesos rápidos del resumen). */
  initialTab?: string;
}

const TABS: HubTab[] = [
  { id: 'plan', labelKey: 'mc_ag_plan', icon: 'ri-calendar-todo-line' },
  { id: 'diario', labelKey: 'mc_ag_log', icon: 'ri-calendar-check-line' },
  { id: 'rutinas', labelKey: 'mc_ag_routines', icon: 'ri-repeat-line' },
];

/**
 * Agenda de Mi Esquina: reúne el antiguo Calendario, el Diario de entrenos y
 * las Rutinas en una sola sección con pestañas. Planificar hacia adelante
 * (plan) y registrar hacia atrás (diario) viven juntos, que es como se usan.
 */
export default function AgendaHub({ profile, showToast, mode, onLogged, initialTab }: Props) {
  const [tab, setTab] = useState<string>(initialTab || 'plan');
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);

  return (
    <div className="max-w-4xl space-y-5">
      {tab === 'plan' && (
        <>
          {mode === 'pro' && (
            <Reveal><FightPrep profile={profile} /></Reveal>
          )}
          <Reveal delay={30}><AgendaWeekStrip profile={profile} /></Reveal>
        </>
      )}
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'plan' && <WeeklyAgenda profile={profile} showToast={showToast} mode={mode} />}
      {tab === 'diario' && <FighterTraining profile={profile} showToast={showToast} />}
      {tab === 'rutinas' && <QuickRoutines profile={profile} showToast={showToast} onLogged={onLogged} />}
    </div>
  );
}
