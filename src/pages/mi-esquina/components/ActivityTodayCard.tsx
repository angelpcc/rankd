import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Profile } from '@/lib/supabase';
import Reveal from '@/components/base/Reveal';
import { activityKindCfg, type ActivityPayload } from '../lib/dayPlan';
import { loadTodayTraining, type TodayTraining } from '../lib/todayTraining';

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

interface Props {
  profile: Profile;
  /** Abre el formulario de registro, con el tipo ya puesto si se sabe. */
  onLog: (kind?: string) => void;
  /** Abre la Agenda del día. */
  onGoAgenda?: () => void;
  /** Sube al guardar o borrar: obliga a releer sin recargar la página. */
  refreshKey?: number;
}

export default function ActivityTodayCard({ profile, onLog, onGoAgenda, refreshKey = 0 }: Props) {
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

  if (pending.length > 0) {
    return (
      <Reveal>
        <div className="card-primary" style={{ padding: 20, marginBottom: 20 }}>
          <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-red-400 mb-1.5">
            {t('mc_hoy_act_title')}
          </p>
          {pending.map((x, i) => {
            const p = x.payload as ActivityPayload;
            const cfg = activityKindCfg(p.kind);
            // Detalles del plan, los que haya: duración, distancia, asaltos.
            const bits = [
              p.duration_min ? t('mc_hoy_act_min', { n: p.duration_min }) : null,
              p.distance_km ? `${p.distance_km} km` : null,
              p.meters ? `${p.meters} m` : null,
              p.rounds ? t('mc_hoy_act_rounds', { n: p.rounds }) : null,
              p.note || null,
            ].filter(Boolean) as string[];
            return (
              <div key={x.id || i} className={i > 0 ? 'mt-3 pt-3 border-t border-white/[0.08]' : ''}>
                <p className="text-base font-bold text-white flex items-center gap-2">
                  <i className={cfg.icon} style={{ color: cfg.hex }} />
                  {p.protocol_name || t(cfg.labelKey)}
                </p>
                {bits.length > 0 && (
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{bits.join(' · ')}</p>
                )}
              </div>
            );
          })}
          <button
            onClick={() => onLog((pending[0].payload as ActivityPayload).kind)}
            className="rk-cta w-full flex items-center justify-center gap-2 mt-4">
            <i className="ri-play-fill text-lg" />{t('mc_hoy_act_cta')}
          </button>
        </div>
      </Reveal>
    );
  }

  // Nada pendiente pero hoy SÍ se ha hecho algo: se confirma. Sin CTA rojo — no
  // hay nada que empezar.
  if (today.trainedActivity) {
    const label = today.trainedKinds.map((k) => t(activityKindCfg(k).labelKey)).join(' + ');
    return (
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
    );
  }

  // Ni planificado ni hecho: no se dice nada. Inventar un "deberías salir a
  // correr" sería exactamente la sugerencia que esta pantalla no debe hacer.
  return null;
}
