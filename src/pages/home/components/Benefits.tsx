import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SectionHead from '@/components/base/SectionHead';

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
          <div className="reveal">
            <SectionHead eyebrow={t('ben_eyebrow')} title={t('ben_headline_1')} highlight={t('ben_headline_2')} sub={t('ben_subtext')} />
          </div>

          {/* Tarjetas de beneficio — escaneables */}
          <div className="ben-grid rk-carrusel-m" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {BENEFITS.map((b, i) => (
              <a key={b.t} href={b.href} onClick={(e) => { e.preventDefault(); navigate(b.href); }}
                className={`reveal reveal-delay-${Math.min(i + 1, 4)} rk-card group ben-card ${i === 0 ? 'ben-feature' : ''}`}
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

      {/* ── POR QUÉ LA PRIMERA OCUPA DOS COLUMNAS ──

          Son cinco tarjetas. En tres columnas salían 3 + 2, con un hueco a la
          derecha de la segunda fila; en dos columnas (tableta), 2 + 2 + 1, con
          otro hueco. Una rejilla con un agujero parece a medio terminar.

          Haciendo que la primera ocupe dos, cuadra en LOS DOS tamaños:
            3 columnas:  [Mi Esquina ×2][Conexiones] / [Eventos][Marcas][Noticias]
            2 columnas:  [Mi Esquina ×2] / [Conexiones][Eventos] / [Marcas][Noticias]
          Y es la que debe destacar: Mi Esquina es el producto, el resto son
          las piezas de alrededor. */}
      <style>{`
        .ben-feature { grid-column: span 2; background: linear-gradient(135deg, rgba(225,6,0,0.10) 0%, var(--s-1) 55%); }
        @media(max-width:960px){ .ben-grid{ grid-template-columns:repeat(2,1fr)!important } }
        @media(max-width:560px){ .ben-grid{ grid-template-columns:1fr!important } .ben-feature{ grid-column: span 1; } }
        /* Son enlaces, así que tienen que parecerlo: se elevan al pasar por
           encima. Antes solo cambiaba el borde y no se distinguían de una
           tarjeta de texto. */
        .ben-card { transition: transform 220ms cubic-bezier(0.22,1,0.36,1), border-color 220ms ease, box-shadow 220ms ease; }
        @media (hover: hover) {
          .ben-card:hover { transform: translateY(-3px); border-color: rgba(255,255,255,0.24); box-shadow: 0 18px 40px -22px rgba(0,0,0,0.9); }
        }
        .ben-card:active { transform: translateY(0) scale(0.99); }
      `}</style>
    </section>
  );
}
