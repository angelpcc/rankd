import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { isAdminEmail } from '@/lib/admin';
import LanguageSelector from '@/components/feature/LanguageSelector';
import NotificationBell from '@/components/feature/NotificationBell';
import RankdLogo from '@/components/base/RankdLogo';

type NavLink = { label?: string; labelKey?: string; href: string; isAnchor: boolean };
type MobileLink = { labelKey: string; href: string; icon: string };

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, profile, signOut, isViewingAs } = useAuth();
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
  const isFighter = profile?.user_type === 'fighter';
  // En modo vista se ocultan los accesos de administración: si no, estarías
  // revisando la experiencia de un peleador con un escudo de admin al lado.
  const isAdmin = isAdminEmail(user?.email) && !isViewingAs;

  // ── Navegación de ESCRITORIO: diferenciada por rol, minimalista ──
  // En escritorio el espacio manda: cada rol ve solo lo esencial.
  // El menú móvil (más abajo) sí es un mapa completo del sitio.
  const role: 'visitor' | 'fighter_hobby' | 'fighter_pro' | 'org' | 'brand' = !user
    ? 'visitor'
    : isFighter
      ? (isHobby ? 'fighter_hobby' : 'fighter_pro')
      : profile?.user_type === 'brand'
        ? 'brand'
        : 'org'; // promoter, gym, manager

  // R12-T12: menú de escritorio ajustado por rol para que cada perfil vea
  // solo lo suyo. "Crear cuenta" (visitante) y el acceso al panel (roles con
  // sesión) viven en los botones de la derecha, no en esta lista.
  const NAV_BY_ROLE: Record<typeof role, NavLink[]> = {
    visitor: [
      { labelKey: 'nav_home', href: '/beta', isAnchor: false },
      { labelKey: 'nav_events', href: '/eventos', isAnchor: false },
      { labelKey: 'nav_news', href: '/noticias', isAnchor: false },
      { labelKey: 'nav_brands', href: '/brands', isAnchor: false },
      { labelKey: 'nav_promoters', href: '/promotoras', isAnchor: false },
    ],
    // El aficionado no compite: se deja fuera Oportunidades a propósito.
    fighter_hobby: [
      { labelKey: 'nav_my_corner', href: '/mi-esquina', isAnchor: false },
      { labelKey: 'nav_events', href: '/eventos', isAnchor: false },
      { labelKey: 'nav_brands', href: '/brands', isAnchor: false },
      { labelKey: 'nav_news', href: '/noticias', isAnchor: false },
      { labelKey: 'nav_messages', href: '/dashboard?tab=messages', isAnchor: false },
    ],
    fighter_pro: [
      { labelKey: 'nav_my_corner', href: '/mi-esquina', isAnchor: false },
      { labelKey: 'nav_opportunities', href: '/opportunities', isAnchor: false },
      { labelKey: 'nav_events', href: '/eventos', isAnchor: false },
      { labelKey: 'nav_brands', href: '/brands', isAnchor: false },
      { labelKey: 'nav_news', href: '/noticias', isAnchor: false },
      { labelKey: 'nav_messages', href: '/dashboard?tab=messages', isAnchor: false },
    ],
    org: [
      { labelKey: 'nav_events', href: '/eventos', isAnchor: false },
      { labelKey: 'nav_directory', href: '/fighters', isAnchor: false },
      { labelKey: 'nav_brands', href: '/brands', isAnchor: false },
      { labelKey: 'nav_opportunities', href: '/opportunities', isAnchor: false },
      { labelKey: 'nav_news', href: '/noticias', isAnchor: false },
      { labelKey: 'nav_messages', href: '/dashboard?tab=messages', isAnchor: false },
    ],
    brand: [
      { labelKey: 'nav_directory', href: '/fighters', isAnchor: false },
      { labelKey: 'nav_promoters', href: '/promotoras', isAnchor: false },
      { labelKey: 'nav_events', href: '/eventos', isAnchor: false },
      { labelKey: 'nav_opportunities', href: '/opportunities', isAnchor: false },
      { labelKey: 'nav_news', href: '/noticias', isAnchor: false },
      { labelKey: 'nav_messages', href: '/dashboard?tab=messages', isAnchor: false },
    ],
  };
  const navLinks = NAV_BY_ROLE[role];

  // ── Navegación MÓVIL: MISMA lógica por rol que el escritorio ──
  // Antes el móvil mostraba una lista fija para todos (con "Cómo funciona" y
  // "Oportunidades" a cualquiera). Ahora deriva de NAV_BY_ROLE para que cada
  // perfil vea solo lo suyo. Los mensajes viven en la sección "Tu cuenta".
  const NAV_ICON: Record<string, string> = {
    '/beta': 'ri-home-5-line',
    '/mi-esquina': 'ri-boxing-line',
    '/esquina': 'ri-boxing-line',
    '/fighters': 'ri-group-line',
    '/opportunities': 'ri-megaphone-line',
    '/eventos': 'ri-calendar-event-line',
    '/promotoras': 'ri-trophy-line',
    '/brands': 'ri-store-2-line',
    '/noticias': 'ri-newspaper-line',
    '/tienda': 'ri-shopping-bag-3-line',
    '/como-funciona': 'ri-compass-3-line',
  };
  const exploreLinks: MobileLink[] = navLinks
    // El logo ya lleva al inicio y los mensajes están en "Tu cuenta": fuera de aquí.
    .filter((l) => l.href !== '/beta' && l.href !== '/dashboard?tab=messages' && l.labelKey)
    .map((l) => ({ labelKey: l.labelKey!, href: l.href, icon: NAV_ICON[l.href] || 'ri-arrow-right-line' }));
  // Mi Esquina siempre visible en el mapa del sitio: los peleadores ya la
  // tienen entre sus navLinks; para el resto de roles (org, brand) y para
  // visitantes se inyecta aquí. Sin sesión, la propia página muestra un
  // preview borroso con overlay de login (ver mi-esquina/page.tsx), así
  // que aquí el enlace se comporta como cualquier otro.
  if (!exploreLinks.some((l) => l.href === '/mi-esquina')) {
    exploreLinks.push({
      labelKey: 'nav_my_corner',
      href: '/mi-esquina',
      icon: NAV_ICON['/mi-esquina'],
    });
  }
  // Extras solo para visitantes: tienda pública y la guía de "Cómo funciona".
  if (role === 'visitor') {
    exploreLinks.push(
      { labelKey: 'nav_store', href: '/tienda', icon: NAV_ICON['/tienda'] },
      { labelKey: 'nav_how_it_works', href: '/como-funciona', icon: NAV_ICON['/como-funciona'] },
    );
  }

  const accountLinks: MobileLink[] = user && profile
    ? [
        // El aficionado vive en Mi Esquina; el resto tiene su panel de gestión.
        ...(!isHobby ? [{ labelKey: 'nav_my_panel', href: '/dashboard', icon: 'ri-dashboard-line' }] : []),
        { labelKey: 'nav_messages', href: '/dashboard?tab=messages', icon: 'ri-message-3-line' },
        ...(isAdmin ? [{ labelKey: 'nav_admin', href: '/admin', icon: 'ri-shield-star-line' }] : []),
      ]
    : [];

  const handleNav = (href: string) => {
    setMenuOpen(false);
    if (href.startsWith('#')) {
      const el = document.querySelector(href);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        // El ancla no existe en esta página: vamos al home y hacemos scroll allí.
        navigate('/beta');
        setTimeout(() => document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' }), 350);
      }
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

          {/* Logo oficial — siempre lleva al inicio (antes usaba un ancla frágil) */}
          <a href="/beta" onClick={(e) => { e.preventDefault(); handleNav('/beta'); }} aria-label="RANKD — Inicio" style={{ cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <RankdLogo size={30} />
            <span style={{ width: 6, height: 6, background: '#C9A84C', borderRadius: '50%', marginLeft: 7, marginTop: 2, flexShrink: 0 }} />
          </a>

          {/* Desktop Links */}
          <ul className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 24, listStyle: 'none', margin: 0, padding: 0 }}>
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
                {isAdmin && (
                  <button onClick={() => navigate('/admin')} title={t('nav_admin')} aria-label={t('nav_admin')}
                    style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(201,168,76,0.18)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(201,168,76,0.1)'; }}>
                    <i className="ri-shield-star-line" style={{ fontSize: 17 }} />
                  </button>
                )}
                <NotificationBell userId={user.id} />
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

          {/* Móvil: campana + hamburguesa */}
          <div className="nav-mobile" style={{ alignItems: 'center', gap: 6 }}>
            {user && profile && <NotificationBell userId={user.id} />}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ background: 'none', border: 'none', color: 'white', fontSize: 24, cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label={t('nav_menu')}
            >
              <i className={menuOpen ? 'ri-close-line' : 'ri-menu-3-line'} />
            </button>
          </div>
        </div>

        {/* Mobile Menu — mapa completo del sitio */}
        <div className="mobile-menu" style={{
          maxHeight: menuOpen ? 'calc(100vh - 60px)' : '0',
          overflowY: menuOpen ? 'auto' : 'hidden',
          transition: 'max-height 0.35s ease',
          background: 'rgba(5,5,5,0.99)',
          borderTop: menuOpen ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        }}>
          <div style={{ padding: '16px 20px calc(28px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 0 }}>

            {/* Explorar */}
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.32)', margin: '4px 0 8px 8px' }}>
              {t('nav_section_explore')}
            </p>
            {exploreLinks.map((link) => (
              <a key={link.href} href={link.href} onClick={(e) => { e.preventDefault(); handleNav(link.href); }}
                style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.82)', textDecoration: 'none', padding: '13px 8px', borderRadius: 12 }}
                onTouchStart={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onTouchEnd={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}>
                <i className={link.icon} style={{ fontSize: 19, color: '#E10600', width: 22, textAlign: 'center', flexShrink: 0 }} />
                {t(link.labelKey)}
              </a>
            ))}

            {/* Tu cuenta */}
            {accountLinks.length > 0 && (
              <>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.32)', margin: '18px 0 8px 8px' }}>
                  {t('nav_section_account')}
                </p>
                {accountLinks.map((link) => {
                  const admin = link.href === '/admin';
                  return (
                    <a key={link.href} href={link.href} onClick={(e) => { e.preventDefault(); handleNav(link.href); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: admin ? '#C9A84C' : 'rgba(255,255,255,0.82)', textDecoration: 'none', padding: '13px 8px', borderRadius: 12 }}>
                      <i className={link.icon} style={{ fontSize: 19, color: admin ? '#C9A84C' : '#E10600', width: 22, textAlign: 'center', flexShrink: 0 }} />
                      {t(link.labelKey)}
                    </a>
                  );
                })}
              </>
            )}

            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '18px 0' }} />

            <LanguageSelector dark />

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
