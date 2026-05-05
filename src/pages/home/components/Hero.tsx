import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';

export default function Hero() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    setTimeout(() => { el.style.opacity = '1'; el.style.transform = 'scale(1)'; }, 100);
  }, []);

  return (
    <section id="home" style={{ position: 'relative', width: '100%', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', background: '#030303' }}>

      {/* IMAGEN PRINCIPAL - muy visible */}
      <div ref={videoRef} style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0, transform: 'scale(1.04)', transition: 'all 1.4s ease' }}>
        <img src="https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=1920&q=95&fit=crop&crop=center" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '65% center' }} />
        {/* Overlay izquierda muy oscuro para legibilidad */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(3,3,3,1) 0%, rgba(3,3,3,0.92) 40%, rgba(3,3,3,0.55) 65%, rgba(3,3,3,0.1) 100%)' }} />
        {/* Overlay abajo */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(3,3,3,1) 0%, transparent 35%)' }} />
        {/* Tinte rojo sutil en esquina */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 75% 40%, rgba(225,6,0,0.12) 0%, transparent 50%)' }} />
      </div>

      {/* Barra roja top */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, zIndex: 10, background: 'linear-gradient(90deg, #E10600 0%, #ff3010 40%, transparent 100%)' }} />

      {/* Número decorativo grande */}
      <div style={{ position: 'absolute', right: '5%', bottom: '10%', fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(200px, 30vw, 380px)', color: 'rgba(225,6,0,0.04)', lineHeight: 1, userSelect: 'none', zIndex: 1, letterSpacing: -10 }}>01</div>

      {/* CONTENT */}
      <div style={{ position: 'relative', zIndex: 5, width: '100%', maxWidth: 1300, margin: '0 auto', padding: 'clamp(100px,12vw,160px) 48px clamp(80px,10vw,120px)', display: 'grid', gridTemplateColumns: '1fr 360px', gap: 48, alignItems: 'center' }} className="hero-grid">

        {/* LEFT */}
        <div>
          {/* TAG */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 36, padding: '8px 18px', borderRadius: 100, border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.06)' }}>
            <span style={{ width: 7, height: 7, background: '#C9A84C', borderRadius: '50%', boxShadow: '0 0 8px #C9A84C' }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase', color: '#C9A84C' }}>{t('hero_eyebrow')}</span>
          </div>

          {/* HEADLINE GIGANTE */}
          <h1 style={{ margin: '0 0 32px', lineHeight: 0.86 }}>
            <span style={{ display: 'block', fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(68px, 9.5vw, 130px)', color: 'white', letterSpacing: -2 }}>{t('hero_headline_1')}</span>
            <span style={{ display: 'block', fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(68px, 9.5vw, 130px)', color: '#E10600', letterSpacing: -2, textShadow: '0 0 80px rgba(225,6,0,0.5), 0 0 160px rgba(225,6,0,0.2)' }}>{t('hero_headline_2')}</span>
            <span style={{ display: 'block', fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(44px, 6vw, 82px)', color: 'transparent', letterSpacing: -1, WebkitTextStroke: '1px rgba(255,255,255,0.12)', fontStyle: 'italic' }}>{t('hero_headline_3')}</span>
          </h1>

          {/* SUBTEXT */}
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 'clamp(17px, 2vw, 22px)', fontWeight: 400, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55, maxWidth: 520, marginBottom: 48 }}>{t('hero_subtext')}</p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 56 }}>
            <button onClick={() => navigate('/auth')} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 3, color: 'white', background: 'linear-gradient(135deg, #E10600, #c00)', border: 'none', borderRadius: 12, padding: '18px 48px', cursor: 'pointer', boxShadow: '0 8px 40px rgba(225,6,0,0.5), 0 2px 0 rgba(255,100,80,0.4) inset', transition: 'all 0.25s', position: 'relative', overflow: 'hidden' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 20px 60px rgba(225,6,0,0.6)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 40px rgba(225,6,0,0.5), 0 2px 0 rgba(255,100,80,0.4) inset'; }}>
              {t('btn_create_free')} →
            </button>
            <button onClick={() => { const el = document.querySelector('#how-it-works'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 3, color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '18px 36px', cursor: 'pointer', transition: 'all 0.25s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#C9A84C'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(201,168,76,0.4)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(201,168,76,0.06)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.55)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}>
              Cómo funciona
            </button>
          </div>

          {/* STATS INLINE */}
          <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
            {[
              { num: '100%', label: 'Gratis' },
              { num: '0€', label: 'Comisiones' },
              { num: '3', label: 'Roles' },
            ].map((s, i) => (
              <div key={s.label} style={{ paddingRight: 32, marginRight: 32, borderRight: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: 'white', lineHeight: 1, letterSpacing: -1 }}>{s.num}</span>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: 3, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — Floating cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className="hero-right">
          {[
            { icon: 'ri-boxing-line', title: 'Peleadores', desc: 'Filtra por peso, disciplina y nivel', color: '#E10600' },
            { icon: 'ri-trophy-line', title: 'Promotoras', desc: 'Encuentra talento para tu velada', color: '#C9A84C' },
            { icon: 'ri-store-2-line', title: 'Marcas', desc: 'Conecta con atletas con alcance real', color: 'rgba(255,255,255,0.6)' },
          ].map((card) => (
            <div key={card.title} style={{ padding: '20px 22px', borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: `1px solid ${card.color}25`, backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', gap: 16, transition: 'all 0.25s', cursor: 'pointer' }}
              onClick={() => navigate('/auth')}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateX(6px)'; (e.currentTarget as HTMLDivElement).style.borderColor = `${card.color}50`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = `${card.color}25`; }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${card.color}15`, border: `1px solid ${card.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={card.icon} style={{ color: card.color, fontSize: 20 }} />
              </div>
              <div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: 'white', lineHeight: 1, marginBottom: 4, letterSpacing: 1 }}>{card.title}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.35)', lineHeight: 1.3 }}>{card.desc}</div>
              </div>
              <i className="ri-arrow-right-line" style={{ color: 'rgba(255,255,255,0.15)', marginLeft: 'auto', fontSize: 16 }} />
            </div>
          ))}
          <div style={{ padding: '16px 22px', borderRadius: 14, background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, background: '#22c55e', borderRadius: '50%', boxShadow: '0 0 8px #22c55e', flexShrink: 0 }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>{t('hero_indicator_active')}</span>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#C9A84C', marginLeft: 'auto', letterSpacing: 2, fontWeight: 700 }}>100% GRATIS</span>
          </div>
        </div>
      </div>

      {/* Scroll */}
      <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 5, animation: 'bounceY 2s ease-in-out infinite' }}>
        <i className="ri-arrow-down-s-line" style={{ color: 'rgba(255,255,255,0.15)', fontSize: 28 }} />
      </div>

      <style>{`
        @keyframes bounceY { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(10px)} }
        @media(max-width:960px){
          .hero-grid{grid-template-columns:1fr!important;padding-top:110px!important;padding-bottom:60px!important}
          .hero-right{display:none!important}
        }
      `}</style>
    </section>
  );
}
