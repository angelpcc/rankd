import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Hero() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <section id="home" style={{ position: 'relative', width: '100%', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', background: '#050505' }}>
      
      {/* Background imagen boxeo */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <img
          src="https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=1920&q=80&fit=crop"
          alt="Boxing"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: 0.18 }}
        />
        {/* Gradiente encima */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #050505 45%, rgba(5,5,5,0.7) 70%, rgba(5,5,5,0.3) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #050505 0%, transparent 40%)' }} />
      </div>

      {/* Línea roja top */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(to right, #E10600, #ff4020, transparent)', zIndex: 2 }} />

      {/* Grid sutil */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '80px 80px', opacity: 0.6 }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 3, width: '100%', maxWidth: 1280, margin: '0 auto', padding: '140px 40px 80px', display: 'grid', gridTemplateColumns: '1fr 420px', gap: 60, alignItems: 'center' }} className="hero-grid">
        
        {/* Left */}
        <div>
          {/* Eyebrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <div style={{ width: 40, height: 2, background: '#C9A84C' }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase', color: '#C9A84C' }}>
              {t('hero_eyebrow')}
            </span>
          </div>

          {/* Headline */}
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(60px, 8vw, 120px)', lineHeight: 0.92, letterSpacing: -1, margin: '0 0 28px', color: 'white' }}>
            {t('hero_headline_1')}<br />
            <span style={{ color: '#E10600', WebkitTextStroke: '0px' }}>{t('hero_headline_2')}</span><br />
            <span style={{ color: 'rgba(255,255,255,0.15)', fontStyle: 'italic' }}>{t('hero_headline_3')}</span>
          </h1>

          {/* Subtext */}
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 400, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, maxWidth: 480, marginBottom: 44 }}>
            {t('hero_subtext')}
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/auth')} style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase',
              color: 'white', background: '#E10600', border: 'none', borderRadius: 8, padding: '16px 36px',
              cursor: 'pointer', boxShadow: '0 0 40px rgba(225,6,0,0.35)', transition: 'all 0.2s'
            }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 60px rgba(225,6,0,0.5)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 40px rgba(225,6,0,0.35)'; }}>
              {t('btn_create_free')} →
            </button>
            <button onClick={() => navigate('/opportunities')} style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '16px 32px', cursor: 'pointer', transition: 'all 0.2s'
            }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'white'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.3)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)'; }}>
              {t('btn_explore_opportunities')}
            </button>
          </div>

          {/* Indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 60, paddingTop: 28, borderTop: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 7, height: 7, background: '#22c55e', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.25)', letterSpacing: 1 }}>{t('hero_indicator_active')}</span>
            </div>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.15)', letterSpacing: 1 }}>{t('hero_indicator_disciplines')}</span>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.15)', letterSpacing: 1 }}>{t('hero_indicator_location')}</span>
          </div>
        </div>

        {/* Right — Stats cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="hero-stats">
          {[
            { num: '100%', label: 'Gratuito', desc: 'Sin coste ni comisiones', color: '#C9A84C' },
            { num: '3', label: 'Perfiles', desc: 'Peleador · Org · Marca', color: '#E10600' },
            { num: '∞', label: 'Oportunidades', desc: 'Combates, contratos, sponsors', color: 'rgba(255,255,255,0.6)' },
          ].map((s) => (
            <div key={s.label} style={{
              padding: '24px 28px', borderRadius: 14, position: 'relative', overflow: 'hidden',
              background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
              backdropFilter: 'blur(10px)',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: s.color, borderRadius: '0 2px 2px 0' }} />
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, color: 'white', lineHeight: 1, marginBottom: 4 }}>{s.num}</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: s.color, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.25)' }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll */}
      <div style={{ position: 'absolute', bottom: 40, right: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 3 }} className="hero-scroll-ind">
        <div style={{ width: 1, height: 60, background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.15))' }} />
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: 4, color: 'rgba(255,255,255,0.15)', textTransform: 'uppercase', writingMode: 'vertical-rl' }}>{t('label_scroll')}</span>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @media(max-width:900px){
          .hero-grid{grid-template-columns:1fr!important;gap:40px!important;padding:120px 24px 60px!important}
          .hero-stats{display:none!important}
          .hero-scroll-ind{display:none!important}
        }
      `}</style>
    </section>
  );
}
