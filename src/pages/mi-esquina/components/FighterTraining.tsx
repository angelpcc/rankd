import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import Reveal from '@/components/base/Reveal';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ACTIVITY_KINDS, activityKindCfg, todayISO } from '../lib/dayPlan';
import { reconcileDayTicks } from '../lib/planTicks';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** Llega del "+" de Agenda o de un día del calendario: abre el formulario
   * ya con esa fecha puesta. undefined = flujo normal (hoy, formulario cerrado). */
  initialDate?: string;
}

interface ActSession {
  id: string;
  fighter_profile_id: string;
  session_date: string;
  kind: string;
  duration_min: number;
  rounds: number | null;
  note: string | null;
  created_at: string;
}

function startOfMonth(): Date { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; }

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, padding: '8px 12px' }}>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
      <p style={{ fontSize: 14, color: '#fff', margin: 0, fontWeight: 700 }}>{payload[0].value} min</p>
    </div>
  );
}

export default function FighterTraining({ profile, showToast, initialDate }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const [sessions, setSessions] = useState<ActSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(!!initialDate);
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const [date, setDate] = useState(initialDate || todayISO());
  const [kind, setKind] = useState('correr');
  const [duration, setDuration] = useState('30');
  const [rounds, setRounds] = useState('');
  const [note, setNote] = useState('');

  const [selectedType, setSelectedType] = useState<string>('');

  useEffect(() => {
    if (!initialDate) return;
    setDate(initialDate);
    setShowForm(true);
    setStep(1);
  }, [initialDate]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('activity_sessions').select('*')
      .eq('fighter_profile_id', profile.id)
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(120);
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    const list = (data || []) as ActSession[];
    setSessions(list);
    setSelectedType((cur) => cur || (list[0]?.kind ?? ''));
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const addSession = async () => {
    if (saving) return;
    const mins = parseInt(duration, 10);
    if (!mins || mins < 1) { showToast(t('mc_av_need_duration'), 'error'); return; }
    setSaving(true);
    const cfg = activityKindCfg(kind);
    const { data, error } = await supabase.from('activity_sessions').insert({
      fighter_profile_id: profile.id,
      session_date: date,
      kind,
      duration_min: mins,
      rounds: cfg.rounds && rounds ? parseInt(rounds, 10) : null,
      note: note.trim() || null,
    }).select().maybeSingle();
    if (error || !data) { showToast(t('error_save'), 'error'); setSaving(false); return; }
    setSessions((prev) => [data as ActSession, ...prev].sort((a, b) => b.session_date.localeCompare(a.session_date)));
    setSelectedType(kind);
    setNote(''); setRounds('');
    setShowForm(false);
    setStep(1);
    setSaving(false);
    showToast(t('mc_av_saved'));
    // Tick automático del plan del día (Tarea 3).
    void reconcileDayTicks(profile.id, date);
  };

  const deleteSession = async (id: string) => {
    setConfirmDel(null);
    const { error } = await supabase.from('activity_sessions').delete().eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); return; }
    setSessions((prev) => prev.filter((s) => s.id !== id));
    showToast(t('mc_av_deleted'));
  };

  // ── Tipos registrados (chips de progreso) ──
  const registeredKinds = useMemo(() => {
    const set = new Set(sessions.map((s) => s.kind));
    return ACTIVITY_KINDS.filter((k) => set.has(k.value));
  }, [sessions]);

  const ofType = useMemo(
    () => sessions.filter((s) => s.kind === selectedType).slice().sort((a, b) => a.session_date.localeCompare(b.session_date)),
    [sessions, selectedType],
  );

  const chartData = useMemo(
    () => ofType.slice(-12).map((s) => ({
      label: new Date(s.session_date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
      minutes: s.duration_min,
      key: s.id,
    })),
    [ofType, locale],
  );

  const typeStats = useMemo(() => {
    const monthStart = startOfMonth();
    const monthMin = ofType
      .filter((s) => new Date(s.session_date + 'T12:00:00') >= monthStart)
      .reduce((a, s) => a + s.duration_min, 0);
    const longest = ofType.reduce((m, s) => Math.max(m, s.duration_min), 0);
    return { monthMin, longest, count: ofType.length };
  }, [ofType]);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
          <i className="ri-run-line text-3xl text-red-400"></i>
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.3rem', color: '#fff' }}>{t('mc_coming_soon_title')}</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{t('mc_coming_soon_desc')}</p>
      </div>
    );
  }

  const selCfg = selectedType ? activityKindCfg(selectedType) : null;

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="rk-eyebrow">{t('mc_av_eyebrow')}</p>
          <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
            {t('mc_av_title')} <span className="rk-red-glow">{t('mc_av_title_2')}</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-md">{t('mc_av_sub')}</p>
        </div>
        <button onClick={() => { if (!showForm) setStep(1); setShowForm(!showForm); }}
          className={`rk-btn ${showForm ? 'rk-btn-ghost' : 'rk-btn-primary'} flex items-center gap-2`} style={{ fontSize: '0.85rem', padding: '0.7rem 1.4rem' }}>
          <i className={showForm ? 'ri-close-line' : 'ri-add-line'}></i>
          {showForm ? t('mc_av_close') : t('mc_av_new')}
        </button>
      </div>

      {/* ── Formulario en 2 pasos, como Fuerza ── */}
      {showForm && (
        <Reveal>
          <div className="rk-card space-y-4" style={{ padding: '22px 20px' }}>
            <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>
              {step === 1 ? t('mc_av_step1_title') : t(activityKindCfg(kind).labelKey)}
            </h3>

            {step === 1 ? (
              <div className="grid grid-cols-3 gap-2">
                {ACTIVITY_KINDS.map((k) => (
                  <button key={k.value} type="button" onClick={() => { setKind(k.value); setDuration(k.value === 'boxeo' ? '30' : '30'); setStep(2); }}
                    className="flex flex-col items-center gap-1.5 py-3.5 px-1 rounded-xl border border-white/10 bg-white/[0.02] text-xs font-semibold text-white hover:border-white/25 transition-all cursor-pointer"
                    style={{ minHeight: 44 }}>
                    <i className={`${k.icon} text-xl`} style={{ color: k.hex }}></i>
                    {t(k.labelKey)}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <button onClick={() => setStep(1)} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 cursor-pointer -mt-1">
                  <i className="ri-arrow-left-line"></i> {t('mc_av_step_back')}
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_av_date')}</label>
                    <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer [color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_av_duration')}</label>
                    <input type="number" min="1" max="600" step="5" value={duration} onChange={(e) => setDuration(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder="30" />
                  </div>
                </div>
                {activityKindCfg(kind).rounds && (
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_av_rounds')}</label>
                    <input type="number" min="1" max="30" value={rounds} onChange={(e) => setRounds(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder="—" />
                  </div>
                )}
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_av_note')}</label>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                    className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-none" placeholder={t('mc_av_note_ph')} />
                </div>
                <button onClick={addSession} disabled={saving} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '1rem' }}>
                  {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('mc_saving')}</> : <><i className="ri-check-line"></i> {t('mc_av_save')}</>}
                </button>
              </>
            )}
          </div>
        </Reveal>
      )}

      {/* ── Progreso por tipo ── */}
      {registeredKinds.length > 0 && (
        <Reveal delay={60}>
          <div className="rk-card" style={{ padding: '20px' }}>
            <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff', marginBottom: 12 }}>{t('mc_av_progress_title')}</h3>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5">
              {registeredKinds.map((k) => (
                <button key={k.value} onClick={() => setSelectedType(k.value)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${selectedType === k.value ? 'border-white/30' : 'border-white/10 hover:border-white/20'}`}
                  style={{ background: selectedType === k.value ? `${k.hex}1e` : 'rgba(255,255,255,0.02)', color: '#fff' }}>
                  <i className={k.icon} style={{ color: k.hex }}></i>{t(k.labelKey)}
                </button>
              ))}
            </div>

            {selCfg && ofType.length >= 2 && (
              <>
                <p className="text-xs text-zinc-500 mt-4 mb-2">{t('mc_av_chart_title')}</p>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                      <YAxis hide />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                      <Bar dataKey="minutes" radius={[6, 6, 0, 0]} maxBarSize={38}>
                        {chartData.map((d, i) => <Cell key={d.key} fill={i === chartData.length - 1 ? selCfg.hex : `${selCfg.hex}88`} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {[
                    { v: `${typeStats.monthMin}m`, l: t('mc_av_stat_month_min') },
                    { v: `${typeStats.longest}m`, l: t('mc_av_stat_longest') },
                    { v: String(typeStats.count), l: t('mc_av_stat_count') },
                  ].map((s) => (
                    <div key={s.l} className="rk-card text-center" style={{ padding: '12px 8px', transform: 'none' }}>
                      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(20px,4.5vw,26px)', lineHeight: 1, color: '#fff', margin: 0 }}>{s.v}</p>
                      <p className="rk-body" style={{ fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 5 }}>{s.l}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {selCfg && ofType.length === 1 && (
              <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
                {t('mc_av_one_session', { type: t(selCfg.labelKey).toLowerCase() })}
                <span className="block text-white mt-1">{ofType[0].duration_min} min · {new Date(ofType[0].session_date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'long' })}</span>
              </p>
            )}
          </div>
        </Reveal>
      )}

      {/* ── Historial ── */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">{t('mc_av_history')}</h3>
        {sessions.length === 0 ? (
          <Reveal>
            <div className="rk-card text-center" style={{ padding: '52px 24px' }}>
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
                <i className="ri-run-line text-3xl text-red-400"></i>
              </div>
              <h3 className="rk-h3" style={{ fontSize: '1.25rem', color: '#fff' }}>{t('mc_av_empty_title')}</h3>
              <p className="text-sm text-zinc-400 mt-2 max-w-xs mx-auto leading-relaxed">{t('mc_av_empty_desc')}</p>
              <button onClick={() => { setStep(1); setShowForm(true); }} className="rk-btn rk-btn-primary mt-6" style={{ fontSize: '0.9rem', padding: '0.85rem 1.8rem' }}>
                {t('mc_av_empty_cta')}
              </button>
            </div>
          </Reveal>
        ) : (
          <div className="space-y-2.5">
            {sessions.map((s, i) => {
              const cfg = activityKindCfg(s.kind);
              return (
                <Reveal key={s.id} delay={Math.min(i, 6) * 40}>
                  <div className="rk-card flex items-center gap-4 group" style={{ padding: '14px 16px' }}>
                    <div className="w-11 h-11 flex items-center justify-center rounded-xl border flex-shrink-0" style={{ background: `${cfg.hex}1a`, borderColor: `${cfg.hex}40`, color: cfg.hex }}>
                      <i className={`${cfg.icon} text-lg`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white">{t(cfg.labelKey)}</p>
                        <span className="text-[11px] text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full">{s.duration_min} min</span>
                        {s.rounds ? <span className="text-[11px] text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full">{t('mc_av_rounds_short', { n: s.rounds })}</span> : null}
                      </div>
                      <p className="text-xs text-zinc-500 mt-1 capitalize">
                        {new Date(s.session_date + 'T12:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                      {s.note && <p className="text-xs text-zinc-400 mt-1.5 pl-2.5 border-l-2 border-white/10 leading-relaxed">{s.note}</p>}
                    </div>
                    {confirmDel === s.id ? (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => deleteSession(s.id)} className="text-[11px] font-bold text-red-300 bg-red-600/12 border border-red-500/35 rounded-lg px-2.5 py-1.5 cursor-pointer">{t('mc_delete')}</button>
                        <button onClick={() => setConfirmDel(null)} className="text-[11px] text-zinc-400 px-1.5 cursor-pointer">{t('mc_cancel')}</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDel(s.id)} aria-label={t('mc_delete')}
                        className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    )}
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
