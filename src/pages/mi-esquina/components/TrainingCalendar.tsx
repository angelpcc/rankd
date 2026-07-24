import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import WeeklyPlanner from './WeeklyPlanner';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface PlannedEvent {
  id: string;
  event_date: string;
  kind: 'training' | 'weigh_in' | 'fight' | 'rest' | 'other';
  session_type: string | null;
  title: string;
  time: string | null;
  notes: string | null;
  done: boolean;
}

const KIND_CFG: Record<PlannedEvent['kind'], { label: string; icon: string; color: string }> = {
  training: { label: 'Entreno', icon: 'ri-boxing-line', color: '#E10600' },
  weigh_in: { label: 'Pesaje', icon: 'ri-scales-2-line', color: '#C9A84C' },
  fight: { label: 'Combate', icon: 'ri-sword-line', color: '#ff2d2d' },
  rest: { label: 'Descanso', icon: 'ri-heart-pulse-line', color: '#22c55e' },
  other: { label: 'Otro', icon: 'ri-calendar-event-line', color: '#38bdf8' },
};

const TRAINING_TYPES = [
  { value: 'sparring', label: 'Sparring' },
  { value: 'tecnica', label: 'Técnica' },
  { value: 'fuerza', label: 'Fuerza' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'movilidad', label: 'Movilidad' },
];

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const todayISO = () => iso(new Date());

export default function TrainingCalendar({ profile, showToast }: Props) {
  const [view, setView] = useState<'month' | 'week'>('month');
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [planned, setPlanned] = useState<PlannedEvent[]>([]);
  const [doneDates, setDoneDates] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  // Día seleccionado (abre el panel de ese día)
  const [selected, setSelected] = useState<string | null>(null);

  // Formulario de nuevo evento
  const [kind, setKind] = useState<PlannedEvent['kind']>('training');
  const [sessionType, setSessionType] = useState('tecnica');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('18:00');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const monthStart = iso(cursor);
  const monthEndDate = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const monthEnd = iso(monthEndDate);

  const load = useCallback(async () => {
    setLoading(true);
    const [planRes, sessRes] = await Promise.all([
      // Todos los eventos planificados del peleador (no son muchos): sirve para
      // el grid del mes y para la lista de próximos, sin una consulta por mes.
      supabase.from('planned_events').select('*').eq('fighter_profile_id', profile.id).order('event_date', { ascending: true }),
      supabase.from('training_sessions').select('session_date').eq('fighter_profile_id', profile.id).gte('session_date', monthStart).lte('session_date', monthEnd),
    ]);
    if (isMissingTable(planRes.error)) { setUnavailable(true); setLoading(false); return; }
    setPlanned((planRes.data || []) as PlannedEvent[]);
    const dm = new Map<string, number>();
    (sessRes.data || []).forEach((s: { session_date: string }) => dm.set(s.session_date, (dm.get(s.session_date) || 0) + 1));
    setDoneDates(dm);
    setLoading(false);
  }, [profile.id, monthStart, monthEnd]);

  useEffect(() => { load(); }, [load]);

  const plannedByDate = useMemo(() => {
    const m = new Map<string, PlannedEvent[]>();
    planned.forEach((e) => { const list = m.get(e.event_date) || []; list.push(e); m.set(e.event_date, list); });
    return m;
  }, [planned]);

  const upcoming = useMemo(() => {
    const t = todayISO();
    return planned.filter((e) => e.event_date >= t && !e.done).slice(0, 8);
  }, [planned]);

  // Construcción del grid del mes (lunes primero)
  const grid = useMemo(() => {
    const firstDay = new Date(cursor);
    const startWeekday = (firstDay.getDay() + 6) % 7; // 0 = lunes
    const daysInMonth = monthEndDate.getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(iso(new Date(cursor.getFullYear(), cursor.getMonth(), d)));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor, monthEndDate]);

  const openDay = (date: string) => {
    setSelected(date);
    setKind('training'); setSessionType('tecnica'); setTitle(''); setTime('18:00'); setNotes('');
  };

  const addEvent = async () => {
    if (!selected) return;
    const cfg = KIND_CFG[kind];
    const finalTitle = title.trim() || (kind === 'training' ? (TRAINING_TYPES.find((t) => t.value === sessionType)?.label || 'Entreno') : cfg.label);
    setSaving(true);
    const { data, error } = await supabase.from('planned_events').insert({
      fighter_profile_id: profile.id,
      event_date: selected,
      kind,
      session_type: kind === 'training' ? sessionType : null,
      title: finalTitle,
      time: kind === 'training' && time ? time : null,
      notes: notes.trim() || null,
    }).select().maybeSingle();
    setSaving(false);
    if (error || !data) { showToast('No se pudo guardar', 'error'); return; }
    setPlanned((prev) => [...prev, data as PlannedEvent].sort((a, b) => a.event_date.localeCompare(b.event_date)));
    setTitle(''); setNotes('');
    showToast(`${cfg.label} añadido al calendario`);
  };

  const toggleDone = async (e: PlannedEvent) => {
    const next = !e.done;
    setPlanned((prev) => prev.map((x) => x.id === e.id ? { ...x, done: next } : x));
    const { error } = await supabase.from('planned_events').update({ done: next }).eq('id', e.id);
    if (error) { setPlanned((prev) => prev.map((x) => x.id === e.id ? { ...x, done: !next } : x)); showToast('No se pudo actualizar', 'error'); }
  };

  const removeEvent = async (id: string) => {
    setPlanned((prev) => prev.filter((x) => x.id !== id));
    const { error } = await supabase.from('planned_events').delete().eq('id', id);
    if (error) { showToast('No se pudo eliminar', 'error'); load(); }
  };

  const goMonth = (delta: number) => {
    const d = new Date(cursor); d.setMonth(d.getMonth() + delta); setCursor(d); setSelected(null);
  };

  const selectedItems = selected ? (plannedByDate.get(selected) || []) : [];
  const selectedDone = selected ? (doneDates.get(selected) || 0) : 0;

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
          <i className="ri-calendar-2-line text-3xl text-red-400"></i>
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.3rem', color: '#fff' }}>CALENDARIO EN CAMINO</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
          La planificación mensual estará disponible en cuanto se active en el servidor. Mientras, usa la vista de semana.
        </p>
        <div className="mt-6 text-left">
          <WeeklyPlanner profile={profile} showToast={showToast} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="rk-eyebrow">PLANIFICA HACIA ADELANTE</p>
          <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
            TU <span className="rk-red-glow">CALENDARIO</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-md">Programa entrenos, marca el día del pesaje y la fecha del combate. Toca un día para añadir.</p>
        </div>
        <div className="flex bg-white/[0.04] border border-white/10 rounded-xl p-1">
          {(['month', 'week'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${view === v ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}>
              {v === 'month' ? 'Mes' : 'Semana'}
            </button>
          ))}
        </div>
      </div>

      {view === 'week' ? (
        <WeeklyPlanner profile={profile} showToast={showToast} />
      ) : (
        <>
          {/* Cabecera del mes */}
          <div className="flex items-center justify-between">
            <button onClick={() => goMonth(-1)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer">
              <i className="ri-arrow-left-s-line text-xl"></i>
            </button>
            <div className="text-center">
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 2, color: '#fff' }}>
                {MONTHS[cursor.getMonth()]} <span className="text-zinc-500">{cursor.getFullYear()}</span>
              </h3>
            </div>
            <button onClick={() => goMonth(1)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer">
              <i className="ri-arrow-right-s-line text-xl"></i>
            </button>
          </div>

          {/* Grid del mes */}
          <div className="rk-card" style={{ padding: '14px', transform: 'none' }}>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-center text-[11px] font-bold text-zinc-600 uppercase tracking-wider py-1">{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map((date, i) => {
                if (!date) return <div key={i} />;
                const items = plannedByDate.get(date) || [];
                const done = doneDates.get(date) || 0;
                const isToday = date === todayISO();
                const isSelected = date === selected;
                const dayNum = parseInt(date.slice(-2), 10);
                const hasFight = items.some((e) => e.kind === 'fight');
                const hasWeigh = items.some((e) => e.kind === 'weigh_in');
                return (
                  <button key={date} onClick={() => openDay(date)}
                    className={`relative aspect-square rounded-lg flex flex-col items-center justify-start p-1 transition-all cursor-pointer border ${
                      isSelected ? 'border-red-500 bg-red-600/10' : isToday ? 'border-red-500/40 bg-red-600/[0.04]' : 'border-transparent hover:border-white/15 hover:bg-white/[0.03]'
                    } ${hasFight ? 'ring-1 ring-red-500/50' : ''}`}
                    style={hasFight ? { background: 'rgba(225,6,0,0.08)' } : undefined}>
                    <span className={`text-xs font-bold mt-0.5 ${isToday ? 'text-red-400' : hasFight ? 'text-red-300' : 'text-zinc-300'}`}>{dayNum}</span>
                    {/* Marcadores */}
                    <div className="flex flex-wrap items-center justify-center gap-0.5 mt-auto mb-0.5">
                      {hasFight && <i className="ri-sword-line text-[10px]" style={{ color: '#ff2d2d' }}></i>}
                      {hasWeigh && <i className="ri-scales-2-line text-[10px]" style={{ color: '#C9A84C' }}></i>}
                      {items.some((e) => e.kind === 'training') && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#E10600' }} />}
                      {done > 0 && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />}
                    </div>
                  </button>
                );
              })}
            </div>
            {/* Leyenda */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-white/[0.06] text-[11px] text-zinc-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#E10600]" />Entreno planeado</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />Entreno hecho</span>
              <span className="flex items-center gap-1.5"><i className="ri-scales-2-line text-[#C9A84C]" />Pesaje</span>
              <span className="flex items-center gap-1.5"><i className="ri-sword-line" style={{ color: '#ff2d2d' }} />Combate</span>
            </div>
          </div>

          {/* Próximos eventos */}
          {upcoming.length > 0 && (
            <div>
              <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-zinc-600 mb-3">Lo que viene</p>
              <div className="space-y-2">
                {upcoming.map((e) => {
                  const cfg = KIND_CFG[e.kind];
                  const d = new Date(e.event_date + 'T12:00:00');
                  const days = Math.round((d.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
                  return (
                    <div key={e.id} className="rk-card flex items-center gap-3.5 group" style={{ padding: '12px 16px' }}>
                      <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl border" style={{ background: `${cfg.color}14`, borderColor: `${cfg.color}40`, color: cfg.color }}>
                        <i className={cfg.icon}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-white">{e.title}</p>
                          {e.kind === 'fight' && <span className="text-[9px] font-black uppercase tracking-wider text-red-400 bg-red-600/15 border border-red-500/30 px-1.5 py-0.5 rounded-full">Combate</span>}
                        </div>
                        <p className="text-xs text-zinc-500">
                          {d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                          {e.time ? ` · ${e.time}` : ''}
                          <span className="text-zinc-600"> · {days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`}</span>
                        </p>
                      </div>
                      <button onClick={() => removeEvent(e.id)} className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <i className="ri-close-line"></i>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Panel del día seleccionado */}
      {selected && view === 'month' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
          <div className="relative rk-card w-full sm:max-w-md max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl" style={{ padding: 24, transform: 'none' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="rk-h3" style={{ fontSize: '1.1rem', color: '#fff' }}>
                  {new Date(selected + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                {selectedDone > 0 && <p className="text-xs text-green-400 mt-0.5">{selectedDone} {selectedDone === 1 ? 'entreno registrado' : 'entrenos registrados'} este día</p>}
              </div>
              <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer transition-colors flex-shrink-0">
                <i className="ri-close-line"></i>
              </button>
            </div>

            {/* Eventos ya planificados ese día */}
            {selectedItems.length > 0 && (
              <div className="space-y-2 mb-5">
                {selectedItems.map((e) => {
                  const cfg = KIND_CFG[e.kind];
                  return (
                    <div key={e.id} className="flex items-center gap-3 rounded-xl border p-2.5" style={{ borderColor: `${cfg.color}30`, background: `${cfg.color}0d` }}>
                      <button onClick={() => toggleDone(e)}
                        className="w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 cursor-pointer"
                        style={{ borderColor: e.done ? '#22c55e' : cfg.color + '77', background: e.done ? '#22c55e' : 'transparent' }}>
                        {e.done && <i className="ri-check-line text-white text-xs"></i>}
                      </button>
                      <i className={cfg.icon} style={{ color: cfg.color }}></i>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${e.done ? 'text-zinc-500 line-through' : 'text-white'}`}>{e.title}</p>
                        {(e.time || e.notes) && <p className="text-[11px] text-zinc-500">{[e.time, e.notes].filter(Boolean).join(' · ')}</p>}
                      </div>
                      <button onClick={() => removeEvent(e.id)} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer flex-shrink-0">
                        <i className="ri-delete-bin-line text-sm"></i>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Añadir */}
            <p className="text-[11px] font-bold tracking-widest uppercase text-zinc-500 mb-2">Añadir a este día</p>
            <div className="grid grid-cols-5 gap-1.5 mb-3">
              {(Object.keys(KIND_CFG) as PlannedEvent['kind'][]).map((k) => {
                const cfg = KIND_CFG[k];
                return (
                  <button key={k} onClick={() => setKind(k)}
                    className={`flex flex-col items-center gap-1 py-2 rounded-xl border transition-all cursor-pointer ${kind === k ? 'border-white/30' : 'border-white/10 hover:border-white/20'}`}
                    style={{ background: kind === k ? `${cfg.color}18` : 'rgba(255,255,255,0.02)' }}>
                    <i className={cfg.icon} style={{ color: cfg.color, fontSize: 15 }}></i>
                    <span className="text-[9px] font-semibold text-white leading-none text-center">{cfg.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2.5">
              {kind === 'training' && (
                <select value={sessionType} onChange={(e) => setSessionType(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer">
                  {TRAINING_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              )}
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80}
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500"
                placeholder={kind === 'fight' ? 'Ej: Velada Gimnasio X' : kind === 'weigh_in' ? 'Ej: Pesaje oficial' : 'Título (opcional)'} />
              {kind === 'training' && (
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer" />
              )}
              <button onClick={addEvent} disabled={saving} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.9rem' }}>
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><i className="ri-add-line"></i> AÑADIR</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
