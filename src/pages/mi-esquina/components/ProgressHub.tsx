import { useState, useEffect } from 'react';
import { Profile } from '@/lib/supabase';
import HubTabs, { HubTab } from '@/pages/mi-esquina/components/HubTabs';
import WeightTracker from '@/pages/mi-esquina/components/WeightTracker';
import StrengthLog from '@/pages/mi-esquina/components/StrengthLog';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  mode: 'pro' | 'hobby';
  initialTab?: string;
}

const TABS: HubTab[] = [
  { id: 'peso', labelKey: 'mc_pr_tab_weight', icon: 'ri-scales-2-line' },
  { id: 'fuerza', labelKey: 'mc_pr_tab_strength', icon: 'ri-hammer-line' },
];

/**
 * Progreso físico: peso corporal y cargas/marcas en una sola sección. Ambos
 * son "seguir un número en el tiempo", así que van juntos con pestañas.
 */
export default function ProgressHub({ profile, showToast, mode, initialTab }: Props) {
  const [tab, setTab] = useState<string>(initialTab || 'peso');
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);

  return (
    <div className="max-w-4xl">
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'peso' && <WeightTracker profile={profile} showToast={showToast} mode={mode} />}
      {tab === 'fuerza' && <StrengthLog profile={profile} showToast={showToast} />}
    </div>
  );
}
