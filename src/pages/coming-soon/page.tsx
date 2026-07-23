import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ComingSoonPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'duplicate' | 'error'>('idle');

  const handleSubmit = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return;
    setStatus('sending');
    const { error } = await supabase.from('waitlist').insert({ email: clean });
    if (error) {
      if (error.code === '23505') setStatus('duplicate');
      else setStatus('error');
      return;
    }
    setStatus('done');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#030303', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: 'calc(24px + env(safe-area-inset-top, 0px)) 24px calc(24px + env(safe-area-inset-bottom, 0px))' }}>

      {/* Glow rojo de fondo */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, rgba(225,6,0,0.14) 0%, transparent 55%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', background: 'radial-gradient(ellipse at 50% 100%, rgba(201,168,76,0.06) 0%, transparent 60%)', pointerEvents: 'none' }} />
      {/* Línea roja top */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent 0%, #E10600 50%, transparent 100%)' }} />

      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: 560, width: '100%' }}>

        {/* Logo */}
        <div className="anim-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginBottom: 40 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(52px, 12vw, 76px)', color: '#ffffff', letterSpacing: 8, lineHeight: 1 }}>RAN</span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(52px, 12vw, 76px)', color: '#E10600', letterSpacing: 8, lineHeight: 1, textShadow: '0 0 60px rgba(225,6,0,0.6)' }}>KD</span>
          <span style={{ width: 10, height: 10, background: '#C9A84C', borderRadius: '50%', marginLeft: 6, marginTop: 8, flexShrink: 0, boxShadow: '0 0 16px rgba(201,168,76,0.8)' }} />
        </div>

        {/* Eyebrow */}
        <div className="anim-fade-up anim-d2" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 24, padding: '8px 22px', borderRadius: 100, border: '1px solid rgba(201,168,76,0.4)', background: 'rgba(201,168,76,0.08)' }}>
          <span style={{ width: 7, height: 7, background: '#C9A84C', borderRadius: '50%', boxShadow: '0 0 10px #C9A84C' }} />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase', color: '#C9A84C' }}>Próximamente</span>
        </div>

        {/* Headline */}
        <h1 className="anim-fade-up anim-d3" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(34px, 8vw, 56px)', color: 'white', lineHeight: 0.95, margin: '0 0 16px', letterSpacing: 1 }}>
          Algo grande está<br />
          <span style={{ color: '#E10600', textShadow: '0 0 40px rgba(225,6,0,0.5)' }}>a punto de llegar</span>
        </h1>

        {/* Fecha */}
        <div className="anim-fade-up anim-d4" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(22px, 5vw, 30px)', color: 'rgba(255,255,255,0.9)', letterSpacing: 6, marginBottom: 20 }}>
          1 DE SEPTIEMBRE
        </div>

        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 'clamp(16px, 3vw, 19px)', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, maxWidth: 440, margin: '0 auto 40px' }}>
          La plataforma que conecta peleadores, promotoras y marcas del deporte de contacto. Déjanos tu email y sé el primero en entrar.
        </p>

        {/* Email capture */}
        {status === 'done' ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '18px 32px', borderRadius: 14, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.35)' }}>
            <i className="ri-check-line" style={{ color: '#22c55e', fontSize: 22 }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, color: 'white' }}>¡Listo! Te avisaremos el día del lanzamiento.</span>
          </div>
        ) : status === 'duplicate' ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '18px 32px', borderRadius: 14, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.35)' }}>
            <i className="ri-star-line" style={{ color: '#C9A84C', fontSize: 22 }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, color: 'white' }}>Ese email ya está en la lista. ¡Nos vemos el 1 de septiembre!</span>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, maxWidth: 460, margin: '0 auto', flexWrap: 'wrap', justifyContent: 'center' }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="tu@email.com"
              style={{ flex: '1 1 240px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, color: 'white', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, padding: '16px 20px', outline: 'none', minWidth: 0 }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(225,6,0,0.6)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)')}
            />
            <button
              onClick={handleSubmit}
              disabled={status === 'sending'}
              style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: 'white', background: 'linear-gradient(135deg, #E10600, #c00)', border: 'none', borderRadius: 12, padding: '16px 32px', cursor: 'pointer', boxShadow: '0 8px 32px rgba(225,6,0,0.45)', transition: 'all 0.25s', whiteSpace: 'nowrap', opacity: status === 'sending' ? 0.7 : 1 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; }}
            >
              {status === 'sending' ? 'Enviando...' : 'Avísame →'}
            </button>
            {status === 'error' && (
              <p style={{ width: '100%', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: '#f87171', margin: '4px 0 0' }}>Error al enviar. Inténtalo de nuevo.</p>
            )}
          </div>
        )}

        {/* Footer mini */}
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: 3, textTransform: 'uppercase', marginTop: 56 }}>
          © 2026 RANKD · Peleadores · Promotoras · Marcas
        </p>
      </div>
    </div>
  );
}