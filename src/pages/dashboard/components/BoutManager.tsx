import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile, EventBout } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

interface Props {
  profile: Profile;
  eventId: string;
  eventTitle: string;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onClose: () => void;
}

interface Corner { profileId: string | null; name: string; }
interface SearchResult { id: string; full_name: string | null; avatar_url: string | null; }

const emptyBout = () => ({
  a: { profileId: null, name: '' } as Corner,
  b: { profileId: null, name: '' } as Corner,
  weight: '', rounds: '3', isMain: false,
  status: 'confirmed' as 'confirmed' | 'tentative',
  result: '' as '' | 'a' | 'b' | 'draw',
});

export default function BoutManager({ profile, eventId, eventTitle, showToast, onClose }: Props) {
  const { t } = useTranslation();
  const [bouts, setBouts] = useState<EventBout[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [editing, setEditing] = useState<EventBout | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('event_bouts').select('*')
      .eq('event_id', eventId).order('bout_order', { ascending: true });
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    setBouts((data || []) as EventBout[]);
    setLoading(false);
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const removeBout = async (id: string) => {
    setBouts((b) => b.filter((x) => x.id !== id));
    const { error } = await supabase.from('event_bouts').delete().eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); load(); } else showToast(t('evb_deleted'));
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= bouts.length) return;
    const a = bouts[idx], b = bouts[j];
    const next = [...bouts];
    next[idx] = b; next[j] = a;
    setBouts(next);
    await Promise.all([
      supabase.from('event_bouts').update({ bout_order: b.bout_order }).eq('id', a.id),
      supabase.from('event_bouts').update({ bout_order: a.bout_order }).eq('id', b.id),
    ]);
  };

  const cornerName = (name: string | null) => name || t('evb_public_tbd');

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#070707]">
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-white cursor-pointer flex-shrink-0"><i className="ri-arrow-left-line" /></button>
          <div className="min-w-0">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{t('evb_card')}</p>
            <p className="text-sm font-bold text-white truncate">{eventTitle}</p>
          </div>
        </div>
        {!unavailable && (
          <button onClick={() => setEditing('new')} className="rk-btn rk-btn-primary flex items-center gap-2 flex-shrink-0" style={{ fontSize: '0.82rem', padding: '0.55rem 1rem' }}>
            <i className="ri-add-line" />{t('evb_add_bout')}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-2xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : unavailable ? (
            <div className="rk-card text-center" style={{ padding: '40px 24px' }}>
              <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25"><i className="ri-sword-line text-2xl text-red-400" /></div>
              <p className="text-sm text-zinc-400 leading-relaxed">{t('evb_unavailable')}</p>
            </div>
          ) : bouts.length === 0 ? (
            <div className="rk-card text-center" style={{ padding: '44px 24px' }}>
              <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25"><i className="ri-sword-line text-2xl text-red-400" /></div>
              <h3 className="text-base font-bold text-white">{t('evb_empty_title')}</h3>
              <p className="text-sm text-zinc-500 mt-1.5 max-w-xs mx-auto">{t('evb_empty_desc')}</p>
              <button onClick={() => setEditing('new')} className="rk-btn rk-btn-primary mt-4" style={{ fontSize: '0.8rem', padding: '0.6rem 1.3rem' }}>{t('evb_add_bout')}</button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {bouts.map((bt, idx) => (
                <div key={bt.id} className={`rk-card ${bt.is_main ? 'border-red-500/40' : ''}`} style={{ padding: '14px 16px' }}>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button onClick={() => move(idx, -1)} disabled={idx === 0} className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-default" title={t('evb_move_up')}><i className="ri-arrow-up-s-line" /></button>
                      <button onClick={() => move(idx, 1)} disabled={idx === bouts.length - 1} className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-default" title={t('evb_move_down')}><i className="ri-arrow-down-s-line" /></button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {bt.is_main && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-red-300 bg-red-600/15 border border-red-500/30">{t('evb_main_short')}</span>}
                        {bt.status === 'tentative' && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-amber-300 bg-amber-500/15 border border-amber-500/30">{t('evb_bout_tentative')}</span>}
                        {bt.weight_class && <span className="text-[10px] text-zinc-500">{bt.weight_class}</span>}
                        {bt.rounds ? <span className="text-[10px] text-zinc-600">· {t('evb_public_rounds', { n: bt.rounds })}</span> : null}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className={`font-semibold truncate ${bt.result === 'a' ? 'text-emerald-400' : 'text-white'}`}>{cornerName(bt.fighter_a_name)}</span>
                        <span className="text-[10px] font-bold text-zinc-600 flex-shrink-0">{t('evb_vs')}</span>
                        <span className={`font-semibold truncate ${bt.result === 'b' ? 'text-emerald-400' : 'text-white'}`}>{cornerName(bt.fighter_b_name)}</span>
                      </div>
                      {bt.result && (
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {bt.result === 'draw' ? t('evb_result_draw') : `${t('evb_winner')}: ${cornerName(bt.result === 'a' ? bt.fighter_a_name : bt.fighter_b_name)}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setEditing(bt)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-white cursor-pointer"><i className="ri-edit-line text-sm" /></button>
                      <button onClick={() => removeBout(bt.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 cursor-pointer"><i className="ri-delete-bin-line text-sm" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <BoutForm
          profile={profile}
          eventId={eventId}
          existing={editing === 'new' ? null : editing}
          nextOrder={bouts.length}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); showToast(t('evb_saved')); }}
          onError={() => showToast(t('error_save'), 'error')}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
function FighterPicker({ label, corner, onChange }: { label: string; corner: Corner; onChange: (c: Corner) => void; }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    let alive = true;
    const id = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, avatar_url')
        .eq('user_type', 'fighter').ilike('full_name', `%${q}%`).limit(6);
      if (alive) { setResults((data || []) as SearchResult[]); setOpen(true); }
    }, 300);
    return () => { alive = false; clearTimeout(id); };
  }, [query]);

  return (
    <div>
      <label className="block text-xs text-zinc-400 mb-1.5">{label}</label>
      {corner.profileId ? (
        <div className="flex items-center gap-2 bg-emerald-500/[0.06] border border-emerald-500/30 rounded-xl px-3 py-2.5">
          <i className="ri-user-star-line text-emerald-400" />
          <span className="text-sm text-white flex-1 truncate">{corner.name}</span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">{t('evb_linked')}</span>
          <button onClick={() => { onChange({ profileId: null, name: '' }); setQuery(''); }} className="text-zinc-500 hover:text-red-400 cursor-pointer text-xs">{t('evb_clear_link')}</button>
        </div>
      ) : (
        <div className="relative">
          <input value={corner.name} onChange={(e) => { onChange({ profileId: null, name: e.target.value }); setQuery(e.target.value); }}
            onFocus={() => results.length && setOpen(true)}
            className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder={t('evb_search_ph')} />
          {open && results.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
              {results.map((r) => (
                <button key={r.id} onClick={() => { onChange({ profileId: r.id, name: r.full_name || '' }); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.05] text-left cursor-pointer">
                  <div className="w-7 h-7 rounded-lg bg-red-600/10 border border-red-500/25 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {r.avatar_url ? <img src={r.avatar_url} alt="" className="w-full h-full object-cover" /> : <i className="ri-user-line text-red-400 text-xs" />}
                  </div>
                  <span className="text-sm text-white truncate">{r.full_name || '—'}</span>
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-zinc-600 mt-1">{t('evb_or_manual')}</p>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
function BoutForm({ profile, eventId, existing, nextOrder, onClose, onSaved, onError }: {
  profile: Profile; eventId: string; existing: EventBout | null; nextOrder: number;
  onClose: () => void; onSaved: () => void; onError: () => void;
}) {
  const { t } = useTranslation();
  const [a, setA] = useState<Corner>(existing ? { profileId: existing.fighter_a_profile_id, name: existing.fighter_a_name || '' } : { profileId: null, name: '' });
  const [b, setB] = useState<Corner>(existing ? { profileId: existing.fighter_b_profile_id, name: existing.fighter_b_name || '' } : { profileId: null, name: '' });
  const [weight, setWeight] = useState(existing?.weight_class || '');
  const [rounds, setRounds] = useState(existing?.rounds ? String(existing.rounds) : '3');
  const [isMain, setIsMain] = useState(existing?.is_main || false);
  const [status, setStatus] = useState<'confirmed' | 'tentative'>(existing?.status || 'confirmed');
  const [result, setResult] = useState<'' | 'a' | 'b' | 'draw'>(existing?.result || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!a.name.trim() || !b.name.trim()) { onError(); return; }
    setSaving(true);
    const payload = {
      event_id: eventId, org_profile_id: profile.id,
      fighter_a_profile_id: a.profileId, fighter_a_name: a.name.trim(),
      fighter_b_profile_id: b.profileId, fighter_b_name: b.name.trim(),
      weight_class: weight.trim() || null, rounds: rounds ? parseInt(rounds, 10) : null,
      is_main: isMain, status, result: result || null,
    };
    const { error } = existing
      ? await supabase.from('event_bouts').update(payload).eq('id', existing.id)
      : await supabase.from('event_bouts').insert({ ...payload, bout_order: nextOrder });
    setSaving(false);
    if (error) { onError(); return; }
    onSaved();
  };

  const RESULTS: { v: '' | 'a' | 'b' | 'draw'; k: string }[] = [
    { v: '', k: 'evb_result_pending' }, { v: 'a', k: 'evb_result_a' }, { v: 'b', k: 'evb_result_b' }, { v: 'draw', k: 'evb_result_draw' },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-base font-bold text-white">{existing ? t('evb_edit_bout') : t('evb_new_bout')}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"><i className="ri-close-line" /></button>
        </div>
        <div className="p-5 space-y-4">
          <FighterPicker label={t('evb_fighter_a')} corner={a} onChange={setA} />
          <div className="flex items-center justify-center"><span className="text-[10px] font-bold text-zinc-600 tracking-widest">{t('evb_vs')}</span></div>
          <FighterPicker label={t('evb_fighter_b')} corner={b} onChange={setB} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">{t('evb_weight')}</label>
              <input value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500" placeholder={t('evb_weight_ph')} />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">{t('evb_rounds')}</label>
              <input type="number" min="1" max="15" value={rounds} onChange={(e) => setRounds(e.target.value)} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setIsMain((v) => !v)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${isMain ? 'bg-red-600/20 border-red-500/40 text-red-400' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:border-white/25'}`}>
              <i className="ri-vip-crown-line" />{t('evb_main_event')}
            </button>
            <button onClick={() => setStatus((s) => s === 'confirmed' ? 'tentative' : 'confirmed')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${status === 'tentative' ? 'bg-amber-500/15 border-amber-500/40 text-amber-400' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:border-white/25'}`}>
              <i className={status === 'tentative' ? 'ri-question-line' : 'ri-checkbox-circle-line'} />{status === 'tentative' ? t('evb_bout_tentative') : t('evb_bout_confirmed')}
            </button>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('evb_result')}</label>
            <div className="grid grid-cols-4 gap-1.5">
              {RESULTS.map((r) => (
                <button key={r.v || 'none'} onClick={() => setResult(r.v)} className={`py-2 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${result === r.v ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'bg-white/[0.03] border-white/10 text-zinc-500 hover:border-white/25'}`}>
                  {t(r.k)}
                </button>
              ))}
            </div>
          </div>

          <button onClick={save} disabled={saving} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.9rem' }}>
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><i className="ri-save-line" /> {t('evb_save')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
