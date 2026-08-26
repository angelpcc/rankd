import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import BottomSheet from '@/components/base/BottomSheet';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface CommonSupplement { id: string; name: string; category: string; description: string | null }
interface UserSupplement { id: string; supplement_id: string | null; custom_name: string | null; time_of_day: string | null; notes: string | null }

const CATEGORY_ORDER = ['protein', 'creatine', 'preworkout', 'amino', 'vitamin', 'mineral', 'omega', 'other'];
const CATEGORY_LABEL: Record<string, string> = {
  protein: 'mc_sup_cat_protein', creatine: 'mc_sup_cat_creatine', preworkout: 'mc_sup_cat_preworkout',
  amino: 'mc_sup_cat_amino', vitamin: 'mc_sup_cat_vitamin', mineral: 'mc_sup_cat_mineral',
  omega: 'mc_sup_cat_omega', other: 'mc_sup_cat_other',
};

export default function SupplementTracker({ profile, showToast }: Props) {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<CommonSupplement[]>([]);
  const [items, setItems] = useState<UserSupplement[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<CommonSupplement | null>(null);
  const [customName, setCustomName] = useState('');
  const [time, setTime] = useState('08:00');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cat }, { data: rows, error }] = await Promise.all([
      supabase.from('common_supplements').select('*').order('name', { ascending: true }),
      supabase.from('user_supplements').select('*').eq('fighter_profile_id', profile.id),
    ]);
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    setCatalog((cat || []) as CommonSupplement[]);
    setItems((rows || []) as UserSupplement[]);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const catalogById = useMemo(() => {
    const m = new Map<string, CommonSupplement>();
    catalog.forEach((c) => m.set(c.id, c));
    return m;
  }, [catalog]);

  const displayName = (item: UserSupplement) => item.custom_name || catalogById.get(item.supplement_id || '')?.name || '—';

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => (a.time_of_day || '99:99').localeCompare(b.time_of_day || '99:99'));
  }, [items]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? catalog.filter((c) => c.name.toLowerCase().includes(q)) : catalog;
    return CATEGORY_ORDER.map((cat) => ({ cat, items: filtered.filter((c) => c.category === cat) })).filter((g) => g.items.length > 0);
  }, [catalog, query]);

  const resetForm = () => { setPicked(null); setCustomName(''); setQuery(''); setTime('08:00'); };

  const openPicker = () => { resetForm(); setShowPicker(true); };

  const save = async () => {
    if (!picked && !customName.trim()) { showToast(t('mc_sup_err_pick'), 'error'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('user_supplements').insert({
      fighter_profile_id: profile.id,
      supplement_id: picked?.id || null,
      custom_name: picked ? null : customName.trim(),
      time_of_day: time || null,
    }).select().maybeSingle();
    setSaving(false);
    if (error || !data) { showToast(t('error_save'), 'error'); return; }
    setItems((prev) => [...prev, data as UserSupplement]);
    setShowPicker(false);
    resetForm();
    showToast(t('mc_sup_saved'));
  };

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setConfirmDelete(null);
    const { error } = await supabase.from('user_supplements').delete().eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); load(); }
  };

  const fmtTime = (t24: string | null) => {
    if (!t24) return null;
    const [h, m] = t24.split(':');
    const d = new Date(); d.setHours(parseInt(h, 10), parseInt(m, 10));
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }
  if (unavailable) {
    return (
      <div className="rk-card text-center" style={{ padding: '40px 24px' }}>
        <i className="ri-capsule-line text-3xl text-zinc-600"></i>
        <p className="text-sm text-zinc-300 font-medium mt-3">{t('mc_coming_soon_title')}</p>
        <p className="text-xs text-zinc-500 mt-1">{t('mc_coming_soon_desc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="rk-eyebrow">{t('mc_sup_eyebrow')}</p>
        <h2 className="rk-h3" style={{ fontSize: '1.25rem', color: '#fff', margin: '4px 0 0' }}>{t('mc_sup_title')}</h2>
        <p className="rk-body-14 mt-1">{t('mc_sup_sub')}</p>
      </header>

      <div className="rk-card" style={{ padding: '18px 20px' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-white">{t('mc_sup_my_list')}</p>
          <button onClick={openPicker} className="rk-btn rk-btn-ghost flex items-center gap-1.5" style={{ fontSize: '0.78rem', padding: '0.5rem 1rem' }}>
            <i className="ri-add-line"></i> {t('mc_sup_add')}
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-6">{t('mc_sup_empty')}</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5">
                <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/25 text-[#C9A84C]">
                  <i className="ri-capsule-line"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{displayName(item)}</p>
                  {fmtTime(item.time_of_day) && <p className="text-[11px] text-zinc-500">{fmtTime(item.time_of_day)}</p>}
                </div>
                {confirmDelete === item.id ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => remove(item.id)} className="text-[11px] font-bold text-red-300 bg-red-600/12 border border-red-500/35 rounded-lg px-2.5 py-1.5 cursor-pointer">{t('mc_delete')}</button>
                    <button onClick={() => setConfirmDelete(null)} className="text-[11px] text-zinc-400 px-1.5 cursor-pointer">{t('mc_cancel')}</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(item.id)} aria-label={t('mc_delete')} className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer transition-colors">
                    <i className="ri-delete-bin-line text-sm"></i>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5">
        <i className="ri-information-line mt-0.5 flex-shrink-0"></i>{t('mc_sup_disclaimer')}
      </p>

      <BottomSheet
        open={showPicker}
        onClose={() => setShowPicker(false)}
        title={picked || customName ? t('mc_sup_when') : t('mc_sup_picker_title')}
        footer={(picked || customName.trim()) ? (
          <button onClick={save} disabled={saving} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.9rem', minHeight: 44 }}>
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><i className="ri-check-line"></i> {t('mc_sup_save')}</>}
          </button>
        ) : undefined}
      >
        {!picked && !customName ? (
          <div className="space-y-4">
            <input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus placeholder={t('mc_sup_search_ph')}
              style={{ fontSize: 16, minHeight: 44 }}
              className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />

            {query.trim() && !catalog.some((c) => c.name.toLowerCase() === query.trim().toLowerCase()) && (
              <button onClick={() => setCustomName(query.trim())}
                className="w-full flex items-center gap-2 text-left px-3.5 py-2.5 rounded-xl border border-dashed border-white/15 text-sm text-zinc-300 hover:border-white/30 cursor-pointer">
                <i className="ri-add-line text-[#C9A84C]"></i> {t('mc_sup_add_custom', { name: query.trim() })}
              </button>
            )}

            <div className="space-y-5 max-h-[50vh] overflow-y-auto">
              {grouped.map((g) => (
                <div key={g.cat}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-1.5">{t(CATEGORY_LABEL[g.cat])}</p>
                  <div className="space-y-1">
                    {g.items.map((c) => (
                      <button key={c.id} onClick={() => setPicked(c)}
                        className="w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-xl hover:bg-white/[0.05] transition-colors cursor-pointer">
                        <span className="text-sm text-zinc-200">{c.name}</span>
                        {c.description && <span className="text-[11px] text-zinc-600 truncate ml-2">{c.description}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <i className="ri-capsule-line text-[#C9A84C]"></i>
              <span className="text-sm font-semibold text-white">{picked?.name || customName}</span>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">{t('mc_sup_time')}</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                style={{ fontSize: 16, minHeight: 44 }}
                className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer [color-scheme:dark]" />
            </div>
            <button onClick={() => { setPicked(null); setCustomName(''); }} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 cursor-pointer">
              <i className="ri-arrow-left-line"></i> {t('mc_sup_back')}
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
