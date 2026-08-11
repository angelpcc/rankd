import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Profile } from '@/lib/supabase';
import HubTabs, { HubTab } from '@/pages/mi-esquina/components/HubTabs';
import GearChecklist from '@/pages/mi-esquina/components/GearChecklist';
import GearBrands from '@/pages/mi-esquina/components/GearBrands';
import SectionCoach from '@/pages/mi-esquina/components/SectionCoach';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  mode: 'pro' | 'hobby';
}

/**
 * Material dividido en pestañas (R17b). Antes iba todo scrolleado hacia
 * abajo (equipo, marcas, asesor); ahora cada apartado vive en su tab, igual
 * que Progreso.
 *
 * Tabs:
 *  - Mi equipo · GearChecklist (lo que tiene el peleador y cuándo caduca)
 *  - Marcas    · GearBrands (referencia por gama, sin acuerdos comerciales)
 *  - Asesor    · SectionCoach de material (gated "muy pronto")
 */
export default function GearHub({ profile, showToast, mode }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'equipo' | 'marcas' | 'asesor'>('equipo');

  const TABS: HubTab[] = [
    { id: 'equipo', labelKey: 'mc_gr_tab_gear', icon: 'ri-t-shirt-line' },
    { id: 'marcas', labelKey: 'mc_gr_tab_brands', icon: 'ri-store-2-line' },
    { id: 'asesor', labelKey: 'mc_gr_tab_coach', icon: 'ri-sparkling-2-line' },
  ];

  return (
    <div className="max-w-4xl">
      <HubTabs tabs={TABS} active={tab} onChange={(id) => setTab(id as typeof tab)} />

      {tab === 'equipo' && (
        <GearChecklist profile={profile} showToast={showToast} />
      )}

      {tab === 'marcas' && (
        <GearBrands profile={profile} mode={mode} />
      )}

      {tab === 'asesor' && (
        <div className="space-y-4">
          <header>
            <p className="rk-eyebrow">{t('mc_gear_ask_ai')}</p>
            <h2 className="rk-h3" style={{ fontSize: '1.25rem', color: '#fff', margin: '4px 0 0' }}>
              {t('mc_nav_gear')}
            </h2>
            <p className="rk-body-14 mt-1">{t('mc_gear_ask_ai_desc')}</p>
          </header>
          <SectionCoach
            section="gear"
            profile={profile}
            showToast={showToast}
            accent="red"
            title={t('mc_nav_gear')}
            intro={t('mc_gear_ask_ai_desc')}
            suggestions={[t('mc_gear_sug_1'), t('mc_gear_sug_2'), t('mc_gear_sug_3'), t('mc_gear_sug_4')]}
          />
        </div>
      )}
    </div>
  );
}
