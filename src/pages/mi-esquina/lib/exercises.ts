// Biblioteca de ejercicios de gimnasio, organizada por grupo muscular.
//
// Se usa en la sección de Fuerza:
//   1. El registro por sesión: el usuario elige uno o varios grupos y, dentro de
//      cada bloque, añade ejercicios de ESE grupo (o teclea uno libre).
//   2. El dictado por voz: la lista plana de nombres (idioma activo) ayuda a
//      reconocer qué ejercicio ha dicho el usuario y a colocarlo en su grupo.
//
// El campo sigue siendo LIBRE: si el ejercicio no está, el usuario teclea el
// suyo y queda disponible la próxima vez (se deriva de sus propios registros).

export type MuscleGroup =
  | 'back' | 'chest' | 'shoulders' | 'biceps' | 'triceps'
  | 'legs' | 'core' | 'power' | 'full_body';

// Orden canónico de presentación (el que pidió el usuario):
// Espalda, Pecho, Hombro, Bíceps, Tríceps, Pierna, Core, Potencia, Full Body.
export const MUSCLE_GROUPS: MuscleGroup[] = [
  'back', 'chest', 'shoulders', 'biceps', 'triceps', 'legs', 'core', 'power', 'full_body',
];

export interface LibExercise {
  es: string;
  en: string;
  group: MuscleGroup;
}

// Ficha de técnica (contenido estático, PROMPT_4·B3). Opcional: los ejercicios
// sin ficha simplemente no muestran el icono de info.
export interface ExerciseTechnique {
  /** Músculos secundarios (mostrar como chips). */
  secondary: string[];
  /** 3-4 puntos, una línea cada uno. */
  technique: string[];
  /** 2-3 errores típicos. */
  mistakes: string[];
  /** Material principal: "barra", "mancuernas", "polea", "peso corporal"... */
  equipment: string;
}

export const EXERCISE_LIBRARY: LibExercise[] = [
  // ── ESPALDA ──
  { es: 'Dominadas', en: 'Pull-ups', group: 'back' },
  { es: 'Jalón al pecho', en: 'Lat pulldown', group: 'back' },
  { es: 'Jalón agarre cerrado', en: 'Close-grip pulldown', group: 'back' },
  { es: 'Remo con barra', en: 'Barbell row', group: 'back' },
  { es: 'Remo con mancuerna', en: 'Dumbbell row', group: 'back' },
  { es: 'Remo en punta (T)', en: 'T-bar row', group: 'back' },
  { es: 'Remo en polea baja', en: 'Seated cable row', group: 'back' },
  { es: 'Remo en máquina', en: 'Machine row', group: 'back' },
  { es: 'Peso muerto', en: 'Deadlift', group: 'back' },
  { es: 'Peso muerto rumano', en: 'Romanian deadlift', group: 'back' },
  { es: 'Hiperextensiones', en: 'Back extension', group: 'back' },
  { es: 'Encogimientos', en: 'Shrugs', group: 'back' },
  { es: 'Face pull', en: 'Face pull', group: 'back' },
  { es: 'Pull-over en polea', en: 'Straight-arm pulldown', group: 'back' },

  // ── PECHO ──
  { es: 'Press banca', en: 'Bench press', group: 'chest' },
  { es: 'Press inclinado con barra', en: 'Incline barbell press', group: 'chest' },
  { es: 'Press declinado', en: 'Decline press', group: 'chest' },
  { es: 'Press banca con mancuernas', en: 'Dumbbell bench press', group: 'chest' },
  { es: 'Press inclinado con mancuernas', en: 'Incline dumbbell press', group: 'chest' },
  { es: 'Press de pecho en máquina', en: 'Machine chest press', group: 'chest' },
  { es: 'Aperturas con mancuernas', en: 'Dumbbell fly', group: 'chest' },
  { es: 'Aperturas en polea', en: 'Cable fly', group: 'chest' },
  { es: 'Contractor (peck deck)', en: 'Pec deck', group: 'chest' },
  { es: 'Fondos en paralelas', en: 'Chest dips', group: 'chest' },
  { es: 'Flexiones', en: 'Push-ups', group: 'chest' },
  { es: 'Pullover con mancuerna', en: 'Dumbbell pullover', group: 'chest' },

  // ── HOMBRO ──
  { es: 'Press militar con barra', en: 'Overhead barbell press', group: 'shoulders' },
  { es: 'Press militar con mancuernas', en: 'Dumbbell shoulder press', group: 'shoulders' },
  { es: 'Press Arnold', en: 'Arnold press', group: 'shoulders' },
  { es: 'Press de hombro en máquina', en: 'Machine shoulder press', group: 'shoulders' },
  { es: 'Elevaciones laterales', en: 'Lateral raise', group: 'shoulders' },
  { es: 'Elevaciones laterales en polea', en: 'Cable lateral raise', group: 'shoulders' },
  { es: 'Elevaciones frontales', en: 'Front raise', group: 'shoulders' },
  { es: 'Pájaros (deltoide posterior)', en: 'Rear delt fly', group: 'shoulders' },
  { es: 'Remo al mentón', en: 'Upright row', group: 'shoulders' },

  // ── BÍCEPS ──
  { es: 'Curl con barra', en: 'Barbell curl', group: 'biceps' },
  { es: 'Curl con mancuernas', en: 'Dumbbell curl', group: 'biceps' },
  { es: 'Curl martillo', en: 'Hammer curl', group: 'biceps' },
  { es: 'Curl concentrado', en: 'Concentration curl', group: 'biceps' },
  { es: 'Curl predicador', en: 'Preacher curl', group: 'biceps' },
  { es: 'Curl en polea', en: 'Cable curl', group: 'biceps' },
  { es: 'Curl inclinado', en: 'Incline dumbbell curl', group: 'biceps' },
  { es: 'Curl araña', en: 'Spider curl', group: 'biceps' },

  // ── TRÍCEPS ──
  { es: 'Extensión de tríceps en polea', en: 'Triceps pushdown', group: 'triceps' },
  { es: 'Press francés', en: 'Skull crusher', group: 'triceps' },
  { es: 'Extensión sobre la cabeza', en: 'Overhead triceps extension', group: 'triceps' },
  { es: 'Fondos en banco', en: 'Bench dips', group: 'triceps' },
  { es: 'Patada de tríceps', en: 'Triceps kickback', group: 'triceps' },
  { es: 'Press cerrado', en: 'Close-grip bench press', group: 'triceps' },
  { es: 'Extensión en polea con cuerda', en: 'Rope pushdown', group: 'triceps' },

  // ── PIERNA ──
  { es: 'Sentadilla', en: 'Squat', group: 'legs' },
  { es: 'Sentadilla frontal', en: 'Front squat', group: 'legs' },
  { es: 'Sentadilla goblet', en: 'Goblet squat', group: 'legs' },
  { es: 'Sentadilla búlgara', en: 'Bulgarian split squat', group: 'legs' },
  { es: 'Prensa de piernas', en: 'Leg press', group: 'legs' },
  { es: 'Zancadas', en: 'Lunges', group: 'legs' },
  { es: 'Hip thrust', en: 'Hip thrust', group: 'legs' },
  { es: 'Peso muerto sumo', en: 'Sumo deadlift', group: 'legs' },
  { es: 'Extensión de cuádriceps', en: 'Leg extension', group: 'legs' },
  { es: 'Curl femoral', en: 'Leg curl', group: 'legs' },
  { es: 'Gemelos de pie', en: 'Standing calf raise', group: 'legs' },
  { es: 'Gemelos sentado', en: 'Seated calf raise', group: 'legs' },
  { es: 'Abductores', en: 'Hip abduction', group: 'legs' },
  { es: 'Aductores', en: 'Hip adduction', group: 'legs' },

  // ── CORE ──
  { es: 'Plancha', en: 'Plank', group: 'core' },
  { es: 'Plancha lateral', en: 'Side plank', group: 'core' },
  { es: 'Elevación de piernas', en: 'Leg raise', group: 'core' },
  { es: 'Elevación de rodillas colgado', en: 'Hanging knee raise', group: 'core' },
  { es: 'Crunch', en: 'Crunch', group: 'core' },
  { es: 'Crunch en polea', en: 'Cable crunch', group: 'core' },
  { es: 'Rueda abdominal', en: 'Ab wheel', group: 'core' },
  { es: 'Russian twist', en: 'Russian twist', group: 'core' },
  { es: 'Mountain climbers', en: 'Mountain climbers', group: 'core' },
  { es: 'Elevación de piernas colgado', en: 'Hanging leg raise', group: 'core' },

  // ── POTENCIA ──
  { es: 'Cargada de fuerza', en: 'Power clean', group: 'power' },
  { es: 'Push press', en: 'Push press', group: 'power' },
  { es: 'Tirón de cargada', en: 'Clean pull', group: 'power' },
  { es: 'Balanceo con kettlebell', en: 'Kettlebell swing', group: 'power' },
  { es: 'Salto al cajón', en: 'Box jump', group: 'power' },
  { es: 'Sentadilla con salto', en: 'Jump squat', group: 'power' },
  { es: 'Zancada con salto', en: 'Jumping lunge', group: 'power' },
  { es: 'Golpe de balón medicinal', en: 'Medicine ball slam', group: 'power' },
  { es: 'Lanzamiento de balón medicinal', en: 'Medicine ball throw', group: 'power' },
  { es: 'Salto horizontal', en: 'Broad jump', group: 'power' },

  // ── FULL BODY ──
  { es: 'Thruster', en: 'Thruster', group: 'full_body' },
  { es: 'Burpee', en: 'Burpee', group: 'full_body' },
  { es: 'Cargada y press', en: 'Clean and press', group: 'full_body' },
  { es: 'Arrancada', en: 'Snatch', group: 'full_body' },
  { es: 'Man maker', en: 'Man maker', group: 'full_body' },
  { es: 'Wall ball', en: 'Wall ball', group: 'full_body' },
  { es: 'Levantada turca', en: 'Turkish get-up', group: 'full_body' },
  { es: 'Devil press', en: 'Devil press', group: 'full_body' },
  { es: 'Peso muerto con remo', en: 'Renegade row', group: 'full_body' },
];

type Lang = 'es' | 'en';

/** Etiqueta del ejercicio en el idioma activo. */
export function exLabel(e: LibExercise, lang: Lang): string {
  return lang === 'en' ? e.en : e.es;
}

/** Lista plana de nombres (idioma activo) para el dictado por voz. */
export function libraryLabels(lang: Lang): string[] {
  return EXERCISE_LIBRARY.map((e) => exLabel(e, lang));
}

/** Ejercicios de un grupo, ya como etiquetas del idioma activo. */
export function exercisesByGroup(group: MuscleGroup, lang: Lang): string[] {
  return EXERCISE_LIBRARY.filter((e) => e.group === group).map((e) => exLabel(e, lang));
}

// Normaliza sin acentos para casar nombres escritos con o sin tilde
// ("Jalón" ↔ "jalon") con la biblioteca, en cualquiera de los dos idiomas.
const normNoAccent = (s: string) =>
  s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

const GROUP_BY_NAME: Map<string, MuscleGroup> = (() => {
  const m = new Map<string, MuscleGroup>();
  EXERCISE_LIBRARY.forEach((e) => { m.set(normNoAccent(e.es), e.group); m.set(normNoAccent(e.en), e.group); });
  return m;
})();

/**
 * Grupo muscular de un ejercicio a partir de su nombre (etiqueta o clave).
 * Devuelve null si el ejercicio es libre y no está en la biblioteca.
 */
export function muscleGroupOf(nameOrKey: string): MuscleGroup | null {
  return GROUP_BY_NAME.get(normNoAccent(nameOrKey)) ?? null;
}
