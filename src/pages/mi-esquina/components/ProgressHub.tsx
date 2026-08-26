import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Profile } from '@/lib/supabase';
import HubTabs, { HubTab } from '@/pages/mi-esquina/components/HubTabs';
import WeightTracker from '@/pages/mi-esquina/components/WeightTracker';
import StrengthLog from '@/pages/mi-esquina/components/StrengthLog';
import ObjectiveWizard from '@/pages/mi-esquina/components/ObjectiveWizard';
import FighterTraining from '@/pages/mi-esquina/components/FighterTraining';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  mode: 'pro' | 'hobby';
  initialTab?: string;
  /** Día concreto con el que abrir Actividad (llega del "+" o de un día del
   * calendario en Agenda). undefined = flujo normal, sin día preseleccionado. */
  initialDate?: string;
}

// R17: la pestaña "Objetivos" absorbe lo que antes era "Plan IA". Toda la
// experiencia de fijar un objetivo y generar un plan a medida vive en el
// mismo lugar (ver ObjectiveWizard). El GoalsPanel tradicional
// (fighter_goals) queda archivado por ahora — el archivo sigue en disco por
// si más adelante se reincorpora como bloque secundario dentro de esta tab.
//
// Orden: Objetivos (dónde vas), Actividad (qué has hecho, registro rápido de
// cualquier tipo de sesión), Fuerza (cargas por grupo muscular) y Peso.
const TABS: HubTab[] = [
  { id: 'objetivos', labelKey: 'mc_nav_goals', icon: 'ri-sparkling-2-line' },
  { id: 'actividad', labelKey: 'mc_pr_tab_activity', icon: 'ri-boxing-line' },
  { id: 'fuerza', labelKey: 'mc_pr_tab_strength', icon: 'ri-hammer-line' },
  { id: 'peso', labelKey: 'mc_pr_tab_weight', icon: 'ri-scales-2-line' },
];

/**
 * Progreso físico: objetivo, actividad, cargas y peso corporal en una sola
 * sección. Todo es "seguir algo en el tiempo", así que va junto con pestañas.
 */
export default function ProgressHub({ profile, showToast, mode, initialTab, initialDate }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<string>(initialTab || 'objetivos');
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);

  return (
    <div className="max-w-4xl">
      <div className="flex justify-end mb-3">
        <button
          onClick={() => window.open('/mi-esquina/informe/imprimir', '_blank', 'noopener')}
          className="rk-btn rk-btn-ghost flex items-center gap-1.5"
          style={{ fontSize: '0.78rem', padding: '0.5rem 1rem' }}
        >
          <i className="ri-file-chart-line"></i> {t('mc_export_report')}
        </button>
      </div>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'peso' && <WeightTracker profile={profile} showToast={showToast} mode={mode} />}
      {tab === 'actividad' && <FighterTraining profile={profile} showToast={showToast} initialDate={initialTab === 'actividad' ? initialDate : undefined} />}
      {tab === 'fuerza' && <StrengthLog profile={profile} showToast={showToast} />}
      {tab === 'objetivos' && <ObjectiveWizard profile={profile} showToast={showToast} />}
    </div>
  );
}
