import { useState, useEffect } from 'react';
import { Profile } from '@/lib/supabase';
import HubTabs, { HubTab } from '@/pages/mi-esquina/components/HubTabs';
import SparringLog from '@/pages/mi-esquina/components/SparringLog';
import FightAnalysis from '@/pages/mi-esquina/components/FightAnalysis';
import TechniqueNotes from '@/pages/mi-esquina/components/TechniqueNotes';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  initialTab?: string;
}

const TABS: HubTab[] = [
  { id: 'sparring', labelKey: 'mc_rg_sparring', icon: 'ri-boxing-line' },
  { id: 'combates', labelKey: 'mc_rg_fights', icon: 'ri-sword-line' },
  { id: 'notas', labelKey: 'mc_rg_notes', icon: 'ri-book-open-line' },
];

/**
 * Ring: todo lo que es revisar tu propio material de pelea. Sparring (vídeo y
 * registro), análisis de combates y libreta técnica, juntos con pestañas.
 * Solo perfil competitivo.
 */
export default function RingHub({ profile, showToast, initialTab }: Props) {
  const [tab, setTab] = useState<string>(initialTab || 'sparring');
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);

  return (
    <div className="max-w-4xl">
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'sparring' && <SparringLog profile={profile} showToast={showToast} />}
      {tab === 'combates' && <FightAnalysis profile={profile} showToast={showToast} />}
      {tab === 'notas' && <TechniqueNotes profile={profile} showToast={showToast} />}
    </div>
  );
}
