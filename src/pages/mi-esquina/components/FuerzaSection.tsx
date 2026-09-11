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
//  · Nivel 2 (pantalla de trabajo): pestañas Registrar · Progresión ·
//    Biblioteca · Movilidad · Historial.

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onGoAsesor: () => void;
  /** Avisa al Resumen de que hay una sesión nueva (o una menos) en el historial. */
  onLogged?: () => void;
  /**
   * Pestaña con la que abrir directamente la pantalla de trabajo.
   *
   * La manda quien viene a RESOLVER algo concreto (la tarjeta "hoy toca" del
   * Resumen, un bloque de la Agenda). Sin esto se aterrizaba en el resumen de
   * Fuerza, que vuelve a decir "hoy toca" y obliga a un clic más para hacer lo
   * que ya se había pedido.
   */
  initialTab?: string;
  /** Día del bloque que se viene a resolver, si viene de la Agenda. */
  initialDate?: string;
}

// Cinco pestañas. Registrar absorbe Programar (es la misma tarea, otro día),
// pero MOVILIDAD TIENE LA SUYA: metida al final de la biblioteca de ejercicios
// quedaba enterrada y parecía un anexo, cuando es trabajo propio y con su
// propia lógica (zonas del cuerpo, no grupos musculares).
//
// RUTINAS ya no está aquí. Una rutina no es otra pantalla de Fuerza: es lo que
// toca un día, así que se mete en Agenda › Planificar y vive en los días del
// plan. Tener las dos cosas obligaba a escribir el mismo entreno dos veces —
// una al planificar la semana y otra al "crear la rutina".
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

export default function FuerzaSection({ profile, showToast, onGoAsesor, onLogged, initialTab, initialDate }: Props) {
  const { t } = useTranslation();
  // Con `initialTab` se entra directo al trabajo; sin él, al resumen. Se lee
  // una sola vez al montar: `page.tsx` remonta esta sección en cada cambio de
  // pestaña (`<main key={activeSection}>`), así que no hace falta sincronizar
  // después — y si se sincronizara, volver atrás con la flecha rebotaría.
  const [view, setView] = useState<'summary' | 'work'>(initialTab ? 'work' : 'summary');
  const [tab, setTab] = useState(initialTab ? (TAB_ALIAS[initialTab] ?? initialTab) : 'registrar');
  // ── DOS CONTADORES, NO UNO ──
  //
  // `remountKey` es el `key` de React del registro y del historial: al subir,
  // esos componentes se remontan y vuelven a cargar.
  //
  // `summaryKey` solo hace que el resumen relea lo que toca hoy. Es el que sube
  // el registro manual: si ese camino tocara `remountKey`, se estaría
  // remontando el propio formulario justo mientras termina de guardar.
  //
  // Con un solo contador había que elegir entre remontar de más o no refrescar
  // el resumen; con dos, cada camino hace exactamente lo que necesita.
  const [remountKey, setRemountKey] = useState(0);
  const [summaryKey, setSummaryKey] = useState(0);

  /** Una sesión ha cambiado desde el registro manual. */
  const loggedHere = () => { setSummaryKey((k) => k + 1); onLogged?.(); };

  const enter = (target?: string) => { if (target) setTab(TAB_ALIAS[target] ?? target); setView('work'); };

  if (view === 'summary') {
    return <StrengthSummary profile={profile} onEnter={enter} onGoAsesor={onGoAsesor} refreshKey={summaryKey} />;
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
          <StrengthLog key={`log-${remountKey}`} profile={profile} showToast={showToast}
            hideSummaryBlocks hideHistory onSeeHistory={() => setTab('historial')}
            initialDate={initialDate}
            onLogged={loggedHere} />
          {/* Programar vive aquí: es la misma tarea (dejar preparado un
              entreno), solo que para otro día. */}
          <div className="mt-8 pt-8" style={{ borderTop: '1px solid var(--s-3)' }}>
            <StrengthProgram profile={profile} showToast={showToast} />
          </div>
        </>
      )}
      {tab === 'progresion' && <StrengthProgress key={`prog-${remountKey}`} profile={profile} />}
      {/* Biblioteca = SOLO ejercicios de fuerza. Movilidad y estiramientos
          tienen su propia pestaña: mezclarlos aquí los hacía invisibles. */}
      {/* `isPro` solo cambia la PRESENTACIÓN de la biblioteca: pone delante el
          repertorio de peleador y enseña la tarjeta que lo explica. El
          aficionado ve los mismos ejercicios y tiene el mismo filtro. */}
      {tab === 'biblioteca' && <ExerciseLibrary isPro={profile.athlete_mode !== 'hobby'} />}
      {tab === 'movilidad' && <MobilityRoutines />}
      {tab === 'historial' && (
        <StrengthLog key={`hist-${remountKey}`} profile={profile} showToast={showToast}
          hideSummaryBlocks hideRegisterCta />
      )}
    </div>
  );
}
