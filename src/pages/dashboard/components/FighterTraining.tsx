import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import Reveal from '@/components/base/Reveal';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface TrainingSession {
  id: string;
  fighter_profile_id: string;
  session_date: string;
  session_type: string;
  duration_min: number | null;
  intensity: number | null;
  notes: string | null;
  created_at: string;
}

const SESSION_TYPES = [
  { value: 'sparring', label: 'Sparring', icon: 'ri-boxing-line', color: 'text-red-400 bg-red-500/10 border-red-500/25', hex: '#E10600' },
  { value: 'tecnica', label: 'Técnica', icon: 'ri-focus-3-line', color: 'text-sky-400 bg-sky-500/10 border-sky-500/25', hex: '#38bdf8' },
  { value: 'fuerza', label: 'Fuerza', icon: 'ri-hammer-line', color: 'text-orange-400 bg-orange-500/10 border-orange-500/25', hex: '#fb923c' },
  { value: 'cardio', label: 'Cardio', icon: 'ri-run-line', color: 'text-green-400 bg-green-500/10 border-green-500/25', hex: '#4ade80' },
  { value: 'flexibilidad', label: 'Movilidad', icon: 'ri-yoga-line', color: 'text-purple-400 bg-purple-500/10 border-purple-500/25', hex: '#a78bfa' },
  { value: 'recuperacion', label: 'Recuperación', icon: 'ri-heart-pulse-line', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25', hex: '#facc15' },
];

const DAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const typeCfg = (v: string) => SESSION_TYPES.find((t) => t.value === v) || SESSION_TYPES[0];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeek(): Date {
  const d = new Date();
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1; // lunes como inicio
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function computeStreak(sessions: TrainingSession[]): number {
  if (sessions.length === 0) return 0;
  const days = new Set(sessions.map((s) => s.session_date));
  let streak = 0;
  const cursor = new Date();
  // Si hoy no hay sesión, empezamos a contar desde ayer
  if (!days.has(todayISO())) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (days.has(iso)) { streak++; cursor.setDate(cursor.getDate() - 1); }
    else break;
  }
  return streak;
}

function streakMessage(streak: number): string {
  if (streak === 0) return 'Registra hoy y enciende tu racha';
  if (streak < 3) return 'Vas arrancando, no la sueltes';
  if (streak < 7) return 'En racha. Sigue sumando días';
  if (streak < 14) return 'Racha semanal completa. Esto ya es disciplina';
  if (streak < 30) return 'Dos semanas seguidas. Se nota el hábito';
  return 'Racha de élite. Pocos llegan hasta aquí';
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <div style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, padding: '8px 12px' }}>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label ?? p.name}</p>
      <p style={{ fontSize: 14, color: '#fff', margin: 0, fontWeight: 700 }}>{p.value} min</p>
    </div>
  );
}

function EmptyChartState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 gap-2">
      <i className={`${icon} text-3xl text-zinc-700`}></i>
      <p className="text-xs text-zinc-500 max-w-[220px]">{text}</p>
    </div>
  );
}

export default function FighterTraining({ profile, showToast }: Props) {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState('sparring');
  const [duration, setDuration] = useState('60');
  const [intensity, setIntensity] = useState(3);
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('fighter_profile_id', profile.id)
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(60);
    setSessions(data || []);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const addSession = async () => {
    if (saving) return;
    setSaving(true);
    const { data, error } = await supabase.from('training_sessions').insert({
      fighter_profile_id: profile.id,
      session_date: date,
      session_type: type,
      duration_min: duration ? parseInt(duration, 10) : null,
      intensity,
      notes: notes.trim() || null,
    }).select().maybeSingle();
    if (error) {
      showToast('No se pudo guardar la sesión', 'error');
    } else if (data) {
      setSessions((prev) => [data, ...prev].sort((a, b) => b.session_date.localeCompare(a.session_date)));
      setNotes('');
      setShowForm(false);
      showToast('Sesión registrada 💪');
    }
    setSaving(false);
  };

  const deleteSession = async (id: string) => {
    const { error } = await supabase.from('training_sessions').delete().eq('id', id);
    if (error) { showToast('No se pudo eliminar', 'error'); return; }
    setSessions((prev) => prev.filter((s) => s.id !== id));
    showToast('Sesión eliminada');
  };

  // Stats
  const weekStart = startOfWeek();
  const thisWeek = sessions.filter((s) => new Date(s.session_date + 'T12:00:00') >= weekStart);
  const weekMinutes = thisWeek.reduce((acc, s) => acc + (s.duration_min || 0), 0);
  const streak = computeStreak(sessions);

  const last7 = useMemo(() => {
    const days: { key: string; label: string; minutes: number; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const minutes = sessions.filter((s) => s.session_date === key).reduce((a, s) => a + (s.duration_min || 0), 0);
      days.push({ key, label: DAY_LABELS[d.getDay()], minutes, isToday: i === 0 });
    }
    return days;
  }, [sessions]);

  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    sessions.forEach((s) => { map.set(s.session_type, (map.get(s.session_type) || 0) + (s.duration_min || 0)); });
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return SESSION_TYPES.map((t) => {
      const minutes = map.get(t.value) || 0;
      return { ...t, minutes, pct: total > 0 ? Math.round((minutes / total) * 100) : 0 };
    }).filter((t) => t.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  }, [sessions]);

  const totalTrackedMinutes = breakdown.reduce((a, b) => a + b.minutes, 0);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="rk-eyebrow">TU DIARIO</p>
          <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
            DIARIO DE <span className="rk-red-glow">ENTRENOS</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-md">Registra tus sesiones, mantén la disciplina y observa tu progreso semana a semana.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className={`rk-btn ${showForm ? 'rk-btn-ghost' : 'rk-btn-primary'} flex items-center gap-2`} style={{ fontSize: '0.85rem', padding: '0.7rem 1.4rem' }}>
          <i className={showForm ? 'ri-close-line' : 'ri-add-line'}></i>
          {showForm ? 'CERRAR' : 'REGISTRAR SESIÓN'}
        </button>
      </div>

      {/* Racha — protagonista */}
      <Reveal>
        <div className="rk-card relative overflow-hidden" style={{ padding: 'clamp(22px,4vw,34px)' }}>
          <div className="rk-glow-red" style={{ width: 260, height: 260, top: -90, right: -90, borderRadius: '50%' }} />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10">
            <div className="flex items-center gap-4 sm:gap-5 flex-shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-2xl bg-gradient-to-br from-red-600/25 to-orange-500/10 border border-red-500/30 anim-pulse-glow flex-shrink-0">
                <i className="ri-fire-fill text-3xl sm:text-4xl text-orange-400"></i>
              </div>
              <div>
                <p className="rk-eyebrow">RACHA ACTUAL</p>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(44px,9vw,68px)', lineHeight: 0.9, color: '#fff', margin: '2px 0 0' }}>
                  {streak}<span style={{ fontSize: '0.32em', color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>{streak === 1 ? 'DÍA' : 'DÍAS'}</span>
                </p>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm sm:text-base text-white font-semibold">{streakMessage(streak)}</p>
              <div className="flex items-center gap-2 sm:gap-2.5 mt-4">
                {last7.map((d) => (
                  <div key={d.key} className="flex flex-col items-center gap-1.5">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border text-xs ${d.minutes > 0 ? 'bg-red-600 border-red-500 text-white' : d.isToday ? 'bg-white/[0.04] border-white/20 text-white/30' : 'bg-white/[0.03] border-white/10 text-white/20'}`}>
                      {d.minutes > 0 ? <i className="ri-check-line"></i> : ''}
                    </div>
                    <span className={`text-[9px] uppercase ${d.isToday ? 'text-white/60 font-bold' : 'text-white/30'}`}>{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Stats */}
      <Reveal delay={80}>
        <div className="grid grid-cols-3 gap-3">
          {[
            { v: String(thisWeek.length), l: 'Sesiones esta semana', c: '#ffffff' },
            { v: weekMinutes >= 60 ? `${Math.floor(weekMinutes / 60)}h ${weekMinutes % 60}m` : `${weekMinutes}m`, l: 'Tiempo esta semana', c: '#4ade80' },
            { v: String(sessions.length), l: 'Sesiones registradas', c: '#C9A84C' },
          ].map((s) => (
            <div key={s.l} className="rk-card text-center" style={{ padding: '16px 10px' }}>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(24px,5vw,32px)', lineHeight: 1, color: s.c, margin: 0 }}>{s.v}</p>
              <p className="rk-body" style={{ fontSize: '0.66rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 6 }}>{s.l}</p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* Gráficos */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Reveal delay={120}>
          <div className="rk-card h-full" style={{ padding: '22px 20px' }}>
            <div className="flex items-center justify-between mb-0.5">
              <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>VOLUMEN SEMANAL</h3>
              {weekMinutes > 0 && <span className="text-xs text-zinc-500">{weekMinutes} min</span>}
            </div>
            <p className="text-xs text-zinc-500 mb-2">Minutos entrenados en los últimos 7 días</p>
            {sessions.length === 0 ? (
              <EmptyChartState icon="ri-bar-chart-2-line" text="Registra tu primera sesión y verás aquí tu volumen semanal." />
            ) : (
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={last7} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                    <YAxis hide />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="minutes" radius={[6, 6, 0, 0]} maxBarSize={34}>
                      {last7.map((d) => <Cell key={d.key} fill={d.isToday ? '#E10600' : 'rgba(201,168,76,0.55)'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </Reveal>

        <Reveal delay={160}>
          <div className="rk-card h-full" style={{ padding: '22px 20px' }}>
            <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>REPARTO POR TIPO</h3>
            <p className="text-xs text-zinc-500 mb-2">Últimas {sessions.length} sesiones registradas</p>
            {breakdown.length === 0 ? (
              <EmptyChartState icon="ri-pie-chart-2-line" text="Cuando registres sesiones, verás aquí el reparto por tipo de entrenamiento." />
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-5 pt-1">
                <div className="relative flex-shrink-0" style={{ width: 148, height: 148 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={breakdown} dataKey="minutes" nameKey="label" innerRadius="64%" outerRadius="100%" paddingAngle={breakdown.length > 1 ? 3 : 0} stroke="none">
                        {breakdown.map((b) => <Cell key={b.value} fill={b.hex} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: '#fff', lineHeight: 1 }}>{totalTrackedMinutes}</span>
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider mt-0.5">min totales</span>
                  </div>
                </div>
                <div className="flex-1 w-full space-y-2.5">
                  {breakdown.map((b) => (
                    <div key={b.value} className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: b.hex }} />
                      <span className="text-xs text-zinc-300 flex-1 truncate">{b.label}</span>
                      <span className="text-xs font-bold text-white">{b.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Reveal>
      </div>

      {/* Form */}
      {showForm && (
        <Reveal>
          <div className="rk-card space-y-4" style={{ padding: '22px 20px' }}>
            <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>NUEVA SESIÓN</h3>
            <div>
              <label className="block text-xs text-zinc-400 mb-2">Tipo de entrenamiento</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {SESSION_TYPES.map((t) => (
                  <button key={t.value} type="button" onClick={() => setType(t.value)}
                    className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-xs font-medium transition-all cursor-pointer ${type === t.value ? t.color : 'bg-white/[0.03] border-white/10 text-zinc-500 hover:border-white/25'}`}>
                    <i className={`${t.icon} text-base`}></i>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Fecha</label>
                <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Duración (minutos)</label>
                <input type="number" min="5" max="600" step="5" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder="60" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-2">Intensidad</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setIntensity(n)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-all cursor-pointer ${intensity >= n ? 'bg-red-600/20 border-red-500/40 text-red-400' : 'bg-white/[0.03] border-white/10 text-zinc-600 hover:border-white/25'}`}>
                    <i className="ri-fire-fill"></i>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1.5">{['Suave', 'Moderada', 'Media', 'Dura', 'Al límite'][intensity - 1]}</p>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Notas (opcional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-none" placeholder="Trabajé jab y movimiento lateral, buenas sensaciones..." />
            </div>
            <button onClick={addSession} disabled={saving} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '1rem' }}>
              {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> GUARDANDO...</> : <><i className="ri-check-line"></i> GUARDAR SESIÓN</>}
            </button>
          </div>
        </Reveal>
      )}

      {/* Coach IA teaser */}
      <Reveal>
        <div className="rk-card relative overflow-hidden" style={{ padding: '20px 22px' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 85% 20%, rgba(225,6,0,0.08) 0%, transparent 55%)' }} />
          <div className="relative flex items-start gap-4">
            <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-red-600/15 border border-red-500/30 text-red-400 flex-shrink-0">
              <i className="ri-sparkling-2-line text-xl"></i>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white">Coach IA</h3>
                <span className="text-[10px] font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">Muy pronto</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">Tu entrenador personal con inteligencia artificial: pregúntale sobre planificación, estrategia y preparación. Conocerá tu perfil, tu récord y tu diario de entrenamiento.</p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Historial */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Historial</h3>
        {sessions.length === 0 ? (
          <Reveal>
            <div className="rk-card text-center" style={{ padding: '52px 24px' }}>
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
                <i className="ri-boxing-line text-3xl text-red-400"></i>
              </div>
              <h3 className="rk-h3" style={{ fontSize: '1.25rem', color: '#fff' }}>TU HISTORIAL EMPIEZA HOY</h3>
              <p className="text-sm text-zinc-400 mt-2 max-w-xs mx-auto leading-relaxed">Cada sesión que registras suma a tu racha y a tu progreso. El primer paso es el más importante.</p>
              <button onClick={() => setShowForm(true)} className="rk-btn rk-btn-primary mt-6" style={{ fontSize: '0.9rem', padding: '0.85rem 1.8rem' }}>
                REGISTRAR MI PRIMERA SESIÓN
              </button>
            </div>
          </Reveal>
        ) : (
          <div className="space-y-2.5">
            {sessions.map((s, i) => {
              const cfg = typeCfg(s.session_type);
              return (
                <Reveal key={s.id} delay={Math.min(i, 6) * 40}>
                  <div className="rk-card flex items-center gap-4 group" style={{ padding: '14px 16px' }}>
                    <div className="w-11 h-11 flex items-center justify-center rounded-xl border flex-shrink-0" style={{ background: `${cfg.hex}1a`, borderColor: `${cfg.hex}40`, color: cfg.hex }}>
                      <i className={`${cfg.icon} text-lg`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white">{cfg.label}</p>
                        {s.duration_min && <span className="text-[11px] text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full">{s.duration_min} min</span>}
                        {s.intensity && (
                          <span className="flex items-center gap-0.5">
                            {Array.from({ length: s.intensity }).map((_, idx) => <i key={idx} className="ri-fire-fill text-red-400 text-[10px]"></i>)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-1 capitalize">
                        {new Date(s.session_date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                      {s.notes && <p className="text-xs text-zinc-400 mt-1.5 pl-2.5 border-l-2 border-white/10 leading-relaxed">{s.notes}</p>}
                    </div>
                    <button onClick={() => deleteSession(s.id)} className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
