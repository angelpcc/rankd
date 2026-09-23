import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Profile } from '@/lib/supabase';
import HubTabs, { type HubTab } from './HubTabs';
import { SECTION_COLOR, tinte } from '../lib/sectionTheme';
import SectionHero from './SectionHero';
import SectionCoach from './SectionCoach';
import PlanChat from './PlanChat';
import BoxingStudio from './BoxingStudio';
import type { ImagenLista } from '@/lib/imageInput';

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

// ── DOS CHATS, NO TRES FORMULARIOS ──
//
// Había "consulta", "plan semanal" y "plan por objetivo". Las dos últimas eran
// la misma tarea —montar un plan— resuelta con dos formularios distintos, y
// nadie entendía en cuál entrar.
//
// Ahora son dos conversaciones con trabajos distintos:
//   · Consulta — dudas sueltas. "¿Cómo hago este ejercicio?", "¿qué ceno hoy?".
//   · Plan     — montar el plan hablando, verlo, cambiarlo y mandarlo a la app.
// Y Boxeo aparte, porque no es una charla: son dos datos y un cronómetro.
const TABS: HubTab[] = [
  { id: 'consulta', labelKey: 'mc_as_tab_ask', icon: 'ri-chat-smile-3-line' },
  { id: 'plan', labelKey: 'mc_as_tab_planchat', icon: 'ri-calendar-todo-line' },
  // Boxeo va aquí y no en Actividad porque lo que se hace es PEDIRLO, no
  // registrarlo: dices el tiempo que tienes y sale la sesión. Ejecutarla ocurre
  // en el temporizador del Ring, que es donde se cuentan los asaltos.
  { id: 'boxeo', labelKey: 'mc_as_tab_boxing', icon: 'ri-boxing-line' },
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

  /**
   * Lo que Consulta manda a montar al Plan.
   *
   * Le pasas el PDF de tu semana en Consulta y le dices "pásamelo a la app":
   * Consulta no monta planes (solo retoca el que hay), así que antes contestaba
   * "vete a Plan", y allí había que volver a adjuntar el documento y volver a
   * explicarlo todo. Ahora el botón lleva la petición y el documento, y el
   * Plan la manda sola al abrirse.
   */
  const [semillaPlan, setSemillaPlan] = useState<{ texto: string; adjunto?: ImagenLista | null } | null>(null);

  // v4: lo que hace cada modo ya lo dice su tarjeta (ver "Los tres modos"
  // abajo); la cabecera dice qué es el Asesor en general.

  return (
    // 896 px en un monitor de 1500 dejan media pantalla vacia. Se ensancha
    // solo a partir de 1280, y lo que crece es la CAJA: el texto de los
    // mensajes tiene su propio tope de lectura (ver .rk-ai-burbuja).
    <div className="max-w-4xl xl:max-w-[1180px] rk-blocks">
      {/* Era la única sección de Mi Esquina sin cabecera con imagen: empezaba
          directamente en un cuadro de texto y, al lado de Fuerza o Actividad,
          parecía media pantalla sin terminar. */}
      <SectionHero kind="advisor"
        title={t('mc_as_hero_title')} subtitle={t('mc_as_hero_general')} />

      {/* ── Los tres modos ──
          v4: en el móvil, pestañas. Desde tableta, tres tarjetas en fila con
          lo que hace cada uno: "Consulta", "Plan" y "Sesión" a secas no
          decían en qué se diferenciaban, y había que abrirlas para saberlo. */}
      <div className="sm:hidden">
        <HubTabs tabs={TABS} active={tab} onChange={setTab} color={SECTION_COLOR.asesor} />
      </div>
      <div role="tablist" className="hidden sm:grid grid-cols-3 gap-2.5">
        {TABS.map((m) => {
          const on = tab === m.id;
          const desc = m.id === 'plan' ? t('mc_as_sub_plan') : m.id === 'boxeo' ? t('mc_as_sub_boxing') : t('mc_as_ask_sub');
          return (
            <button key={m.id} role="tab" aria-selected={on} onClick={() => setTab(m.id)} className="rk-mode rk-press">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: on ? SECTION_COLOR.asesor : tinte(SECTION_COLOR.asesor, 0.12), color: on ? '#0A0A0B' : SECTION_COLOR.asesor }}>
                <i className={m.icon} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">{t(m.labelKey)}</span>
                <span className="block text-xs mt-0.5 leading-snug line-clamp-2" style={{ color: 'var(--t-3)' }}>{desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ── CONSULTA ABIERTA ── */}
      <div className={isAsk ? 'space-y-4' : 'hidden'}>

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
          onSendToPlan={(s) => { setSemillaPlan(s); setTab('plan'); }}
        />

        <p className="text-[11px] leading-relaxed flex items-start gap-1.5" style={{ color: 'var(--t-3)' }}>
          <i className="ri-information-line mt-0.5 flex-shrink-0" />{t('mc_as_ask_note')}
        </p>
      </div>

      {/* ── EL PLAN, HABLANDO ──
          Sustituye al plan semanal y al plan por objetivo: los dos eran la misma
          tarea resuelta con formularios distintos. Aquí se dice lo que se
          quiere, se pregunta lo que falte, el plan aparece en la conversación y
          se cambia hablando hasta que cuadra. */}
      {tab === 'plan' && (
        <PlanChat profile={profile} showToast={showToast} onGoAgenda={onGoAgenda}
          semilla={semillaPlan} onSemillaUsada={() => setSemillaPlan(null)} />
      )}

      {/* ── ENTRENO DE BOXEO POR ASALTOS (punto 28) ──
          Dices de cuánto tiempo dispones y dónde entrenas, y sale la sesión
          entera. El botón de empezar arranca el temporizador del Ring con los
          asaltos ya configurados: sin eso sería un texto bonito que hay que
          teclear a mano en otra pantalla. */}
      {tab === 'boxeo' && (
        <BoxingStudio profile={profile} showToast={showToast} />
      )}
    </div>
  );
}
