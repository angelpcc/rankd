/**
 * Contenido SEO invisible visualmente pero 100% indexable por Google.
 * Se renderiza en el DOM real — Google lo lee aunque JS sea lento.
 */
export default function SEOContent() {
  return (
    <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }} aria-hidden="false">
      <h1>La plataforma para peleadores, promotoras y marcas de deportes de combate</h1>
      <p>
        RANKD es la plataforma gratuita que conecta peleadores profesionales y amateurs con promotoras,
        managers y marcas de deportes de combate en España y Latinoamérica. Boxeo, MMA, kickboxing,
        Muay Thai, grappling y más. Sin comisiones, sin intermediarios.
      </p>
      <nav>
        <a href="/fighters">Directorio de Peleadores</a>
        <a href="/opportunities">Oportunidades de Combate</a>
        <a href="/brands">Marcas y Patrocinadores</a>
        <a href="/auth">Crear cuenta gratis</a>
      </nav>
      <section>
        <h2>Para peleadores</h2>
        <p>Crea tu ficha deportiva completa con récord, vídeos y estadísticas. Sé descubierto por promotoras y managers reales. Aplica a combates, contratos y patrocinios directamente.</p>
      </section>
      <section>
        <h2>Para promotoras y clubes</h2>
        <p>Busca peleadores por peso, disciplina, nivel y disponibilidad. Publica oportunidades de combate y accede a talento verificado. Contacto directo sin intermediarios.</p>
      </section>
      <section>
        <h2>Para marcas y patrocinadores</h2>
        <p>Conecta con atletas de combate con presencia digital real. Filtra por disciplina, impacto y audiencia. Patrocina eventos y veladas directamente desde la plataforma.</p>
      </section>
    </div>
  );
}
