import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, type Profile } from '@/lib/supabase';
import Reveal from '@/components/base/Reveal';
import { activityKindCfg, fmtSetCount } from '@/pages/mi-esquina/lib/dayPlan';
import { clock, formatVarValue, protocolVarsFor } from '@/pages/mi-esquina/lib/protocols';
import {
  commitWeekPlan, currentWeekStart, dateOfWeekday, discardDraft, loadDraft,
  planTotals, planWeekdays, saveDraft,
  type CommitResult, type WeekPlan,
} from '@/pages/mi-esquina/lib/weekPlan';
import {
  adjustWeekPlan, buildWeekContext, checkWeekPlanAvailable, generateWeekPlan,
} from '@/services/weekPlanAdvisor';

// PLAN SEMANAL MULTI-MÓDULO (punto 21).
//
// Una caja de texto. El usuario escribe TODO lo que quiere de la semana —días
// disponibles, objetivo de fuerza, exclusiones, uno o varios cardios con su
// detalle, y qué comidas— y el Asesor devuelve las tres cosas a la vez.
//
// El flujo tiene tres estados y no más:
//   PETICIÓN → RESUMEN (con ajustes puntuales) → CONFIRMADO
//
// El resumen se ordena POR DÍA, no por módulo: es como lo va a leer alguien que
// quiere saber qué le toca el jueves. Y nada se guarda en sus secciones hasta
// que confirma: antes de eso es un borrador que se puede tocar o tirar.
//
// Los ajustes NO rehacen la petición: se le manda el plan entero al Asesor con
// una sola instrucción ("cambia el cardio del jueves") y devuelve el mismo plan
// con ese cambio. Es la diferencia entre poder afinar y tener que empezar otra vez.

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** Ir a la Agenda a ver el plan repartido por días. */
  onGoAgenda?: () => void;
}

type Busy = 'generate' | 'adjust' | 'commit' | null;

/** Contexto del peleador para el Asesor. Lo mínimo que cambia el plan. */
interface FighterCtx { [k: string]: unknown }

export default function WeekPlanStudio({ profile, showToast, onGoAgenda }: Props) {
  const { t, i18n } = useTranslation();
  const lang: 'es' | 'en' = i18n.language.startsWith('en') ? 'en' : 'es';
  const locale = lang === 'en' ? 'en-GB' : 'es-ES';

  const [request, setRequest] = useState('');
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [adjustText, setAdjustText] = useState('');
  const [localOnly, setLocalOnly] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [committed, setCommitted] = useState<CommitResult | null>(null);
  const [fighter, setFighter] = useState<FighterCtx>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const weekStart = useMemo(() => currentWeekStart(), []);
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const ctx = useMemo(() => buildWeekContext(weekStart, today, lang), [weekStart, today, lang]);

  // Borrador a medias + contexto del peleador, en paralelo.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [draft, f, w, g] = await Promise.all([
        loadDraft(profile.id),
        supabase.from('fighters').select('discipline, weight_class, experience_level, age')
          .eq('profile_id', profile.id).maybeSingle(),
        supabase.from('weight_entries').select('weight_kg')
          .eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('nutrition_goals').select('target_weight_kg')
          .eq('fighter_profile_id', profile.id).maybeSingle(),
      ]);
      if (!alive) return;
      if (draft) {
        setPlan(draft.plan);
        setRequest(draft.plan.request);
        setLocalOnly(draft.storedLocally);
      }
      const fr = f.data as { discipline?: string; weight_class?: string; experience_level?: string; age?: number } | null;
      setFighter({
        name: (profile.full_name || '').split(' ')[0] || undefined,
        discipline: fr?.discipline || undefined,
        level: fr?.experience_level || undefined,
        weightClass: fr?.weight_class || undefined,
        age: fr?.age || undefined,
        currentWeight: (w.data as { weight_kg?: number } | null)?.weight_kg || undefined,
        targetWeight: (g.data as { target_weight_kg?: number } | null)?.target_weight_kg || undefined,
      });
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [profile.id, profile.full_name]);

  useEffect(() => {
    let alive = true;
    checkWeekPlanAvailable().then((ok) => { if (alive) setAiAvailable(ok); });
    return () => { alive = false; };
  }, []);

  const persist = useCallback(async (p: WeekPlan) => {
    const res = await saveDraft(profile.id, p);
    setPlan(res.plan);
    setLocalOnly(res.storedLocally);
    return res.plan;
  }, [profile.id]);

  const generate = async () => {
    const text = request.trim();
    if (!text) return;
    setBusy('generate');
    setCommitted(null);
    const res = await generateWeekPlan(text, ctx, fighter);
    setBusy(null);
    if (!res.plan) { showToast(res.error || t('mc_sem_err_generate'), 'error'); return; }
    await persist(res.plan);
  };

  const adjust = async () => {
    const instruction = adjustText.trim();
    if (!plan || !instruction) return;
    setBusy('adjust');
    const res = await adjustWeekPlan(plan, instruction, ctx, fighter);
    setBusy(null);
    if (!res.plan) { showToast(res.error || t('mc_sem_err_adjust'), 'error'); return; }
    await persist(res.plan);
    setAdjustText('');
    showToast(t('mc_sem_adjusted'));
  };

  const confirm = async () => {
    if (!plan) return;
    setBusy('commit');
    const res = await commitWeekPlan(profile.id, plan);
    setBusy(null);
    setCommitted(res);
    setPlan({ ...plan, status: 'committed' });
    if (res.agendaUnavailable) showToast(t('mc_sem_agenda_off'), 'error');
    else showToast(t('mc_sem_committed'));
  };

  const discard = async () => {
    if (!plan) return;
    await discardDraft(profile.id, plan);
    setPlan(null);
    setCommitted(null);
    setConfirmDiscard(false);
  };

  const startOver = () => {
    setPlan(null);
    setCommitted(null);
    setRequest('');
  };

  const dayName = (weekday: number) =>
    new Date(`${dateOfWeekday(weekStart, weekday)}T12:00:00`)
      .toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' });

  if (loading) {
    return <div className="rk-card animate-pulse" style={{ padding: 20, height: 200 }} />;
  }

  const soon = aiAvailable === false;
  const totals = plan ? planTotals(plan) : null;

  return (
    <div className="space-y-5">
      <header>
        <p className="rk-eyebrow">{t('mc_sem_eyebrow')}</p>
        <h2 className="rk-h3" style={{ fontSize: '1.25rem', color: '#fff', margin: '4px 0 0' }}>
          {t('mc_sem_title')} <span className="rk-red-glow">{t('mc_sem_title_2')}</span>
        </h2>
        <p className="rk-body-14 mt-1">{t('mc_sem_sub')}</p>
      </header>

      {/* ── PASO 1 · LA PETICIÓN ── */}
      {!plan && (
        <div className="rk-card space-y-4" style={{ padding: 18 }}>
          <div>
            <label className="block text-sm font-bold text-white mb-1">{t('mc_sem_ask_label')}</label>
            <p className="text-[11px] text-zinc-500 mb-2.5 leading-relaxed">{t('mc_sem_ask_hint')}</p>
            <textarea value={request} onChange={(e) => setRequest(e.target.value)} rows={9} maxLength={4000}
              placeholder={t('mc_sem_ask_ph')}
              className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 resize-y leading-relaxed"
              style={{ fontSize: 15 }} />
            <p className="text-[10px] text-zinc-600 mt-1.5 text-right">{request.length}/4000</p>
          </div>

          {/* Lo que conviene decir para que el plan salga bien a la primera. */}
          <div className="rounded-xl px-3.5 py-3" style={{ background: 'var(--s-2)', border: '1px solid var(--s-3)' }}>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500 mb-2">{t('mc_sem_checklist_title')}</p>
            <ul className="space-y-1.5">
              {['days', 'goal', 'exclusions', 'cardio', 'meals'].map((k) => (
                <li key={k} className="text-[11px] text-zinc-400 flex items-start gap-2 leading-relaxed">
                  <i className="ri-checkbox-circle-line text-zinc-600 mt-0.5 flex-shrink-0" />
                  {t(`mc_sem_checklist_${k}`)}
                </li>
              ))}
            </ul>
          </div>

          {soon && (
            <p className="text-[11px] text-[#C9A84C] flex items-start gap-1.5 leading-relaxed">
              <i className="ri-time-line mt-0.5 flex-shrink-0" />{t('mc_sem_ai_paused')}
            </p>
          )}

          <button onClick={generate} disabled={busy !== null || soon || !request.trim()}
            className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ minHeight: 50, fontSize: '0.95rem' }}>
            {busy === 'generate'
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('mc_sem_generating')}</>
              : <><i className="ri-magic-line" />{t('mc_sem_generate')}</>}
          </button>
          {busy === 'generate' && (
            <p className="text-[11px] text-zinc-500 text-center leading-relaxed">{t('mc_sem_generating_note')}</p>
          )}
        </div>
      )}

      {/* ── PASO 2 · RESUMEN REVISABLE / PASO 3 · CONFIRMADO ── */}
      {plan && (
        <>
          {/* Cabecera del plan */}
          <div className="rk-card" style={{ padding: 18, borderColor: committed ? 'rgba(74,222,128,0.3)' : 'rgba(225,6,0,0.25)' }}>
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl border"
                style={committed
                  ? { background: 'rgba(74,222,128,0.12)', borderColor: 'rgba(74,222,128,0.3)', color: '#4ade80' }
                  : { background: 'rgba(225,6,0,0.12)', borderColor: 'rgba(225,6,0,0.3)', color: '#ff6b66' }}>
                <i className={committed ? 'ri-check-double-line text-xl' : 'ri-file-list-3-line text-xl'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em]"
                  style={{ color: committed ? '#4ade80' : '#ff6b66' }}>
                  {t(committed ? 'mc_sem_state_committed' : 'mc_sem_state_draft')}
                </p>
                <h3 className="text-sm font-bold text-white mt-0.5">
                  {t('mc_sem_week_of', { date: new Date(`${weekStart}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long' }) })}
                </h3>
                {plan.summary && <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{plan.summary}</p>}
              </div>
            </div>

            {/* Cuentas del plan */}
            {totals && (
              <div className="grid grid-cols-4 gap-2 mt-4">
                <Stat value={String(plan.trainingDays)} label={t('mc_sem_stat_days')} />
                <Stat value={String(totals.strengthDays)} label={t('mc_sem_stat_strength')} />
                <Stat value={String(totals.cardioSlots)} label={t('mc_sem_stat_cardio')} />
                <Stat value={String(totals.meals)} label={t('mc_sem_stat_meals')} />
              </div>
            )}

            {/* Las exclusiones se enseñan SIEMPRE y arriba: es lo que el usuario
                va a comprobar primero y lo que más se incumple. */}
            {plan.exclusions.length > 0 && (
              <div className="mt-3 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.22)' }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#C9A84C] mb-1.5">
                  {t('mc_sem_exclusions')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {plan.exclusions.map((x) => (
                    <span key={x} className="text-[11px] rounded-lg px-2 py-1"
                      style={{ background: 'rgba(0,0,0,0.25)', color: '#e8d9a8' }}>
                      <i className="ri-close-circle-line mr-1" />{x}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {localOnly && !committed && (
              <p className="text-[11px] text-[#C9A84C] mt-3 flex items-start gap-1.5 leading-relaxed">
                <i className="ri-information-line mt-0.5 flex-shrink-0" />{t('mc_sem_local_only')}
              </p>
            )}
          </div>

          {/* ── El plan, día a día ── */}
          <div className="space-y-2.5">
            {planWeekdays(plan).map((w) => {
              const str = plan.strength.find((s) => s.weekday === w);
              const cardios = plan.protocols.filter((p) => p.weekdays.includes(w));
              const meals = plan.nutrition.find((n) => n.weekday === w);
              return (
                <Reveal key={w} delay={Math.min(w, 6) * 30}>
                  <div className="rk-card" style={{ padding: '14px 16px' }}>
                    <p className="text-sm font-bold text-white first-letter:uppercase">{dayName(w)}</p>

                    {str && (
                      <div className="mt-2.5 pl-3" style={{ borderLeft: '2px solid #fb923c' }}>
                        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#fb923c' }}>
                          <i className="ri-hammer-line mr-1" />{t('mc_dp_kind_strength')}
                          {str.name && <span className="text-zinc-400 normal-case tracking-normal"> · {str.name}</span>}
                        </p>
                        <div className="mt-1.5 space-y-0.5">
                          {str.exercises.map((e) => (
                            <div key={e.id} className="flex items-baseline gap-2 text-[11px]">
                              <span className="flex-1 min-w-0 truncate text-zinc-300">{e.name}</span>
                              <span className="text-zinc-500 flex-shrink-0" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                                {fmtSetCount(e.sets, {
                                  repsMin: e.reps_min, repsMax: e.reps_max, value: e.value, trackingMode: e.tracking_mode,
                                }, t)}
                              </span>
                            </div>
                          ))}
                        </div>
                        {str.note && <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{str.note}</p>}
                      </div>
                    )}

                    {cardios.map((p) => {
                      const secs = p.segments.reduce((a, s) => a + Math.max(0, s.seconds || 0), 0);
                      const vars = protocolVarsFor(p.kind);
                      const preview = p.segments.slice(0, 4).map((s) => vars
                        .filter((v) => s.values[v.id] !== undefined)
                        .map((v) => formatVarValue(v, s.values[v.id] as number))
                        .join('/')).filter(Boolean).join(' → ');
                      return (
                        <div key={p.key} className="mt-2.5 pl-3" style={{ borderLeft: '2px solid #4ade80' }}>
                          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#4ade80' }}>
                            <i className="ri-run-line mr-1" />{p.name}
                          </p>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            {t(activityKindCfg(p.kind).labelKey)} · {clock(secs)} · {t(`mc_mp_when_${p.when}`)}
                            {' · '}{t('mc_sem_segments_n', { n: p.segments.length })}
                          </p>
                          {preview && (
                            <p className="text-[11px] text-zinc-600 mt-0.5 truncate">
                              {preview}{p.segments.length > 4 ? ' …' : ''}
                            </p>
                          )}
                        </div>
                      );
                    })}

                    {meals && (
                      <div className="mt-2.5 pl-3" style={{ borderLeft: '2px solid #38bdf8' }}>
                        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#38bdf8' }}>
                          <i className="ri-restaurant-line mr-1" />{t('mc_dp_kind_meal')}
                        </p>
                        <div className="mt-1 space-y-1">
                          {meals.meals.map((m, i) => (
                            <p key={i} className="text-[11px] text-zinc-300 leading-relaxed">
                              <span className="text-zinc-500">{t(`mc_dp_slot_${m.slot}`, { defaultValue: m.slot })}</span>
                              {' · '}{m.text}
                              <span className="text-zinc-600"> ({m.minutes} min)</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Reveal>
              );
            })}
          </div>

          {plan.disclaimer && (
            <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5">
              <i className="ri-information-line mt-0.5 flex-shrink-0" />{plan.disclaimer}
            </p>
          )}

          {/* ── AJUSTES PUNTUALES (solo antes de confirmar) ── */}
          {!committed && (
            <div className="rk-card space-y-3" style={{ padding: 18 }}>
              <div>
                <p className="text-sm font-bold text-white">{t('mc_sem_adjust_title')}</p>
                <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{t('mc_sem_adjust_hint')}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['cardio', 'leg', 'shorter', 'swap'].map((k) => (
                  <button key={k} type="button" onClick={() => setAdjustText(t(`mc_sem_adjust_ex_${k}`))}
                    className="text-[11px] rounded-lg px-2.5 cursor-pointer transition-colors"
                    style={{ minHeight: 36, background: 'var(--s-2)', border: '1px solid var(--s-3)', color: 'var(--t-2)' }}>
                    {t(`mc_sem_adjust_ex_${k}`)}
                  </button>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={adjustText} onChange={(e) => setAdjustText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && adjustText.trim()) { e.preventDefault(); void adjust(); } }}
                  maxLength={600} placeholder={t('mc_sem_adjust_ph')}
                  className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                  style={{ fontSize: 16, minHeight: 46 }} />
                <button onClick={adjust} disabled={busy !== null || !adjustText.trim()}
                  className="rk-nav-btn text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 flex-shrink-0"
                  style={{ padding: '0.6rem 1.2rem', minHeight: 46 }}>
                  {busy === 'adjust'
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('mc_sem_adjusting')}</>
                    : <><i className="ri-refresh-line" />{t('mc_sem_adjust_cta')}</>}
                </button>
              </div>
            </div>
          )}

          {/* ── CONFIRMAR / RESULTADO ── */}
          {committed ? (
            <div className="rk-card space-y-3" style={{ padding: 18 }}>
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <i className="ri-check-double-line text-green-400" />{t('mc_sem_done_title')}
              </p>
              <ul className="space-y-1.5">
                {committed.routineId && (
                  <li className="text-xs text-zinc-300 flex items-start gap-2 leading-relaxed">
                    <i className="ri-hammer-line mt-0.5 flex-shrink-0" style={{ color: '#fb923c' }} />
                    {t('mc_sem_done_routine')}
                  </li>
                )}
                {committed.protocolIds.length > 0 && (
                  <li className="text-xs text-zinc-300 flex items-start gap-2 leading-relaxed">
                    <i className="ri-timer-line mt-0.5 flex-shrink-0" style={{ color: '#4ade80' }} />
                    {t('mc_sem_done_protocols', { n: committed.protocolIds.length })}
                  </li>
                )}
                {committed.agendaItems > 0 && (
                  <li className="text-xs text-zinc-300 flex items-start gap-2 leading-relaxed">
                    <i className="ri-calendar-check-line mt-0.5 flex-shrink-0" style={{ color: '#38bdf8' }} />
                    {t('mc_sem_done_agenda', { n: committed.agendaItems })}
                  </li>
                )}
              </ul>
              {committed.agendaUnavailable && (
                <p className="text-[11px] text-[#C9A84C] flex items-start gap-1.5 leading-relaxed">
                  <i className="ri-alert-line mt-0.5 flex-shrink-0" />{t('mc_sem_agenda_off')}
                </p>
              )}
              {committed.storedLocally && (
                <p className="text-[11px] text-[#C9A84C] flex items-start gap-1.5 leading-relaxed">
                  <i className="ri-information-line mt-0.5 flex-shrink-0" />{t('mc_sem_local_only')}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {onGoAgenda && committed.agendaItems > 0 && (
                  <button onClick={onGoAgenda} className="rk-btn rk-btn-primary flex items-center justify-center gap-2 flex-1"
                    style={{ minHeight: 46, fontSize: '0.85rem' }}>
                    <i className="ri-calendar-todo-line" />{t('mc_sem_go_agenda')}
                  </button>
                )}
                <button onClick={startOver} className="rk-nav-btn text-xs" style={{ padding: '0.6rem 1.2rem', minHeight: 46 }}>
                  {t('mc_sem_new_plan')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <button onClick={confirm} disabled={busy !== null}
                className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ minHeight: 52, fontSize: '1rem' }}>
                {busy === 'commit'
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('mc_saving')}</>
                  : <><i className="ri-check-line" />{t('mc_sem_confirm')}</>}
              </button>
              <p className="text-[11px] text-zinc-600 text-center leading-relaxed">{t('mc_sem_confirm_note')}</p>
              {confirmDiscard ? (
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button onClick={discard} className="text-xs font-bold text-red-300 bg-red-600/12 border border-red-500/35 rounded-lg px-3 cursor-pointer"
                    style={{ minHeight: 42 }}>{t('mc_sem_discard_yes')}</button>
                  <button onClick={() => setConfirmDiscard(false)} className="text-xs text-zinc-400 px-2 cursor-pointer"
                    style={{ minHeight: 42 }}>{t('mc_cancel')}</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDiscard(true)}
                  className="w-full text-xs text-zinc-500 hover:text-red-400 cursor-pointer" style={{ minHeight: 42 }}>
                  {t('mc_sem_discard')}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl px-2 py-2.5 text-center" style={{ background: 'var(--s-2)' }}>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(20px,5.5vw,26px)', lineHeight: 1, color: 'var(--t-1)', margin: 0 }}>{value}</p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1 truncate">{label}</p>
    </div>
  );
}
