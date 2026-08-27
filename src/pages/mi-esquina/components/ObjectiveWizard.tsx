import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import { detectMuscleGroups, detectActivityKind, parseDuration } from '@/lib/dictation';

/**
 * Plan IA por objetivo (Mi Esquina › Progreso › Objetivos).
 *
 * R17: la sección Objetivos ahora unifica lo que antes eran dos pestañas.
 * Todo el flujo vive en UNA sola pantalla scrolleable — el usuario baja
 * como en una conversación: escribe objetivo → aparecen preguntas → aparece
 * plan → ajustes/confirmar. Nada de wizard por pasos.
 *
 * Contrato con la BD:
 * - `objective_plans` (mig 0030): guarda objetivo + respuestas + plan JSON.
 * - `planned_events` (existente): al confirmar, cada día del plan se
 *   convierte en una entrada con `source='ai'` (mig 0021) que ya alimenta
 *   la Agenda existente. Sin la 0021, se degrada silenciosamente.
 *
 * Gating: sonda GET a /api/coach al abrir. Sin `ANTHROPIC_API_KEY` en el
 * servidor, se muestra el estado "muy pronto" con el CTA deshabilitado.
 */

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

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

// Convierte los días del plan (Lunes→Domingo) en offsets desde HOY.
// La semana 1 empieza SIEMPRE el lunes de esta semana; los días ya pasados
// de la semana actual (offset<0) se descartan del agendado. La semana 2+
// se cuenta entera.
function computeDayOffsets(weeks: PlanWeek[]): Array<{ dayIndex: number; weekIndex: number; day: PlanDay; offset: number }> {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const mondayThisWeek = new Date(now);
  mondayThisWeek.setDate(now.getDate() - todayIdx);
  const out: Array<{ dayIndex: number; weekIndex: number; day: PlanDay; offset: number }> = [];
  weeks.forEach((w, wi) => {
    w.days.forEach((d, di) => {
      const dayDate = new Date(mondayThisWeek);
      dayDate.setDate(mondayThisWeek.getDate() + wi * 7 + di);
      const offset = Math.round((dayDate.getTime() - now.getTime()) / 86400000);
      if (offset < 0) return;
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

  // Gating IA
  const [checking, setChecking] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);

  // Plan activo persistido
  const [activePlan, setActivePlan] = useState<DBPlan | null>(null);
  const [loadingActive, setLoadingActive] = useState(true);

  // Estado del flujo (todo en una sola pantalla)
  const [objective, setObjective] = useState('');
  const [answers, setAnswers] = useState<Answers>({});
  const [plan, setPlan] = useState<Plan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [adjustments, setAdjustments] = useState('');
  const [savingAgenda, setSavingAgenda] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  // Cuando true, ocultamos el bloque del plan activo y mostramos el flujo
  // de creación (objetivo → preguntas → plan). Al guardar vuelve a false.
  const [creating, setCreating] = useState(false);

  // Refs para scroll suave al bloque nuevo cuando aparece
  const questionsRef = useRef<HTMLDivElement | null>(null);
  const planRef = useRef<HTMLDivElement | null>(null);

  // ── Sonda IA + plan activo en paralelo ──
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
    setLoadingActive(false);
  }, [profile.id]);

  useEffect(() => { void loadActivePlan(); }, [loadActivePlan]);

  // Perfil físico para el system prompt (mezcla fighters + weight + nutrition +
  // fighter_physical del bloque A). El perfil físico manda cuando hay conflicto:
  // p. ej. `weight_kg` de fighter_physical pisa el último weight_entry.
  const [physical, setPhysical] = useState<Record<string, unknown>>({});
  useEffect(() => {
    (async () => {
      const [{ data: f }, { data: w }, { data: g }, { data: fp }] = await Promise.all([
        supabase.from('fighters').select('discipline, weight_class, experience_level, age, wins, losses, draws, kos').eq('profile_id', profile.id).maybeSingle(),
        supabase.from('weight_entries').select('weight_kg').eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('nutrition_goals').select('target_weight_kg').eq('fighter_profile_id', profile.id).maybeSingle(),
        supabase.from('fighter_physical').select('*').eq('fighter_profile_id', profile.id).maybeSingle(),
      ]);
      const phys = (fp as Partial<{
        weight_kg: number; height_cm: number; birth_date: string; sex: string; sport: string; level: string;
        training_days_per_week: number; session_minutes: number; equipment_access: string; injuries_notes: string;
      }> | null) || {};
      // Edad de birth_date > edad de fighters. Sport del perfil físico > discipline. Level idem.
      const ageFromBirth = phys.birth_date ? (() => {
        const b = new Date(phys.birth_date + 'T12:00:00'); const now = new Date();
        let a = now.getFullYear() - b.getFullYear();
        const m = now.getMonth() - b.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
        return a >= 0 && a < 120 ? a : undefined;
      })() : undefined;
      setPhysical({
        name: (profile.full_name || '').split(' ')[0] || undefined,
        discipline: phys.sport || f?.discipline || undefined,
        level: phys.level || f?.experience_level || undefined,
        weightClass: f?.weight_class || undefined,
        age: ageFromBirth ?? f?.age ?? undefined,
        heightCm: phys.height_cm || undefined,
        sex: phys.sex || undefined,
        currentWeight: phys.weight_kg || (w as { weight_kg?: number } | null)?.weight_kg || undefined,
        targetWeight: (g as { target_weight_kg?: number } | null)?.target_weight_kg || undefined,
        record: f ? `${f.wins ?? 0}-${f.losses ?? 0}-${f.draws ?? 0}, ${f.kos ?? 0} KO` : undefined,
        trainingDaysPerWeek: phys.training_days_per_week || undefined,
        sessionMinutes: phys.session_minutes || undefined,
        equipmentAccess: phys.equipment_access || undefined,
        injuries: phys.injuries_notes || undefined,
      });
    })();
  }, [profile.id, profile.full_name]);

  // Radiografía de lo que el peleador YA tiene en la app: plan de los próximos
  // días, actividad y fuerza de las últimas semanas, evolución del peso y
  // registro de nutrición. Se pasa al Asesor como texto para que responda
  // sobre datos reales ("¿entreno demasiado pecho?", "reajusta esta semana").
  const [snapshot, setSnapshot] = useState<string>('');
  useEffect(() => {
    let alive = true;
    (async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const d30 = new Date(today); d30.setDate(d30.getDate() - 30);
      const in21 = new Date(today); in21.setDate(in21.getDate() + 21);
      const [plan, acts, sets, weights, meals] = await Promise.all([
        supabase.from('day_plan_items').select('plan_date, kind, payload, completed')
          .eq('fighter_profile_id', profile.id).gte('plan_date', iso(today)).lte('plan_date', iso(in21)).order('plan_date'),
        supabase.from('activity_sessions').select('kind, duration_min, session_date')
          .eq('fighter_profile_id', profile.id).gte('session_date', iso(d30)),
        supabase.from('strength_sets').select('muscle_group, session_date')
          .eq('fighter_profile_id', profile.id).gte('session_date', iso(d30)),
        supabase.from('weight_entries').select('weight_kg, entry_date')
          .eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(8),
        supabase.from('meal_entries').select('entry_date')
          .eq('fighter_profile_id', profile.id).gte('entry_date', iso(new Date(today.getTime() - 7 * 864e5))),
      ]);
      if (!alive) return;
      const parts: string[] = [];

      const planRows = (plan.data || []) as { plan_date: string; kind: string; payload: Record<string, unknown>; completed: boolean }[];
      if (planRows.length) {
        const byDate = new Map<string, string[]>();
        planRows.forEach((r) => {
          const p = r.payload || {};
          const label = r.kind === 'strength' ? `fuerza (${(Array.isArray(p.groups) ? p.groups : []).join(', ') || 's/g'})`
            : r.kind === 'activity' ? `${p.kind || 'actividad'}${p.duration_min ? ` ${p.duration_min}min` : ''}`
            : r.kind === 'meal' ? `comida: ${String(p.text || '').slice(0, 40)}`
            : r.kind === 'supplement' ? `supl.: ${p.name || ''}` : `nota: ${String(p.text || '').slice(0, 40)}`;
          const l = byDate.get(r.plan_date) || []; l.push(label + (r.completed ? ' ✓' : '')); byDate.set(r.plan_date, l);
        });
        parts.push('Plan de los próximos días:\n' + [...byDate.entries()].map(([d, l]) => `  ${d}: ${l.join(' · ')}`).join('\n'));
      }

      const actRows = (acts.data || []) as { kind: string; duration_min: number }[];
      if (actRows.length) {
        const agg = new Map<string, { n: number; min: number }>();
        actRows.forEach((r) => { const a = agg.get(r.kind) || { n: 0, min: 0 }; a.n++; a.min += r.duration_min || 0; agg.set(r.kind, a); });
        parts.push('Actividad últimos 30 días: ' + [...agg.entries()].map(([k, v]) => `${k} ${v.n}x (${v.min}min)`).join(', '));
      }

      const setRows = (sets.data || []) as { muscle_group: string | null }[];
      if (setRows.length) {
        const freq = new Map<string, number>();
        setRows.forEach((r) => { const g = r.muscle_group || 'otro'; freq.set(g, (freq.get(g) || 0) + 1); });
        parts.push('Fuerza últimos 30 días (series por grupo): ' + [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([g, n]) => `${g} ${n}`).join(', '));
      }

      const wRows = (weights.data || []) as { weight_kg: number; entry_date: string }[];
      if (wRows.length >= 2) {
        const last = wRows[0], first = wRows[wRows.length - 1];
        const delta = (Number(last.weight_kg) - Number(first.weight_kg)).toFixed(1);
        parts.push(`Peso: ${last.weight_kg} kg (${Number(delta) >= 0 ? '+' : ''}${delta} kg en ${wRows.length} registros)`);
      } else if (wRows.length === 1) {
        parts.push(`Peso: ${wRows[0].weight_kg} kg`);
      }

      const mealRows = (meals.data || []) as unknown[];
      if (mealRows.length) parts.push(`Nutrición: ${mealRows.length} comidas registradas en 7 días`);

      setSnapshot(parts.join('\n'));
    })();
    return () => { alive = false; };
  }, [profile.id]);

  // ── Scroll suave a un bloque cuando aparece ──
  useEffect(() => {
    if (creating && objective.trim() && questionsRef.current) {
      questionsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [creating, objective]);

  useEffect(() => {
    if (plan && planRef.current) {
      planRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [plan]);

  const startNew = () => {
    if (activePlan && !confirmReset) { setConfirmReset(true); return; }
    setConfirmReset(false);
    setCreating(true);
    setObjective('');
    setAnswers({});
    setPlan(null);
    setAdjustments('');
  };

  // ── Generación (nueva o refine) ──
  const generate = useCallback(async (obj: string, ans: Answers, previous: Plan | null, adjustText: string | null) => {
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
          objectivePlan: { objective: obj, answers: ans, previous, adjustments: adjustText },
          profile: { ...physical, snapshot: snapshot || undefined },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429 && data?.error === 'quota_reached') {
        showToast(t('op_err_quota_out'), 'error');
        setGenerating(false);
        return;
      }
      if (!res.ok || !data?.plan) {
        showToast(data?.message || t('op_err_generate'), 'error');
        setGenerating(false);
        return;
      }
      setPlan(data.plan as Plan);
      setAdjustments('');
    } catch {
      showToast(t('op_err_generic'), 'error');
    }
    setGenerating(false);
  }, [physical, snapshot, showToast, t]);

  const canGenerate = objective.trim().length > 0 && !generating;
  const applyAdjustments = () => {
    if (!plan || !adjustments.trim()) return;
    void generate(objective || activePlan?.objective_text || '', answers, plan, adjustments.trim());
  };

  // ── Guardar plan + volcar días futuros a la Agenda ──
  const saveToAgenda = useCallback(async () => {
    if (!plan || savingAgenda) return;
    setSavingAgenda(true);
    try {
      // 1. Archivar cualquier plan activo anterior.
      if (activePlan) {
        await supabase.from('objective_plans').update({ status: 'archived', updated_at: new Date().toISOString() })
          .eq('id', activePlan.id);
      }
      // 2. Guardar el nuevo plan como activo. Version+1 si venimos de un refine.
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

      // 3. Volcar los días del plan a day_plan_items (source='advisor') —
      //    mismo destino que Planificar. Cada día se descompone en bloques:
      //    entreno → fuerza (grupos detectados) o nota; cardio → actividad;
      //    nutrición → comida; notas → observación.
      const scheduled = computeDayOffsets(plan.weeks);
      const rows: Array<{ fighter_profile_id: string; plan_date: string; kind: string; payload: Record<string, unknown>; source: string }> = [];
      scheduled.forEach((s) => {
        const plan_date = isoFromOffset(s.offset);
        const base = { fighter_profile_id: profile.id, plan_date, source: 'advisor' };
        if (s.day.training) {
          const groups = detectMuscleGroups(s.day.training);
          rows.push({ ...base, kind: groups.length ? 'strength' : 'note',
            payload: groups.length ? { groups, exercises: s.day.training.slice(0, 200) } : { text: s.day.training.slice(0, 280) } });
        }
        if (s.day.cardio) {
          rows.push({ ...base, kind: 'activity',
            payload: { kind: detectActivityKind(s.day.cardio) || 'correr', duration_min: parseDuration(s.day.cardio), note: s.day.cardio.slice(0, 200) } });
        }
        if (s.day.nutrition) {
          rows.push({ ...base, kind: 'meal', payload: { slot: 'comida', text: s.day.nutrition.slice(0, 200) } });
        }
        if (s.day.notes) {
          rows.push({ ...base, kind: 'note', payload: { text: s.day.notes.slice(0, 280) } });
        }
      });
      if (rows.length > 0) {
        const ins = await supabase.from('day_plan_items').insert(rows);
        if (ins.error && !isMissingTable(ins.error)) { showToast(t('op_saved_none'), 'error'); setSavingAgenda(false); return; }
      }

      showToast(t('op_saved_agenda', { n: rows.length }), 'success');
      setActivePlan(saved as DBPlan);
      setPlan(null);
      setObjective('');
      setAnswers({});
      setAdjustments('');
      setCreating(false);
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
    setActivePlan(null); setPlan(null); setCreating(false);
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

  // Muy pronto (sin API key)
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

  const hasObjective = objective.trim().length > 0;
  const showActivePlan = !creating && activePlan;
  const showEmpty = !creating && !activePlan;

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Cabecera */}
      <div>
        <p className="rk-eyebrow">{t('op_eyebrow')}</p>
        <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
          {t('op_title')} <span className="rk-red-glow">{t('op_title_2')}</span>
        </h2>
        <p className="text-zinc-400 text-sm mt-1.5 max-w-md">{t('op_sub')}</p>
      </div>

      {/* Plan activo (si existe y no estamos creando) */}
      {showActivePlan && (
        <ActivePlanView
          plan={activePlan!.plan_json}
          activePlan={activePlan!}
          locale={locale}
          onStartNew={startNew}
          onArchive={archivePlan}
          confirmReset={confirmReset}
          onCancelReset={() => setConfirmReset(false)}
        />
      )}

      {/* Sin plan activo → CTA para empezar */}
      {showEmpty && (
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

      {/* ══ FLUJO DE CREACIÓN (siempre visible cuando creating=true) ══ */}
      {creating && (
        <>
          {/* PASO 1 — Objetivo (siempre visible) */}
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
              <input value={objective} onChange={(e) => setObjective(e.target.value)} maxLength={200}
                placeholder={t('op_custom_ph')} style={{ fontSize: 16, minHeight: 44 }}
                className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-red-500" />
            </div>
            {activePlan && (
              <button onClick={() => { setCreating(false); setConfirmReset(false); }}
                className="text-xs text-zinc-500 hover:text-white cursor-pointer">
                <i className="ri-arrow-left-line mr-1" />{t('mc_cancel')}
              </button>
            )}
          </div>

          {/* PASO 2 — Preguntas (aparecen cuando hay objetivo) */}
          {hasObjective && (
            <div ref={questionsRef}>
              <QuestionsBlock
                answers={answers}
                setAnswers={setAnswers}
                canGenerate={canGenerate}
                generating={generating}
                onGenerate={() => generate(objective, answers, null, null)}
              />
            </div>
          )}

          {/* PASO 3 — Loading intermedio (solo la primera vez, sin plan aún) */}
          {generating && !plan && (
            <div className="card-primary text-center" style={{ padding: '32px 26px' }}>
              <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center rounded-2xl bg-red-600/12 border border-red-500/30">
                <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="rk-title-card">{t('op_step2_generating')}</p>
            </div>
          )}

          {/* PASO 4 — Plan generado + ajustes + confirmar */}
          {plan && (
            <div ref={planRef} className="space-y-6">
              <PlanBanner plan={plan} />
              <PlanWeeksRender plan={plan} />
              <AdjustBlock
                adjustments={adjustments}
                setAdjustments={setAdjustments}
                onApply={applyAdjustments}
                generating={generating}
              />
              <div className="flex flex-wrap gap-2 justify-end">
                <button onClick={() => { setPlan(null); setCreating(false); setObjective(''); setAnswers({}); }}
                  className="rk-nav-btn text-sm">{t('mc_cancel')}</button>
                <button onClick={saveToAgenda} disabled={savingAgenda} className="rk-cta text-sm disabled:opacity-60">
                  {savingAgenda
                    ? <><span className="inline-block w-3 h-3 border-2 border-white/40 border-t-transparent rounded-full animate-spin mr-2" /> {t('op_saving')}</>
                    : <><i className="ri-calendar-todo-line mr-1" />{t('op_save_agenda')}</>}
                </button>
              </div>
            </div>
          )}
        </>
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
        <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-red-400 mb-1">
          {t('op_active_plan')} · {t('op_version', { n: activePlan.version })}
        </p>
        <h3 className="rk-title-card" style={{ fontSize: '1.3rem' }}>{plan.plan_name}</h3>
        <p className="rk-body-14 mt-1.5">{plan.summary}</p>
        <p className="rk-meta mt-2">{t('op_created_at', { date: created })}</p>
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
            <button
              onClick={() => window.open('/mi-esquina/plan/imprimir?print=1', '_blank', 'noopener')}
              className="rk-nav-btn text-sm"
              title={t('op_print_download')}
            >
              <i className="ri-file-download-line mr-1" /> {t('op_print_download')}
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

function QuestionsBlock({
  answers, setAnswers, canGenerate, generating, onGenerate,
}: {
  answers: Answers; setAnswers: (a: Answers) => void;
  canGenerate: boolean; generating: boolean; onGenerate: () => void;
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
        <button onClick={() => setAnswers({})} className="rk-nav-btn text-xs">{t('op_skip_all')}</button>
      </div>

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

      <QuestionBlock label={t('op_q_notes_label')} onSkip={() => clearKey('extra_notes')} value={answers.extra_notes}>
        <textarea value={answers.extra_notes || ''} onChange={(e) => setKey('extra_notes', e.target.value)}
          rows={3} maxLength={400} placeholder={t('op_q_notes_ph')} style={{ fontSize: 16 }}
          className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500 resize-none" />
      </QuestionBlock>

      <div className="flex justify-end pt-1">
        <button onClick={onGenerate} disabled={!canGenerate} className="rk-cta text-sm disabled:opacity-50">
          {generating
            ? <><span className="inline-block w-3 h-3 border-2 border-white/40 border-t-transparent rounded-full animate-spin mr-2" /> {t('op_step2_generating')}</>
            : <><i className="ri-sparkling-2-line mr-1" />{t('op_step2_generate')}</>}
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

function PlanBanner({ plan }: { plan: Plan }) {
  const { t } = useTranslation();
  return (
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
  );
}

// Tipo visual del día según qué toca: da la franja de color de la tarjeta.
// El schema actual del plan es texto libre por campo, no una lista estructurada
// de ejercicios, así que la franja no puede ir por grupo muscular. En su lugar
// va por CONTENIDO del día, que es lo que un peleador quiere distinguir de un
// vistazo: entreno principal · solo cardio · solo pauta nutricional · descanso.
type DayKind = 'training' | 'cardio' | 'nutrition' | 'rest';
function kindOfDay(d: PlanDay): DayKind {
  if (d.training) return 'training';
  if (d.cardio) return 'cardio';
  if (d.nutrition) return 'nutrition';
  return 'rest';
}
const KIND_COLOR: Record<DayKind, string> = {
  training: '#E10600', cardio: '#fb923c', nutrition: '#4ade80', rest: 'rgba(255,255,255,0.14)',
};

function PlanWeeksRender({ plan }: { plan: Plan }) {
  const { t } = useTranslation();
  const [openWeek, setOpenWeek] = useState<number>(1);
  return (
    <div className="space-y-3">
      {plan.weeks.map((w) => {
        const open = openWeek === w.week;
        const kinds = w.days.map(kindOfDay);
        const trainingCount = kinds.filter((k) => k === 'training').length;
        return (
          <div key={w.week} className="rk-card" style={{ padding: 0, overflow: 'hidden' }}>
            <button onClick={() => setOpenWeek(open ? -1 : w.week)}
              className="w-full text-left flex items-center gap-3 px-4 py-3 cursor-pointer">
              <span className="text-[11px] font-bold tracking-[0.22em] uppercase text-red-400">
                {t('op_week')} {w.week}
              </span>
              {/* Mini-strip de 7 puntos = un vistazo a la semana sin abrirla */}
              <span className="flex items-center gap-1 flex-1">
                {kinds.map((k, i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: KIND_COLOR[k] }} />
                ))}
              </span>
              <span className="text-[10px] font-semibold text-zinc-500 mr-1">
                {t('op_week_summary', { count: trainingCount })}
              </span>
              <i className={`ri-arrow-down-s-line text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
              <div className="px-3 pb-3 pt-3 border-t border-white/[0.06] grid gap-2 sm:grid-cols-2">
                {w.days.map((d) => {
                  const dayLabel = DAY_KEYS[d.day] ? t(DAY_KEYS[d.day]) : d.day;
                  const kind = kindOfDay(d);
                  const color = KIND_COLOR[kind];
                  const isRest = kind === 'rest';
                  return (
                    <div key={d.day}
                      className="rounded-xl overflow-hidden bg-white/[0.02] border border-white/[0.06]"
                      style={{ borderLeft: `3px solid ${color}` }}>
                      <div className="px-3 pt-2.5 pb-1.5 flex items-baseline justify-between gap-2">
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 1.5, color: '#fff' }}>
                          {dayLabel.toUpperCase()}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: isRest ? 'rgba(255,255,255,0.35)' : color }}>
                          {t(`op_day_kind_${kind}`)}
                        </span>
                      </div>
                      <div className="px-3 pb-3">
                        {isRest ? (
                          <p className="text-xs text-zinc-500 italic mt-0.5">{t('op_day_rest_hint')}</p>
                        ) : (
                          <>
                            {d.training && <PlanField label={t('op_field_training')} value={d.training} color="#E10600" />}
                            {d.cardio && <PlanField label={t('op_field_cardio')} value={d.cardio} color="#fb923c" />}
                            {d.nutrition && <PlanField label={t('op_field_nutrition')} value={d.nutrition} color="#4ade80" />}
                            {d.notes && <PlanField label={t('op_field_notes')} value={d.notes} color="#C9A84C" />}
                          </>
                        )}
                      </div>
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

function AdjustBlock({
  adjustments, setAdjustments, onApply, generating,
}: {
  adjustments: string; setAdjustments: (v: string) => void;
  onApply: () => void; generating: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="rk-card" style={{ padding: 20 }}>
      <label className="block text-sm font-semibold text-white mb-2">{t('op_adjust_title')}</label>
      <textarea value={adjustments} onChange={(e) => setAdjustments(e.target.value)}
        rows={3} maxLength={500} placeholder={t('op_adjust_ph')} style={{ fontSize: 16 }}
        className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500 resize-none" />
      <div className="flex justify-end mt-3">
        <button onClick={onApply} disabled={!adjustments.trim() || generating}
          className="rk-nav-btn text-sm disabled:opacity-50">
          {generating
            ? <><span className="inline-block w-3 h-3 border-2 border-white/40 border-t-transparent rounded-full animate-spin mr-2" /> {t('op_adjust_applying')}</>
            : <><i className="ri-sparkling-line mr-1" />{t('op_adjust_apply')}</>}
        </button>
      </div>
    </div>
  );
}
