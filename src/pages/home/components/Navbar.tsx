import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import LanguageSelector from '@/components/feature/LanguageSelector';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
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
    <nav style={{
      position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 100,
      background: scrolled ? 'rgba(5,5,5,0.96)' : 'transparent',
      backdropFilter: scrolled ? 'blur(24px)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(255,255,255,0.04)' : '1px solid transparent',
      transition: 'all 0.4s ease',
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 40px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Logo */}
        <a href="#home" onClick={(e) => { e.preventDefault(); handleNav('#home'); }} style={{ cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#ffffff', letterSpacing: 4, lineHeight: 1 }}>RAN</span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#E10600', letterSpacing: 4, lineHeight: 1 }}>KD</span>
          <span style={{ width: 6, height: 6, background: '#C9A84C', borderRadius: '50%', marginLeft: 4, marginTop: 2 }}></span>
        </a>

        {/* Desktop Links */}
        <ul style={{ display: 'flex', alignItems: 'center', gap: 36, listStyle: 'none', margin: 0, padding: 0 }} className="nav-desktop">
          {navLinks.map((link) => (
            <li key={link.href}>
              <a href={link.href} onClick={(e) => { e.preventDefault(); handleNav(link.href); }}
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', textDecoration: 'none', transition: 'color 0.2s', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.color = 'white'}
                onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.45)'}
              >
                {t(link.labelKey)}
              </a>
            </li>
          ))}
        </ul>

        {/* Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="nav-desktop">
          <LanguageSelector scrolled={false} />
          {user && profile ? (
            <>
              <button onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '9px 18px', cursor: 'pointer', transition: 'all 0.2s' }}>
                <span style={{ width: 20, height: 20, background: '#E10600', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'white', fontWeight: 900 }}>{(profile.full_name || 'U')[0].toUpperCase()}</span>
                {t('nav_my_profile')}
              </button>
              <button onClick={() => signOut()} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: 2, color: 'rgba(255,255,255,0.2)', background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase' }}>{t('nav_sign_out')}</button>
            </>
          ) : (
            <>
              <button onClick={() => navigate('/auth')} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.color = 'white'} onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)'}>{t('nav_sign_in')}</button>
              <button onClick={() => navigate('/auth')} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'white', background: '#E10600', border: 'none', borderRadius: 6, padding: '10px 22px', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = '#b50009'} onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = '#E10600'}>
                {t('nav_create_account')} →
              </button>
            </>
          )}
        </div>

        {/* Hamburger */}
        <button onClick={() => setMenuOpen(!menuOpen)} style={{ display: 'none', background: 'none', border: 'none', color: 'white', fontSize: 22, cursor: 'pointer' }} className="nav-mobile">
          <i className={menuOpen ? 'ri-close-line' : 'ri-menu-3-line'} />
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div style={{ background: 'rgba(5,5,5,0.98)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} onClick={(e) => { e.preventDefault(); handleNav(link.href); }}
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              {t(link.labelKey)}
            </a>
          ))}
          <div style={{ paddingTop: 16 }}><LanguageSelector dark /></div>
          {!user && (
            <button onClick={() => { navigate('/auth'); setMenuOpen(false); }} style={{ marginTop: 12, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'white', background: '#E10600', border: 'none', borderRadius: 8, padding: '14px', cursor: 'pointer' }}>{t('nav_create_account')}</button>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .nav-desktop { display: none !important; }
          .nav-mobile { display: flex !important; }
        }
      `}</style>
    </nav>
  );
}
