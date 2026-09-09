// Puerta pública mientras RANKD no está lanzada.
//
// Versión simple a propósito: logo + "Próximamente", sin cuenta atrás ni
// captura de email (la anterior sí las tenía — ver git `ca3b1b28^`). El acceso
// real para revisar/grabar la app es la ruta no enlazada de `PreviewEntry`
// (ver ACCESO_DEMO.md), no un formulario aquí.
//
// SIN enlace a /auth, a propósito: mientras no esté lanzada, esta pantalla no
// insinúa que haya nada detrás. Se probó a poner uno ("Ya tengo cuenta") y se
// quitó por decisión del dueño.
//
// OJO al efecto secundario: la puerta se abre con la marca de PreviewEntry O
// con sesión iniciada. Quien entra por la sesión (la app instalada en el móvil)
// no tiene la marca en ese dispositivo, así que el día que se le cierre la
// sesión cae aquí — y en modo standalone no hay barra de direcciones donde
// escribir /vista-previa-rk28. La salida entonces es abrir
// rankd-black.vercel.app/vista-previa-rk28 en el navegador normal del móvil.
export default function ComingSoonPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#030303',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: 'calc(24px + env(safe-area-inset-top, 0px)) 24px calc(24px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Glow rojo de fondo */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, rgba(225,6,0,0.14) 0%, transparent 55%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', background: 'radial-gradient(ellipse at 50% 100%, rgba(201,168,76,0.06) 0%, transparent 60%)', pointerEvents: 'none' }} />
      {/* Línea roja superior */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent 0%, #E10600 50%, transparent 100%)' }} />

      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: 560, width: '100%' }}>
        {/* Logo */}
        <div className="anim-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginBottom: 32 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(52px, 12vw, 76px)', color: '#ffffff', letterSpacing: 8, lineHeight: 1 }}>RAN</span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(52px, 12vw, 76px)', color: '#E10600', letterSpacing: 8, lineHeight: 1, textShadow: '0 0 60px rgba(225,6,0,0.6)' }}>KD</span>
          <span style={{ width: 10, height: 10, background: '#C9A84C', borderRadius: '50%', marginLeft: 6, marginTop: 8, flexShrink: 0, boxShadow: '0 0 16px rgba(201,168,76,0.8)' }} />
        </div>

        {/* Eyebrow */}
        <div className="anim-fade-up anim-d2" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 22, padding: '8px 22px', borderRadius: 100, border: '1px solid rgba(201,168,76,0.4)', background: 'rgba(201,168,76,0.08)' }}>
          <span style={{ width: 7, height: 7, background: '#C9A84C', borderRadius: '50%', boxShadow: '0 0 10px #C9A84C' }} />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase', color: '#C9A84C' }}>Próximamente</span>
        </div>

        {/* Titular */}
        <h1 className="anim-fade-up anim-d3" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(34px, 8vw, 56px)', color: 'white', lineHeight: 0.95, margin: '0 0 18px', letterSpacing: 1 }}>
          Algo grande está<br />
          <span style={{ color: '#E10600', textShadow: '0 0 40px rgba(225,6,0,0.5)' }}>a punto de llegar</span>
        </h1>

        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 'clamp(16px, 3vw, 19px)', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
          La plataforma que conecta peleadores, promotoras y marcas del deporte de contacto. Volvemos pronto.
        </p>

        {/* Footer mini */}
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: 3, textTransform: 'uppercase', marginTop: 48 }}>
          © 2026 RANKD · Peleadores · Promotoras · Marcas
        </p>
      </div>
    </div>
  );
}
