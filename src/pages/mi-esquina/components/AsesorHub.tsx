import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Profile } from '@/lib/supabase';
import HubTabs, { type HubTab } from './HubTabs';
import SectionCoach from './SectionCoach';
import ObjectiveWizard from './ObjectiveWizard';
import WeekPlanStudio from './WeekPlanStudio';

// ASESOR en dos pestañas.
//
//  · Consulta (punto 18) — preguntar cualquier cosa y que te conteste al
//    momento, sin formulario: qué cenar con lo que hay en la nevera, una duda
//    de técnica, cuánto descansar antes de competir. Con hilo: se puede seguir
//    tirando de la misma respuesta.
//  · Plan por objetivo — el flujo estructurado de siempre (objetivo →
//    preguntas → plan de semanas → a la Agenda).
//
// La Consulta va PRIMERA porque es la entrada de menor fricción: la mayoría de
// las veces que alguien abre el Asesor no quiere un plan de ocho semanas,
// quiere que le resuelvan una duda. Quien viene a por el plan llega con la
// pestaña ya puesta (`initialTab`), así que no pierde un toque.
//
// La Consulta se queda MONTADA al cambiar de pestaña: si se desmontara, volver
// del plan borraría la conversación, que es justo lo que el punto 18 pide que
// no pase.

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** Ir a Agenda › Planificar (crear/ajustar el plan a mano). */
  onGoPlan?: () => void;
  /** Ir a la Agenda a ver el plan semanal ya repartido por días. */
  onGoAgenda?: () => void;
  /** Pestaña de entrada. 'plan' para quien viene a por el plan por objetivo. */
  initialTab?: string;
}

const TABS: HubTab[] = [
  { id: 'consulta', labelKey: 'mc_as_tab_ask', icon: 'ri-chat-smile-3-line' },
  { id: 'semana', labelKey: 'mc_as_tab_week', icon: 'ri-calendar-schedule-line' },
  { id: 'plan', labelKey: 'mc_as_tab_plan', icon: 'ri-compass-3-line' },
];

// Enlaces y botones viejos siguen funcionando.
const TAB_ALIAS: Record<string, string> = {
  objetivos: 'plan',
  objetivo: 'plan',
  asesor: 'consulta',
  chat: 'consulta',
  semanal: 'semana',
};

export default function AsesorHub({ profile, showToast, onGoPlan, onGoAgenda, initialTab }: Props) {
  const { t } = useTranslation();
  const resolve = (x?: string) => (x ? (TAB_ALIAS[x] ?? x) : 'consulta');
  const [tab, setTab] = useState<string>(resolve(initialTab));

  // Entrar desde otro sitio pidiendo una pestaña concreta manda sobre lo que
  // estuviera abierto.
  useEffect(() => { if (initialTab) setTab(resolve(initialTab)); }, [initialTab]);

  const isAsk = tab === 'consulta';

  return (
    <div className="max-w-4xl">
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />

      {/* ── CONSULTA ABIERTA ── */}
      <div className={isAsk ? 'space-y-4' : 'hidden'}>
        <header>
          <p className="rk-eyebrow">{t('mc_as_ask_eyebrow')}</p>
          <h2 className="rk-h3" style={{ fontSize: '1.25rem', color: '#fff', margin: '4px 0 0' }}>
            {t('mc_as_ask_title')} <span className="rk-red-glow">{t('mc_as_ask_title_2')}</span>
          </h2>
          <p className="rk-body-14 mt-1">{t('mc_as_ask_sub')}</p>
        </header>

        <SectionCoach
          section="general"
          profile={profile}
          title={t('mc_as_ask_coach_title')}
          intro={t('mc_as_ask_coach_intro')}
          suggestions={[
            t('mc_as_sug_dinner'),
            t('mc_as_sug_technique'),
            t('mc_as_sug_rest'),
            t('mc_as_sug_weight'),
          ]}
          accent="red"
          showToast={showToast}
        />

        <p className="text-[11px] leading-relaxed flex items-start gap-1.5" style={{ color: 'var(--t-3)' }}>
          <i className="ri-information-line mt-0.5 flex-shrink-0" />{t('mc_as_ask_note')}
        </p>
      </div>

      {/* ── PLAN SEMANAL MULTI-MÓDULO ──
          Fuerza + cardios + comidas de una sola petición, con resumen revisable
          antes de guardar nada. */}
      {tab === 'semana' && (
        <WeekPlanStudio profile={profile} showToast={showToast} onGoAgenda={onGoAgenda} />
      )}

      {/* ── PLAN POR OBJETIVO ──
          Se monta solo cuando toca: es una pantalla grande con sus propias
          consultas, y tenerla viva de fondo no aporta nada. */}
      {tab === 'plan' && (
        <ObjectiveWizard profile={profile} showToast={showToast} onGoPlan={onGoPlan} />
      )}
    </div>
  );
}
