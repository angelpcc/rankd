import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import LanguageSelector from '@/components/feature/LanguageSelector';

function RankdLogo() {
  return (
    <div className="flex items-center gap-0 select-none">
      <span className="font-unbounded font-black leading-none" style={{ fontSize: '20px', color: '#FFFFFF', letterSpacing: '-0.05em' }}>RAN</span>
      <span className="font-unbounded font-black leading-none" style={{ fontSize: '20px', color: '#E10600', letterSpacing: '-0.05em' }}>KD</span>
    </div>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { labelKey: 'nav_how_it_works', href: '#how-it-works', isAnchor: true },
    { labelKey: 'nav_directory', href: '/fighters', isAnchor: false },
    { labelKey: 'nav_opportunities', href: '/opportunities', isAnchor: false },
    { labelKey: 'nav_brands', href: '/brands', isAnchor: false },
    { labelKey: 'nav_contact', href: '#contact', isAnchor: true },
  ];

  const handleNav = (href: string) => {
    setMenuOpen(false);
    if (href.startsWith('#')) {
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(href);
    }
  };

  return (
    <nav
      className="fixed top-0 left-0 w-full z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(8,8,8,0.97)' : 'transparent',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
      }}
    >
      <div
        className="absolute top-0 left-0 h-[2px] bg-[#E10600] transition-all duration-700"
        style={{ width: scrolled ? '100%' : '0%' }}
      />
      <div className="max-w-7xl mx-auto px-6 md:px-10 flex items-center justify-between" style={{ height: '72px' }}>
        <a href="#home" onClick={(e) => { e.preventDefault(); handleNav('#home'); }} className="cursor-pointer">
          <RankdLogo />
        </a>
        <ul className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={(e) => { e.preventDefault(); handleNav(link.href); }}
                className="text-sm font-medium tracking-wide transition-colors cursor-pointer whitespace-nowrap font-inter text-white/50 hover:text-white"
              >
                {t(link.labelKey)}
              </a>
            </li>
          ))}
        </ul>
        <div className="hidden md:flex items-center gap-3">
          <LanguageSelector scrolled={false} />
          {user && profile ? (
            <>
              <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full border border-white/15 text-white/70 hover:border-white/40 hover:text-white transition-colors cursor-pointer whitespace-nowrap">
                <div className="w-5 h-5 flex items-center justify-center rounded-full bg-[#E10600] text-white text-xs font-bold">
                  {(profile.full_name || 'U')[0].toUpperCase()}
                </div>
                {t('nav_my_profile')}
              </button>
              <button onClick={() => signOut()} className="text-sm font-medium text-white/30 hover:text-white transition-colors cursor-pointer whitespace-nowrap">{t('nav_sign_out')}</button>
            </>
          ) : (
            <>
              <button onClick={() => navigate('/auth')} className="text-sm font-medium text-white/50 hover:text-white transition-colors cursor-pointer whitespace-nowrap">{t('nav_sign_in')}</button>
              <button onClick={() => navigate('/auth')} className="flex items-center gap-2 bg-[#E10600] text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap">
                {t('nav_create_account')} <i className="ri-arrow-right-line" />
              </button>
            </>
          )}
        </div>
        <button className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg text-white/70 hover:text-white transition-colors" onClick={() => setMenuOpen(!menuOpen)}>
          <i className={`text-xl ${menuOpen ? 'ri-close-line' : 'ri-menu-3-line'}`} />
        </button>
      </div>
      {menuOpen && (
        <div className="md:hidden px-6 py-5 flex flex-col gap-2" style={{ background: 'rgba(8,8,8,0.98)', borderTop: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)' }}>
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} onClick={(e) => { e.preventDefault(); handleNav(link.href); }} className="text-white/60 font-medium text-sm py-3 px-2 cursor-pointer hover:text-white transition-colors border-b border-white/5 last:border-0">
              {t(link.labelKey)}
            </a>
          ))}
          <div className="pt-2 pb-1"><LanguageSelector dark /></div>
          {user && profile ? (
            <button onClick={() => { navigate('/dashboard'); setMenuOpen(false); }} className="mt-2 bg-[#E10600] text-white text-sm font-semibold px-5 py-3.5 rounded-full text-center cursor-pointer">{t('nav_my_profile')}</button>
          ) : (
            <button onClick={() => { navigate('/auth'); setMenuOpen(false); }} className="mt-2 bg-[#E10600] text-white text-sm font-semibold px-5 py-3.5 rounded-full text-center cursor-pointer">{t('nav_create_account')}</button>
          )}
        </div>
      )}
    </nav>
  );
}
