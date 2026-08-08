import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import VoiceButton from '@/components/feature/VoiceButton';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface Meal {
  id: string;
  entry_date: string;
  meal_type: string;
  description: string;
  created_at?: string;
}

const MEAL_TYPES = [
  { value: 'desayuno', labelKey: 'mc_meal_breakfast', icon: 'ri-sun-line', color: '#eab308' },
  { value: 'comida', labelKey: 'mc_meal_lunch', icon: 'ri-restaurant-2-line', color: '#4ade80' },
  { value: 'cena', labelKey: 'mc_meal_dinner', icon: 'ri-moon-line', color: '#818cf8' },
  { value: 'snack', labelKey: 'mc_meal_snack', icon: 'ri-cake-3-line', color: '#f472b6' },
];
const typeCfg = (v: string) => MEAL_TYPES.find((t) => t.value === v) || MEAL_TYPES[1];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || code === 'PGRST200' || msg.includes('does not exist') || msg.includes('could not find the table');
}

export default function MealLog({ profile, showToast }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [type, setType] = useState('comida');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('meal_entries')
      .select('id, entry_date, meal_type, description, created_at')
      .eq('fighter_profile_id', profile.id)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(60);
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    setMeals((data as Meal[]) || []);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!desc.trim() || saving) return;
    setSaving(true);
    const { data, error } = await supabase.from('meal_entries')
      .insert({ fighter_profile_id: profile.id, entry_date: todayISO(), meal_type: type, description: desc.trim() })
      .select('id, entry_date, meal_type, description, created_at').maybeSingle();
    if (error || !data) { showToast(t('error_save'), 'error'); setSaving(false); return; }
    setMeals((prev) => [data as Meal, ...prev]);
    setDesc('');
    showToast(t('mc_meal_saved'));
    setSaving(false);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('meal_entries').delete().eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); return; }
    setMeals((prev) => prev.filter((m) => m.id !== id));
  };

  const grouped = useMemo(() => {
    const map = new Map<string, Meal[]>();
    meals.forEach((m) => { const arr = map.get(m.entry_date) || []; arr.push(m); map.set(m.entry_date, arr); });
    return Array.from(map.entries());
  }, [meals]);

  const label = (iso: string) => {
    if (iso === todayISO()) return t('mc_today');
    return new Date(iso + 'T12:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }
  if (unavailable) {
    return (
      <div className="rk-card text-center" style={{ padding: '32px 24px' }}>
        <i className="ri-restaurant-2-line text-2xl text-green-400"></i>
        <p className="text-sm text-zinc-300 font-medium mt-2">{t('mc_meal_unavailable_title')}</p>
        <p className="text-xs text-zinc-500 mt-1">{t('mc_meal_unavailable_desc')}</p>
      </div>
    );
  }

  return (
    <div className="rk-card" style={{ padding: '20px 20px' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>{t('mc_meal_title')}</h3>
        <i className="ri-book-2-line text-green-400"></i>
      </div>

      {/* Añadir */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {MEAL_TYPES.map((mt) => (
          <button key={mt.value} onClick={() => setType(mt.value)}
            className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${type === mt.value ? 'bg-green-500/15 border-green-500/35 text-green-300' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:border-white/25'}`}>
            <i className={mt.icon}></i>{t(mt.labelKey)}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          className="flex-1 bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-green-500"
          placeholder={t('mc_meal_ph')} />
        <VoiceButton onResult={(txt) => setDesc((prev) => (prev.trim() ? prev + ' ' + txt : txt))} compact />
        <button onClick={add} disabled={saving || !desc.trim()} className="rk-btn rk-btn-primary flex items-center disabled:opacity-50" style={{ padding: '0 1.1rem', fontSize: '0.95rem' }}>
          {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <i className="ri-add-line"></i>}
        </button>
      </div>

      {/* Histórico agrupado por día, en timeline vertical */}
      {grouped.length === 0 ? (
        <p className="text-xs text-zinc-500 mt-4 text-center py-4">{t('mc_meal_empty')}</p>
      ) : (
        <div className="mt-4 space-y-5">
          {grouped.slice(0, 6).map(([date, dayMeals]) => (
            <div key={date}>
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2 capitalize">{label(date)}</p>
              <div className="relative pl-4 space-y-2.5">
                <div className="absolute left-[3px] top-1.5 bottom-1.5 w-px bg-white/[0.08]" />
                {dayMeals.map((m) => {
                  const cfg = typeCfg(m.meal_type);
                  const time = m.created_at ? new Date(m.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : null;
                  return (
                    <div key={m.id} className="relative group">
                      <span className="absolute -left-4 top-2 w-2 h-2 rounded-full ring-4 ring-[#0B0B0B]" style={{ background: cfg.color }} />
                      <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
                        <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg" style={{ background: `${cfg.color}1f`, color: cfg.color }}>
                          <i className={`${cfg.icon} text-sm`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wide capitalize" style={{ color: cfg.color }}>{t(cfg.labelKey)}</span>
                            {time && <span className="text-[10px] text-zinc-600">· {time}</span>}
                          </div>
                          <p className="text-sm text-zinc-200 truncate">{m.description}</p>
                        </div>
                        <button onClick={() => remove(m.id)} className="w-6 h-6 flex-shrink-0 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <i className="ri-close-line text-sm"></i>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
