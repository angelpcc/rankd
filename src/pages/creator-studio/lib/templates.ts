// Plantillas que prellenan el formulario de cada generador (click → rellena
// el prompt). Estáticas por ahora; content_templates (BD) queda preparada
// para plantillas guardadas por el propio Ángel más adelante.

export interface PromptTemplate { id: string; name: string; prompt: string }

export const VIDEO_TEMPLATES: PromptTemplate[] = [
  { id: 'mi-esquina', name: 'Promocionar Mi Esquina', prompt: 'Un vídeo corto mostrando cómo Mi Esquina funciona como entrenador personal 24/7: registrar un entreno, ver el progreso de peso y fuerza, y hablar con el Coach IA.' },
  { id: 'oportunidad', name: 'Destacar oportunidad', prompt: 'Un vídeo anunciando que hay nuevas oportunidades de combate y colaboración publicadas por promotoras y marcas, con llamada a explorar el directorio.' },
  { id: 'transformacion', name: 'Transformación', prompt: 'Un vídeo mostrando la evolución de un peleador en RANKD: de sus primeros registros de peso y fuerza hasta su progreso actual.' },
  { id: 'dia-gym', name: 'Día en el gym', prompt: 'Un vídeo estilo "día en el gimnasio" mostrando cómo un peleador usa RANKD durante su sesión: temporizador, combos y registro de entreno.' },
  { id: 'feature-usuario', name: 'Feature de usuario', prompt: 'Un vídeo destacando el perfil verificado de un peleador y cómo lo encuentran promotoras y marcas en el directorio.' },
];

export const PUBLICATION_TEMPLATES: PromptTemplate[] = [
  { id: 'esquina-showcase', name: 'Mi Esquina Showcase', prompt: 'Una publicación mostrando todo lo que ofrece Mi Esquina: diario de entrenos, peso, fuerza, nutrición y Coach IA en un solo sitio.' },
  { id: 'oportunidades-alert', name: 'Oportunidades Alert', prompt: 'Una publicación anunciando que hay nuevas oportunidades activas: combates, castings y colaboraciones con fecha límite.' },
  { id: 'fighter-feature', name: 'Fighter Feature', prompt: 'Una publicación destacando a un peleador de la plataforma: su disciplina, categoría y récord.' },
  { id: 'motivational', name: 'Motivacional', prompt: 'Una publicación motivadora sobre disciplina y constancia en el entrenamiento, con la voz de RANKD.' },
  { id: 'gym-highlight', name: 'Gym Highlight', prompt: 'Una publicación destacando un gimnasio afiliado y cómo sigue el progreso de sus alumnos desde RANKD.' },
  { id: 'community-update', name: 'Community Update', prompt: 'Una publicación de actualización de comunidad: novedades y mejoras recientes de la plataforma.' },
];

export const MESSAGE_TEMPLATES: { id: string; name: string; recipientType: string; goal: string }[] = [
  { id: 'brand-sponsorship', name: 'Marca: Sponsorship', recipientType: 'brand', goal: 'Proponer una colaboración de patrocinio a una marca de equipamiento de deportes de combate.' },
  { id: 'brand-collab', name: 'Marca: Colaboración', recipientType: 'brand', goal: 'Proponer una colaboración de contenido o visibilidad a una marca.' },
  { id: 'brand-followup', name: 'Marca: Follow-up', recipientType: 'brand', goal: 'Hacer seguimiento de una propuesta enviada anteriormente a una marca.' },
  { id: 'org-combate', name: 'Promotora: Combate', recipientType: 'organization', goal: 'Contactar a una promotora para proponer un combate o participación en su cartelera.' },
  { id: 'org-evento', name: 'Promotora: Evento', recipientType: 'organization', goal: 'Proponer colaboración con RANKD para la difusión de un evento.' },
  { id: 'fighter-entrenar', name: 'Fighter: Entrenar', recipientType: 'fighter', goal: 'Invitar a un peleador a entrenar juntos o compartir sesión.' },
  { id: 'fighter-sparring', name: 'Fighter: Sparring', recipientType: 'fighter', goal: 'Proponer una sesión de sparring a otro peleador.' },
  { id: 'gym-membresia', name: 'Gym: Membresía', recipientType: 'gym', goal: 'Contactar a un gimnasio sobre su membresía o vinculación con RANKD.' },
  { id: 'gym-horarios', name: 'Gym: Horarios', recipientType: 'gym', goal: 'Preguntar por horarios de clases o entrenamientos a un gimnasio.' },
  { id: 'coach-entrenamiento', name: 'Entrenador: Entrenamiento', recipientType: 'coach', goal: 'Contactar a un entrenador para coordinar un plan de entrenamiento.' },
  { id: 'coach-consulta', name: 'Entrenador: Consulta técnica', recipientType: 'coach', goal: 'Hacer una consulta técnica a un entrenador.' },
];
