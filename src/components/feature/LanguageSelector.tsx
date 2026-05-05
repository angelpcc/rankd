import { useTranslation } from 'react-i18next';

interface Props {
  scrolled?: boolean;
  dark?: boolean;
}

export default function LanguageSelector({ scrolled = false, dark = false }: Props) {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.startsWith('es') ? 'es' : 'en';

  const toggle = () => {
    const next = currentLang === 'es' ? 'en' : 'es';
    i18n.changeLanguage(next);
  };

  const isDark = dark || !scrolled;

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1.5 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full border transition-all cursor-pointer whitespace-nowrap font-inter ${
        isDark
          ? 'border-white/15 text-white/50 hover:border-white/40 hover:text-white'
          : 'border-gray-200 text-gray-500 hover:border-[#E10600] hover:text-[#E10600]'
      }`}
      title={currentLang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
    >
      <span className={currentLang === 'es' ? 'opacity-100' : 'opacity-40'}>ES</span>
      <span className={isDark ? 'text-white/20' : 'text-gray-300'}>/</span>
      <span className={currentLang === 'en' ? 'opacity-100' : 'opacity-40'}>EN</span>
    </button>
  );
}
