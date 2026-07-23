import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#030303', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: 'calc(24px + env(safe-area-inset-top, 0px)) 24px calc(24px + env(safe-area-inset-bottom, 0px))', textAlign: 'center' }}>

      {/* Glow rojo */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 45%, rgba(225,6,0,0.12) 0%, transparent 55%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent 0%, #E10600 50%, transparent 100%)' }} />

      {/* 404 gigante de fondo */}
      <h1 style={{ position: 'absolute', fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(200px, 40vw, 420px)', color: 'rgba(255,255,255,0.04)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none', margin: 0 }}>
        404
      </h1>

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 480 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, marginBottom: 32 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, color: '#ffffff', letterSpacing: 5, lineHeight: 1 }}>RAN</span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, color: '#E10600', letterSpacing: 5, lineHeight: 1 }}>KD</span>
          <span style={{ width: 7, height: 7, background: '#C9A84C', borderRadius: '50%', marginLeft: 4, marginTop: 4 }} />
        </div>

        {/* Icono */}
        <div style={{ width: 72, height: 72, margin: '0 auto 24px', borderRadius: 20, background: 'rgba(225,6,0,0.1)', border: '1px solid rgba(225,6,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="ri-boxing-line" style={{ fontSize: 32, color: '#E10600' }} />
        </div>

        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(28px, 6vw, 40px)', color: 'white', margin: '0 0 12px', letterSpacing: 1 }}>
          Este combate no existe
        </h2>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 32 }}>
          La página que buscas no está disponible o ha cambiado de sitio.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/beta')}
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: 3, color: 'white', background: 'linear-gradient(135deg, #E10600, #c00)', border: 'none', borderRadius: 12, padding: '15px 32px', cursor: 'pointer', boxShadow: '0 8px 32px rgba(225,6,0,0.4)', transition: 'all 0.25s' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; }}
          >
            Ir al inicio →
          </button>
          <button
            onClick={() => navigate('/fighters')}
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: 3, color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 12, padding: '15px 28px', cursor: 'pointer', transition: 'all 0.25s' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(201,168,76,0.5)'; (e.currentTarget as HTMLButtonElement).style.color = '#C9A84C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.8)'; }}
          >
            Ver peleadores
          </button>
        </div>
      </div>
    </div>
  );
}