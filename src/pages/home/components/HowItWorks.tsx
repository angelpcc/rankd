import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function HowItWorks() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const steps = [
    {
      number: '01', icon: 'ri-user-add-line', titleKey: 'how_step1_title', descKey: 'how_step1_desc', color: '#E10600',
      // Silueta peleador haciendo sombra
      img: 'https://images.unsplash.com/photo-1549476464-37392f717541?w=400&q=85&fit=crop&crop=center',
      useImg: true,
    },
    {
      number: '02', icon: 'ri-search-eye-line', titleKey: 'how_step2_title', descKey: 'how_step2_desc', color: '#C9A84C',
      // Sin foto — solo icono grande de lupa
      useImg: false,
    },
    {
      number: '03', icon: 'ri-shake-hands-line', titleKey: 'how_step3_title', descKey: 'how_step3_desc', color: '#E10600',
      // Apretón de manos profesional
      img: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400&q=85&fit=crop',
      useImg: true,
    },
    {
      number: '04', icon: 'ri-rocket-line', titleKey: 'how_step4_title', descKey: 'how_step4_desc', color: '#C9A84C',
      // Sin foto — icono de cohete/flecha grande
      useImg: false,
    },
  ];

  return (
    <section id="how-it-works" style={{ background: '#0a0a0a', position: 'relative', overflow: 'hidden' }}>

      {/* Banner superior — solo negro con texto, sin foto */}
      <div style={{ position: 'relative', padding: '80px 48px 60px', background: '#0a0a0a' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 36, height: 3, background: '#C9A84C', borderRadius: 2 }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase', color: '#C9A84C' }}>{t('how_eyebrow')}</span>
            </div>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(52px, 7vw, 96px)', lineHeight: 0.88, color: 'white', margin: 0 }}>
              {t('how_headline_1')}<br /><span style={{ color: '#E10600' }}>{t('how_headline_2')}</span>
            </h2>
          </div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, color: 'rgba(255,255,255,0.4)', maxWidth: 380, lineHeight: 1.55 }}>{t('how_subtext')}</p>
        </div>
        {/* línea separadora roja */}
        <div style={{ maxWidth: 1300, margin: '40px auto 0', height: 1, background: 'linear-gradient(to right, #E10600, rgba(225,6,0,0.2), transparent)' }} />
      </div>

      {/* STEPS */}
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '40px 48px 100px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 56 }} className="steps-grid">
          {steps.map((step) => (
            <div key={step.number} style={{ borderRadius: 20, overflow: 'hidden', background: '#111', border: '1px solid rgba(255,255,255,0.07)', transition: 'all 0.3s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-8px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 24px 60px ${step.color}20`; (e.currentTarget as HTMLDivElement).style.borderColor = `${step.color}35`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}>

              {/* Zona visual — foto o icono grande */}
              <div style={{ height: 150, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${step.color}08` }}>
                {step.useImg && step.img ? (
                  <>
                    <img src={step.img} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
                    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(0deg, #111 0%, rgba(17,17,17,0.4) 60%, transparent 100%)` }} />
                    <div style={{ position: 'absolute', inset: 0, background: `${step.color}12` }} />
                  </>
                ) : (
                  /* Icono grande decorativo en lugar de foto */
                  <i className={step.icon} style={{ fontSize: 72, color: `${step.color}25`, position: 'relative', zIndex: 1 }} />
                )}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: step.color }} />
                <div style={{ position: 'absolute', top: 10, right: 14, fontFamily: "'Bebas Neue', sans-serif", fontSize: 60, color: `${step.color}20`, lineHeight: 1, userSelect: 'none' }}>{step.number}</div>
              </div>

              <div style={{ padding: '22px 22px 26px' }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: `${step.color}18`, border: `1px solid ${step.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <i className={step.icon} style={{ color: step.color, fontSize: 18 }} />
                </div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 4, color: step.color, marginBottom: 8 }}>PASO {step.number}</div>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: 'white', marginBottom: 10, lineHeight: 1.05 }}>{t(step.titleKey)}</h3>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>{t(step.descKey)}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center' }}>
          <button onClick={() => navigate('/auth')} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 4, color: 'white', background: 'linear-gradient(135deg, #E10600, #c00)', border: 'none', borderRadius: 14, padding: '20px 60px', cursor: 'pointer', boxShadow: '0 8px 40px rgba(225,6,0,0.4)', transition: 'all 0.25s' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 20px 60px rgba(225,6,0,0.55)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 40px rgba(225,6,0,0.4)'; }}>
            {t('btn_start_free')} →
          </button>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.18)', marginTop: 18, letterSpacing: 3, textTransform: 'uppercase' }}>Sin tarjeta · Sin coste · Para siempre</p>
        </div>
      </div>

      <style>{`@media(max-width:960px){.steps-grid{grid-template-columns:1fr 1fr!important}}`}</style>
    </section>
  );
}
