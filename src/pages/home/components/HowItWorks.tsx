import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function HowItWorks() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const steps = [
    { number: '01', icon: 'ri-user-add-line', titleKey: 'how_step1_title', descKey: 'how_step1_desc', color: '#E10600' },
    { number: '02', icon: 'ri-search-eye-line', titleKey: 'how_step2_title', descKey: 'how_step2_desc', color: '#C9A84C' },
    { number: '03', icon: 'ri-shake-hands-line', titleKey: 'how_step3_title', descKey: 'how_step3_desc', color: '#E10600' },
    { number: '04', icon: 'ri-trophy-line', titleKey: 'how_step4_title', descKey: 'how_step4_desc', color: '#C9A84C' },
  ];

  return (
    <section id="how-it-works" style={{ padding: '120px 0', background: '#080808', position: 'relative', overflow: 'hidden' }}>
      {/* BG imagen MMA */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <img src="https://images.unsplash.com/photo-1544117519-31a4b719223d?w=1920&q=80&fit=crop" alt="MMA" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.04 }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto', padding: '0 40px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 80, flexWrap: 'wrap', gap: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 32, height: 2, background: '#C9A84C' }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase', color: '#C9A84C' }}>{t('how_eyebrow')}</span>
            </div>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(48px, 6vw, 88px)', lineHeight: 0.92, color: 'white', margin: 0 }}>
              {t('how_headline_1')}<br />
              <span style={{ color: 'rgba(255,255,255,0.12)' }}>{t('how_headline_2')}</span>
            </h2>
          </div>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, color: 'rgba(255,255,255,0.3)', maxWidth: 380, lineHeight: 1.6, textAlign: 'right' }}>{t('how_subtext')}</p>
        </div>

        {/* Steps */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }} className="steps-grid">
          {steps.map((step, i) => (
            <div key={step.number} style={{ background: '#080808', padding: '40px 32px', position: 'relative', transition: 'background 0.3s' }}
              onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.background = '#0e0e0e'}
              onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.background = '#080808'}>
              {/* Top border color */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: i % 2 === 0 ? '#E10600' : '#C9A84C', opacity: 0.6 }} />
              {/* Big num */}
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 90, color: 'rgba(255,255,255,0.03)', position: 'absolute', top: 8, right: 20, lineHeight: 1, pointerEvents: 'none' }}>{step.number}</span>
              {/* Icon */}
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `${step.color}15`, border: `1px solid ${step.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <i className={`${step.icon} text-xl`} style={{ color: step.color, fontSize: 20 }} />
              </div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 4, color: step.color, marginBottom: 10 }}>{step.number}</div>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: 'white', marginBottom: 12, lineHeight: 1 }}>{t(step.titleKey)}</h3>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>{t(step.descKey)}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ marginTop: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/auth')} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'white', background: '#E10600', border: 'none', borderRadius: 8, padding: '16px 40px', cursor: 'pointer', boxShadow: '0 0 30px rgba(225,6,0,0.25)', transition: 'all 0.2s' }} onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = '#b50009'} onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = '#E10600'}>
            {t('btn_start_free')} →
          </button>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.2)', letterSpacing: 2 }}>Sin tarjeta. Sin coste.</span>
        </div>
      </div>

      <style>{`@media(max-width:900px){.steps-grid{grid-template-columns:1fr!important}}`}</style>
    </section>
  );
}
