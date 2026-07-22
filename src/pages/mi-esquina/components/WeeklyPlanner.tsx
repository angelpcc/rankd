import { useState, useEffect, useCallback } from 'react';
import { supabase, Profile } from '@/lib/supabase';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface PlanItem {
  id: string;
  day: number;          // 0 = lunes ... 6 = domingo
  time: string;         // "18:30"
  title: string;
  kind: string;
  done: boolean;
}

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DAYS_SHORT = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

const KINDS = [
  { value: 'sparring', label: 'Sparring', icon: 'ri-boxing-line', color: '#E10600' },
  { value: 'tecnica', label: 'Técnica', icon: 'ri-focus-3-line', color: '#38bdf8' },
  { value: 'fuerza', label: 'Fuerza', icon: 'ri-hammer-line', color: '#fb923c' },
  { value: 'cardio', label: 'Cardio', icon: 'ri-run-line', color: '#22c55e' },
  { value: 'movilidad', label: 'Movilidad', icon: 'ri-yoga-line', color: '#a78bfa' },
  { value: 'descanso', label: 'Descanso', icon: 'ri-heart-pulse-line', color: '#eab308' },
];

const kindCfg = (v: string) => KINDS.find((k) => k.value === v) || KINDS[0];

function todayIndex(): number {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

export default function WeeklyPlanner({ profile, showToast }: Props) {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingDay, setAddingDay] = useState<number | null>(null);

  const [nTime, setNTime] = useState('18:00');
  const [nTitle, setNTitle] = useState('');
  const [nKind, setNKind] = useState('tecnica');

  const today = todayIndex();

  const persist = useCallback(async (next: PlanItem[]) => {
    setSaving(true);
    const { error } = await supabase.from('weekly_plans').upsert({
      fighter_profile_id: profile.id,
      plan: next,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'fighter_profile_id' });
    setSaving(false);
    if (error) showToast('No se pudo guardar el plan', 'error');
  }, [profile.id, showToast]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('weekly_plans')
        .select('plan')
        .eq('fighter_profile_id', profile.id)
        .maybeSingle();
      if (data?.plan) setItems(data.plan as PlanItem[]);
      setLoading(false);
    };
    load();
  }, [profile.id]);

  const addItem = (day: number) => {
    if (!nTitle.trim()) { showToast('Escribe qué vas a hacer', 'error'); return; }
    const item: PlanItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      day, time: nTime, title: nTitle.trim(), kind: nKind, done: false,
    };
    const next = [...items, item];
    setItems(next);
    persist(next);
    setNTitle('');
    setAddingDay(null);
  };

  const toggleDone = (id: string) => {
    const next = items.map((it) => it.id === id ? { ...it, done: !it.done } : it);
    setItems(next);
    persist(next);
  };

  const removeItem = (id: string) => {
    const next = items.filter((it) => it.id !== id);
    setItems(next);
    persist(next);
  };

  const clearWeek = () => {
    const next = items.map((it) => ({ ...it, done: false }));
    setItems(next);
    persist(next);
    showToast('Semana reiniciada');
  };

  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(28px,5vw,40px)', letterSpacing: 1 }}>
            MI SEMANA DE <span className="text-[#E10600]">ENTRENO</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Planifica tu semana y tacha lo que vayas cumpliendo.</p>
        </div>
        {total > 0 && (
          <button onClick={clearWeek} className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 px-3 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap">
            <i className="ri-refresh-line"></i> Reiniciar semana
          </button>
        )}
      </div>

      {/* Progreso */}
      {total > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-white">Progreso semanal</span>
            <span className="text-sm font-black" style={{ color: pct === 100 ? '#22c55e' : '#E10600' }}>{done}/{total} · {pct}%</span>
          </div>
          <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: pct === 100 ? 'linear-gradient(90deg,#16a34a,#22c55e)' : 'linear-gradient(90deg,#E10600,#ff4d4d)' }} />
          </div>
          {pct === 100 && <p className="text-xs text-green-400 mt-2 flex items-center gap-1.5"><i className="ri-trophy-line"></i>Semana completada. Así se hace 👊</p>}
        </div>
      )}

      {/* Días */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {DAYS.map((dayName, idx) => {
          const dayItems = items.filter((it) => it.day === idx).sort((a, b) => a.time.localeCompare(b.time));
          const isToday = idx === today;
          return (
            <div key={dayName}
              className={`rounded-2xl border overflow-hidden flex flex-col ${isToday ? 'border-red-500/45 bg-red-600/[0.04]' : 'border-zinc-800 bg-zinc-900/60'}`}>
              <div className={`px-4 py-3 flex items-center justify-between ${isToday ? 'bg-red-600/10' : 'bg-zinc-900'}`}>
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: 2 }} className={isToday ? 'text-red-400' : 'text-white'}>
                    {DAYS_SHORT[idx]}
                  </span>
                  {isToday && <span className="text-[9px] font-bold text-red-400 bg-red-600/15 border border-red-500/30 px-1.5 py-0.5 rounded-full uppercase">Hoy</span>}
                </div>
                <button onClick={() => { setAddingDay(addingDay === idx ? null : idx); setNTitle(''); }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-red-600 text-zinc-400 hover:text-white transition-colors cursor-pointer">
                  <i className={addingDay === idx ? 'ri-close-line text-sm' : 'ri-add-line text-sm'}></i>
                </button>
              </div>

              <div className="p-3 space-y-2 flex-1 min-h-[70px]">
                {dayItems.length === 0 && addingDay !== idx && (
                  <p className="text-[11px] text-zinc-600 text-center py-3">Día libre</p>
                )}

                {dayItems.map((it) => {
                  const cfg = kindCfg(it.kind);
                  return (
                    <div key={it.id} className="group flex items-start gap-2.5 rounded-xl p-2.5 transition-all"
                      style={{ background: it.done ? 'rgba(255,255,255,0.02)' : `${cfg.color}0f`, border: `1px solid ${it.done ? 'rgba(255,255,255,0.06)' : cfg.color + '33'}` }}>
                      <button onClick={() => toggleDone(it.id)}
                        className="w-5 h-5 mt-0.5 rounded-md border flex items-center justify-center flex-shrink-0 cursor-pointer transition-all"
                        style={{ borderColor: it.done ? '#22c55e' : cfg.color + '77', background: it.done ? '#22c55e' : 'transparent' }}>
                        {it.done && <i className="ri-check-line text-white text-xs"></i>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold leading-snug ${it.done ? 'text-zinc-600 line-through' : 'text-white'}`}>{it.title}</p>
                        <p className="flex items-center gap-1.5 text-[10px] mt-0.5" style={{ color: it.done ? 'rgba(255,255,255,0.25)' : cfg.color }}>
                          <i className={cfg.icon}></i>{it.time} · {cfg.label}
                        </p>
                      </div>
                      <button onClick={() => removeItem(it.id)}
                        className="w-5 h-5 flex items-center justify-center text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex-shrink-0">
                        <i className="ri-close-line text-xs"></i>
                      </button>
                    </div>
                  );
                })}

                {/* Formulario inline */}
                {addingDay === idx && (
                  <div className="space-y-2 pt-1 anim-fade-up">
                    <input value={nTitle} onChange={(e) => setNTitle(e.target.value)} autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') addItem(idx); }}
                      placeholder="Ej: Sparring en el gimnasio"
                      className="w-full bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-red-500" />
                    <div className="flex gap-2">
                      <input type="time" value={nTime} onChange={(e) => setNTime(e.target.value)}
                        className="flex-1 bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-red-500 cursor-pointer" />
                      <select value={nKind} onChange={(e) => setNKind(e.target.value)}
                        className="flex-1 bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-red-500 cursor-pointer">
                        {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                      </select>
                    </div>
                    <button onClick={() => addItem(idx)}
                      className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer">
                      Añadir
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-zinc-600 flex items-center gap-1.5">
        <i className={saving ? 'ri-loader-4-line animate-spin' : 'ri-cloud-line'}></i>
        {saving ? 'Guardando...' : 'Tu plan se guarda automáticamente'}
      </p>
    </div>
  );
}