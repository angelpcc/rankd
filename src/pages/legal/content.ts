import type { LegalSection } from './LegalPage';

// Contenido legal en es/en (R13-T6). Base sólida y adecuada a España (RGPD),
// pero NO sustituye la revisión de un profesional. Refleja las funciones reales
// de la plataforma, incluidas las nuevas: espacio de entrenador, roster con
// consentimiento, telemetría anónima del escaparate y el coach IA.

const CONTACT = 'hola@rankd.com';
const OWNER = 'Ángel Pita Couto';

export const LEGAL_UPDATED = { es: 'Última actualización: 31 de julio de 2026', en: 'Last updated: 31 July 2026' };
export const LEGAL_FOOTER = { es: `© 2026 RANKD · ${OWNER} · España`, en: `© 2026 RANKD · ${OWNER} · Spain` };

export const termsContent: Record<'es' | 'en', LegalSection[]> = {
  es: [
    { h: '1. Titular', p: [`RANKD es una plataforma digital titularidad de ${OWNER}, con domicilio en España. Contacto: ${CONTACT}.`] },
    { h: '2. Objeto', p: [
      'RANKD conecta el ecosistema de los deportes de contacto (boxeo, MMA, kickboxing, muay thai y afines): peleadores, promotoras, gimnasios/clubes, entrenadores, managers y marcas.',
      'El uso de la plataforma implica la aceptación plena de estos Términos. Si no estás de acuerdo, debes abandonar el sitio.',
    ] },
    { h: '3. Tipos de cuenta', p: ['RANKD ofrece distintos perfiles, cada uno con funciones propias:'], ul: [
      'Peleador (competidor): perfil deportivo público, récord y oportunidades.',
      'Peleador (afición): espacio de entrenamiento privado "Mi Esquina", sin ficha competitiva.',
      'Promotora: organización de eventos y carteleras, búsqueda de talento.',
      'Gimnasio / Club: perfil, galería, y gestión de su equipo de entrenadores.',
      'Entrenador: vinculado a un gimnasio mediante invitación; dirige el trabajo de su grupo (plan del club, roster de boxeadores).',
      'Manager: gestión de carreras y contacto con promotoras.',
      'Marca / Patrocinador: escaparate de producto y búsqueda de patrocinio.',
    ] },
    { h: '4. Registro y cuenta', p: ['Al registrarte, aceptas:'], ul: [
      'Proporcionar información veraz, completa y actualizada.',
      'Mantener la confidencialidad de tus credenciales.',
      'Ser responsable de la actividad de tu cuenta.',
      'Notificar cualquier uso no autorizado.',
    ] },
    { h: '5. Espacio de entrenador y datos del club', p: [
      'El entrenador se une a un gimnasio a través de una invitación generada por este. Puede planificar la semana del club y gestionar un listado de sus boxeadores.',
      'La actividad de entrenamiento de un boxeador (registro de sesiones, peso, etc.) es PRIVADA y solo se comparte con su gimnasio si el propio boxeador lo autoriza expresamente. El entrenador únicamente ve un resumen (última sesión y recuento semanal) de quien haya dado su consentimiento, nunca el contenido detallado.',
    ] },
    { h: '6. Uso aceptable', p: ['Te comprometes a no:'], ul: [
      'Publicar información falsa, engañosa o fraudulenta.',
      'Suplantar a otra persona u organización.',
      'Usar la plataforma para fines ilegales.',
      'Enviar spam o contenido ofensivo, violento o discriminatorio.',
      'Acceder a datos o sistemas de otros usuarios sin autorización.',
    ] },
    { h: '7. Contenido y responsabilidad', p: [
      'Eres responsable del contenido que publicas (fotos, vídeos, textos, estadísticas). Declaras tener los derechos necesarios y que no infringe derechos de terceros.',
      'RANKD puede retirar contenido inapropiado o que incumpla estos Términos.',
    ] },
    { h: '8. Eventos, carteleras y oportunidades', p: [
      'Los eventos, carteleras de combate y oportunidades son responsabilidad exclusiva de quien los publica. RANKD actúa como intermediario técnico y no garantiza su veracidad ni resultado, ni es parte en acuerdos entre usuarios.',
    ] },
    { h: '9. Escaparate de marca y enlaces externos', p: [
      'Las marcas pueden mostrar productos con enlaces a su propia web de compra. Las compras se realizan FUERA de RANKD, en la web de la marca; RANKD no interviene en esas transacciones ni responde por ellas.',
    ] },
    { h: '10. Inteligencia artificial', p: [
      'Algunas funciones ofrecen asistencia mediante IA (por ejemplo, un coach de entrenamiento o nutrición). Sus respuestas son orientativas y no sustituyen el criterio de un profesional cualificado (médico, entrenador o nutricionista). Al usarlas, parte de tu texto puede procesarse por un proveedor de IA para generar la respuesta.',
    ] },
    { h: '11. Gratuidad del servicio', p: ['RANKD es actualmente gratuito. Nos reservamos el derecho de introducir funciones de pago en el futuro, avisando con antelación.'] },
    { h: '12. Propiedad intelectual', p: ['El nombre, logotipo, diseño y contenidos propios de RANKD están protegidos. Queda prohibida su reproducción o uso sin autorización expresa.'] },
    { h: '13. Limitación de responsabilidad', p: ['RANKD no se responsabiliza de los daños derivados del uso de la plataforma, la veracidad del contenido de los usuarios, los acuerdos entre ellos, ni las interrupciones por causas técnicas o de fuerza mayor.'] },
    { h: '14. Modificaciones', p: ['Podemos modificar estos Términos. Los cambios se notificarán en la plataforma y el uso continuado implica su aceptación.'] },
    { h: '15. Legislación y jurisdicción', p: ['Estos Términos se rigen por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales de España.'] },
    { h: '16. Contacto', p: [`Para cualquier consulta: ${CONTACT}.`] },
  ],
  en: [
    { h: '1. Owner', p: [`RANKD is a digital platform owned by ${OWNER}, domiciled in Spain. Contact: ${CONTACT}.`] },
    { h: '2. Purpose', p: [
      'RANKD connects the combat-sports ecosystem (boxing, MMA, kickboxing, muay thai and related): fighters, promoters, gyms/clubs, coaches, managers and brands.',
      'Using the platform implies full acceptance of these Terms. If you disagree, you must leave the site.',
    ] },
    { h: '3. Account types', p: ['RANKD offers several profiles, each with its own features:'], ul: [
      'Fighter (competitor): public sporting profile, record and opportunities.',
      'Fighter (hobby): private training space "My Corner", no competitive record.',
      'Promoter: event and fight-card management, talent search.',
      'Gym / Club: profile, gallery, and management of its coaching team.',
      'Coach: linked to a gym by invitation; leads their group (club plan, boxer roster).',
      'Manager: career management and contact with promoters.',
      'Brand / Sponsor: product storefront and sponsorship search.',
    ] },
    { h: '4. Registration and account', p: ['By signing up, you agree to:'], ul: [
      'Provide truthful, complete and up-to-date information.',
      'Keep your credentials confidential.',
      'Be responsible for your account activity.',
      'Report any unauthorised use.',
    ] },
    { h: '5. Coach space and club data', p: [
      'A coach joins a gym through an invitation the gym generates. They can plan the club week and manage a list of their boxers.',
      'A boxer’s training activity (session logs, weight, etc.) is PRIVATE and is only shared with their gym if the boxer expressly authorises it. The coach only sees a summary (last session and weekly count) of those who consented, never the detailed content.',
    ] },
    { h: '6. Acceptable use', p: ['You agree not to:'], ul: [
      'Post false, misleading or fraudulent information.',
      'Impersonate another person or organisation.',
      'Use the platform for illegal purposes.',
      'Send spam or offensive, violent or discriminatory content.',
      'Access other users’ data or systems without authorisation.',
    ] },
    { h: '7. Content and responsibility', p: [
      'You are responsible for the content you publish (photos, videos, text, statistics). You declare you hold the necessary rights and that it does not infringe third-party rights.',
      'RANKD may remove inappropriate content or content that breaches these Terms.',
    ] },
    { h: '8. Events, fight cards and opportunities', p: [
      'Events, fight cards and opportunities are the sole responsibility of whoever publishes them. RANKD acts as a technical intermediary and does not guarantee their accuracy or outcome, nor is it a party to agreements between users.',
    ] },
    { h: '9. Brand storefront and external links', p: [
      'Brands may show products with links to their own purchase website. Purchases happen OUTSIDE RANKD, on the brand’s site; RANKD does not take part in those transactions nor is liable for them.',
    ] },
    { h: '10. Artificial intelligence', p: [
      'Some features offer AI assistance (for example, a training or nutrition coach). Its answers are indicative and do not replace the judgement of a qualified professional (doctor, coach or nutritionist). When you use them, part of your text may be processed by an AI provider to generate the response.',
    ] },
    { h: '11. Free service', p: ['RANKD is currently free. We reserve the right to introduce paid features in the future, with prior notice.'] },
    { h: '12. Intellectual property', p: ['RANKD’s name, logo, design and own content are protected. Their reproduction or use without express authorisation is prohibited.'] },
    { h: '13. Limitation of liability', p: ['RANKD is not liable for damages arising from use of the platform, the accuracy of user content, agreements between users, or interruptions due to technical causes or force majeure.'] },
    { h: '14. Changes', p: ['We may amend these Terms. Changes will be notified on the platform and continued use implies acceptance.'] },
    { h: '15. Governing law and jurisdiction', p: ['These Terms are governed by Spanish law. For any dispute, the parties submit to the courts of Spain.'] },
    { h: '16. Contact', p: [`For any query: ${CONTACT}.`] },
  ],
};

export const privacyContent: Record<'es' | 'en', LegalSection[]> = {
  es: [
    { h: '1. Responsable del tratamiento', p: [`Titular: ${OWNER}.`, `Correo: ${CONTACT}.`, 'País: España.'] },
    { h: '2. Datos que recopilamos', ul: [
      'Datos de registro: nombre, correo, contraseña (cifrada), tipo de cuenta y país (detectado por IP en el alta).',
      'Datos de perfil: apodo, biografía, disciplina, categoría de peso, nivel, gimnasio, ubicación, redes y contenido que subas (fotos, vídeos).',
      'Datos de entrenamiento (Mi Esquina): sesiones, peso, objetivos, documentos y vídeos de sparring. Son privados por defecto.',
      'Datos de uso: oportunidades, postulaciones, mensajes, eventos y carteleras que publiques.',
      'Telemetría del escaparate de marca: eventos anónimos (una vista, un clic en un enlace) para dar a la marca estadísticas agregadas. No se vincula a tu identidad.',
      'Datos técnicos: dirección IP (país), tipo de dispositivo y navegador.',
    ] },
    { h: '3. Finalidad', ul: [
      'Gestionar tu cuenta y el acceso.',
      'Mostrar tu perfil a otros usuarios si decides hacerlo público.',
      'Conectarte con promotoras, marcas, gimnasios u otros peleadores.',
      'Permitir a tu gimnasio seguir tu actividad SOLO si tú lo autorizas.',
      'Enviar notificaciones de la actividad de la plataforma.',
      'Ofrecer estadísticas agregadas y anónimas a las marcas sobre su escaparate.',
      'Mejorar el funcionamiento y la seguridad de RANKD.',
    ] },
    { h: '4. Base legal', ul: [
      'Ejecución de un contrato: para prestarte el servicio.',
      'Consentimiento: para datos opcionales, comunicaciones y para compartir tu actividad con tu gimnasio.',
      'Interés legítimo: para la seguridad y la mejora de la plataforma, y para las métricas anónimas de escaparate.',
    ] },
    { h: '5. Datos según tu tipo de cuenta', ul: [
      'Peleador: tu ficha es visible solo si la haces pública. Tu Mi Esquina (entrenos, peso, documentos, vídeos) es privada y ni siquiera el administrador la consulta.',
      'Boxeador en un club: estar en el roster de un gimnasio no comparte tu actividad; solo se comparte un resumen si activas el consentimiento, y puedes retirarlo o salir del club cuando quieras.',
      'Marca: recibe métricas de su escaparate de forma agregada y anónima; no ve quién concretamente ha visto o pulsado.',
    ] },
    { h: '6. Encargados del tratamiento', p: ['No vendemos tus datos. Nos apoyamos en proveedores que los tratan por cuenta nuestra:'], ul: [
      'Supabase: base de datos y autenticación (alojado en la UE).',
      'Vercel: hosting de la plataforma.',
      'Resend: envío de correos transaccionales, cuando esté activo.',
      'Proveedor de IA (Anthropic): procesa el texto de las consultas al coach IA, cuando esa función esté activa.',
      'Otros usuarios: los datos de tu perfil público son visibles para usuarios registrados.',
    ] },
    { h: '7. Conservación', p: ['Conservamos tus datos mientras tu cuenta esté activa. Si la eliminas, borramos tus datos en un plazo máximo de 30 días, salvo obligación legal de conservarlos más tiempo.'] },
    { h: '8. Tus derechos (RGPD)', p: ['Tienes derecho de acceso, rectificación, supresión, portabilidad, oposición y limitación.'], ul: [
      `Para ejercerlos, escríbenos a ${CONTACT}.`,
      'También puedes reclamar ante la Agencia Española de Protección de Datos: https://www.aepd.es',
    ] },
    { h: '9. Menores', p: ['RANKD no está dirigida a menores de 14 años. Si eres menor de edad, necesitas el consentimiento de tus padres o tutores para usar la plataforma conforme a la normativa española.'] },
    { h: '10. Cookies y almacenamiento local', p: [
      'RANKD usa almacenamiento técnico necesario (sesión, preferencia de idioma) y almacenamiento local del navegador para recordar ajustes y evitar contar dos veces una misma vista de escaparate. No usamos cookies de publicidad ni de seguimiento entre sitios.',
    ] },
    { h: '11. Seguridad', p: ['Aplicamos medidas técnicas y organizativas: contraseñas cifradas, conexiones HTTPS y control de acceso. Ningún sistema es infalible al 100%.'] },
    { h: '12. Transferencias internacionales', p: ['Algunos proveedores pueden tratar datos fuera del Espacio Económico Europeo. En ese caso, se aplican las garantías previstas por el RGPD (como las cláusulas contractuales tipo).'] },
    { h: '13. Cambios', p: ['Podemos actualizar esta política. Notificaremos los cambios relevantes en la plataforma.'] },
    { h: '14. Contacto', p: [`Para cualquier consulta sobre privacidad: ${CONTACT}.`] },
  ],
  en: [
    { h: '1. Data controller', p: [`Owner: ${OWNER}.`, `Email: ${CONTACT}.`, 'Country: Spain.'] },
    { h: '2. Data we collect', ul: [
      'Registration data: name, email, password (encrypted), account type and country (detected by IP at sign-up).',
      'Profile data: nickname, bio, discipline, weight class, level, gym, location, socials and content you upload (photos, videos).',
      'Training data (My Corner): sessions, weight, goals, documents and sparring videos. Private by default.',
      'Usage data: opportunities, applications, messages, events and fight cards you publish.',
      'Brand storefront telemetry: anonymous events (a view, a link click) to give brands aggregate stats. Not linked to your identity.',
      'Technical data: IP address (country), device type and browser.',
    ] },
    { h: '3. Purpose', ul: [
      'Manage your account and access.',
      'Show your profile to other users if you choose to make it public.',
      'Connect you with promoters, brands, gyms or other fighters.',
      'Let your gym follow your activity ONLY if you authorise it.',
      'Send notifications about platform activity.',
      'Provide aggregate, anonymous storefront stats to brands.',
      'Improve the operation and security of RANKD.',
    ] },
    { h: '4. Legal basis', ul: [
      'Performance of a contract: to provide the service.',
      'Consent: for optional data, communications and sharing your activity with your gym.',
      'Legitimate interest: for security and improving the platform, and for anonymous storefront metrics.',
    ] },
    { h: '5. Data by account type', ul: [
      'Fighter: your profile is visible only if you make it public. Your My Corner (training, weight, documents, videos) is private and not even the administrator reads it.',
      'Boxer in a club: being on a gym’s roster does not share your activity; only a summary is shared if you turn on consent, and you can withdraw it or leave the club anytime.',
      'Brand: receives storefront metrics in aggregate and anonymous form; it does not see who specifically viewed or clicked.',
    ] },
    { h: '6. Processors', p: ['We do not sell your data. We rely on providers that process it on our behalf:'], ul: [
      'Supabase: database and authentication (hosted in the EU).',
      'Vercel: platform hosting.',
      'Resend: transactional email delivery, when active.',
      'AI provider (Anthropic): processes the text of AI-coach queries, when that feature is active.',
      'Other users: your public profile data is visible to registered users.',
    ] },
    { h: '7. Retention', p: ['We keep your data while your account is active. If you delete it, we erase your data within 30 days at most, unless legally required to keep it longer.'] },
    { h: '8. Your rights (GDPR)', p: ['You have the right of access, rectification, erasure, portability, objection and restriction.'], ul: [
      `To exercise them, write to ${CONTACT}.`,
      'You may also complain to the Spanish Data Protection Agency: https://www.aepd.es',
    ] },
    { h: '9. Minors', p: ['RANKD is not aimed at children under 14. If you are a minor, you need your parents’ or guardians’ consent to use the platform under Spanish law.'] },
    { h: '10. Cookies and local storage', p: [
      'RANKD uses necessary technical storage (session, language preference) and browser local storage to remember settings and avoid counting the same storefront view twice. We do not use advertising or cross-site tracking cookies.',
    ] },
    { h: '11. Security', p: ['We apply technical and organisational measures: encrypted passwords, HTTPS connections and access control. No system is 100% foolproof.'] },
    { h: '12. International transfers', p: ['Some providers may process data outside the European Economic Area. In that case, the safeguards required by the GDPR apply (such as standard contractual clauses).'] },
    { h: '13. Changes', p: ['We may update this policy. We will notify relevant changes on the platform.'] },
    { h: '14. Contact', p: [`For any privacy query: ${CONTACT}.`] },
  ],
};
