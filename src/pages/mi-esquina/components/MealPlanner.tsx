import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, type Profile } from '@/lib/supabase';
import { isMissingColumn } from '@/lib/dbState';
import { loadPhysical, type FighterPhysical } from '@/lib/physicalProfile';
import { activityKindCfg, todayISO } from '@/pages/mi-esquina/lib/dayPlan';
import {
  PANTRY_GROUPS, RECIPE_BY_ID, recipeHow, recipeName,
  type MealSlot, type Pantry,
} from '@/pages/mi-esquina/lib/recipes';
import {
  addPantryItem, deletePantryItem, itemForTag, loadPantryItems, looseItems,
  setPantryAvailable, tagsFromItems, type PantryItem,
} from '@/pages/mi-esquina/lib/pantryItems';
import {
  clearPlan, countRelaxed, dailyTarget, defaultParams, generatePlan, loadPlan,
  loadTrainingContext, mealKey, mealWarnings, missingAnswers, rescaleDay,
  restrictionsTooTight, savePlan, shoppingTags, updateActivePlan,
  type DailyTarget, type GoalDirection, type MealPlan, type PlannedDay, type PlannedMeal,
  type PlannerParams, type TrainingWhen, type TrainingWhenAnswer,
} from '@/pages/mi-esquina/lib/mealPlanner';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** Puente al perfil físico cuando faltan datos para afinar el objetivo. */
  onGoProfile?: () => void;
  /** Avisa a Nutrición de que hay una comida nueva en el diario de hoy. */
  onMealLogged?: () => void;
}

const SLOT_ICON: Record<MealSlot, string> = {
  desayuno: 'ri-sun-line', comida: 'ri-restaurant-line',
  cena: 'ri-moon-line', snack: 'ri-cake-3-line',
};
const SLOT_KEY: Record<MealSlot, string> = {
  desayuno: 'mc_mp_slot_breakfast', comida: 'mc_mp_slot_lunch',
  cena: 'mc_mp_slot_dinner', snack: 'mc_mp_slot_snack',
};
const TIME_CHOICES = [15, 20, 30, 45];
const DAY_CHOICES = [3, 5, 7];
const MEAL_CHOICES: (3 | 4 | 5)[] = [3, 4, 5];

const WHEN_CHOICES: { id: TrainingWhenAnswer; labelKey: string }[] = [
  { id: 'morning', labelKey: 'mc_mp_when_morning' },
  { id: 'midday', labelKey: 'mc_mp_when_midday' },
  { id: 'afternoon', labelKey: 'mc_mp_when_afternoon' },
  { id: 'evening', labelKey: 'mc_mp_when_evening' },
  { id: 'varies', labelKey: 'mc_mp_when_varies' },
];

const GOAL_CHOICES: { id: GoalDirection; labelKey: string }[] = [
  { id: 'bajar', labelKey: 'mc_mp_goal_down' },
  { id: 'mantener', labelKey: 'mc_mp_goal_keep' },
  { id: 'subir', labelKey: 'mc_mp_goal_up' },
];

// Sugerencias rápidas de restricciones. No sustituyen al campo libre: son los
// casos que se repiten, para no obligar a teclear lo de siempre.
const RESTRICTION_CHIPS = ['mc_mp_restr_lactose', 'mc_mp_restr_gluten', 'mc_mp_restr_pork', 'mc_mp_restr_fish', 'mc_mp_restr_nuts'];

/**
 * Asesor de comida (punto 20).
 *
 * Cruza lo que el usuario responde, lo que la app sabe de él y lo que tiene en
 * la Agenda para dar un plan de varios días con sus raciones, sus horas y su
 * preparación escrita.
 *
 * Tres cosas que lo separan de una lista de recetas:
 *  · Sus PRODUCTOS. Escribe lo que compra de verdad y se guarda; el plan lo
 *    prioriza y lo nombra.
 *  · PREGUNTA lo que no sabe (cuántas comidas hace, si tiene restricciones, a
 *    qué hora entrena) en vez de suponerlo.
 *  · Se USA: cada comida se marca al hacerla y se puede apuntar en el diario.
 */
export default function MealPlanner({ profile, showToast, onGoProfile, onMealLogged }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const locale = lang.startsWith('en') ? 'en-GB' : 'es-ES';

  const [physical, setPhysical] = useState<FighterPhysical | null>(null);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [targetWeight, setTargetWeight] = useState<number | null>(null);
  const [weighIn, setWeighIn] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [params, setParams] = useState<PlannerParams>(defaultParams);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [localOnly, setLocalOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openDay, setOpenDay] = useState(1);
  const [editing, setEditing] = useState(false);
  const [logged, setLogged] = useState<Set<string>>(new Set());

  const [items, setItems] = useState<PantryItem[]>([]);
  const [itemsLocal, setItemsLocal] = useState(false);

  // Datos del usuario + plan guardado + productos propios, en paralelo.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [phys, weightRow, goals, saved, pantry] = await Promise.all([
        loadPhysical(profile.id),
        supabase.from('weight_entries').select('weight_kg')
          .eq('fighter_profile_id', profile.id)
          .order('entry_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('nutrition_goals').select('target_weight_kg, weigh_in_date')
          .eq('fighter_profile_id', profile.id).maybeSingle(),
        loadPlan(profile.id),
        loadPantryItems(profile.id),
      ]);
      if (!alive) return;
      setPhysical(phys.data);
      setCurrentWeight(weightRow.data?.weight_kg ?? null);
      setTargetWeight(goals.data?.target_weight_kg ?? null);
      // weigh_in_date llega de la 0010; si no está aplicada, no viene.
      setWeighIn((goals.data as { weigh_in_date?: string } | null)?.weigh_in_date ?? null);
      setItems(pantry.items);
      setItemsLocal(pantry.storedLocally);
      if (saved) {
        setPlan(saved.plan);
        setParams(saved.plan.params);
        setLocalOnly(saved.storedLocally);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [profile.id]);

  const hasGoal = targetWeight !== null;

  const target: DailyTarget = useMemo(
    () => dailyTarget(physical, currentWeight, targetWeight, weighIn, todayISO(), params.goalDirection),
    [physical, currentWeight, targetWeight, weighIn, params.goalDirection],
  );

  /**
   * Genera el plan.
   *
   * Antes de nada se pregunta a la Agenda qué entrena esos días: es lo que
   * permite reforzar el desayuno cuando entrena de mañana o cuadrar la comida
   * previa cuando corre por la tarde.
   */
  const build = useCallback(async (p: PlannerParams) => {
    setBusy(true);
    const startDate = todayISO();
    const merged: PlannerParams = {
      ...p,
      startDate,
      pantry: [...new Set([...p.pantry, ...tagsFromItems(items)])],
      customFoods: looseItems(items).map((i) => i.name),
    };
    const training = await loadTrainingContext(profile.id, startDate, merged.days);
    const next = generatePlan(target, merged, {
      startDate,
      training,
      defaultWhen: merged.trainingWhen && merged.trainingWhen !== 'varies' ? merged.trainingWhen : null,
      overrides: {},
    });
    const res = await savePlan(profile.id, next);
    setPlan(next);
    setParams(merged);
    setLocalOnly(res.storedLocally);
    setOpenDay(1);
    setEditing(false);
    setLogged(new Set());
    setBusy(false);
    if (!res.ok) showToast(t('error_save'), 'error');
  }, [target, profile.id, showToast, t, items]);

  const discard = async () => {
    await clearPlan(profile.id);
    setPlan(null);
    setEditing(false);
  };

  /** Marcar una comida como hecha. Se guarda: es un checklist, no un adorno. */
  const toggleDone = async (key: string) => {
    if (!plan) return;
    const done = plan.done.includes(key) ? plan.done.filter((k) => k !== key) : [...plan.done, key];
    const next = { ...plan, done };
    setPlan(next);
    await updateActivePlan(profile.id, next);
  };

  /** Aclaración del usuario: "ese día entreno a otra hora". */
  const clarifyDay = async (day: number, when: TrainingWhen | null) => {
    if (!plan) return;
    const next = rescaleDay(plan, day, when);
    setPlan(next);
    await updateActivePlan(profile.id, next);
  };

  // Apuntar una comida del plan en el diario de hoy, con sus macros ya
  // escaladas a las raciones del plan.
  const logMeal = async (m: PlannedMeal, key: string, date: string) => {
    const r = RECIPE_BY_ID.get(m.recipeId);
    if (!r) return;
    const entryDate = date <= todayISO() ? date : todayISO();
    const row = {
      fighter_profile_id: profile.id, entry_date: entryDate, meal_type: m.slot,
      description: recipeName(r, lang),
      calories: m.kcal, protein_g: m.protein, carbs_g: m.carbs, fat_g: m.fat,
    };
    let { error } = await supabase.from('meal_entries').insert(row);
    if (error && isMissingColumn(error)) {
      ({ error } = await supabase.from('meal_entries').insert({
        fighter_profile_id: profile.id, entry_date: entryDate,
        meal_type: m.slot, description: recipeName(r, lang),
      }));
    }
    if (error) { showToast(t('error_save'), 'error'); return; }
    setLogged((s) => new Set(s).add(key));
    onMealLogged?.();
    showToast(t('mc_mp_logged'), 'success');
  };

  // ── Productos propios ──
  const addItem = async (name: string) => {
    const res = await addPantryItem(profile.id, name, items);
    if (res.duplicate) { showToast(t('mc_mp_food_duplicate'), 'error'); return; }
    if (!res.item) return;
    setItems((l) => [...l, res.item as PantryItem]);
    if (res.storedLocally) setItemsLocal(true);
  };

  const toggleItem = async (item: PantryItem) => {
    const next = !item.available;
    setItems((l) => l.map((i) => (i.id === item.id ? { ...i, available: next } : i)));
    await setPantryAvailable(profile.id, item, next);
  };

  const removeItem = async (item: PantryItem) => {
    setItems((l) => l.filter((i) => i.id !== item.id));
    await deletePantryItem(profile.id, item);
  };

  if (loading) {
    return <div className="rk-card animate-pulse" style={{ padding: 20, height: 220 }} />;
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="rk-eyebrow">{t('mc_mp_eyebrow')}</p>
        <h2 className="rk-h3" style={{ fontSize: '1.25rem', color: '#fff', margin: '4px 0 0' }}>
          {t('mc_mp_title')} <span className="rk-red-glow">{t('mc_mp_title_2')}</span>
        </h2>
        <p className="rk-body-14 mt-1">{t('mc_mp_sub')}</p>
      </header>

      <TargetCard target={target} onGoProfile={onGoProfile} />

      {!plan || editing ? (
        <PreferencesForm
          params={params}
          hasGoal={hasGoal}
          busy={busy}
          canCancel={!!plan}
          items={items}
          itemsLocal={itemsLocal}
          onAddItem={addItem}
          onToggleItem={toggleItem}
          onRemoveItem={removeItem}
          onCancel={() => setEditing(false)}
          onSubmit={(p) => build(p)}
        />
      ) : (
        <>
          {/* Barra de acciones del plan guardado */}
          <div className="rk-card flex flex-wrap items-center gap-2" style={{ padding: 14 }}>
            <span className="text-xs text-zinc-400 flex-1 min-w-[160px]">
              {t('mc_mp_saved_on', { date: new Date(plan.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'long' }) })}
              {localOnly && <span className="block text-[11px] text-[#C9A84C] mt-0.5">{t('mc_mp_local_only')}</span>}
            </span>
            <button onClick={() => build({ ...params, seed: Math.floor(Math.random() * 1e9) })}
              disabled={busy} className="rk-nav-btn text-xs flex items-center gap-1.5 disabled:opacity-60"
              style={{ padding: '0.55rem 1rem', minHeight: 44 }}>
              <i className="ri-shuffle-line" />{t('mc_mp_another')}
            </button>
            <button onClick={() => setEditing(true)} className="rk-nav-btn text-xs flex items-center gap-1.5"
              style={{ padding: '0.55rem 1rem', minHeight: 44 }}>
              <i className="ri-equalizer-line" />{t('mc_mp_change_prefs')}
            </button>
            <button onClick={discard} className="text-xs text-zinc-500 hover:text-red-400 cursor-pointer px-2"
              style={{ minHeight: 44 }}>
              {t('mc_mp_discard')}
            </button>
          </div>

          <PlanProgress plan={plan} />

          {/* Si no se ha podido respetar todo lo que pidió, se dice arriba y
              se marca plato por plato. Colar un guiso de 30 minutos a quien
              pidió 15 sin avisar sería engañarle. */}
          {countRelaxed(plan) > 0 && (
            <div className="rk-card flex items-start gap-2.5" style={{ padding: 14, borderColor: 'rgba(201,168,76,0.28)' }}>
              <i className="ri-error-warning-line text-[#C9A84C] mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                {t('mc_mp_relaxed', { n: countRelaxed(plan) })}
              </p>
            </div>
          )}

          {/* Días */}
          <div className="space-y-2.5">
            {plan.days.map((d) => (
              <DayCard key={d.day} day={d} plan={plan} open={openDay === d.day} lang={lang} locale={locale}
                items={items} logged={logged}
                onToggleOpen={() => setOpenDay(openDay === d.day ? -1 : d.day)}
                onToggleDone={toggleDone}
                onClarify={(when) => clarifyDay(d.day, when)}
                onLog={(m, key) => logMeal(m, key, d.date)} />
            ))}
          </div>

          <ShoppingList plan={plan} items={items} />
        </>
      )}

      <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5 pt-1">
        <i className="ri-information-line mt-0.5 flex-shrink-0" />
        {t('mc_mp_disclaimer')}
      </p>
    </div>
  );
}

// ── Objetivo diario ────────────────────────────────────────────

function TargetCard({ target, onGoProfile }: { target: DailyTarget; onGoProfile?: () => void }) {
  const { t } = useTranslation();
  const dirKey = target.direction === 'bajar' ? 'mc_mp_dir_down'
    : target.direction === 'subir' ? 'mc_mp_dir_up' : 'mc_mp_dir_keep';

  return (
    <div className="rk-card" style={{ padding: 18 }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">{t('mc_mp_target_title')}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5"
          style={{ background: 'rgba(201,168,76,0.14)', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C' }}>
          {t(dirKey)}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {/* Etiquetas cortas: "Carbohidratos" no cabe en una columna de cuatro
            y salía cortado a "CARBOHIDRA…". */}
        <Metric value={String(target.kcal)} unit="kcal" accent />
        <Metric value={`${target.protein}g`} unit={t('mc_mp_short_protein')} />
        <Metric value={`${target.carbs}g`} unit={t('mc_mp_short_carbs')} />
        <Metric value={`${target.fat}g`} unit={t('mc_mp_short_fat')} />
      </div>

      {/* Honestidad sobre de dónde sale la cifra: sin peso, altura, edad y
          sexo NO es un cálculo personalizado, es una referencia. */}
      {!target.personalised && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5"
          style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.22)' }}>
          <i className="ri-error-warning-line text-[#C9A84C] flex-shrink-0" />
          <p className="text-[11px] text-zinc-300 flex-1 min-w-[160px] leading-relaxed">{t('mc_mp_not_personal')}</p>
          {onGoProfile && (
            <button onClick={onGoProfile} className="rk-nav-btn text-[11px]" style={{ padding: '0.4rem 0.8rem', minHeight: 40 }}>
              {t('mc_mp_complete_profile')}
            </button>
          )}
        </div>
      )}

      {target.aggressive && (
        <p className="mt-3 text-[11px] text-orange-300/90 flex items-start gap-1.5 leading-relaxed">
          <i className="ri-alert-line mt-0.5 flex-shrink-0" />{t('mc_mp_aggressive')}
        </p>
      )}
    </div>
  );
}

function Metric({ value, unit, accent }: { value: string; unit: string; accent?: boolean }) {
  return (
    <div className="rounded-xl px-2 py-2.5 text-center" style={{ background: 'var(--s-2)' }}>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(20px,5.5vw,26px)', lineHeight: 1, color: accent ? '#fff' : 'var(--t-1)' }}>
        {value}
      </p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1 truncate">{unit}</p>
    </div>
  );
}

// ── Cuánto se lleva hecho ──────────────────────────────────────

function PlanProgress({ plan }: { plan: MealPlan }) {
  const { t } = useTranslation();
  const total = plan.days.reduce((a, d) => a + d.meals.length, 0);
  const done = plan.done.length;
  if (total === 0) return null;
  const pct = Math.min(100, (done / total) * 100);

  return (
    <div className="rk-card" style={{ padding: 14 }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">{t('mc_mp_progress_title')}</span>
        <span className="text-xs text-white">{t('mc_mp_progress_n', { done, total })}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--s-3)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#4ade80' }} />
      </div>
    </div>
  );
}

// ── Un día del plan ────────────────────────────────────────────

function DayCard({ day, plan, open, lang, locale, items, logged, onToggleOpen, onToggleDone, onClarify, onLog }: {
  day: PlannedDay;
  plan: MealPlan;
  open: boolean;
  lang: string;
  locale: string;
  items: PantryItem[];
  logged: Set<string>;
  onToggleOpen: () => void;
  onToggleDone: (key: string) => void;
  onClarify: (when: TrainingWhen | null) => void;
  onLog: (m: PlannedMeal, key: string) => void;
}) {
  const { t } = useTranslation();
  const [clarifying, setClarifying] = useState(false);

  const hasTraining = day.strength || day.activities.length > 0;
  const doneHere = day.meals.filter((_, i) => plan.done.includes(mealKey(day.day, i))).length;
  const dateLabel = new Date(`${day.date}T12:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="rk-card overflow-hidden" style={{ padding: 0 }}>
      <button onClick={onToggleOpen} className="w-full flex items-center gap-3 text-left cursor-pointer"
        style={{ padding: '14px 16px', minHeight: 56 }}>
        <span className="flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ width: 36, height: 36, background: 'rgba(225,6,0,0.12)', border: '1px solid rgba(225,6,0,0.3)', color: '#ff6b66', fontFamily: "'Bebas Neue', sans-serif", fontSize: 17 }}>
          {day.day}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-white first-letter:uppercase">{dateLabel}</span>
          <span className="block text-[11px] text-zinc-500">
            {day.kcal} kcal · {day.protein} g {t('mc_food_photo_protein').toLowerCase()}
            {doneHere > 0 && ` · ${t('mc_mp_day_done', { n: doneHere, total: day.meals.length })}`}
          </span>
        </span>
        {hasTraining && (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-1 flex-shrink-0"
            style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}>
            <i className={day.strength ? 'ri-hammer-line' : 'ri-run-line'} />
            {t('mc_mp_training_badge')}
          </span>
        )}
        <i className={`ri-arrow-down-s-line text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-white/[0.06]">
          {/* Qué entrena ese día y a qué hora — con opción de aclararlo */}
          {hasTraining && (
            <div className="px-4 py-3" style={{ background: 'rgba(74,222,128,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                <i className="ri-calendar-check-line text-green-400 mr-1.5" />
                {[
                  day.strength ? t('mc_dp_kind_strength') : null,
                  ...day.activities.map((k) => t(activityKindCfg(k).labelKey)),
                ].filter(Boolean).join(' + ')}
                {day.when
                  ? ` · ${t(`mc_mp_when_${day.when}`)}`
                  : ` · ${t('mc_mp_when_unknown')}`}
              </p>

              {clarifying ? (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {WHEN_CHOICES.filter((c) => c.id !== 'varies').map((c) => (
                    <button key={c.id} type="button"
                      onClick={() => { onClarify(c.id as TrainingWhen); setClarifying(false); }}
                      className={`rounded-lg border text-[11px] font-semibold px-2.5 cursor-pointer transition-all ${
                        day.when === c.id ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/12 text-zinc-300 hover:border-white/30'
                      }`} style={{ minHeight: 40 }}>
                      {t(c.labelKey)}
                    </button>
                  ))}
                  <button type="button" onClick={() => { onClarify(null); setClarifying(false); }}
                    className="rounded-lg border border-white/12 bg-white/[0.03] text-[11px] text-zinc-400 px-2.5 cursor-pointer"
                    style={{ minHeight: 40 }}>
                    {t('mc_mp_when_none')}
                  </button>
                </div>
              ) : (
                <button onClick={() => setClarifying(true)}
                  className="text-[11px] text-zinc-400 hover:text-white cursor-pointer mt-1 inline-flex items-center gap-1"
                  style={{ minHeight: 36 }}>
                  <i className="ri-edit-line" />{t('mc_mp_clarify_when')}
                </button>
              )}
            </div>
          )}

          <div className="divide-y divide-white/[0.05]">
            {day.meals.map((m, i) => {
              const r = RECIPE_BY_ID.get(m.recipeId);
              if (!r) return null;
              const key = mealKey(day.day, i);
              const isDone = plan.done.includes(key);
              const wasLogged = logged.has(key);
              const warn = mealWarnings(r, plan.params);
              // Productos del propio usuario que cubren este plato: se nombran
              // los suyos en vez de la etiqueta genérica.
              const yours = r.pantry
                .map((tag) => itemForTag(items, tag))
                .filter((x): x is PantryItem => !!x)
                .map((x) => x.name);

              return (
                <div key={key} style={{ padding: '14px 16px', opacity: isDone ? 0.6 : 1 }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <i className={`${SLOT_ICON[m.slot]} text-zinc-500 text-sm`} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                      {t(SLOT_KEY[m.slot])}
                    </span>
                    <span className="text-[10px] text-zinc-600">{m.time}</span>
                    {m.training && (
                      <span className="text-[9px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5"
                        style={{
                          background: m.training === 'pre' ? 'rgba(225,6,0,0.14)' : 'rgba(74,222,128,0.14)',
                          border: `1px solid ${m.training === 'pre' ? 'rgba(225,6,0,0.35)' : 'rgba(74,222,128,0.35)'}`,
                          color: m.training === 'pre' ? '#ff6b66' : '#4ade80',
                        }}>
                        {t(m.training === 'pre' ? 'mc_mp_pre_training' : 'mc_mp_post_training')}
                      </span>
                    )}
                    <span className={`text-[10px] ml-auto flex items-center gap-1 ${warn.overTime ? 'text-[#C9A84C]' : 'text-zinc-600'}`}>
                      <i className="ri-time-line" />{r.minutes} min
                    </span>
                  </div>

                  {(warn.overTime || warn.offPantry) && (
                    <p className="text-[10px] text-[#C9A84C] flex items-center gap-1 mb-1">
                      <i className="ri-alert-line" />
                      {warn.overTime && warn.offPantry ? t('mc_mp_warn_both')
                        : warn.overTime ? t('mc_mp_warn_time') : t('mc_mp_warn_pantry')}
                    </p>
                  )}

                  <p className={`text-sm font-bold leading-snug ${isDone ? 'text-zinc-400 line-through' : 'text-white'}`}>
                    {recipeName(r, lang)}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {m.kcal} kcal · P {m.protein} · C {m.carbs} · G {m.fat}
                    {m.servings !== 1 && <> · {t('mc_mp_servings', { n: m.servings })}</>}
                  </p>

                  {yours.length > 0 && (
                    <p className="text-[11px] text-green-400/90 mt-1 flex items-start gap-1 leading-relaxed">
                      <i className="ri-shopping-basket-line mt-0.5 flex-shrink-0" />
                      {t('mc_mp_uses_yours', { list: yours.slice(0, 3).join(', ') })}
                    </p>
                  )}

                  <p className="text-xs text-zinc-400 leading-relaxed mt-2">{recipeHow(r, lang)}</p>

                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    <button onClick={() => onToggleDone(key)}
                      className={`text-xs inline-flex items-center gap-1.5 cursor-pointer rounded-xl px-3 border transition-all ${
                        isDone
                          ? 'bg-green-500/15 border-green-500/40 text-green-300'
                          : 'bg-white/[0.04] border-white/12 text-zinc-300 hover:border-white/30'
                      }`} style={{ minHeight: 42 }}>
                      <i className={isDone ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'} />
                      {isDone ? t('mc_mp_done') : t('mc_mp_mark_done')}
                    </button>
                    <button onClick={() => onLog(m, key)} disabled={wasLogged}
                      className={`text-xs inline-flex items-center gap-1.5 cursor-pointer rounded-xl px-3 ${wasLogged ? 'text-green-400 cursor-default' : 'rk-nav-btn'}`}
                      style={{ minHeight: 42 }}>
                      <i className={wasLogged ? 'ri-check-double-line' : 'ri-add-line'} />
                      {wasLogged ? t('mc_mp_logged') : t('mc_mp_log_meal')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Preferencias y preguntas ───────────────────────────────────

function PreferencesForm({ params, hasGoal, busy, canCancel, items, itemsLocal, onAddItem, onToggleItem, onRemoveItem, onCancel, onSubmit }: {
  params: PlannerParams;
  hasGoal: boolean;
  busy: boolean;
  canCancel: boolean;
  items: PantryItem[];
  itemsLocal: boolean;
  onAddItem: (name: string) => void;
  onToggleItem: (item: PantryItem) => void;
  onRemoveItem: (item: PantryItem) => void;
  onCancel: () => void;
  onSubmit: (p: PlannerParams) => void;
}) {
  const { t } = useTranslation();
  const [p, setP] = useState<PlannerParams>(params);
  const [newFood, setNewFood] = useState('');

  const set = <K extends keyof PlannerParams>(k: K, v: PlannerParams[K]) => setP((s) => ({ ...s, [k]: v }));

  const togglePantry = (tag: Pantry) => setP((s) => ({
    ...s,
    pantry: s.pantry.includes(tag) ? s.pantry.filter((x) => x !== tag) : [...s.pantry, tag],
  }));

  const missing = missingAnswers(p, hasGoal);
  const tooTight = restrictionsTooTight(p);

  const submitFood = () => {
    const v = newFood.trim();
    if (!v) return;
    onAddItem(v);
    setNewFood('');
  };

  return (
    <div className="rk-card space-y-6" style={{ padding: 18 }}>
      {/* ── Lo que hay que saber sí o sí ──
          Estas cuatro preguntas no tienen valor por defecto: sin ellas no se
          puede planificar sin inventar. La pantalla lo dice y no deja seguir. */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500 mb-3">
          {t('mc_mp_required_title')}
        </p>

        <div className="space-y-5">
          <Field label={t('mc_mp_q_meals')} hint={t('mc_mp_q_meals_hint')} required={missing.includes('meals')}>
            <div className="flex flex-wrap gap-2">
              {MEAL_CHOICES.map((n) => (
                <Chip key={n} on={p.mealsPerDay === n} onClick={() => set('mealsPerDay', n)}>
                  {t('mc_mp_meals_n', { n })}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label={t('mc_mp_q_restrictions')} hint={t('mc_mp_q_restrictions_hint')} required={missing.includes('restrictions')}>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <Chip small on={p.restrictions === ''} onClick={() => set('restrictions', '')}>
                {t('mc_mp_restr_none')}
              </Chip>
              {RESTRICTION_CHIPS.map((k) => {
                const word = t(k);
                const on = (p.restrictions || '').toLowerCase().includes(word.toLowerCase());
                return (
                  <Chip key={k} small on={on} onClick={() => {
                    const cur = p.restrictions || '';
                    if (on) {
                      // La palabra viene de una traducción: se escapa antes de
                      // meterla en una expresión regular. Hoy son todas planas,
                      // pero una traducción futura con un paréntesis reventaría.
                      const safe = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                      set('restrictions', cur.replace(new RegExp(`\\s*,?\\s*${safe}`, 'i'), '').replace(/^\s*,\s*/, '').trim());
                    } else {
                      set('restrictions', cur ? `${cur}, ${word}` : word);
                    }
                  }}>
                    {word}
                  </Chip>
                );
              })}
            </div>
            <input value={p.restrictions ?? ''} onChange={(e) => set('restrictions', e.target.value)}
              maxLength={200} placeholder={t('mc_mp_q_restrictions_ph')}
              className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
              style={{ fontSize: 16, minHeight: 44 }} />
            {tooTight && (
              <p className="text-[11px] text-[#C9A84C] mt-1.5 flex items-start gap-1.5 leading-relaxed">
                <i className="ri-alert-line mt-0.5 flex-shrink-0" />{t('mc_mp_restr_too_tight')}
              </p>
            )}
            <p className="text-[10px] text-zinc-600 mt-1.5 leading-relaxed">{t('mc_mp_restr_disclaimer')}</p>
          </Field>

          <Field label={t('mc_mp_q_when')} hint={t('mc_mp_q_when_hint')} required={missing.includes('training_when')}>
            <div className="flex flex-wrap gap-2">
              {WHEN_CHOICES.map((c) => (
                <Chip key={c.id} on={p.trainingWhen === c.id} onClick={() => set('trainingWhen', c.id)}>
                  {t(c.labelKey)}
                </Chip>
              ))}
            </div>
          </Field>

          {!hasGoal && (
            <Field label={t('mc_mp_q_goal')} hint={t('mc_mp_q_goal_hint')} required={missing.includes('goal')}>
              <div className="flex flex-wrap gap-2">
                {GOAL_CHOICES.map((c) => (
                  <Chip key={c.id} on={p.goalDirection === c.id} onClick={() => set('goalDirection', c.id)}>
                    {t(c.labelKey)}
                  </Chip>
                ))}
              </div>
            </Field>
          )}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--s-3)' }} />

      {/* ── Tus productos ── */}
      <Field label={t('mc_mp_q_my_foods')} hint={t('mc_mp_q_my_foods_hint')}>
        <div className="flex gap-2">
          <input value={newFood} onChange={(e) => setNewFood(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitFood(); } }}
            maxLength={80} placeholder={t('mc_mp_my_foods_ph')}
            className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
            style={{ fontSize: 16, minHeight: 44 }} />
          <button type="button" onClick={submitFood} disabled={!newFood.trim()}
            className="rk-nav-btn text-xs flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0"
            style={{ padding: '0.6rem 1rem', minHeight: 44 }}>
            <i className="ri-add-line" />{t('mc_mp_my_foods_add')}
          </button>
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {items.map((item) => (
              <span key={item.id}
                className="inline-flex items-center gap-1.5 rounded-lg pl-2.5 pr-1 py-1 text-[11px]"
                style={{
                  background: item.available ? 'rgba(74,222,128,0.10)' : 'var(--s-2)',
                  border: `1px solid ${item.available ? 'rgba(74,222,128,0.3)' : 'var(--s-3)'}`,
                  color: item.available ? '#d7f7e0' : 'var(--t-3)',
                }}>
                <button type="button" onClick={() => onToggleItem(item)}
                  className="cursor-pointer flex items-center gap-1.5" style={{ minHeight: 32 }}
                  aria-pressed={item.available}>
                  <i className={item.available ? 'ri-check-line' : 'ri-close-line'} />
                  {item.name}
                  {item.tag && <span className="opacity-60">· {t(`mc_mp_ing_${item.tag}`)}</span>}
                </button>
                <button type="button" onClick={() => onRemoveItem(item)} aria-label={t('mc_delete')}
                  className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-red-400 cursor-pointer">
                  <i className="ri-close-circle-line" />
                </button>
              </span>
            ))}
          </div>
        )}
        {itemsLocal && (
          <p className="text-[11px] text-[#C9A84C] mt-2 flex items-start gap-1.5 leading-relaxed">
            <i className="ri-information-line mt-0.5 flex-shrink-0" />{t('mc_mp_my_foods_local')}
          </p>
        )}
      </Field>

      {/* Tiempo */}
      <Field label={t('mc_mp_q_time')} hint={t('mc_mp_q_time_hint')}>
        <div className="flex flex-wrap gap-2">
          {TIME_CHOICES.map((m) => (
            <Chip key={m} on={p.maxMinutes === m} onClick={() => set('maxMinutes', m)}>
              {t('mc_mp_minutes', { n: m })}
            </Chip>
          ))}
        </div>
      </Field>

      {/* Complejidad */}
      <Field label={t('mc_mp_q_complexity')}>
        <div className="flex flex-wrap gap-2">
          <Chip on={p.complexity === 'facil'} onClick={() => set('complexity', 'facil')}>
            {t('mc_mp_cx_easy')}
            <span className="block text-[10px] font-normal opacity-70">{t('mc_mp_cx_easy_hint')}</span>
          </Chip>
          <Chip on={p.complexity === 'medio'} onClick={() => set('complexity', 'medio')}>
            {t('mc_mp_cx_mid')}
            <span className="block text-[10px] font-normal opacity-70">{t('mc_mp_cx_mid_hint')}</span>
          </Chip>
        </div>
      </Field>

      {/* Despensa */}
      <Field label={t('mc_mp_q_pantry')} hint={t('mc_mp_q_pantry_hint')}>
        <div className="space-y-2.5">
          {PANTRY_GROUPS.map((g) => (
            <div key={g.id}>
              <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-600 mb-1.5">{t(g.labelKey)}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((tag) => (
                  <Chip key={tag} small on={p.pantry.includes(tag)} onClick={() => togglePantry(tag)}>
                    {t(`mc_mp_ing_${tag}`)}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
        {p.pantry.length > 0 && (
          <label className="flex items-center gap-2.5 mt-3 cursor-pointer" style={{ minHeight: 44 }}>
            <input type="checkbox" checked={p.onlyPantry} onChange={(e) => set('onlyPantry', e.target.checked)}
              className="w-4 h-4 accent-red-600 cursor-pointer" />
            <span className="text-xs text-zinc-300">{t('mc_mp_only_pantry')}</span>
          </label>
        )}
      </Field>

      {/* Vegetariano + días */}
      <div className="grid sm:grid-cols-2 gap-5">
        <Field label={t('mc_mp_q_diet')}>
          <label className="flex items-center gap-2.5 cursor-pointer" style={{ minHeight: 44 }}>
            <input type="checkbox" checked={p.vegetarian} onChange={(e) => set('vegetarian', e.target.checked)}
              className="w-4 h-4 accent-red-600 cursor-pointer" />
            <span className="text-xs text-zinc-300">{t('mc_mp_vegetarian')}</span>
          </label>
        </Field>
        <Field label={t('mc_mp_q_days')}>
          <div className="flex flex-wrap gap-2">
            {DAY_CHOICES.map((d) => (
              <Chip key={d} on={p.days === d} onClick={() => set('days', d)}>{t('mc_mp_days_n', { n: d })}</Chip>
            ))}
          </div>
        </Field>
      </div>

      {/* Sin las respuestas obligatorias no se genera: se dice cuántas faltan
          y cuáles, en vez de dejar el botón muerto sin explicación. */}
      {missing.length > 0 && (
        <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
          style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.22)' }}>
          <i className="ri-question-line text-[#C9A84C] mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-zinc-300 leading-relaxed">
            {t('mc_mp_missing_intro', { n: missing.length })}{' '}
            {missing.map((q) => t(`mc_mp_missing_${q}`)).join(' · ')}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button onClick={() => onSubmit({ ...p, seed: Math.floor(Math.random() * 1e9) })}
          disabled={busy || missing.length > 0}
          className="rk-btn rk-btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ minHeight: 48 }}>
          {busy
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('mc_mp_building')}</>
            : <><i className="ri-magic-line" />{t('mc_mp_generate')}</>}
        </button>
        {canCancel && (
          <button onClick={onCancel} className="rk-nav-btn text-xs" style={{ padding: '0.7rem 1.2rem', minHeight: 48 }}>
            {t('mc_cancel')}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-bold text-white mb-1 flex items-center gap-1.5">
        {label}
        {required && (
          <span className="text-[9px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5"
            style={{ background: 'rgba(201,168,76,0.14)', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C' }}>
            ●
          </span>
        )}
      </p>
      {hint && <p className="text-[11px] text-zinc-500 mb-2.5 leading-relaxed">{hint}</p>}
      {!hint && <div className="mb-2.5" />}
      {children}
    </div>
  );
}

function Chip({ on, small, onClick, children }: {
  on: boolean; small?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} style={{ minHeight: small ? 40 : 44 }}
      className={`rounded-xl border font-semibold transition-all cursor-pointer text-left ${small ? 'px-2.5 text-[11px]' : 'px-3.5 text-xs'} ${
        on ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/12 text-zinc-300 hover:border-white/30'
      }`}>
      {children}
    </button>
  );
}

// ── Lista de la compra ─────────────────────────────────────────

function ShoppingList({ plan, items }: { plan: MealPlan; items: PantryItem[] }) {
  const { t } = useTranslation();
  const tags = useMemo(() => shoppingTags(plan), [plan]);
  const extras = useMemo(() => looseItems(items), [items]);
  if (tags.length === 0 && extras.length === 0) return null;

  return (
    <div className="rk-card" style={{ padding: 18 }}>
      <div className="flex items-center gap-2 mb-2.5">
        <i className="ri-shopping-basket-2-line text-[#C9A84C]" />
        <h3 className="text-sm font-bold text-white">{t('mc_mp_shopping')}</h3>
      </div>
      <p className="text-[11px] text-zinc-500 mb-3 leading-relaxed">{t('mc_mp_shopping_hint')}</p>

      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const mine = itemForTag(items, tag);
          return (
            <span key={tag} className="rounded-lg px-2.5 py-1.5 text-[11px]"
              style={{
                background: mine ? 'rgba(74,222,128,0.10)' : 'var(--s-2)',
                border: `1px solid ${mine ? 'rgba(74,222,128,0.3)' : 'var(--s-3)'}`,
                color: mine ? '#d7f7e0' : 'var(--t-2)',
              }}>
              {mine ? mine.name : t(`mc_mp_ing_${tag}`)}
              {mine && <i className="ri-check-line ml-1" />}
            </span>
          );
        })}
      </div>

      {/* Los productos que no encajan en ninguna etiqueta no se pierden: se
          enseñan como lo que son, extras disponibles. No se les inventan
          macros ni se meten a la fuerza en un plato. */}
      {extras.length > 0 && (
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--s-3)' }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500 mb-2">{t('mc_mp_extras_title')}</p>
          <p className="text-[11px] text-zinc-500 mb-2 leading-relaxed">{t('mc_mp_extras_hint')}</p>
          <div className="flex flex-wrap gap-1.5">
            {extras.map((e) => (
              <span key={e.id} className="rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-300"
                style={{ background: 'var(--s-2)', border: '1px solid var(--s-3)' }}>
                {e.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
