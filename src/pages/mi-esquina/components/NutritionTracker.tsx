import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import Reveal from '@/components/base/Reveal';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface WeightEntry {
  id: string;
  weight_kg: number;
  entry_date: string;
  note: string | null;
}

interface Goals {
  target_weight_kg: number | null;
  daily_water_goal_ml: number;
}

const DEFAULT_WATER_GOAL = 2500;
const WATER_STEPS = [
  { ml: 250, label: 'Vaso', icon: 'ri-cup-line' },
  { ml: 500, label: 'Botella', icon: 'ri-goblet-line' },
  { ml: 750, label: 'Grande', icon: 'ri-flask-line' },
];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtLitres(ml: number): string {
  return ml >= 1000 ? `${(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 1)} L` : `${ml} ml`;
}

// Detecta el error típico de "tabla aún no creada" (migración sin aplicar)
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || code === 'PGRST200' || msg.includes('does not exist') || msg.includes('could not find the table');
}

export default function NutritionTracker({ profile, showToast }: Props) {
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [goals, setGoals] = useState<Goals>({ target_weight_kg: null, daily_water_goal_ml: DEFAULT_WATER_GOAL });
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [todayWater, setTodayWater] = useState(0);

  const [weightInput, setWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [waterGoalInput, setWaterGoalInput] = useState('');
  const [savingGoals, setSavingGoals] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const today = todayISO();
    const [goalRes, weightRes, hydroRes] = await Promise.all([
      supabase.from('nutrition_goals').select('target_weight_kg, daily_water_goal_ml').eq('fighter_profile_id', profile.id).maybeSingle(),
      supabase.from('weight_entries').select('id, weight_kg, entry_date, note').eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(60),
      supabase.from('hydration_entries').select('amount_ml').eq('fighter_profile_id', profile.id).eq('entry_date', today).maybeSingle(),
    ]);

    if (isMissingTable(goalRes.error) || isMissingTable(weightRes.error) || isMissingTable(hydroRes.error)) {
      setUnavailable(true);
      setLoading(false);
      return;
    }

    if (goalRes.data) {
      setGoals({
        target_weight_kg: goalRes.data.target_weight_kg,
        daily_water_goal_ml: goalRes.data.daily_water_goal_ml || DEFAULT_WATER_GOAL,
      });
    }
    setWeights(weightRes.data || []);
    setTodayWater(hydroRes.data?.amount_ml || 0);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const setWater = async (nextMl: number) => {
    const clamped = Math.max(0, nextMl);
    const prev = todayWater;
    setTodayWater(clamped); // optimista
    const { error } = await supabase.from('hydration_entries').upsert({
      fighter_profile_id: profile.id,
      entry_date: todayISO(),
      amount_ml: clamped,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'fighter_profile_id,entry_date' });
    if (error) { setTodayWater(prev); showToast('No se pudo guardar la hidratación', 'error'); }
  };

  const addWeight = async () => {
    const val = parseFloat(weightInput.replace(',', '.'));
    if (!val || val < 20 || val > 250) { showToast('Introduce un peso válido (kg)', 'error'); return; }
    setSavingWeight(true);
    const today = todayISO();
    // Un registro por día: si ya existe hoy, lo actualizamos
    const existing = weights.find((w) => w.entry_date === today);
    if (existing) {
      const { error } = await supabase.from('weight_entries').update({ weight_kg: val }).eq('id', existing.id);
      if (error) { showToast('No se pudo guardar', 'error'); setSavingWeight(false); return; }
      setWeights((prev) => prev.map((w) => w.id === existing.id ? { ...w, weight_kg: val } : w));
    } else {
      const { data, error } = await supabase.from('weight_entries')
        .insert({ fighter_profile_id: profile.id, weight_kg: val, entry_date: today })
        .select('id, weight_kg, entry_date, note').maybeSingle();
      if (error || !data) { showToast('No se pudo guardar', 'error'); setSavingWeight(false); return; }
      setWeights((prev) => [data, ...prev]);
    }
    setWeightInput('');
    showToast('Peso registrado ✓');
    setSavingWeight(false);
  };

  const deleteWeight = async (id: string) => {
    const { error } = await supabase.from('weight_entries').delete().eq('id', id);
    if (error) { showToast('No se pudo eliminar', 'error'); return; }
    setWeights((prev) => prev.filter((w) => w.id !== id));
  };

  const openGoals = () => {
    setTargetInput(goals.target_weight_kg?.toString() || '');
    setWaterGoalInput(String(goals.daily_water_goal_ml));
    setShowGoals(true);
  };

  const saveGoals = async () => {
    setSavingGoals(true);
    const target = targetInput ? parseFloat(targetInput.replace(',', '.')) : null;
    const water = parseInt(waterGoalInput, 10) || DEFAULT_WATER_GOAL;
    const { error } = await supabase.from('nutrition_goals').upsert({
      fighter_profile_id: profile.id,
      target_weight_kg: target,
      daily_water_goal_ml: water,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'fighter_profile_id' });
    if (error) { showToast('No se pudieron guardar los objetivos', 'error'); setSavingGoals(false); return; }
    setGoals({ target_weight_kg: target, daily_water_goal_ml: water });
    setShowGoals(false);
    setSavingGoals(false);
    showToast('Objetivos actualizados 🎯');
  };

  const currentWeight = weights[0]?.weight_kg ?? null;
  const prevWeight = weights[1]?.weight_kg ?? null;
  const weightTrend = currentWeight !== null && prevWeight !== null ? +(currentWeight - prevWeight).toFixed(1) : null;
  const toTarget = currentWeight !== null && goals.target_weight_kg !== null ? +(currentWeight - goals.target_weight_kg).toFixed(1) : null;

  const chartData = useMemo(() => {
    return [...weights]
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
      .slice(-20)
      .map((w) => ({
        date: new Date(w.entry_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        kg: w.weight_kg,
      }));
  }, [weights]);

  const waterPct = Math.min(100, Math.round((todayWater / goals.daily_water_goal_ml) * 100));

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-green-500/10 border border-green-500/25 anim-float">
          <i className="ri-drop-line text-3xl text-green-400"></i>
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.3rem', color: '#fff' }}>SEGUIMIENTO EN CAMINO</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
          El seguimiento de peso e hidratación estará disponible en cuanto se active en el servidor. Vuelve en un momento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="rk-eyebrow">TU CUERPO</p>
          <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
            PESO E <span className="rk-red-glow">HIDRATACIÓN</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-md">Controla tu peso camino a la báscula y mantente hidratado. Tu rendimiento empieza aquí.</p>
        </div>
        <button onClick={openGoals} className="rk-btn rk-btn-ghost flex items-center gap-2" style={{ fontSize: '0.8rem', padding: '0.6rem 1.2rem' }}>
          <i className="ri-flag-line"></i> OBJETIVOS
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* HIDRATACIÓN */}
        <Reveal>
          <div className="rk-card h-full" style={{ padding: '22px 20px' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>HIDRATACIÓN DE HOY</h3>
              <i className="ri-drop-fill text-sky-400 text-lg"></i>
            </div>
            <div className="flex items-end gap-2 mb-1">
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 46, lineHeight: 0.9, color: '#38bdf8' }}>{fmtLitres(todayWater)}</span>
              <span className="text-sm text-zinc-500 mb-1.5">/ {fmtLitres(goals.daily_water_goal_ml)}</span>
            </div>
            <div className="h-3 rounded-full bg-white/[0.05] overflow-hidden mb-1">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${waterPct}%`, background: waterPct >= 100 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : 'linear-gradient(90deg,#0ea5e9,#38bdf8)' }} />
            </div>
            <p className="text-xs text-zinc-500 mb-4">{waterPct >= 100 ? '¡Objetivo del día cumplido! 💧' : `${waterPct}% de tu objetivo diario`}</p>
            <div className="grid grid-cols-3 gap-2">
              {WATER_STEPS.map((s) => (
                <button key={s.ml} onClick={() => setWater(todayWater + s.ml)}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-sky-500/25 bg-sky-500/[0.07] text-sky-300 hover:bg-sky-500/15 transition-colors cursor-pointer">
                  <i className={`${s.icon} text-base`}></i>
                  <span className="text-[11px] font-semibold">+{s.ml}ml</span>
                </button>
              ))}
            </div>
            {todayWater > 0 && (
              <div className="flex items-center justify-between mt-3">
                <button onClick={() => setWater(todayWater - 250)} className="text-xs text-zinc-500 hover:text-white transition-colors cursor-pointer flex items-center gap-1">
                  <i className="ri-subtract-line"></i> Quitar vaso
                </button>
                <button onClick={() => setWater(0)} className="text-xs text-zinc-600 hover:text-red-400 transition-colors cursor-pointer">Reiniciar</button>
              </div>
            )}
          </div>
        </Reveal>

        {/* PESO */}
        <Reveal delay={80}>
          <div className="rk-card h-full" style={{ padding: '22px 20px' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>TU PESO</h3>
              <i className="ri-scales-2-line text-[#C9A84C] text-lg"></i>
            </div>
            {currentWeight === null ? (
              <p className="text-sm text-zinc-500 mb-4">Registra tu primer peso para empezar a ver tu evolución.</p>
            ) : (
              <div className="flex items-end gap-3 mb-3">
                <div>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 46, lineHeight: 0.9, color: '#fff' }}>{currentWeight}</span>
                  <span className="text-sm text-zinc-500 ml-1">kg</span>
                </div>
                {weightTrend !== null && weightTrend !== 0 && (
                  <span className={`text-xs font-bold mb-2 flex items-center gap-0.5 ${weightTrend < 0 ? 'text-green-400' : 'text-orange-400'}`}>
                    <i className={weightTrend < 0 ? 'ri-arrow-down-line' : 'ri-arrow-up-line'}></i>{Math.abs(weightTrend)} kg
                  </span>
                )}
              </div>
            )}

            {goals.target_weight_kg !== null && (
              <div className="flex items-center gap-2 mb-4 text-xs">
                <span className="text-zinc-500">Objetivo:</span>
                <span className="font-bold text-[#C9A84C]">{goals.target_weight_kg} kg</span>
                {toTarget !== null && (
                  <span className={`px-2 py-0.5 rounded-full border ${Math.abs(toTarget) < 0.1 ? 'text-green-400 bg-green-500/10 border-green-500/25' : 'text-orange-400 bg-orange-500/10 border-orange-500/25'}`}>
                    {Math.abs(toTarget) < 0.1 ? 'En tu peso' : toTarget > 0 ? `${toTarget} kg por encima` : `${Math.abs(toTarget)} kg por debajo`}
                  </span>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input value={weightInput} onChange={(e) => setWeightInput(e.target.value)} inputMode="decimal"
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl pl-4 pr-10 py-2.5 focus:outline-none focus:border-[#C9A84C]"
                  placeholder="Peso de hoy" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">kg</span>
              </div>
              <button onClick={addWeight} disabled={savingWeight || !weightInput}
                className="rk-btn rk-btn-gold flex items-center gap-1.5 disabled:opacity-50" style={{ fontSize: '0.8rem', padding: '0 1.1rem' }}>
                {savingWeight ? <div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div> : <><i className="ri-add-line"></i></>}
              </button>
            </div>
          </div>
        </Reveal>
      </div>

      {/* GRÁFICO DE EVOLUCIÓN */}
      {chartData.length >= 2 && (
        <Reveal delay={120}>
          <div className="rk-card" style={{ padding: '22px 20px' }}>
            <h3 className="rk-h3 mb-1" style={{ fontSize: '1rem', color: '#fff' }}>EVOLUCIÓN DEL PESO</h3>
            <p className="text-xs text-zinc-500 mb-3">Últimos {chartData.length} registros</p>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} minTickGap={20} />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} width={38} />
                  <Tooltip
                    contentStyle={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, fontSize: 12 }}
                    labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                    formatter={(v: number) => [`${v} kg`, 'Peso']}
                  />
                  {goals.target_weight_kg !== null && (
                    <ReferenceLine y={goals.target_weight_kg} stroke="#E10600" strokeDasharray="5 4" strokeOpacity={0.7}
                      label={{ value: `Objetivo ${goals.target_weight_kg}kg`, fill: '#E10600', fontSize: 10, position: 'insideTopRight' }} />
                  )}
                  <Area type="monotone" dataKey="kg" stroke="#C9A84C" strokeWidth={2.5} fill="url(#wgrad)" dot={{ r: 3, fill: '#C9A84C' }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Reveal>
      )}

      {/* HISTORIAL DE PESO */}
      {weights.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Registros de peso</h3>
          <div className="space-y-2">
            {weights.slice(0, 8).map((w) => (
              <div key={w.id} className="rk-card flex items-center gap-4 group" style={{ padding: '12px 16px' }}>
                <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/25 text-[#C9A84C] flex-shrink-0">
                  <i className="ri-scales-2-line"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{w.weight_kg} kg</p>
                  <p className="text-xs text-zinc-500 capitalize">{new Date(w.entry_date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
                <button onClick={() => deleteWeight(w.id)} className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <i className="ri-delete-bin-line"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL OBJETIVOS */}
      {showGoals && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowGoals(false); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
          <div className="relative rk-card w-full max-w-sm" style={{ padding: 24 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="rk-h3" style={{ fontSize: '1.15rem', color: '#fff' }}>TUS OBJETIVOS</h3>
              <button onClick={() => setShowGoals(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer transition-colors">
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Peso objetivo (kg)</label>
                <input value={targetInput} onChange={(e) => setTargetInput(e.target.value)} inputMode="decimal"
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C]"
                  placeholder="Ej: 70.0 (tu categoría de peso)" />
                <p className="text-[11px] text-zinc-500 mt-1.5">Tu peso de competición o el que quieres alcanzar.</p>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Objetivo diario de agua (ml)</label>
                <input value={waterGoalInput} onChange={(e) => setWaterGoalInput(e.target.value)} inputMode="numeric"
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-sky-500"
                  placeholder="2500" />
                <p className="text-[11px] text-zinc-500 mt-1.5">Recomendado: 35 ml por kg de peso corporal.</p>
              </div>
              <button onClick={saveGoals} disabled={savingGoals} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.95rem' }}>
                {savingGoals ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> GUARDANDO...</> : <><i className="ri-check-line"></i> GUARDAR OBJETIVOS</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
