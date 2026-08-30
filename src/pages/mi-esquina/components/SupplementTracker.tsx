import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable, isMissingColumn } from '@/lib/dbState';
import BottomSheet from '@/components/base/BottomSheet';

// Nutrición · nivel 2 · Suplementos (PROMPT 1 · parte B).
// Biblioteca de suplementos comunes con función explicada en lenguaje llano
// + "añadir a mi rutina" con franja horaria. La fuente de verdad de "mi
// rutina" es user_supplements (recurrente); el recordatorio ya lo muestra
// TodaySupplements en Agenda. Disclaimer fijo, siempre visible.

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface CommonSupplement {
  id: string; name: string; category: string;
  description: string | null; benefits: string[] | null; timing: string | null;
}
interface UserSupplement {
  id: string; supplement_id: string | null; custom_name: string | null;
  time_of_day: string | null; slot: string | null;
}

// 8 categorías del enum (mig 0041) → 4 grupos para el filtro.
const GROUP_OF: Record<string, string> = {
  creatine: 'rendimiento', preworkout: 'rendimiento',
  protein: 'recuperacion', amino: 'recuperacion',
  vitamin: 'salud', mineral: 'salud', omega: 'salud',
  other: 'otro',
};
const GROUPS = ['rendimiento', 'recuperacion', 'salud', 'otro'] as const;

const SLOTS = [
  { id: 'manana', labelKey: 'mc_sup_slot_manana', time: '08:00', icon: 'ri-sun-line' },
  { id: 'con_comidas', labelKey: 'mc_sup_slot_meals', time: '14:00', icon: 'ri-restaurant-2-line' },
  { id: 'post_entreno', labelKey: 'mc_sup_slot_post', time: '18:00', icon: 'ri-flashlight-line' },
  { id: 'antes_dormir', labelKey: 'mc_sup_slot_sleep', time: '22:30', icon: 'ri-moon-line' },
  { id: 'otro', labelKey: 'mc_sup_slot_other', time: '', icon: 'ri-time-line' },
];
const slotCfg = (id: string | null) => SLOTS.find((s) => s.id === id);

type SheetMode = { kind: 'ficha'; sup: CommonSupplement }
  | { kind: 'slot'; sup: CommonSupplement; editing?: UserSupplement }
  | null;

export default function SupplementTracker({ profile, showToast }: Props) {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<CommonSupplement[]>([]);
  const [items, setItems] = useState<UserSupplement[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<'all' | typeof GROUPS[number]>('all');
  const [sheet, setSheet] = useState<SheetMode>(null);
  const [slotChoice, setSlotChoice] = useState('manana');
  const [customTime, setCustomTime] = useState('09:00');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cat }, { data: rows, error }] = await Promise.all([
      supabase.from('common_supplements').select('*').order('name', { ascending: true }),
      supabase.from('user_supplements').select('*').eq('fighter_profile_id', profile.id),
    ]);
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    setCatalog((cat || []).map((c) => ({
      ...c,
      benefits: Array.isArray((c as { benefits?: unknown }).benefits) ? (c as { benefits: string[] }).benefits : null,
      timing: (c as { timing?: string | null }).timing ?? null,
    })) as CommonSupplement[]);
    setItems((rows || []).map((r) => ({ ...r, slot: (r as { slot?: string | null }).slot ?? null })) as UserSupplement[]);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const catalogById = useMemo(() => {
    const m = new Map<string, CommonSupplement>();
    catalog.forEach((c) => m.set(c.id, c));
    return m;
  }, [catalog]);

  const nameOf = (item: UserSupplement) => item.custom_name || catalogById.get(item.supplement_id || '')?.name || '—';
  const addedIds = useMemo(() => new Set(items.map((i) => i.supplement_id).filter(Boolean)), [items]);

  const sortedMine = useMemo(
    () => [...items].sort((a, b) => (a.time_of_day || '99:99').localeCompare(b.time_of_day || '99:99')),
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((c) => {
      if (group !== 'all' && GROUP_OF[c.category] !== group) return false;
      if (q && !c.name.toLowerCase().includes(q) && !(c.description || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [catalog, query, group]);

  // ── Añadir / editar franja ──
  const openFicha = (sup: CommonSupplement) => setSheet({ kind: 'ficha', sup });
  const goSlot = (sup: CommonSupplement, editing?: UserSupplement) => {
    setSlotChoice(editing?.slot || 'manana');
    if (editing?.slot === 'otro' && editing.time_of_day) setCustomTime(editing.time_of_day.slice(0, 5));
    setSheet({ kind: 'slot', sup, editing });
  };

  const saveSlot = async () => {
    if (!sheet || sheet.kind !== 'slot') return;
    setSaving(true);
    const cfg = slotCfg(slotChoice);
    const time_of_day = slotChoice === 'otro' ? (customTime || null) : (cfg?.time || null);
    const editing = sheet.editing;

    if (editing) {
      let res = await supabase.from('user_supplements')
        .update({ slot: slotChoice, time_of_day }).eq('id', editing.id).select().maybeSingle();
      if (isMissingColumn(res.error)) {
        res = await supabase.from('user_supplements')
          .update({ time_of_day }).eq('id', editing.id).select().maybeSingle();
      }
      setSaving(false);
      if (res.error || !res.data) { showToast(t('error_save'), 'error'); return; }
      setItems((prev) => prev.map((x) => (x.id === editing.id ? { ...(res.data as UserSupplement), slot: (res.data as { slot?: string }).slot ?? slotChoice } : x)));
      setSheet(null);
      showToast(t('mc_sup_slot_updated'));
      return;
    }

    let res = await supabase.from('user_supplements').insert({
      fighter_profile_id: profile.id,
      supplement_id: sheet.sup.id,
      custom_name: null,
      slot: slotChoice,
      time_of_day,
    }).select().maybeSingle();
    if (isMissingColumn(res.error)) {
      res = await supabase.from('user_supplements').insert({
        fighter_profile_id: profile.id, supplement_id: sheet.sup.id, custom_name: null, time_of_day,
      }).select().maybeSingle();
    }
    setSaving(false);
    if (res.error || !res.data) { showToast(t('error_save'), 'error'); return; }
    setItems((prev) => [...prev, { ...(res.data as UserSupplement), slot: (res.data as { slot?: string }).slot ?? slotChoice }]);
    setSheet(null);
    showToast(t('mc_sup_added_toast', { slot: t(slotCfg(slotChoice)?.labelKey || 'mc_sup_slot_manana').toLowerCase() }));
  };

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setConfirmDelete(null);
    const { error } = await supabase.from('user_supplements').delete().eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); load(); }
  };

  const slotLabel = (item: UserSupplement) => {
    if (item.slot) {
      const c = slotCfg(item.slot);
      if (item.slot === 'otro' && item.time_of_day) return `${t('mc_sup_slot_other')} · ${item.time_of_day.slice(0, 5)}`;
      return c ? t(c.labelKey) : item.slot;
    }
    return item.time_of_day ? item.time_of_day.slice(0, 5) : t('mc_sup_no_time');
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (unavailable) {
    return (
      <div className="rk-card text-center" style={{ padding: '40px 24px' }}>
        <i className="ri-capsule-line text-3xl text-zinc-600" />
        <p className="text-sm text-zinc-300 font-medium mt-3">{t('mc_coming_soon_title')}</p>
        <p className="text-xs text-zinc-500 mt-1">{t('mc_coming_soon_desc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="rk-eyebrow">{t('mc_sup_eyebrow')}</p>
        <h2 className="rk-h3" style={{ fontSize: '1.25rem', color: '#fff', margin: '4px 0 0' }}>{t('mc_sup_title')}</h2>
        <p className="rk-body-14 mt-1">{t('mc_sup_sub')}</p>
      </header>

      {/* ── Mis suplementos ── */}
      <div className="rk-card" style={{ padding: '18px 20px' }}>
        <p className="text-sm font-bold text-white mb-3">{t('mc_sup_my_list')}</p>
        {sortedMine.length === 0 ? (
          <p className="text-xs text-zinc-500 py-3">{t('mc_sup_empty')}</p>
        ) : (
          <div className="space-y-2">
            {sortedMine.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5">
                <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/25 text-[#C9A84C]">
                  <i className={slotCfg(item.slot)?.icon || 'ri-capsule-line'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{nameOf(item)}</p>
                  <p className="text-[11px] text-zinc-500">{slotLabel(item)}</p>
                </div>
                {confirmDelete === item.id ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => remove(item.id)} className="text-[11px] font-bold text-red-300 bg-red-600/12 border border-red-500/35 rounded-lg px-2.5 py-1.5 cursor-pointer">{t('mc_delete')}</button>
                    <button onClick={() => setConfirmDelete(null)} className="text-[11px] text-zinc-400 px-1.5 cursor-pointer">{t('mc_cancel')}</button>
                  </div>
                ) : (
                  <div className="flex items-center flex-shrink-0">
                    {item.supplement_id && catalogById.get(item.supplement_id) && (
                      <button onClick={() => goSlot(catalogById.get(item.supplement_id!)!, item)} aria-label={t('mc_sup_change_slot')}
                        className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-white cursor-pointer">
                        <i className="ri-pencil-line text-sm" />
                      </button>
                    )}
                    <button onClick={() => setConfirmDelete(item.id)} aria-label={t('mc_delete')}
                      className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer">
                      <i className="ri-delete-bin-line text-sm" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Biblioteca ── */}
      <div>
        <p className="rk-label mb-3">{t('mc_sup_library')}</p>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('mc_sup_search_ph')}
          style={{ fontSize: 16, minHeight: 44 }}
          className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 mb-3" />
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 rk-noscroll-x">
          <button onClick={() => setGroup('all')}
            className={`rk-nav-btn text-xs font-bold whitespace-nowrap ${group === 'all' ? 'is-active' : ''}`} style={{ padding: '0.4rem 0.9rem' }}>
            {t('mc_sup_grp_all')}
          </button>
          {GROUPS.map((g) => (
            <button key={g} onClick={() => setGroup(g)}
              className={`rk-nav-btn text-xs font-bold whitespace-nowrap ${group === g ? 'is-active' : ''}`} style={{ padding: '0.4rem 0.9rem' }}>
              {t(`mc_sup_grp_${g}`)}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-zinc-500 py-6 text-center">{t('mc_sup_none')}</p>
        ) : (
          <div className="rk-stack">
            {filtered.map((c) => (
              <button key={c.id} onClick={() => openFicha(c)}
                className="rk-card w-full text-left flex items-center gap-3 cursor-pointer" style={{ padding: '13px 16px' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{c.name}</p>
                  <p className="text-[11px] text-zinc-500">{t(`mc_sup_grp_${GROUP_OF[c.category] || 'otro'}`)}</p>
                  {c.description && <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{c.description}</p>}
                </div>
                {addedIds.has(c.id)
                  ? <span className="text-[10px] font-bold uppercase tracking-wider text-green-400 flex-shrink-0"><i className="ri-check-line" /></span>
                  : <i className="ri-arrow-right-s-line text-zinc-600 flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5">
        <i className="ri-information-line mt-0.5 flex-shrink-0" />{t('mc_sup_disclaimer')}
      </p>

      {/* ── Ficha / franja ── */}
      <BottomSheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        title={sheet?.kind === 'slot' ? t('mc_sup_when') : sheet?.sup.name}
        footer={
          sheet?.kind === 'ficha' ? (
            <button onClick={() => goSlot(sheet.sup)} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2" style={{ fontSize: '0.9rem', minHeight: 44 }}>
              <i className="ri-add-line" />{t('mc_sup_add_routine')}
            </button>
          ) : sheet?.kind === 'slot' ? (
            <button onClick={saveSlot} disabled={saving} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.9rem', minHeight: 44 }}>
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><i className="ri-check-line" />{sheet.editing ? t('mc_sup_save_slot') : t('mc_sup_save')}</>}
            </button>
          ) : undefined
        }
      >
        {sheet?.kind === 'ficha' && (
          <div className="space-y-4">
            {sheet.sup.description && <p className="text-sm text-zinc-300 leading-relaxed">{sheet.sup.description}</p>}
            {sheet.sup.benefits && sheet.sup.benefits.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-green-400 mb-1.5">{t('mc_sup_benefits')}</p>
                <ul className="space-y-1">
                  {sheet.sup.benefits.map((b, i) => (
                    <li key={i} className="text-xs text-zinc-300 leading-relaxed flex items-start gap-1.5">
                      <span className="text-green-500 mt-0.5">·</span>{b}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {sheet.sup.timing && (
              <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
                <i className="ri-time-line text-[#C9A84C] mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t('mc_sup_timing')}</p>
                  <p className="text-xs text-zinc-300 mt-0.5">{sheet.sup.timing}</p>
                </div>
              </div>
            )}
            <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5">
              <i className="ri-information-line mt-0.5 flex-shrink-0" />{t('mc_sup_disclaimer')}
            </p>
          </div>
        )}

        {sheet?.kind === 'slot' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <i className="ri-capsule-line text-[#C9A84C]" />
              <span className="text-sm font-semibold text-white">{sheet.sup.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SLOTS.map((s) => (
                <button key={s.id} onClick={() => setSlotChoice(s.id)} style={{ minHeight: 46 }}
                  className={`flex items-center gap-2 px-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${slotChoice === s.id ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/12 text-zinc-300 hover:border-white/30'}`}>
                  <i className={s.icon} />{t(s.labelKey)}
                </button>
              ))}
            </div>
            {slotChoice === 'otro' && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_sup_time')}</label>
                <input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)}
                  style={{ fontSize: 16, minHeight: 44 }}
                  className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer [color-scheme:dark]" />
              </div>
            )}
            <p className="text-[11px] text-zinc-500">{t('mc_sup_reminder_hint')}</p>
          </div>
        )}
      </BottomSheet>

      <style>{`.rk-noscroll-x::-webkit-scrollbar{display:none}.rk-noscroll-x{scrollbar-width:none}`}</style>
    </div>
  );
}
