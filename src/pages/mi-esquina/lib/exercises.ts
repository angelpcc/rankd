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

// ── Metadatos (añadidos 2026-09-07) ──
// Todos OPCIONALES: un ejercicio libre o una entrada antigua sin anotar sigue
// funcionando igual. Se usan para filtrar la biblioteca, no para prescribir.
//
// Nota deliberada: NO hay campo "objetivo" (fuerza/hipertrofia/…). Clasificar
// cada ejercicio por objetivo es una decisión editorial discutible y no está
// conectada a ningún dato real de la app; el patrón de movimiento cubre el eje
// funcional sin inventarse nada.

/** Patrón de movimiento. `isolation` = trabajo analítico de un músculo. */
export type MovementPattern =
  | 'push' | 'pull' | 'squat' | 'hinge' | 'lunge'
  | 'carry' | 'rotation' | 'antirotation' | 'jump' | 'isolation';

/** Material necesario. */
export type Equipment =
  | 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight'
  | 'kettlebell' | 'band' | 'ball' | 'sled';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export const MOVEMENT_PATTERNS: MovementPattern[] = [
  'push', 'pull', 'squat', 'hinge', 'lunge', 'carry', 'rotation', 'antirotation', 'jump', 'isolation',
];
export const EQUIPMENT_TYPES: Equipment[] = [
  'barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band', 'ball', 'sled',
];

export interface LibExercise {
  es: string;
  en: string;
  /** Músculo principal. */
  group: MuscleGroup;
  /** Cómo interpretar el peso. Ausente = 'total'. */
  weightMode?: WeightMode;
  /** Cómo medir la serie. Ausente = 'reps'. */
  trackingMode?: TrackingMode;
  /** Usa barra olímpica → se ofrece la calculadora de discos (solo con weightMode total). */
  bar?: boolean;
  /** Patrón de movimiento. */
  pattern?: MovementPattern;
  /** Material principal. */
  equipment?: Equipment;
  /** true = se trabaja un lado cada vez. */
  unilateral?: boolean;
  difficulty?: Difficulty;
  /** Músculos que acompañan al principal. */
  secondary?: MuscleGroup[];
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
  { es: 'Dominadas', en: 'Pull-ups', group: 'back', weightMode: 'bodyweight', pattern: 'pull', equipment: 'bodyweight', difficulty: 'intermediate', secondary: ['biceps', 'core'] },
  { es: 'Jalón al pecho', en: 'Lat pulldown', group: 'back', pattern: 'pull', equipment: 'cable', difficulty: 'beginner', secondary: ['biceps'] },
  { es: 'Jalón agarre cerrado', en: 'Close-grip pulldown', group: 'back', pattern: 'pull', equipment: 'cable', difficulty: 'beginner', secondary: ['biceps'] },
  { es: 'Remo con barra', en: 'Barbell row', group: 'back', bar: true, pattern: 'pull', equipment: 'barbell', difficulty: 'intermediate', secondary: ['biceps', 'core'] },
  { es: 'Remo con mancuerna', en: 'Dumbbell row', group: 'back', weightMode: 'per_side', pattern: 'pull', equipment: 'dumbbell', unilateral: true, difficulty: 'beginner', secondary: ['biceps'] },
  { es: 'Remo en punta (T)', en: 'T-bar row', group: 'back', bar: true, pattern: 'pull', equipment: 'barbell', difficulty: 'intermediate', secondary: ['biceps'] },
  { es: 'Remo en polea baja', en: 'Seated cable row', group: 'back', pattern: 'pull', equipment: 'cable', difficulty: 'beginner', secondary: ['biceps'] },
  { es: 'Remo en máquina', en: 'Machine row', group: 'back', pattern: 'pull', equipment: 'machine', difficulty: 'beginner', secondary: ['biceps'] },
  { es: 'Remo pecho apoyado', en: 'Chest-supported row', group: 'back', pattern: 'pull', equipment: 'machine', difficulty: 'beginner', secondary: ['biceps'] },
  { es: 'Remo unilateral en polea', en: 'Single-arm cable row', group: 'back', pattern: 'pull', equipment: 'cable', unilateral: true, difficulty: 'beginner', secondary: ['biceps', 'core'] },
  { es: 'Peso muerto', en: 'Deadlift', group: 'back', bar: true, pattern: 'hinge', equipment: 'barbell', difficulty: 'advanced', secondary: ['legs', 'core'] },
  { es: 'Peso muerto rumano', en: 'Romanian deadlift', group: 'back', bar: true, pattern: 'hinge', equipment: 'barbell', difficulty: 'intermediate', secondary: ['legs'] },
  { es: 'Hiperextensiones', en: 'Back extension', group: 'back', weightMode: 'bodyweight', pattern: 'hinge', equipment: 'bodyweight', difficulty: 'beginner', secondary: ['legs', 'core'] },
  { es: 'Encogimientos', en: 'Shrugs', group: 'back', bar: true, pattern: 'isolation', equipment: 'barbell', difficulty: 'beginner', secondary: ['shoulders'] },
  { es: 'Face pull', en: 'Face pull', group: 'back', pattern: 'pull', equipment: 'cable', difficulty: 'beginner', secondary: ['shoulders'] },
  { es: 'Pull-over en polea', en: 'Straight-arm pulldown', group: 'back', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner', secondary: ['chest'] },
  { es: 'Pullover en máquina', en: 'Machine pullover', group: 'back', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner', secondary: ['chest'] },

  // ── PECHO ──
  { es: 'Press banca', en: 'Bench press', group: 'chest', bar: true, pattern: 'push', equipment: 'barbell', difficulty: 'intermediate', secondary: ['triceps', 'shoulders'] },
  { es: 'Press inclinado con barra', en: 'Incline barbell press', group: 'chest', bar: true, pattern: 'push', equipment: 'barbell', difficulty: 'intermediate', secondary: ['shoulders', 'triceps'] },
  { es: 'Press declinado', en: 'Decline press', group: 'chest', bar: true, pattern: 'push', equipment: 'barbell', difficulty: 'intermediate', secondary: ['triceps'] },
  { es: 'Press banca con mancuernas', en: 'Dumbbell bench press', group: 'chest', weightMode: 'per_side', pattern: 'push', equipment: 'dumbbell', difficulty: 'beginner', secondary: ['triceps', 'shoulders'] },
  { es: 'Press inclinado con mancuernas', en: 'Incline dumbbell press', group: 'chest', weightMode: 'per_side', pattern: 'push', equipment: 'dumbbell', difficulty: 'beginner', secondary: ['shoulders', 'triceps'] },
  { es: 'Press de pecho en máquina', en: 'Machine chest press', group: 'chest', pattern: 'push', equipment: 'machine', difficulty: 'beginner', secondary: ['triceps'] },
  { es: 'Press unilateral en polea', en: 'Single-arm cable press', group: 'chest', pattern: 'push', equipment: 'cable', unilateral: true, difficulty: 'intermediate', secondary: ['triceps', 'core'] },
  { es: 'Aperturas con mancuernas', en: 'Dumbbell fly', group: 'chest', weightMode: 'per_side', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner', secondary: ['shoulders'] },
  { es: 'Aperturas en polea', en: 'Cable fly', group: 'chest', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner', secondary: ['shoulders'] },
  { es: 'Cruce de poleas alto-bajo', en: 'High-to-low cable crossover', group: 'chest', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner', secondary: ['shoulders'] },
  { es: 'Cruce de poleas bajo-alto', en: 'Low-to-high cable crossover', group: 'chest', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner', secondary: ['shoulders'] },
  { es: 'Contractor (peck deck)', en: 'Pec deck', group: 'chest', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner', secondary: ['shoulders'] },
  { es: 'Fondos en paralelas', en: 'Chest dips', group: 'chest', weightMode: 'bodyweight', pattern: 'push', equipment: 'bodyweight', difficulty: 'intermediate', secondary: ['triceps', 'shoulders'] },
  { es: 'Flexiones', en: 'Push-ups', group: 'chest', weightMode: 'bodyweight', pattern: 'push', equipment: 'bodyweight', difficulty: 'beginner', secondary: ['triceps', 'core'] },
  { es: 'Pullover con mancuerna', en: 'Dumbbell pullover', group: 'chest', weightMode: 'per_side', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner', secondary: ['back'] },

  // ── HOMBRO ──
  { es: 'Press militar con barra', en: 'Overhead barbell press', group: 'shoulders', bar: true, pattern: 'push', equipment: 'barbell', difficulty: 'intermediate', secondary: ['triceps', 'core'] },
  { es: 'Press militar con mancuernas', en: 'Dumbbell shoulder press', group: 'shoulders', weightMode: 'per_side', pattern: 'push', equipment: 'dumbbell', difficulty: 'beginner', secondary: ['triceps'] },
  { es: 'Press Arnold', en: 'Arnold press', group: 'shoulders', weightMode: 'per_dumbbell', pattern: 'push', equipment: 'dumbbell', difficulty: 'intermediate', secondary: ['triceps'] },
  { es: 'Press de hombro en máquina', en: 'Machine shoulder press', group: 'shoulders', pattern: 'push', equipment: 'machine', difficulty: 'beginner', secondary: ['triceps'] },
  // Sin `bar`: en landmine se carga un solo extremo, así que la calculadora de
  // discos (que asume barra simétrica) daría un total equivocado.
  { es: 'Press landmine', en: 'Landmine press', group: 'shoulders', pattern: 'push', equipment: 'barbell', unilateral: true, difficulty: 'intermediate', secondary: ['chest', 'core'] },
  { es: 'Elevaciones laterales', en: 'Lateral raise', group: 'shoulders', weightMode: 'per_dumbbell', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner' },
  { es: 'Elevaciones laterales en polea', en: 'Cable lateral raise', group: 'shoulders', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner' },
  { es: 'Elevación lateral unilateral en polea', en: 'Single-arm cable lateral raise', group: 'shoulders', pattern: 'isolation', equipment: 'cable', unilateral: true, difficulty: 'beginner' },
  { es: 'Elevaciones frontales', en: 'Front raise', group: 'shoulders', weightMode: 'per_dumbbell', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner' },
  { es: 'Pájaros (deltoide posterior)', en: 'Rear delt fly', group: 'shoulders', weightMode: 'per_dumbbell', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner', secondary: ['back'] },
  { es: 'Y-raise', en: 'Y-raise', group: 'shoulders', weightMode: 'per_dumbbell', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner', secondary: ['back'] },
  { es: 'Rotación externa con banda', en: 'Band external rotation', group: 'shoulders', pattern: 'isolation', equipment: 'band', unilateral: true, difficulty: 'beginner' },
  { es: 'Remo al mentón', en: 'Upright row', group: 'shoulders', bar: true, pattern: 'pull', equipment: 'barbell', difficulty: 'intermediate', secondary: ['back'] },

  // ── BÍCEPS ──
  { es: 'Curl con barra', en: 'Barbell curl', group: 'biceps', bar: true, pattern: 'isolation', equipment: 'barbell', difficulty: 'beginner' },
  { es: 'Curl con mancuernas', en: 'Dumbbell curl', group: 'biceps', weightMode: 'per_dumbbell', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner' },
  { es: 'Curl martillo', en: 'Hammer curl', group: 'biceps', weightMode: 'per_dumbbell', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner' },
  { es: 'Curl concentrado', en: 'Concentration curl', group: 'biceps', weightMode: 'per_side', pattern: 'isolation', equipment: 'dumbbell', unilateral: true, difficulty: 'beginner' },
  { es: 'Curl predicador', en: 'Preacher curl', group: 'biceps', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Curl en polea', en: 'Cable curl', group: 'biceps', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner' },
  { es: 'Curl inclinado', en: 'Incline dumbbell curl', group: 'biceps', weightMode: 'per_side', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner' },
  { es: 'Curl araña', en: 'Spider curl', group: 'biceps', weightMode: 'per_dumbbell', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner' },

  // ── TRÍCEPS ──
  { es: 'Extensión de tríceps en polea', en: 'Triceps pushdown', group: 'triceps', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner' },
  { es: 'Extensión unilateral en polea', en: 'Single-arm cable pushdown', group: 'triceps', pattern: 'isolation', equipment: 'cable', unilateral: true, difficulty: 'beginner' },
  { es: 'Pressdown agarre inverso', en: 'Reverse-grip pushdown', group: 'triceps', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner' },
  { es: 'Press francés', en: 'Skull crusher', group: 'triceps', bar: true, pattern: 'isolation', equipment: 'barbell', difficulty: 'intermediate' },
  { es: 'Extensión sobre la cabeza', en: 'Overhead triceps extension', group: 'triceps', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner' },
  { es: 'Extensión unilateral sobre la cabeza', en: 'Single-arm overhead extension', group: 'triceps', weightMode: 'per_dumbbell', pattern: 'isolation', equipment: 'dumbbell', unilateral: true, difficulty: 'beginner' },
  { es: 'Fondos en banco', en: 'Bench dips', group: 'triceps', weightMode: 'bodyweight', pattern: 'push', equipment: 'bodyweight', difficulty: 'beginner' },
  { es: 'Fondos asistidos', en: 'Assisted dips', group: 'triceps', pattern: 'push', equipment: 'machine', difficulty: 'beginner', secondary: ['chest', 'shoulders'] },
  { es: 'Patada de tríceps', en: 'Triceps kickback', group: 'triceps', weightMode: 'per_dumbbell', pattern: 'isolation', equipment: 'dumbbell', unilateral: true, difficulty: 'beginner' },
  { es: 'Press cerrado', en: 'Close-grip bench press', group: 'triceps', bar: true, pattern: 'push', equipment: 'barbell', difficulty: 'intermediate', secondary: ['chest', 'shoulders'] },
  { es: 'Extensión en polea con cuerda', en: 'Rope pushdown', group: 'triceps', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner' },

  // ── PIERNA ──
  { es: 'Sentadilla', en: 'Squat', group: 'legs', bar: true, pattern: 'squat', equipment: 'barbell', difficulty: 'intermediate', secondary: ['core'] },
  { es: 'Sentadilla frontal', en: 'Front squat', group: 'legs', bar: true, pattern: 'squat', equipment: 'barbell', difficulty: 'advanced', secondary: ['core'] },
  { es: 'Sentadilla goblet', en: 'Goblet squat', group: 'legs', weightMode: 'per_side', pattern: 'squat', equipment: 'dumbbell', difficulty: 'beginner', secondary: ['core'] },
  { es: 'Sentadilla búlgara', en: 'Bulgarian split squat', group: 'legs', weightMode: 'per_side', pattern: 'lunge', equipment: 'dumbbell', unilateral: true, difficulty: 'intermediate', secondary: ['core'] },
  { es: 'Prensa de piernas', en: 'Leg press', group: 'legs', pattern: 'squat', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Zancadas', en: 'Lunges', group: 'legs', weightMode: 'per_side', pattern: 'lunge', equipment: 'dumbbell', unilateral: true, difficulty: 'beginner', secondary: ['core'] },
  { es: 'Zancada caminando con peso', en: 'Walking lunge (loaded)', group: 'legs', weightMode: 'per_side', trackingMode: 'distance', pattern: 'lunge', equipment: 'dumbbell', unilateral: true, difficulty: 'intermediate', secondary: ['core'] },
  { es: 'Step-up', en: 'Step-up', group: 'legs', weightMode: 'per_side', pattern: 'lunge', equipment: 'dumbbell', unilateral: true, difficulty: 'beginner', secondary: ['core'] },
  { es: 'Hip thrust', en: 'Hip thrust', group: 'legs', bar: true, pattern: 'hinge', equipment: 'barbell', difficulty: 'beginner' },
  { es: 'Puente de glúteo', en: 'Glute bridge', group: 'legs', weightMode: 'bodyweight', pattern: 'hinge', equipment: 'bodyweight', difficulty: 'beginner', secondary: ['core'] },
  { es: 'Peso muerto sumo', en: 'Sumo deadlift', group: 'legs', bar: true, pattern: 'hinge', equipment: 'barbell', difficulty: 'intermediate', secondary: ['back'] },
  { es: 'Peso muerto a una pierna', en: 'Single-leg deadlift', group: 'legs', weightMode: 'per_side', pattern: 'hinge', equipment: 'dumbbell', unilateral: true, difficulty: 'intermediate', secondary: ['core', 'back'] },
  { es: 'Extensión de cuádriceps', en: 'Leg extension', group: 'legs', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Curl femoral', en: 'Leg curl', group: 'legs', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Curl nórdico', en: 'Nordic curl', group: 'legs', weightMode: 'bodyweight', pattern: 'isolation', equipment: 'bodyweight', difficulty: 'advanced', secondary: ['core'] },
  { es: 'Gemelos de pie', en: 'Standing calf raise', group: 'legs', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Gemelos sentado', en: 'Seated calf raise', group: 'legs', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Tibial anterior', en: 'Tibialis raise', group: 'legs', weightMode: 'bodyweight', pattern: 'isolation', equipment: 'bodyweight', difficulty: 'beginner' },
  { es: 'Abductores', en: 'Hip abduction', group: 'legs', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Aductores', en: 'Hip adduction', group: 'legs', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Paseo del granjero', en: "Farmer's walk", group: 'legs', weightMode: 'per_dumbbell', trackingMode: 'distance', pattern: 'carry', equipment: 'dumbbell', difficulty: 'intermediate', secondary: ['core', 'back'] },

  // ── CORE ──
  // Incluye el trabajo antirrotación, rotacional y de acarreo que sostiene el
  // golpeo y el agarre. El cuello va aquí (no hay grupo propio) y solo en su
  // versión isométrica, que es la que no obliga a forzar rango.
  { es: 'Plancha', en: 'Plank', group: 'core', weightMode: 'bodyweight', trackingMode: 'time', pattern: 'antirotation', equipment: 'bodyweight', difficulty: 'beginner' },
  { es: 'Plancha lateral', en: 'Side plank', group: 'core', weightMode: 'bodyweight', trackingMode: 'time', pattern: 'antirotation', equipment: 'bodyweight', unilateral: true, difficulty: 'beginner' },
  { es: 'Hollow hold', en: 'Hollow hold', group: 'core', weightMode: 'bodyweight', trackingMode: 'time', pattern: 'antirotation', equipment: 'bodyweight', difficulty: 'intermediate' },
  { es: 'Pallof press', en: 'Pallof press', group: 'core', trackingMode: 'time', pattern: 'antirotation', equipment: 'cable', unilateral: true, difficulty: 'intermediate' },
  { es: 'Chop de arriba abajo', en: 'Cable chop (high to low)', group: 'core', pattern: 'rotation', equipment: 'cable', unilateral: true, difficulty: 'intermediate' },
  { es: 'Lift de abajo arriba', en: 'Cable lift (low to high)', group: 'core', pattern: 'rotation', equipment: 'cable', unilateral: true, difficulty: 'intermediate' },
  { es: 'Rotación con polea', en: 'Cable rotation', group: 'core', pattern: 'rotation', equipment: 'cable', unilateral: true, difficulty: 'beginner' },
  { es: 'Paseo maleta', en: 'Suitcase carry', group: 'core', weightMode: 'per_dumbbell', trackingMode: 'distance', pattern: 'carry', equipment: 'dumbbell', unilateral: true, difficulty: 'beginner', secondary: ['legs'] },
  { es: 'Isométrico de cuello', en: 'Neck isometric hold', group: 'core', weightMode: 'bodyweight', trackingMode: 'time', pattern: 'antirotation', equipment: 'bodyweight', difficulty: 'beginner' },
  { es: 'Elevación de piernas', en: 'Leg raise', group: 'core', weightMode: 'bodyweight', pattern: 'isolation', equipment: 'bodyweight', difficulty: 'beginner' },
  { es: 'Elevación de rodillas colgado', en: 'Hanging knee raise', group: 'core', weightMode: 'bodyweight', pattern: 'isolation', equipment: 'bodyweight', difficulty: 'intermediate' },
  { es: 'Crunch', en: 'Crunch', group: 'core', weightMode: 'bodyweight', pattern: 'isolation', equipment: 'bodyweight', difficulty: 'beginner' },
  { es: 'Crunch en polea', en: 'Cable crunch', group: 'core', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner' },
  { es: 'Rueda abdominal', en: 'Ab wheel', group: 'core', weightMode: 'bodyweight', pattern: 'antirotation', equipment: 'bodyweight', difficulty: 'advanced' },
  { es: 'Russian twist', en: 'Russian twist', group: 'core', weightMode: 'bodyweight', pattern: 'rotation', equipment: 'bodyweight', difficulty: 'beginner' },
  { es: 'Mountain climbers', en: 'Mountain climbers', group: 'core', weightMode: 'bodyweight', pattern: 'isolation', equipment: 'bodyweight', difficulty: 'beginner' },
  { es: 'Elevación de piernas colgado', en: 'Hanging leg raise', group: 'core', weightMode: 'bodyweight', pattern: 'isolation', equipment: 'bodyweight', difficulty: 'advanced' },

  // ── POTENCIA ──
  { es: 'Cargada de fuerza', en: 'Power clean', group: 'power', bar: true, pattern: 'hinge', equipment: 'barbell', difficulty: 'advanced', secondary: ['legs', 'back'] },
  { es: 'Push press', en: 'Push press', group: 'power', bar: true, pattern: 'push', equipment: 'barbell', difficulty: 'intermediate', secondary: ['legs', 'shoulders'] },
  { es: 'Tirón de cargada', en: 'Clean pull', group: 'power', bar: true, pattern: 'hinge', equipment: 'barbell', difficulty: 'advanced', secondary: ['back', 'legs'] },
  { es: 'Balanceo con kettlebell', en: 'Kettlebell swing', group: 'power', weightMode: 'per_dumbbell', pattern: 'hinge', equipment: 'kettlebell', difficulty: 'intermediate', secondary: ['legs', 'core'] },
  { es: 'Salto al cajón', en: 'Box jump', group: 'power', weightMode: 'bodyweight', pattern: 'jump', equipment: 'bodyweight', difficulty: 'beginner', secondary: ['legs'] },
  { es: 'Sentadilla con salto', en: 'Jump squat', group: 'power', weightMode: 'bodyweight', pattern: 'jump', equipment: 'bodyweight', difficulty: 'intermediate', secondary: ['legs'] },
  { es: 'Zancada con salto', en: 'Jumping lunge', group: 'power', weightMode: 'bodyweight', pattern: 'jump', equipment: 'bodyweight', unilateral: true, difficulty: 'intermediate', secondary: ['legs'] },
  { es: 'Salto lateral', en: 'Lateral bound', group: 'power', weightMode: 'bodyweight', pattern: 'jump', equipment: 'bodyweight', unilateral: true, difficulty: 'intermediate', secondary: ['legs', 'core'] },
  { es: 'Golpe de balón medicinal', en: 'Medicine ball slam', group: 'power', weightMode: 'bodyweight', pattern: 'rotation', equipment: 'ball', difficulty: 'beginner', secondary: ['core'] },
  { es: 'Lanzamiento de balón medicinal', en: 'Medicine ball throw', group: 'power', weightMode: 'bodyweight', pattern: 'rotation', equipment: 'ball', difficulty: 'beginner', secondary: ['core'] },
  { es: 'Lanzamiento rotacional con balón', en: 'Rotational med ball throw', group: 'power', weightMode: 'bodyweight', pattern: 'rotation', equipment: 'ball', unilateral: true, difficulty: 'intermediate', secondary: ['core'] },
  { es: 'Salto horizontal', en: 'Broad jump', group: 'power', weightMode: 'bodyweight', pattern: 'jump', equipment: 'bodyweight', difficulty: 'intermediate', secondary: ['legs'] },
  { es: 'Empuje de trineo', en: 'Sled push', group: 'power', trackingMode: 'distance', pattern: 'carry', equipment: 'sled', difficulty: 'intermediate', secondary: ['legs', 'core'] },
  { es: 'Arrastre de trineo', en: 'Sled pull', group: 'power', trackingMode: 'distance', pattern: 'carry', equipment: 'sled', difficulty: 'intermediate', secondary: ['legs', 'back'] },

  // ── FULL BODY ──
  { es: 'Thruster', en: 'Thruster', group: 'full_body', bar: true, pattern: 'squat', equipment: 'barbell', difficulty: 'intermediate', secondary: ['shoulders', 'legs'] },
  { es: 'Burpee', en: 'Burpee', group: 'full_body', weightMode: 'bodyweight', pattern: 'jump', equipment: 'bodyweight', difficulty: 'beginner', secondary: ['chest', 'legs'] },
  { es: 'Cargada y press', en: 'Clean and press', group: 'full_body', bar: true, pattern: 'hinge', equipment: 'barbell', difficulty: 'advanced', secondary: ['shoulders', 'legs'] },
  { es: 'Arrancada', en: 'Snatch', group: 'full_body', bar: true, pattern: 'hinge', equipment: 'barbell', difficulty: 'advanced', secondary: ['shoulders', 'legs'] },
  { es: 'Man maker', en: 'Man maker', group: 'full_body', weightMode: 'per_side', pattern: 'push', equipment: 'dumbbell', difficulty: 'advanced', secondary: ['back', 'chest'] },
  { es: 'Wall ball', en: 'Wall ball', group: 'full_body', weightMode: 'total', pattern: 'squat', equipment: 'ball', difficulty: 'beginner', secondary: ['shoulders', 'legs'] },
  { es: 'Levantada turca', en: 'Turkish get-up', group: 'full_body', weightMode: 'per_side', pattern: 'carry', equipment: 'kettlebell', unilateral: true, difficulty: 'advanced', secondary: ['core', 'shoulders'] },
  { es: 'Devil press', en: 'Devil press', group: 'full_body', weightMode: 'per_side', pattern: 'hinge', equipment: 'dumbbell', difficulty: 'advanced', secondary: ['shoulders', 'chest'] },
  { es: 'Peso muerto con remo', en: 'Renegade row', group: 'full_body', weightMode: 'per_side', pattern: 'pull', equipment: 'dumbbell', unilateral: true, difficulty: 'advanced', secondary: ['core', 'back'] },
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

/** Material del ejercicio; null si es libre o no lo declara. */
export function equipmentOf(nameOrKey: string): Equipment | null {
  return libExerciseOf(nameOrKey)?.equipment ?? null;
}

/** Patrón de movimiento; null si es libre o no lo declara. */
export function patternOf(nameOrKey: string): MovementPattern | null {
  return libExerciseOf(nameOrKey)?.pattern ?? null;
}

export interface ExerciseFilter {
  group?: MuscleGroup | 'all';
  equipment?: Equipment | 'all';
  pattern?: MovementPattern | 'all';
  /** true = solo unilaterales. undefined/false = no filtra. */
  unilateralOnly?: boolean;
  difficulty?: Difficulty | 'all';
  /** Texto libre; casa contra el nombre en ES y EN, con o sin tildes. */
  query?: string;
}

/**
 * Filtra la biblioteca. Un ejercicio sin el metadato que se está filtrando se
 * EXCLUYE de ese filtro (no se cuela por no estar anotado), pero sigue
 * apareciendo cuando ese filtro está en 'all'.
 */
export function filterExercises(f: ExerciseFilter): LibExercise[] {
  const needle = f.query ? normNoAccent(f.query) : '';
  return EXERCISE_LIBRARY.filter((e) => {
    if (f.group && f.group !== 'all' && e.group !== f.group) return false;
    if (f.equipment && f.equipment !== 'all' && e.equipment !== f.equipment) return false;
    if (f.pattern && f.pattern !== 'all' && e.pattern !== f.pattern) return false;
    if (f.difficulty && f.difficulty !== 'all' && e.difficulty !== f.difficulty) return false;
    if (f.unilateralOnly && !e.unilateral) return false;
    if (needle && !normNoAccent(e.es).includes(needle) && !normNoAccent(e.en).includes(needle)) return false;
    return true;
  });
}

/** Materiales presentes en la biblioteca (para no pintar filtros vacíos). */
export function availableEquipment(): Equipment[] {
  const set = new Set(EXERCISE_LIBRARY.map((e) => e.equipment).filter(Boolean) as Equipment[]);
  return EQUIPMENT_TYPES.filter((x) => set.has(x));
}

/** Patrones presentes en la biblioteca. */
export function availablePatterns(): MovementPattern[] {
  const set = new Set(EXERCISE_LIBRARY.map((e) => e.pattern).filter(Boolean) as MovementPattern[]);
  return MOVEMENT_PATTERNS.filter((x) => set.has(x));
}
