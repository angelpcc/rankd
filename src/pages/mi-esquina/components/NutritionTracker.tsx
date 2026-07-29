import { useState, useEffect, useCallback } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import Reveal from '@/components/base/Reveal';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onGoWeight?: () => void;
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

export default function NutritionTracker({ profile, showToast, onGoWeight }: Props) {
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [waterGoal, setWaterGoal] = useState(DEFAULT_WATER_GOAL);
  const [targetWeight, setTargetWeight] = useState<number | null>(null);
  const [todayWater, setTodayWater] = useState(0);

  const [showGoal, setShowGoal] = useState(false);
  const [waterGoalInput, setWaterGoalInput] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const today = todayISO();
    const [goalRes, hydroRes] = await Promise.all([
      supabase.from('nutrition_goals').select('target_weight_kg, daily_water_goal_ml').eq('fighter_profile_id', profile.id).maybeSingle(),
      supabase.from('hydration_entries').select('amount_ml').eq('fighter_profile_id', profile.id).eq('entry_date', today).maybeSingle(),
    ]);

    if (isMissingTable(goalRes.error) || isMissingTable(hydroRes.error)) {
      setUnavailable(true);
      setLoading(false);
      return;
    }

    if (goalRes.data) {
      setWaterGoal(goalRes.data.daily_water_goal_ml || DEFAULT_WATER_GOAL);
      setTargetWeight(goalRes.data.target_weight_kg ?? null);
    }
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

  const saveGoal = async () => {
    setSavingGoal(true);
    const water = parseInt(waterGoalInput, 10) || DEFAULT_WATER_GOAL;
    // Conservamos el peso objetivo (lo comparte la sección Peso) al reescribir la fila.
    const { error } = await supabase.from('nutrition_goals').upsert({
      fighter_profile_id: profile.id,
      target_weight_kg: targetWeight,
      daily_water_goal_ml: water,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'fighter_profile_id' });
    if (error) { showToast('No se pudo guardar el objetivo', 'error'); setSavingGoal(false); return; }
    setWaterGoal(water);
    setShowGoal(false);
    setSavingGoal(false);
    showToast('Objetivo de hidratación actualizado 💧');
  };

  const waterPct = Math.min(100, Math.round((todayWater / waterGoal) * 100));

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-green-500/10 border border-green-500/25 anim-float">
          <i className="ri-drop-line text-3xl text-green-400"></i>
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.3rem', color: '#fff' }}>HIDRATACIÓN EN CAMINO</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
          El seguimiento de hidratación estará disponible en cuanto se active en el servidor. Vuelve en un momento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="rk-eyebrow">TU DÍA A DÍA</p>
          <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
            <span className="rk-red-glow">HIDRATACIÓN</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-md">Mantente hidratado: llegar seco al entreno hunde tu rendimiento de forma directa.</p>
        </div>
        <button onClick={() => { setWaterGoalInput(String(waterGoal)); setShowGoal(true); }} className="rk-btn rk-btn-ghost flex items-center gap-2" style={{ fontSize: '0.8rem', padding: '0.6rem 1.2rem' }}>
          <i className="ri-flag-line"></i> OBJETIVO
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
              <span className="text-sm text-zinc-500 mb-1.5">/ {fmtLitres(waterGoal)}</span>
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

        {/* ACCESO A PESO — ahora vive en su propia sección */}
        <Reveal delay={80}>
          <button onClick={onGoWeight} disabled={!onGoWeight}
            className="rk-card h-full w-full text-left group flex flex-col justify-between disabled:cursor-default" style={{ padding: '22px 20px', cursor: onGoWeight ? 'pointer' : 'default' }}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>CONTROL DE PESO</h3>
                <i className="ri-scales-2-line text-[#C9A84C] text-lg"></i>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                El control de peso, su gráfica de evolución y tu peso objetivo tienen ahora su propia sección.
                {targetWeight !== null && <> Tu objetivo actual: <span className="text-[#C9A84C] font-bold">{targetWeight} kg</span>.</>}
              </p>
            </div>
            {onGoWeight && (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#C9A84C] mt-4 group-hover:gap-2.5 transition-all">
                Ir a Control de peso <i className="ri-arrow-right-line"></i>
              </span>
            )}
          </button>
        </Reveal>
      </div>

      {/* Modal objetivo de agua */}
      {showGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowGoal(false); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
          <div className="relative rk-card w-full max-w-sm max-h-[90vh] overflow-y-auto" style={{ padding: 24 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="rk-h3" style={{ fontSize: '1.15rem', color: '#fff' }}>OBJETIVO DE HIDRATACIÓN</h3>
              <button onClick={() => setShowGoal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer transition-colors">
                <i className="ri-close-line"></i>
              </button>
            </div>
            <label className="block text-xs text-zinc-400 mb-1.5">Objetivo diario de agua (ml)</label>
            <input value={waterGoalInput} onChange={(e) => setWaterGoalInput(e.target.value)} inputMode="numeric" autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') saveGoal(); }}
              className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-sky-500"
              placeholder="2500" />
            <p className="text-[11px] text-zinc-500 mt-1.5">Recomendado: 35 ml por kg de peso corporal.</p>
            <button onClick={saveGoal} disabled={savingGoal} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60 mt-4" style={{ fontSize: '0.95rem' }}>
              {savingGoal ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> GUARDANDO...</> : <><i className="ri-check-line"></i> GUARDAR</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
