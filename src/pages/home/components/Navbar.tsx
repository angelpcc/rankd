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

  // Bloquear scroll del body cuando menú abierto
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const isHobby = profile?.athlete_mode === 'hobby';

  // Los que entrenan por afición no necesitan el marketplace: menú simplificado
  const navLinks = isHobby
    ? [
        { label: 'Mi Esquina', href: '/mi-esquina', isAnchor: false },
        { label: 'Eventos', href: '/eventos', isAnchor: false },
        { label: 'Noticias', href: '/noticias', isAnchor: false },
        { label: 'Marcas', href: '/brands', isAnchor: false },
        { label: 'Tienda', href: '/tienda', isAnchor: false },
      ]
    : [
        { labelKey: 'nav_how_it_works', href: '#how-it-works', isAnchor: true },
        { labelKey: 'nav_directory', href: '/fighters', isAnchor: false },
        { labelKey: 'nav_opportunities', href: '/opportunities', isAnchor: false },
        { label: 'Eventos', href: '/eventos', isAnchor: false },
        { label: 'Noticias', href: '/noticias', isAnchor: false },
        { label: 'Mi Esquina', href: '/esquina', isAnchor: false },
        { labelKey: 'nav_brands', href: '/brands', isAnchor: false },
        { label: 'Tienda', href: '/tienda', isAnchor: false },
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
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 100,
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: scrolled || menuOpen ? 'rgba(5,5,5,0.98)' : 'transparent',
        backdropFilter: scrolled || menuOpen ? 'blur(24px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.04)' : '1px solid transparent',
        transition: 'background 0.4s ease, backdrop-filter 0.4s ease, border-color 0.4s ease',
      }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          padding: '0 24px',
          height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>

          {/* Logo */}
          <a href="#home" onClick={(e) => { e.preventDefault(); handleNav('#home'); }} style={{ cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: '#ffffff', letterSpacing: 4, lineHeight: 1 }}>RAN</span>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: '#E10600', letterSpacing: 4, lineHeight: 1 }}>KD</span>
            <span style={{ width: 6, height: 6, background: '#C9A84C', borderRadius: '50%', marginLeft: 4, marginTop: 2, flexShrink: 0 }} />
          </a>

          {/* Desktop Links */}
          <ul className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 32, listStyle: 'none', margin: 0, padding: 0 }}>
            {navLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} onClick={(e) => { e.preventDefault(); handleNav(link.href); }}
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.68)', textDecoration: 'none', transition: 'color 0.2s', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.color = 'white'}
                  onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.68)'}>
                  {link.labelKey ? t(link.labelKey) : link.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Auth — Desktop */}
          <div className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LanguageSelector scrolled={false} />
            {user && profile ? (
              <>
                <button onClick={() => navigate(isHobby ? '/mi-esquina' : '/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', transition: 'all 0.28s cubic-bezier(0.22,1,0.36,1)', backdropFilter: 'blur(10px)' }}>
                  <span style={{ width: 20, height: 20, background: '#E10600', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'white', fontWeight: 900 }}>{(profile.full_name || 'U')[0].toUpperCase()}</span>
                  {t('nav_my_profile')}
                </button>
                <button onClick={() => signOut()} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase' }}>{t('nav_sign_out')}</button>
              </>
            ) : (
              <>
                <button onClick={() => navigate('/auth')} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.color = 'white'} onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)'}>{t('nav_sign_in')}</button>
                <button onClick={() => navigate('/auth')} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'white', background: '#E10600', border: 'none', borderRadius: 6, padding: '10px 22px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 24px rgba(225,6,0,0.4)' }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#b50009'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 32px rgba(225,6,0,0.55)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#E10600'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 24px rgba(225,6,0,0.4)'; }}>
                  {t('nav_create_account')} →
                </button>
              </>
            )}
          </div>

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="nav-mobile"
            style={{ background: 'none', border: 'none', color: 'white', fontSize: 24, cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Menú"
          >
            <i className={menuOpen ? 'ri-close-line' : 'ri-menu-3-line'} />
          </button>
        </div>

        {/* Mobile Menu — dropdown */}
        <div className="mobile-menu" style={{
          maxHeight: menuOpen ? '100vh' : '0',
          overflow: 'hidden',
          transition: 'max-height 0.35s ease',
          background: 'rgba(5,5,5,0.99)',
          borderTop: menuOpen ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        }}>
          <div style={{ padding: '12px 24px 28px', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} onClick={(e) => { e.preventDefault(); handleNav(link.href); }}
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', textDecoration: 'none', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'block' }}>
                {link.labelKey ? t(link.labelKey) : link.label}
              </a>
            ))}
            <div style={{ paddingTop: 20 }}>
              <LanguageSelector dark />
            </div>
            {user && profile ? (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => { navigate(isHobby ? '/mi-esquina' : '/dashboard'); setMenuOpen(false); }} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'white', background: '#E10600', border: 'none', borderRadius: 10, padding: '15px', cursor: 'pointer' }}>{t('nav_my_profile')}</button>
                <button onClick={() => { signOut(); setMenuOpen(false); }} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 2 }}>{t('nav_sign_out')}</button>
              </div>
            ) : (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => { navigate('/auth'); setMenuOpen(false); }} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'white', background: '#E10600', border: 'none', borderRadius: 10, padding: '16px', cursor: 'pointer', boxShadow: '0 4px 24px rgba(225,6,0,0.4)' }}>{t('nav_create_account')}</button>
                <button onClick={() => { navigate('/auth'); setMenuOpen(false); }} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', background: 'none', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, padding: '14px', cursor: 'pointer' }}>{t('nav_sign_in')}</button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <style>{`
        .nav-desktop { display: flex !important; }
        .nav-mobile { display: none !important; }
        @media (max-width: 860px) {
          .nav-desktop { display: none !important; }
          .nav-mobile { display: flex !important; }
        }
      `}</style>
    </>
  );
}