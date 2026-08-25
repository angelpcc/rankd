import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type MapGroup = 'chest' | 'shoulders' | 'biceps' | 'triceps' | 'back' | 'core' | 'legs';
export type TrainState = 'none' | 'week' | 'today';

interface Props {
  status: Record<MapGroup, TrainState>;
  selected: MapGroup | null;
  onSelect: (g: MapGroup) => void;
}

interface Region { group: MapGroup; paths: string[] }

/* ─── Colores por estado ─── */
const FILL: Record<TrainState, string> = {
  none: '#1e1e1e',
  week: 'rgba(225,6,0,0.40)',
  today: '#E10600',
};
const STROKE: Record<TrainState, string> = {
  none: '#2e2e2e',
  week: 'rgba(225,6,0,0.55)',
  today: '#ff2222',
};
const GLOW: Record<TrainState, string> = {
  none: 'none',
  week: '0 0 6px rgba(225,6,0,0.25)',
  today: '0 0 10px rgba(225,6,0,0.45)',
};

/* ─── Silueta de cuerpo ─── */
const BODY = [
  // Cabeza + cuello
  'M70 5 c7 0 11 5 11 13 c0 5-3 9-5 12',
  // Hombro derecho → brazo derecho → mano
  'M76 30 c6 1 14 4 20 10 c6 7 10 16 12 26 c1 4 0 8-2 10',
  // Brazo derecho → antebrazo → mano
  'M106 76 c2 6 2 14 0 22 c-1 4-3 8-5 10 c-2 2-5 3-7 2',
  // Tronco derecho
  'M82 40 c4 2 8 10 10 24 c2 14 2 28 0 42',
  // Cadera derecha
  'M92 106 c2 6 2 14 0 20',
  // Pierna derecha
  'M92 126 c4 0 10 2 14 6 c6 8 10 20 12 36 c2 10 2 20 0 30',
  // Pie derecho
  'M118 198 c-2 2-6 2-10 0 c-4-2-6-6-6-10',
  // Pie izquierdo
  'M22 198 c2 2 6 2 10 0 c4-2 6-6 6-10',
  // Pierna izquierda
  'M48 126 c-4 0-10 2-14 6 c-6 8-10 20-12 36 c-2 10-2 20 0 30',
  // Cadera izquierda
  'M48 106 c-2 6-2 14 0 20',
  // Tronco izquierdo
  'M58 40 c-4 2-8 10-10 24 c-2 14-2 28 0 42',
  // Brazo izquierdo → antebrazo → mano
  'M34 76 c-2 6-2 14 0 22 c1 4 3 8 5 10 c2 2 5 3 7 2',
  // Hombro izquierdo → brazo izquierdo → mano
  'M64 30 c-6 1-14 4-20 10 c-6 7-10 16-12 26 c-1 4 0 8 2 10',
  // Cuello → cabeza
  'M65 30 c-1-4 0-8 5-12 c0-8 4-13 11-13',
].join(' ');

/* ─── Regiones musculares ─── */
const FRONT: Region[] = [
  { group: 'shoulders', paths: [
    'M30 54 c-2-1-8 1-10 8 c0 4 3 8 8 8 c4-1 5-6 3-14Z',
    'M110 54 c2-1 8 1 10 8 c0 4-3 8-8 8 c-4-1-5-6-3-14Z',
  ]},
  { group: 'chest', paths: [
    'M44 60 c6-3 14-4 22-1 c2 6-2 14-22 12 c-1-5 0-9 0-11Z',
    'M96 60 c-6-3-14-4-22-1 c-2 6 2 14 22 12 c1-5 0-9 0-11Z',
  ]},
  { group: 'biceps', paths: [
    'M24 70 c-2 4-3 12-1 22 c3 2 7 1 8-6 c1-8 0-13-7-16Z',
    'M116 70 c2 4 3 12 1 22 c-3 2-7 1-8-6 c-1-8 0-13 7-16Z',
  ]},
  { group: 'core', paths: [
    'M56 78 c8-1 18-1 28 0 c2 12-1 26-3 38 c-10 3-18 3-28 0 c-2-12 0-26 3-38Z',
  ]},
  { group: 'legs', paths: [
    'M52 124 c4 0 10 1 14 4 c4 10 6 24 8 40 c2 8 2 16 0 22 c-3 4-8 6-12 4 c-2-8-1-26 0-70Z',
    'M88 124 c-4 0-10 1-14 4 c-4 10-6 24-8 40 c-2 8-2 16 0 22 c3 4 8 6 12 4 c2-8 1-26 0-70Z',
  ]},
];

const BACK: Region[] = [
  { group: 'shoulders', paths: [
    'M30 54 c-2-1-8 1-10 8 c0 4 3 8 8 8 c4-1 5-6 3-14Z',
    'M110 54 c2-1 8 1 10 8 c0 4-3 8-8 8 c-4-1-5-6-3-14Z',
  ]},
  { group: 'back', paths: [
    'M44 58 c10-3 30-3 52 0 c3 16-1 34-5 48 c-14 5-30 5-42 0 c-4-14-5-32-5-48Z',
  ]},
  { group: 'triceps', paths: [
    'M24 70 c-2 4-3 12-1 22 c3 2 7 1 8-6 c1-8 0-13-7-16Z',
    'M116 70 c2 4 3 12 1 22 c-3 2-7 1-8-6 c-1-8 0-13 7-16Z',
  ]},
  { group: 'legs', paths: [
    'M52 124 c4 0 10 1 14 4 c4 12 6 28 8 44 c2 8 2 16 0 22 c-3 4-8 6-12 4 c-2-10-1-30 0-74Z',
    'M88 124 c-4 0-10 1-14 4 c-4 12-6 28-8 44 c-2 8-2 16 0 22 c3 4 8 6 12 4 c2-10 1-30 0-74Z',
  ]},
];

/* ─── Líneas de definición muscular (decorativas) ─── */
const FRONT_DETAILS = [
  // Pectoral líneas
  'M58 64 Q70 68 82 64',
  // Abdominales
  'M70 82 L70 114',
  'M58 90 Q70 92 82 90',
  'M58 100 Q70 102 82 100',
  'M60 110 Q70 112 80 110',
];

const BACK_DETAILS = [
  // Espalda media
  'M70 62 L70 100',
  // Trapecios
  'M56 56 Q70 52 84 56',
  // Lumbar
  'M58 100 Q70 96 82 100',
];

export default function MuscleMap({ status, selected, onSelect }: Props) {
  const { t } = useTranslation();
  const [view, setView] = useState<'front' | 'back'>('front');
  const regions = view === 'front' ? FRONT : BACK;
  const details = view === 'front' ? FRONT_DETAILS : BACK_DETAILS;

  return (
    <div className="rk-card" style={{ padding: '16px 14px', transform: 'none' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-zinc-500">{t('mc_str_map_title')}</p>
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
        <div className="flex-shrink-0" style={{ maxWidth: '45%' }}>
          <svg viewBox="0 0 140 204" width="126" height="180" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}>
            <defs>
              {/* Gradiente del cuerpo */}
              <radialGradient id="bodyGrad" cx="50%" cy="25%" r="75%">
                <stop offset="0%" stopColor="#222" />
                <stop offset="60%" stopColor="#141414" />
                <stop offset="100%" stopColor="#0a0a0a" />
              </radialGradient>

              {/* Gradiente rojo para "hoy" */}
              <radialGradient id="todayGrad" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#ff2222" />
                <stop offset="100%" stopColor="#c40404" />
              </radialGradient>

              {/* Brillo del seleccionado */}
              <filter id="selGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
                <feFlood floodColor="#C9A84C" floodOpacity="0.35" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Sombra interna */}
              <filter id="innerShade" x="-5%" y="-5%" width="110%" height="110%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="blur" />
                <feOffset dx="0" dy="2" result="offset" />
                <feComposite in="SourceGraphic" in2="offset" operator="over" />
              </filter>
            </defs>

            {/* Cuerpo base */}
            <path d={BODY} fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} strokeLinejoin="round" />

            {/* Líneas de definición muscular */}
            {details.map((d, i) => (
              <path key={`d${i}`} d={d} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} strokeLinecap="round" />
            ))}

            {/* Regiones musculares */}
            {regions.map((r) => {
              const isSel = selected === r.group;
              const st = status[r.group] || 'none';
              const fill = st === 'today' ? 'url(#todayGrad)' : FILL[st];
              const stroke = isSel ? '#C9A84C' : STROKE[st];
              const glow = isSel ? 'url(#selGlow)' : GLOW[st] !== 'none' ? undefined : undefined;

              return (
                <g key={r.group} onClick={() => onSelect(r.group)} style={{ cursor: 'pointer' }}
                  role="button" aria-label={t(`mc_str_mg_${r.group}`)}>
                  {r.paths.map((d, i) => (
                    <path key={i} d={d} fill={fill} stroke={stroke}
                      strokeWidth={isSel ? 1.6 : 0.5}
                      strokeLinejoin="round"
                      style={{
                        transition: 'all 0.3s ease',
                        filter: isSel ? 'url(#selGlow)' : undefined,
                      }} />
                  ))}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5">
            {regions.map((r) => {
              const st = status[r.group] || 'none';
              const isSel = selected === r.group;
              return (
                <button key={r.group} onClick={() => onSelect(r.group)} style={{ minHeight: 34 }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-all duration-200 ${
                    isSel
                      ? 'border-[#C9A84C] text-white bg-[#C9A84C]/15 shadow-[0_0_12px_rgba(201,168,76,0.25)]'
                      : 'border-white/10 text-zinc-300 hover:border-white/25 hover:bg-white/[0.03]'
                  }`}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{
                    background: FILL[st],
                    boxShadow: st === 'today' ? '0 0 8px rgba(225,6,0,0.6)' : st === 'week' ? '0 0 4px rgba(225,6,0,0.3)' : undefined,
                  }} />
                  {t(`mc_str_mg_${r.group}`)}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-3 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: FILL.today, boxShadow: '0 0 6px rgba(225,6,0,0.5)' }} />{t('mc_str_map_today')}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: FILL.week }} />{t('mc_str_map_week')}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: FILL.none }} />{t('mc_str_map_none')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
