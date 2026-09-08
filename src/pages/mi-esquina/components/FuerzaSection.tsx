import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Profile } from '@/lib/supabase';
import HubTabs, { type HubTab } from './HubTabs';
import StrengthSummary from './StrengthSummary';
import StrengthLog from './StrengthLog';
import StrengthProgram from './StrengthProgram';
import StrengthProgress from './StrengthProgress';
import ExerciseLibrary from './ExerciseLibrary';
import MobilityRoutines from './MobilityRoutines';

// FUERZA en dos niveles (PROMPT 1):
//  · Nivel 1 (resumen): StrengthSummary — mapa muscular, card de hoy, volumen
//    semanal, últimas sesiones, botón "Entrar a Fuerza".
//  · Nivel 2 (pantalla de trabajo): pestañas Registrar · Programar · Biblioteca
//    · Movilidad · Historial.

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onGoAsesor: () => void;
}

// Cinco pestañas. Registrar absorbe Programar (es la misma tarea, otro día),
// pero MOVILIDAD VUELVE A TENER LA SUYA: metida al final de la biblioteca de
// ejercicios quedaba enterrada y parecía un anexo, cuando es trabajo propio y
// con su propia lógica (zonas del cuerpo, no grupos musculares).
const WORK_TABS: HubTab[] = [
  { id: 'registrar', labelKey: 'mc_str_tab_log', icon: 'ri-add-circle-line' },
  { id: 'progresion', labelKey: 'mc_str_tab_progress', icon: 'ri-line-chart-line' },
  { id: 'biblioteca', labelKey: 'mc_str_tab_library', icon: 'ri-book-open-line' },
  { id: 'movilidad', labelKey: 'mc_str_tab_mobility', icon: 'ri-body-scan-line' },
  { id: 'historial', labelKey: 'mc_str_tab_history', icon: 'ri-history-line' },
];

// Enlaces viejos (y el `onEnter` del resumen) siguen funcionando.
const TAB_ALIAS: Record<string, string> = {
  programar: 'registrar',
};

export default function FuerzaSection({ profile, showToast, onGoAsesor }: Props) {
  const { t } = useTranslation();
  const [view, setView] = useState<'summary' | 'work'>('summary');
  const [tab, setTab] = useState('registrar');

  const enter = (target?: string) => { if (target) setTab(TAB_ALIAS[target] ?? target); setView('work'); };

  if (view === 'summary') {
    return <StrengthSummary profile={profile} onEnter={enter} onGoAsesor={onGoAsesor} />;
  }

  return (
    <div className="max-w-4xl">
      <button onClick={() => setView('summary')}
        className="text-xs text-zinc-400 hover:text-white cursor-pointer inline-flex items-center gap-1.5 mb-4">
        <i className="ri-arrow-left-line" />{t('mc_str_back_summary')}
      </button>

      <HubTabs tabs={WORK_TABS} active={tab} onChange={setTab} />

      {tab === 'registrar' && (
        <>
          <StrengthLog profile={profile} showToast={showToast}
            hideSummaryBlocks hideHistory onSeeHistory={() => setTab('historial')} />
          {/* Programar vive aquí: es la misma tarea (dejar preparado un
              entreno), solo que para otro día. */}
          <div className="mt-8 pt-8" style={{ borderTop: '1px solid var(--s-3)' }}>
            <StrengthProgram profile={profile} showToast={showToast} />
          </div>
        </>
      )}
      {tab === 'progresion' && <StrengthProgress profile={profile} />}
      {/* Biblioteca = SOLO ejercicios de fuerza. Movilidad y estiramientos
          tienen su propia pestaña: mezclarlos aquí los hacía invisibles. */}
      {tab === 'biblioteca' && <ExerciseLibrary />}
      {tab === 'movilidad' && <MobilityRoutines />}
      {tab === 'historial' && (
        <StrengthLog profile={profile} showToast={showToast} hideSummaryBlocks hideRegisterCta />
      )}
    </div>
  );
}
