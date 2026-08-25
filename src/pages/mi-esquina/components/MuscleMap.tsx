import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type MapGroup = 'chest' | 'shoulders' | 'biceps' | 'triceps' | 'back' | 'core' | 'legs';
export type TrainState = 'none' | 'week' | 'today';

interface Props {
  status: Record<MapGroup, TrainState>;
  selected: MapGroup | null;
  onSelect: (g: MapGroup) => void;
}

const FILL: Record<TrainState, string> = { none: '#2a2a2a', week: 'rgba(225,6,0,0.45)', today: '#E10600' };
const STROKE: Record<TrainState, string> = { none: '#3a3a3a', week: 'rgba(225,6,0,0.6)', today: '#ff1a1a' };

interface Region { group: MapGroup; paths: string[] }

const FRONT: Region[] = [
  { group: 'shoulders', paths: [
    'M26 58 c-4-1-10 2-11 12 c2 6 8 8 14 5 c2-4 1-10-3-17Z',
    'M114 58 c4-1 10 2 11 12 c-2 6-8 8-14 5 c-2-4-1-10 3-17Z',
  ]},
  { group: 'chest', paths: [
    'M42 64 c8-4 18-5 26 0 c2 8-4 18-26 14 c-2-6 0-12 0-14Z',
    'M98 64 c-8-4-18-5-26 0 c-2 8 4 18 26 14 c2-6 0-12 0-14Z',
  ]},
  { group: 'biceps', paths: [
    'M22 74 c-3 6-4 16-1 28 c4 2 9 0 10-8 c1-10-1-16-9-20Z',
    'M118 74 c3 6 4 16 1 28 c-4 2-9 0-10-8 c-1-10 1-16 9-20Z',
  ]},
  { group: 'core', paths: [
    'M54 82 c10-2 22-2 32 0 c2 14-1 30-4 42 c-12 4-24 4-32 0 c-2-14 0-30 4-42Z',
  ]},
  { group: 'legs', paths: [
    'M50 126 c6-1 14-1 18 2 c2 18-1 38-3 56 c-4 4-10 6-14 2 c-2-12-1-34 0-60Z',
    'M90 126 c-6-1-14-1-18 2 c-2 18 1 38 3 56 c4 4 10 6 14 2 c2-12 1-34 0-60Z',
  ]},
];

const BACK: Region[] = [
  { group: 'shoulders', paths: [
    'M26 58 c-4-1-10 2-11 12 c2 6 8 8 14 5 c2-4 1-10-3-17Z',
    'M114 58 c4-1 10 2 11 12 c-2 6-8 8-14 5 c-2-4-1-10 3-17Z',
  ]},
  { group: 'back', paths: [
    'M42 62 c12-4 34-4 56 0 c3 18-2 38-6 52 c-16 6-34 6-46 0 c-4-16-5-34-4-52Z',
  ]},
  { group: 'triceps', paths: [
    'M22 74 c-3 6-4 16-1 28 c4 2 9 0 10-8 c1-10-1-16-9-20Z',
    'M118 74 c3 6 4 16 1 28 c-4 2-9 0-10-8 c-1-10 1-16 9-20Z',
  ]},
  { group: 'legs', paths: [
    'M50 126 c6-1 14-1 18 2 c2 20-1 42-3 60 c-4 4-10 6-14 2 c-2-14-1-38 0-64Z',
    'M90 126 c-6-1-14-1-18 2 c-2 20 1 42 3 60 c4 4 10 6 14 2 c2-14 1-38 0-64Z',
  ]},
];

const BODY = 'M70 6 c6 0 10 4 10 12 c0 6-3 10-6 13 c8 2 16 8 22 16 c8 10 12 22 14 32 c2-1 5 2 6 8 c2 10-1 22-4 30 c-4 2-8 0-10-4 c-1 8-3 16-5 22 c2 8 2 18 0 28 c-2 24-4 48-6 62 c-1 6-5 8-8 6 c-4-2-6-8-7-16 c-1 8-3 14-6 16 c-2 0-5-2-6-6 c-1 8-3 14-7 16 c-3 2-7 0-8-6 c-2-14-4-38-6-62 c-2-10-2-20 0-28 c-2-6-4-14-5-22 c-2 4-6 6-10 4 c-3-8-6-20-4-30 c1-6 4-9 6-8 c2-10 6-22 14-32 c6-8 14-14 22-16 c-3-3-6-7-6-13 c0-8 4-12 10-12Z';

export default function MuscleMap({ status, selected, onSelect }: Props) {
  const { t } = useTranslation();
  const [view, setView] = useState<'front' | 'back'>('front');
  const regions = view === 'front' ? FRONT : BACK;

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
          <svg viewBox="0 0 140 200" width="126" height="180" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }}>
            <defs>
              <radialGradient id="bodyGrad" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#1a1a1a" />
                <stop offset="100%" stopColor="#0a0a0a" />
              </radialGradient>
              <filter id="innerShadow">
                <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
                <feOffset dx="0" dy="1" result="offsetBlur" />
                <feComposite in="SourceGraphic" in2="offsetBlur" operator="over" />
              </filter>
            </defs>
            <path d={BODY} fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.08)" strokeWidth={0.8} />
            {regions.map((r) => {
              const isSel = selected === r.group;
              const st = status[r.group] || 'none';
              const fill = FILL[st];
              const stroke = isSel ? '#C9A84C' : STROKE[st];
              return (
                <g key={r.group} onClick={() => onSelect(r.group)} style={{ cursor: 'pointer' }}
                  role="button" aria-label={t(`mc_str_mg_${r.group}`)}>
                  {r.paths.map((d, i) => (
                    <path key={i} d={d} fill={fill} stroke={stroke}
                      strokeWidth={isSel ? 1.8 : 0.6}
                      strokeLinejoin="round"
                      style={{ transition: 'fill 0.25s, stroke 0.25s', filter: isSel ? 'url(#innerShadow)' : undefined }} />
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
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-all ${isSel ? 'border-[#C9A84C] text-white bg-[#C9A84C]/10 shadow-[0_0_8px_rgba(201,168,76,0.2)]' : 'border-white/10 text-zinc-300 hover:border-white/25'}`}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: FILL[st], boxShadow: st === 'today' ? '0 0 6px rgba(225,6,0,0.5)' : undefined }} />
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
