import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface Fight {
  id: string;
  fight_date: string | null;
  opponent: string | null;
  event_name: string | null;
  result: string | null;
  method: string | null;
  performance: number | null;
  what_worked: string | null;
  what_didnt: string | null;
  lessons: string | null;
  opponent_notes: string | null;
}

const RESULTS = [
  { value: 'win', key: 'mc_fa_result_win', color: '#22c55e', icon: 'ri-trophy-line' },
  { value: 'loss', key: 'mc_fa_result_loss', color: '#E10600', icon: 'ri-close-circle-line' },
  { value: 'draw', key: 'mc_fa_result_draw', color: '#C9A84C', icon: 'ri-scales-3-line' },
  { value: 'nc', key: 'mc_fa_result_nc', color: '#71717a', icon: 'ri-question-line' },
];
const resultCfg = (v: string | null) => RESULTS.find((r) => r.value === v);

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Análisis privado post-combate — SEPARADO del récord público a propósito.
 * El récord (victorias/derrotas) es la cara pública; esto es el cuaderno del
 * peleador: qué funcionó, qué falló, qué corregir y notas del rival para una
 * posible revancha. Nadie más lo ve, y sirve justo antes de la siguiente pelea.
 */
export default function FightAnalysis({ profile, showToast }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const [items, setItems] = useState<Fight[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(todayISO());
  const [opponent, setOpponent] = useState('');
  const [eventName, setEventName] = useState('');
  const [result, setResult] = useState('win');
  const [method, setMethod] = useState('');
  const [performance, setPerformance] = useState(3);
  const [worked, setWorked] = useState('');
  const [didnt, setDidnt] = useState('');
  const [lessons, setLessons] = useState('');
  const [oppNotes, setOppNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fight_analyses').select('*')
      .eq('fighter_profile_id', profile.id)
      .order('fight_date', { ascending: false, nullsFirst: false }).limit(60);
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    setItems((data || []) as Fight[]);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const reset = () => {
    setDate(todayISO()); setOpponent(''); setEventName(''); setResult('win');
    setMethod(''); setPerformance(3); setWorked(''); setDidnt(''); setLessons(''); setOppNotes('');
  };

  const create = async () => {
    setSaving(true);
    const { data, error } = await supabase.from('fight_analyses').insert({
      fighter_profile_id: profile.id,
      fight_date: date || null,
      opponent: opponent.trim() || null,
      event_name: eventName.trim() || null,
      result,
      method: method.trim() || null,
      performance,
      what_worked: worked.trim() || null,
      what_didnt: didnt.trim() || null,
      lessons: lessons.trim() || null,
      opponent_notes: oppNotes.trim() || null,
    }).select().maybeSingle();
    setSaving(false);
    if (error || !data) { showToast(t('error_save'), 'error'); return; }
    setItems((prev) => [data as Fight, ...prev].sort((a, b) => (b.fight_date || '').localeCompare(a.fight_date || '')));
    setShowForm(false);
    reset();
    showToast(t('mc_fa_saved'));
  };

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    const { error } = await supabase.from('fight_analyses').delete().eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); load(); }
  };

  // Lo que anotaste como "a corregir": la lista para repasar antes de volver a pelear.
  const toReview = useMemo(
    () => items.filter((x) => x.lessons && x.lessons.trim()).slice(0, 5),
    [items]
  );

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
          <i className="ri-sword-line text-3xl text-red-400"></i>
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.2rem', color: '#fff' }}>{t('mc_coming_soon_title')}</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{t('mc_coming_soon_desc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="rk-eyebrow">{t('mc_fa_eyebrow')}</p>
          <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
            {t('mc_fa_title')} <span className="rk-red-glow">{t('mc_fa_title_2')}</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-md">{t('mc_fa_subtitle')}</p>
        </div>
        <button onClick={() => { reset(); setShowForm(true); }} className="rk-btn rk-btn-primary flex items-center gap-2" style={{ fontSize: '0.85rem', padding: '0.7rem 1.4rem' }}>
          <i className="ri-add-line"></i> {t('mc_fa_new')}
        </button>
      </div>

      {/* Privado, separado del récord público */}
      <p className="text-[11px] text-zinc-500 flex items-start gap-1.5 -mt-2">
        <i className="ri-lock-line mt-0.5 flex-shrink-0"></i>
        {t('mc_fa_private_note')}
      </p>

      {/* A corregir antes de volver a pelear */}
      {toReview.length > 0 && (
        <div className="rk-card" style={{ padding: '18px 20px', borderColor: 'rgba(225,6,0,0.25)', transform: 'none' }}>
          <div className="flex items-center gap-2 mb-2.5">
            <i className="ri-focus-2-line text-red-400"></i>
            <p className="text-sm font-bold text-white">{t('mc_fa_review_title')}</p>
          </div>
          <p className="text-xs text-zinc-500 mb-3">{t('mc_fa_review_desc')}</p>
          <ul className="space-y-1.5">
            {toReview.map((x) => (
              <li key={x.id} className="flex items-start gap-2 text-xs text-zinc-300 leading-relaxed">
                <i className="ri-arrow-right-s-line text-red-400 mt-0.5 flex-shrink-0"></i>
                <span>{x.lessons}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rk-card text-center" style={{ padding: '48px 28px' }}>
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-white/[0.04] border border-white/10">
            <i className="ri-sword-line text-3xl text-zinc-600"></i>
          </div>
          <p className="text-white font-bold">{t('mc_fa_empty')}</p>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-sm mx-auto leading-relaxed">{t('mc_fa_empty_desc')}</p>
          <button onClick={() => { reset(); setShowForm(true); }} className="rk-btn rk-btn-primary mt-6" style={{ fontSize: '0.85rem', padding: '0.7rem 1.6rem' }}>
            {t('mc_fa_new')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((x) => {
            const rc = resultCfg(x.result);
            const blocks: { label: string; text: string; color: string }[] = [];
            if (x.what_worked) blocks.push({ label: t('mc_fa_worked'), text: x.what_worked, color: '#22c55e' });
            if (x.what_didnt) blocks.push({ label: t('mc_fa_didnt'), text: x.what_didnt, color: '#fb923c' });
            if (x.lessons) blocks.push({ label: t('mc_fa_lessons'), text: x.lessons, color: '#E10600' });
            if (x.opponent_notes) blocks.push({ label: t('mc_fa_opp_notes'), text: x.opponent_notes, color: '#38bdf8' });
            return (
              <div key={x.id} className="rk-card group" style={{ padding: '18px 20px' }}>
                <div className="flex items-start gap-4">
                  {rc && (
                    <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl border"
                      style={{ background: `${rc.color}18`, borderColor: `${rc.color}44`, color: rc.color }}>
                      <i className={`${rc.icon} text-xl`}></i>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white">
                        {x.opponent ? `${t('mc_fa_vs')} ${x.opponent}` : t('mc_fa_no_opponent')}
                      </p>
                      {rc && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                          style={{ background: `${rc.color}18`, borderColor: `${rc.color}44`, color: rc.color }}>
                          {t(rc.key)}{x.method ? ` · ${x.method}` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {x.fight_date
                        ? new Date(x.fight_date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
                        : ''}
                      {x.event_name ? `${x.fight_date ? ' · ' : ''}${x.event_name}` : ''}
                      {x.performance ? ` · ${'★'.repeat(x.performance)}${'☆'.repeat(5 - x.performance)}` : ''}
                    </p>

                    {blocks.length > 0 && (
                      <div className="grid sm:grid-cols-2 gap-2 mt-3">
                        {blocks.map((b, i) => (
                          <div key={i} className="rounded-lg border px-3 py-2"
                            style={{ borderColor: `${b.color}33`, background: `${b.color}0f` }}>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: b.color }}>{b.label}</p>
                            <p className="text-xs text-zinc-300 leading-relaxed">{b.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => remove(x.id)} aria-label={t('mc_delete')}
                    className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 transition-colors cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal nuevo análisis */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
          <div className="relative rk-card w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl" style={{ padding: 24, transform: 'none' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="rk-h3" style={{ fontSize: '1.15rem', color: '#fff' }}>{t('mc_fa_new')}</h3>
              <button onClick={() => setShowForm(false)} aria-label={t('mc_close')}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer transition-colors">
                <i className="ri-close-line"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_fa_date')}</label>
                  <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">
                    {t('mc_fa_method')} <span className="text-zinc-600">({t('mc_optional')})</span>
                  </label>
                  <input value={method} onChange={(e) => setMethod(e.target.value)} maxLength={40} placeholder={t('mc_fa_method_ph')}
                    className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  {t('mc_fa_opponent')} <span className="text-zinc-600">({t('mc_optional')})</span>
                </label>
                <input value={opponent} onChange={(e) => setOpponent(e.target.value)} maxLength={60} placeholder={t('mc_fa_opponent_ph')}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  {t('mc_fa_event')} <span className="text-zinc-600">({t('mc_optional')})</span>
                </label>
                <input value={eventName} onChange={(e) => setEventName(e.target.value)} maxLength={80} placeholder={t('mc_fa_event_ph')}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-2">{t('mc_fa_result')}</label>
                <div className="grid grid-cols-4 gap-2">
                  {RESULTS.map((r) => (
                    <button key={r.value} onClick={() => setResult(r.value)}
                      className={`flex flex-col items-center gap-1 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${result === r.value ? 'text-white' : 'text-zinc-500 border-white/10 hover:border-white/20'}`}
                      style={{ minHeight: 56, padding: 6, ...(result === r.value ? { background: `${r.color}22`, borderColor: `${r.color}66`, color: r.color } : { background: 'rgba(255,255,255,0.02)' }) }}>
                      <i className={`${r.icon} text-base`}></i>{t(r.key)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-2">{t('mc_fa_performance')}</label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button key={v} onClick={() => setPerformance(v)} aria-label={`${v}/5`}
                      className={`flex-1 rounded-lg border text-lg transition-all cursor-pointer ${performance >= v ? 'bg-[#C9A84C]/20 border-[#C9A84C]/50 text-[#C9A84C]' : 'bg-white/[0.02] border-white/10 text-zinc-700'}`}
                      style={{ minHeight: 44 }}>
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-green-400 mb-1.5 font-semibold">{t('mc_fa_worked')}</label>
                <textarea value={worked} onChange={(e) => setWorked(e.target.value)} rows={2} maxLength={500} placeholder={t('mc_fa_worked_ph')}
                  className="w-full bg-white/[0.04] border border-green-500/20 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-green-500 resize-y" />
              </div>

              <div>
                <label className="block text-xs text-orange-400 mb-1.5 font-semibold">{t('mc_fa_didnt')}</label>
                <textarea value={didnt} onChange={(e) => setDidnt(e.target.value)} rows={2} maxLength={500} placeholder={t('mc_fa_didnt_ph')}
                  className="w-full bg-white/[0.04] border border-orange-500/20 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-orange-500 resize-y" />
              </div>

              <div>
                <label className="block text-xs text-red-400 mb-1.5 font-semibold">{t('mc_fa_lessons')}</label>
                <textarea value={lessons} onChange={(e) => setLessons(e.target.value)} rows={2} maxLength={500} placeholder={t('mc_fa_lessons_ph')}
                  className="w-full bg-white/[0.04] border border-red-500/20 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-y" />
              </div>

              <div>
                <label className="block text-xs text-sky-400 mb-1.5 font-semibold">
                  {t('mc_fa_opp_notes')} <span className="text-zinc-600 font-normal">({t('mc_optional')})</span>
                </label>
                <textarea value={oppNotes} onChange={(e) => setOppNotes(e.target.value)} rows={2} maxLength={500} placeholder={t('mc_fa_opp_notes_ph')}
                  className="w-full bg-white/[0.04] border border-sky-500/20 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-sky-500 resize-y" />
              </div>

              <button onClick={create} disabled={saving} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.95rem' }}>
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('mc_saving')}</>
                  : <><i className="ri-save-line"></i> {t('mc_fa_save')}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
