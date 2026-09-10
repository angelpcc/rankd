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

/**
 * Material necesario.
 *
 * `rope` (cuerdas de batalla y cuerda de trepa) y `odd` (mazo, neumático, saco
 * de arena) se añadieron con el repertorio de peleador: son material de
 * gimnasio de combate y meterlos a la fuerza en 'band' o 'ball' habría hecho
 * inservible el filtro justo para quien más lo necesita.
 */
export type Equipment =
  | 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight'
  | 'kettlebell' | 'band' | 'ball' | 'sled' | 'rope' | 'odd';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export const MOVEMENT_PATTERNS: MovementPattern[] = [
  'push', 'pull', 'squat', 'hinge', 'lunge', 'carry', 'rotation', 'antirotation', 'jump', 'isolation',
];
export const EQUIPMENT_TYPES: Equipment[] = [
  'barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band', 'ball', 'sled', 'rope', 'odd',
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
  /**
   * Ejercicio del REPERTORIO DE PELEADOR: lo que se usa en un gimnasio de
   * combate o en un campamento, no en una sala de máquinas. Dominadas y sus
   * variantes, calistenia, cuerdas de batalla, pliometría, core rotacional,
   * cuello, mazo y neumático, desplazamientos por el suelo…
   *
   * No es una categoría "mejor": es una etiqueta de DÓNDE se puede hacer. Mucha
   * gente que compite no pisa un gimnasio convencional, y la biblioteca estaba
   * escrita para quien sí. Marcar estos ejercicios permite darles visibilidad
   * sin esconderle nada a nadie: el aficionado los ve igual.
   */
  fighter?: boolean;
  /** Músculos que acompañan al principal. */
  secondary?: MuscleGroup[];
  /**
   * Nombres ANTIGUOS que deben seguir resolviendo a esta ficha.
   *
   * Al desdoblar un ejercicio en variantes por equipo ("Jalón al pecho" →
   * "Jalón al pecho (polea)" + "(máquina guiada)") el nombre viejo desaparece
   * de la lista, pero sigue guardado en `strength_sets` de sesiones anteriores.
   * Sin alias, esas filas dejarían de encontrar su ficha y perderían grupo
   * muscular, modo de peso y ficha de técnica. El alias apunta a la variante
   * más habitual, que es la que el usuario estaba registrando.
   *
   * NO se muestran en la biblioteca ni en el dictado: solo resuelven nombres.
   */
  aliases?: string[];
}

// La ficha de técnica vive en `exerciseTechnique.ts` (tipo `Technique`). Los
// músculos secundarios y el material NO se repiten allí: se leen de los campos
// `secondary` y `equipment` de esta misma biblioteca.

export const EXERCISE_LIBRARY: LibExercise[] = [
  // ── ESPALDA ──
  { es: 'Dominadas', en: 'Pull-ups', group: 'back', weightMode: 'bodyweight', pattern: 'pull', equipment: 'bodyweight', fighter: true, difficulty: 'intermediate', secondary: ['biceps', 'core'] },
  { es: 'Dominadas lastradas', en: 'Weighted pull-ups', group: 'back', weightMode: 'bodyweight', pattern: 'pull', equipment: 'bodyweight', fighter: true, difficulty: 'advanced', secondary: ['biceps', 'core'] },
  { es: 'Dominadas asistidas (máquina)', en: 'Assisted pull-up (machine)', group: 'back', pattern: 'pull', equipment: 'machine', difficulty: 'beginner', secondary: ['biceps'] },
  { es: 'Jalón al pecho (polea)', en: 'Lat pulldown (cable)', group: 'back', pattern: 'pull', equipment: 'cable', difficulty: 'beginner', secondary: ['biceps'], aliases: ['Jalón al pecho', 'Lat pulldown'] },
  { es: 'Jalón al pecho (máquina guiada)', en: 'Lat pulldown (plate-loaded machine)', group: 'back', pattern: 'pull', equipment: 'machine', difficulty: 'beginner', secondary: ['biceps'] },
  { es: 'Jalón agarre en V (polea)', en: 'V-bar pulldown (cable)', group: 'back', pattern: 'pull', equipment: 'cable', difficulty: 'beginner', secondary: ['biceps'] },
  { es: 'Jalón agarre cerrado (polea)', en: 'Close-grip pulldown (cable)', group: 'back', pattern: 'pull', equipment: 'cable', difficulty: 'beginner', secondary: ['biceps'], aliases: ['Jalón agarre cerrado', 'Close-grip pulldown'] },
  { es: 'Jalón agarre neutro (polea)', en: 'Neutral-grip pulldown (cable)', group: 'back', pattern: 'pull', equipment: 'cable', difficulty: 'beginner', secondary: ['biceps'] },
  { es: 'Jalón unilateral (polea)', en: 'Single-arm pulldown (cable)', group: 'back', pattern: 'pull', equipment: 'cable', unilateral: true, difficulty: 'intermediate', secondary: ['biceps', 'core'] },
  { es: 'Remo con barra', en: 'Barbell row', group: 'back', bar: true, pattern: 'pull', equipment: 'barbell', difficulty: 'intermediate', secondary: ['biceps', 'core'] },
  { es: 'Remo con mancuerna', en: 'Dumbbell row', group: 'back', weightMode: 'per_side', pattern: 'pull', equipment: 'dumbbell', unilateral: true, difficulty: 'beginner', secondary: ['biceps'] },
  { es: 'Remo con mancuernas a dos manos', en: 'Two-dumbbell row', group: 'back', weightMode: 'per_dumbbell', pattern: 'pull', equipment: 'dumbbell', difficulty: 'beginner', secondary: ['biceps', 'core'] },
  { es: 'Remo en punta (T)', en: 'T-bar row', group: 'back', bar: true, pattern: 'pull', equipment: 'barbell', difficulty: 'intermediate', secondary: ['biceps'] },
  { es: 'Remo en polea baja', en: 'Seated cable row', group: 'back', pattern: 'pull', equipment: 'cable', difficulty: 'beginner', secondary: ['biceps'] },
  { es: 'Remo en polea agarre ancho', en: 'Wide-grip cable row', group: 'back', pattern: 'pull', equipment: 'cable', difficulty: 'beginner', secondary: ['biceps', 'shoulders'] },
  { es: 'Remo en máquina', en: 'Machine row', group: 'back', pattern: 'pull', equipment: 'machine', difficulty: 'beginner', secondary: ['biceps'] },
  { es: 'Remo pecho apoyado (máquina)', en: 'Chest-supported row (machine)', group: 'back', pattern: 'pull', equipment: 'machine', difficulty: 'beginner', secondary: ['biceps'], aliases: ['Remo pecho apoyado', 'Chest-supported row'] },
  { es: 'Remo pecho apoyado con mancuernas', en: 'Chest-supported dumbbell row', group: 'back', weightMode: 'per_dumbbell', pattern: 'pull', equipment: 'dumbbell', difficulty: 'beginner', secondary: ['biceps'] },
  { es: 'Remo en multipower', en: 'Smith machine row', group: 'back', pattern: 'pull', equipment: 'machine', difficulty: 'beginner', secondary: ['biceps', 'core'] },
  { es: 'Remo unilateral en polea', en: 'Single-arm cable row', group: 'back', pattern: 'pull', equipment: 'cable', unilateral: true, difficulty: 'beginner', secondary: ['biceps', 'core'] },
  { es: 'Peso muerto', en: 'Deadlift', group: 'back', bar: true, pattern: 'hinge', equipment: 'barbell', difficulty: 'advanced', secondary: ['legs', 'core'] },
  { es: 'Peso muerto rumano', en: 'Romanian deadlift', group: 'back', bar: true, pattern: 'hinge', equipment: 'barbell', difficulty: 'intermediate', secondary: ['legs'] },
  { es: 'Peso muerto rumano con mancuernas', en: 'Dumbbell Romanian deadlift', group: 'back', weightMode: 'per_dumbbell', pattern: 'hinge', equipment: 'dumbbell', difficulty: 'beginner', secondary: ['legs'] },
  { es: 'Hiperextensiones', en: 'Back extension', group: 'back', weightMode: 'bodyweight', pattern: 'hinge', equipment: 'bodyweight', difficulty: 'beginner', secondary: ['legs', 'core'] },
  { es: 'Encogimientos con barra', en: 'Barbell shrug', group: 'back', bar: true, pattern: 'isolation', equipment: 'barbell', difficulty: 'beginner', secondary: ['shoulders'], aliases: ['Encogimientos', 'Shrugs'] },
  { es: 'Encogimientos con mancuernas', en: 'Dumbbell shrug', group: 'back', weightMode: 'per_dumbbell', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner', secondary: ['shoulders'] },
  { es: 'Encogimientos en máquina', en: 'Machine shrug', group: 'back', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner', secondary: ['shoulders'] },
  { es: 'Face pull', en: 'Face pull', group: 'back', pattern: 'pull', equipment: 'cable', difficulty: 'beginner', secondary: ['shoulders'] },
  { es: 'Pull-over en polea', en: 'Straight-arm pulldown', group: 'back', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner', secondary: ['chest'] },
  { es: 'Pullover en máquina', en: 'Machine pullover', group: 'back', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner', secondary: ['chest'] },

  // ── PECHO ──
  { es: 'Press banca con barra', en: 'Barbell bench press', group: 'chest', bar: true, pattern: 'push', equipment: 'barbell', difficulty: 'intermediate', secondary: ['triceps', 'shoulders'], aliases: ['Press banca', 'Bench press'] },
  { es: 'Press banca con mancuernas', en: 'Dumbbell bench press', group: 'chest', weightMode: 'per_side', pattern: 'push', equipment: 'dumbbell', difficulty: 'beginner', secondary: ['triceps', 'shoulders'] },
  { es: 'Press de pecho en máquina', en: 'Machine chest press', group: 'chest', pattern: 'push', equipment: 'machine', difficulty: 'beginner', secondary: ['triceps'] },
  { es: 'Press de pecho en multipower', en: 'Smith machine bench press', group: 'chest', pattern: 'push', equipment: 'machine', difficulty: 'beginner', secondary: ['triceps', 'shoulders'] },
  { es: 'Press inclinado con barra', en: 'Incline barbell press', group: 'chest', bar: true, pattern: 'push', equipment: 'barbell', difficulty: 'intermediate', secondary: ['shoulders', 'triceps'] },
  { es: 'Press inclinado con mancuernas', en: 'Incline dumbbell press', group: 'chest', weightMode: 'per_side', pattern: 'push', equipment: 'dumbbell', difficulty: 'beginner', secondary: ['shoulders', 'triceps'] },
  { es: 'Press inclinado en máquina', en: 'Incline machine press', group: 'chest', pattern: 'push', equipment: 'machine', difficulty: 'beginner', secondary: ['shoulders', 'triceps'] },
  { es: 'Press declinado con barra', en: 'Decline barbell press', group: 'chest', bar: true, pattern: 'push', equipment: 'barbell', difficulty: 'intermediate', secondary: ['triceps'], aliases: ['Press declinado', 'Decline press'] },
  { es: 'Press declinado en máquina', en: 'Decline machine press', group: 'chest', pattern: 'push', equipment: 'machine', difficulty: 'beginner', secondary: ['triceps'] },
  { es: 'Press unilateral en polea', en: 'Single-arm cable press', group: 'chest', pattern: 'push', equipment: 'cable', unilateral: true, difficulty: 'intermediate', secondary: ['triceps', 'core'] },
  { es: 'Aperturas con mancuernas', en: 'Dumbbell fly', group: 'chest', weightMode: 'per_side', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner', secondary: ['shoulders'] },
  { es: 'Aperturas inclinadas con mancuernas', en: 'Incline dumbbell fly', group: 'chest', weightMode: 'per_side', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner', secondary: ['shoulders'] },
  { es: 'Aperturas en polea', en: 'Cable fly', group: 'chest', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner', secondary: ['shoulders'] },
  { es: 'Cruce de poleas alto-bajo', en: 'High-to-low cable crossover', group: 'chest', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner', secondary: ['shoulders'] },
  { es: 'Cruce de poleas bajo-alto', en: 'Low-to-high cable crossover', group: 'chest', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner', secondary: ['shoulders'] },
  { es: 'Contractor (peck deck)', en: 'Pec deck', group: 'chest', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner', secondary: ['shoulders'] },
  { es: 'Fondos en paralelas', en: 'Chest dips', group: 'chest', weightMode: 'bodyweight', pattern: 'push', equipment: 'bodyweight', fighter: true, difficulty: 'intermediate', secondary: ['triceps', 'shoulders'] },
  { es: 'Flexiones', en: 'Push-ups', group: 'chest', weightMode: 'bodyweight', pattern: 'push', equipment: 'bodyweight', fighter: true, difficulty: 'beginner', secondary: ['triceps', 'core'] },
  { es: 'Pullover con mancuerna', en: 'Dumbbell pullover', group: 'chest', weightMode: 'per_side', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner', secondary: ['back'] },

  // ── HOMBRO ──
  { es: 'Press militar con barra', en: 'Overhead barbell press', group: 'shoulders', bar: true, pattern: 'push', equipment: 'barbell', difficulty: 'intermediate', secondary: ['triceps', 'core'] },
  { es: 'Press militar con mancuernas', en: 'Dumbbell shoulder press', group: 'shoulders', weightMode: 'per_side', pattern: 'push', equipment: 'dumbbell', difficulty: 'beginner', secondary: ['triceps'] },
  { es: 'Press de hombro en máquina', en: 'Machine shoulder press', group: 'shoulders', pattern: 'push', equipment: 'machine', difficulty: 'beginner', secondary: ['triceps'] },
  { es: 'Press de hombro en multipower', en: 'Smith machine shoulder press', group: 'shoulders', pattern: 'push', equipment: 'machine', difficulty: 'beginner', secondary: ['triceps'] },
  { es: 'Press Arnold', en: 'Arnold press', group: 'shoulders', weightMode: 'per_dumbbell', pattern: 'push', equipment: 'dumbbell', difficulty: 'intermediate', secondary: ['triceps'] },
  // Sin `bar`: en landmine se carga un solo extremo, así que la calculadora de
  // discos (que asume barra simétrica) daría un total equivocado.
  { es: 'Press landmine', en: 'Landmine press', group: 'shoulders', pattern: 'push', equipment: 'barbell', unilateral: true, difficulty: 'intermediate', secondary: ['chest', 'core'] },
  { es: 'Elevaciones laterales con mancuernas', en: 'Dumbbell lateral raise', group: 'shoulders', weightMode: 'per_dumbbell', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner', aliases: ['Elevaciones laterales', 'Lateral raise'] },
  { es: 'Elevaciones laterales en polea', en: 'Cable lateral raise', group: 'shoulders', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner' },
  { es: 'Elevación lateral unilateral en polea', en: 'Single-arm cable lateral raise', group: 'shoulders', pattern: 'isolation', equipment: 'cable', unilateral: true, difficulty: 'beginner' },
  { es: 'Elevaciones laterales en máquina', en: 'Machine lateral raise', group: 'shoulders', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Elevaciones frontales con mancuernas', en: 'Dumbbell front raise', group: 'shoulders', weightMode: 'per_dumbbell', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner', aliases: ['Elevaciones frontales', 'Front raise'] },
  { es: 'Elevaciones frontales en polea', en: 'Cable front raise', group: 'shoulders', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner' },
  { es: 'Pájaros con mancuernas', en: 'Dumbbell rear delt fly', group: 'shoulders', weightMode: 'per_dumbbell', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner', secondary: ['back'], aliases: ['Pájaros (deltoide posterior)', 'Rear delt fly'] },
  { es: 'Pájaros en máquina (contractor inverso)', en: 'Reverse pec deck', group: 'shoulders', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner', secondary: ['back'] },
  { es: 'Pájaros en polea', en: 'Cable rear delt fly', group: 'shoulders', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner', secondary: ['back'] },
  { es: 'Y-raise', en: 'Y-raise', group: 'shoulders', weightMode: 'per_dumbbell', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner', secondary: ['back'] },
  { es: 'Rotación externa con banda', en: 'Band external rotation', group: 'shoulders', pattern: 'isolation', equipment: 'band', unilateral: true, difficulty: 'beginner' },
  { es: 'Rotación externa en polea', en: 'Cable external rotation', group: 'shoulders', pattern: 'isolation', equipment: 'cable', unilateral: true, difficulty: 'beginner' },
  { es: 'Remo al mentón con barra', en: 'Barbell upright row', group: 'shoulders', bar: true, pattern: 'pull', equipment: 'barbell', difficulty: 'intermediate', secondary: ['back'], aliases: ['Remo al mentón', 'Upright row'] },
  { es: 'Remo al mentón en polea', en: 'Cable upright row', group: 'shoulders', pattern: 'pull', equipment: 'cable', difficulty: 'beginner', secondary: ['back'] },

  // ── BÍCEPS ──
  { es: 'Curl con barra', en: 'Barbell curl', group: 'biceps', bar: true, pattern: 'isolation', equipment: 'barbell', difficulty: 'beginner' },
  { es: 'Curl con barra Z', en: 'EZ-bar curl', group: 'biceps', bar: true, pattern: 'isolation', equipment: 'barbell', difficulty: 'beginner' },
  { es: 'Curl con mancuernas', en: 'Dumbbell curl', group: 'biceps', weightMode: 'per_dumbbell', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner' },
  { es: 'Curl martillo', en: 'Hammer curl', group: 'biceps', weightMode: 'per_dumbbell', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner' },
  { es: 'Curl martillo en polea con cuerda', en: 'Rope hammer curl (cable)', group: 'biceps', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner' },
  { es: 'Curl concentrado', en: 'Concentration curl', group: 'biceps', weightMode: 'per_side', pattern: 'isolation', equipment: 'dumbbell', unilateral: true, difficulty: 'beginner' },
  { es: 'Curl predicador con barra Z', en: 'EZ-bar preacher curl', group: 'biceps', bar: true, pattern: 'isolation', equipment: 'barbell', difficulty: 'beginner' },
  { es: 'Curl predicador en máquina', en: 'Machine preacher curl', group: 'biceps', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner', aliases: ['Curl predicador', 'Preacher curl'] },
  { es: 'Curl en polea', en: 'Cable curl', group: 'biceps', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner' },
  { es: 'Curl inclinado', en: 'Incline dumbbell curl', group: 'biceps', weightMode: 'per_side', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner' },
  { es: 'Curl araña', en: 'Spider curl', group: 'biceps', weightMode: 'per_dumbbell', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner' },
  { es: 'Curl inverso con barra', en: 'Reverse barbell curl', group: 'biceps', bar: true, pattern: 'isolation', equipment: 'barbell', difficulty: 'beginner' },

  // ── TRÍCEPS ──
  { es: 'Extensión de tríceps en polea (barra)', en: 'Triceps pushdown (bar)', group: 'triceps', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner', aliases: ['Extensión de tríceps en polea', 'Triceps pushdown'] },
  { es: 'Extensión en polea con cuerda', en: 'Rope pushdown', group: 'triceps', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner' },
  { es: 'Extensión de tríceps en máquina', en: 'Machine triceps extension', group: 'triceps', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Extensión unilateral en polea', en: 'Single-arm cable pushdown', group: 'triceps', pattern: 'isolation', equipment: 'cable', unilateral: true, difficulty: 'beginner' },
  { es: 'Pressdown agarre inverso', en: 'Reverse-grip pushdown', group: 'triceps', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner' },
  { es: 'Press francés con barra Z', en: 'EZ-bar skull crusher', group: 'triceps', bar: true, pattern: 'isolation', equipment: 'barbell', difficulty: 'intermediate', aliases: ['Press francés', 'Skull crusher'] },
  { es: 'Press francés con mancuernas', en: 'Dumbbell skull crusher', group: 'triceps', weightMode: 'per_dumbbell', pattern: 'isolation', equipment: 'dumbbell', difficulty: 'beginner' },
  { es: 'Extensión sobre la cabeza', en: 'Overhead triceps extension', group: 'triceps', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner' },
  { es: 'Extensión unilateral sobre la cabeza', en: 'Single-arm overhead extension', group: 'triceps', weightMode: 'per_dumbbell', pattern: 'isolation', equipment: 'dumbbell', unilateral: true, difficulty: 'beginner' },
  { es: 'Fondos en banco', en: 'Bench dips', group: 'triceps', weightMode: 'bodyweight', pattern: 'push', equipment: 'bodyweight', difficulty: 'beginner' },
  { es: 'Fondos asistidos', en: 'Assisted dips', group: 'triceps', pattern: 'push', equipment: 'machine', difficulty: 'beginner', secondary: ['chest', 'shoulders'] },
  { es: 'Patada de tríceps', en: 'Triceps kickback', group: 'triceps', weightMode: 'per_dumbbell', pattern: 'isolation', equipment: 'dumbbell', unilateral: true, difficulty: 'beginner' },
  { es: 'Press cerrado', en: 'Close-grip bench press', group: 'triceps', bar: true, pattern: 'push', equipment: 'barbell', difficulty: 'intermediate', secondary: ['chest', 'shoulders'] },

  // ── PIERNA ──
  { es: 'Sentadilla con barra', en: 'Barbell squat', group: 'legs', bar: true, pattern: 'squat', equipment: 'barbell', difficulty: 'intermediate', secondary: ['core'], aliases: ['Sentadilla', 'Squat'] },
  { es: 'Sentadilla frontal', en: 'Front squat', group: 'legs', bar: true, pattern: 'squat', equipment: 'barbell', difficulty: 'advanced', secondary: ['core'] },
  { es: 'Sentadilla en multipower', en: 'Smith machine squat', group: 'legs', pattern: 'squat', equipment: 'machine', difficulty: 'beginner', secondary: ['core'] },
  { es: 'Sentadilla hack (máquina)', en: 'Hack squat (machine)', group: 'legs', pattern: 'squat', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Sentadilla goblet', en: 'Goblet squat', group: 'legs', weightMode: 'per_side', pattern: 'squat', equipment: 'dumbbell', difficulty: 'beginner', secondary: ['core'] },
  { es: 'Sentadilla búlgara con mancuernas', en: 'Dumbbell Bulgarian split squat', group: 'legs', weightMode: 'per_side', pattern: 'lunge', equipment: 'dumbbell', unilateral: true, difficulty: 'intermediate', secondary: ['core'], aliases: ['Sentadilla búlgara', 'Bulgarian split squat'] },
  { es: 'Sentadilla búlgara con barra', en: 'Barbell Bulgarian split squat', group: 'legs', bar: true, pattern: 'lunge', equipment: 'barbell', unilateral: true, difficulty: 'advanced', secondary: ['core'] },
  { es: 'Prensa de piernas', en: 'Leg press', group: 'legs', pattern: 'squat', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Prensa horizontal', en: 'Horizontal leg press', group: 'legs', pattern: 'squat', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Zancadas con mancuernas', en: 'Dumbbell lunges', group: 'legs', weightMode: 'per_side', pattern: 'lunge', equipment: 'dumbbell', unilateral: true, difficulty: 'beginner', secondary: ['core'], aliases: ['Zancadas', 'Lunges'] },
  { es: 'Zancadas con barra', en: 'Barbell lunges', group: 'legs', bar: true, pattern: 'lunge', equipment: 'barbell', unilateral: true, difficulty: 'intermediate', secondary: ['core'] },
  { es: 'Zancada caminando con peso', en: 'Walking lunge (loaded)', group: 'legs', weightMode: 'per_side', trackingMode: 'distance', pattern: 'lunge', equipment: 'dumbbell', unilateral: true, difficulty: 'intermediate', secondary: ['core'] },
  { es: 'Step-up', en: 'Step-up', group: 'legs', weightMode: 'per_side', pattern: 'lunge', equipment: 'dumbbell', unilateral: true, difficulty: 'beginner', secondary: ['core'] },
  { es: 'Hip thrust con barra', en: 'Barbell hip thrust', group: 'legs', bar: true, pattern: 'hinge', equipment: 'barbell', difficulty: 'beginner', aliases: ['Hip thrust'] },
  { es: 'Hip thrust en máquina', en: 'Machine hip thrust', group: 'legs', pattern: 'hinge', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Puente de glúteo', en: 'Glute bridge', group: 'legs', weightMode: 'bodyweight', pattern: 'hinge', equipment: 'bodyweight', difficulty: 'beginner', secondary: ['core'] },
  { es: 'Patada de glúteo en polea', en: 'Cable glute kickback', group: 'legs', pattern: 'hinge', equipment: 'cable', unilateral: true, difficulty: 'beginner' },
  { es: 'Peso muerto sumo', en: 'Sumo deadlift', group: 'legs', bar: true, pattern: 'hinge', equipment: 'barbell', difficulty: 'intermediate', secondary: ['back'] },
  { es: 'Peso muerto a una pierna', en: 'Single-leg deadlift', group: 'legs', weightMode: 'per_side', pattern: 'hinge', equipment: 'dumbbell', unilateral: true, difficulty: 'intermediate', secondary: ['core', 'back'] },
  { es: 'Extensión de cuádriceps', en: 'Leg extension', group: 'legs', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Curl femoral tumbado', en: 'Lying leg curl', group: 'legs', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner', aliases: ['Curl femoral', 'Leg curl'] },
  { es: 'Curl femoral sentado', en: 'Seated leg curl', group: 'legs', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Curl nórdico', en: 'Nordic curl', group: 'legs', weightMode: 'bodyweight', pattern: 'isolation', equipment: 'bodyweight', difficulty: 'advanced', secondary: ['core'] },
  { es: 'Gemelos de pie', en: 'Standing calf raise', group: 'legs', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Gemelos sentado', en: 'Seated calf raise', group: 'legs', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Gemelos en prensa', en: 'Calf press on leg press', group: 'legs', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Tibial anterior', en: 'Tibialis raise', group: 'legs', weightMode: 'bodyweight', pattern: 'isolation', equipment: 'bodyweight', difficulty: 'beginner' },
  { es: 'Abductores', en: 'Hip abduction', group: 'legs', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Aductores', en: 'Hip adduction', group: 'legs', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Paseo del granjero', en: "Farmer's walk", group: 'legs', weightMode: 'per_dumbbell', trackingMode: 'distance', pattern: 'carry', equipment: 'dumbbell', fighter: true, difficulty: 'intermediate', secondary: ['core', 'back'] },

  // ── CORE ──
  // Incluye el trabajo antirrotación, rotacional y de acarreo que sostiene el
  // golpeo y el agarre. El cuello va aquí (no hay grupo propio) y solo en su
  // versión isométrica, que es la que no obliga a forzar rango.
  { es: 'Plancha', en: 'Plank', group: 'core', weightMode: 'bodyweight', trackingMode: 'time', pattern: 'antirotation', equipment: 'bodyweight', fighter: true, difficulty: 'beginner' },
  { es: 'Plancha lateral', en: 'Side plank', group: 'core', weightMode: 'bodyweight', trackingMode: 'time', pattern: 'antirotation', equipment: 'bodyweight', unilateral: true, fighter: true, difficulty: 'beginner' },
  { es: 'Hollow hold', en: 'Hollow hold', group: 'core', weightMode: 'bodyweight', trackingMode: 'time', pattern: 'antirotation', equipment: 'bodyweight', fighter: true, difficulty: 'intermediate' },
  { es: 'Pallof press', en: 'Pallof press', group: 'core', trackingMode: 'time', pattern: 'antirotation', equipment: 'cable', unilateral: true, fighter: true, difficulty: 'intermediate' },
  { es: 'Chop de arriba abajo', en: 'Cable chop (high to low)', group: 'core', pattern: 'rotation', equipment: 'cable', unilateral: true, fighter: true, difficulty: 'intermediate' },
  { es: 'Lift de abajo arriba', en: 'Cable lift (low to high)', group: 'core', pattern: 'rotation', equipment: 'cable', unilateral: true, fighter: true, difficulty: 'intermediate' },
  { es: 'Rotación con polea', en: 'Cable rotation', group: 'core', pattern: 'rotation', equipment: 'cable', unilateral: true, fighter: true, difficulty: 'beginner' },
  { es: 'Paseo maleta', en: 'Suitcase carry', group: 'core', weightMode: 'per_dumbbell', trackingMode: 'distance', pattern: 'carry', equipment: 'dumbbell', unilateral: true, fighter: true, difficulty: 'beginner', secondary: ['legs'] },
  { es: 'Isométrico de cuello', en: 'Neck isometric hold', group: 'core', weightMode: 'bodyweight', trackingMode: 'time', pattern: 'antirotation', equipment: 'bodyweight', fighter: true, difficulty: 'beginner' },
  { es: 'Elevación de piernas', en: 'Leg raise', group: 'core', weightMode: 'bodyweight', pattern: 'isolation', equipment: 'bodyweight', difficulty: 'beginner' },
  { es: 'Elevación de rodillas colgado', en: 'Hanging knee raise', group: 'core', weightMode: 'bodyweight', pattern: 'isolation', equipment: 'bodyweight', fighter: true, difficulty: 'intermediate' },
  { es: 'Elevación de piernas colgado', en: 'Hanging leg raise', group: 'core', weightMode: 'bodyweight', pattern: 'isolation', equipment: 'bodyweight', fighter: true, difficulty: 'advanced' },
  { es: 'Crunch', en: 'Crunch', group: 'core', weightMode: 'bodyweight', pattern: 'isolation', equipment: 'bodyweight', difficulty: 'beginner' },
  { es: 'Crunch en polea', en: 'Cable crunch', group: 'core', pattern: 'isolation', equipment: 'cable', difficulty: 'beginner' },
  { es: 'Crunch en máquina', en: 'Machine crunch', group: 'core', pattern: 'isolation', equipment: 'machine', difficulty: 'beginner' },
  { es: 'Rueda abdominal', en: 'Ab wheel', group: 'core', weightMode: 'bodyweight', pattern: 'antirotation', equipment: 'bodyweight', fighter: true, difficulty: 'advanced' },
  { es: 'Russian twist', en: 'Russian twist', group: 'core', weightMode: 'bodyweight', pattern: 'rotation', equipment: 'bodyweight', fighter: true, difficulty: 'beginner' },
  { es: 'Mountain climbers', en: 'Mountain climbers', group: 'core', weightMode: 'bodyweight', pattern: 'isolation', equipment: 'bodyweight', fighter: true, difficulty: 'beginner' },

  // ── POTENCIA ──
  { es: 'Cargada de fuerza', en: 'Power clean', group: 'power', bar: true, pattern: 'hinge', equipment: 'barbell', difficulty: 'advanced', secondary: ['legs', 'back'] },
  { es: 'Push press', en: 'Push press', group: 'power', bar: true, pattern: 'push', equipment: 'barbell', difficulty: 'intermediate', secondary: ['legs', 'shoulders'] },
  { es: 'Tirón de cargada', en: 'Clean pull', group: 'power', bar: true, pattern: 'hinge', equipment: 'barbell', difficulty: 'advanced', secondary: ['back', 'legs'] },
  { es: 'Balanceo con kettlebell', en: 'Kettlebell swing', group: 'power', weightMode: 'per_dumbbell', pattern: 'hinge', equipment: 'kettlebell', fighter: true, difficulty: 'intermediate', secondary: ['legs', 'core'] },
  { es: 'Salto al cajón', en: 'Box jump', group: 'power', weightMode: 'bodyweight', pattern: 'jump', equipment: 'bodyweight', fighter: true, difficulty: 'beginner', secondary: ['legs'] },
  { es: 'Sentadilla con salto', en: 'Jump squat', group: 'power', weightMode: 'bodyweight', pattern: 'jump', equipment: 'bodyweight', fighter: true, difficulty: 'intermediate', secondary: ['legs'] },
  { es: 'Zancada con salto', en: 'Jumping lunge', group: 'power', weightMode: 'bodyweight', pattern: 'jump', equipment: 'bodyweight', unilateral: true, fighter: true, difficulty: 'intermediate', secondary: ['legs'] },
  { es: 'Salto lateral', en: 'Lateral bound', group: 'power', weightMode: 'bodyweight', pattern: 'jump', equipment: 'bodyweight', unilateral: true, fighter: true, difficulty: 'intermediate', secondary: ['legs', 'core'] },
  { es: 'Salto horizontal', en: 'Broad jump', group: 'power', weightMode: 'bodyweight', pattern: 'jump', equipment: 'bodyweight', fighter: true, difficulty: 'intermediate', secondary: ['legs'] },
  { es: 'Golpe de balón medicinal', en: 'Medicine ball slam', group: 'power', weightMode: 'bodyweight', pattern: 'rotation', equipment: 'ball', fighter: true, difficulty: 'beginner', secondary: ['core'] },
  { es: 'Lanzamiento de balón medicinal', en: 'Medicine ball throw', group: 'power', weightMode: 'bodyweight', pattern: 'rotation', equipment: 'ball', fighter: true, difficulty: 'beginner', secondary: ['core'] },
  { es: 'Lanzamiento rotacional con balón', en: 'Rotational med ball throw', group: 'power', weightMode: 'bodyweight', pattern: 'rotation', equipment: 'ball', unilateral: true, fighter: true, difficulty: 'intermediate', secondary: ['core'] },
  { es: 'Empuje de trineo', en: 'Sled push', group: 'power', trackingMode: 'distance', pattern: 'carry', equipment: 'sled', fighter: true, difficulty: 'intermediate', secondary: ['legs', 'core'] },
  { es: 'Arrastre de trineo', en: 'Sled pull', group: 'power', trackingMode: 'distance', pattern: 'carry', equipment: 'sled', fighter: true, difficulty: 'intermediate', secondary: ['legs', 'back'] },

  // ── FULL BODY ──
  { es: 'Thruster', en: 'Thruster', group: 'full_body', bar: true, pattern: 'squat', equipment: 'barbell', difficulty: 'intermediate', secondary: ['shoulders', 'legs'] },
  { es: 'Burpee', en: 'Burpee', group: 'full_body', weightMode: 'bodyweight', pattern: 'jump', equipment: 'bodyweight', fighter: true, difficulty: 'beginner', secondary: ['chest', 'legs'] },
  { es: 'Cargada y press', en: 'Clean and press', group: 'full_body', bar: true, pattern: 'hinge', equipment: 'barbell', difficulty: 'advanced', secondary: ['shoulders', 'legs'] },
  { es: 'Arrancada', en: 'Snatch', group: 'full_body', bar: true, pattern: 'hinge', equipment: 'barbell', difficulty: 'advanced', secondary: ['shoulders', 'legs'] },
  { es: 'Man maker', en: 'Man maker', group: 'full_body', weightMode: 'per_side', pattern: 'push', equipment: 'dumbbell', difficulty: 'advanced', secondary: ['back', 'chest'] },
  { es: 'Wall ball', en: 'Wall ball', group: 'full_body', weightMode: 'total', pattern: 'squat', equipment: 'ball', difficulty: 'beginner', secondary: ['shoulders', 'legs'] },
  { es: 'Levantada turca', en: 'Turkish get-up', group: 'full_body', weightMode: 'per_side', pattern: 'carry', equipment: 'kettlebell', unilateral: true, fighter: true, difficulty: 'advanced', secondary: ['core', 'shoulders'] },
  { es: 'Devil press', en: 'Devil press', group: 'full_body', weightMode: 'per_side', pattern: 'hinge', equipment: 'dumbbell', difficulty: 'advanced', secondary: ['shoulders', 'chest'] },
  { es: 'Peso muerto con remo', en: 'Renegade row', group: 'full_body', weightMode: 'per_side', pattern: 'pull', equipment: 'dumbbell', unilateral: true, difficulty: 'advanced', secondary: ['core', 'back'] },

  // ══════════════════════════════════════════════════════════════
  // REPERTORIO DE PELEADOR
  //
  // Lo que se entrena en un gimnasio de combate o en un campamento: una barra
  // de dominadas, el suelo, unas cuerdas, un neumático y poco más. Mucha gente
  // que compite no pisa una sala de máquinas, y hasta ahora la biblioteca
  // estaba escrita para quien sí.
  //
  // Va DENTRO de la misma lista, con los mismos metadatos y marcado con
  // `fighter: true`, no en un catálogo aparte. Así funciona igual en el
  // registro, en el dictado por voz, en las rutinas preescritas y en el
  // planificador — y no hay dos listas que mantener en paralelo.
  // ══════════════════════════════════════════════════════════════

  // ── Barra de dominadas y tracción con el propio peso ──
  { es: 'Dominadas supinas', en: 'Chin-ups', group: 'back', weightMode: 'bodyweight', pattern: 'pull', equipment: 'bodyweight', fighter: true, difficulty: 'intermediate', secondary: ['biceps', 'core'] },
  { es: 'Dominadas agarre ancho', en: 'Wide-grip pull-ups', group: 'back', weightMode: 'bodyweight', pattern: 'pull', equipment: 'bodyweight', fighter: true, difficulty: 'advanced', secondary: ['biceps'] },
  { es: 'Dominadas agarre neutro', en: 'Neutral-grip pull-ups', group: 'back', weightMode: 'bodyweight', pattern: 'pull', equipment: 'bodyweight', fighter: true, difficulty: 'intermediate', secondary: ['biceps'] },
  { es: 'Dominadas en toalla', en: 'Towel pull-ups', group: 'back', weightMode: 'bodyweight', pattern: 'pull', equipment: 'bodyweight', fighter: true, difficulty: 'advanced', secondary: ['biceps', 'core'] },
  { es: 'Remo australiano', en: 'Inverted row', group: 'back', weightMode: 'bodyweight', pattern: 'pull', equipment: 'bodyweight', fighter: true, difficulty: 'beginner', secondary: ['biceps', 'core'] },
  { es: 'Trepa de cuerda', en: 'Rope climb', group: 'back', weightMode: 'bodyweight', pattern: 'pull', equipment: 'rope', fighter: true, difficulty: 'advanced', secondary: ['biceps', 'core'] },
  { es: 'Colgarse de la barra', en: 'Dead hang', group: 'back', weightMode: 'bodyweight', trackingMode: 'time', pattern: 'pull', equipment: 'bodyweight', fighter: true, difficulty: 'beginner', secondary: ['core'] },

  // ── Empuje con el propio peso ──
  { es: 'Flexiones hindúes', en: 'Hindu push-ups', group: 'chest', weightMode: 'bodyweight', pattern: 'push', equipment: 'bodyweight', fighter: true, difficulty: 'intermediate', secondary: ['shoulders', 'triceps'] },
  { es: 'Flexiones con pies elevados', en: 'Feet-elevated push-ups', group: 'chest', weightMode: 'bodyweight', pattern: 'push', equipment: 'bodyweight', fighter: true, difficulty: 'intermediate', secondary: ['shoulders', 'triceps'] },
  { es: 'Flexiones diamante', en: 'Diamond push-ups', group: 'triceps', weightMode: 'bodyweight', pattern: 'push', equipment: 'bodyweight', fighter: true, difficulty: 'intermediate', secondary: ['chest', 'shoulders'] },
  { es: 'Flexiones en pica', en: 'Pike push-ups', group: 'shoulders', weightMode: 'bodyweight', pattern: 'push', equipment: 'bodyweight', fighter: true, difficulty: 'intermediate', secondary: ['triceps', 'core'] },
  { es: 'Flexiones en vertical', en: 'Handstand push-ups', group: 'shoulders', weightMode: 'bodyweight', pattern: 'push', equipment: 'bodyweight', fighter: true, difficulty: 'advanced', secondary: ['triceps', 'core'] },

  // ── Hombro de asalto: sostener la guardia arriba hasta el final ──
  { es: 'Sombra con mancuernas', en: 'Shadow boxing with dumbbells', group: 'shoulders', weightMode: 'per_dumbbell', trackingMode: 'time', pattern: 'push', equipment: 'dumbbell', fighter: true, difficulty: 'beginner', secondary: ['core'] },
  { es: 'Círculos con cuerdas', en: 'Battle rope circles', group: 'shoulders', weightMode: 'bodyweight', trackingMode: 'time', pattern: 'rotation', equipment: 'rope', fighter: true, difficulty: 'intermediate', secondary: ['core'] },

  // ── Pierna sin máquinas ──
  { es: 'Sentadilla hindú', en: 'Hindu squat', group: 'legs', weightMode: 'bodyweight', pattern: 'squat', equipment: 'bodyweight', fighter: true, difficulty: 'beginner', secondary: ['core'] },
  { es: 'Sentadilla a una pierna', en: 'Pistol squat', group: 'legs', weightMode: 'bodyweight', pattern: 'squat', equipment: 'bodyweight', unilateral: true, fighter: true, difficulty: 'advanced', secondary: ['core'] },
  { es: 'Sentadilla isométrica en pared', en: 'Wall sit', group: 'legs', weightMode: 'bodyweight', trackingMode: 'time', pattern: 'squat', equipment: 'bodyweight', fighter: true, difficulty: 'beginner' },
  { es: 'Andar en cuclillas', en: 'Duck walk', group: 'legs', weightMode: 'bodyweight', trackingMode: 'distance', pattern: 'squat', equipment: 'bodyweight', fighter: true, difficulty: 'intermediate', secondary: ['core'] },
  { es: 'Saltos de rana', en: 'Frog jumps', group: 'legs', weightMode: 'bodyweight', pattern: 'jump', equipment: 'bodyweight', fighter: true, difficulty: 'intermediate', secondary: ['core'] },

  // ── Core que aguanta el impacto y gira ──
  { es: 'Limpiaparabrisas', en: 'Windshield wipers', group: 'core', weightMode: 'bodyweight', pattern: 'rotation', equipment: 'bodyweight', fighter: true, difficulty: 'advanced', secondary: ['back'] },
  { es: 'Abdominales en V', en: 'V-ups', group: 'core', weightMode: 'bodyweight', pattern: 'isolation', equipment: 'bodyweight', fighter: true, difficulty: 'intermediate' },
  { es: 'Plancha con toque de hombro', en: 'Shoulder tap plank', group: 'core', weightMode: 'bodyweight', trackingMode: 'time', pattern: 'antirotation', equipment: 'bodyweight', fighter: true, difficulty: 'beginner', secondary: ['shoulders'] },
  { es: 'Bicho muerto', en: 'Dead bug', group: 'core', weightMode: 'bodyweight', pattern: 'antirotation', equipment: 'bodyweight', fighter: true, difficulty: 'beginner' },
  { es: 'Perro-pájaro', en: 'Bird dog', group: 'core', weightMode: 'bodyweight', pattern: 'antirotation', equipment: 'bodyweight', unilateral: true, fighter: true, difficulty: 'beginner', secondary: ['back'] },
  { es: 'Rotación en landmine', en: 'Landmine rotation', group: 'core', pattern: 'rotation', equipment: 'barbell', fighter: true, difficulty: 'intermediate', secondary: ['shoulders'] },
  { es: 'Sit-up con balón medicinal', en: 'Med ball sit-up throw', group: 'core', pattern: 'isolation', equipment: 'ball', fighter: true, difficulty: 'intermediate', secondary: ['shoulders'] },
  { es: 'Isométrico lateral de cuello', en: 'Lateral neck isometric', group: 'core', weightMode: 'bodyweight', trackingMode: 'time', pattern: 'antirotation', equipment: 'bodyweight', unilateral: true, fighter: true, difficulty: 'beginner' },
  { es: 'Cuello con banda', en: 'Banded neck work', group: 'core', trackingMode: 'time', pattern: 'antirotation', equipment: 'band', fighter: true, difficulty: 'intermediate' },
  { es: 'Puente de lucha', en: "Wrestler's bridge", group: 'core', weightMode: 'bodyweight', trackingMode: 'time', pattern: 'antirotation', equipment: 'bodyweight', fighter: true, difficulty: 'advanced', secondary: ['back'] },

  // ── Potencia y golpeo ──
  { es: 'Flexión pliométrica', en: 'Plyo push-up', group: 'power', weightMode: 'bodyweight', pattern: 'jump', equipment: 'bodyweight', fighter: true, difficulty: 'intermediate', secondary: ['chest', 'triceps'] },
  { es: 'Flexiones con palmada', en: 'Clapping push-ups', group: 'power', weightMode: 'bodyweight', pattern: 'jump', equipment: 'bodyweight', fighter: true, difficulty: 'advanced', secondary: ['chest', 'triceps'] },
  { es: 'Salto en profundidad', en: 'Depth jump', group: 'power', weightMode: 'bodyweight', pattern: 'jump', equipment: 'bodyweight', fighter: true, difficulty: 'advanced', secondary: ['legs'] },
  { es: 'Mazo sobre neumático', en: 'Sledgehammer strikes', group: 'power', trackingMode: 'time', pattern: 'rotation', equipment: 'odd', unilateral: true, fighter: true, difficulty: 'intermediate', secondary: ['core', 'back'] },
  { es: 'Volteo de neumático', en: 'Tyre flip', group: 'power', pattern: 'hinge', equipment: 'odd', fighter: true, difficulty: 'advanced', secondary: ['legs', 'back'] },
  { es: 'Olas alternas con cuerdas', en: 'Alternating rope waves', group: 'power', weightMode: 'bodyweight', trackingMode: 'time', pattern: 'push', equipment: 'rope', fighter: true, difficulty: 'beginner', secondary: ['shoulders', 'core'] },
  { es: 'Olas dobles con cuerdas', en: 'Double rope waves', group: 'power', weightMode: 'bodyweight', trackingMode: 'time', pattern: 'push', equipment: 'rope', fighter: true, difficulty: 'intermediate', secondary: ['shoulders', 'core'] },
  { es: 'Latigazo con cuerdas', en: 'Rope slams', group: 'power', weightMode: 'bodyweight', trackingMode: 'time', pattern: 'hinge', equipment: 'rope', fighter: true, difficulty: 'intermediate', secondary: ['core', 'back'] },
  { es: 'Golpeo con banda', en: 'Banded punch', group: 'power', trackingMode: 'time', pattern: 'rotation', equipment: 'band', unilateral: true, fighter: true, difficulty: 'beginner', secondary: ['chest', 'core'] },

  // ── Suelo y desplazamiento ──
  { es: 'Oso caminando', en: 'Bear crawl', group: 'full_body', weightMode: 'bodyweight', trackingMode: 'distance', pattern: 'carry', equipment: 'bodyweight', fighter: true, difficulty: 'beginner', secondary: ['core', 'shoulders'] },
  { es: 'Sprawl', en: 'Sprawl', group: 'full_body', weightMode: 'bodyweight', pattern: 'jump', equipment: 'bodyweight', fighter: true, difficulty: 'beginner', secondary: ['core', 'legs'] },
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

/**
 * Nombres por los que se puede RECONOCER cada ejercicio al dictar.
 *
 * Nadie dice "jalón al pecho abre paréntesis polea cierra paréntesis". Al
 * desdoblar la biblioteca en variantes por equipo, buscar el nombre completo
 * dentro de lo dictado dejó de encontrar nada: el usuario dice "jalón al
 * pecho" y en la biblioteca pone "Jalón al pecho (polea)".
 *
 * Cada entrada devuelve varias formas de llamarla:
 *   · el nombre completo tal cual
 *   · el nombre SIN el paréntesis del equipo
 *   · sus alias (los nombres antiguos)
 *   · el nombre en el otro idioma, por si se mezcla
 *
 * Cuando dos variantes comparten forma corta ("jalón al pecho" lo comparten
 * polea y máquina guiada), gana la PRIMERA de la biblioteca, que está ordenada
 * poniendo delante la variante más habitual. Los alias apuntan a esa misma, así
 * que el resultado es el que espera el usuario.
 */
export function exerciseDictationTerms(lang: Lang): { label: string; terms: string[] }[] {
  const taken = new Set<string>();
  return EXERCISE_LIBRARY.map((e) => {
    const label = exLabel(e, lang);
    const candidates = [
      label,
      label.replace(/\s*\([^)]*\)\s*/g, ' ').trim(),
      ...(e.aliases || []),
      e.es, e.en,
      e.es.replace(/\s*\([^)]*\)\s*/g, ' ').trim(),
      e.en.replace(/\s*\([^)]*\)\s*/g, ' ').trim(),
    ];
    const terms: string[] = [];
    candidates.forEach((c) => {
      const k = normNoAccent(c);
      // Se descartan las formas de 3 letras o menos: "v", "z" y demás casarían
      // con medio texto y el dictado empezaría a inventarse ejercicios.
      if (!k || k.length <= 3 || taken.has(k)) return;
      taken.add(k);
      terms.push(c);
    });
    return { label, terms };
  }).filter((e) => e.terms.length > 0);
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
  // Primero los nombres canónicos, para que un alias nunca pise a un nombre
  // real (p. ej. "Hip thrust" es alias de la variante con barra, pero si algún
  // día existiera un ejercicio llamado así, mandaría el canónico).
  EXERCISE_LIBRARY.forEach((e) => { m.set(normNoAccent(e.es), e); m.set(normNoAccent(e.en), e); });
  EXERCISE_LIBRARY.forEach((e) => {
    (e.aliases || []).forEach((a) => {
      const k = normNoAccent(a);
      if (!m.has(k)) m.set(k, e);
    });
  });
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
  /** Zona dentro del grupo: tirón vertical, femoral, dorsal aislado… */
  focus?: string | 'all';
  /** true = solo unilaterales. undefined/false = no filtra. */
  unilateralOnly?: boolean;
  /** true = solo repertorio de peleador. undefined/false = no filtra. */
  fighterOnly?: boolean;
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
    if (f.focus && f.focus !== 'all' && FOCUS[e.en.toLowerCase()] !== f.focus) return false;
    if (f.difficulty && f.difficulty !== 'all' && e.difficulty !== f.difficulty) return false;
    if (f.unilateralOnly && !e.unilateral) return false;
    if (f.fighterOnly && !e.fighter) return false;
    if (needle && !normNoAccent(e.es).includes(needle) && !normNoAccent(e.en).includes(needle)) return false;
    return true;
  });
}

/** ¿Este ejercicio es del repertorio de peleador? */
export function isFighterExercise(nameOrKey: string): boolean {
  return libExerciseOf(nameOrKey)?.fighter === true;
}

/** Cuántos ejercicios del repertorio de peleador hay. Para el contador del filtro. */
export function fighterExerciseCount(): number {
  return EXERCISE_LIBRARY.filter((e) => e.fighter).length;
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

// ── ZONA / ENFOQUE dentro del grupo muscular ──
//
// Con 165 ejercicios, filtrar solo por "espalda" devuelve 30 y encontrar el que
// buscas cuesta más que antes. Este eje parte cada grupo por DÓNDE trabaja o en
// qué dirección tira, que es como se piensa en el gimnasio: "hoy toca tirón
// vertical", "quiero algo de dorsal aislado", "me falta femoral".
//
// No es una opinión sobre qué es mejor: es la dirección del movimiento y la
// región que carga. Un ejercicio sin clasificar simplemente no se filtra.
export type ExerciseFocus =
  // Espalda
  | 'vertical_pull' | 'horizontal_pull' | 'lat_isolation' | 'upper_back'
  // Pecho
  | 'chest_upper' | 'chest_mid' | 'chest_lower' | 'chest_isolation'
  // Hombro
  | 'delt_front' | 'delt_side' | 'delt_rear' | 'rotator' | 'traps'
  // Brazo
  | 'curl_standard' | 'curl_stretch' | 'curl_peak' | 'curl_forearm'
  | 'tri_pushdown' | 'tri_overhead' | 'tri_compound'
  // Pierna
  | 'quad' | 'hamstring' | 'glute' | 'calf' | 'adductor' | 'abductor'
  // Core
  | 'anti_extension' | 'anti_rotation' | 'rotation' | 'flexion' | 'carry'
  // Compartido
  | 'hinge';

/** Clave inglesa del ejercicio → zona. Lo que no aparece, no se clasifica. */
const FOCUS: Record<string, ExerciseFocus> = {
  // ESPALDA
  'pull-ups': 'vertical_pull',
  'weighted pull-ups': 'vertical_pull',
  'assisted pull-up (machine)': 'vertical_pull',
  'lat pulldown (cable)': 'vertical_pull',
  'lat pulldown (plate-loaded machine)': 'vertical_pull',
  'v-bar pulldown (cable)': 'vertical_pull',
  'close-grip pulldown (cable)': 'vertical_pull',
  'neutral-grip pulldown (cable)': 'vertical_pull',
  'single-arm pulldown (cable)': 'vertical_pull',
  'barbell row': 'horizontal_pull',
  'dumbbell row': 'horizontal_pull',
  'two-dumbbell row': 'horizontal_pull',
  't-bar row': 'horizontal_pull',
  'seated cable row': 'horizontal_pull',
  'wide-grip cable row': 'horizontal_pull',
  'machine row': 'horizontal_pull',
  'chest-supported row (machine)': 'horizontal_pull',
  'chest-supported dumbbell row': 'horizontal_pull',
  'smith machine row': 'horizontal_pull',
  'single-arm cable row': 'horizontal_pull',
  'straight-arm pulldown': 'lat_isolation',
  'machine pullover': 'lat_isolation',
  'face pull': 'upper_back',
  'barbell shrug': 'traps',
  'dumbbell shrug': 'traps',
  'machine shrug': 'traps',
  deadlift: 'hinge',
  'romanian deadlift': 'hinge',
  'dumbbell romanian deadlift': 'hinge',
  'back extension': 'hinge',

  // PECHO
  'incline barbell press': 'chest_upper',
  'incline dumbbell press': 'chest_upper',
  'incline machine press': 'chest_upper',
  'low-to-high cable crossover': 'chest_upper',
  'incline dumbbell fly': 'chest_upper',
  'barbell bench press': 'chest_mid',
  'dumbbell bench press': 'chest_mid',
  'machine chest press': 'chest_mid',
  'smith machine bench press': 'chest_mid',
  'push-ups': 'chest_mid',
  'single-arm cable press': 'chest_mid',
  'decline barbell press': 'chest_lower',
  'decline machine press': 'chest_lower',
  'chest dips': 'chest_lower',
  'high-to-low cable crossover': 'chest_lower',
  'dumbbell fly': 'chest_isolation',
  'cable fly': 'chest_isolation',
  'pec deck': 'chest_isolation',
  'dumbbell pullover': 'chest_isolation',

  // HOMBRO
  'overhead barbell press': 'delt_front',
  'dumbbell shoulder press': 'delt_front',
  'machine shoulder press': 'delt_front',
  'smith machine shoulder press': 'delt_front',
  'arnold press': 'delt_front',
  'landmine press': 'delt_front',
  'dumbbell front raise': 'delt_front',
  'cable front raise': 'delt_front',
  'dumbbell lateral raise': 'delt_side',
  'cable lateral raise': 'delt_side',
  'single-arm cable lateral raise': 'delt_side',
  'machine lateral raise': 'delt_side',
  'barbell upright row': 'delt_side',
  'cable upright row': 'delt_side',
  'dumbbell rear delt fly': 'delt_rear',
  'reverse pec deck': 'delt_rear',
  'cable rear delt fly': 'delt_rear',
  'y-raise': 'delt_rear',
  'band external rotation': 'rotator',
  'cable external rotation': 'rotator',

  // BÍCEPS
  'barbell curl': 'curl_standard',
  'ez-bar curl': 'curl_standard',
  'dumbbell curl': 'curl_standard',
  'cable curl': 'curl_standard',
  'incline dumbbell curl': 'curl_stretch',
  'ez-bar preacher curl': 'curl_peak',
  'machine preacher curl': 'curl_peak',
  'concentration curl': 'curl_peak',
  'spider curl': 'curl_peak',
  'hammer curl': 'curl_forearm',
  'rope hammer curl (cable)': 'curl_forearm',
  'reverse barbell curl': 'curl_forearm',

  // TRÍCEPS
  'triceps pushdown (bar)': 'tri_pushdown',
  'rope pushdown': 'tri_pushdown',
  'machine triceps extension': 'tri_pushdown',
  'single-arm cable pushdown': 'tri_pushdown',
  'reverse-grip pushdown': 'tri_pushdown',
  'triceps kickback': 'tri_pushdown',
  'ez-bar skull crusher': 'tri_overhead',
  'dumbbell skull crusher': 'tri_overhead',
  'overhead triceps extension': 'tri_overhead',
  'single-arm overhead extension': 'tri_overhead',
  'bench dips': 'tri_compound',
  'assisted dips': 'tri_compound',
  'close-grip bench press': 'tri_compound',

  // PIERNA
  'barbell squat': 'quad',
  'front squat': 'quad',
  'smith machine squat': 'quad',
  'hack squat (machine)': 'quad',
  'goblet squat': 'quad',
  'leg press': 'quad',
  'horizontal leg press': 'quad',
  'leg extension': 'quad',
  'dumbbell bulgarian split squat': 'glute',
  'barbell bulgarian split squat': 'glute',
  'dumbbell lunges': 'glute',
  'barbell lunges': 'glute',
  'walking lunge (loaded)': 'glute',
  'step-up': 'glute',
  'barbell hip thrust': 'glute',
  'machine hip thrust': 'glute',
  'glute bridge': 'glute',
  'cable glute kickback': 'glute',
  'lying leg curl': 'hamstring',
  'seated leg curl': 'hamstring',
  'nordic curl': 'hamstring',
  'single-leg deadlift': 'hamstring',
  'sumo deadlift': 'hinge',
  'standing calf raise': 'calf',
  'seated calf raise': 'calf',
  'calf press on leg press': 'calf',
  'tibialis raise': 'calf',
  'hip abduction': 'abductor',
  'hip adduction': 'adductor',
  "farmer's walk": 'carry',

  // CORE
  plank: 'anti_extension',
  'hollow hold': 'anti_extension',
  'ab wheel': 'anti_extension',
  'side plank': 'anti_rotation',
  'pallof press': 'anti_rotation',
  'neck isometric hold': 'anti_rotation',
  'cable chop (high to low)': 'rotation',
  'cable lift (low to high)': 'rotation',
  'cable rotation': 'rotation',
  'russian twist': 'rotation',
  'leg raise': 'flexion',
  'hanging knee raise': 'flexion',
  'hanging leg raise': 'flexion',
  crunch: 'flexion',
  'cable crunch': 'flexion',
  'machine crunch': 'flexion',
  'mountain climbers': 'flexion',
  'suitcase carry': 'carry',

  // ── REPERTORIO DE PELEADOR ──
  // Se clasifica igual que el resto: la zona no depende de dónde entrenes.
  'chin-ups': 'vertical_pull',
  'wide-grip pull-ups': 'vertical_pull',
  'neutral-grip pull-ups': 'vertical_pull',
  'towel pull-ups': 'vertical_pull',
  'rope climb': 'vertical_pull',
  'dead hang': 'vertical_pull',
  'inverted row': 'horizontal_pull',
  'hindu push-ups': 'chest_mid',
  'feet-elevated push-ups': 'chest_upper',
  'diamond push-ups': 'tri_compound',
  'pike push-ups': 'delt_front',
  'handstand push-ups': 'delt_front',
  'shadow boxing with dumbbells': 'delt_side',
  'battle rope circles': 'delt_side',
  'hindu squat': 'quad',
  'pistol squat': 'quad',
  'wall sit': 'quad',
  'duck walk': 'quad',
  'frog jumps': 'quad',
  'windshield wipers': 'rotation',
  'v-ups': 'flexion',
  'shoulder tap plank': 'anti_rotation',
  'dead bug': 'anti_extension',
  'bird dog': 'anti_rotation',
  'landmine rotation': 'rotation',
  'med ball sit-up throw': 'flexion',
  'lateral neck isometric': 'anti_rotation',
  'banded neck work': 'anti_rotation',
  "wrestler's bridge": 'anti_extension',
};

/** Zona del ejercicio, o null si no está clasificado. */
export function focusOf(nameOrKey: string): ExerciseFocus | null {
  const e = libExerciseOf(nameOrKey);
  return e ? (FOCUS[e.en.toLowerCase()] ?? null) : null;
}

/**
 * Zonas disponibles dentro de un grupo, en el orden en que aparecen. Sirve para
 * pintar solo las pastillas que tienen ejercicios: filtrar "espalda" ofrece
 * tirón vertical / horizontal / dorsal / trapecio, y nada más.
 */
export function focusesForGroup(group: MuscleGroup | 'all'): ExerciseFocus[] {
  const out: ExerciseFocus[] = [];
  EXERCISE_LIBRARY.forEach((e) => {
    if (group !== 'all' && e.group !== group) return;
    const f = FOCUS[e.en.toLowerCase()];
    if (f && !out.includes(f)) out.push(f);
  });
  return out;
}
