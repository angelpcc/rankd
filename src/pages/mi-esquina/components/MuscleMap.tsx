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
  none: '#17171a',
  week: '#7f1518',
  today: '#ed1c24',
};
const STROKE: Record<TrainState, string> = {
  none: 'rgba(255,255,255,0.16)',
  week: '#c52a2f',
  today: '#ff5a5f',
};
const GLOW: Record<TrainState, string | undefined> = {
  none: undefined,
  week: '0 0 10px rgba(225,6,0,0.40)',
  today: '0 0 18px rgba(237,28,36,0.65)',
};

/* ─── Silueta base (partes no interactivas: cabeza, cuello, brazos, piernas) ───
   Compartida entre vista frontal y trasera: la forma del cuerpo no cambia,
   solo qué grupos musculares se resaltan encima. */
const BASE_PARTS = {
  head: { cx: 100, cy: 30, rx: 18, ry: 22 },
  neck: 'M90 46 L90 64 Q100 70 110 64 L110 46 Z',
  armUpperL: 'M63 76 C50 80 41 90 38 106 C36 118 35 140 34 176 L54 176 C55 150 56 122 58 108 C59 96 61 84 68 76 Z',
  armUpperR: 'M137 76 C150 80 159 90 162 106 C164 118 165 140 166 176 L146 176 C145 150 144 122 142 108 C141 96 139 84 132 76 Z',
  armLowerL: 'M34 176 C30 176 27 179 27 185 L25 250 C25 259 30 265 37 266 C44 265 48 259 48 251 L50 185 C50 179 48 176 44 176 Z',
  armLowerR: 'M166 176 C170 176 173 179 173 185 L175 250 C175 259 170 265 163 266 C156 265 152 259 152 251 L150 185 C150 179 152 176 156 176 Z',
  torso: 'M68 76 C59 90 55 104 56 118 L58 148 C56 166 56 182 61 198 L70 212 L130 212 L139 198 C144 182 144 166 142 148 L144 118 C145 104 141 90 132 76 C121 68 109 64 100 64 C91 64 79 68 68 76 Z',
  hips: 'M70 212 L130 212 L135 234 C137 243 134 250 128 252 L72 252 C66 250 63 243 65 234 Z',
  legUpperL: 'M69 244 C63 246 58 253 57 264 L54 316 C54 322 60 326 68 326 C76 326 80 322 80 315 L81 264 C81 253 77 246 71 244 Z',
  legUpperR: 'M131 244 C137 246 142 253 143 264 L146 316 C146 322 140 326 132 326 C124 326 120 322 120 315 L119 264 C119 253 123 246 129 244 Z',
  legLowerL: 'M54 316 L53 328 C52 350 53 376 57 396 C58 403 63 407 68 407 C74 407 79 403 79 396 C81 375 81 349 80 316 C80 322 76 326 68 326 C60 326 54 322 54 316 Z',
  legLowerR: 'M146 316 L147 328 C148 350 147 376 143 396 C142 403 137 407 132 407 C126 407 121 403 121 396 C119 375 119 349 120 316 C120 322 124 326 132 326 C140 326 146 322 146 316 Z',
  footL: 'M56 396 L55 402 C54 409 59 413 66 413 L79 413 C85 413 88 409 85 404 L79 396 Z',
  footR: 'M144 396 L145 402 C146 409 141 413 134 413 L121 413 C115 413 112 409 115 404 L121 396 Z',
};

/* ─── Regiones musculares interactivas ─── */
const FRONT: Region[] = [
  { group: 'shoulders', paths: [
    'M63 76 C55 78 47 83 43 92 C42 99 46 105 53 106 C60 106 65 100 67 92 C68 86 67 80 63 76 Z',
    'M137 76 C145 78 153 83 157 92 C158 99 154 105 147 106 C140 106 135 100 133 92 C132 86 133 80 137 76 Z',
  ]},
  { group: 'chest', paths: [
    'M99 79 C91 75 80 77 74 83 C69 90 70 101 75 107 C81 112 91 111 99 105 Z',
    'M101 79 C109 75 120 77 126 83 C131 90 130 101 125 107 C119 112 109 111 101 105 Z',
  ]},
  { group: 'biceps', paths: [
    'M58 92 C53 100 51 113 52 128 C53 135 61 134 63 124 C65 112 64 100 62 92 Z',
    'M142 92 C147 100 149 113 148 128 C147 135 139 134 137 124 C135 112 136 100 138 92 Z',
  ]},
  { group: 'core', paths: [
    'M79 116 C85 113 94 113 99 116 L99 139 C92 141 85 139 80 135 Z',
    'M101 116 C106 113 115 113 121 116 L120 135 C115 139 108 141 101 139 Z',
    'M80 138 C86 141 93 142 99 140 L99 164 C92 167 85 165 81 161 Z',
    'M101 140 C107 142 114 141 120 138 L119 161 C115 165 108 167 101 164 Z',
    'M82 164 C87 167 93 168 99 166 L99 189 C92 192 87 191 84 188 Z',
    'M101 166 C107 168 113 167 118 164 L116 188 C113 191 108 192 101 189 Z',
  ]},
  { group: 'legs', paths: [
    'M69 245 C62 248 59 255 58 266 L57 311 C63 316 75 316 79 311 L80 266 C80 255 76 248 70 245 Z',
    'M131 245 C138 248 141 255 142 266 L143 311 C137 316 125 316 121 311 L120 266 C120 255 124 248 130 245 Z',
    'M56 320 C61 325 73 325 79 320 L78 389 C74 400 61 400 57 389 Z',
    'M144 320 C139 325 127 325 121 320 L122 389 C126 400 139 400 143 389 Z',
  ]},
];

const BACK: Region[] = [
  { group: 'shoulders', paths: [
    'M63 76 C55 78 47 83 43 92 C42 99 46 105 53 106 C60 106 65 100 67 92 C68 86 67 80 63 76 Z',
    'M137 76 C145 78 153 83 157 92 C158 99 154 105 147 106 C140 106 135 100 133 92 C132 86 133 80 137 76 Z',
  ]},
  { group: 'back', paths: [
    'M70 81 C79 75 91 75 99 80 L99 139 C88 139 78 136 72 128 C69 111 67 94 70 81 Z',
    'M130 81 C121 75 109 75 101 80 L101 139 C112 139 122 136 128 128 C131 111 133 94 130 81 Z',
    'M74 130 C81 137 90 141 99 141 L99 181 C91 183 86 180 83 175 C78 161 75 146 74 130 Z',
    'M126 130 C119 137 110 141 101 141 L101 181 C109 183 114 180 117 175 C122 161 125 146 126 130 Z',
  ]},
  { group: 'triceps', paths: [
    'M58 92 C53 100 51 113 52 128 C53 135 61 134 63 124 C65 112 64 100 62 92 Z',
    'M142 92 C147 100 149 113 148 128 C147 135 139 134 137 124 C135 112 136 100 138 92 Z',
  ]},
  { group: 'legs', paths: [
    'M69 245 C62 248 59 255 58 266 L57 311 C63 316 75 316 79 311 L80 266 C80 255 76 248 70 245 Z',
    'M131 245 C138 248 141 255 142 266 L143 311 C137 316 125 316 121 311 L120 266 C120 255 124 248 130 245 Z',
    'M56 320 C61 325 73 325 79 320 L78 389 C74 400 61 400 57 389 Z',
    'M144 320 C139 325 127 325 121 320 L122 389 C126 400 139 400 143 389 Z',
  ]},
];

/* ─── Líneas de definición muscular (decorativas) ─── */
const FRONT_DETAILS = [
  'M78 80 Q100 75 122 80',   // clavícula
  'M100 80 L100 106',         // línea esternal entre pectorales
  'M100 118 L100 188',        // línea central abdominal
  'M83 134 Q100 138 117 134', // ab 1
  'M81 152 Q100 156 119 152', // ab 2
  'M80 170 Q100 174 120 170', // ab 3
];

const BACK_DETAILS = [
  'M100 80 L100 168',         // columna
  'M79 94 Q100 88 121 94',    // trapecios
  'M85 148 Q100 144 115 148', // lumbar
];

function BaseFigure({ status }: { status: Record<MapGroup, TrainState> }) {
  return (
    <>
      <ellipse cx={BASE_PARTS.head.cx} cy={BASE_PARTS.head.cy} rx={BASE_PARTS.head.rx} ry={BASE_PARTS.head.ry}
        fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.14)" strokeWidth={1} />
      {[BASE_PARTS.neck, BASE_PARTS.armUpperL, BASE_PARTS.armUpperR, BASE_PARTS.torso, BASE_PARTS.hips,
        BASE_PARTS.legUpperL, BASE_PARTS.legUpperR].map((d, i) => (
        <path key={`base-${i}`} d={d} fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.14)" strokeWidth={1} strokeLinejoin="round" />
      ))}
      {[BASE_PARTS.armLowerL, BASE_PARTS.armLowerR, BASE_PARTS.legLowerL, BASE_PARTS.legLowerR,
        BASE_PARTS.footL, BASE_PARTS.footR].map((d, i) => (
        <path key={`base2-${i}`} d={d} fill="url(#bodyGradDark)" stroke="rgba(255,255,255,0.10)" strokeWidth={1} strokeLinejoin="round" />
      ))}
    </>
  );
}

export default function MuscleMap({ status, selected, onSelect }: Props) {
  const { t } = useTranslation();
  const [view, setView] = useState<'front' | 'back'>('front');
  const regions = view === 'front' ? FRONT : BACK;
  const details = view === 'front' ? FRONT_DETAILS : BACK_DETAILS;

  return (
    <div className="rk-card" style={{
      padding: '18px 16px',
      transform: 'none',
      background: 'radial-gradient(circle at 50% 38%, rgba(225,6,0,0.10), transparent 37%), linear-gradient(145deg, #171719, #09090a)',
      borderColor: 'rgba(255,255,255,0.11)',
    }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-zinc-500">{t('mc_str_map_title')}</p>
        <div className="flex gap-1 bg-white/[0.04] rounded-full p-0.5">
          {(['front', 'back'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-colors ${view === v ? 'bg-[#ed1c24] text-white shadow-[0_0_12px_rgba(237,28,36,0.5)]' : 'text-zinc-400 hover:text-white'}`}>
              {t(v === 'front' ? 'mc_str_map_front' : 'mc_str_map_back')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center">
        <svg viewBox="0 0 200 420" width="168" height="353" style={{ filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.55))' }}>
          <defs>
            <radialGradient id="bodyGrad" cx="45%" cy="25%" r="85%">
              <stop offset="0%" stopColor="#44444a" />
              <stop offset="55%" stopColor="#252529" />
              <stop offset="100%" stopColor="#111114" />
            </radialGradient>
            <linearGradient id="bodyGradDark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#29292e" />
              <stop offset="100%" stopColor="#101013" />
            </linearGradient>
            <radialGradient id="todayGrad" cx="50%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#ff4d40" />
              <stop offset="55%" stopColor="#E10600" />
              <stop offset="100%" stopColor="#a30303" />
            </radialGradient>
            <radialGradient id="weekGrad" cx="50%" cy="35%" r="70%">
              <stop offset="0%" stopColor="rgba(225,6,0,0.65)" />
              <stop offset="100%" stopColor="rgba(225,6,0,0.35)" />
            </radialGradient>
            <filter id="selGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3.5" result="blur" />
              <feFlood floodColor="#ed1c24" floodOpacity="0.62" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <BaseFigure status={status} />

          {details.map((d, i) => (
            <path key={`d${i}`} d={d} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={1} strokeLinecap="round" />
          ))}

          {regions.map((r) => {
            const isSel = selected === r.group;
            const st = status[r.group] || 'none';
            const fill = st === 'today' ? 'url(#todayGrad)' : st === 'week' ? 'url(#weekGrad)' : FILL[st];
            const stroke = isSel ? '#ff6b70' : STROKE[st];
            const glow = isSel ? 'url(#selGlow)' : GLOW[st];

            return (
              <g key={r.group} onClick={() => onSelect(r.group)} style={{ cursor: 'pointer' }}
                role="button" aria-label={t(`mc_str_mg_${r.group}`)}>
                {r.paths.map((d, i) => (
                  <path key={i} d={d} fill={fill} stroke={stroke}
                    strokeWidth={isSel ? 2 : 1}
                    strokeLinejoin="round"
                    style={{ transition: 'all 0.3s ease', filter: glow }} />
                ))}
              </g>
            );
          })}
        </svg>

        <div className="flex items-center gap-3 mt-1 mb-3 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: FILL.today, boxShadow: '0 0 8px rgba(225,6,0,0.7)' }} />{t('mc_str_map_today')}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: FILL.week, boxShadow: '0 0 6px rgba(225,6,0,0.4)' }} />{t('mc_str_map_week')}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: FILL.none }} />{t('mc_str_map_none')}</span>
        </div>

        <div className="flex flex-wrap justify-center gap-1.5 w-full">
          {regions.map((r) => {
            const st = status[r.group] || 'none';
            const isSel = selected === r.group;
            return (
              <button key={r.group} onClick={() => onSelect(r.group)} style={{ minHeight: 34 }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-all duration-200 ${
                  isSel
                    ? 'border-[#ed1c24] text-white bg-[#ed1c24]/15 shadow-[0_0_14px_rgba(237,28,36,0.3)]'
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
      </div>
    </div>
  );
}
