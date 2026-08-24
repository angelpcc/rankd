import { useTranslation } from 'react-i18next';
import LegalPage from '@/pages/legal/LegalPage';
import { avisoLegalContent, LEGAL_UPDATED, LEGAL_FOOTER } from '@/pages/legal/content';

export default function AvisoLegalPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'es';
  return (
    <LegalPage
      title={t('lg_aviso_title')}
      updatedLabel={LEGAL_UPDATED[lang]}
      sections={avisoLegalContent[lang]}
      footerNote={LEGAL_FOOTER[lang]}
      altHref="/privacidad"
      altLabel={t('lg_privacy_title')}
      seoDescription={t('lg_seo_aviso')}
    />
  );
}
