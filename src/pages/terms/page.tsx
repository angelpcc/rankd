import { useTranslation } from 'react-i18next';
import LegalPage from '@/pages/legal/LegalPage';
import { termsContent, LEGAL_UPDATED, LEGAL_FOOTER } from '@/pages/legal/content';

export default function TermsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'es';
  return (
    <LegalPage
      title={t('lg_terms_title')}
      updatedLabel={LEGAL_UPDATED[lang]}
      sections={termsContent[lang]}
      footerNote={LEGAL_FOOTER[lang]}
      altHref="/privacy"
      altLabel={t('lg_privacy_title')}
      seoDescription={t('lg_seo_terms')}
    />
  );
}
