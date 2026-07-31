import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

// R12-T15: CTA de cierre de la landing ("Únete desde el principio"). Antes
// vivía junto a los beneficios; se separó para que la narrativa fluya
// (los beneficios van arriba, la llamada a la acción cierra).
export default function Partners() {
  const { t } = useTranslation();
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
    <section id="join" ref={sectionRef} style={{ background: '#050505', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'relative', overflow: 'hidden', background: '#080808', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: -100, left: -100, width: 600, height: 600, background: 'radial-gradient(circle, rgba(225,6,0,0.07) 0%, transparent 65%)' }} />
          <div style={{ position: 'absolute', bottom: -100, right: -100, width: 500, height: 500, background: 'radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 65%)' }} />
        </div>
        <div className="reveal partners-cta" style={{ position: 'relative', zIndex: 1, maxWidth: 1300, margin: '0 auto', padding: 'clamp(64px, 9vw, 100px) 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 48, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 340px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 32, height: 3, background: '#E10600', borderRadius: 2 }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase', color: '#E10600' }}>{t('partners_cta_eyebrow')}</span>
            </div>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(48px, 6vw, 90px)', color: 'white', margin: '0 0 16px', lineHeight: 0.88 }}>
              {t('partners_cta_headline_1')}<br />
              <span style={{ color: 'transparent', WebkitTextStroke: '1px rgba(255,255,255,0.15)' }}>{t('partners_cta_headline_2')}</span>
            </h3>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 19, color: 'rgba(255,255,255,0.78)', maxWidth: 500, lineHeight: 1.5, margin: 0 }}>{t('partners_cta_desc')}</p>
          </div>
          <div className="partners-cta-actions" style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start', flexShrink: 0, maxWidth: '100%' }}>
            <a href="/auth" className="btn-glow" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 4, color: 'white', background: 'linear-gradient(135deg, #E10600, #c00)', border: 'none', borderRadius: 14, padding: '20px 52px', cursor: 'pointer', textDecoration: 'none', display: 'inline-block', textAlign: 'center', transition: 'all 0.25s', whiteSpace: 'nowrap', maxWidth: '100%', boxSizing: 'border-box' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-4px) scale(1.02)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'none'; }}>
              {t('partners_cta_btn')} →
            </a>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.75)', letterSpacing: 2 }}>{t('partners_cta_note')}</span>
          </div>
        </div>
      </div>

      <style>{`
        @media(max-width:720px){
          .partners-cta{ flex-direction:column; align-items:flex-start!important; gap:36px!important }
          .partners-cta-actions{ width:100%; align-items:stretch!important }
          .partners-cta-actions a{ width:100% }
          .partners-cta-actions span{ text-align:center }
        }
      `}</style>
    </section>
  );
}
