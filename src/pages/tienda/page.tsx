import { useNavigate } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';

export default function StorePage() {
  const navigate = useNavigate();
  useSEO({
    title: 'Tienda | RANKD',
    description: 'Merchandising oficial de RANKD. Muy pronto.',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#030303', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: 'calc(24px + env(safe-area-inset-top, 0px)) 24px calc(24px + env(safe-area-inset-bottom, 0px))', textAlign: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, rgba(201,168,76,0.10) 0%, transparent 55%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, #C9A84C 50%, transparent)' }} />

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 480 }}>
        <div className="anim-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, marginBottom: 36 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: '#ffffff', letterSpacing: 6, lineHeight: 1 }}>RAN</span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: '#E10600', letterSpacing: 6, lineHeight: 1 }}>KD</span>
          <span style={{ width: 8, height: 8, background: '#C9A84C', borderRadius: '50%', marginLeft: 5, marginTop: 5 }} />
        </div>

        <div className="anim-fade-up anim-d2 anim-float" style={{ width: 84, height: 84, margin: '0 auto 28px', borderRadius: 24, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="ri-shopping-bag-3-line" style={{ fontSize: 38, color: '#C9A84C' }} />
        </div>

        <h1 className="anim-fade-up anim-d3" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(38px, 8vw, 60px)', color: 'white', margin: '0 0 8px', letterSpacing: 2, lineHeight: 0.95 }}>
          TIENDA <span style={{ color: '#C9A84C' }}>RANKD</span>
        </h1>
        <div className="anim-fade-up anim-d4" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(20px, 4vw, 26px)', color: '#E10600', letterSpacing: 6, marginBottom: 18, textShadow: '0 0 30px rgba(225,6,0,0.4)' }}>
          PRÓXIMAMENTE
        </div>
        <p className="anim-fade-up anim-d5" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 36 }}>
          Merchandising oficial para los que viven el deporte de contacto. Estamos preparando algo a la altura.
        </p>

        <button
          onClick={() => navigate('/beta')}
          className="anim-fade-up anim-d6"
          style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: 3, color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.25)', borderRadius: 12, padding: '14px 34px', cursor: 'pointer', transition: 'all 0.25s' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(201,168,76,0.55)'; (e.currentTarget as HTMLButtonElement).style.color = '#C9A84C'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.25)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.85)'; }}
        >
          ← Volver a RANKD
        </button>
      </div>
    </div>
  );
}