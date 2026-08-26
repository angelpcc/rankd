import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Profile } from '@/lib/supabase';
import HubTabs, { HubTab } from '@/pages/mi-esquina/components/HubTabs';
import WeeklyAgenda from '@/pages/mi-esquina/components/WeeklyAgenda';
import QuickRoutines from '@/pages/mi-esquina/components/QuickRoutines';
import AgendaWeekStrip from '@/pages/mi-esquina/components/AgendaWeekStrip';
import FightPrep from '@/pages/mi-esquina/components/FightPrep';
import TrainerPlanUpload from '@/pages/mi-esquina/components/TrainerPlanUpload';
import TodaySupplements from '@/pages/mi-esquina/components/TodaySupplements';
import Reveal from '@/components/base/Reveal';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  mode: 'pro' | 'hobby';
  onLogged?: () => void;
  /** Pestaña con la que abrir (para accesos rápidos del resumen). */
  initialTab?: string;
  /** Registrar actividad vive en Progreso › Actividad. Agenda solo planifica
   * y visualiza: el "+" flotante y "Ver / Registrar" de un día saltan allí,
   * opcionalmente con una fecha concreta ya puesta. */
  onGoActivity: (date?: string) => void;
}

const TABS: HubTab[] = [
  { id: 'plan', labelKey: 'mc_ag_plan', icon: 'ri-calendar-todo-line' },
  { id: 'rutinas', labelKey: 'mc_ag_routines', icon: 'ri-repeat-line' },
];

/**
 * Agenda de Mi Esquina: Calendario + Rutinas. Solo planificación y
 * visualización — registrar lo que de verdad se hizo vive en
 * Progreso › Actividad (ver onGoActivity).
 */
export default function AgendaHub({ profile, showToast, mode, onLogged, initialTab, onGoActivity }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<string>(initialTab || 'plan');
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);

  return (
    <div className="max-w-4xl space-y-5 relative">
      {tab === 'plan' && (
        <>
          {mode === 'pro' && (
            <Reveal><FightPrep profile={profile} /></Reveal>
          )}
          <Reveal delay={20}><TodaySupplements profile={profile} /></Reveal>
          <Reveal delay={30}><AgendaWeekStrip profile={profile} /></Reveal>
        </>
      )}
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'plan' && <TrainerPlanUpload profile={profile} showToast={showToast} />}
      {tab === 'plan' && <WeeklyAgenda profile={profile} showToast={showToast} mode={mode} onGoActivity={onGoActivity} />}
      {tab === 'rutinas' && <QuickRoutines profile={profile} showToast={showToast} onLogged={onLogged} />}

      {/* Flotante: registrar entreno salta a Progreso › Actividad */}
      {tab === 'plan' && (
        <button onClick={() => onGoActivity()} aria-label={t('mc_ag_fab_log')}
          className="fixed z-40 flex items-center gap-2 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg cursor-pointer transition-colors"
          style={{ right: 'max(1.25rem, env(safe-area-inset-right, 0px))', bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))', padding: '0.9rem 1.3rem', fontSize: '0.85rem', boxShadow: '0 10px 30px rgba(225,6,0,0.4)' }}>
          <i className="ri-add-line text-lg"></i> {t('mc_ag_fab_log')}
        </button>
      )}
    </div>
  );
}
