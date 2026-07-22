import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const NAV = [
  { label: 'Peleadores', href: '/fighters' },
  { label: 'Oportunidades', href: '/opportunities' },
  { label: 'Noticias', href: '/noticias' },
  { label: 'Mi Esquina', href: '/esquina' },
  { label: 'Marcas', href: '/brands' },
  { label: 'Tienda', href: '/tienda' },
];

const LEGAL = [
  { label: 'Términos y condiciones', href: '/terms' },
  { label: 'Política de privacidad', href: '/privacy' },
];

export default function Footer() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer style={{ position: 'relative', background: 'var(--rk-black)', borderTop: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
      {/* Ambiente */}
      <div className="rk-glow-red" style={{ bottom: '-40%', left: '50%', transform: 'translateX(-50%)', width: '90%', height: '90%' }} />

      {/* ══ MARCA GIGANTE ══ */}
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1320, margin: '0 auto', padding: 'clamp(56px,7vw,86px) 24px 0', overflow: 'hidden' }}>
        <div
          aria-hidden="true"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 'clamp(76px, 17vw, 250px)',
            lineHeight: 0.78,
            letterSpacing: '-0.02em',
            textAlign: 'center',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.015) 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            userSelect: 'none',
            pointerEvents: 'none',
            marginBottom: -10,
          }}
        >
          RANKD
        </div>
      </div>

      {/* ══ CONTENIDO ══ */}
      <div style={{ position: 'relative', zIndex: 3, maxWidth: 1320, margin: '0 auto', padding: '0 24px clamp(28px,4vw,44px)' }}>
        <div className="ft-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: 44, paddingTop: 44, borderTop: '1px solid rgba(255,255,255,0.07)' }}>

          {/* Columna marca */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 16 }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 27, letterSpacing: 5, color: '#fff', lineHeight: 1 }}>RAN</span>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 27, letterSpacing: 5, color: 'var(--rk-red)', lineHeight: 1 }}>KD</span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--rk-gold)', marginLeft: 5, marginTop: 4 }} />
            </div>
            <p className="rk-body" style={{ maxWidth: 340, marginBottom: 22, fontSize: '0.95rem' }}>
              {t('footer_description')}
            </p>

            <a
              href="https://www.instagram.com/RANKD.__"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '0.6rem 1.1rem', borderRadius: 10, background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--rk-text-2)', textDecoration: 'none', transition: 'all 0.28s var(--ease-out)' }}
              onMouseEnter={(e) => { const el = e.currentTarget; el.style.color = '#fff'; el.style.borderColor = 'rgba(225,6,0,0.45)'; el.style.background = 'rgba(225,6,0,0.09)'; }}
              onMouseLeave={(e) => { const el = e.currentTarget; el.style.color = 'var(--rk-text-2)'; el.style.borderColor = 'rgba(255,255,255,0.1)'; el.style.background = 'rgba(255,255,255,0.045)'; }}
            >
              <i className="ri-instagram-line" style={{ fontSize: 16 }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.9rem', letterSpacing: '0.06em' }}>@RANKD.__</span>
            </a>
          </div>

          {/* Navegación */}
          <div>
            <h4 className="rk-index" style={{ marginBottom: 18, display: 'block' }}>{t('footer_navigation')}</h4>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {NAV.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={(e) => { e.preventDefault(); navigate(l.href); }}
                  className="rk-body"
                  style={{ fontSize: '0.95rem', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.24s ease, padding-left 0.24s var(--ease-out)', width: 'fit-content' }}
                  onMouseEnter={(e) => { const el = e.currentTarget; el.style.color = '#fff'; el.style.paddingLeft = '7px'; }}
                  onMouseLeave={(e) => { const el = e.currentTarget; el.style.color = 'var(--rk-text-2)'; el.style.paddingLeft = '0'; }}
                >
                  {l.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Contacto */}
          <div>
            <h4 className="rk-index" style={{ marginBottom: 18, display: 'block' }}>{t('footer_contact')}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <a href="mailto:hola@rankd.com" className="rk-body" style={{ fontSize: '0.95rem', textDecoration: 'none', transition: 'color 0.24s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--rk-gold)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--rk-text-2)')}>
                hola@rankd.com
              </a>
              <a href="tel:638933153" className="rk-body" style={{ fontSize: '0.95rem', textDecoration: 'none', transition: 'color 0.24s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--rk-gold)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--rk-text-2)')}>
                638 933 153
              </a>
              <span className="rk-body" style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                <i className="ri-map-pin-line" style={{ opacity: 0.5 }} />
                {t('footer_headquarters')}
              </span>
            </div>

            <button className="rk-btn rk-btn-primary" style={{ fontSize: '0.95rem', padding: '0.8rem 1.6rem', marginTop: 22 }} onClick={() => navigate('/auth')}>
              Crear cuenta gratis
            </button>
          </div>
        </div>

        {/* ══ PIE ══ */}
        <div className="ft-bottom" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginTop: 40, paddingTop: 22, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.8rem', letterSpacing: '0.08em', color: 'var(--rk-text-3)' }}>
            © {year} RANKD · {t('footer_rights')}
          </span>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {LEGAL.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={(e) => { e.preventDefault(); navigate(l.href); }}
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.8rem', letterSpacing: '0.08em', color: 'var(--rk-text-3)', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.24s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--rk-text-3)')}
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) { .ft-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; } }
        @media (max-width: 560px) {
          .ft-grid { grid-template-columns: 1fr !important; }
          .ft-bottom { flex-direction: column; align-items: flex-start !important; }
        }
      `}</style>
    </footer>
  );
}