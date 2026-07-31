import { useTranslation } from 'react-i18next';
import LegalPage from '@/pages/legal/LegalPage';
import { privacyContent, LEGAL_UPDATED, LEGAL_FOOTER } from '@/pages/legal/content';

export default function PrivacyPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'es';
  return (
    <LegalPage
      title={t('lg_privacy_title')}
      updatedLabel={LEGAL_UPDATED[lang]}
      sections={privacyContent[lang]}
      footerNote={LEGAL_FOOTER[lang]}
      altHref="/terms"
      altLabel={t('lg_terms_title')}
      seoDescription={t('lg_seo_privacy')}
    />
  );
}
