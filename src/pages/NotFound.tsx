import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useTranslation();

  // Sitios a los que de verdad puede querer ir alguien que ha caído aquí.
  const DESTINATIONS = [
    { href: '/beta', icon: 'ri-home-4-line', label: t('nav_home'), desc: t('nf_home_desc') },
    { href: '/fighters', icon: 'ri-boxing-line', label: t('nav_directory'), desc: t('nf_fighters_desc') },
    { href: '/eventos', icon: 'ri-calendar-event-line', label: t('nav_events'), desc: t('nf_events_desc') },
    { href: '/opportunities', icon: 'ri-megaphone-line', label: t('nav_opportunities'), desc: t('nf_opps_desc') },
    { href: '/noticias', icon: 'ri-newspaper-line', label: t('nav_news'), desc: t('nf_news_desc') },
    { href: '/como-funciona', icon: 'ri-compass-3-line', label: t('nav_how_it_works'), desc: t('nf_how_desc') },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#030303', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: 'calc(40px + env(safe-area-inset-top, 0px)) 24px calc(40px + env(safe-area-inset-bottom, 0px))' }}>

      {/* Glow rojo */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, rgba(225,6,0,0.12) 0%, transparent 55%)', pointerEvents: 'none' }} />
      <div className="rk-grid-bg" style={{ position: 'absolute', inset: 0, opacity: 0.5, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent 0%, #E10600 50%, transparent 100%)' }} />

      {/* 404 gigante de fondo */}
      <span aria-hidden="true" style={{ position: 'absolute', fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(200px, 40vw, 420px)', color: 'rgba(255,255,255,0.035)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>
        404
      </span>

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 620, width: '100%', textAlign: 'center' }}>
        {/* Logo */}
        <a href="/beta" onClick={(e) => { e.preventDefault(); navigate('/beta'); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginBottom: 30, textDecoration: 'none' }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: '#ffffff', letterSpacing: 5, lineHeight: 1 }}>RAN</span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: '#E10600', letterSpacing: 5, lineHeight: 1 }}>KD</span>
          <span style={{ width: 7, height: 7, background: '#C9A84C', borderRadius: '50%', marginLeft: 4, marginTop: 4 }} />
        </a>

        <div className="anim-fade-up" style={{ width: 72, height: 72, margin: '0 auto 22px', borderRadius: 20, background: 'rgba(225,6,0,0.1)', border: '1px solid rgba(225,6,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="ri-boxing-line" style={{ fontSize: 32, color: '#E10600' }} />
        </div>

        <h1 className="anim-fade-up anim-d1" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(30px, 6vw, 44px)', color: 'white', margin: '0 0 12px', letterSpacing: 1, lineHeight: 1, textTransform: 'uppercase' }}>
          {t('nf_title')}
        </h1>
        <p className="anim-fade-up anim-d2" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: '0 0 8px' }}>
          {t('nf_subtitle')}
        </p>
        {pathname && pathname !== '/' && (
          <p className="anim-fade-up anim-d2" style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.28)', margin: '0 0 34px', wordBreak: 'break-all' }}>
            {pathname}
          </p>
        )}

        {/* Destinos reales */}
        <div className="nf-grid anim-fade-up anim-d3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, textAlign: 'left' }}>
          {DESTINATIONS.map((d) => (
            <button
              key={d.href}
              onClick={() => navigate(d.href)}
              className="rk-card"
              style={{ padding: '16px 14px', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', textAlign: 'left' }}
            >
              <i className={d.icon} style={{ fontSize: 18, color: '#E10600' }} />
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, color: '#fff', margin: '9px 0 2px' }}>{d.label}</p>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.4 }}>{d.desc}</p>
            </button>
          ))}
        </div>

        <button
          onClick={() => navigate(-1)}
          className="anim-fade-up anim-d4"
          style={{ marginTop: 26, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, letterSpacing: 1, color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}
        >
          <i className="ri-arrow-left-line" /> {t('nf_back')}
        </button>
      </div>

      <style>{`
        @media (max-width: 620px) { .nf-grid { grid-template-columns: 1fr 1fr !important; } }
      `}</style>
    </div>
  );
}
