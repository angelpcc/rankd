import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, type Profile } from '@/lib/supabase';
import { isMissingColumn } from '@/lib/dbState';
import HubTabs, { HubTab } from '@/pages/mi-esquina/components/HubTabs';
import MealLog from '@/pages/mi-esquina/components/MealLog';
import FoodPhotoAnalyzer from '@/pages/mi-esquina/components/FoodPhotoAnalyzer';
import type { NutritionAnalysis } from '@/services/nutritionAnalysis';
import NutritionTracker from '@/pages/mi-esquina/components/NutritionTracker';
import SupplementTracker from '@/pages/mi-esquina/components/SupplementTracker';
import SectionCoach from '@/pages/mi-esquina/components/SectionCoach';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Sin selector de franja en el flujo de foto: se infiere de la hora actual.
function inferMealType(): string {
  const h = new Date().getHours();
  if (h < 11) return 'desayuno';
  if (h < 16) return 'comida';
  if (h < 20) return 'snack';
  return 'cena';
}

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  isHobby: boolean;
  /** Puente al Progreso › Peso desde el bloque de agua y desde la Guía. */
  onGoWeight: () => void;
}

interface NutritionGuideItem { icon: string; t: string; b: string }

/**
 * Nutrición dividida en pestañas (R17b). Antes era scroll infinito hacia
 * abajo con todos los bloques apilados; ahora cada apartado vive en su
 * propia tab para que se navegue como Progreso. El aviso sanitario queda
 * FUERA de las tabs — siempre visible arriba, no es un contenido que se
 * elija ver, es una condición de uso.
 *
 * Tabs:
 *  - Diario     · MealLog + puente a control de peso al final
 *  - Foto       · FoodPhotoAnalyzer (gated "muy pronto" sin API key)
 *  - Agua       · NutritionTracker (contador de hidratación)
 *  - Coach IA   · SectionCoach de nutrición (gated "muy pronto")
 *  - Guía       · tarjetas informativas + disclaimer
 */
export default function NutritionHub({ profile, showToast, isHobby, onGoWeight }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'diario' | 'foto' | 'agua' | 'suplementos' | 'advisor' | 'guia'>('diario');

  const TABS: HubTab[] = [
    { id: 'diario', labelKey: 'mc_ng_tab_diary', icon: 'ri-restaurant-line' },
    { id: 'foto', labelKey: 'mc_ng_tab_photo', icon: 'ri-camera-line' },
    { id: 'agua', labelKey: 'mc_ng_tab_water', icon: 'ri-drop-line' },
    { id: 'suplementos', labelKey: 'mc_ng_tab_supplements', icon: 'ri-capsule-line' },
    { id: 'advisor', labelKey: 'mc_ng_tab_advisor', icon: 'ri-compass-3-line' },
    { id: 'guia', labelKey: 'mc_ng_tab_guide', icon: 'ri-book-open-line' },
  ];

  // La guía informativa se calcula igual que en la implementación anterior:
  // el bloque de "peso" se bifurca por perfil (competición vs aficionado).
  const NUTRITION_GUIDE: NutritionGuideItem[] = [
    { icon: 'ri-drop-line', t: 'mc_ng_hydration_t', b: 'mc_ng_hydration_b' },
    { icon: 'ri-restaurant-2-line', t: 'mc_ng_before_t', b: 'mc_ng_before_b' },
    { icon: 'ri-flashlight-line', t: 'mc_ng_after_t', b: 'mc_ng_after_b' },
    isHobby
      ? { icon: 'ri-heart-pulse-line', t: 'mc_ng_fatloss_t', b: 'mc_ng_fatloss_b' }
      : { icon: 'ri-scales-2-line', t: 'mc_ng_cut_t', b: 'mc_ng_cut_b' },
    { icon: 'ri-capsule-line', t: 'mc_ng_supp_t', b: 'mc_ng_supp_b' },
    { icon: 'ri-moon-line', t: 'mc_ng_sleep_t', b: 'mc_ng_sleep_b' },
  ];

  // "Guardar en diario" del análisis de foto: lo añade a meal_entries con las
  // macros estimadas. Si falla, lanza para que FoodPhotoAnalyzer NO muestre
  // su toast de éxito ni resetee la tarjeta.
  const saveFoodPhoto = async (analysis: NutritionAnalysis) => {
    const description = analysis.alimentos.length > 0
      ? analysis.alimentos.map((a) => a.nombre).join(', ')
      : t('mc_food_photo_title');
    const full = {
      fighter_profile_id: profile.id, entry_date: todayISO(), meal_type: inferMealType(), description,
      calories: Math.round(analysis.total.calorias), protein_g: Math.round(analysis.total.proteina),
      carbs_g: Math.round(analysis.total.carbohidratos), fat_g: Math.round(analysis.total.grasas),
    };
    let { error } = await supabase.from('meal_entries').insert(full);
    if (error && isMissingColumn(error)) {
      ({ error } = await supabase.from('meal_entries').insert({
        fighter_profile_id: profile.id, entry_date: todayISO(), meal_type: inferMealType(), description,
      }));
    }
    if (error) { showToast(t('error_save'), 'error'); throw error; }
  };

  return (
    <div className="max-w-4xl">
      {/* Resumen del día — SIEMPRE arriba del todo, compacto en una línea. */}
      <TodayMacrosSummary profile={profile} />

      <HubTabs tabs={TABS} active={tab} onChange={(id) => setTab(id as typeof tab)} />

      {/* ── DIARIO ── */}
      {tab === 'diario' && (
        <div className="space-y-8 mt-6">
          <header>
            <p className="rk-eyebrow">{t('mc_ng_log_title')}</p>
            <h2 className="rk-h3" style={{ fontSize: '1.25rem', color: '#fff', margin: '4px 0 0' }}>
              {t('mc_ng_log_head')} <span className="rk-red-glow">{t('mc_ng_log_head_2')}</span>
            </h2>
            <p className="rk-body-14 mt-1">{t('mc_ng_log_sub')}</p>
          </header>
          <MealLog profile={profile} showToast={showToast} />
          {/* Puente al Peso: antes era un bloque "Resumen del día" aparte; se
              integra aquí como acción de cierre del diario para no ocupar
              una tab entera sin contenido propio todavía. */}
          <div className="rk-card flex items-center gap-3 flex-wrap" style={{ padding: 16 }}>
            <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-white/[0.05] border border-white/10 text-[#C9A84C]">
              <i className="ri-scales-2-line text-lg" />
            </div>
            <p className="text-sm text-zinc-300 flex-1 min-w-[180px]">{t('mc_ng_summary_desc')}</p>
            <button onClick={onGoWeight} className="rk-nav-btn text-xs flex items-center gap-1.5"
              style={{ padding: '0.55rem 1rem' }}>
              {t('mc_ng_summary_go_weight')}<i className="ri-arrow-right-line" />
            </button>
          </div>
        </div>
      )}

      {/* ── FOTO ── */}
      {tab === 'foto' && (
        <div className="mt-6"><FoodPhotoAnalyzer showToast={showToast} onSave={saveFoodPhoto} /></div>
      )}

      {/* ── AGUA ── */}
      {tab === 'agua' && (
        <div className="mt-6"><NutritionTracker profile={profile} showToast={showToast} onGoWeight={onGoWeight} /></div>
      )}

      {/* ── SUPLEMENTOS ── */}
      {tab === 'suplementos' && (
        <div className="mt-6"><SupplementTracker profile={profile} showToast={showToast} /></div>
      )}

      {/* ── ASESOR ── */}
      {tab === 'advisor' && (
        <div className="mt-6">
          <SectionCoach
            section="nutrition"
            profile={profile}
            showToast={showToast}
            accent="sky"
            title={t('mc_ng_coach_title')}
            intro={isHobby ? t('mc_ng_coach_intro_hobby') : t('mc_ng_coach_intro_pro')}
            suggestions={isHobby
              ? [t('mc_ng_sug_hobby_1'), t('mc_ng_sug_hobby_2'), t('mc_ng_sug_hobby_3')]
              : [t('mc_ng_sug_pro_1'), t('mc_ng_sug_pro_2'), t('mc_ng_sug_pro_3')]}
          />
        </div>
      )}

      {/* ── GUÍA ── */}
      {tab === 'guia' && (
        <div className="space-y-8 mt-6">
          <header>
            <p className="rk-eyebrow">{t('mc_ng_eyebrow')}</p>
            <h2 className="rk-h3" style={{ fontSize: '1.15rem', color: '#fff', margin: '4px 0 0' }}>
              {t('mc_ng_title')} <span className="rk-red-glow">{t('mc_ng_title_2')}</span>
            </h2>
            <p className="rk-body-14 mt-1">{t('mc_ng_sub')}</p>
          </header>
          <div className="grid sm:grid-cols-2 gap-4 items-stretch">
            {NUTRITION_GUIDE.map((n) => (
              <div key={n.t} className="rk-card h-full" style={{ padding: 20 }}>
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-green-500/10 border border-green-500/25 text-green-400">
                    <i className={`${n.icon} text-lg`} />
                  </div>
                  <h3 className="text-base font-bold text-white">{t(n.t)}</h3>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{t(n.b)}</p>
              </div>
            ))}
          </div>
          <div className="rk-card flex items-start gap-3" style={{ padding: 16 }}>
            <i className="ri-information-line text-zinc-500 mt-0.5" />
            <p className="text-[11px] text-zinc-500 leading-relaxed">{t('mc_ng_disclaimer')}</p>
          </div>
        </div>
      )}

      {/* Aviso sanitario — al FINAL y compacto: siempre visible pero sin ocupar
          media pantalla al entrar. Es una condición de uso, no un contenido. */}
      <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5 mt-8 pt-4 border-t border-white/[0.06]">
        <i className="ri-heart-pulse-line text-[#C9A84C] mt-0.5 flex-shrink-0" />
        {t('mc_ng_safety_banner')}
      </p>
    </div>
  );
}

interface DayMacros { calories: number; protein: number; carbs: number; fat: number; withMacros: number; total: number }

/**
 * Resumen rápido del día, arriba de las tabs: "Hoy: X kcal | proteína | carbos
 * | grasas". Suma real de meal_entries (migración 0036) — comidas escritas a
 * mano sin macros cuentan en el total de comidas pero no en los gramos/kcal.
 */
function TodayMacrosSummary({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const [data, setData] = useState<DayMacros | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: rows } = await supabase.from('meal_entries')
        .select('calories, protein_g, carbs_g, fat_g')
        .eq('fighter_profile_id', profile.id).eq('entry_date', todayISO());
      if (!alive) return;
      const list = rows || [];
      const withMacros = list.filter((r) => r.calories !== null);
      const sum = withMacros.reduce((acc, r) => ({
        calories: acc.calories + (r.calories || 0), protein: acc.protein + (r.protein_g || 0),
        carbs: acc.carbs + (r.carbs_g || 0), fat: acc.fat + (r.fat_g || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
      setData({ ...sum, withMacros: withMacros.length, total: list.length });
    })();
    return () => { alive = false; };
  }, [profile.id]);

  if (!data) return null;

  return (
    <div className="rk-card flex items-center gap-2 sm:gap-4 mb-5 overflow-x-auto" style={{ padding: '12px 16px' }}>
      <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 flex-shrink-0">{t('mc_ng_today_summary')}</span>
      <span className="text-sm text-white flex-shrink-0">
        {Math.round(data.calories)} <span className="text-zinc-500 text-xs">kcal</span>
      </span>
      <span className="text-zinc-700 flex-shrink-0">·</span>
      <span className="text-sm text-white flex-shrink-0">
        {t('mc_food_photo_protein')} <span className="text-zinc-300">{Math.round(data.protein)}g</span>
      </span>
      <span className="text-sm text-white flex-shrink-0">
        {t('mc_food_photo_carbs')} <span className="text-zinc-300">{Math.round(data.carbs)}g</span>
      </span>
      <span className="text-sm text-white flex-shrink-0">
        {t('mc_food_photo_fat')} <span className="text-zinc-300">{Math.round(data.fat)}g</span>
      </span>
      {data.total > data.withMacros && (
        <span className="text-[10px] text-zinc-600 flex-shrink-0 ml-auto whitespace-nowrap">{t('mc_ng_today_summary_partial', { n: data.withMacros, total: data.total })}</span>
      )}
    </div>
  );
}
