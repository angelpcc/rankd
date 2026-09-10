import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Profile } from '@/lib/supabase';
import HubTabs, { HubTab } from '@/pages/mi-esquina/components/HubTabs';
import WeeklyAgenda from '@/pages/mi-esquina/components/WeeklyAgenda';
import PlanificarPanel from '@/pages/mi-esquina/components/PlanificarPanel';
import AgendaWeekStrip from '@/pages/mi-esquina/components/AgendaWeekStrip';
import FightPrep from '@/pages/mi-esquina/components/FightPrep';
import TrainerPlanUpload from '@/pages/mi-esquina/components/TrainerPlanUpload';
import Reveal from '@/components/base/Reveal';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  mode: 'pro' | 'hobby';
  onLogged?: () => void;
  /** Pestaña con la que abrir (para accesos rápidos del resumen). */
  initialTab?: string;
  /** Registrar actividad vive en Progreso › Actividad. */
  onGoActivity: (date?: string, kind?: string) => void;
  /** Registrar fuerza vive en Fuerza › Registrar. */
  onGoStrength?: (date?: string) => void;
}

const TABS: HubTab[] = [
  { id: 'plan', labelKey: 'mc_ag_plan', icon: 'ri-calendar-todo-line' },
  { id: 'planificar', labelKey: 'mc_ag_routines', icon: 'ri-magic-line' },
];

// Compatibilidad: accesos rápidos antiguos apuntaban a 'rutinas'.
const normalizeTab = (id?: string) => (id === 'rutinas' ? 'planificar' : id || 'plan');

/**
 * Agenda de Mi Esquina: Calendario (ve lo planificado) + Planificar (lo
 * escribes o dictas y se reparte por días). Registrar lo que de verdad se
 * hizo vive en Progreso › Actividad (ver onGoActivity).
 */
export default function AgendaHub({ profile, showToast, mode, onLogged, initialTab, onGoActivity, onGoStrength }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<string>(normalizeTab(initialTab));
  useEffect(() => { if (initialTab) setTab(normalizeTab(initialTab)); }, [initialTab]);

  return (
    <div className="max-w-4xl space-y-5 relative">
      {tab === 'plan' && (
        <>
          {mode === 'pro' && (
            <Reveal><FightPrep profile={profile} /></Reveal>
          )}
          {/* Los suplementos ya NO van aquí arriba: se pintan dentro de la vista
              de día (WeeklyAgenda › DayView), junto a fuerza y actividad. */}
          <Reveal delay={30}><AgendaWeekStrip profile={profile} /></Reveal>
        </>
      )}
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'plan' && <TrainerPlanUpload profile={profile} showToast={showToast} />}
      {tab === 'plan' && (
        // `onLogged` también aquí, no solo en Planificar: marcar un bloque como
        // hecho desde el calendario cambia lo que el Resumen debe enseñar, y
        // antes ese aviso no salía de esta pantalla.
        <WeeklyAgenda profile={profile} showToast={showToast} mode={mode}
          onGoActivity={onGoActivity} onGoStrength={onGoStrength} onLogged={onLogged}
          onGoPlanificar={() => setTab('planificar')} />
      )}
      {tab === 'planificar' && <PlanificarPanel profile={profile} showToast={showToast} onLogged={onLogged} />}

      {/* Sin botón flotante: tapaba contenido y repetía lo que ya hay dentro
          del día ("Registrar entreno" al final de la vista de día). */}
    </div>
  );
}
