import { useState, useEffect, useCallback } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface Goal {
  id: string;
  title: string;
  category: string;
  target_value: number | null;
  start_value: number | null;
  unit: string | null;
  deadline: string | null;
  status: 'active' | 'achieved' | 'archived';
  created_at: string;
  achieved_at: string | null;
}

const CATEGORIES = [
  { value: 'weight', label: 'Peso', icon: 'ri-scales-2-line', color: '#C9A84C', hint: 'Ej: llegar a 70 kg', unit: 'kg', numeric: true },
  { value: 'performance', label: 'Rendimiento', icon: 'ri-flashlight-line', color: '#fb923c', hint: 'Ej: correr 10 km en 45 min', unit: '', numeric: true },
  { value: 'competition', label: 'Competición', icon: 'ri-trophy-line', color: '#E10600', hint: 'Ej: debutar en amateur', unit: '', numeric: false },
  { value: 'habit', label: 'Hábito', icon: 'ri-repeat-line', color: '#22c55e', hint: 'Ej: entrenar 4 días/semana', unit: '', numeric: false },
  { value: 'other', label: 'Otro', icon: 'ri-focus-3-line', color: '#38bdf8', hint: 'Tu meta personal', unit: '', numeric: false },
];

const catCfg = (v: string) => CATEGORIES.find((c) => c.value === v) || CATEGORIES[4];

function daysUntil(deadline: string): number {
  const d = new Date(deadline + 'T12:00:00');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

function deadlineLabel(deadline: string): { text: string; urgent: boolean; overdue: boolean } {
  const days = daysUntil(deadline);
  const nice = new Date(deadline + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  if (days < 0) return { text: `Venció el ${nice}`, urgent: false, overdue: true };
  if (days === 0) return { text: 'La fecha límite es hoy', urgent: true, overdue: false };
  if (days === 1) return { text: 'Queda 1 día', urgent: true, overdue: false };
  if (days <= 14) return { text: `Quedan ${days} días · ${nice}`, urgent: true, overdue: false };
  if (days <= 60) return { text: `Quedan ${days} días · ${nice}`, urgent: false, overdue: false };
  const weeks = Math.round(days / 7);
  return { text: `${weeks} semanas · ${nice}`, urgent: false, overdue: false };
}

export default function GoalsPanel({ profile, showToast }: Props) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [category, setCategory] = useState('weight');
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [start, setStart] = useState('');
  const [deadline, setDeadline] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [goalRes, weightRes] = await Promise.all([
      supabase.from('fighter_goals').select('*').eq('fighter_profile_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('weight_entries').select('weight_kg').eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (isMissingTable(goalRes.error)) { setUnavailable(true); setLoading(false); return; }
    setGoals((goalRes.data || []) as Goal[]);
    setCurrentWeight((weightRes.data as { weight_kg?: number } | null)?.weight_kg ?? null);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setCategory('weight'); setTitle(''); setTarget(''); setStart(''); setDeadline(''); };

  const openForm = () => {
    resetForm();
    // Prerelleno útil: el punto de partida de una meta de peso es tu peso actual.
    if (currentWeight !== null) setStart(String(currentWeight));
    setShowForm(true);
  };

  const create = async () => {
    if (!title.trim()) { showToast('Ponle un título a tu objetivo', 'error'); return; }
    const cfg = catCfg(category);
    setSaving(true);
    const targetNum = cfg.numeric && target ? parseFloat(target.replace(',', '.')) : null;
    const startNum = cfg.numeric && start ? parseFloat(start.replace(',', '.')) : null;
    const { data, error } = await supabase.from('fighter_goals').insert({
      fighter_profile_id: profile.id,
      title: title.trim(),
      category,
      target_value: targetNum,
      start_value: startNum,
      unit: cfg.unit || null,
      deadline: deadline || null,
      status: 'active',
    }).select().maybeSingle();
    setSaving(false);
    if (error || !data) { showToast('No se pudo crear el objetivo', 'error'); return; }
    setGoals((prev) => [data as Goal, ...prev]);
    setShowForm(false);
    resetForm();
    showToast('Objetivo creado 🎯');
  };

  const setStatus = async (id: string, status: Goal['status']) => {
    const patch: Partial<Goal> = { status };
    if (status === 'achieved') patch.achieved_at = new Date().toISOString();
    const { error } = await supabase.from('fighter_goals').update(patch).eq('id', id);
    if (error) { showToast('No se pudo actualizar', 'error'); return; }
    setGoals((prev) => prev.map((g) => g.id === id ? { ...g, ...patch } as Goal : g));
    showToast(status === 'achieved' ? '¡Objetivo conseguido! 🏆' : status === 'archived' ? 'Objetivo archivado' : 'Objetivo reactivado');
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('fighter_goals').delete().eq('id', id);
    if (error) { showToast('No se pudo eliminar', 'error'); return; }
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  // Progreso para metas numéricas (sobre todo peso): start → current → target.
  const progressOf = (g: Goal): { pct: number; current: number | null; label: string } | null => {
    if (g.target_value === null) return null;
    const current = g.category === 'weight' ? currentWeight : null;
    if (current === null || g.start_value === null) return null;
    const totalDist = g.target_value - g.start_value;
    if (Math.abs(totalDist) < 0.01) return { pct: 100, current, label: 'En tu objetivo' };
    const doneDist = current - g.start_value;
    const pct = Math.max(0, Math.min(100, Math.round((doneDist / totalDist) * 100)));
    const remaining = +(g.target_value - current).toFixed(1);
    const label = Math.abs(remaining) < 0.1 ? 'En tu objetivo' : `${current}${g.unit || ''} · faltan ${Math.abs(remaining)}${g.unit || ''}`;
    return { pct, current, label };
  };

  const active = goals.filter((g) => g.status === 'active');
  const done = goals.filter((g) => g.status !== 'active');

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
          <i className="ri-flag-line text-3xl text-red-400"></i>
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.3rem', color: '#fff' }}>OBJETIVOS EN CAMINO</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
          La sección de objetivos estará disponible en cuanto se active en el servidor. Vuelve en un momento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="rk-eyebrow">HACIA DÓNDE VAS</p>
          <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
            TUS <span className="rk-red-glow">OBJETIVOS</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-md">Metas concretas con fecha límite. Lo que no se mide, no se mejora.</p>
        </div>
        <button onClick={openForm} className="rk-btn rk-btn-primary flex items-center gap-2" style={{ fontSize: '0.85rem', padding: '0.7rem 1.4rem' }}>
          <i className="ri-add-line"></i> NUEVO OBJETIVO
        </button>
      </div>

      {active.length === 0 && done.length === 0 ? (
        <div className="rk-card text-center" style={{ padding: '48px 28px' }}>
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-white/[0.04] border border-white/10">
            <i className="ri-flag-2-line text-3xl text-zinc-600"></i>
          </div>
          <p className="text-white font-bold">Ponte tu primera meta</p>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
            Un peso a alcanzar, un debut, una marca de cardio. Con fecha límite se persigue mejor.
          </p>
          <button onClick={openForm} className="rk-btn rk-btn-primary mt-6" style={{ fontSize: '0.85rem', padding: '0.7rem 1.6rem' }}>CREAR OBJETIVO</button>
        </div>
      ) : (
        <>
          {/* Activos */}
          {active.length > 0 && (
            <div className="space-y-3">
              {active.map((g) => {
                const cfg = catCfg(g.category);
                const prog = progressOf(g);
                const dl = g.deadline ? deadlineLabel(g.deadline) : null;
                return (
                  <div key={g.id} className="rk-card group" style={{ padding: '18px 20px' }}>
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl border" style={{ background: `${cfg.color}14`, borderColor: `${cfg.color}40`, color: cfg.color }}>
                        <i className={`${cfg.icon} text-xl`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-base font-bold text-white">{g.title}</p>
                          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: `${cfg.color}18`, color: cfg.color }}>{cfg.label}</span>
                        </div>
                        {g.target_value !== null && (
                          <p className="text-xs text-zinc-400 mt-1">
                            Meta: <span className="font-bold text-white">{g.target_value}{g.unit}</span>
                            {g.start_value !== null && <span className="text-zinc-600"> · desde {g.start_value}{g.unit}</span>}
                          </p>
                        )}
                        {dl && (
                          <p className={`text-xs mt-1 flex items-center gap-1.5 ${dl.overdue ? 'text-red-400' : dl.urgent ? 'text-orange-400' : 'text-zinc-500'}`}>
                            <i className="ri-calendar-line"></i>{dl.text}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setStatus(g.id, 'achieved')} title="Marcar como conseguido"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-green-400 hover:bg-green-500/10 transition-colors cursor-pointer">
                          <i className="ri-checkbox-circle-line"></i>
                        </button>
                        <button onClick={() => remove(g.id)} title="Eliminar"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 transition-colors cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      </div>
                    </div>

                    {/* Barra de progreso (metas de peso con datos) */}
                    {prog && (
                      <div className="mt-3.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] text-zinc-500">{prog.label}</span>
                          <span className="text-xs font-black" style={{ color: cfg.color }}>{prog.pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${prog.pct}%`, background: cfg.color }} />
                        </div>
                      </div>
                    )}
                    {g.category === 'weight' && g.target_value !== null && currentWeight === null && (
                      <p className="text-[11px] text-zinc-600 mt-3">Registra tu peso en la sección Control de peso para ver el progreso aquí.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Conseguidos / archivados */}
          {done.length > 0 && (
            <div>
              <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-zinc-600 mb-3">Historial</p>
              <div className="space-y-2">
                {done.map((g) => {
                  const cfg = catCfg(g.category);
                  const achieved = g.status === 'achieved';
                  return (
                    <div key={g.id} className="rk-card flex items-center gap-3.5 group" style={{ padding: '12px 16px', opacity: 0.75 }}>
                      <div className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg border ${achieved ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-white/[0.04] border-white/10 text-zinc-500'}`}>
                        <i className={achieved ? 'ri-trophy-line' : 'ri-archive-line'}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${achieved ? 'text-white' : 'text-zinc-400'}`}>{g.title}</p>
                        <p className="text-xs text-zinc-600">{achieved ? 'Conseguido' : 'Archivado'} · {cfg.label}</p>
                      </div>
                      <button onClick={() => setStatus(g.id, 'active')} title="Reactivar" className="text-xs text-zinc-500 hover:text-white cursor-pointer px-2">Reactivar</button>
                      <button onClick={() => remove(g.id)} className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal nuevo objetivo */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
          <div className="relative rk-card w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ padding: 24 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="rk-h3" style={{ fontSize: '1.15rem', color: '#fff' }}>NUEVO OBJETIVO</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer transition-colors">
                <i className="ri-close-line"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-2 font-semibold uppercase tracking-wide">Tipo</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map((c) => (
                    <button key={c.value} onClick={() => setCategory(c.value)}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all cursor-pointer ${category === c.value ? 'border-white/30' : 'border-white/10 hover:border-white/20'}`}
                      style={{ background: category === c.value ? `${c.color}18` : 'rgba(255,255,255,0.02)' }}>
                      <i className={c.icon} style={{ color: c.color, fontSize: 16 }}></i>
                      <span className="text-[11px] font-semibold text-white">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Objetivo</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={80}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                  placeholder={catCfg(category).hint} />
              </div>

              {catCfg(category).numeric && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Partida {catCfg(category).unit && `(${catCfg(category).unit})`}</label>
                    <input value={start} onChange={(e) => setStart(e.target.value)} inputMode="decimal"
                      className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                      placeholder="Ahora" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Meta {catCfg(category).unit && `(${catCfg(category).unit})`}</label>
                    <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal"
                      className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                      placeholder="Objetivo" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Fecha límite {catCfg(category).value !== 'habit' ? '' : '(opcional)'}</label>
                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer" />
              </div>

              {category === 'weight' && (
                <p className="text-[11px] text-zinc-500 bg-white/[0.03] border border-white/[0.07] rounded-xl px-3.5 py-2.5 leading-relaxed">
                  <i className="ri-information-line mr-1"></i>
                  En las metas de peso, el progreso se calcula solo con tu último pesaje de Control de peso.
                </p>
              )}

              <button onClick={create} disabled={saving} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.95rem' }}>
                {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> CREANDO...</> : <><i className="ri-flag-line"></i> CREAR OBJETIVO</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
