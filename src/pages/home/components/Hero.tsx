import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';

export default function Hero() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bgRef.current;
    if (!el) return;
    setTimeout(() => { el.style.opacity = '1'; el.style.transform = 'scale(1)'; }, 80);
  }, []);

  return (
    <section id="home" style={{ position: 'relative', width: '100%', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', background: '#030303' }}>

      {/* ── FONDO CINEMATOGRÁFICO ── */}
      <div ref={bgRef} style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0, transform: 'scale(1.05)', transition: 'all 1.8s ease' }}>
        {/* Foto principal — peleador de espaldas mirando ring con luces */}
        <img
          src="https://oqsobiykaaqelgfjgsor.supabase.co/storage/v1/object/public/images/0b31c269-e57b-4544-9db5-89b290862f50.png"
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}
        />
        {/* Overlay principal — oscuro izquierda, deja ver derecha */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(100deg, rgba(3,3,3,1) 0%, rgba(3,3,3,0.95) 35%, rgba(3,3,3,0.7) 60%, rgba(3,3,3,0.2) 100%)' }} />
        {/* Oscurecer abajo */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(3,3,3,1) 0%, rgba(3,3,3,0.5) 25%, transparent 55%)' }} />
        {/* Glow rojo cinematográfico */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 65% 50%, rgba(225,6,0,0.12) 0%, transparent 50%)' }} />
        {/* Tinte dorado muy sutil esquina superior derecha */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: '40%', height: '40%', background: 'radial-gradient(ellipse at 100% 0%, rgba(201,168,76,0.06) 0%, transparent 60%)' }} />
        {/* Vignette bordes */}
        <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 200px rgba(0,0,0,0.7)' }} />
      </div>

      {/* ── LÍNEA ROJA TOP ── */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, zIndex: 10, background: 'linear-gradient(90deg, #E10600 0%, #ff4020 50%, transparent 100%)' }} />

      {/* ── LÍNEA DORADA DIAGONAL DECORATIVA ── */}
      <div style={{ position: 'absolute', left: '42%', top: '10%', bottom: '10%', width: 1, background: 'linear-gradient(to bottom, transparent, rgba(201,168,76,0.15), transparent)', zIndex: 2, transform: 'rotate(8deg)' }} />

      {/* ── CONTENT ── */}
      <div style={{ position: 'relative', zIndex: 5, width: '100%', maxWidth: 1300, margin: '0 auto', padding: 'clamp(110px,13vw,170px) 48px clamp(80px,10vw,120px)', display: 'grid', gridTemplateColumns: '1fr 360px', gap: 48, alignItems: 'center' }} className="hero-grid">

        {/* LEFT */}
        <div>
          {/* Eyebrow dorado */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 36, padding: '8px 20px', borderRadius: 100, border: '1px solid rgba(201,168,76,0.35)', background: 'rgba(201,168,76,0.07)', backdropFilter: 'blur(8px)' }}>
            <span style={{ width: 7, height: 7, background: '#C9A84C', borderRadius: '50%', boxShadow: '0 0 10px #C9A84C' }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase', color: '#C9A84C' }}>{t('hero_eyebrow')}</span>
          </div>

          {/* HEADLINE */}
          <h1 style={{ margin: '0 0 28px', lineHeight: 0.86 }}>
            <span style={{ display: 'block', fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(64px, 9vw, 126px)', color: '#ffffff', letterSpacing: -2 }}>{t('hero_headline_1')}</span>
            <span style={{ display: 'block', fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(64px, 9vw, 126px)', color: '#E10600', letterSpacing: -2, textShadow: '0 0 60px rgba(225,6,0,0.55), 0 0 120px rgba(225,6,0,0.2)' }}>{t('hero_headline_2')}</span>
            <span style={{ display: 'block', fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(40px, 5.5vw, 78px)', color: 'transparent', letterSpacing: -1, WebkitTextStroke: '1px rgba(255,255,255,0.1)', fontStyle: 'italic' }}>{t('hero_headline_3')}</span>
          </h1>

          {/* SUBTEXT — más legible */}
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 'clamp(17px, 2vw, 21px)', fontWeight: 400, color: 'rgba(255,255,255,0.58)', lineHeight: 1.6, maxWidth: 500, marginBottom: 48 }}>{t('hero_subtext')}</p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 56 }}>
            <button onClick={() => navigate('/auth')} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 3, color: 'white', background: 'linear-gradient(135deg, #E10600, #c00)', border: 'none', borderRadius: 12, padding: '18px 48px', cursor: 'pointer', boxShadow: '0 8px 40px rgba(225,6,0,0.5), 0 2px 0 rgba(255,80,60,0.4) inset', transition: 'all 0.25s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 20px 60px rgba(225,6,0,0.65)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 40px rgba(225,6,0,0.5), 0 2px 0 rgba(255,80,60,0.4) inset'; }}>
              {t('btn_create_free')} →
            </button>
            <button onClick={() => { document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' }); }} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 3, color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.14)', borderRadius: 12, padding: '18px 36px', cursor: 'pointer', transition: 'all 0.25s', backdropFilter: 'blur(8px)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#C9A84C'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(201,168,76,0.45)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(201,168,76,0.07)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.55)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.14)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}>
              Cómo funciona
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, paddingTop: 28, borderTop: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, background: '#22c55e', borderRadius: '50%', boxShadow: '0 0 10px #22c55e' }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.45)', letterSpacing: 1 }}>{t('hero_indicator_active')}</span>
            </div>
            <span style={{ color: 'rgba(255,255,255,0.08)', fontSize: 18 }}>·</span>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: '#C9A84C', letterSpacing: 1, textShadow: '0 0 20px rgba(201,168,76,0.3)' }}>100%</span>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, textTransform: 'uppercase' }}>Gratuito · Sin comisiones</span>
          </div>
        </div>

        {/* RIGHT — Cards flotantes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} className="hero-right">
          {[
            { icon: 'ri-boxing-line', title: 'Peleadores', desc: 'Crea tu ficha y sé encontrado por promotoras', color: '#E10600' },
            { icon: 'ri-trophy-line', title: 'Promotoras', desc: 'Encuentra el talento exacto para tu velada', color: '#C9A84C' },
            { icon: 'ri-store-2-line', title: 'Marcas', desc: 'Conecta con atletas con comunidad real', color: 'rgba(255,255,255,0.5)' },
          ].map((card) => (
            <div key={card.title} style={{ padding: '18px 20px', borderRadius: 14, background: 'rgba(10,10,10,0.7)', border: `1px solid ${card.color}20`, backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.25s', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}
              onClick={() => navigate('/auth')}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(20,20,20,0.85)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateX(6px)'; (e.currentTarget as HTMLDivElement).style.borderColor = `${card.color}45`; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 30px rgba(0,0,0,0.5), 0 0 20px ${card.color}12`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(10,10,10,0.7)'; (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = `${card.color}20`; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)'; }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: `${card.color}12`, border: `1px solid ${card.color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={card.icon} style={{ color: card.color, fontSize: 18 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 19, color: 'white', lineHeight: 1, marginBottom: 3, letterSpacing: 0.5 }}>{card.title}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.42)', lineHeight: 1.3 }}>{card.desc}</div>
              </div>
              <i className="ri-arrow-right-line" style={{ color: 'rgba(255,255,255,0.1)', fontSize: 14, flexShrink: 0 }} />
            </div>
          ))}
          <div style={{ padding: '12px 18px', borderRadius: 12, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', gap: 10, backdropFilter: 'blur(12px)' }}>
            <span style={{ width: 7, height: 7, background: '#22c55e', borderRadius: '50%', boxShadow: '0 0 8px #22c55e', flexShrink: 0 }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.42)', letterSpacing: 0.5 }}>Plataforma activa · Únete gratis</span>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: '#C9A84C', marginLeft: 'auto', letterSpacing: 2 }}>100% FREE</span>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, animation: 'bounceY 2.5s ease-in-out infinite' }}>
        <i className="ri-arrow-down-s-line" style={{ color: 'rgba(255,255,255,0.12)', fontSize: 26 }} />
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
