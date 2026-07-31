import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, GymRosterEntry } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface Activity { last_session: string | null; sessions_week: number; minutes_week: number; }

const SESSION_TYPES = [
  { value: 'sparring', key: 'mc_st_sparring', icon: 'ri-boxing-line', hex: '#E10600' },
  { value: 'tecnica', key: 'mc_st_tecnica', icon: 'ri-focus-3-line', hex: '#38bdf8' },
  { value: 'fuerza', key: 'mc_st_fuerza', icon: 'ri-hammer-line', hex: '#fb923c' },
  { value: 'cardio', key: 'mc_st_cardio', icon: 'ri-run-line', hex: '#4ade80' },
  { value: 'flexibilidad', key: 'mc_st_flexibilidad', icon: 'ri-yoga-line', hex: '#a78bfa' },
  { value: 'recuperacion', key: 'mc_st_recuperacion', icon: 'ri-heart-pulse-line', hex: '#facc15' },
];

interface SearchResult { id: string; full_name: string | null; avatar_url: string | null; }

export default function ClubRoster({ orgId, showToast }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const [roster, setRoster] = useState<GymRosterEntry[]>([]);
  const [activity, setActivity] = useState<Record<string, Activity>>({});
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [adding, setAdding] = useState(false);
  const [assignFor, setAssignFor] = useState<GymRosterEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('gym_roster').select('*')
      .eq('org_profile_id', orgId).eq('status', 'active').order('created_at', { ascending: true });
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    setRoster((data || []) as GymRosterEntry[]);
    // Resumen de actividad SOLO de quien lo comparte (lo filtra el RPC).
    const { data: act } = await supabase.rpc('rk_roster_activity', { p_org: orgId });
    const map: Record<string, Activity> = {};
    (act as { fighter_profile_id: string; last_session: string | null; sessions_week: number; minutes_week: number }[] | null)?.forEach((r) => {
      map[r.fighter_profile_id] = { last_session: r.last_session, sessions_week: r.sessions_week, minutes_week: r.minutes_week };
    });
    setActivity(map);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const removeBoxer = async (r: GymRosterEntry) => {
    setRoster((list) => list.filter((x) => x.id !== r.id));
    const { error } = await supabase.from('gym_roster').update({ status: 'left' }).eq('id', r.id);
    if (error) { showToast(t('error_save'), 'error'); load(); } else showToast(t('cl_roster_removed'));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
          <i className="ri-group-line text-3xl text-red-400" />
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.3rem', color: '#fff' }}>{t('cl_plan_unavailable_title')}</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{t('cl_plan_unavailable_desc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="rk-eyebrow">{t('cl_roster_eyebrow')}</p>
          <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
            {t('cl_roster_title')} <span className="rk-red-glow">{t('cl_roster_title_2')}</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-md">{t('cl_roster_sub')}</p>
        </div>
        <button onClick={() => setAdding(true)} className="rk-btn rk-btn-primary flex items-center gap-2 flex-shrink-0" style={{ fontSize: '0.85rem', padding: '0.6rem 1.1rem' }}>
          <i className="ri-user-add-line" />{t('cl_roster_add')}
        </button>
      </div>

      {roster.length === 0 ? (
        <div className="rk-card text-center" style={{ padding: '44px 24px' }}>
          <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25">
            <i className="ri-group-line text-2xl text-red-400" />
          </div>
          <h3 className="text-base font-bold text-white">{t('cl_roster_empty_title')}</h3>
          <p className="text-sm text-zinc-500 mt-1.5 max-w-xs mx-auto">{t('cl_roster_empty_desc')}</p>
          <button onClick={() => setAdding(true)} className="rk-btn rk-btn-primary mt-4" style={{ fontSize: '0.8rem', padding: '0.6rem 1.3rem' }}>{t('cl_roster_add')}</button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {roster.map((r) => {
            const linked = !!r.fighter_profile_id;
            const act = r.fighter_profile_id ? activity[r.fighter_profile_id] : undefined;
            return (
              <div key={r.id} className="rk-card group" style={{ padding: '14px 16px' }}>
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${linked ? 'bg-red-600/10 border-red-500/25 text-red-400' : 'bg-white/[0.04] border-white/10 text-zinc-500'}`}>
                    <i className={linked ? 'ri-user-star-line text-lg' : 'ri-user-line text-lg'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white truncate">{r.display_name}</p>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${linked ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-zinc-500 bg-white/[0.03] border-white/10'}`}>
                        {linked ? t('cl_roster_rankd') : t('cl_roster_offline')}
                      </span>
                    </div>
                    {r.note && <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{r.note}</p>}
                    {/* Actividad: solo si el boxeador la comparte */}
                    {linked && (
                      act ? (
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[11px]">
                          <span className="inline-flex items-center gap-1 text-emerald-400"><i className="ri-checkbox-circle-line" />{t('cl_roster_shares_on')}</span>
                          <span className="text-zinc-500">{t('cl_roster_week')}: <span className="text-zinc-300 font-semibold">{act.sessions_week}</span></span>
                          <span className="text-zinc-500">{t('cl_roster_last')}: <span className="text-zinc-300">{act.last_session ? new Date(act.last_session + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : t('cl_roster_never')}</span></span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-zinc-600 mt-1.5 inline-flex items-center gap-1"><i className="ri-lock-line" />{t('cl_roster_consent_pending')}</p>
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {linked && (
                      <button onClick={() => setAssignFor(r)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer" title={t('cl_roster_assign')}>
                        <i className="ri-calendar-todo-line text-sm" />
                      </button>
                    )}
                    <button onClick={() => removeBoxer(r)} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" title={t('cl_roster_remove')}>
                      <i className="ri-delete-bin-line text-sm" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adding && <AddBoxerModal orgId={orgId} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); load(); showToast(t('cl_roster_added')); }} />}
      {assignFor && assignFor.fighter_profile_id && (
        <AssignModal orgId={orgId} fighterId={assignFor.fighter_profile_id} name={assignFor.display_name}
          onClose={() => setAssignFor(null)}
          onSent={(n) => { setAssignFor(null); showToast(t('cl_assign_sent', { n })); }} />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
function AddBoxerModal({ orgId, onClose, onAdded }: { orgId: string; onClose: () => void; onAdded: () => void; }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'search' | 'manual'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [manualName, setManualName] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tab !== 'search') return;
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    let alive = true;
    setSearching(true);
    const id = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, avatar_url')
        .eq('user_type', 'fighter').ilike('full_name', `%${q}%`).limit(8);
      if (alive) { setResults((data || []) as SearchResult[]); setSearching(false); }
    }, 300);
    return () => { alive = false; clearTimeout(id); };
  }, [query, tab]);

  const addLinked = async (r: SearchResult) => {
    setSaving(true);
    const { error } = await supabase.from('gym_roster').insert({
      org_profile_id: orgId, fighter_profile_id: r.id,
      display_name: r.full_name || t('cl_roster_rankd'), note: note.trim() || null, status: 'active',
    });
    setSaving(false);
    if (error) return;
    onAdded();
  };

  const addManual = async () => {
    if (!manualName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('gym_roster').insert({
      org_profile_id: orgId, fighter_profile_id: null,
      display_name: manualName.trim(), note: note.trim() || null, status: 'active',
    });
    setSaving(false);
    if (error) return;
    onAdded();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-base font-bold text-white">{t('cl_roster_add_title')}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"><i className="ri-close-line" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex bg-white/[0.04] border border-white/10 rounded-xl p-1">
            {(['search', 'manual'] as const).map((v) => (
              <button key={v} onClick={() => setTab(v)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${tab === v ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}>
                {v === 'search' ? t('cl_roster_tab_search') : t('cl_roster_tab_manual')}
              </button>
            ))}
          </div>

          {tab === 'search' ? (
            <div className="space-y-3">
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder={t('cl_roster_search_ph')} />
              <p className="text-[11px] text-zinc-500 leading-relaxed">{t('cl_roster_search_hint')}</p>
              {searching && <p className="text-xs text-zinc-500 text-center py-2">…</p>}
              {!searching && query.trim().length >= 2 && results.length === 0 && (
                <p className="text-xs text-zinc-600 text-center py-3">{t('cl_roster_no_results')}</p>
              )}
              <div className="space-y-1.5">
                {results.map((r) => (
                  <button key={r.id} onClick={() => addLinked(r)} disabled={saving} className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-white/10 bg-white/[0.02] hover:border-red-500/40 text-left cursor-pointer transition-colors disabled:opacity-50">
                    <div className="w-9 h-9 rounded-lg bg-red-600/10 border border-red-500/25 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {r.avatar_url ? <img src={r.avatar_url} alt="" className="w-full h-full object-cover" /> : <i className="ri-user-line text-red-400" />}
                    </div>
                    <span className="text-sm text-white flex-1 truncate">{r.full_name || '—'}</span>
                    <i className="ri-add-line text-red-400" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <input autoFocus value={manualName} onChange={(e) => setManualName(e.target.value)} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder={t('cl_roster_manual_ph')} />
              <p className="text-[11px] text-zinc-500 leading-relaxed">{t('cl_roster_manual_hint')}</p>
            </div>
          )}

          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder={t('cl_roster_note_ph')} />

          {tab === 'manual' && (
            <button onClick={addManual} disabled={saving || !manualName.trim()} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50" style={{ fontSize: '0.9rem' }}>
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><i className="ri-user-add-line" /> {t('cl_roster_add_btn')}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
function AssignModal({ orgId, fighterId, name, onClose, onSent }: {
  orgId: string; fighterId: string; name: string; onClose: () => void; onSent: (n: number) => void;
}) {
  const { t } = useTranslation();
  const [date, setDate] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [type, setType] = useState('tecnica');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('18:00');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    const finalTitle = title.trim() || t(SESSION_TYPES.find((s) => s.value === type)?.key || 'mc_st_tecnica');
    const { data, error } = await supabase.rpc('rk_coach_assign_plan', {
      p_org: orgId, p_fighter_ids: [fighterId], p_event_date: date,
      p_session_type: type, p_title: finalTitle, p_time: time || null, p_notes: notes.trim() || null,
    });
    setSending(false);
    if (error) return;
    onSent((data as { count?: number } | null)?.count ?? 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white">{t('cl_assign_title')}</h3>
            <p className="text-xs text-zinc-500 truncate">{name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"><i className="ri-close-line" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-[11px] text-zinc-500 leading-relaxed">{t('cl_assign_desc')}</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {SESSION_TYPES.map((s) => (
              <button key={s.value} onClick={() => setType(s.value)} className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[10px] font-medium transition-all cursor-pointer ${type === s.value ? '' : 'bg-white/[0.03] border-white/10 text-zinc-500 hover:border-white/25'}`}
                style={type === s.value ? { background: `${s.hex}1f`, borderColor: `${s.hex}66`, color: s.hex } : undefined}>
                <i className={`${s.icon} text-base`} />{t(s.key)}
              </button>
            ))}
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder={t('cl_assign_field_title')} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">{t('cl_assign_date')}</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ colorScheme: 'dark' }} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">{t('cl_assign_time')}</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500" />
            </div>
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={280} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-none" placeholder={t('cl_assign_notes')} />
          <button onClick={send} disabled={sending} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.9rem' }}>
            {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><i className="ri-send-plane-line" /> {t('cl_assign_send')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
