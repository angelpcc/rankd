import { useNavigate } from 'react-router-dom';

export default function PrivacyPage() {
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
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">Política de Privacidad</h1>
          <p className="text-sm text-zinc-500">Última actualización: {lastUpdated}</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8 text-zinc-300 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-white mb-3">1. Responsable del tratamiento</h2>
            <p><strong>Titular:</strong> Ángel Pita Couto</p>
            <p><strong>Correo:</strong> <a href="mailto:hola@rankd.com" className="text-red-400 hover:text-red-300">hola@rankd.com</a></p>
            <p><strong>País:</strong> España</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">2. Datos que recopilamos</h2>
            <p>Al usar RANKD podemos recopilar los siguientes datos:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-400">
              <li><strong>Datos de registro:</strong> nombre, correo electrónico, contraseña (cifrada), tipo de cuenta.</li>
              <li><strong>Datos de perfil:</strong> nombre artístico, biografía, disciplina, categoría de peso, nivel, gimnasio, ubicación, redes sociales, fotos y vídeos.</li>
              <li><strong>Datos de uso:</strong> oportunidades publicadas, postulaciones realizadas, mensajes enviados.</li>
              <li><strong>Datos técnicos:</strong> dirección IP (usada para detectar el país de registro), tipo de dispositivo, navegador.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">3. Finalidad del tratamiento</h2>
            <p>Utilizamos tus datos para:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-400">
              <li>Gestionar tu cuenta y acceso a la plataforma.</li>
              <li>Mostrar tu perfil a otros usuarios de la plataforma (si decides hacerlo público).</li>
              <li>Conectarte con promotoras, marcas u otros peleadores según tu perfil.</li>
              <li>Enviarte notificaciones relacionadas con la actividad en la plataforma.</li>
              <li>Mejorar el funcionamiento y la seguridad de RANKD.</li>
              <li>Detectar tu país de residencia para personalizar el directorio.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">4. Base legal del tratamiento</h2>
            <p>El tratamiento de tus datos se basa en:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-400">
              <li><strong>Ejecución de un contrato:</strong> necesitamos tus datos para prestarte el servicio.</li>
              <li><strong>Consentimiento:</strong> para el envío de comunicaciones o el uso de datos opcionales.</li>
              <li><strong>Interés legítimo:</strong> para mejorar la plataforma y garantizar su seguridad.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">5. Compartición de datos</h2>
            <p>No vendemos ni cedemos tus datos personales a terceros con fines comerciales. Podemos compartir datos con:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-400">
              <li><strong>Supabase:</strong> proveedor de base de datos y autenticación (alojado en la UE).</li>
              <li><strong>Vercel:</strong> proveedor de hosting de la plataforma.</li>
              <li><strong>Otros usuarios:</strong> los datos de tu perfil público son visibles para otros usuarios registrados.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">6. Conservación de datos</h2>
            <p>Conservamos tus datos mientras mantengas una cuenta activa en RANKD. Si eliminas tu cuenta, procederemos a eliminar tus datos en un plazo máximo de 30 días, salvo que la ley nos obligue a conservarlos durante más tiempo.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">7. Tus derechos</h2>
            <p>De acuerdo con el RGPD, tienes derecho a:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-400">
              <li><strong>Acceso:</strong> conocer qué datos tenemos sobre ti.</li>
              <li><strong>Rectificación:</strong> corregir datos incorrectos.</li>
              <li><strong>Supresión:</strong> solicitar la eliminación de tus datos.</li>
              <li><strong>Portabilidad:</strong> recibir tus datos en un formato estructurado.</li>
              <li><strong>Oposición:</strong> oponerte al tratamiento de tus datos en determinadas circunstancias.</li>
              <li><strong>Limitación:</strong> solicitar que restrinjamos el tratamiento de tus datos.</li>
            </ul>
            <p className="mt-2">Para ejercer cualquiera de estos derechos, escríbenos a <a href="mailto:hola@rankd.com" className="text-red-400 hover:text-red-300">hola@rankd.com</a>. También puedes presentar una reclamación ante la <a href="https://www.aepd.es" target="_blank" rel="noreferrer" className="text-red-400 hover:text-red-300">Agencia Española de Protección de Datos (AEPD)</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">8. Cookies</h2>
            <p>RANKD utiliza cookies técnicas necesarias para el funcionamiento de la plataforma (sesión de usuario, preferencias de idioma). No utilizamos cookies de seguimiento publicitario ni compartimos datos con plataformas de publicidad.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">9. Seguridad</h2>
            <p>Aplicamos medidas técnicas y organizativas para proteger tus datos: cifrado de contraseñas, conexiones HTTPS, control de acceso mediante autenticación. Sin embargo, ningún sistema es completamente infalible y no podemos garantizar la seguridad absoluta de los datos.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">10. Cambios en la política</h2>
            <p>Podemos actualizar esta política en cualquier momento. Te notificaremos los cambios relevantes a través de la plataforma. El uso continuado de RANKD tras la publicación de cambios implica su aceptación.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">11. Contacto</h2>
            <p>Para cualquier consulta sobre privacidad, escríbenos a <a href="mailto:hola@rankd.com" className="text-red-400 hover:text-red-300">hola@rankd.com</a>.</p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-600">© 2025 RANKD · Ángel Pita Couto · España</p>
          <a href="/terms" className="text-xs text-zinc-500 hover:text-white transition-colors">Términos y Condiciones →</a>
        </div>
      </div>
    </div>
  );
}