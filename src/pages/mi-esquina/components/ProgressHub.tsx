import { useState, useEffect } from 'react';
import { Profile } from '@/lib/supabase';
import HubTabs, { HubTab } from '@/pages/mi-esquina/components/HubTabs';
import WeightTracker from '@/pages/mi-esquina/components/WeightTracker';
import StrengthLog from '@/pages/mi-esquina/components/StrengthLog';
import ObjectiveWizard from '@/pages/mi-esquina/components/ObjectiveWizard';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  mode: 'pro' | 'hobby';
  initialTab?: string;
}

// R17: la pestaña "Objetivos" absorbe lo que antes era "Plan IA". Toda la
// experiencia de fijar un objetivo y generar un plan a medida vive en el
// mismo lugar (ver ObjectiveWizard). El GoalsPanel tradicional
// (fighter_goals) queda archivado por ahora — el archivo sigue en disco por
// si más adelante se reincorpora como bloque secundario dentro de esta tab.
//
// Orden intencional: Objetivos primero (dónde vas), Fuerza en medio (cómo
// trabajas) y Peso al final (la medida). Antes iba Peso primero, pero eso
// dejaba lo importante — el plan — enterrado a la derecha.
const TABS: HubTab[] = [
  { id: 'objetivos', labelKey: 'mc_nav_goals', icon: 'ri-sparkling-2-line' },
  { id: 'fuerza', labelKey: 'mc_pr_tab_strength', icon: 'ri-hammer-line' },
  { id: 'peso', labelKey: 'mc_pr_tab_weight', icon: 'ri-scales-2-line' },
];

/**
 * Progreso físico: peso corporal y cargas/marcas en una sola sección. Ambos
 * son "seguir un número en el tiempo", así que van juntos con pestañas.
 */
export default function ProgressHub({ profile, showToast, mode, initialTab }: Props) {
  const [tab, setTab] = useState<string>(initialTab || 'objetivos');
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);

  return (
    <div className="max-w-4xl">
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'peso' && <WeightTracker profile={profile} showToast={showToast} mode={mode} />}
      {tab === 'fuerza' && <StrengthLog profile={profile} showToast={showToast} />}
      {tab === 'objetivos' && <ObjectiveWizard profile={profile} showToast={showToast} />}
    </div>
  );
}
