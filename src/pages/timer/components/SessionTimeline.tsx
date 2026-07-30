import { useTranslation } from 'react-i18next';
import type { Segment } from '../lib/session';

interface Props {
  schedule: Segment[];
  elapsedTotal?: number;   // segundos transcurridos (indicador animado)
  live?: boolean;          // true durante la sesión: muestra el cabezal
  height?: number;
}

// Línea de tiempo de toda la sesión: asaltos, descansos y cambios de ritmo
// dispuestos a escala real, con un cabezal que avanza mostrando dónde estás.
export default function SessionTimeline({ schedule, elapsedTotal = 0, live = false, height = 74 }: Props) {
  const { t } = useTranslation();
  const total = schedule.reduce((a, s) => a + s.durationSec, 0);
  if (total <= 0) return null;
  const pct = (v: number) => `${(v / total) * 100}%`;
  const progress = Math.max(0, Math.min(1, elapsedTotal / total));

  return (
    <div>
      <div
        className="relative w-full rounded-2xl overflow-hidden border border-white/10"
        style={{ height, background: 'rgba(255,255,255,0.03)' }}
      >
        {/* Segmentos */}
        {schedule.map((s, i) => {
          const isRound = s.type === 'round';
          const isRest = s.type === 'rest';
          const bg = isRound
            ? 'linear-gradient(180deg, rgba(225,6,0,0.55), rgba(225,6,0,0.28))'
            : isRest
              ? 'linear-gradient(180deg, rgba(34,197,94,0.4), rgba(34,197,94,0.18))'
              : 'linear-gradient(180deg, rgba(201,168,76,0.4), rgba(201,168,76,0.18))';
          return (
            <div key={i} className="absolute top-0 bottom-0 flex items-center justify-center"
              style={{ left: pct(s.startAt), width: pct(s.durationSec), padding: '4px 1px' }}>
              <div className="w-full h-full rounded-md flex items-center justify-center relative overflow-hidden" style={{ background: bg }}>
                {isRound && s.durationSec / total > 0.045 && (
                  <span className="text-white/90 font-bold" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 1 }}>{s.round}</span>
                )}
                {isRest && s.durationSec / total > 0.05 && (
                  <i className="ri-rest-time-line text-green-100/80 text-xs"></i>
                )}
                {/* Ventanas de explosión dentro del asalto */}
                {s.bursts.map((b, bi) => (
                  <div key={bi} className="absolute top-0 bottom-0"
                    style={{
                      left: `${(b.startSec / s.durationSec) * 100}%`,
                      width: `${((b.endSec - b.startSec) / s.durationSec) * 100}%`,
                      background: 'repeating-linear-gradient(45deg, rgba(251,146,60,0.95) 0 4px, rgba(234,88,12,0.9) 4px 8px)',
                      boxShadow: '0 0 8px rgba(251,146,60,0.6)',
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Cabezal de progreso */}
        {live && (
          <>
            <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: 0, width: pct(elapsedTotal), background: 'rgba(0,0,0,0.28)' }} />
            <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `calc(${progress * 100}% - 1px)`, width: 2, background: '#fff', boxShadow: '0 0 12px rgba(255,255,255,0.9)' }} />
            <div className="absolute pointer-events-none" style={{ left: `calc(${progress * 100}% - 5px)`, top: -3, width: 10, height: 10, borderRadius: '50%', background: '#fff', boxShadow: '0 0 10px rgba(255,255,255,0.9)' }} />
          </>
        )}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 mt-2.5 flex-wrap">
        <Legend color="#E10600" label={`${schedule.filter((s) => s.type === 'round').length} ${t('tm_phase_round').toLowerCase()}`} />
        {schedule.some((s) => s.type === 'rest') && <Legend color="#22c55e" label={t('tm_phase_rest')} />}
        {schedule.some((s) => s.bursts.length > 0) && <Legend striped label={t('tm_burst_title')} />}
      </div>
    </div>
  );
}

function Legend({ color, striped, label }: { color?: string; striped?: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
      <span className="w-3 h-3 rounded-sm flex-shrink-0" style={striped
        ? { background: 'repeating-linear-gradient(45deg, #fb923c 0 3px, #ea580c 3px 6px)' }
        : { background: color }} />
      {label}
    </span>
  );
}
