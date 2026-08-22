import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// Mapa muscular interactivo (bloque C.3). Silueta estilizada frente/espalda con
// zonas tocables por grupo. Color por estado de entreno de la semana:
//   · none  #333 (sin entrenar)
//   · week  rgba(225,6,0,0.4) (entrenado esta semana)
//   · today #E10600 (entrenado hoy)
// Tocar un grupo lo selecciona (filtra la progresión y resalta las sesiones).
// Zonas táctiles amplias (≥44px efectivos): cada región es una forma grande.

export type MapGroup = 'chest' | 'shoulders' | 'biceps' | 'triceps' | 'back' | 'core' | 'legs';
export type TrainState = 'none' | 'week' | 'today';

interface Props {
  status: Record<MapGroup, TrainState>;
  selected: MapGroup | null;
  onSelect: (g: MapGroup) => void;
}

const FILL: Record<TrainState, string> = { none: '#333333', week: 'rgba(225,6,0,0.4)', today: '#E10600' };

// Cada grupo = una o varias formas (mano izq/der en espejo). Path de silueta
// aparte (no tocable). Vista frontal y dorsal.
interface Region { group: MapGroup; shapes: string[] }

const FRONT: Region[] = [
  { group: 'shoulders', shapes: ['M30 62 q-7 -2 -9 8 q9 5 15 2 q1 -8 -6 -10Z', 'M110 62 q7 -2 9 8 q-9 5 -15 2 q-1 -8 6 -10Z'] },
  { group: 'chest', shapes: ['M46 66 q22 -6 26 10 q-13 8 -26 3Z', 'M94 66 q-22 -6 -26 10 q13 8 26 3Z'] },
  { group: 'biceps', shapes: ['M24 78 q-6 12 -2 26 q9 -1 11 -10 q-1 -12 -9 -16Z', 'M116 78 q6 12 2 26 q-9 -1 -11 -10 q1 -12 9 -16Z'] },
  { group: 'core', shapes: ['M56 84 q14 -3 28 0 q2 20 -3 38 q-11 5 -22 0 q-5 -18 -3 -38Z'] },
  { group: 'legs', shapes: ['M52 126 q12 -3 16 0 q1 30 -4 54 q-8 3 -13 0 q-3 -28 1 -54Z', 'M88 126 q-12 -3 -16 0 q-1 30 4 54 q8 3 13 0 q3 -28 -1 -54Z'] },
];

const BACK: Region[] = [
  { group: 'shoulders', shapes: ['M30 62 q-7 -2 -9 8 q9 5 15 2 q1 -8 -6 -10Z', 'M110 62 q7 -2 9 8 q-9 5 -15 2 q-1 -8 6 -10Z'] },
  { group: 'back', shapes: ['M46 64 q24 -6 48 0 q3 30 -4 52 q-20 6 -40 0 q-7 -22 -4 -52Z'] },
  { group: 'triceps', shapes: ['M24 78 q-6 12 -2 26 q9 -1 11 -10 q-1 -12 -9 -16Z', 'M116 78 q6 12 2 26 q-9 -1 -11 -10 q1 -12 9 -16Z'] },
  { group: 'legs', shapes: ['M52 126 q12 -3 16 0 q1 32 -3 58 q-8 3 -13 0 q-4 -30 0 -58Z', 'M88 126 q-12 -3 -16 0 q-1 32 3 58 q8 3 13 0 q4 -30 0 -58Z'] },
];

// Silueta de fondo (cuerpo), no tocable.
const BODY = 'M70 8 q11 0 11 13 q0 9 -6 12 q14 3 22 12 q10 10 12 26 q4 -1 6 4 q3 12 -2 24 q-6 2 -9 -3 q-1 10 -5 16 q3 6 2 16 q-2 30 -6 58 q-1 8 -8 8 q-6 0 -7 -8 q-2 -20 -3 -40 q-1 20 -3 40 q-1 8 -7 8 q-7 0 -8 -8 q-4 -28 -6 -58 q-1 -10 2 -16 q-4 -6 -5 -16 q-3 5 -9 3 q-5 -12 -2 -24 q2 -5 6 -4 q2 -16 12 -26 q8 -9 22 -12 q-6 -3 -6 -12 q0 -13 11 -13Z';

export default function MuscleMap({ status, selected, onSelect }: Props) {
  const { t } = useTranslation();
  const [view, setView] = useState<'front' | 'back'>('front');
  const regions = view === 'front' ? FRONT : BACK;

  return (
    <div className="rk-card" style={{ padding: '16px 14px', transform: 'none' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-zinc-500">{t('mc_str_map_title')}</p>
        {/* Toggle frente / espalda */}
        <div className="flex gap-1 bg-white/[0.04] rounded-full p-0.5">
          {(['front', 'back'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-colors ${view === v ? 'bg-red-600 text-white' : 'text-zinc-400'}`}>
              {t(v === 'front' ? 'mc_str_map_front' : 'mc_str_map_back')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <svg viewBox="0 0 140 200" width="118" height="170" className="flex-shrink-0" style={{ maxWidth: '45%' }}>
          <path d={BODY} fill="#0a0a0a" stroke="rgba(255,255,255,0.10)" strokeWidth={1.2} />
          {regions.map((r) => {
            const isSel = selected === r.group;
            const fill = FILL[status[r.group] || 'none'];
            return (
              <g key={r.group} onClick={() => onSelect(r.group)} style={{ cursor: 'pointer' }}
                role="button" aria-label={t(`mc_str_mg_${r.group}`)}>
                {r.shapes.map((d, i) => (
                  <path key={i} d={d} fill={fill} stroke={isSel ? '#C9A84C' : 'rgba(0,0,0,0.35)'}
                    strokeWidth={isSel ? 2 : 0.8} style={{ transition: 'fill 0.2s' }} />
                ))}
              </g>
            );
          })}
        </svg>

        {/* Leyenda + grupos tocables como chips (garantiza área táctil ≥44px) */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5">
            {regions.map((r) => {
              const st = status[r.group] || 'none';
              const isSel = selected === r.group;
              return (
                <button key={r.group} onClick={() => onSelect(r.group)} style={{ minHeight: 34 }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${isSel ? 'border-[#C9A84C] text-white bg-[#C9A84C]/10' : 'border-white/10 text-zinc-300 hover:border-white/25'}`}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: FILL[st] }} />
                  {t(`mc_str_mg_${r.group}`)}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-3 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: FILL.today }} />{t('mc_str_map_today')}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: FILL.week }} />{t('mc_str_map_week')}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: FILL.none }} />{t('mc_str_map_none')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
