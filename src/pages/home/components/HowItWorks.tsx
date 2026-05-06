import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';

export default function HowItWorks() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) { e.target.querySelectorAll('.reveal').forEach(el => el.classList.add('visible')); } }),
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const steps = [
    { number: '01', icon: 'ri-user-add-line', titleKey: 'how_step1_title', descKey: 'how_step1_desc', color: '#E10600', img: 'https://oqsobiykaaqelgfjgsor.supabase.co/storage/v1/object/public/images/crear%20perfil.png' },
    { number: '02', icon: 'ri-search-eye-line', titleKey: 'how_step2_title', descKey: 'how_step2_desc', color: '#C9A84C', img: 'https://oqsobiykaaqelgfjgsor.supabase.co/storage/v1/object/public/images/se%20descubierto.png' },
    { number: '03', icon: 'ri-shake-hands-line', titleKey: 'how_step3_title', descKey: 'how_step3_desc', color: '#E10600', img: 'https://oqsobiykaaqelgfjgsor.supabase.co/storage/v1/object/public/images/negocia.png' },
    { number: '04', icon: 'ri-rocket-line', titleKey: 'how_step4_title', descKey: 'how_step4_desc', color: '#C9A84C', img: 'https://oqsobiykaaqelgfjgsor.supabase.co/storage/v1/object/public/images/impulsa.png' },
  ];

  return (
    <section id="how-it-works" ref={sectionRef} style={{ background: '#0a0a0a', position: 'relative', overflow: 'hidden', padding: '80px 0 90px' }}>
      {/* Glow rojo sutil centro */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(225,6,0,0.04) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 48px', position: 'relative', zIndex: 1 }}>
        {/* Header compacto */}
        <div className="reveal" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, marginBottom: 52 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 32, height: 3, background: '#C9A84C', borderRadius: 2 }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase', color: '#C9A84C' }}>{t('how_eyebrow')}</span>
            </div>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(48px, 6vw, 86px)', lineHeight: 0.88, color: 'white', margin: 0 }}>
              {t('how_headline_1')}<br /><span style={{ color: '#E10600', textShadow: '0 0 40px rgba(225,6,0,0.3)' }}>{t('how_headline_2')}</span>
            </h2>
          </div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, color: 'rgba(255,255,255,0.58)', maxWidth: 360, lineHeight: 1.55 }}>{t('how_subtext')}</p>
        </div>

        {/* Línea roja separadora */}
        <div className="reveal reveal-delay-1" style={{ height: 1, background: 'linear-gradient(to right, #E10600, rgba(225,6,0,0.15), transparent)', marginBottom: 48 }} />

        {/* Steps — más compactos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 48 }} className="steps-grid">
          {steps.map((step, i) => (
            <div key={step.number}
              className={`card-hover reveal reveal-delay-${i + 1}`}
              style={{ borderRadius: 18, overflow: 'hidden', background: '#111', border: '1px solid rgba(255,255,255,0.07)', cursor: 'default' }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = `${step.color}35`; el.style.boxShadow = `0 20px 50px ${step.color}18`; const img = el.querySelector('.step-img') as HTMLImageElement; if (img) img.style.transform = 'scale(1.08)'; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = 'rgba(255,255,255,0.07)'; el.style.boxShadow = 'none'; const img = el.querySelector('.step-img') as HTMLImageElement; if (img) img.style.transform = 'scale(1)'; }}>
              {/* Imagen */}
              <div style={{ height: 140, position: 'relative', overflow: 'hidden' }}>
                <img className="step-img" src={step.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', transition: 'transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94)' }} />
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(0deg, #111 0%, rgba(17,17,17,0.3) 55%, transparent 100%)` }} />
                <div style={{ position: 'absolute', inset: 0, background: `${step.color}10` }} />
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: step.color }} />
                {/* Número fantasma — opacidad reducida */}
                <div style={{ position: 'absolute', top: 6, right: 10, fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, color: `${step.color}20`, lineHeight: 1, userSelect: 'none' }}>{step.number}</div>
              </div>
              {/* Info */}
              <div style={{ padding: '20px 20px 24px' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${step.color}15`, border: `1px solid ${step.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, transition: 'transform 0.3s ease' }}>
                  <i className={step.icon} style={{ color: step.color, fontSize: 17 }} />
                </div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 4, color: step.color, marginBottom: 7 }}>PASO {step.number}</div>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: 'white', marginBottom: 8, lineHeight: 1.05 }}>{t(step.titleKey)}</h3>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>{t(step.descKey)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="reveal" style={{ textAlign: 'center' }}>
          <button onClick={() => navigate('/auth')} className="btn-glow" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 4, color: 'white', background: 'linear-gradient(135deg, #E10600, #c00)', border: 'none', borderRadius: 12, padding: '18px 56px', cursor: 'pointer', transition: 'all 0.25s' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px) scale(1.02)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; }}>
            {t('btn_start_free')} →
          </button>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.28)', marginTop: 16, letterSpacing: 3, textTransform: 'uppercase' }}>Sin tarjeta · Sin coste · Para siempre</p>
        </div>
      </div>
      <style>{`@media(max-width:960px){.steps-grid{grid-template-columns:1fr 1fr!important}}`}</style>
    </section>
  );
}
