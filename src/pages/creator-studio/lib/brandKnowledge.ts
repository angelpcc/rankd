// Brand Knowledge Base de RANKD: lo que la IA necesita saber SIEMPRE para
// generar contenido que suene a RANKD y no a una IA genérica. Se inyecta en
// el system prompt de cada generación (vídeo, publicación o mensaje) — ver
// buildBrandContext() más abajo y su uso en api/coach.js (modo creatorStudio).
//
// Escalable a propósito: para añadir un tipo de usuario o una sección nueva,
// solo hace falta añadir una entrada aquí; todos los generadores lo heredan
// automáticamente porque siempre construyen el prompt a partir de esta misma
// fuente.

export interface AudienceProfile {
  key: string;
  label: string;
  tone: string;
}

export interface ProductSection {
  key: string;
  label: string;
  value: string;
}

export const BRAND = {
  name: 'RANKD',
  tagline: 'La plataforma de peleadores, promotoras y marcas de deportes de combate',
  mission: 'Dar a cada peleador (amateur o profesional) las mismas herramientas que un gimnasio grande: entrenamiento, nutrición, seguimiento y visibilidad ante promotoras y marcas.',
  region: 'España y Latinoamérica',
  disciplines: ['Boxeo', 'MMA', 'Kickboxing', 'Muay Thai'],
};

export const VISUAL_IDENTITY = {
  colors: { black: '#030303', blackAlt: '#0B0B0B', red: '#E10600', gold: '#C9A84C' },
  headingFont: "'Bebas Neue', sans-serif",
  bodyFont: "'Barlow Condensed', sans-serif",
  logoWordmark: 'RANKD',
};

// Público objetivo por tipo de cuenta: cada uno necesita un tono distinto
// porque le habla RANKD a un peleador buscando visibilidad, a una organización
// buscando talento, o a una marca buscando encaje.
export const AUDIENCES: AudienceProfile[] = [
  { key: 'fighter', label: 'Peleador', tone: 'Directo, motivador, de tú a tú. Habla de progreso, disciplina y oportunidades reales.' },
  { key: 'organization', label: 'Organización / Promotora', tone: 'Profesional y eficiente. Habla de talento verificado, gestión y ahorro de tiempo.' },
  { key: 'brand', label: 'Marca', tone: 'Orientado a resultados y alcance. Habla de audiencia nicho, autenticidad y visibilidad de marca.' },
  { key: 'gym', label: 'Gimnasio', tone: 'Cercano y práctico. Habla de gestión de alumnos y visibilidad del gimnasio.' },
  { key: 'coach', label: 'Entrenador', tone: 'Técnico pero accesible. Habla de seguimiento de sus peleadores y herramientas de trabajo.' },
];

// Secciones principales del producto, con el valor que ofrece cada una —
// esto es lo que un vídeo/post/mensaje promocional debería transmitir.
export const SECTIONS: ProductSection[] = [
  { key: 'mi-esquina', label: 'Mi Esquina', value: 'El entrenador personal 24/7: diario de entrenos, peso, fuerza, nutrición y Coach IA en un solo sitio.' },
  { key: 'opportunities', label: 'Oportunidades', value: 'Combates, castings y colaboraciones publicados por organizaciones y marcas, filtrables por disciplina y categoría.' },
  { key: 'fighters', label: 'Directorio de peleadores', value: 'Perfiles verificados y con récord real, buscables por disciplina, categoría de peso y nivel.' },
  { key: 'timer', label: 'Temporizador de asaltos', value: 'Cronómetro de boxeo con combos sugeridos por IA y sonido de esquina real.' },
  { key: 'club', label: 'Club / Gimnasios', value: 'Vincula un gimnasio con sus alumnos para seguir su progreso desde un mismo panel.' },
];

export const COMMUNICATION_TONE = 'Español de España por defecto (salvo que se indique otro idioma). Directo, sin relleno corporativo, cercano al mundo de los deportes de combate. Nunca cursi ni "hype" vacío: las afirmaciones se respaldan con lo que la plataforma realmente hace.';

/** Texto que se antepone a CUALQUIER prompt de generación de contenido. */
export function buildBrandContext(): string {
  const sectionLines = SECTIONS.map((s) => `- ${s.label}: ${s.value}`).join('\n');
  const audienceLines = AUDIENCES.map((a) => `- ${a.label}: ${a.tone}`).join('\n');
  return `Eres el redactor de contenido de marca de ${BRAND.name}: ${BRAND.tagline}, para ${BRAND.region}.
Misión de la plataforma: ${BRAND.mission}
Disciplinas: ${BRAND.disciplines.join(', ')}.

Identidad visual (referencia, no la describas salvo que se pida): negro (${VISUAL_IDENTITY.colors.black}), rojo (${VISUAL_IDENTITY.colors.red}), oro (${VISUAL_IDENTITY.colors.gold}); tipografía de titulares Bebas Neue, de cuerpo Barlow Condensed.

Secciones del producto y su valor:
${sectionLines}

Tono según a quién se dirige el contenido:
${audienceLines}

Tono general de comunicación: ${COMMUNICATION_TONE}`;
}
