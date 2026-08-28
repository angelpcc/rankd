import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';

// Foto de portada (Unsplash, licencia libre, uso comercial sin atribución),
// WebP optimizado y servida desde el propio dominio.
const HERO_IMG = '/images/hero.webp';

export default function Hero() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const DISCIPLINAS = [t('disc_boxing').toUpperCase(), 'MMA', 'KICKBOXING', 'MUAY THAI', 'GRAPPLING', 'K-1'];
  const bgRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setLoaded(true), 60);
    return () => clearTimeout(id);
  }, []);

  // Parallax suave del fondo
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = bgRef.current;
        if (!el) return;
        const y = window.scrollY;
        if (y > window.innerHeight) return;
        el.style.transform = `translate3d(0, ${y * 0.26}px, 0) scale(${1.06 + y * 0.0001})`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, []);

  const marqueeItems = [...DISCIPLINAS, ...DISCIPLINAS];

  return (
    <section
      id="home"
      className="rk-vignette"
      style={{ position: 'relative', width: '100%', minHeight: '100svh', display: 'flex', alignItems: 'center', overflow: 'hidden', background: 'var(--rk-black)' }}
    >
      {/* ══ FONDO ══ */}
      <div
        ref={bgRef}
        style={{
          position: 'absolute', inset: '-4% 0 0', zIndex: 0,
          opacity: loaded ? 1 : 0,
          transform: 'scale(1.06)',
          transition: 'opacity 2.2s var(--ease-out)',
          willChange: 'transform',
        }}
      >
        <img src={HERO_IMG} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 28%' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(102deg, rgba(3,3,3,0.99) 0%, rgba(3,3,3,0.94) 32%, rgba(3,3,3,0.66) 58%, rgba(3,3,3,0.15) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, var(--rk-black) 0%, rgba(3,3,3,0.55) 22%, transparent 58%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 68% 48%, rgba(225,6,0,0.16) 0%, transparent 52%)' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: '45%', height: '45%', background: 'radial-gradient(ellipse at 100% 0%, rgba(201,168,76,0.08) 0%, transparent 62%)' }} />
      </div>

      <div className="rk-grid-bg" style={{ position: 'absolute', inset: 0, zIndex: 1, opacity: 0.5, maskImage: 'linear-gradient(to bottom, black, transparent 70%)', WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 70%)' }} />

      <div className="rk-topline" />

      <div className="hero-watermark" aria-hidden="true" style={{ position: 'absolute', right: '-4%', bottom: '7%', zIndex: 1, fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(180px, 26vw, 420px)', lineHeight: 0.75, color: 'transparent', WebkitTextStroke: '1px rgba(255,255,255,0.035)', pointerEvents: 'none', userSelect: 'none' }}>
        RANKD
      </div>

      {/* ══ CONTENIDO ══ */}
      {/* Padding vertical contenido: si es demasiado grande, un titular
          traducido a una lengua más larga (p.ej. "EL ECOSISTEMA DEL BOXEO
          Y EL COMBATE") empuja los CTAs fuera del viewport. Los tamaños
          se calculan para que en 1440×900 y 375×812 el botón principal
          siga siendo visible sin scroll aun con el titular largo. */}
      <div
        className="hero-grid"
        style={{ position: 'relative', zIndex: 5, width: '100%', maxWidth: 1320, margin: '0 auto', padding: 'clamp(72px,9vw,120px) 24px clamp(80px,8vw,110px)', display: 'grid', gridTemplateColumns: '1fr 370px', gap: 56, alignItems: 'center' }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22, opacity: loaded ? 1 : 0, transform: loaded ? 'none' : 'translateY(14px)', transition: 'all 0.9s var(--ease-out) 0.15s' }}>
            <span className="rk-index">ES · 2026</span>
            <span style={{ flex: '0 0 42px', height: 1, background: 'rgba(255,255,255,0.16)' }} />
            <span className="rk-eyebrow">{t('hero_eyebrow')}</span>
          </div>

          {/* h1 con font-size/line-height reducidos vs .rk-display por defecto,
              para que titulares largos hagan wrap sin desbordar el viewport.
              Fórmula: min 2rem (móvil apretado) → 6.5vw (desktop medio) → 4.6rem
              tope. Line-height 0.92 da aire suficiente sin exagerar la altura
              cuando el titular ocupa 2 líneas físicas. */}
          <h1 className="hero-h1" style={{ margin: '0 0 22px' }}>
            <span className="rk-display" style={{ display: 'block', color: '#fff', fontSize: 'clamp(2rem, 6.5vw, 4.6rem)', lineHeight: 0.92, opacity: loaded ? 1 : 0, transform: loaded ? 'none' : 'translateY(30px)', transition: 'all 1s var(--ease-out) 0.2s' }}>
              {t('hero_headline_1')}
            </span>
            <span className="rk-display rk-red-glow" style={{ display: 'block', fontSize: 'clamp(2rem, 6.5vw, 4.6rem)', lineHeight: 0.92, opacity: loaded ? 1 : 0, transform: loaded ? 'none' : 'translateY(30px)', transition: 'all 1s var(--ease-out) 0.31s' }}>
              {t('hero_headline_2')}
            </span>
            <span className="rk-display rk-outline" style={{ display: 'block', fontSize: 'clamp(1.7rem, 5vw, 3.4rem)', lineHeight: 0.95, fontStyle: 'italic', opacity: loaded ? 1 : 0, transform: loaded ? 'none' : 'translateY(30px)', transition: 'all 1s var(--ease-out) 0.42s' }}>
              {t('hero_headline_3')}
            </span>
          </h1>

          <div className="rk-rule" style={{ width: 92, marginBottom: 20, opacity: loaded ? 1 : 0, transition: 'opacity 1s var(--ease-out) 0.6s' }} />

          <p className="rk-body" style={{ fontSize: 'clamp(0.98rem, 1.4vw, 1.18rem)', maxWidth: 540, marginBottom: 28, opacity: loaded ? 1 : 0, transform: loaded ? 'none' : 'translateY(18px)', transition: 'all 1s var(--ease-out) 0.62s' }}>
            {t('hero_subtext')}
          </p>

          <div style={{ display: 'flex', gap: 13, flexWrap: 'wrap', marginBottom: 30, opacity: loaded ? 1 : 0, transform: loaded ? 'none' : 'translateY(18px)', transition: 'all 1s var(--ease-out) 0.74s' }}>
            <button className="rk-btn rk-btn-primary" onClick={() => navigate('/auth')}>
              {t('btn_create_free')} →
            </button>
            <button className="rk-btn rk-btn-ghost" onClick={() => document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
              {t('nav_how_it_works')}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 22, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.09)', flexWrap: 'wrap', opacity: loaded ? 1 : 0, transition: 'opacity 1.1s var(--ease-out) 0.9s' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span className="rk-breathe" style={{ width: 7, height: 7, background: '#22c55e', borderRadius: '50%', boxShadow: '0 0 12px #22c55e' }} />
              <span className="rk-body" style={{ fontSize: '0.88rem', letterSpacing: '0.06em' }}>{t('hero_indicator_active')}</span>
            </span>
            <span style={{ color: 'rgba(255,255,255,0.14)' }}>/</span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="rk-h3" style={{ color: 'var(--rk-gold)' }}>100%</span>
              <span className="rk-body" style={{ fontSize: '0.78rem', letterSpacing: '0.22em', textTransform: 'uppercase' }}>{t('hero_free_no_fees')}</span>
            </span>
          </div>
        </div>

        <div className="hero-right" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {[
            { icon: 'ri-boxing-line', title: t('nav_directory'), desc: t('hero_card_fighter_desc'), color: '#E10600', n: '01' },
            { icon: 'ri-trophy-line', title: t('nav_promoters'), desc: t('hero_card_org_desc'), color: '#C9A84C', n: '02' },
            { icon: 'ri-store-2-line', title: t('nav_brands'), desc: t('hero_card_brand_desc'), color: 'rgba(255,255,255,0.8)', n: '03' },
          ].map((card, i) => (
            <div
              key={card.title}
              onClick={() => navigate('/auth')}
              style={{
                padding: '17px 19px', borderRadius: 14,
                background: 'rgba(8,8,8,0.72)', border: `1px solid ${card.color}26`,
                backdropFilter: 'blur(22px)', display: 'flex', alignItems: 'center', gap: 14,
                cursor: 'pointer', boxShadow: '0 6px 26px rgba(0,0,0,0.5)',
                opacity: loaded ? 1 : 0,
                transform: loaded ? 'none' : 'translateX(26px)',
                transition: `opacity 0.85s var(--ease-out) ${0.85 + i * 0.1}s, transform 0.85s var(--ease-out) ${0.85 + i * 0.1}s, border-color 0.3s ease, background 0.3s ease`,
              }}
              onMouseEnter={(e) => { const el = e.currentTarget; el.style.borderColor = `${card.color}66`; el.style.background = 'rgba(14,14,14,0.85)'; }}
              onMouseLeave={(e) => { const el = e.currentTarget; el.style.borderColor = `${card.color}26`; el.style.background = 'rgba(8,8,8,0.72)'; }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 11, background: `${card.color}14`, border: `1px solid ${card.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={card.icon} style={{ color: card.color, fontSize: 18 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="rk-h3" style={{ fontSize: '1.15rem', color: '#fff', marginBottom: 2 }}>{card.title}</div>
                <div className="rk-body" style={{ fontSize: '0.82rem', lineHeight: 1.35 }}>{card.desc}</div>
              </div>
              <span className="rk-index" style={{ fontSize: '0.62rem' }}>{card.n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ MARQUESINA ══ */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 6, borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(3,3,3,0.72)', backdropFilter: 'blur(14px)', padding: '13px 0' }}>
        <div className="rk-marquee">
          <div>
            {marqueeItems.map((d, i) => (
              <span key={`a${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 26, paddingRight: 26 }}>
                <span className="rk-h3" style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.42)', letterSpacing: '0.3em' }}>{d}</span>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--rk-red)', flexShrink: 0 }} />
              </span>
            ))}
          </div>
          <div aria-hidden="true">
            {marqueeItems.map((d, i) => (
              <span key={`b${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 26, paddingRight: 26 }}>
                <span className="rk-h3" style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.42)', letterSpacing: '0.3em' }}>{d}</span>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--rk-red)', flexShrink: 0 }} />
              </span>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 0 !important; padding: 88px 20px 84px !important; }
          .hero-right { display: none !important; }
          .hero-watermark { display: none !important; }
        }
        /* En pantallas móviles cortas (iPhone SE, 375×667…), reducir aún
           más el titular para que el CTA quede visible sin scroll incluso
           si la traducción del headline es larga. */
        @media (max-width: 480px) {
          .hero-h1 span.rk-display { font-size: clamp(1.75rem, 8.4vw, 2.4rem) !important; line-height: 0.95 !important; }
          .hero-h1 span.rk-outline { font-size: clamp(1.35rem, 6.4vw, 1.9rem) !important; }
        }
      `}</style>
    </section>
  );
}