import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, ClubSession, GymRosterEntry } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

interface Props {
  orgId: string;
  coachId: string;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

// Mismos valores/colores que el diario del peleador, para que todo el ecosistema
// hable el mismo idioma visual. Las claves mc_st_* son globales (namespace esquina).
const SESSION_TYPES = [
  { value: 'sparring', key: 'mc_st_sparring', icon: 'ri-boxing-line', hex: '#E10600' },
  { value: 'tecnica', key: 'mc_st_tecnica', icon: 'ri-focus-3-line', hex: '#38bdf8' },
  { value: 'fuerza', key: 'mc_st_fuerza', icon: 'ri-hammer-line', hex: '#fb923c' },
  { value: 'cardio', key: 'mc_st_cardio', icon: 'ri-run-line', hex: '#4ade80' },
  { value: 'flexibilidad', key: 'mc_st_flexibilidad', icon: 'ri-yoga-line', hex: '#a78bfa' },
  { value: 'recuperacion', key: 'mc_st_recuperacion', icon: 'ri-heart-pulse-line', hex: '#facc15' },
];
const typeCfg = (v: string) => SESSION_TYPES.find((s) => s.value === v) || SESSION_TYPES[0];

const PARTS = [
  { value: 'morning', key: 'cl_plan_part_morning', icon: 'ri-sun-line' },
  { value: 'afternoon', key: 'cl_plan_part_afternoon', icon: 'ri-sun-foggy-line' },
  { value: 'evening', key: 'cl_plan_part_evening', icon: 'ri-moon-line' },
];
const partCfg = (v: string) => PARTS.find((p) => p.value === v) || PARTS[2];
const PART_ORDER: Record<string, number> = { morning: 0, afternoon: 1, evening: 2 };

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const todayISO = () => iso(new Date());
function mondayOf(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const day = x.getDay() === 0 ? 6 : x.getDay() - 1;
  x.setDate(x.getDate() - day);
  return x;
}
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

export default function ClubPlan({ orgId, coachId, showToast }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [sessions, setSessions] = useState<ClubSession[]>([]);
  const [roster, setRoster] = useState<GymRosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [formDay, setFormDay] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const from = iso(weekStart);
    const to = iso(addDays(weekStart, 6));
    const [sesRes, rosterRes] = await Promise.all([
      supabase.from('club_sessions').select('*').eq('org_profile_id', orgId)
        .gte('session_date', from).lte('session_date', to).order('session_date', { ascending: true }),
      supabase.from('gym_roster').select('*').eq('org_profile_id', orgId).eq('status', 'active')
        .not('fighter_profile_id', 'is', null),
    ]);
    if (isMissingTable(sesRes.error)) { setUnavailable(true); setLoading(false); return; }
    setSessions((sesRes.data || []) as ClubSession[]);
    setRoster((rosterRes.data || []) as GymRosterEntry[]);
    setLoading(false);
  }, [orgId, weekStart]);

  useEffect(() => { load(); }, [load]);

  const byDate = useMemo(() => {
    const m = new Map<string, ClubSession[]>();
    sessions.forEach((s) => { const l = m.get(s.session_date) || []; l.push(s); m.set(s.session_date, l); });
    m.forEach((l) => l.sort((a, b) => (PART_ORDER[a.part_of_day] ?? 9) - (PART_ORDER[b.part_of_day] ?? 9)));
    return m;
  }, [sessions]);

  const removeSession = async (id: string) => {
    setSessions((s) => s.filter((x) => x.id !== id));
    const { error } = await supabase.from('club_sessions').delete().eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); load(); } else showToast(t('cl_plan_deleted'));
  };

  const addSession = async (payload: {
    session_date: string; part_of_day: string; session_type: string;
    title: string; group_label: string | null; notes: string | null; assignTo: string[];
  }) => {
    const { data, error } = await supabase.from('club_sessions').insert({
      org_profile_id: orgId, coach_profile_id: coachId,
      session_date: payload.session_date, part_of_day: payload.part_of_day,
      session_type: payload.session_type, title: payload.title,
      group_label: payload.group_label, notes: payload.notes,
    }).select().maybeSingle();
    if (error || !data) { showToast(t('error_save'), 'error'); return; }
    setSessions((s) => [...s, data as ClubSession]);
    showToast(t('cl_plan_saved'));
    setFormDay(null);

    // Asignación opcional: se sugiere en el plan de cada boxeador (source='coach').
    if (payload.assignTo.length > 0) {
      const { data: res } = await supabase.rpc('rk_coach_assign_plan', {
        p_org: orgId, p_fighter_ids: payload.assignTo, p_event_date: payload.session_date,
        p_session_type: payload.session_type, p_title: payload.title,
        p_time: null, p_notes: payload.notes,
      });
      const n = (res as { count?: number } | null)?.count ?? 0;
      if (n > 0) showToast(t('cl_assign_sent', { n }));
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
          <i className="ri-calendar-todo-line text-3xl text-red-400" />
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.3rem', color: '#fff' }}>{t('cl_plan_unavailable_title')}</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{t('cl_plan_unavailable_desc')}</p>
      </div>
    );
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = addDays(weekStart, 6);
  const rangeLabel = `${weekStart.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`;
  const isCurrentWeek = iso(weekStart) === iso(mondayOf(new Date()));

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <p className="rk-eyebrow">{t('cl_plan_eyebrow')}</p>
        <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
          {t('cl_plan_title')} <span className="rk-red-glow">{t('cl_plan_title_2')}</span>
        </h2>
        <p className="text-zinc-400 text-sm mt-1.5 max-w-md">{t('cl_plan_sub')}</p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer">
          <i className="ri-arrow-left-s-line text-xl" />
        </button>
        <div className="text-center flex items-center gap-3">
          <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1.5, color: '#fff' }}>{rangeLabel}</h3>
          {!isCurrentWeek && (
            <button onClick={() => setWeekStart(mondayOf(new Date()))} className="text-[11px] font-bold uppercase tracking-wider text-red-400 bg-red-600/10 border border-red-500/30 px-2.5 py-1 rounded-full cursor-pointer hover:bg-red-600/20 transition-colors">{t('cl_plan_today')}</button>
          )}
        </div>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer">
          <i className="ri-arrow-right-s-line text-xl" />
        </button>
      </div>

      <div className="space-y-2.5">
        {days.map((d) => {
          const dISO = iso(d);
          const items = byDate.get(dISO) || [];
          const isToday = dISO === todayISO();
          return (
            <div key={dISO} className={`rounded-2xl border transition-colors ${isToday ? 'border-red-500/40 bg-red-600/[0.05]' : 'border-white/10 bg-white/[0.02]'}`}>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-baseline gap-2.5">
                  <span className={`text-lg font-bold leading-none ${isToday ? 'text-red-400' : 'text-white'}`} style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{d.getDate()}</span>
                  <span className={`text-xs font-bold uppercase tracking-wider capitalize ${isToday ? 'text-red-400' : 'text-zinc-500'}`}>{d.toLocaleDateString(locale, { weekday: 'long' })}</span>
                </div>
                <button onClick={() => setFormDay(formDay === dISO ? null : dISO)} className={`w-8 h-8 flex items-center justify-center rounded-lg border text-sm transition-colors cursor-pointer ${formDay === dISO ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.04] border-white/10 text-zinc-400 hover:text-white'}`} title={t('cl_plan_add')}>
                  <i className={formDay === dISO ? 'ri-close-line' : 'ri-add-line'} />
                </button>
              </div>

              {items.length > 0 && (
                <div className="px-4 pb-3 space-y-1.5">
                  {items.map((s) => {
                    const cfg = typeCfg(s.session_type);
                    const pc = partCfg(s.part_of_day);
                    return (
                      <div key={s.id} className="flex items-center gap-3 rounded-xl border p-2.5 group" style={{ borderColor: `${cfg.hex}30`, background: `${cfg.hex}0d` }}>
                        <div className="w-8 h-8 flex items-center justify-center rounded-lg border flex-shrink-0" style={{ background: `${cfg.hex}1a`, borderColor: `${cfg.hex}40`, color: cfg.hex }}>
                          <i className={cfg.icon} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-white truncate">{s.title}</p>
                            <span className="text-[10px] text-zinc-500 inline-flex items-center gap-1"><i className={pc.icon} />{t(pc.key)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[11px]" style={{ color: cfg.hex }}>{t(cfg.key)}</span>
                            {s.group_label && <span className="text-[11px] text-zinc-500 inline-flex items-center gap-1"><i className="ri-group-line" />{s.group_label}</span>}
                          </div>
                          {s.notes && <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{s.notes}</p>}
                        </div>
                        <button onClick={() => removeSession(s.id)} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <i className="ri-delete-bin-line text-sm" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {formDay === dISO && (
                <div className="px-4 pb-4">
                  <PlanForm date={dISO} roster={roster} onSubmit={addSession} onCancel={() => setFormDay(null)} />
                </div>
              )}

              {items.length === 0 && formDay !== dISO && (
                <p className="px-4 pb-3 text-[11px] text-zinc-700">{t('cl_plan_free_day')}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
function PlanForm({ date, roster, onSubmit, onCancel }: {
  date: string; roster: GymRosterEntry[];
  onSubmit: (p: { session_date: string; part_of_day: string; session_type: string; title: string; group_label: string | null; notes: string | null; assignTo: string[]; }) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [part, setPart] = useState('evening');
  const [type, setType] = useState('tecnica');
  const [title, setTitle] = useState('');
  const [group, setGroup] = useState('');
  const [notes, setNotes] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTo, setAssignTo] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleAssign = (id: string) => setAssignTo((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);

  const submit = async () => {
    setSaving(true);
    const finalTitle = title.trim() || t(typeCfg(type).key);
    await onSubmit({
      session_date: date, part_of_day: part, session_type: type,
      title: finalTitle, group_label: group.trim() || null, notes: notes.trim() || null,
      assignTo: assignOpen ? assignTo : [],
    });
    setSaving(false);
  };

  return (
    <div className="rk-card space-y-3 mt-1" style={{ padding: 16 }}>
      {/* Franja */}
      <div className="grid grid-cols-3 gap-1.5">
        {PARTS.map((p) => (
          <button key={p.value} onClick={() => setPart(p.value)} className={`flex flex-col items-center gap-1 py-2 rounded-xl border transition-all cursor-pointer text-[11px] font-semibold ${part === p.value ? 'bg-red-600/20 border-red-500/40 text-red-400' : 'bg-white/[0.03] border-white/10 text-zinc-500 hover:border-white/25'}`}>
            <i className={`${p.icon} text-base`} />{t(p.key)}
          </button>
        ))}
      </div>
      {/* Tipo */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {SESSION_TYPES.map((s) => (
          <button key={s.value} onClick={() => setType(s.value)} className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[10px] font-medium transition-all cursor-pointer ${type === s.value ? '' : 'bg-white/[0.03] border-white/10 text-zinc-500 hover:border-white/25'}`}
            style={type === s.value ? { background: `${s.hex}1f`, borderColor: `${s.hex}66`, color: s.hex } : undefined}>
            <i className={`${s.icon} text-base`} />{t(s.key)}
          </button>
        ))}
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500" placeholder={t('cl_plan_title_ph')} />
      <input value={group} onChange={(e) => setGroup(e.target.value)} maxLength={60} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500" placeholder={t('cl_plan_group_ph')} />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={280} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500 resize-none" placeholder={t('cl_plan_notes_ph')} />

      {/* Asignar a boxeadores (opcional) */}
      {roster.length > 0 && (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <button onClick={() => setAssignOpen((v) => !v)} className="w-full flex items-center justify-between px-3.5 py-2.5 text-sm text-zinc-300 hover:text-white cursor-pointer">
            <span className="flex items-center gap-2"><i className="ri-user-shared-line text-red-400" />{t('cl_plan_assign_toggle')}{assignTo.length > 0 && assignOpen ? ` · ${assignTo.length}` : ''}</span>
            <i className={`ri-arrow-down-s-line transition-transform ${assignOpen ? 'rotate-180' : ''}`} />
          </button>
          {assignOpen && (
            <div className="px-3.5 pb-3 space-y-1.5">
              <p className="text-[11px] text-zinc-500 leading-relaxed">{t('cl_plan_assign_hint')}</p>
              <div className="flex flex-wrap gap-1.5">
                {roster.map((r) => (
                  <button key={r.id} onClick={() => r.fighter_profile_id && toggleAssign(r.fighter_profile_id)} className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${r.fighter_profile_id && assignTo.includes(r.fighter_profile_id) ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:border-white/25'}`}>
                    {r.display_name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onCancel} disabled={saving} className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 hover:text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-50">{t('cl_cancel')}</button>
        <button onClick={submit} disabled={saving} className="flex-[2] rk-btn rk-btn-primary flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.9rem' }}>
          {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><i className="ri-check-line" /> {t('cl_plan_save')}</>}
        </button>
      </div>
    </div>
  );
}
