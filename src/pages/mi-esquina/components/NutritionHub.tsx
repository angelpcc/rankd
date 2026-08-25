import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, type Profile } from '@/lib/supabase';
import { isMissingColumn } from '@/lib/dbState';
import HubTabs, { HubTab } from '@/pages/mi-esquina/components/HubTabs';
import MealLog from '@/pages/mi-esquina/components/MealLog';
import FoodPhotoAnalyzer from '@/pages/mi-esquina/components/FoodPhotoAnalyzer';
import type { NutritionAnalysis } from '@/services/nutritionAnalysis';
import NutritionTracker from '@/pages/mi-esquina/components/NutritionTracker';
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
  const [tab, setTab] = useState<'diario' | 'foto' | 'agua' | 'coach' | 'guia'>('diario');

  const TABS: HubTab[] = [
    { id: 'diario', labelKey: 'mc_ng_tab_diary', icon: 'ri-restaurant-line' },
    { id: 'foto', labelKey: 'mc_ng_tab_photo', icon: 'ri-camera-line' },
    { id: 'agua', labelKey: 'mc_ng_tab_water', icon: 'ri-drop-line' },
    { id: 'coach', labelKey: 'mc_ng_tab_coach', icon: 'ri-sparkling-2-line' },
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
      {/* Aviso sanitario permanente: FUERA de tabs para que no se pueda
          ocultar por accidente. Es una condición de uso, no un contenido. */}
      <div className="flex items-start gap-3 rounded-2xl border border-[#C9A84C]/30 bg-[#C9A84C]/[0.07] px-4 py-3.5 mb-5">
        <i className="ri-heart-pulse-line text-[#C9A84C] text-lg mt-0.5 flex-shrink-0" />
        <p className="text-xs text-zinc-300 leading-relaxed">{t('mc_ng_safety_banner')}</p>
      </div>

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

      {/* ── COACH IA ── */}
      {tab === 'coach' && (
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
          <div className="grid sm:grid-cols-2 gap-4">
            {NUTRITION_GUIDE.map((n) => (
              <div key={n.t} className="rk-card" style={{ padding: 20 }}>
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
    </div>
  );
}
