import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import Reveal from '@/components/base/Reveal';

interface Props {
  profile: Profile;
  /** El aficionado no necesita ver la gama de competición como recomendada */
  mode?: 'pro' | 'hobby';
}

type Level = 'beginner' | 'intermediate' | 'advanced';
type Price = 'low' | 'mid' | 'high' | 'premium';

interface Brand {
  slug: string;
  /** Nombre propio: NO se traduce a propósito */
  name: string;
  origin: string;
  level: Level;
  disciplines: string[];
  price: Price;
  /** Durabilidad orientativa 1-5 según uso habitual en el sector */
  durability: number;
}

/**
 * Guía orientativa de marcas reales de deportes de contacto.
 * El criterio sale del uso habitual en gimnasios, no de acuerdos comerciales:
 * RANKD no cobra de ninguna de estas marcas (ver aviso al pie del componente).
 */
const BRANDS: Brand[] = [
  { slug: 'everlast', name: 'Everlast', origin: 'USA', level: 'beginner', disciplines: ['boxing', 'mma'], price: 'low', durability: 2 },
  { slug: 'rdx', name: 'RDX', origin: 'UK', level: 'beginner', disciplines: ['boxing', 'mma', 'kickboxing', 'muay_thai'], price: 'low', durability: 3 },
  { slug: 'venum', name: 'Venum', origin: 'FR', level: 'intermediate', disciplines: ['mma', 'muay_thai', 'boxing', 'kickboxing'], price: 'mid', durability: 4 },
  { slug: 'booster', name: 'Booster', origin: 'NL', level: 'intermediate', disciplines: ['muay_thai', 'kickboxing'], price: 'mid', durability: 4 },
  { slug: 'leone', name: 'Leone 1947', origin: 'IT', level: 'intermediate', disciplines: ['boxing', 'kickboxing', 'mma'], price: 'mid', durability: 4 },
  { slug: 'fairtex', name: 'Fairtex', origin: 'TH', level: 'advanced', disciplines: ['muay_thai', 'mma', 'kickboxing'], price: 'high', durability: 5 },
  { slug: 'twins', name: 'Twins Special', origin: 'TH', level: 'advanced', disciplines: ['muay_thai', 'kickboxing'], price: 'high', durability: 5 },
  { slug: 'yokkao', name: 'Yokkao', origin: 'TH', level: 'advanced', disciplines: ['muay_thai', 'kickboxing'], price: 'high', durability: 4 },
  { slug: 'hayabusa', name: 'Hayabusa', origin: 'CA', level: 'advanced', disciplines: ['mma', 'boxing', 'kickboxing'], price: 'high', durability: 5 },
  { slug: 'reyes', name: 'Cleto Reyes', origin: 'MX', level: 'advanced', disciplines: ['boxing'], price: 'premium', durability: 5 },
  { slug: 'winning', name: 'Winning', origin: 'JP', level: 'advanced', disciplines: ['boxing'], price: 'premium', durability: 5 },
  { slug: 'rival', name: 'Rival', origin: 'CA', level: 'advanced', disciplines: ['boxing'], price: 'high', durability: 4 },
];

const LEVEL_CFG: Record<Level, { key: string; color: string }> = {
  beginner: { key: 'mc_gear_level_beginner', color: '#22c55e' },
  intermediate: { key: 'mc_gear_level_intermediate', color: '#38bdf8' },
  advanced: { key: 'mc_gear_level_advanced', color: '#E10600' },
};

const PRICE_CFG: Record<Price, { key: string; symbol: string }> = {
  low: { key: 'mc_gear_price_low', symbol: '€' },
  mid: { key: 'mc_gear_price_mid', symbol: '€€' },
  high: { key: 'mc_gear_price_high', symbol: '€€€' },
  premium: { key: 'mc_gear_price_premium', symbol: '€€€€' },
};

const DISCIPLINES = [
  { value: 'boxing', key: 'disc_boxing' },
  { value: 'mma', key: 'disc_mma' },
  { value: 'muay_thai', key: 'disc_muay_thai' },
  { value: 'kickboxing', key: 'disc_kickboxing' },
];

export default function GearBrands({ profile, mode = 'pro' }: Props) {
  const { t } = useTranslation();
  const [discipline, setDiscipline] = useState<string>('all');
  const [level, setLevel] = useState<string>('all');

  // Arrancamos filtrado por la disciplina del peleador: es lo que de verdad
  // le importa. Si no la tiene puesta, se muestran todas.
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from('fighters').select('discipline').eq('profile_id', profile.id).maybeSingle();
      const d = (data as { discipline?: string } | null)?.discipline;
      if (alive && d && DISCIPLINES.some((x) => x.value === d)) setDiscipline(d);
    })();
    return () => { alive = false; };
  }, [profile.id]);

  const list = useMemo(() => {
    const filtered = BRANDS.filter((b) => {
      if (discipline !== 'all' && !b.disciplines.includes(discipline)) return false;
      if (level !== 'all' && b.level !== level) return false;
      return true;
    });
    // Al aficionado le ordenamos de más accesible a más caro; al que compite,
    // al revés: le interesa antes lo que aguanta un campamento.
    const order: Record<Level, number> = { beginner: 0, intermediate: 1, advanced: 2 };
    return [...filtered].sort((a, b) =>
      mode === 'hobby' ? order[a.level] - order[b.level] : order[b.level] - order[a.level]);
  }, [discipline, level, mode]);

  return (
    <div>
      <Reveal>
        <div className="mb-4">
          <p className="rk-eyebrow">{t('mc_gear_filter_level')}</p>
          <h2 className="rk-h2" style={{ fontSize: 'clamp(1.6rem,3.5vw,2.1rem)', margin: '4px 0 0', color: '#fff' }}>
            {t('mc_gear_brands_title')} <span className="rk-red-glow">{t('mc_gear_brands_title_2')}</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-lg">{t('mc_gear_brands_sub')}</p>
        </div>
      </Reveal>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-1.5 overflow-x-auto">
          <button onClick={() => setDiscipline('all')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${discipline === 'all' ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'}`}>
            {t('mc_gear_all')}
          </button>
          {DISCIPLINES.map((d) => (
            <button key={d.value} onClick={() => setDiscipline(d.value)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${discipline === d.value ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'}`}>
              {t(d.key)}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto sm:ml-auto">
          <button onClick={() => setLevel('all')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${level === 'all' ? 'bg-white/10 border-white/25 text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'}`}>
            {t('mc_gear_all')}
          </button>
          {(Object.keys(LEVEL_CFG) as Level[]).map((lv) => (
            <button key={lv} onClick={() => setLevel(lv)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${level === lv ? 'text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'}`}
              style={level === lv ? { background: `${LEVEL_CFG[lv].color}22`, borderColor: `${LEVEL_CFG[lv].color}66` } : undefined}>
              {t(LEVEL_CFG[lv].key)}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rk-card text-center" style={{ padding: '36px 24px' }}>
          <i className="ri-search-eye-line text-3xl text-zinc-700"></i>
          <p className="text-sm text-zinc-400 mt-3">{t('mc_gear_no_results')}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((b, i) => {
            const lv = LEVEL_CFG[b.level];
            const pr = PRICE_CFG[b.price];
            return (
              <Reveal key={b.slug} delay={Math.min(i, 6) * 40}>
                <div className="rk-card h-full flex flex-col" style={{ padding: 18 }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1, color: '#fff', lineHeight: 1.1 }}>{b.name}</h3>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mt-0.5">{b.origin}</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full flex-shrink-0"
                      style={{ background: `${lv.color}18`, color: lv.color }}>
                      {t(lv.key)}
                    </span>
                  </div>

                  {/* Precio y durabilidad */}
                  <div className="flex items-center gap-4 mt-3 text-[11px]">
                    <span className="text-zinc-500">
                      {t('mc_gear_price')}: <span className="text-[#C9A84C] font-bold">{pr.symbol}</span>
                      <span className="text-zinc-600"> · {t(pr.key)}</span>
                    </span>
                    <span className="text-zinc-500 flex items-center gap-1">
                      {t('mc_gear_durability')}:
                      <span className="flex gap-0.5 ml-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className="w-1.5 h-1.5 rounded-full" style={{ background: n <= b.durability ? '#4ade80' : 'rgba(255,255,255,0.12)' }} />
                        ))}
                      </span>
                    </span>
                  </div>

                  {/* Disciplinas */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {b.disciplines.map((d) => {
                      const cfg = DISCIPLINES.find((x) => x.value === d);
                      return (
                        <span key={d} className="text-[10px] text-zinc-400 bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 rounded-md">
                          {cfg ? t(cfg.key) : d}
                        </span>
                      );
                    })}
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-white/[0.06] space-y-2 flex-1">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-green-400 mb-0.5">{t('mc_gear_best_for')}</p>
                      <p className="text-xs text-zinc-300 leading-relaxed">{t(`mc_br_${b.slug}_for`)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400 mb-0.5">{t('mc_gear_watch')}</p>
                      <p className="text-xs text-zinc-400 leading-relaxed">{t(`mc_br_${b.slug}_watch`)}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      )}

      {/* Aviso: esto no es publicidad */}
      <div className="rk-card flex items-start gap-3 mt-4" style={{ padding: 16, transform: 'none' }}>
        <i className="ri-information-line text-zinc-500 mt-0.5 flex-shrink-0"></i>
        <p className="text-[11px] text-zinc-500 leading-relaxed">{t('mc_gear_disclaimer')}</p>
      </div>
    </div>
  );
}
