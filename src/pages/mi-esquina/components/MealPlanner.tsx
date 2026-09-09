import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, type Profile } from '@/lib/supabase';
import { isMissingColumn } from '@/lib/dbState';
import { loadPhysical, type FighterPhysical } from '@/lib/physicalProfile';
import {
  PANTRY_GROUPS, RECIPE_BY_ID, recipeHow, recipeName,
  type MealSlot, type Pantry,
} from '@/pages/mi-esquina/lib/recipes';
import {
  clearPlan, countRelaxed, dailyTarget, defaultParams, generatePlan, loadPlan,
  mealWarnings, savePlan, shoppingTags,
  type DailyTarget, type MealPlan, type PlannedMeal, type PlannerParams,
} from '@/pages/mi-esquina/lib/mealPlanner';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** Puente al perfil físico cuando faltan datos para afinar el objetivo. */
  onGoProfile?: () => void;
  /** Avisa a Nutrición de que hay una comida nueva en el diario de hoy. */
  onMealLogged?: () => void;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

/**
 * Asesor de comida.
 *
 * Tres preguntas (cuánto tiempo tienes, cómo de complicado lo quieres, qué
 * tienes en casa) cruzadas con lo que la app ya sabe del usuario (peso,
 * altura, edad, sexo, días de entreno y peso objetivo) dan un plan de varios
 * días con sus raciones y su preparación escrita.
 *
 * El plan se guarda: al volver a entrar está el mismo, no hay que rehacerlo.
 * Y cada comida se puede apuntar en el diario de un toque, que es lo que
 * convierte el plan en algo que se usa y no en un PDF que se mira una vez.
 */
export default function MealPlanner({ profile, showToast, onGoProfile, onMealLogged }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

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

  // Datos del usuario + plan guardado, en paralelo.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [phys, weightRow, goals, saved] = await Promise.all([
        loadPhysical(profile.id),
        supabase.from('weight_entries').select('weight_kg')
          .eq('fighter_profile_id', profile.id)
          .order('entry_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('nutrition_goals').select('target_weight_kg, weigh_in_date')
          .eq('fighter_profile_id', profile.id).maybeSingle(),
        loadPlan(profile.id),
      ]);
      if (!alive) return;
      setPhysical(phys.data);
      setCurrentWeight(weightRow.data?.weight_kg ?? null);
      setTargetWeight(goals.data?.target_weight_kg ?? null);
      // weigh_in_date llega de la 0010; si no está aplicada, no viene.
      setWeighIn((goals.data as { weigh_in_date?: string } | null)?.weigh_in_date ?? null);
      if (saved) {
        setPlan(saved.plan);
        setParams(saved.plan.params);
        setLocalOnly(saved.storedLocally);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [profile.id]);

  const target: DailyTarget = useMemo(
    () => dailyTarget(physical, currentWeight, targetWeight, weighIn, todayISO()),
    [physical, currentWeight, targetWeight, weighIn],
  );

  const build = useCallback(async (p: PlannerParams) => {
    setBusy(true);
    const next = generatePlan(target, p);
    const res = await savePlan(profile.id, next);
    setPlan(next);
    setParams(p);
    setLocalOnly(res.storedLocally);
    setOpenDay(1);
    setEditing(false);
    setLogged(new Set());
    setBusy(false);
    if (!res.ok) showToast(t('error_save'), 'error');
  }, [target, profile.id, showToast, t]);

  const discard = async () => {
    await clearPlan(profile.id);
    setPlan(null);
    setEditing(false);
  };

  // Apuntar una comida del plan en el diario de hoy, con sus macros ya
  // escaladas a las raciones del plan.
  const logMeal = async (m: PlannedMeal, key: string) => {
    const r = RECIPE_BY_ID.get(m.recipeId);
    if (!r) return;
    const row = {
      fighter_profile_id: profile.id, entry_date: todayISO(), meal_type: m.slot,
      description: recipeName(r, lang),
      calories: m.kcal, protein_g: m.protein, carbs_g: m.carbs, fat_g: m.fat,
    };
    let { error } = await supabase.from('meal_entries').insert(row);
    if (error && isMissingColumn(error)) {
      ({ error } = await supabase.from('meal_entries').insert({
        fighter_profile_id: profile.id, entry_date: todayISO(),
        meal_type: m.slot, description: recipeName(r, lang),
      }));
    }
    if (error) { showToast(t('error_save'), 'error'); return; }
    setLogged((s) => new Set(s).add(key));
    onMealLogged?.();
    showToast(t('mc_mp_logged'), 'success');
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
          busy={busy}
          canCancel={!!plan}
          onCancel={() => setEditing(false)}
          onSubmit={(p) => build(p)}
        />
      ) : (
        <>
          {/* Barra de acciones del plan guardado */}
          <div className="rk-card flex flex-wrap items-center gap-2" style={{ padding: 14 }}>
            <span className="text-xs text-zinc-400 flex-1 min-w-[160px]">
              {t('mc_mp_saved_on', { date: new Date(plan.createdAt).toLocaleDateString(lang.startsWith('en') ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'long' }) })}
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
            {plan.days.map((d) => {
              const open = openDay === d.day;
              return (
                <div key={d.day} className="rk-card overflow-hidden" style={{ padding: 0 }}>
                  <button onClick={() => setOpenDay(open ? -1 : d.day)}
                    className="w-full flex items-center gap-3 text-left cursor-pointer"
                    style={{ padding: '14px 16px', minHeight: 56 }}>
                    <span className="flex items-center justify-center rounded-xl flex-shrink-0"
                      style={{ width: 36, height: 36, background: 'rgba(225,6,0,0.12)', border: '1px solid rgba(225,6,0,0.3)', color: '#ff6b66', fontFamily: "'Bebas Neue', sans-serif", fontSize: 17 }}>
                      {d.day}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-white">{t('mc_mp_day_n', { n: d.day })}</span>
                      <span className="block text-[11px] text-zinc-500">
                        {d.kcal} kcal · {d.protein} g {t('mc_food_photo_protein').toLowerCase()}
                      </span>
                    </span>
                    <i className={`ri-arrow-down-s-line text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>

                  {open && (
                    <div className="border-t border-white/[0.06] divide-y divide-white/[0.05]">
                      {d.meals.map((m, i) => {
                        const r = RECIPE_BY_ID.get(m.recipeId);
                        if (!r) return null;
                        const key = `${d.day}-${i}`;
                        const done = logged.has(key);
                        const warn = mealWarnings(r, plan.params);
                        return (
                          <div key={key} style={{ padding: '14px 16px' }}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <i className={`${SLOT_ICON[m.slot]} text-zinc-500 text-sm`} />
                              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                                {t(SLOT_KEY[m.slot])}
                              </span>
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
                            <p className="text-sm font-bold text-white leading-snug">{recipeName(r, lang)}</p>
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                              {m.kcal} kcal · P {m.protein} · C {m.carbs} · G {m.fat}
                              {m.servings !== 1 && <> · {t('mc_mp_servings', { n: m.servings })}</>}
                            </p>
                            <p className="text-xs text-zinc-400 leading-relaxed mt-2">{recipeHow(r, lang)}</p>
                            <button onClick={() => logMeal(m, key)} disabled={done}
                              className={`mt-2.5 text-xs inline-flex items-center gap-1.5 cursor-pointer rounded-xl px-3 ${done ? 'text-green-400 cursor-default' : 'rk-nav-btn'}`}
                              style={{ minHeight: 40 }}>
                              <i className={done ? 'ri-check-double-line' : 'ri-add-line'} />
                              {done ? t('mc_mp_logged') : t('mc_mp_log_meal')}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <ShoppingList plan={plan} />
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

// ── Preferencias ───────────────────────────────────────────────

function PreferencesForm({ params, busy, canCancel, onCancel, onSubmit }: {
  params: PlannerParams; busy: boolean; canCancel: boolean;
  onCancel: () => void; onSubmit: (p: PlannerParams) => void;
}) {
  const { t } = useTranslation();
  const [p, setP] = useState<PlannerParams>(params);
  const set = <K extends keyof PlannerParams>(k: K, v: PlannerParams[K]) => setP((s) => ({ ...s, [k]: v }));

  const togglePantry = (tag: Pantry) => setP((s) => ({
    ...s,
    pantry: s.pantry.includes(tag) ? s.pantry.filter((x) => x !== tag) : [...s.pantry, tag],
  }));

  return (
    <div className="rk-card space-y-5" style={{ padding: 18 }}>
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

      <div className="flex flex-wrap gap-2 pt-1">
        <button onClick={() => onSubmit({ ...p, seed: Math.floor(Math.random() * 1e9) })} disabled={busy}
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-bold text-white mb-1">{label}</p>
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

function ShoppingList({ plan }: { plan: MealPlan }) {
  const { t } = useTranslation();
  const tags = useMemo(() => shoppingTags(plan), [plan]);
  if (tags.length === 0) return null;
  return (
    <div className="rk-card" style={{ padding: 18 }}>
      <div className="flex items-center gap-2 mb-2.5">
        <i className="ri-shopping-basket-2-line text-[#C9A84C]" />
        <h3 className="text-sm font-bold text-white">{t('mc_mp_shopping')}</h3>
      </div>
      <p className="text-[11px] text-zinc-500 mb-3 leading-relaxed">{t('mc_mp_shopping_hint')}</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-300"
            style={{ background: 'var(--s-2)', border: '1px solid var(--s-3)' }}>
            {t(`mc_mp_ing_${tag}`)}
          </span>
        ))}
      </div>
    </div>
  );
}
