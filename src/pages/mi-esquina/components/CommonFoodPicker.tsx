import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

export interface CommonFood {
  id: string;
  name: string;
  category: 'protein' | 'carb' | 'fat' | 'veggie' | 'snack';
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
}

export interface PickedFood {
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface Props {
  onPick: (food: PickedFood) => void;
  onClose: () => void;
}

const CATEGORY_ORDER: CommonFood['category'][] = ['protein', 'carb', 'veggie', 'fat', 'snack'];
const CATEGORY_LABEL: Record<CommonFood['category'], string> = {
  protein: 'mc_food_cat_protein', carb: 'mc_food_cat_carb', fat: 'mc_food_cat_fat',
  veggie: 'mc_food_cat_veggie', snack: 'mc_food_cat_snack',
};
const STEP = 25;

function round1(n: number) { return Math.round(n * 10) / 10; }

export default function CommonFoodPicker({ onPick, onClose }: Props) {
  const { t } = useTranslation();
  const [foods, setFoods] = useState<CommonFood[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CommonFood | null>(null);
  const [grams, setGrams] = useState(100);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('common_foods').select('*').order('name', { ascending: true });
      setFoods((data || []) as CommonFood[]);
      setLoading(false);
    })();
  }, []);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? foods.filter((f) => f.name.toLowerCase().includes(q)) : foods;
    return CATEGORY_ORDER
      .map((cat) => ({ cat, items: filtered.filter((f) => f.category === cat) }))
      .filter((g) => g.items.length > 0);
  }, [foods, query]);

  const preview = selected ? {
    calories: Math.round(selected.calories_per_100g * grams / 100),
    protein: round1(selected.protein_per_100g * grams / 100),
    carbs: round1(selected.carbs_per_100g * grams / 100),
    fat: round1(selected.fat_per_100g * grams / 100),
  } : null;

  const confirm = () => {
    if (!selected || !preview) return;
    onPick({
      description: `${selected.name} (${grams}g)`,
      calories: preview.calories, protein_g: preview.protein, carbs_g: preview.carbs, fat_g: preview.fat,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
      <div className="relative rk-card w-full max-w-md max-h-[85vh] flex flex-col" style={{ padding: 0, transform: 'none' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
          <h3 className="rk-h3" style={{ fontSize: '1.05rem', color: '#fff' }}>
            {selected ? selected.name : t('mc_food_picker_title')}
          </h3>
          <button onClick={onClose} aria-label={t('mc_close')}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer transition-colors">
            <i className="ri-close-line"></i>
          </button>
        </div>

        {!selected ? (
          <>
            <div className="px-5 pt-4 flex-shrink-0">
              <input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
                placeholder={t('mc_food_picker_search')}
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-green-500" />
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : grouped.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-8">{t('mc_food_picker_empty')}</p>
              ) : (
                grouped.map((g) => (
                  <div key={g.cat}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-2">{t(CATEGORY_LABEL[g.cat])}</p>
                    <div className="space-y-1">
                      {g.items.map((f) => (
                        <button key={f.id} onClick={() => { setSelected(f); setGrams(100); }}
                          className="w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 rounded-xl hover:bg-white/[0.05] transition-colors cursor-pointer">
                          <span className="text-sm text-zinc-200">{f.name}</span>
                          <span className="text-xs text-zinc-500 flex-shrink-0">{Math.round(f.calories_per_100g)} kcal/100g</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="px-5 py-5 space-y-5">
            <div>
              <label className="block text-xs text-zinc-400 mb-2">{t('mc_food_picker_grams')}</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setGrams((g) => Math.max(STEP, g - STEP))}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.05] border border-white/10 text-white text-lg cursor-pointer hover:border-white/25">−</button>
                <input type="number" value={grams} min={1} step={STEP}
                  onChange={(e) => setGrams(Math.max(1, parseInt(e.target.value, 10) || 0))}
                  className="flex-1 text-center bg-white/[0.04] border border-white/10 text-white text-lg font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-green-500" />
                <button onClick={() => setGrams((g) => g + STEP)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.05] border border-white/10 text-white text-lg cursor-pointer hover:border-white/25">+</button>
              </div>
            </div>

            {preview && (
              <div className="grid grid-cols-4 gap-2">
                {[
                  { l: 'kcal', v: preview.calories, c: '#fff' },
                  { l: t('mc_food_photo_protein'), v: `${preview.protein}g`, c: '#E10600' },
                  { l: t('mc_food_photo_carbs'), v: `${preview.carbs}g`, c: '#C9A84C' },
                  { l: t('mc_food_photo_fat'), v: `${preview.fat}g`, c: '#38bdf8' },
                ].map((m) => (
                  <div key={m.l} className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-2 text-center">
                    <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, lineHeight: 1, color: m.c }}>{m.v}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{m.l}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setSelected(null)}
                className="py-2.5 px-4 rounded-xl border border-zinc-700 text-zinc-400 text-xs hover:border-zinc-500 transition-colors cursor-pointer">
                {t('mc_food_picker_back')}
              </button>
              <button onClick={confirm} disabled={!grams}
                className="flex-1 rk-btn rk-btn-primary disabled:opacity-50" style={{ fontSize: '0.85rem' }}>
                {t('mc_food_picker_add')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
