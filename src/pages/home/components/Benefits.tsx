import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// R12-T10/T15: qué te da RANKD, por función. Va pronto en la narrativa de la
// home (justo tras "Cómo funciona") como resumen de las piezas del ecosistema.
const BENEFITS = [
  { icon: 'ri-boxing-line', accent: '#E10600', href: '/esquina', t: 'ben_corner_t', d: 'ben_corner_d' },
  { icon: 'ri-links-line', accent: '#E10600', href: '/opportunities', t: 'ben_connect_t', d: 'ben_connect_d' },
  { icon: 'ri-calendar-event-line', accent: '#C9A84C', href: '/eventos', t: 'ben_events_t', d: 'ben_events_d' },
  { icon: 'ri-store-2-line', accent: '#C9A84C', href: '/brands', t: 'ben_brands_t', d: 'ben_brands_d' },
  { icon: 'ri-newspaper-line', accent: '#ffffff', href: '/noticias', t: 'ben_news_t', d: 'ben_news_d' },
];

export default function Benefits() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible')); }),
      { threshold: 0.08 }
    );
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="benefits" ref={sectionRef} className="rk-viewport-section" style={{ background: '#050505', position: 'relative', overflow: 'hidden' }}>
      <div style={{ width: '100%' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 24px' }}>
          {/* Header */}
          <div className="reveal" style={{ marginBottom: 44 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 40, height: 3, background: '#E10600', borderRadius: 2 }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase', color: '#E10600' }}>{t('ben_eyebrow')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 24 }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(52px, 7vw, 96px)', lineHeight: 0.9, color: 'white', margin: 0 }}>
                {t('ben_headline_1')} <span style={{ color: '#C9A84C', textShadow: '0 0 40px rgba(201,168,76,0.25)' }}>{t('ben_headline_2')}</span>
              </h2>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, color: 'rgba(255,255,255,0.78)', maxWidth: 400, lineHeight: 1.55 }}>{t('ben_subtext')}</p>
            </div>
          </div>

          {/* Tarjetas de beneficio — escaneables */}
          <div className="ben-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {BENEFITS.map((b, i) => (
              <a key={b.t} href={b.href} onClick={(e) => { e.preventDefault(); navigate(b.href); }}
                className={`reveal reveal-delay-${Math.min(i + 1, 4)} rk-card group`}
                style={{ display: 'flex', flexDirection: 'column', padding: '26px 24px', borderRadius: 18, textDecoration: 'none', cursor: 'pointer', height: '100%', position: 'relative', overflow: 'hidden' }}>
                <span style={{ position: 'absolute', top: 0, left: 0, width: '38%', height: 3, background: b.accent }} />
                <div style={{ width: 48, height: 48, borderRadius: 13, background: `${b.accent}16`, border: `1px solid ${b.accent}3a`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  <i className={b.icon} style={{ color: b.accent, fontSize: 23 }} />
                </div>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 27, letterSpacing: 1, color: '#fff', margin: '0 0 8px', lineHeight: 1 }}>{t(b.t)}</h3>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5, margin: 0, flex: 1 }}>{t(b.d)}</p>
                <span className="group-hover:gap-2" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 18, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: b.accent === '#ffffff' ? 'rgba(255,255,255,0.85)' : b.accent }}>
                  {t('ben_explore')} <i className="ri-arrow-right-line" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media(max-width:960px){ .ben-grid{ grid-template-columns:repeat(2,1fr)!important } }
        @media(max-width:560px){ .ben-grid{ grid-template-columns:1fr!important } }
      `}</style>
    </section>
  );
}
