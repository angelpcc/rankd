import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
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

const RANGES = [
  { days: 30, label: '1M' },
  { days: 90, label: '3M' },
  { days: 180, label: '6M' },
  { days: 3650, label: 'Todo' },
];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function WeightTracker({ profile, showToast }: Props) {
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [targetWeight, setTargetWeight] = useState<number | null>(null);
  const [waterGoal, setWaterGoal] = useState<number>(2500);

  const [weightInput, setWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [showTarget, setShowTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [savingTarget, setSavingTarget] = useState(false);
  const [range, setRange] = useState(90);

  const load = useCallback(async () => {
    setLoading(true);
    const [weightRes, goalRes] = await Promise.all([
      supabase.from('weight_entries').select('id, weight_kg, entry_date, note').eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(400),
      supabase.from('nutrition_goals').select('target_weight_kg, daily_water_goal_ml').eq('fighter_profile_id', profile.id).maybeSingle(),
    ]);
    if (isMissingTable(weightRes.error)) { setUnavailable(true); setLoading(false); return; }
    setWeights(weightRes.data || []);
    setTargetWeight(goalRes.data?.target_weight_kg ?? null);
    setWaterGoal(goalRes.data?.daily_water_goal_ml || 2500);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const addWeight = async () => {
    const val = parseFloat(weightInput.replace(',', '.'));
    if (!val || val < 20 || val > 250) { showToast('Introduce un peso válido (kg)', 'error'); return; }
    setSavingWeight(true);
    const today = todayISO();
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

  const saveTarget = async () => {
    setSavingTarget(true);
    const target = targetInput ? parseFloat(targetInput.replace(',', '.')) : null;
    // Reescribimos la fila completa (incluye el objetivo de agua) para no borrarlo:
    // nutrition_goals la comparten Peso y Nutrición.
    const { error } = await supabase.from('nutrition_goals').upsert({
      fighter_profile_id: profile.id,
      target_weight_kg: target,
      daily_water_goal_ml: waterGoal,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'fighter_profile_id' });
    if (error) { showToast('No se pudo guardar el objetivo', 'error'); setSavingTarget(false); return; }
    setTargetWeight(target);
    setShowTarget(false);
    setSavingTarget(false);
    showToast('Peso objetivo actualizado 🎯');
  };

  const currentWeight = weights[0]?.weight_kg ?? null;
  const prevWeight = weights[1]?.weight_kg ?? null;
  const weightTrend = currentWeight !== null && prevWeight !== null ? +(currentWeight - prevWeight).toFixed(1) : null;
  const toTarget = currentWeight !== null && targetWeight !== null ? +(currentWeight - targetWeight).toFixed(1) : null;

  // Cambio en el rango seleccionado (primer vs último registro dentro del rango)
  const rangeStats = useMemo(() => {
    const since = new Date(); since.setDate(since.getDate() - range);
    const inRange = weights.filter((w) => new Date(w.entry_date + 'T12:00:00') >= since);
    if (inRange.length < 2) return null;
    const sorted = [...inRange].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    const delta = +(sorted[sorted.length - 1].weight_kg - sorted[0].weight_kg).toFixed(1);
    const values = sorted.map((w) => w.weight_kg);
    return { delta, min: Math.min(...values), max: Math.max(...values), count: sorted.length };
  }, [weights, range]);

  const chartData = useMemo(() => {
    const since = new Date(); since.setDate(since.getDate() - range);
    return [...weights]
      .filter((w) => new Date(w.entry_date + 'T12:00:00') >= since)
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
      .map((w) => ({
        date: new Date(w.entry_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        kg: w.weight_kg,
      }));
  }, [weights, range]);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-[#C9A84C]/10 border border-[#C9A84C]/25 anim-float">
          <i className="ri-scales-2-line text-3xl text-[#C9A84C]"></i>
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.3rem', color: '#fff' }}>CONTROL DE PESO EN CAMINO</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
          El control de peso estará disponible en cuanto se active en el servidor. Vuelve en un momento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="rk-eyebrow">CAMINO A LA BÁSCULA</p>
          <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
            CONTROL DE <span className="rk-red-glow">PESO</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-md">Registra tu peso y sigue su evolución en el tiempo. El dato que manda el día del pesaje.</p>
        </div>
        <button onClick={() => { setTargetInput(targetWeight?.toString() || ''); setShowTarget(true); }} className="rk-btn rk-btn-ghost flex items-center gap-2" style={{ fontSize: '0.8rem', padding: '0.6rem 1.2rem' }}>
          <i className="ri-flag-line"></i> PESO OBJETIVO
        </button>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rk-card" style={{ padding: '18px 16px' }}>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Peso actual</p>
          <div className="flex items-end gap-2 mt-1">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, lineHeight: 0.9, color: '#fff' }}>{currentWeight ?? '—'}</span>
            {currentWeight !== null && <span className="text-xs text-zinc-500 mb-1.5">kg</span>}
          </div>
          {weightTrend !== null && weightTrend !== 0 && (
            <p className={`text-xs font-bold mt-1 flex items-center gap-0.5 ${weightTrend < 0 ? 'text-green-400' : 'text-orange-400'}`}>
              <i className={weightTrend < 0 ? 'ri-arrow-down-line' : 'ri-arrow-up-line'}></i>{Math.abs(weightTrend)} kg vs. anterior
            </p>
          )}
        </div>

        <div className="rk-card" style={{ padding: '18px 16px' }}>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Peso objetivo</p>
          <div className="flex items-end gap-2 mt-1">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, lineHeight: 0.9, color: targetWeight ? '#C9A84C' : 'rgba(255,255,255,0.3)' }}>{targetWeight ?? '—'}</span>
            {targetWeight !== null && <span className="text-xs text-zinc-500 mb-1.5">kg</span>}
          </div>
          {toTarget !== null && (
            <p className={`text-xs font-bold mt-1 ${Math.abs(toTarget) < 0.1 ? 'text-green-400' : 'text-orange-400'}`}>
              {Math.abs(toTarget) < 0.1 ? 'En tu peso' : toTarget > 0 ? `+${toTarget} kg por bajar` : `${Math.abs(toTarget)} kg por subir`}
            </p>
          )}
        </div>

        <div className="rk-card" style={{ padding: '18px 16px' }}>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Cambio ({RANGES.find((r) => r.days === range)?.label})</p>
          <div className="flex items-end gap-2 mt-1">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, lineHeight: 0.9, color: rangeStats ? (rangeStats.delta <= 0 ? '#4ade80' : '#fb923c') : 'rgba(255,255,255,0.3)' }}>
              {rangeStats ? `${rangeStats.delta > 0 ? '+' : ''}${rangeStats.delta}` : '—'}
            </span>
            {rangeStats && <span className="text-xs text-zinc-500 mb-1.5">kg</span>}
          </div>
          <p className="text-xs text-zinc-500 mt-1">{rangeStats ? `entre ${rangeStats.min} y ${rangeStats.max} kg` : 'Faltan registros'}</p>
        </div>

        <div className="rk-card" style={{ padding: '18px 16px' }}>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Registros</p>
          <div className="flex items-end gap-2 mt-1">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, lineHeight: 0.9, color: '#fff' }}>{weights.length}</span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">pesajes guardados</p>
        </div>
      </div>

      {/* Registrar peso */}
      <div className="rk-card" style={{ padding: '18px 20px' }}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-zinc-400 mb-1.5 font-semibold uppercase tracking-wide">Peso de hoy</label>
            <div className="relative">
              <input value={weightInput} onChange={(e) => setWeightInput(e.target.value)} inputMode="decimal"
                onKeyDown={(e) => { if (e.key === 'Enter') addWeight(); }}
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:border-[#C9A84C]"
                placeholder="Ej: 72.4" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">kg</span>
            </div>
          </div>
          <button onClick={addWeight} disabled={savingWeight || !weightInput}
            className="rk-btn rk-btn-gold flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ fontSize: '0.85rem', padding: '0.85rem 1.6rem' }}>
            {savingWeight ? <div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div> : <><i className="ri-add-line"></i> REGISTRAR</>}
          </button>
        </div>
        {weights.some((w) => w.entry_date === todayISO()) && (
          <p className="text-[11px] text-green-400 mt-2 flex items-center gap-1.5"><i className="ri-check-line"></i>Ya has registrado tu peso hoy. Si lo guardas de nuevo, se actualiza.</p>
        )}
      </div>

      {/* Gráfico de evolución */}
      {chartData.length >= 2 ? (
        <Reveal>
          <div className="rk-card" style={{ padding: '22px 20px' }}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>EVOLUCIÓN DEL PESO</h3>
              <div className="flex gap-1">
                {RANGES.map((r) => (
                  <button key={r.days} onClick={() => setRange(r.days)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${range === r.days ? 'bg-[#C9A84C] text-zinc-900' : 'bg-white/[0.04] text-zinc-400 hover:text-white'}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="wtgrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} minTickGap={24} />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} width={38} />
                  <Tooltip
                    contentStyle={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, fontSize: 12 }}
                    labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                    formatter={(v: number) => [`${v} kg`, 'Peso']}
                  />
                  {targetWeight !== null && (
                    <ReferenceLine y={targetWeight} stroke="#E10600" strokeDasharray="5 4" strokeOpacity={0.7}
                      label={{ value: `Objetivo ${targetWeight}kg`, fill: '#E10600', fontSize: 10, position: 'insideTopRight' }} />
                  )}
                  <Area type="monotone" dataKey="kg" stroke="#C9A84C" strokeWidth={2.5} fill="url(#wtgrad)" dot={{ r: 3, fill: '#C9A84C' }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Reveal>
      ) : (
        <div className="rk-card text-center" style={{ padding: '40px 24px' }}>
          <i className="ri-line-chart-line text-4xl text-zinc-700"></i>
          <p className="text-sm text-zinc-400 mt-3 font-medium">Aún no hay suficientes datos para la gráfica</p>
          <p className="text-xs text-zinc-600 mt-1">Registra tu peso unos días y verás aquí tu evolución.</p>
        </div>
      )}

      {/* Historial */}
      {weights.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Historial de pesajes</h3>
          <div className="space-y-2">
            {weights.slice(0, 12).map((w, i) => {
              const next = weights[i + 1];
              const diff = next ? +(w.weight_kg - next.weight_kg).toFixed(1) : null;
              return (
                <div key={w.id} className="rk-card flex items-center gap-4 group" style={{ padding: '12px 16px' }}>
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/25 text-[#C9A84C] flex-shrink-0">
                    <i className="ri-scales-2-line"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">{w.weight_kg} kg</p>
                      {diff !== null && diff !== 0 && (
                        <span className={`text-[11px] font-bold ${diff < 0 ? 'text-green-400' : 'text-orange-400'}`}>{diff > 0 ? '+' : ''}{diff}</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 capitalize">{new Date(w.entry_date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                  </div>
                  <button onClick={() => deleteWeight(w.id)} className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal peso objetivo */}
      {showTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowTarget(false); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
          <div className="relative rk-card w-full max-w-sm" style={{ padding: 24 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="rk-h3" style={{ fontSize: '1.15rem', color: '#fff' }}>PESO OBJETIVO</h3>
              <button onClick={() => setShowTarget(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer transition-colors">
                <i className="ri-close-line"></i>
              </button>
            </div>
            <label className="block text-xs text-zinc-400 mb-1.5">Tu peso objetivo (kg)</label>
            <input value={targetInput} onChange={(e) => setTargetInput(e.target.value)} inputMode="decimal" autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') saveTarget(); }}
              className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C]"
              placeholder="Ej: 70.0 (tu categoría de peso)" />
            <p className="text-[11px] text-zinc-500 mt-1.5">Tu peso de competición o el que quieres alcanzar. Aparece como línea en la gráfica. Para una meta con fecha límite, usa la sección Objetivos.</p>
            <button onClick={saveTarget} disabled={savingTarget} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60 mt-4" style={{ fontSize: '0.95rem' }}>
              {savingTarget ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> GUARDANDO...</> : <><i className="ri-check-line"></i> GUARDAR</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
