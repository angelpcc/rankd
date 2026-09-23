import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Profile } from '@/lib/supabase';
import HubTabs, { HubTab } from '@/pages/mi-esquina/components/HubTabs';
import { SECTION_COLOR } from '../lib/sectionTheme';
import WeeklyAgenda from '@/pages/mi-esquina/components/WeeklyAgenda';
import PlanificarPanel from '@/pages/mi-esquina/components/PlanificarPanel';
import AgendaWeekStrip from '@/pages/mi-esquina/components/AgendaWeekStrip';
import FightPrep from '@/pages/mi-esquina/components/FightPrep';
import TrainerPlanUpload from '@/pages/mi-esquina/components/TrainerPlanUpload';
import Reveal from '@/components/base/Reveal';
import SectionHero from '@/pages/mi-esquina/components/SectionHero';

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
  /** Un entreno de boxeo se ejecuta en el temporizador del Ring, no aquí. */
  onGoBoxing?: (boxingId: string) => void;
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
export default function AgendaHub({ profile, showToast, mode, onLogged, initialTab, onGoActivity, onGoStrength, onGoBoxing }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<string>(normalizeTab(initialTab));
  useEffect(() => { if (initialTab) setTab(normalizeTab(initialTab)); }, [initialTab]);

  return (
    <div className="max-w-4xl xl:max-w-[1120px] space-y-5 relative">
      {/* v4: la cabecera, arriba del todo. Vivía dentro del calendario y salía a
          media página, debajo de las pestañas y del plan del entrenador. */}
      <SectionHero kind="agenda" eyebrow={t('mc_ag_eyebrow')}
        title={`${t('mc_ag_title')} ${t('mc_ag_title_2')}`} subtitle={t('mc_ag_sub')} />
      <HubTabs tabs={TABS} active={tab} onChange={setTab} color={SECTION_COLOR.agenda} />
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
      {tab === 'plan' && (
        // `onLogged` también aquí, no solo en Planificar: marcar un bloque como
        // hecho desde el calendario cambia lo que el Resumen debe enseñar, y
        // antes ese aviso no salía de esta pantalla.
        <WeeklyAgenda profile={profile} showToast={showToast} mode={mode}
          onGoActivity={onGoActivity} onGoStrength={onGoStrength} onGoBoxing={onGoBoxing} onLogged={onLogged}
          onGoPlanificar={() => setTab('planificar')} />
      )}
      {/* El plan del entrenador (su foto o su mensaje), al final: es para
          consultarlo, no lo primero que se hace al entrar. */}
      {tab === 'plan' && <TrainerPlanUpload profile={profile} showToast={showToast} />}
      {tab === 'planificar' && <PlanificarPanel profile={profile} showToast={showToast} onLogged={onLogged} />}

      {/* Sin botón flotante: tapaba contenido y repetía lo que ya hay dentro
          del día ("Registrar entreno" al final de la vista de día). */}
    </div>
  );
}
