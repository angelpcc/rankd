import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function HowItWorks() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const steps = [
    {
      number: '01', icon: 'ri-user-add-line', titleKey: 'how_step1_title', descKey: 'how_step1_desc', color: '#E10600',
      img: 'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=400&q=80&fit=crop&crop=top',
      // Boxeador con guantes
    },
    {
      number: '02', icon: 'ri-search-eye-line', titleKey: 'how_step2_title', descKey: 'how_step2_desc', color: '#C9A84C',
      img: 'https://images.unsplash.com/photo-1609881523891-69aac36e4809?w=400&q=80&fit=crop',
      // Peleador MMA entrenando
    },
    {
      number: '03', icon: 'ri-shake-hands-line', titleKey: 'how_step3_title', descKey: 'how_step3_desc', color: '#E10600',
      img: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=400&q=80&fit=crop&crop=top',
      // Boxeadores en ring
    },
    {
      number: '04', icon: 'ri-trophy-line', titleKey: 'how_step4_title', descKey: 'how_step4_desc', color: '#C9A84C',
      img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80&fit=crop',
      // Boxeador levantando brazos victoria
    },
  ];

  return (
    <section id="how-it-works" style={{ background: '#0a0a0a', position: 'relative', overflow: 'hidden' }}>

      {/* TOP imagen ancha boxeo */}
      <div style={{ position: 'relative', height: 320, overflow: 'hidden' }}>
        <img
          src="https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=1920&q=85&fit=crop&crop=center"
          alt="Boxing"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, #0a0a0a 0%, rgba(10,10,10,0.65) 50%, rgba(10,10,10,0.3) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(225,6,0,0.1) 0%, transparent 60%)' }} />

        <div style={{ position: 'absolute', bottom: 40, left: 48, right: 48, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 36, height: 3, background: '#C9A84C', borderRadius: 2 }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase', color: '#C9A84C' }}>{t('how_eyebrow')}</span>
            </div>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(52px, 7vw, 96px)', lineHeight: 0.88, color: 'white', margin: 0 }}>
              {t('how_headline_1')}<br /><span style={{ color: '#E10600' }}>{t('how_headline_2')}</span>
            </h2>
          </div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, color: 'rgba(255,255,255,0.5)', maxWidth: 380, lineHeight: 1.55, marginBottom: 4 }}>{t('how_subtext')}</p>
        </div>
      </div>

      {/* STEPS */}
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '60px 48px 100px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 56 }} className="steps-grid">
          {steps.map((step) => (
            <div key={step.number} style={{ borderRadius: 20, overflow: 'hidden', background: '#111', border: '1px solid rgba(255,255,255,0.07)', transition: 'all 0.3s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-8px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 24px 60px ${step.color}20`; (e.currentTarget as HTMLDivElement).style.borderColor = `${step.color}35`; const img = (e.currentTarget as HTMLDivElement).querySelector('img') as HTMLImageElement; if (img) img.style.transform = 'scale(1.08)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)'; const img = (e.currentTarget as HTMLDivElement).querySelector('img') as HTMLImageElement; if (img) img.style.transform = 'scale(1)'; }}>
              {/* Imagen */}
              <div style={{ height: 150, position: 'relative', overflow: 'hidden' }}>
                <img src={step.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', transition: 'transform 0.6s ease' }} />
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(0deg, #111 0%, rgba(17,17,17,0.4) 60%, transparent 100%)` }} />
                <div style={{ position: 'absolute', inset: 0, background: `${step.color}15` }} />
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: step.color }} />
                <div style={{ position: 'absolute', top: 10, right: 14, fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, color: `${step.color}35`, lineHeight: 1, userSelect: 'none' }}>{step.number}</div>
              </div>
              {/* Info */}
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
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.2)', marginTop: 18, letterSpacing: 3, textTransform: 'uppercase' }}>Sin tarjeta · Sin coste · Para siempre</p>
        </div>
      </div>

      <style>{`@media(max-width:960px){.steps-grid{grid-template-columns:1fr 1fr!important}}`}</style>
    </section>
  );
}
