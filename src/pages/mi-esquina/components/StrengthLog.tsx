import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import Reveal from '@/components/base/Reveal';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface StrengthSet {
  id: string;
  exercise: string;
  exercise_label: string;
  session_date: string;
  set_number: number;
  reps: number;
  weight_kg: number;
}

interface SetInput { reps: string; weight: string }

/** Ejercicios habituales en preparación de deportes de contacto. */
const COMMON = [
  'Press banca', 'Sentadilla', 'Peso muerto', 'Dominadas',
  'Press militar', 'Remo con barra', 'Hip thrust', 'Zancadas',
];

/** Epley: estimación de una repetición máxima. Orientativa, no oficial. */
function epley(weight: number, reps: number): number {
  return +(weight * (1 + reps / 30)).toFixed(1);
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Registro de fuerza: series, repeticiones y peso, guardados en el tiempo.
 *
 * Las marcas personales NO se guardan en base de datos: se derivan de las
 * series registradas. Así nunca pueden quedar desincronizadas si se corrige
 * o se borra un registro.
 */
export default function StrengthLog({ profile, showToast }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const [rows, setRows] = useState<StrengthSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string>('');
  /** Ejercicio cuya marca se acaba de batir: dispara la celebración */
  const [prHit, setPrHit] = useState<{ exercise: string; weight: number } | null>(null);

  const [exercise, setExercise] = useState('');
  const [date, setDate] = useState(todayISO());
  const [sets, setSets] = useState<SetInput[]>([{ reps: '8', weight: '' }]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('strength_sets').select('*')
      .eq('fighter_profile_id', profile.id)
      .order('session_date', { ascending: false })
      .limit(1500);
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    const list = (data || []) as StrengthSet[];
    setRows(list);
    if (!selected && list.length) setSelected(list[0].exercise);
    setLoading(false);
  }, [profile.id, selected]);

  useEffect(() => { load(); }, [load]);

  // ── Marcas personales por ejercicio (derivadas) ──
  const records = useMemo(() => {
    const map = new Map<string, { label: string; best: number; bestReps: number; est: number; date: string }>();
    rows.forEach((r) => {
      const cur = map.get(r.exercise);
      const est = epley(Number(r.weight_kg), r.reps);
      if (!cur || Number(r.weight_kg) > cur.best) {
        map.set(r.exercise, {
          label: r.exercise_label, best: Number(r.weight_kg), bestReps: r.reps,
          est: Math.max(est, cur?.est ?? 0), date: r.session_date,
        });
      } else if (est > cur.est) {
        map.set(r.exercise, { ...cur, est });
      }
    });
    return [...map.entries()].map(([ex, v]) => ({ exercise: ex, ...v }))
      .sort((a, b) => b.best - a.best);
  }, [rows]);

  const exercises = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => m.set(r.exercise, r.exercise_label));
    return [...m.entries()];
  }, [rows]);

  // ── Progresión del ejercicio elegido: mejor peso por sesión ──
  const progression = useMemo(() => {
    if (!selected) return [];
    const byDate = new Map<string, number>();
    rows.filter((r) => r.exercise === selected).forEach((r) => {
      const w = Number(r.weight_kg);
      byDate.set(r.session_date, Math.max(byDate.get(r.session_date) ?? 0, w));
    });
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, kg]) => ({
        date: new Date(d + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
        kg,
      }));
  }, [rows, selected, locale]);

  const gain = progression.length >= 2
    ? +(progression[progression.length - 1].kg - progression[0].kg).toFixed(1)
    : null;

  const totals = useMemo(() => ({
    volume: Math.round(rows.reduce((a, r) => a + Number(r.weight_kg) * r.reps, 0)),
    sessions: new Set(rows.map((r) => `${r.exercise}|${r.session_date}`)).size,
    exercises: exercises.length,
  }), [rows, exercises]);

  // ── Sesiones agrupadas para el historial ──
  const history = useMemo(() => {
    const m = new Map<string, StrengthSet[]>();
    rows.forEach((r) => {
      const k = `${r.session_date}|${r.exercise}`;
      const l = m.get(k) || []; l.push(r); m.set(k, l);
    });
    return [...m.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 12)
      .map(([k, list]) => ({
        key: k,
        date: list[0].session_date,
        label: list[0].exercise_label,
        sets: [...list].sort((a, b) => a.set_number - b.set_number),
      }));
  }, [rows]);

  const resetForm = () => { setExercise(''); setDate(todayISO()); setSets([{ reps: '8', weight: '' }]); };

  const save = async () => {
    const ex = exercise.trim();
    if (!ex) { showToast(t('mc_str_need_exercise'), 'error'); return; }
    const valid = sets
      .map((s, i) => ({
        reps: parseInt(s.reps, 10),
        weight: parseFloat(s.weight.replace(',', '.')),
        set_number: i + 1,
      }))
      .filter((s) => s.reps > 0 && s.weight > 0);
    if (valid.length === 0) { showToast(t('mc_str_need_sets'), 'error'); return; }

    // La marca a batir se calcula ANTES de insertar, con lo que ya había.
    const key = normalize(ex);
    const prevBest = records.find((r) => r.exercise === key)?.best ?? 0;
    const newBest = Math.max(...valid.map((s) => s.weight));

    setSaving(true);
    const { data, error } = await supabase.from('strength_sets').insert(
      valid.map((s) => ({
        fighter_profile_id: profile.id,
        exercise: key,
        exercise_label: ex,
        session_date: date,
        set_number: s.set_number,
        reps: s.reps,
        weight_kg: s.weight,
      }))
    ).select();
    setSaving(false);
    if (error || !data) { showToast(t('error_save'), 'error'); return; }

    setRows((prev) => [...(data as StrengthSet[]), ...prev]);
    setSelected(key);
    setShowForm(false);
    resetForm();
    showToast(t('mc_str_saved'));

    // Celebración solo si de verdad ha superado su mejor peso anterior
    if (prevBest > 0 && newBest > prevBest) {
      setPrHit({ exercise: ex, weight: newBest });
      window.setTimeout(() => setPrHit(null), 5000);
    }
  };

  const removeSession = async (dateKey: string, ex: string) => {
    const ids = rows.filter((r) => r.session_date === dateKey && r.exercise === ex).map((r) => r.id);
    setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
    const { error } = await supabase.from('strength_sets').delete().in('id', ids);
    if (error) { showToast(t('error_save'), 'error'); load(); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
          <i className="ri-hammer-line text-3xl text-red-400"></i>
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.2rem', color: '#fff' }}>{t('mc_coming_soon_title')}</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{t('mc_coming_soon_desc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Celebración de marca personal */}
      {prHit && (
        <div className="rk-card rk-pr-hit flex items-center gap-4" style={{ padding: '16px 20px', transform: 'none', borderColor: 'rgba(201,168,76,0.5)', background: 'rgba(201,168,76,0.07)' }}>
          <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl bg-[#C9A84C]/15 border border-[#C9A84C]/40 text-[#C9A84C]">
            <i className="ri-trophy-fill text-2xl"></i>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-[#C9A84C] tracking-wide">{t('mc_str_pr_new')}</p>
            <p className="text-xs text-zinc-300 mt-0.5">{t('mc_str_pr_beat', { ex: prHit.exercise, w: prHit.weight })}</p>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="rk-eyebrow">{t('mc_str_eyebrow')}</p>
          <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
            {t('mc_str_title')} <span className="rk-red-glow">{t('mc_str_title_2')}</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-md">{t('mc_str_sub')}</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="rk-btn rk-btn-primary flex items-center gap-2 w-full sm:w-auto justify-center" style={{ fontSize: '0.85rem', padding: '0.75rem 1.4rem' }}>
          <i className="ri-add-line"></i> {t('mc_str_new')}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rk-card text-center" style={{ padding: '48px 28px' }}>
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-white/[0.04] border border-white/10">
            <i className="ri-hammer-line text-3xl text-zinc-600"></i>
          </div>
          <p className="text-white font-bold">{t('mc_str_empty')}</p>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-sm mx-auto leading-relaxed">{t('mc_str_empty_desc')}</p>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="rk-btn rk-btn-primary mt-6" style={{ fontSize: '0.85rem', padding: '0.7rem 1.6rem' }}>
            {t('mc_str_new')}
          </button>
        </div>
      ) : (
        <>
          {/* Cifras */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { v: totals.volume.toLocaleString(locale), l: t('mc_str_total_volume'), c: '#fb923c', suf: 'kg' },
              { v: String(totals.sessions), l: t('mc_str_sessions'), c: '#ffffff', suf: '' },
              { v: String(totals.exercises), l: t('mc_str_exercises'), c: '#38bdf8', suf: '' },
            ].map((s) => (
              <div key={s.l} className="rk-card" style={{ padding: '18px 12px', textAlign: 'center' }}>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(24px,5vw,34px)', lineHeight: 1, color: s.c, margin: 0 }}>
                  {s.v}<span className="text-xs text-zinc-500 ml-1">{s.suf}</span>
                </p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1.5 leading-tight">{s.l}</p>
              </div>
            ))}
          </div>

          {/* Marcas personales */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <i className="ri-trophy-line text-[#C9A84C]"></i>
              <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>{t('mc_str_pr_title')}</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {records.slice(0, 6).map((r, i) => (
                <Reveal key={r.exercise} delay={Math.min(i, 5) * 50}>
                  <div className="rk-card flex items-center gap-3.5" style={{ padding: '14px 16px' }}>
                    <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-[#C9A84C]/12 border border-[#C9A84C]/30 text-[#C9A84C]">
                      <i className="ri-medal-line"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{r.label}</p>
                      <p className="text-[11px] text-zinc-500">
                        {t('mc_str_pr_est')} {r.est} kg · {new Date(r.date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, lineHeight: 1, color: '#C9A84C' }}>{r.best}</p>
                      <p className="text-[9px] text-zinc-600 uppercase tracking-wider">kg × {r.bestReps}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          {/* Progresión */}
          <div className="rk-card" style={{ padding: '20px', transform: 'none' }}>
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>{t('mc_str_progress')}</h3>
              {gain !== null && (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${gain > 0 ? 'text-green-400 bg-green-500/10 border-green-500/25' : 'text-zinc-400 bg-white/[0.04] border-white/10'}`}>
                  {gain > 0 ? '▲ ' : ''}{t('mc_str_gain', { n: gain })}
                </span>
              )}
            </div>

            {/* Selector de ejercicio: scroll horizontal, cómodo en móvil */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 rk-noscroll-x">
              {exercises.map(([ex, label]) => (
                <button key={ex} onClick={() => setSelected(ex)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${selected === ex ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>

            {progression.length < 2 ? (
              <p className="text-xs text-zinc-500 py-8 text-center">{t('mc_str_no_chart')}</p>
            ) : (
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={progression} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="strgrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb923c" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#fb923c" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} minTickGap={24} />
                    <YAxis domain={['dataMin - 5', 'dataMax + 5']} tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} width={36} />
                    <Tooltip contentStyle={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, fontSize: 12 }}
                      labelStyle={{ color: 'rgba(255,255,255,0.5)' }} formatter={(v: number) => [`${v} kg`, '']} />
                    <Area type="monotone" dataKey="kg" stroke="#fb923c" strokeWidth={2.5} fill="url(#strgrad)" dot={{ r: 3, fill: '#fb923c' }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Historial */}
          <div>
            <h3 className="rk-h3 mb-3" style={{ fontSize: '1rem', color: '#fff' }}>{t('mc_str_history')}</h3>
            <div className="space-y-2">
              {history.map((h) => {
                const vol = Math.round(h.sets.reduce((a, s) => a + Number(s.weight_kg) * s.reps, 0));
                return (
                  <div key={h.key} className="rk-card group" style={{ padding: '14px 16px' }}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-white">{h.label}</p>
                          <span className="text-[10px] text-zinc-500">
                            {new Date(h.date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {h.sets.map((s) => (
                            <span key={s.id} className="text-[11px] font-semibold text-zinc-300 bg-white/[0.05] border border-white/10 px-2 py-1 rounded-lg">
                              {s.reps} × {Number(s.weight_kg)} kg
                            </span>
                          ))}
                        </div>
                        <p className="text-[10px] text-zinc-600 mt-1.5">{t('mc_str_volume')}: {vol.toLocaleString(locale)} kg</p>
                      </div>
                      <button onClick={() => removeSession(h.date, h.sets[0].exercise)} aria-label={t('mc_delete')}
                        className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 transition-colors cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5">
            <i className="ri-information-line mt-0.5 flex-shrink-0"></i>{t('mc_str_1rm_note')}
          </p>
        </>
      )}

      {/* Modal de registro */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
          <div className="relative rk-card w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
            style={{ padding: 24, transform: 'none', paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="rk-h3" style={{ fontSize: '1.15rem', color: '#fff' }}>{t('mc_str_new')}</h3>
              <button onClick={() => setShowForm(false)} aria-label={t('mc_close')}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer transition-colors">
                <i className="ri-close-line"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_str_exercise')}</label>
                <input value={exercise} onChange={(e) => setExercise(e.target.value)} autoFocus maxLength={50}
                  placeholder={t('mc_str_exercise_ph')}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500" />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[...new Set([...exercises.map(([, l]) => l), ...COMMON])].slice(0, 8).map((c) => (
                    <button key={c} onClick={() => setExercise(c)}
                      className="text-[11px] text-zinc-400 bg-white/[0.03] border border-white/10 hover:border-white/25 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_str_date')}</label>
                <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 cursor-pointer" />
              </div>

              {/* Series */}
              <div>
                <label className="block text-xs text-zinc-400 mb-2">{t('mc_str_sets')}</label>
                <div className="space-y-2">
                  {sets.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-7 flex-shrink-0 text-center text-[11px] font-bold text-zinc-500">{i + 1}</span>
                      <div className="flex-1 relative">
                        <input value={s.reps} inputMode="numeric"
                          onChange={(e) => setSets((p) => p.map((x, j) => j === i ? { ...x, reps: e.target.value } : x))}
                          className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl pl-3 pr-11 py-3 focus:outline-none focus:border-red-500" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 uppercase">{t('mc_str_reps')}</span>
                      </div>
                      <div className="flex-1 relative">
                        <input value={s.weight} inputMode="decimal" placeholder="0"
                          onChange={(e) => setSets((p) => p.map((x, j) => j === i ? { ...x, weight: e.target.value } : x))}
                          className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl pl-3 pr-9 py-3 focus:outline-none focus:border-red-500" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">kg</span>
                      </div>
                      {sets.length > 1 && (
                        <button onClick={() => setSets((p) => p.filter((_, j) => j !== i))}
                          aria-label={t('mc_str_remove_set')}
                          className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 cursor-pointer">
                          <i className="ri-close-line"></i>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setSets((p) => [...p, { reps: p[p.length - 1]?.reps || '8', weight: p[p.length - 1]?.weight || '' }])}
                  className="w-full mt-2 flex items-center justify-center gap-2 text-xs font-bold text-zinc-300 bg-white/[0.03] border border-white/10 hover:border-white/25 rounded-xl py-3 cursor-pointer transition-colors">
                  <i className="ri-add-line"></i> {t('mc_str_add_set')}
                </button>
              </div>

              <button onClick={save} disabled={saving}
                className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.95rem' }}>
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('mc_saving')}</>
                  : <><i className="ri-hammer-line"></i> {t('mc_str_save')}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .rk-noscroll-x::-webkit-scrollbar { display: none; }
        .rk-noscroll-x { scrollbar-width: none; }
      `}</style>
    </div>
  );
}
