import { useNavigate } from 'react-router-dom';

export default function TermsPage() {
  const navigate = useNavigate();
  const lastUpdated = '7 de junio de 2025';

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Top bar */}
      <div className="fixed top-0 left-0 w-full z-40 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer">
            <i className="ri-arrow-left-line"></i>
            Volver
          </button>
          <a href="/" className="flex items-center gap-0 cursor-pointer py-2">
            <span className="font-unbounded font-black tracking-tighter leading-none text-[17px] text-white" style={{ letterSpacing: '-0.04em' }}>RAN</span>
            <span className="font-unbounded font-black tracking-tighter leading-none text-[17px] text-[#E10600]" style={{ letterSpacing: '-0.04em' }}>KD</span>
          </a>
          <div className="w-16" />
        </div>
      </div>

      <div className="pt-20 pb-16 max-w-4xl mx-auto px-4 sm:px-6">
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">Términos y Condiciones</h1>
          <p className="text-sm text-zinc-500">Última actualización: {lastUpdated}</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8 text-zinc-300 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-white mb-3">1. Información del titular</h2>
            <p>RANKD es una plataforma digital titularidad de <strong>Ángel Pita Couto</strong>, con domicilio en España. Para cualquier consulta puedes contactar en <a href="mailto:hola@rankd.com" className="text-red-400 hover:text-red-300">hola@rankd.com</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">2. Objeto</h2>
            <p>RANKD es una plataforma de conexión entre peleadores de deportes de combate, promotoras, clubes y marcas. Su objetivo es facilitar el contacto y la creación de oportunidades profesionales en el ámbito del boxeo, MMA, kickboxing, muay thai y disciplinas afines.</p>
            <p className="mt-2">El uso de la plataforma implica la aceptación plena de estos Términos y Condiciones. Si no estás de acuerdo con alguno de ellos, debes abandonar el sitio.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">3. Registro y cuenta de usuario</h2>
            <p>Para acceder a las funcionalidades completas de RANKD es necesario crear una cuenta. Al registrarte, aceptas:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-400">
              <li>Proporcionar información veraz, completa y actualizada.</li>
              <li>Mantener la confidencialidad de tus credenciales de acceso.</li>
              <li>Ser responsable de toda la actividad realizada desde tu cuenta.</li>
              <li>Notificar inmediatamente cualquier uso no autorizado de tu cuenta.</li>
            </ul>
            <p className="mt-2">RANKD se reserva el derecho de suspender o eliminar cuentas que incumplan estos términos.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">4. Uso aceptable</h2>
            <p>Al utilizar RANKD, te comprometes a no:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-400">
              <li>Publicar información falsa, engañosa o fraudulenta.</li>
              <li>Suplantar la identidad de otra persona u organización.</li>
              <li>Utilizar la plataforma para fines ilegales o no autorizados.</li>
              <li>Enviar spam, mensajes no solicitados o contenido ofensivo.</li>
              <li>Intentar acceder a datos o sistemas de otros usuarios sin autorización.</li>
              <li>Publicar contenido discriminatorio, violento, obsceno o que vulnere derechos de terceros.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">5. Perfiles y contenido</h2>
            <p>Los usuarios son responsables del contenido que publican en sus perfiles (fotos, vídeos, textos, estadísticas, etc.). Al publicar contenido en RANKD, declaras que:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-400">
              <li>Tienes los derechos necesarios sobre dicho contenido.</li>
              <li>El contenido no infringe derechos de propiedad intelectual de terceros.</li>
              <li>El contenido es veraz y no induce a error.</li>
            </ul>
            <p className="mt-2">RANKD se reserva el derecho de eliminar cualquier contenido que considere inapropiado o que incumpla estos términos, sin previo aviso.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">6. Oportunidades y postulaciones</h2>
            <p>Las oportunidades publicadas en RANKD son responsabilidad exclusiva de quien las publica. RANKD actúa como intermediario técnico y no garantiza la veracidad, disponibilidad ni resultado de ninguna oportunidad publicada.</p>
            <p className="mt-2">RANKD no es parte en ningún acuerdo, contrato o relación laboral que pueda surgir entre los usuarios de la plataforma.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">7. Gratuidad del servicio</h2>
            <p>El uso de RANKD es actualmente gratuito para todos los usuarios. RANKD se reserva el derecho de introducir funcionalidades de pago en el futuro, notificando a los usuarios con antelación suficiente.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">8. Propiedad intelectual</h2>
            <p>El nombre, logotipo, diseño y contenidos propios de RANKD están protegidos por derechos de propiedad intelectual. Queda prohibida su reproducción, distribución o uso sin autorización expresa del titular.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">9. Limitación de responsabilidad</h2>
            <p>RANKD no se hace responsable de:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-400">
              <li>Los daños derivados del uso o imposibilidad de uso de la plataforma.</li>
              <li>La veracidad del contenido publicado por los usuarios.</li>
              <li>Los acuerdos o relaciones entre usuarios.</li>
              <li>Interrupciones del servicio por causas técnicas o de fuerza mayor.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">10. Modificaciones</h2>
            <p>RANKD se reserva el derecho de modificar estos Términos y Condiciones en cualquier momento. Los cambios serán notificados a través de la plataforma. El uso continuado de RANKD tras la publicación de cambios implica la aceptación de los nuevos términos.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">11. Legislación aplicable</h2>
            <p>Estos Términos y Condiciones se rigen por la legislación española. Para cualquier controversia derivada del uso de RANKD, las partes se someten a los juzgados y tribunales de España.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">12. Contacto</h2>
            <p>Para cualquier consulta relacionada con estos términos, puedes contactarnos en <a href="mailto:hola@rankd.com" className="text-red-400 hover:text-red-300">hola@rankd.com</a>.</p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-600">© 2025 RANKD · Ángel Pita Couto · España</p>
          <a href="/privacy" className="text-xs text-zinc-500 hover:text-white transition-colors">Política de Privacidad →</a>
        </div>
      </div>
    </div>
  );
}