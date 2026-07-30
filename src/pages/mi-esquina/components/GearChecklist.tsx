import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import Reveal from '@/components/base/Reveal';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface GearItem {
  id: string;
  name: string;
  condition: 'good' | 'replace';
  acquired_at: string | null;
  lifespan_months: number | null;
}

// Equipo esencial recomendado, con su vida útil orientativa (meses).
// El 'name' se guarda tal cual en la BD (compatibilidad con datos previos);
// la etiqueta visible sale de i18n con labelKey.
const ESSENTIALS: { name: string; labelKey: string; icon: string; months: number }[] = [
  { name: 'Guantes', labelKey: 'mc_gk_gloves', icon: 'ri-boxing-line', months: 18 },
  { name: 'Vendas', labelKey: 'mc_gk_wraps', icon: 'ri-hand-heart-line', months: 6 },
  { name: 'Bucal', labelKey: 'mc_gk_mouthguard', icon: 'ri-emotion-normal-line', months: 12 },
  { name: 'Casco', labelKey: 'mc_gk_headgear', icon: 'ri-shield-line', months: 24 },
  { name: 'Espinilleras', labelKey: 'mc_gk_shinguards', icon: 'ri-footprint-line', months: 24 },
  { name: 'Coquilla', labelKey: 'mc_gk_groin', icon: 'ri-shield-check-line', months: 36 },
  { name: 'Comba', labelKey: 'mc_gk_rope', icon: 'ri-loop-left-line', months: 12 },
  { name: 'Bolsa de deporte', labelKey: 'mc_gk_bag', icon: 'ri-briefcase-line', months: 36 },
];
const DEFAULT_MONTHS = 18;
const LIFESPAN_OPTIONS = [3, 6, 12, 18, 24, 36];
// Con cuántos días de antelación avisamos de que un material va a "caducar".
const WARN_DAYS = 30;

const essentialFor = (name: string) => ESSENTIALS.find((e) => e.name.toLowerCase() === name.toLowerCase());
const defaultMonthsFor = (name: string) => essentialFor(name)?.months ?? DEFAULT_MONTHS;

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || code === 'PGRST200' || msg.includes('does not exist') || msg.includes('could not find the table');
}
// Columnas nuevas (migración 0018) aún sin aplicar.
function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();
  return code === '42703' || code === 'PGRST204' || (msg.includes('column') && (msg.includes('does not exist') || msg.includes('could not find')));
}

export type GearRepState = 'overdue' | 'due_soon' | 'ok' | 'untracked';

/** Fecha de reemplazo = compra + vida útil (meses). */
export function gearDueDate(item: Pick<GearItem, 'acquired_at' | 'lifespan_months'>): Date | null {
  if (!item.acquired_at) return null;
  const months = item.lifespan_months ?? DEFAULT_MONTHS;
  const d = new Date(item.acquired_at + 'T12:00:00');
  d.setMonth(d.getMonth() + months);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function gearDaysUntil(item: Pick<GearItem, 'acquired_at' | 'lifespan_months'>): number | null {
  const due = gearDueDate(item);
  if (!due) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / 86400000);
}

export function gearRepState(item: Pick<GearItem, 'acquired_at' | 'lifespan_months'>): GearRepState {
  const days = gearDaysUntil(item);
  if (days === null) return 'untracked';
  if (days < 0) return 'overdue';
  if (days <= WARN_DAYS) return 'due_soon';
  return 'ok';
}

/** Necesita atención: marcado a mano como gastado, o vencido/por vencer por antigüedad. */
function needsAttention(item: GearItem): boolean {
  if (item.condition === 'replace') return true;
  const s = gearRepState(item);
  return s === 'overdue' || s === 'due_soon';
}

/**
 * Aviso para el resumen: aparece SOLO si hay material marcado como gastado o
 * que toca renovar por antigüedad. Si no hay nada (o la tabla no existe), no
 * renderiza nada.
 */
export function GearReplacementAlert({ profile, onOpen }: { profile: Profile; onOpen: () => void }) {
  const { t } = useTranslation();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('gear_items')
        .select('*')
        .eq('fighter_profile_id', profile.id);
      if (!alive || error || !data) return;
      const n = (data as GearItem[]).filter(needsAttention).length;
      if (n > 0) setCount(n);
    })();
    return () => { alive = false; };
  }, [profile.id]);

  if (count === 0) return null;

  return (
    <button onClick={onOpen}
      className="w-full flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors cursor-pointer bg-orange-500/10 border-orange-500/35 hover:bg-orange-500/15"
      style={{ minHeight: 44 }}>
      <i className="ri-alarm-warning-line text-xl flex-shrink-0 text-orange-400"></i>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-orange-300">{t('mc_gk_alert', { count })}</span>
        <span className="block text-[11px] text-zinc-400 mt-0.5">{t('mc_gk_alert_cta')}</span>
      </span>
      <i className="ri-arrow-right-s-line text-zinc-500 flex-shrink-0"></i>
    </button>
  );
}

export default function GearChecklist({ profile, showToast }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const [items, setItems] = useState<GearItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  // Si la migración 0018 aún no está, ocultamos lo de la vida útil.
  const [lifespanReady, setLifespanReady] = useState(true);
  const [customName, setCustomName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<GearItem | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('gear_items')
      .select('*')
      .eq('fighter_profile_id', profile.id)
      .order('created_at', { ascending: true });
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    setItems(((data as GearItem[]) || []).map((it) => ({
      ...it,
      acquired_at: it.acquired_at ?? null,
      lifespan_months: it.lifespan_months ?? null,
    })));
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const byName = useMemo(() => {
    const m = new Map<string, GearItem>();
    items.forEach((it) => m.set(it.name.toLowerCase(), it));
    return m;
  }, [items]);

  // Inserta una pieza. Empieza a contar su vida útil desde hoy, para que el
  // recordatorio funcione sin pasos extra. Si la migración 0018 no está,
  // reintenta sin las columnas nuevas y desactiva la parte de vida útil.
  const insertItem = async (name: string): Promise<GearItem | null> => {
    const full = {
      fighter_profile_id: profile.id, name, condition: 'good' as const,
      acquired_at: todayISO(), lifespan_months: defaultMonthsFor(name),
    };
    let res = await supabase.from('gear_items').insert(full).select('*').maybeSingle();
    if (res.error && isMissingColumn(res.error)) {
      setLifespanReady(false);
      res = await supabase.from('gear_items')
        .insert({ fighter_profile_id: profile.id, name, condition: 'good' })
        .select('*').maybeSingle();
    }
    if (res.error || !res.data) return null;
    const row = res.data as GearItem;
    return { ...row, acquired_at: row.acquired_at ?? null, lifespan_months: row.lifespan_months ?? null };
  };

  const toggleOwned = async (name: string) => {
    if (busy) return;
    setBusy(true);
    const existing = byName.get(name.toLowerCase());
    if (existing) {
      const { error } = await supabase.from('gear_items').delete().eq('id', existing.id);
      if (error) showToast(t('mc_gk_err_update'), 'error');
      else setItems((prev) => prev.filter((i) => i.id !== existing.id));
    } else {
      const row = await insertItem(name);
      if (!row) showToast(t('mc_gk_err_save'), 'error');
      else setItems((prev) => [...prev, row]);
    }
    setBusy(false);
  };

  const toggleCondition = async (item: GearItem) => {
    const next = item.condition === 'good' ? 'replace' : 'good';
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, condition: next } : i));
    const { error } = await supabase.from('gear_items').update({ condition: next }).eq('id', item.id);
    if (error) { showToast(t('mc_gk_err_update'), 'error'); load(); }
  };

  const addCustom = async () => {
    const name = customName.trim();
    if (!name || busy) return;
    if (byName.has(name.toLowerCase())) { showToast(t('mc_gk_err_dup'), 'error'); return; }
    setBusy(true);
    const row = await insertItem(name);
    if (!row) showToast(t('mc_gk_err_add'), 'error');
    else { setItems((prev) => [...prev, row]); setCustomName(''); showToast(t('mc_gk_added')); }
    setBusy(false);
  };

  const removeItem = async (item: GearItem) => {
    const { error } = await supabase.from('gear_items').delete().eq('id', item.id);
    if (error) showToast(t('mc_gk_err_delete'), 'error');
    else setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  // Guarda fecha de compra + vida útil (o las limpia para quitar el aviso).
  const saveReminder = async (item: GearItem, acquired: string | null, months: number) => {
    const patch = { acquired_at: acquired, lifespan_months: acquired ? months : null };
    const prev = items;
    setItems((p) => p.map((i) => i.id === item.id ? { ...i, ...patch } : i));
    setEditing(null);
    const { error } = await supabase.from('gear_items').update(patch).eq('id', item.id);
    if (error) {
      if (isMissingColumn(error)) setLifespanReady(false);
      showToast(t('mc_gk_err_update'), 'error');
      setItems(prev);
    } else {
      showToast(t('mc_gk_saved'));
    }
  };

  const ownedEssentials = ESSENTIALS.filter((e) => byName.has(e.name.toLowerCase())).length;
  const pct = Math.round((ownedEssentials / ESSENTIALS.length) * 100);
  const customItems = items.filter((it) => !essentialFor(it.name));
  const attention = items.filter(needsAttention);
  const orderedOwned = [
    ...ESSENTIALS.filter((e) => byName.has(e.name.toLowerCase())).map((e) => byName.get(e.name.toLowerCase())!),
    ...customItems,
  ];

  const displayName = (item: GearItem) => {
    const e = essentialFor(item.name);
    return e ? t(e.labelKey) : item.name;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
          <i className="ri-boxing-line text-3xl text-red-400"></i>
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.3rem', color: '#fff' }}>{t('mc_gk_coming_title')}</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{t('mc_gk_coming_desc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="rk-eyebrow">{t('mc_gk_eyebrow')}</p>
        <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
          {t('mc_gk_title')} <span className="rk-red-glow">{t('mc_gk_title_2')}</span>
        </h2>
        <p className="text-zinc-400 text-sm mt-1.5 max-w-md">{t('mc_gk_sub')}</p>
      </div>

      {/* Progreso */}
      <Reveal>
        <div className="rk-card" style={{ padding: '20px 22px' }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>{t('mc_gk_essential')}</h3>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: pct === 100 ? '#4ade80' : '#fff' }}>{ownedEssentials}<span className="text-zinc-600">/{ESSENTIALS.length}</span></span>
          </div>
          <div className="h-2.5 rounded-full bg-white/[0.05] overflow-hidden mb-4">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct === 100 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : 'linear-gradient(90deg,#E10600,#ff4020)' }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {ESSENTIALS.map((e) => {
              const owned = byName.get(e.name.toLowerCase());
              return (
                <button key={e.name} onClick={() => toggleOwned(e.name)}
                  className={`relative flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-xl border transition-all cursor-pointer ${owned ? 'bg-red-600/12 border-red-500/30 text-white' : 'bg-white/[0.02] border-white/10 text-zinc-500 hover:border-white/25'}`}
                  style={{ minHeight: 44 }}>
                  {owned && <i className="ri-checkbox-circle-fill absolute top-1.5 right-1.5 text-red-400 text-sm"></i>}
                  <i className={`${e.icon} text-xl ${owned ? 'text-red-400' : ''}`}></i>
                  <span className="text-[11px] font-semibold text-center leading-tight">{t(e.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* Aviso de reemplazo (gastado o vencido por antigüedad) */}
      {attention.length > 0 && (
        <Reveal>
          <div className="rk-card" style={{ padding: '16px 20px', borderColor: 'rgba(251,146,60,0.3)' }}>
            <div className="flex items-start gap-3">
              <i className="ri-alarm-warning-line text-orange-400 text-lg mt-0.5 flex-shrink-0"></i>
              <div className="min-w-0">
                <p className="text-sm font-bold text-orange-300">{t('mc_gk_replace_title')}</p>
                <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                  {t('mc_gk_replace_desc', { list: attention.map(displayName).join(', ') })}
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      )}

      {/* Estado del equipo que tengo */}
      {items.length > 0 && (
        <Reveal delay={80}>
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">{t('mc_gk_my_gear')}</h3>
            <div className="space-y-2">
              {orderedOwned.map((item) => {
                const state = gearRepState(item);
                const days = gearDaysUntil(item);
                const repChip = state === 'overdue'
                  ? { text: t('mc_gk_st_overdue'), cls: 'text-red-300 bg-red-600/12 border-red-500/35', icon: 'ri-error-warning-line' }
                  : state === 'due_soon'
                    ? { text: days === 0 ? t('mc_gk_st_today') : t('mc_gk_st_due', { count: days ?? 0 }), cls: 'text-orange-300 bg-orange-500/12 border-orange-500/35', icon: 'ri-time-line' }
                    : state === 'ok'
                      ? { text: t('mc_gk_st_ok', { count: Math.round((days ?? 0) / 30) }), cls: 'text-green-300 bg-green-500/10 border-green-500/30', icon: 'ri-checkbox-circle-line' }
                      : null;
                return (
                  <div key={item.id} className="rk-card group" style={{ padding: '12px 16px' }}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 border ${item.condition === 'replace' ? 'bg-orange-500/10 border-orange-500/25 text-orange-400' : 'bg-green-500/10 border-green-500/25 text-green-400'}`}>
                        <i className={item.condition === 'replace' ? 'ri-error-warning-line' : 'ri-checkbox-circle-line'}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{displayName(item)}</p>
                        {lifespanReady && repChip && (
                          <span className={`inline-flex items-center gap-1 mt-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${repChip.cls}`}>
                            <i className={repChip.icon}></i>{repChip.text}
                          </span>
                        )}
                      </div>
                      <button onClick={() => toggleCondition(item)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors cursor-pointer whitespace-nowrap ${item.condition === 'replace' ? 'bg-orange-500/12 border-orange-500/30 text-orange-400' : 'bg-white/[0.04] border-white/12 text-zinc-400 hover:text-white'}`}>
                        {item.condition === 'replace' ? t('mc_gk_worn') : t('mc_gk_good')}
                      </button>
                      {lifespanReady && (
                        <button onClick={() => setEditing(item)} aria-label={t('mc_gk_reminder_edit')}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-[#C9A84C] cursor-pointer flex-shrink-0 transition-colors">
                          <i className={item.acquired_at ? 'ri-notification-3-line' : 'ri-notification-off-line'}></i>
                        </button>
                      )}
                      <button onClick={() => removeItem(item)} aria-label={t('mc_gk_remove')}
                        className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <i className="ri-delete-bin-line text-sm"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      )}

      {/* Añadir material propio */}
      <div className="flex gap-2">
        <input value={customName} onChange={(e) => setCustomName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addCustom(); }}
          className="flex-1 bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
          placeholder={t('mc_gk_add_ph')} />
        <button onClick={addCustom} disabled={busy || !customName.trim()} className="rk-btn rk-btn-ghost flex items-center gap-1.5 disabled:opacity-50" style={{ fontSize: '0.8rem', padding: '0 1.2rem' }} aria-label={t('mc_gk_add')}>
          <i className="ri-add-line"></i>
        </button>
      </div>

      {lifespanReady && (
        <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5">
          <i className="ri-information-line mt-0.5 flex-shrink-0"></i>{t('mc_gk_reminder_hint')}
        </p>
      )}

      {/* Modal de recordatorio */}
      {editing && (
        <ReminderModal
          item={editing}
          label={displayName(editing)}
          locale={locale}
          onClose={() => setEditing(null)}
          onSave={saveReminder}
        />
      )}
    </div>
  );
}

// ── Modal: desde cuándo tengo la pieza + cada cuánto recordar ──
function ReminderModal({ item, label, locale, onClose, onSave }: {
  item: GearItem;
  label: string;
  locale: string;
  onClose: () => void;
  onSave: (item: GearItem, acquired: string | null, months: number) => void;
}) {
  const { t } = useTranslation();
  const [acquired, setAcquired] = useState(item.acquired_at || todayISO());
  const [months, setMonths] = useState(item.lifespan_months ?? defaultMonthsFor(item.name));

  const due = gearDueDate({ acquired_at: acquired, lifespan_months: months });
  const dueNice = due ? due.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
      <div className="relative rk-card w-full max-w-sm max-h-[90vh] overflow-y-auto" style={{ padding: 24, transform: 'none' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="rk-h3" style={{ fontSize: '1.1rem', color: '#fff' }}>{t('mc_gk_reminder_title', { name: label })}</h3>
          <button onClick={onClose} aria-label={t('mc_gk_cancel')}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer transition-colors">
            <i className="ri-close-line"></i>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_gk_since')}</label>
            <input type="date" value={acquired} max={todayISO()} onChange={(e) => setAcquired(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C] [color-scheme:dark]" />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_gk_remind_every')}</label>
            <div className="grid grid-cols-3 gap-2">
              {LIFESPAN_OPTIONS.map((m) => (
                <button key={m} onClick={() => setMonths(m)}
                  className={`text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${months === m ? 'bg-[#C9A84C] text-zinc-900 border-transparent' : 'bg-white/[0.03] text-zinc-300 border-white/10 hover:border-white/25'}`}
                  style={{ minHeight: 44 }}>
                  {t('mc_gk_months', { count: m })}
                </button>
              ))}
            </div>
          </div>

          {dueNice && (
            <p className="text-[11px] text-zinc-500 leading-relaxed flex items-start gap-1.5">
              <i className="ri-calendar-event-line mt-0.5 flex-shrink-0 text-[#C9A84C]"></i>
              <span>{t('mc_gk_due_on', { date: dueNice })}</span>
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={() => onSave(item, acquired, months)} className="rk-btn rk-btn-primary flex-1 flex items-center justify-center gap-2" style={{ fontSize: '0.9rem' }}>
              <i className="ri-check-line"></i> {t('mc_gk_save')}
            </button>
            {item.acquired_at && (
              <button onClick={() => onSave(item, null, months)} className="rk-btn rk-btn-ghost flex items-center gap-1.5" style={{ fontSize: '0.8rem', padding: '0 1rem' }}>
                {t('mc_gk_remove_reminder')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
