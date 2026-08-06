// Biblioteca de ejercicios de gimnasio, organizada por grupo muscular.
//
// Se usa en dos sitios de la sección de Fuerza:
//   1. El buscador del formulario: primero se filtra por grupo (pecho, espalda,
//      hombro, brazo, pierna, core) y luego se elige el ejercicio concreto, para
//      que no sea una lista larga e inmanejable.
//   2. El dictado por voz: la lista plana de nombres (en el idioma activo) ayuda
//      a reconocer qué ejercicio ha dicho el usuario.
//
// El campo sigue siendo LIBRE: si el ejercicio no está, el usuario teclea el suyo
// y queda disponible la próxima vez (se deriva de sus propios registros).

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core';

export const MUSCLE_GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];

export interface LibExercise {
  es: string;
  en: string;
  group: MuscleGroup;
}

// Lista amplia de ejercicios habituales, con variantes reales por grupo.
export const EXERCISE_LIBRARY: LibExercise[] = [
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

  // ── BRAZO (bíceps y tríceps) ──
  { es: 'Curl con barra', en: 'Barbell curl', group: 'arms' },
  { es: 'Curl con mancuernas', en: 'Dumbbell curl', group: 'arms' },
  { es: 'Curl martillo', en: 'Hammer curl', group: 'arms' },
  { es: 'Curl concentrado', en: 'Concentration curl', group: 'arms' },
  { es: 'Curl predicador', en: 'Preacher curl', group: 'arms' },
  { es: 'Curl en polea', en: 'Cable curl', group: 'arms' },
  { es: 'Curl inclinado', en: 'Incline dumbbell curl', group: 'arms' },
  { es: 'Extensión de tríceps en polea', en: 'Triceps pushdown', group: 'arms' },
  { es: 'Press francés', en: 'Skull crusher', group: 'arms' },
  { es: 'Extensión sobre la cabeza', en: 'Overhead triceps extension', group: 'arms' },
  { es: 'Fondos en banco', en: 'Bench dips', group: 'arms' },
  { es: 'Patada de tríceps', en: 'Triceps kickback', group: 'arms' },
  { es: 'Press cerrado', en: 'Close-grip bench press', group: 'arms' },

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
