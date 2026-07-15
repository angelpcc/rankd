import { useState, useEffect, useCallback } from 'react';
import { supabase, Profile } from '@/lib/supabase';

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
  { value: 'sparring', label: 'Sparring', icon: 'ri-boxing-line', color: 'text-red-400 bg-red-500/10 border-red-500/25' },
  { value: 'tecnica', label: 'Técnica', icon: 'ri-focus-3-line', color: 'text-sky-400 bg-sky-500/10 border-sky-500/25' },
  { value: 'fuerza', label: 'Fuerza', icon: 'ri-hammer-line', color: 'text-orange-400 bg-orange-500/10 border-orange-500/25' },
  { value: 'cardio', label: 'Cardio', icon: 'ri-run-line', color: 'text-green-400 bg-green-500/10 border-green-500/25' },
  { value: 'flexibilidad', label: 'Movilidad', icon: 'ri-yoga-line', color: 'text-purple-400 bg-purple-500/10 border-purple-500/25' },
  { value: 'recuperacion', label: 'Recuperación', icon: 'ri-heart-pulse-line', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25' },
];

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

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Mi Esquina 🥊</h2>
          <p className="text-zinc-400 text-sm mt-1">Tu diario de entrenamiento. Registra tus sesiones y mantén la disciplina.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap">
          <i className={showForm ? 'ri-close-line' : 'ri-add-line'}></i>
          {showForm ? 'Cerrar' : 'Registrar sesión'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <i className="ri-fire-line text-orange-400 text-lg"></i>
            <p className="text-2xl sm:text-3xl font-black text-orange-400">{streak}</p>
          </div>
          <p className="text-[11px] sm:text-xs text-zinc-400 mt-1">Racha de días</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 text-center">
          <p className="text-2xl sm:text-3xl font-black text-white">{thisWeek.length}</p>
          <p className="text-[11px] sm:text-xs text-zinc-400 mt-1">Sesiones esta semana</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 text-center">
          <p className="text-2xl sm:text-3xl font-black text-green-400">{weekMinutes >= 60 ? `${Math.floor(weekMinutes / 60)}h ${weekMinutes % 60}m` : `${weekMinutes}m`}</p>
          <p className="text-[11px] sm:text-xs text-zinc-400 mt-1">Tiempo esta semana</p>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-4 anim-fade-up">
          <h3 className="text-base font-semibold text-white">Nueva sesión</h3>
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Tipo de entrenamiento</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {SESSION_TYPES.map((t) => (
                <button key={t.value} type="button" onClick={() => setType(t.value)}
                  className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-xs font-medium transition-all cursor-pointer ${type === t.value ? t.color : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-500'}`}>
                  <i className={`${t.icon} text-base`}></i>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Fecha</label>
              <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Duración (minutos)</label>
              <input type="number" min="5" max="600" step="5" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder="60" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Intensidad</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setIntensity(n)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-all cursor-pointer ${intensity >= n ? 'bg-red-600/20 border-red-500/40 text-red-400' : 'bg-zinc-800 border-zinc-700 text-zinc-600 hover:border-zinc-500'}`}>
                  <i className="ri-fire-fill"></i>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1.5">{['Suave', 'Moderada', 'Media', 'Dura', 'Al límite'][intensity - 1]}</p>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Notas (opcional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-none" placeholder="Trabajé jab y movimiento lateral, buenas sensaciones..." />
          </div>
          <button onClick={addSession} disabled={saving} className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Guardando...</> : <><i className="ri-check-line"></i> Guardar sesión</>}
          </button>
        </div>
      )}

      {/* Coach IA teaser */}
      <div className="relative bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-5 sm:p-6 overflow-hidden">
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

      {/* Historial */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Historial</h3>
        {sessions.length === 0 ? (
          <div className="text-center py-14 text-zinc-500 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
            <div className="w-14 h-14 flex items-center justify-center mx-auto mb-3"><i className="ri-calendar-todo-line text-4xl"></i></div>
            <p className="text-sm font-medium text-zinc-400">Aún no has registrado ninguna sesión</p>
            <p className="text-xs mt-1">Registra tu primer entrenamiento y empieza tu racha 🔥</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => {
              const cfg = typeCfg(s.session_type);
              return (
                <div key={s.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 group">
                  <div className={`w-10 h-10 flex items-center justify-center rounded-xl border flex-shrink-0 ${cfg.color}`}>
                    <i className={`${cfg.icon} text-lg`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white">{cfg.label}</p>
                      {s.duration_min && <span className="text-xs text-zinc-500">{s.duration_min} min</span>}
                      {s.intensity && (
                        <span className="flex items-center gap-0.5 text-[10px] text-red-400">
                          {Array.from({ length: s.intensity }).map((_, i) => <i key={i} className="ri-fire-fill"></i>)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {new Date(s.session_date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                      {s.notes && <span className="text-zinc-400"> · {s.notes}</span>}
                    </p>
                  </div>
                  <button onClick={() => deleteSession(s.id)} className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}