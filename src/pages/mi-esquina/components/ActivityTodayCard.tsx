import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Profile } from '@/lib/supabase';
import Reveal from '@/components/base/Reveal';
import { activityKindCfg, type ActivityPayload } from '../lib/dayPlan';
import { loadTodayTraining, type PlannedEntry, type TodayTraining } from '../lib/todayTraining';
import { puedeMontarGuion } from './useActivityLauncher';

// "Hoy toca" de ACTIVIDAD — el gemelo de la card de Fuerza (StrengthSummary).
//
// ── POR QUÉ EXISTE ──
//
// Fuerza tenía su aviso de "hoy toca" y Actividad no tenía ninguno. El único
// sitio donde salía un cardio planificado era el Resumen, y allí compartía
// hueco con Fuerza. Resultado: entrabas en Actividad a resolver lo que el
// Resumen te pedía y la pantalla no mencionaba nada; y al volver, el hueco lo
// ocupaba un bloque de fuerza, que parecía haber salido de la nada.
//
// Ahora cada tipo tiene su aviso en su sección, con la MISMA regla
// (`lib/todayTraining.ts` → `lib/planMatch.ts`). Resolver uno no toca al otro.
//
// Aquí no se decide nada: se pinta lo que devuelve la regla compartida.
//
// ── CADA CARDIO, SU BOTÓN ──
//
// Con dos cardios hoy (uno de mañana y otro de tarde) solo el primero tenía
// botón: el segundo se veía y no había forma de empezarlo desde aquí. Ahora el
// primero lleva el botón rojo grande y los demás, uno pequeño en su fila.
//
// Y lo OPCIONAL de hoy sale debajo, en discreto y sin rojo. Esta es justo la
// pantalla donde se registra el cardio: si hoy te apetece el opcional, tiene
// que estar a mano, no escondido en la Agenda.

interface Props {
  profile: Profile;
  /**
   * Abre lo que RESUELVE ese bloque, no el formulario.
   *
   * Antes esto era `onLog(kind)` y llevaba siempre al registro a mano, que se
   * abría más abajo de donde estabas y sin llevarte a él: desde fuera, darle
   * al botón no hacía nada. Ahora decide el lanzador compartido
   * (useActivityLauncher), el mismo que usa el bloque del día en la Agenda,
   * para que las dos pantallas no puedan volver a hacer cosas distintas.
   */
  onRun: (entry: PlannedEntry) => void;
  /** id del bloque que se está abriendo, para bloquear el botón mientras. */
  abriendo?: string | null;
  /** Abre la Agenda del día. */
  onGoAgenda?: () => void;
  /** Sube al guardar o borrar: obliga a releer sin recargar la página. */
  refreshKey?: number;
}

// El botón dice lo que va a pasar. "Registrar ahora" era mentira cuando lo que
// toca es HACER la sesión: se empieza, y registrar viene después, al acabarla.
const esGuiado = (x: PlannedEntry) => {
  const p = x.payload as ActivityPayload;
  return !!p.protocol_id || !!p.boxing_id || puedeMontarGuion(x.source, p);
};

export default function ActivityTodayCard({ profile, onRun, abriendo, onGoAgenda, refreshKey = 0 }: Props) {
  const { t } = useTranslation();
  const [today, setToday] = useState<TodayTraining | null>(null);

  useEffect(() => {
    let alive = true;
    // Solo 'activity': esta pantalla no pregunta por fuerza ni la enseña.
    loadTodayTraining(profile.id, ['activity']).then((r) => { if (alive) setToday(r); });
    return () => { alive = false; };
  }, [profile.id, refreshKey]);

  // Mientras carga no se pinta nada: un esqueleto aquí arriba empujaría el
  // formulario hacia abajo justo cuando el usuario va a escribir en él.
  if (!today) return null;

  const pending = today.pendingActivity;
  const opcionales = today.optional.filter((x) => x.kind === 'activity');

  /** Detalles del plan, los que haya: duración, distancia, asaltos. */
  const detalles = (p: ActivityPayload) => ([
    p.duration_min ? t('mc_hoy_act_min', { n: p.duration_min }) : null,
    p.distance_km ? `${p.distance_km} km` : null,
    p.meters ? `${p.meters} m` : null,
    p.rounds ? t('mc_hoy_act_rounds', { n: p.rounds }) : null,
    p.note || null,
  ].filter(Boolean) as string[]);

  const cargando = (x: PlannedEntry) => abriendo === x.id;
  const giro = <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />;

  /** Botón pequeño de una fila: para el 2.º cardio en adelante y los opcionales. */
  const botonFila = (x: PlannedEntry) => (
    <button onClick={() => onRun(x)} disabled={cargando(x)}
      aria-label={t(esGuiado(x) ? 'mc_hoy_act_start' : 'mc_hoy_act_cta')}
      className="rk-nav-btn rk-press flex-shrink-0 inline-flex items-center justify-center gap-1.5 text-xs disabled:opacity-60"
      style={{ minHeight: 40, padding: '0 0.9rem' }}>
      {cargando(x) ? giro : <i className={esGuiado(x) ? 'ri-play-fill text-base' : 'ri-edit-box-line text-base'} />}
      <span className="hidden sm:inline">{t(esGuiado(x) ? 'mc_hoy_act_start' : 'mc_hoy_act_cta')}</span>
    </button>
  );

  const bloqueOpcionales = opcionales.length > 0 && (
    <div className="rounded-2xl" style={{ border: '1px dashed rgba(255,255,255,0.16)', padding: '12px 14px', marginBottom: 20 }}>
      <p className="rk-label mb-1">{t('mc_hoy_opt_label')}</p>
      {opcionales.map((x, i) => {
        const p = x.payload as ActivityPayload;
        const cfg = activityKindCfg(p.kind);
        const bits = detalles(p);
        return (
          <div key={x.id || i} className={`flex items-center gap-3 py-2 ${i > 0 ? 'border-t border-white/[0.06]' : ''}`}>
            <i className={`${cfg.icon} flex-shrink-0`} style={{ color: 'var(--t-2)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--t-1)' }}>{p.protocol_name || t(cfg.labelKey)}</p>
              {bits.length > 0 && <p className="text-[11px] truncate" style={{ color: 'var(--t-3)' }}>{bits.join(' · ')}</p>}
            </div>
            {botonFila(x)}
          </div>
        );
      })}
    </div>
  );

  if (pending.length > 0) {
    const primero = pending[0];
    return (
      <>
        <Reveal>
          <div className="card-primary" style={{ padding: 20, marginBottom: 20 }}>
            <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-red-400 mb-1.5">
              {t('mc_hoy_act_title')}
            </p>
            {pending.map((x, i) => {
              const p = x.payload as ActivityPayload;
              const cfg = activityKindCfg(p.kind);
              const bits = detalles(p);
              return (
                <div key={x.id || i} className={`flex items-center gap-3 ${i > 0 ? 'mt-3 pt-3 border-t border-white/[0.08]' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-white flex items-center gap-2">
                      <i className={cfg.icon} style={{ color: cfg.hex }} />
                      <span className="min-w-0">{p.protocol_name || t(cfg.labelKey)}</span>
                    </p>
                    {bits.length > 0 && (
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{bits.join(' · ')}</p>
                    )}
                  </div>
                  {/* El primero se lanza con el botón grande de abajo. */}
                  {i > 0 && botonFila(x)}
                </div>
              );
            })}
            <button
              onClick={() => onRun(primero)}
              disabled={cargando(primero)}
              className="rk-cta w-full flex items-center justify-center gap-2 mt-4 disabled:opacity-60">
              {cargando(primero) ? giro : <i className={esGuiado(primero) ? 'ri-play-fill text-lg' : 'ri-edit-box-line text-lg'} />}
              {t(esGuiado(primero) ? 'mc_hoy_act_start' : 'mc_hoy_act_cta')}
              {pending.length > 1 && (
                <span className="font-normal opacity-80 truncate">· {(primero.payload as ActivityPayload).protocol_name || t(activityKindCfg((primero.payload as ActivityPayload).kind).labelKey)}</span>
              )}
            </button>
          </div>
        </Reveal>
        {bloqueOpcionales}
      </>
    );
  }

  // Nada pendiente pero hoy SÍ se ha hecho algo: se confirma. Sin CTA rojo — no
  // hay nada que empezar.
  if (today.trainedActivity) {
    const label = today.trainedKinds.map((k) => t(activityKindCfg(k).labelKey)).join(' + ');
    return (
      <>
        <Reveal>
          <div className="rk-card" style={{ padding: 18, marginBottom: 20, borderColor: 'rgba(74,222,128,0.3)' }}>
            <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-green-400 mb-1.5 flex items-center gap-1.5">
              <i className="ri-check-double-line" />{t('mc_hoy_act_done')}
            </p>
            <p className="text-base font-bold text-white">{label || t('mc_hoy_act_done')}</p>
            <p className="text-xs text-zinc-400 mt-1">{t('mc_hoy_act_done_desc')}</p>
            {onGoAgenda && (
              <button onClick={onGoAgenda} className="rk-nav-btn text-xs mt-3 inline-flex items-center gap-1.5" style={{ padding: '0.5rem 1rem' }}>
                <i className="ri-calendar-check-line" />{t('mc_hoy_act_see_day')}
              </button>
            )}
          </div>
        </Reveal>
        {bloqueOpcionales}
      </>
    );
  }

  // Ni planificado ni hecho: no se dice nada. Inventar un "deberías salir a
  // correr" sería exactamente la sugerencia que esta pantalla no debe hacer.
  // Lo opcional sí se enseña, si lo hay: lo puso el usuario, no es invento.
  return bloqueOpcionales || null;
}
