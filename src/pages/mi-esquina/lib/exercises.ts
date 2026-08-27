// Biblioteca de ejercicios de gimnasio, organizada por grupo muscular.
//
// Se usa en la sección de Fuerza:
//   1. El registro por sesión: el usuario elige uno o varios grupos y, dentro de
//      cada bloque, añade ejercicios de ESE grupo (o teclea uno libre).
//   2. La planificación de fuerza en detalle (StrengthPlanBuilder).
//   3. El dictado por voz: la lista plana de nombres (idioma activo) ayuda a
//      reconocer qué ejercicio ha dicho el usuario y a colocarlo en su grupo.
//
// El campo sigue siendo LIBRE: si el ejercicio no está, el usuario teclea el
// suyo y queda disponible la próxima vez (se deriva de sus propios registros).
// Un ejercicio libre usa los valores por defecto: weight_mode 'total',
// tracking_mode 'reps', sin barra.

export type MuscleGroup =
  | 'back' | 'chest' | 'shoulders' | 'biceps' | 'triceps'
  | 'legs' | 'core' | 'power' | 'full_body';

// Cómo se interpreta el número de peso que teclea el usuario:
//   total        → el total levantado (barra, máquina, polea)
//   per_side     → por lado (mancuernas a dos manos, sentadilla búlgara…)
//   per_dumbbell → por mancuerna (mismo cálculo que per_side, distinto label)
//   bodyweight   → sin peso; el campo pasa a "lastre (opcional)"
export type WeightMode = 'total' | 'per_side' | 'per_dumbbell' | 'bodyweight';

// Cómo se mide la serie:
//   reps     → repeticiones (+ peso según weight_mode). Por defecto.
//   time     → segundos (plancha, isometrías). Peso opcional.
//   distance → metros (paseo del granjero, zancada caminando). Peso opcional.
export type TrackingMode = 'reps' | 'time' | 'distance';

// Orden canónico de presentación (el que pidió el usuario):
// Espalda, Pecho, Hombro, Bíceps, Tríceps, Pierna, Core, Potencia, Full Body.
export const MUSCLE_GROUPS: MuscleGroup[] = [
  'back', 'chest', 'shoulders', 'biceps', 'triceps', 'legs', 'core', 'power', 'full_body',
];

export interface LibExercise {
  es: string;
  en: string;
  group: MuscleGroup;
  /** Cómo interpretar el peso. Ausente = 'total'. */
  weightMode?: WeightMode;
  /** Cómo medir la serie. Ausente = 'reps'. */
  trackingMode?: TrackingMode;
  /** Usa barra olímpica → se ofrece la calculadora de discos (solo con weightMode total). */
  bar?: boolean;
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
  { es: 'Dominadas', en: 'Pull-ups', group: 'back', weightMode: 'bodyweight' },
  { es: 'Jalón al pecho', en: 'Lat pulldown', group: 'back' },
  { es: 'Jalón agarre cerrado', en: 'Close-grip pulldown', group: 'back' },
  { es: 'Remo con barra', en: 'Barbell row', group: 'back', bar: true },
  { es: 'Remo con mancuerna', en: 'Dumbbell row', group: 'back', weightMode: 'per_side' },
  { es: 'Remo en punta (T)', en: 'T-bar row', group: 'back', bar: true },
  { es: 'Remo en polea baja', en: 'Seated cable row', group: 'back' },
  { es: 'Remo en máquina', en: 'Machine row', group: 'back' },
  { es: 'Peso muerto', en: 'Deadlift', group: 'back', bar: true },
  { es: 'Peso muerto rumano', en: 'Romanian deadlift', group: 'back', bar: true },
  { es: 'Hiperextensiones', en: 'Back extension', group: 'back', weightMode: 'bodyweight' },
  { es: 'Encogimientos', en: 'Shrugs', group: 'back', bar: true },
  { es: 'Face pull', en: 'Face pull', group: 'back' },
  { es: 'Pull-over en polea', en: 'Straight-arm pulldown', group: 'back' },

  // ── PECHO ──
  { es: 'Press banca', en: 'Bench press', group: 'chest', bar: true },
  { es: 'Press inclinado con barra', en: 'Incline barbell press', group: 'chest', bar: true },
  { es: 'Press declinado', en: 'Decline press', group: 'chest', bar: true },
  { es: 'Press banca con mancuernas', en: 'Dumbbell bench press', group: 'chest', weightMode: 'per_side' },
  { es: 'Press inclinado con mancuernas', en: 'Incline dumbbell press', group: 'chest', weightMode: 'per_side' },
  { es: 'Press de pecho en máquina', en: 'Machine chest press', group: 'chest' },
  { es: 'Aperturas con mancuernas', en: 'Dumbbell fly', group: 'chest', weightMode: 'per_side' },
  { es: 'Aperturas en polea', en: 'Cable fly', group: 'chest' },
  { es: 'Contractor (peck deck)', en: 'Pec deck', group: 'chest' },
  { es: 'Fondos en paralelas', en: 'Chest dips', group: 'chest', weightMode: 'bodyweight' },
  { es: 'Flexiones', en: 'Push-ups', group: 'chest', weightMode: 'bodyweight' },
  { es: 'Pullover con mancuerna', en: 'Dumbbell pullover', group: 'chest', weightMode: 'per_side' },

  // ── HOMBRO ──
  { es: 'Press militar con barra', en: 'Overhead barbell press', group: 'shoulders', bar: true },
  { es: 'Press militar con mancuernas', en: 'Dumbbell shoulder press', group: 'shoulders', weightMode: 'per_side' },
  { es: 'Press Arnold', en: 'Arnold press', group: 'shoulders', weightMode: 'per_dumbbell' },
  { es: 'Press de hombro en máquina', en: 'Machine shoulder press', group: 'shoulders' },
  { es: 'Elevaciones laterales', en: 'Lateral raise', group: 'shoulders', weightMode: 'per_dumbbell' },
  { es: 'Elevaciones laterales en polea', en: 'Cable lateral raise', group: 'shoulders' },
  { es: 'Elevaciones frontales', en: 'Front raise', group: 'shoulders', weightMode: 'per_dumbbell' },
  { es: 'Pájaros (deltoide posterior)', en: 'Rear delt fly', group: 'shoulders', weightMode: 'per_dumbbell' },
  { es: 'Remo al mentón', en: 'Upright row', group: 'shoulders', bar: true },

  // ── BÍCEPS ──
  { es: 'Curl con barra', en: 'Barbell curl', group: 'biceps', bar: true },
  { es: 'Curl con mancuernas', en: 'Dumbbell curl', group: 'biceps', weightMode: 'per_dumbbell' },
  { es: 'Curl martillo', en: 'Hammer curl', group: 'biceps', weightMode: 'per_dumbbell' },
  { es: 'Curl concentrado', en: 'Concentration curl', group: 'biceps', weightMode: 'per_side' },
  { es: 'Curl predicador', en: 'Preacher curl', group: 'biceps' },
  { es: 'Curl en polea', en: 'Cable curl', group: 'biceps' },
  { es: 'Curl inclinado', en: 'Incline dumbbell curl', group: 'biceps', weightMode: 'per_side' },
  { es: 'Curl araña', en: 'Spider curl', group: 'biceps', weightMode: 'per_dumbbell' },

  // ── TRÍCEPS ──
  { es: 'Extensión de tríceps en polea', en: 'Triceps pushdown', group: 'triceps' },
  { es: 'Press francés', en: 'Skull crusher', group: 'triceps', bar: true },
  { es: 'Extensión sobre la cabeza', en: 'Overhead triceps extension', group: 'triceps' },
  { es: 'Fondos en banco', en: 'Bench dips', group: 'triceps', weightMode: 'bodyweight' },
  { es: 'Patada de tríceps', en: 'Triceps kickback', group: 'triceps', weightMode: 'per_dumbbell' },
  { es: 'Press cerrado', en: 'Close-grip bench press', group: 'triceps', bar: true },
  { es: 'Extensión en polea con cuerda', en: 'Rope pushdown', group: 'triceps' },

  // ── PIERNA ──
  { es: 'Sentadilla', en: 'Squat', group: 'legs', bar: true },
  { es: 'Sentadilla frontal', en: 'Front squat', group: 'legs', bar: true },
  { es: 'Sentadilla goblet', en: 'Goblet squat', group: 'legs', weightMode: 'per_side' },
  { es: 'Sentadilla búlgara', en: 'Bulgarian split squat', group: 'legs', weightMode: 'per_side' },
  { es: 'Prensa de piernas', en: 'Leg press', group: 'legs' },
  { es: 'Zancadas', en: 'Lunges', group: 'legs', weightMode: 'per_side' },
  { es: 'Zancada caminando con peso', en: 'Walking lunge (loaded)', group: 'legs', weightMode: 'per_side', trackingMode: 'distance' },
  { es: 'Hip thrust', en: 'Hip thrust', group: 'legs', bar: true },
  { es: 'Peso muerto sumo', en: 'Sumo deadlift', group: 'legs', bar: true },
  { es: 'Extensión de cuádriceps', en: 'Leg extension', group: 'legs' },
  { es: 'Curl femoral', en: 'Leg curl', group: 'legs' },
  { es: 'Gemelos de pie', en: 'Standing calf raise', group: 'legs' },
  { es: 'Gemelos sentado', en: 'Seated calf raise', group: 'legs' },
  { es: 'Abductores', en: 'Hip abduction', group: 'legs' },
  { es: 'Aductores', en: 'Hip adduction', group: 'legs' },
  { es: 'Paseo del granjero', en: "Farmer's walk", group: 'legs', weightMode: 'per_dumbbell', trackingMode: 'distance' },

  // ── CORE ──
  { es: 'Plancha', en: 'Plank', group: 'core', weightMode: 'bodyweight', trackingMode: 'time' },
  { es: 'Plancha lateral', en: 'Side plank', group: 'core', weightMode: 'bodyweight', trackingMode: 'time' },
  { es: 'Hollow hold', en: 'Hollow hold', group: 'core', weightMode: 'bodyweight', trackingMode: 'time' },
  { es: 'Elevación de piernas', en: 'Leg raise', group: 'core', weightMode: 'bodyweight' },
  { es: 'Elevación de rodillas colgado', en: 'Hanging knee raise', group: 'core', weightMode: 'bodyweight' },
  { es: 'Crunch', en: 'Crunch', group: 'core', weightMode: 'bodyweight' },
  { es: 'Crunch en polea', en: 'Cable crunch', group: 'core' },
  { es: 'Rueda abdominal', en: 'Ab wheel', group: 'core', weightMode: 'bodyweight' },
  { es: 'Russian twist', en: 'Russian twist', group: 'core', weightMode: 'bodyweight' },
  { es: 'Mountain climbers', en: 'Mountain climbers', group: 'core', weightMode: 'bodyweight' },
  { es: 'Elevación de piernas colgado', en: 'Hanging leg raise', group: 'core', weightMode: 'bodyweight' },

  // ── POTENCIA ──
  { es: 'Cargada de fuerza', en: 'Power clean', group: 'power', bar: true },
  { es: 'Push press', en: 'Push press', group: 'power', bar: true },
  { es: 'Tirón de cargada', en: 'Clean pull', group: 'power', bar: true },
  { es: 'Balanceo con kettlebell', en: 'Kettlebell swing', group: 'power', weightMode: 'per_dumbbell' },
  { es: 'Salto al cajón', en: 'Box jump', group: 'power', weightMode: 'bodyweight' },
  { es: 'Sentadilla con salto', en: 'Jump squat', group: 'power', weightMode: 'bodyweight' },
  { es: 'Zancada con salto', en: 'Jumping lunge', group: 'power', weightMode: 'bodyweight' },
  { es: 'Golpe de balón medicinal', en: 'Medicine ball slam', group: 'power', weightMode: 'bodyweight' },
  { es: 'Lanzamiento de balón medicinal', en: 'Medicine ball throw', group: 'power', weightMode: 'bodyweight' },
  { es: 'Salto horizontal', en: 'Broad jump', group: 'power', weightMode: 'bodyweight' },

  // ── FULL BODY ──
  { es: 'Thruster', en: 'Thruster', group: 'full_body', bar: true },
  { es: 'Burpee', en: 'Burpee', group: 'full_body', weightMode: 'bodyweight' },
  { es: 'Cargada y press', en: 'Clean and press', group: 'full_body', bar: true },
  { es: 'Arrancada', en: 'Snatch', group: 'full_body', bar: true },
  { es: 'Man maker', en: 'Man maker', group: 'full_body', weightMode: 'per_side' },
  { es: 'Wall ball', en: 'Wall ball', group: 'full_body', weightMode: 'total' },
  { es: 'Levantada turca', en: 'Turkish get-up', group: 'full_body', weightMode: 'per_side' },
  { es: 'Devil press', en: 'Devil press', group: 'full_body', weightMode: 'per_side' },
  { es: 'Peso muerto con remo', en: 'Renegade row', group: 'full_body', weightMode: 'per_side' },
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

const BY_NAME: Map<string, LibExercise> = (() => {
  const m = new Map<string, LibExercise>();
  EXERCISE_LIBRARY.forEach((e) => { m.set(normNoAccent(e.es), e); m.set(normNoAccent(e.en), e); });
  return m;
})();

/** Ficha de la biblioteca por nombre (etiqueta o clave). null si es libre. */
export function libExerciseOf(nameOrKey: string): LibExercise | null {
  return BY_NAME.get(normNoAccent(nameOrKey)) ?? null;
}

/**
 * Grupo muscular de un ejercicio a partir de su nombre (etiqueta o clave).
 * Devuelve null si el ejercicio es libre y no está en la biblioteca.
 */
export function muscleGroupOf(nameOrKey: string): MuscleGroup | null {
  return libExerciseOf(nameOrKey)?.group ?? null;
}

/** Modo de peso del ejercicio; 'total' si es libre o no lo define. */
export function weightModeOf(nameOrKey: string): WeightMode {
  return libExerciseOf(nameOrKey)?.weightMode ?? 'total';
}

/** Modo de medición del ejercicio; 'reps' si es libre o no lo define. */
export function trackingModeOf(nameOrKey: string): TrackingMode {
  return libExerciseOf(nameOrKey)?.trackingMode ?? 'reps';
}

/** true si el ejercicio usa barra olímpica (para ofrecer la calculadora de discos). */
export function usesBar(nameOrKey: string): boolean {
  return libExerciseOf(nameOrKey)?.bar === true;
}
