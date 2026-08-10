import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable, isMissingColumn } from '@/lib/dbState';

/**
 * Plan IA por objetivo (Mi Esquina › Progreso › Plan IA).
 *
 * El peleador escribe un OBJETIVO ("bajar 2kg", "preparar combate"), contesta
 * opcionalmente 4-5 preguntas de calibrado y la IA genera un plan semanal
 * completo (entreno + cardio + nutrición + notas por día). El plan se guarda
 * en `objective_plans` (fase que también archiva cualquier plan activo
 * anterior) y, al confirmar, cada día se convierte en una entrada de
 * `planned_events` con `source='ai'` que ya alimenta la Agenda existente.
 *
 * Gating: sonda GET a /api/coach al abrir. Sin `ANTHROPIC_API_KEY` en el
 * servidor, muestra el estado "muy pronto" con el CTA deshabilitado; con la
 * clave, funciona end-to-end sin tocar nada más.
 */

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

type Stage = 'idle' | 'objective' | 'questions' | 'generating' | 'preview';

interface Answers {
  days_per_week?: number;
  session_minutes?: number;
  cardio_extra_minutes?: number;   // 0 = no cardio extra
  can_cook?: 'yes' | 'sometimes' | 'no';
  extra_notes?: string;
}

interface PlanDay {
  day: string;
  training: string | null;
  cardio: string | null;
  nutrition: string | null;
  notes: string | null;
}
interface PlanWeek { week: number; days: PlanDay[] }
interface Plan {
  plan_name: string;
  summary: string;
  disclaimer: string;
  weeks: PlanWeek[];
}

interface DBPlan {
  id: string;
  objective_text: string;
  answers_json: Answers;
  plan_json: Plan;
  version: number;
  status: 'active' | 'archived';
  created_at: string;
}

// El día del plan → índice de offset desde HOY (0=hoy, 6=hoy+6).
// El plan empieza SIEMPRE en el lunes de la semana actual y va sumando semanas.
// Si "hoy" es viernes y el plan dice "lunes semana 1", ese lunes es hace 4
// días → se ignora (day_offset<0). Los días futuros del lunes al domingo de
// esa semana sí entran; a partir de la semana 2 se cuentan enteras.
function computeDayOffsets(weeks: PlanWeek[]): Array<{ dayIndex: number; weekIndex: number; day: PlanDay; offset: number }> {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  // getDay: 0=domingo, 1=lunes… → convertir a 0=lunes … 6=domingo
  const todayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const mondayThisWeek = new Date(now);
  mondayThisWeek.setDate(now.getDate() - todayIdx);
  const out: Array<{ dayIndex: number; weekIndex: number; day: PlanDay; offset: number }> = [];
  weeks.forEach((w, wi) => {
    w.days.forEach((d, di) => {
      const dayDate = new Date(mondayThisWeek);
      dayDate.setDate(mondayThisWeek.getDate() + wi * 7 + di);
      const offset = Math.round((dayDate.getTime() - now.getTime()) / 86400000);
      if (offset < 0) return;   // días pasados de la semana actual: no se agendan
      out.push({ dayIndex: di, weekIndex: wi, day: d, offset });
    });
  });
  return out;
}

function isoFromOffset(offset: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DAY_KEYS: Record<string, string> = {
  Lunes: 'op_day_monday', Martes: 'op_day_tuesday', 'Miércoles': 'op_day_wednesday',
  Jueves: 'op_day_thursday', Viernes: 'op_day_friday', 'Sábado': 'op_day_saturday', Domingo: 'op_day_sunday',
};

export default function ObjectiveWizard({ profile, showToast }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  // Gating: comprobar disponibilidad de IA al abrir.
  const [checking, setChecking] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);

  const [activePlan, setActivePlan] = useState<DBPlan | null>(null);
  const [loadingActive, setLoadingActive] = useState(true);

  const [stage, setStage] = useState<Stage>('idle');
  const [objective, setObjective] = useState('');
  const [answers, setAnswers] = useState<Answers>({});
  const [plan, setPlan] = useState<Plan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [adjustments, setAdjustments] = useState('');
  const [savingAgenda, setSavingAgenda] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // ── Cargar plan activo + sondear IA en paralelo ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/coach', { method: 'GET' });
        const data = res.ok ? await res.json() : { available: false };
        if (alive) setNotConfigured(!data?.available);
      } catch {
        if (alive) setNotConfigured(true);
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const loadActivePlan = useCallback(async () => {
    setLoadingActive(true);
    const { data, error } = await supabase
      .from('objective_plans')
      .select('*')
      .eq('fighter_profile_id', profile.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (isMissingTable(error)) { setTableMissing(true); setLoadingActive(false); return; }
    setActivePlan((data as DBPlan) || null);
    if (data?.plan_json) setPlan(data.plan_json as Plan);
    setLoadingActive(false);
  }, [profile.id]);

  useEffect(() => { void loadActivePlan(); }, [loadActivePlan]);

  // ── Perfil físico para el system prompt (mismo formato que SectionCoach) ──
  const [physical, setPhysical] = useState<Record<string, unknown>>({});
  useEffect(() => {
    (async () => {
      const [{ data: f }, { data: w }, { data: g }] = await Promise.all([
        supabase.from('fighters').select('discipline, weight_class, experience_level, age, wins, losses, draws, kos').eq('profile_id', profile.id).maybeSingle(),
        supabase.from('weight_entries').select('weight_kg').eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('nutrition_goals').select('target_weight_kg').eq('fighter_profile_id', profile.id).maybeSingle(),
      ]);
      setPhysical({
        name: (profile.full_name || '').split(' ')[0] || undefined,
        discipline: f?.discipline || undefined,
        level: f?.experience_level || undefined,
        weightClass: f?.weight_class || undefined,
        age: f?.age || undefined,
        currentWeight: (w as { weight_kg?: number } | null)?.weight_kg || undefined,
        targetWeight: (g as { target_weight_kg?: number } | null)?.target_weight_kg || undefined,
        record: f ? `${f.wins ?? 0}-${f.losses ?? 0}-${f.draws ?? 0}, ${f.kos ?? 0} KO` : undefined,
      });
    })();
  }, [profile.id, profile.full_name]);

  const startNew = () => {
    if (activePlan && !confirmReset) { setConfirmReset(true); return; }
    setConfirmReset(false);
    setStage('objective');
    setObjective('');
    setAnswers({});
    setPlan(null);
    setAdjustments('');
  };

  const goQuestions = () => {
    if (!objective.trim()) { showToast(t('op_err_no_objective'), 'error'); return; }
    setStage('questions');
  };

  const skipAll = () => { setAnswers({}); void generate(objective, {}, null, null); };

  const generate = useCallback(async (obj: string, ans: Answers, previous: Plan | null, adjustText: string | null) => {
    setStage('generating');
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          objectivePlan: {
            objective: obj,
            answers: ans,
            previous,
            adjustments: adjustText,
          },
          profile: physical,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429 && data?.error === 'quota_reached') {
        showToast(t('op_err_quota_out'), 'error');
        setStage(previous ? 'preview' : 'questions');
        setGenerating(false);
        return;
      }
      if (!res.ok || !data?.plan) {
        showToast(data?.message || t('op_err_generate'), 'error');
        setStage(previous ? 'preview' : 'questions');
        setGenerating(false);
        return;
      }
      setPlan(data.plan as Plan);
      setStage('preview');
    } catch {
      showToast(t('op_err_generic'), 'error');
      setStage(previous ? 'preview' : 'questions');
    }
    setGenerating(false);
  }, [physical, showToast, t]);

  const applyAdjustments = () => {
    if (!plan || !adjustments.trim()) return;
    void generate(objective || activePlan?.objective_text || '', answers, plan, adjustments.trim());
  };

  // ── Guardar en agenda + persistir el plan ──
  const saveToAgenda = useCallback(async () => {
    if (!plan || savingAgenda) return;
    setSavingAgenda(true);
    try {
      // 1. Archivar cualquier plan activo anterior.
      if (activePlan) {
        await supabase.from('objective_plans').update({ status: 'archived', updated_at: new Date().toISOString() })
          .eq('id', activePlan.id);
      }
      // 2. Guardar el nuevo plan como activo (con versión + 1 si venimos de un refine).
      const version = (activePlan?.version || 0) + 1;
      const { data: saved, error: saveErr } = await supabase.from('objective_plans').insert({
        fighter_profile_id: profile.id,
        objective_text: objective || activePlan?.objective_text || '',
        answers_json: answers,
        plan_json: plan,
        version,
        status: 'active',
      }).select().maybeSingle();
      if (saveErr || !saved) { showToast(t('op_saved_none'), 'error'); setSavingAgenda(false); return; }

      // 3. Volcar los días futuros a planned_events con source='ai'.
      const scheduled = computeDayOffsets(plan.weeks);
      const rows = scheduled
        .filter((s) => s.day.training || s.day.cardio)  // solo días con algo entrenable
        .map((s) => {
          const bits = [];
          if (s.day.training) bits.push(`Entreno: ${s.day.training}`);
          if (s.day.cardio) bits.push(`Cardio: ${s.day.cardio}`);
          if (s.day.nutrition) bits.push(`Nutrición: ${s.day.nutrition}`);
          if (s.day.notes) bits.push(`Nota: ${s.day.notes}`);
          return {
            fighter_profile_id: profile.id,
            event_date: isoFromOffset(s.offset),
            kind: 'training',
            session_type: s.day.training ? 'tecnica' : 'cardio',
            title: (plan.plan_name || 'Plan IA').slice(0, 80),
            time: null,
            notes: bits.join(' · ').slice(0, 500) || null,
            done: false,
            source: 'ai',
          };
        });
      if (rows.length > 0) {
        let ins = await supabase.from('planned_events').insert(rows);
        if (ins.error && isMissingColumn(ins.error)) {
          // Migración 0021 (source) sin aplicar: reintentar sin ese campo.
          const bare = rows.map((r) => { const c = { ...r } as Record<string, unknown>; delete c.source; return c; });
          ins = await supabase.from('planned_events').insert(bare);
        }
        if (ins.error) { showToast(t('op_saved_none'), 'error'); setSavingAgenda(false); return; }
      }

      showToast(t('op_saved_agenda', { n: rows.length }), 'success');
      setActivePlan(saved as DBPlan);
      setStage('idle');
    } catch {
      showToast(t('op_saved_none'), 'error');
    }
    setSavingAgenda(false);
  }, [plan, activePlan, profile.id, objective, answers, savingAgenda, showToast, t]);

  const archivePlan = async () => {
    if (!activePlan) return;
    const { error } = await supabase.from('objective_plans')
      .update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', activePlan.id);
    if (error) { showToast(t('op_saved_none'), 'error'); return; }
    setActivePlan(null); setPlan(null); setStage('idle');
    showToast(t('op_archived_toast'));
  };

  const presets = useMemo(() => [
    { key: 'op_preset_lose_weight' as const, icon: 'ri-line-chart-line' },
    { key: 'op_preset_gain_muscle' as const, icon: 'ri-boxing-line' },
    { key: 'op_preset_endurance' as const, icon: 'ri-run-line' },
    { key: 'op_preset_fight_prep' as const, icon: 'ri-trophy-line' },
    { key: 'op_preset_stay_fit' as const, icon: 'ri-heart-pulse-line' },
  ], []);

  // ── Estados de carga ──
  if (checking || loadingActive) {
    return (
      <div className="rk-card flex items-center justify-center" style={{ minHeight: 220 }}>
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Muy pronto (sin API key) ──
  if (notConfigured) {
    return (
      <div className="rk-card relative overflow-hidden text-center" style={{ padding: '44px 26px' }}>
        <div className="rk-glow-red" style={{ width: 220, height: 220, top: -90, right: -70, borderRadius: '50%' }} />
        <div className="relative">
          <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/12 border border-red-500/30 anim-float">
            <i className="ri-sparkling-2-line text-3xl text-red-400" />
          </div>
          <span className="inline-block text-[10px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full bg-red-600/12 text-red-400 mb-3">
            {t('op_soon_tag')}
          </span>
          <h3 className="rk-h3" style={{ fontSize: '1.3rem', color: '#fff' }}>{t('op_soon_title')}</h3>
          <p className="text-sm text-zinc-400 mt-2.5 leading-relaxed max-w-sm mx-auto">{t('op_soon_desc')}</p>
        </div>
      </div>
    );
  }

  // ── Migración 0030 sin aplicar ──
  if (tableMissing) {
    return (
      <div className="rk-card text-center" style={{ padding: '44px 26px' }}>
        <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-white/[0.04] border border-white/10">
          <i className="ri-hammer-line text-2xl text-zinc-500" />
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.2rem', color: '#fff' }}>{t('mc_coming_soon_title')}</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed max-w-sm mx-auto">{t('mc_coming_soon_desc')}</p>
      </div>
    );
  }

  // ── Vista principal: plan activo o wizard ──
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Cabecera */}
      <div>
        <p className="rk-eyebrow">{t('op_eyebrow')}</p>
        <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
          {t('op_title')} <span className="rk-red-glow">{t('op_title_2')}</span>
        </h2>
        <p className="text-zinc-400 text-sm mt-1.5 max-w-md">{t('op_sub')}</p>
      </div>

      {/* IDLE con plan activo → resumen del plan */}
      {stage === 'idle' && activePlan && plan && (
        <ActivePlanView
          plan={plan}
          activePlan={activePlan}
          locale={locale}
          onStartNew={startNew}
          onArchive={archivePlan}
          confirmReset={confirmReset}
          onCancelReset={() => setConfirmReset(false)}
        />
      )}

      {/* IDLE sin plan activo */}
      {stage === 'idle' && !activePlan && (
        <div className="card-primary text-center" style={{ padding: '40px 26px' }}>
          <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-red-600/12 border border-red-500/30 text-red-400">
            <i className="ri-sparkling-2-line text-2xl" />
          </div>
          <p className="rk-title-card" style={{ marginBottom: 10 }}>{t('op_no_active')}</p>
          <button onClick={startNew} className="rk-cta" style={{ marginTop: 14, fontSize: '0.95rem', padding: '0.85rem 1.6rem' }}>
            <i className="ri-add-line mr-1" /> {t('op_start_over')}
          </button>
        </div>
      )}

      {/* ── PASO 1: OBJETIVO ── */}
      {stage === 'objective' && (
        <div className="rk-card space-y-4" style={{ padding: 22 }}>
          <div>
            <p className="text-sm font-bold text-white">{t('op_step1_title')}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{t('op_step1_hint')}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {presets.map((p) => {
              const label = t(p.key);
              const selected = objective.trim() === label;
              return (
                <button key={p.key} onClick={() => setObjective(label)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all cursor-pointer text-center ${selected ? 'bg-red-600/15 border-red-500/60 text-white' : 'bg-white/[0.03] border-white/10 text-zinc-300 hover:border-white/25'}`}>
                  <i className={p.icon} style={{ fontSize: 18, color: selected ? '#E10600' : '#C9A84C' }} />
                  <span className="text-xs font-semibold leading-tight">{label}</span>
                </button>
              );
            })}
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('op_custom_ph')}</label>
            <input value={objective} onChange={(e) => setObjective(e.target.value)} maxLength={200}
              placeholder={t('op_custom_ph')} style={{ fontSize: 16, minHeight: 44 }}
              className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-red-500" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setStage('idle')} className="rk-nav-btn text-sm">
              {t('mc_cancel')}
            </button>
            <button onClick={goQuestions} disabled={!objective.trim()} className="rk-cta text-sm disabled:opacity-50">
              {t('op_step1_next')} <i className="ri-arrow-right-line ml-1" />
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 2: PREGUNTAS ── */}
      {stage === 'questions' && (
        <QuestionsForm
          answers={answers}
          setAnswers={setAnswers}
          onSkipAll={skipAll}
          onGenerate={() => generate(objective, answers, null, null)}
          onBack={() => setStage('objective')}
        />
      )}

      {/* ── PASO 3: LOADING ── */}
      {stage === 'generating' && (
        <div className="card-primary text-center" style={{ padding: '44px 26px' }}>
          <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-red-600/12 border border-red-500/30">
            <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="rk-title-card">{t('op_step2_generating')}</p>
          <p className="rk-body-14 mt-2 max-w-sm mx-auto">{t('op_sub')}</p>
        </div>
      )}

      {/* ── PASO 4: PREVIEW ── */}
      {stage === 'preview' && plan && (
        <PlanPreview
          plan={plan}
          locale={locale}
          adjustments={adjustments}
          setAdjustments={setAdjustments}
          onApplyAdjustments={applyAdjustments}
          onSaveAgenda={saveToAgenda}
          savingAgenda={savingAgenda}
          generating={generating}
          onCancel={() => setStage('idle')}
        />
      )}
    </div>
  );
}

// ────────── SUBCOMPONENTES ──────────

function ActivePlanView({
  plan, activePlan, locale, onStartNew, onArchive, confirmReset, onCancelReset,
}: {
  plan: Plan; activePlan: DBPlan; locale: string;
  onStartNew: () => void; onArchive: () => void;
  confirmReset: boolean; onCancelReset: () => void;
}) {
  const { t } = useTranslation();
  const created = new Date(activePlan.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="space-y-4">
      <div className="card-primary" style={{ padding: 22 }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-red-400 mb-1">
              {t('op_active_plan')} · {t('op_version', { n: activePlan.version })}
            </p>
            <h3 className="rk-title-card" style={{ fontSize: '1.3rem' }}>{plan.plan_name}</h3>
            <p className="rk-body-14 mt-1.5">{plan.summary}</p>
            <p className="rk-meta mt-2">{t('op_created_at', { date: created })}</p>
          </div>
        </div>
      </div>

      <PlanWeeksRender plan={plan} />

      <div className="flex flex-wrap gap-2">
        {confirmReset ? (
          <>
            <span className="text-xs text-zinc-400 flex-1 min-w-[200px] self-center">{t('op_start_over_confirm')}</span>
            <button onClick={onCancelReset} className="rk-nav-btn text-sm">{t('mc_cancel')}</button>
            <button onClick={onStartNew} className="rk-cta text-sm">{t('op_start_over')}</button>
          </>
        ) : (
          <>
            <button onClick={onStartNew} className="rk-cta text-sm">
              <i className="ri-add-line mr-1" /> {t('op_start_over')}
            </button>
            <button onClick={onArchive} className="rk-nav-btn text-sm">
              <i className="ri-archive-line mr-1" /> {t('op_archive')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function QuestionsForm({
  answers, setAnswers, onSkipAll, onGenerate, onBack,
}: {
  answers: Answers; setAnswers: (a: Answers) => void;
  onSkipAll: () => void; onGenerate: () => void; onBack: () => void;
}) {
  const { t } = useTranslation();
  const setKey = <K extends keyof Answers>(k: K, v: Answers[K]) => setAnswers({ ...answers, [k]: v });
  const clearKey = <K extends keyof Answers>(k: K) => { const c = { ...answers }; delete c[k]; setAnswers(c); };
  const timeOptions = [30, 45, 60, 90, 120] as const;
  return (
    <div className="rk-card space-y-5" style={{ padding: 22 }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold text-white">{t('op_step2_title')}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{t('op_step2_hint')}</p>
        </div>
        <button onClick={onSkipAll} className="rk-nav-btn text-xs">{t('op_skip_all')}</button>
      </div>

      {/* Q1: días */}
      <QuestionBlock label={t('op_q_days_label')} onSkip={() => clearKey('days_per_week')} value={answers.days_per_week}>
        <div className="flex gap-1.5 flex-wrap">
          {[2, 3, 4, 5, 6, 7].map((n) => (
            <button key={n} onClick={() => setKey('days_per_week', n)}
              className={`rk-nav-btn text-sm ${answers.days_per_week === n ? 'is-active' : ''}`}
              style={{ padding: '0.5rem 1rem' }}>
              {n}
            </button>
          ))}
        </div>
      </QuestionBlock>

      {/* Q2: tiempo */}
      <QuestionBlock label={t('op_q_time_label')} onSkip={() => clearKey('session_minutes')} value={answers.session_minutes}>
        <div className="flex gap-1.5 flex-wrap">
          {timeOptions.map((n) => (
            <button key={n} onClick={() => setKey('session_minutes', n)}
              className={`rk-nav-btn text-sm ${answers.session_minutes === n ? 'is-active' : ''}`}
              style={{ padding: '0.5rem 1rem' }}>
              {t(`op_time_${n}` as const)}
            </button>
          ))}
        </div>
      </QuestionBlock>

      {/* Q3: cardio */}
      <QuestionBlock label={t('op_q_cardio_label')} onSkip={() => clearKey('cardio_extra_minutes')} value={answers.cardio_extra_minutes}>
        <div className="flex gap-1.5 flex-wrap items-center">
          <button onClick={() => setKey('cardio_extra_minutes', 0)}
            className={`rk-nav-btn text-sm ${answers.cardio_extra_minutes === 0 ? 'is-active' : ''}`}
            style={{ padding: '0.5rem 1rem' }}>{t('op_q_cardio_no')}</button>
          <button onClick={() => setKey('cardio_extra_minutes', 30)}
            className={`rk-nav-btn text-sm ${(answers.cardio_extra_minutes ?? -1) > 0 ? 'is-active' : ''}`}
            style={{ padding: '0.5rem 1rem' }}>{t('op_q_cardio_yes')}</button>
          {(answers.cardio_extra_minutes ?? -1) > 0 && (
            <input type="number" min={5} max={180} inputMode="numeric"
              value={answers.cardio_extra_minutes ?? ''}
              onChange={(e) => setKey('cardio_extra_minutes', Math.max(5, Math.min(180, parseInt(e.target.value || '0', 10))))}
              placeholder={t('op_q_cardio_minutes_ph')} style={{ fontSize: 16, minHeight: 40, width: 100 }}
              className="bg-white/[0.04] border border-white/10 text-white rounded-xl px-3 py-2 focus:outline-none focus:border-red-500" />
          )}
        </div>
      </QuestionBlock>

      {/* Q4: cocinar */}
      <QuestionBlock label={t('op_q_cook_label')} onSkip={() => clearKey('can_cook')} value={answers.can_cook}>
        <div className="flex gap-1.5 flex-wrap">
          {(['yes', 'sometimes', 'no'] as const).map((v) => (
            <button key={v} onClick={() => setKey('can_cook', v)}
              className={`rk-nav-btn text-sm ${answers.can_cook === v ? 'is-active' : ''}`}
              style={{ padding: '0.5rem 1rem' }}>
              {t(`op_q_cook_${v}` as const)}
            </button>
          ))}
        </div>
      </QuestionBlock>

      {/* Q5: notas */}
      <QuestionBlock label={t('op_q_notes_label')} onSkip={() => clearKey('extra_notes')} value={answers.extra_notes}>
        <textarea value={answers.extra_notes || ''} onChange={(e) => setKey('extra_notes', e.target.value)}
          rows={3} maxLength={400} placeholder={t('op_q_notes_ph')} style={{ fontSize: 16 }}
          className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500 resize-none" />
      </QuestionBlock>

      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onBack} className="rk-nav-btn text-sm">
          <i className="ri-arrow-left-line mr-1" />{t('mc_cancel')}
        </button>
        <button onClick={onGenerate} className="rk-cta text-sm">
          <i className="ri-sparkling-2-line mr-1" />{t('op_step2_generate')}
        </button>
      </div>
    </div>
  );
}

function QuestionBlock({ label, value, onSkip, children }: {
  label: string;
  value: unknown;
  onSkip: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const answered = value !== undefined && value !== null && value !== '';
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <label className="block text-sm text-zinc-200 font-semibold">{label}</label>
        {answered && (
          <button onClick={onSkip} className="text-[10px] uppercase tracking-wider text-zinc-500 hover:text-white cursor-pointer">
            {t('op_skip')}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function PlanWeeksRender({ plan }: { plan: Plan }) {
  const { t } = useTranslation();
  const [openWeek, setOpenWeek] = useState<number>(1);
  return (
    <div className="space-y-3">
      {plan.weeks.map((w) => {
        const open = openWeek === w.week;
        return (
          <div key={w.week} className="rk-card" style={{ padding: 0, overflow: 'hidden' }}>
            <button onClick={() => setOpenWeek(open ? -1 : w.week)}
              className="w-full text-left flex items-center gap-3 px-4 py-3 cursor-pointer">
              <span className="text-[11px] font-bold tracking-[0.22em] uppercase text-red-400 flex-1">
                {t('op_week')} {w.week}
              </span>
              <i className={`ri-arrow-down-s-line text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
              <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06] pt-3">
                {w.days.map((d) => {
                  const dayLabel = DAY_KEYS[d.day] ? t(DAY_KEYS[d.day]) : d.day;
                  const empty = !d.training && !d.cardio && !d.nutrition && !d.notes;
                  return (
                    <div key={d.day} className="border-l-2 pl-3" style={{ borderColor: empty ? 'rgba(255,255,255,0.08)' : '#E10600' }}>
                      <p className="text-sm font-bold text-white">
                        {dayLabel}
                        {empty && <span className="text-xs text-zinc-500 font-normal ml-2">· {t('op_day_rest')}</span>}
                      </p>
                      {d.training && <PlanField label={t('op_field_training')} value={d.training} color="#E10600" />}
                      {d.cardio && <PlanField label={t('op_field_cardio')} value={d.cardio} color="#fb923c" />}
                      {d.nutrition && <PlanField label={t('op_field_nutrition')} value={d.nutrition} color="#4ade80" />}
                      {d.notes && <PlanField label={t('op_field_notes')} value={d.notes} color="#C9A84C" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PlanField({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="mt-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider mr-1.5" style={{ color }}>{label}:</span>
      <span className="text-xs text-zinc-300 leading-relaxed">{value}</span>
    </div>
  );
}

function PlanPreview({
  plan, locale, adjustments, setAdjustments, onApplyAdjustments, onSaveAgenda, savingAgenda, generating, onCancel,
}: {
  plan: Plan; locale: string;
  adjustments: string; setAdjustments: (v: string) => void;
  onApplyAdjustments: () => void; onSaveAgenda: () => void;
  savingAgenda: boolean; generating: boolean; onCancel: () => void;
}) {
  void locale;
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="card-primary" style={{ padding: 22 }}>
        <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-red-400 mb-1">{t('op_plan_your')}</p>
        <h3 className="rk-title-card" style={{ fontSize: '1.35rem' }}>{plan.plan_name}</h3>
        <p className="rk-body-14 mt-1.5">{plan.summary}</p>
        {plan.disclaimer && (
          <p className="rk-meta mt-3 leading-relaxed">
            <strong className="text-zinc-400">{t('op_disclaimer_prefix')}</strong> {plan.disclaimer}
          </p>
        )}
      </div>

      <PlanWeeksRender plan={plan} />

      <div className="rk-card" style={{ padding: 20 }}>
        <label className="block text-sm font-semibold text-white mb-2">{t('op_adjust_title')}</label>
        <textarea value={adjustments} onChange={(e) => setAdjustments(e.target.value)}
          rows={3} maxLength={500} placeholder={t('op_adjust_ph')} style={{ fontSize: 16 }}
          className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500 resize-none" />
        <div className="flex gap-2 justify-end mt-3">
          <button onClick={onApplyAdjustments} disabled={!adjustments.trim() || generating}
            className="rk-nav-btn text-sm disabled:opacity-50">
            {generating
              ? <><span className="inline-block w-3 h-3 border-2 border-white/40 border-t-transparent rounded-full animate-spin mr-2" /> {t('op_adjust_applying')}</>
              : <><i className="ri-sparkling-line mr-1" />{t('op_adjust_apply')}</>}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-end">
        <button onClick={onCancel} className="rk-nav-btn text-sm">{t('mc_cancel')}</button>
        <button onClick={onSaveAgenda} disabled={savingAgenda} className="rk-cta text-sm disabled:opacity-60">
          {savingAgenda
            ? <><span className="inline-block w-3 h-3 border-2 border-white/40 border-t-transparent rounded-full animate-spin mr-2" /> {t('op_saving')}</>
            : <><i className="ri-calendar-todo-line mr-1" />{t('op_save_agenda')}</>}
        </button>
      </div>
    </div>
  );
}
