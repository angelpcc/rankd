import { useState, useEffect } from 'react';
import { Profile } from '@/lib/supabase';
import HubTabs, { HubTab } from '@/pages/mi-esquina/components/HubTabs';
import SparringLog from '@/pages/mi-esquina/components/SparringLog';
import FightAnalysis from '@/pages/mi-esquina/components/FightAnalysis';
import TechniqueNotes from '@/pages/mi-esquina/components/TechniqueNotes';
import DocumentsPanel from '@/pages/mi-esquina/components/DocumentsPanel';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  initialTab?: string;
}

// Documentos (licencias, seguros…) entra aquí como subsección: es papeleo de
// competición, del mismo mundo que el ring (R15-B7: menos categorías arriba).
const TABS: HubTab[] = [
  { id: 'sparring', labelKey: 'mc_rg_sparring', icon: 'ri-boxing-line' },
  { id: 'combates', labelKey: 'mc_rg_fights', icon: 'ri-sword-line' },
  { id: 'notas', labelKey: 'mc_rg_notes', icon: 'ri-book-open-line' },
  { id: 'documentos', labelKey: 'mc_nav_docs', icon: 'ri-folder-shield-2-line' },
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
      {tab === 'documentos' && <DocumentsPanel profile={profile} showToast={showToast} />}
    </div>
  );
}
