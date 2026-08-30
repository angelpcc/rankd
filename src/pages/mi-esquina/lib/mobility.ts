// Rutinas de movilidad y estiramientos (Fuerza · nivel 2).
//
// Contenido de CONSULTA: no se registra por serie/reps, solo se marca "hecho
// hoy" (tick simple, en localStorage — sin migración). Cada movimiento lleva
// segundos, reutilizando la idea de tracking_mode 'time' de la sección de
// fuerza pero sin tocar la BD.
//
// Bilingüe en línea (mismo patrón que exerciseTechnique.ts): es texto de
// contenido, no chrome de UI.

export type MobilityZone =
  | 'shoulder' | 'hip' | 'legs' | 'ankle' | 'warmup' | 'cooldown';

interface Bi { es: string; en: string }
const bi = (es: string, en: string): Bi => ({ es, en });

export interface MobilityMove {
  name: Bi;
  /** Duración sugerida en segundos (por lado si el movimiento es unilateral). */
  seconds: number;
  /** Indicación breve de ejecución. */
  cue: Bi;
  /** true si se hace por lado (la duración es por lado). */
  perSide?: boolean;
}

export interface MobilityRoutine {
  id: MobilityZone;
  title: Bi;
  subtitle: Bi;
  icon: string;
  moves: MobilityMove[];
}

export const MOBILITY_ROUTINES: MobilityRoutine[] = [
  {
    id: 'shoulder',
    title: bi('Movilidad de hombro', 'Shoulder mobility'),
    subtitle: bi('Antes de empujar o pegar por arriba', 'Before pressing or throwing overhand'),
    icon: 'ri-body-scan-line',
    moves: [
      { name: bi('Círculos de brazo', 'Arm circles'), seconds: 30, cue: bi('Adelante y atrás, amplitud creciente', 'Forward and back, growing range') },
      { name: bi('Dislocaciones con banda o palo', 'Band/stick pass-throughs'), seconds: 40, cue: bi('Brazos rectos, agarre ancho, sin forzar', 'Straight arms, wide grip, no forcing') },
      { name: bi('Estiramiento cruzado de hombro', 'Cross-body shoulder stretch'), seconds: 30, cue: bi('Lleva el brazo al pecho con el otro', 'Pull the arm across with the other'), perSide: true },
      { name: bi('Rotación externa en pared', 'Wall external rotation'), seconds: 30, cue: bi('Codo pegado al costado, gira el antebrazo', 'Elbow to your side, rotate the forearm'), perSide: true },
      { name: bi('Cat-cow torácico', 'Thoracic cat-cow'), seconds: 40, cue: bi('Mueve solo la parte alta de la espalda', 'Move only the upper back') },
    ],
  },
  {
    id: 'hip',
    title: bi('Movilidad de cadera', 'Hip mobility'),
    subtitle: bi('Para patadas, rodillazos y sentadilla', 'For kicks, knees and squatting'),
    icon: 'ri-walk-line',
    moves: [
      { name: bi('Círculos de cadera de pie', 'Standing hip circles'), seconds: 30, cue: bi('Rodilla arriba y abre en círculo', 'Knee up, sweep it open'), perSide: true },
      { name: bi('Zancada con rotación', 'Lunge with rotation'), seconds: 40, cue: bi('Baja a zancada y gira hacia la pierna de delante', 'Drop to a lunge and rotate toward the front leg'), perSide: true },
      { name: bi('Estiramiento 90/90', '90/90 hip stretch'), seconds: 40, cue: bi('Ambas rodillas a 90°, cambia de lado', 'Both knees at 90°, switch sides'), perSide: true },
      { name: bi('Puente de glúteo', 'Glute bridge'), seconds: 40, cue: bi('Aprieta glúteo arriba, sin arquear lumbar', 'Squeeze glutes at the top, no low-back arch') },
      { name: bi('Sentadilla profunda sostenida', 'Deep squat hold'), seconds: 45, cue: bi('Talones en el suelo, pecho alto', 'Heels down, chest tall') },
    ],
  },
  {
    id: 'legs',
    title: bi('Estiramiento de piernas', 'Leg stretch'),
    subtitle: bi('Isquios, cuádriceps y gemelos', 'Hamstrings, quads and calves'),
    icon: 'ri-run-line',
    moves: [
      { name: bi('Estiramiento de isquios de pie', 'Standing hamstring stretch'), seconds: 30, cue: bi('Espalda recta, baja desde la cadera', 'Flat back, hinge from the hip'), perSide: true },
      { name: bi('Estiramiento de cuádriceps de pie', 'Standing quad stretch'), seconds: 30, cue: bi('Rodillas juntas, tira del tobillo atrás', 'Knees together, pull the ankle back'), perSide: true },
      { name: bi('Estiramiento de gemelo en pared', 'Wall calf stretch'), seconds: 30, cue: bi('Talón en el suelo, pierna de atrás recta', 'Heel down, back leg straight'), perSide: true },
      { name: bi('Mariposa sentado', 'Seated butterfly'), seconds: 40, cue: bi('Plantas de los pies juntas, espalda recta', 'Soles together, back tall') },
      { name: bi('Estiramiento de aductores', 'Adductor stretch'), seconds: 30, cue: bi('Zancada lateral, peso a un lado', 'Side lunge, shift weight to one side'), perSide: true },
    ],
  },
  {
    id: 'ankle',
    title: bi('Movilidad de tobillo', 'Ankle mobility'),
    subtitle: bi('Base para pisar, girar y salir', 'Base for stepping, pivoting and exits'),
    icon: 'ri-footprint-line',
    moves: [
      { name: bi('Círculos de tobillo', 'Ankle circles'), seconds: 30, cue: bi('Amplios y lentos, ambos sentidos', 'Wide and slow, both directions'), perSide: true },
      { name: bi('Rodilla a la pared', 'Knee-to-wall'), seconds: 40, cue: bi('Talón fijo, empuja la rodilla hacia la pared', 'Heel down, drive the knee toward the wall'), perSide: true },
      { name: bi('Elevaciones de talón', 'Calf raises'), seconds: 40, cue: bi('Sube y baja controlado, rango completo', 'Up and down controlled, full range') },
      { name: bi('Caminar de puntillas', 'Toe walk'), seconds: 30, cue: bi('En el sitio, sobre la parte delantera del pie', 'On the spot, up on the balls of your feet') },
      { name: bi('Caminar sobre talones', 'Heel walk'), seconds: 30, cue: bi('Punta arriba, tobillo activo', 'Toes up, active ankle') },
    ],
  },
  {
    id: 'warmup',
    title: bi('Rutina completa pre-entreno', 'Full pre-training routine'),
    subtitle: bi('5-6 min para entrar en calor', '5-6 min to warm up'),
    icon: 'ri-fire-line',
    moves: [
      { name: bi('Saltar a la comba suave', 'Easy jump rope'), seconds: 60, cue: bi('Ritmo cómodo, solo para activar', 'Comfortable pace, just to switch on') },
      { name: bi('Círculos de brazo', 'Arm circles'), seconds: 30, cue: bi('Adelante y atrás', 'Forward and back') },
      { name: bi('Balanceos de pierna', 'Leg swings'), seconds: 30, cue: bi('Adelante-atrás y lateral', 'Front-back and side-to-side'), perSide: true },
      { name: bi('Zancada con rotación', 'Lunge with rotation'), seconds: 40, cue: bi('Abre el pecho hacia la pierna de delante', 'Open the chest toward the front leg'), perSide: true },
      { name: bi('Sentadilla al aire', 'Bodyweight squats'), seconds: 40, cue: bi('Rango completo, ritmo constante', 'Full range, steady tempo') },
      { name: bi('Sombra suave', 'Light shadow boxing'), seconds: 60, cue: bi('Golpes al 50%, mueve los pies', 'Punches at 50%, move your feet') },
    ],
  },
  {
    id: 'cooldown',
    title: bi('Rutina completa post-entreno', 'Full post-training routine'),
    subtitle: bi('4-5 min para bajar pulsaciones', '4-5 min to cool down'),
    icon: 'ri-heart-pulse-line',
    moves: [
      { name: bi('Respiración nasal lenta', 'Slow nasal breathing'), seconds: 60, cue: bi('Inhala 4, exhala 6, hombros abajo', 'In for 4, out for 6, shoulders down') },
      { name: bi('Estiramiento cruzado de hombro', 'Cross-body shoulder stretch'), seconds: 30, cue: bi('Sin rebotes', 'No bouncing'), perSide: true },
      { name: bi('Estiramiento de isquios de pie', 'Standing hamstring stretch'), seconds: 30, cue: bi('Baja desde la cadera', 'Hinge from the hip'), perSide: true },
      { name: bi('Estiramiento de cuádriceps de pie', 'Standing quad stretch'), seconds: 30, cue: bi('Rodillas juntas', 'Knees together'), perSide: true },
      { name: bi('Estiramiento de gemelo en pared', 'Wall calf stretch'), seconds: 30, cue: bi('Talón en el suelo', 'Heel down'), perSide: true },
      { name: bi('Postura del niño', "Child's pose"), seconds: 45, cue: bi('Cadera a los talones, brazos largos', 'Hips to heels, long arms') },
    ],
  },
];

// ── Tick "hecho hoy" en localStorage (sin BD) ──
const KEY = 'rankd_mobility_done';
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
type DoneMap = Record<string, string[]>; // fecha ISO → [zone,...]

function read(): DoneMap {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as DoneMap; } catch { return {}; }
}
export function mobilityDoneToday(): Set<MobilityZone> {
  const m = read();
  return new Set((m[todayISO()] || []) as MobilityZone[]);
}
export function toggleMobilityDone(zone: MobilityZone): Set<MobilityZone> {
  const m = read();
  const day = todayISO();
  const list = new Set(m[day] || []);
  if (list.has(zone)) list.delete(zone); else list.add(zone);
  m[day] = [...list];
  // Poda: quedarse solo con los últimos ~10 días.
  const days = Object.keys(m).sort().slice(-10);
  const pruned: DoneMap = {};
  days.forEach((d) => { pruned[d] = m[d]; });
  try { localStorage.setItem(KEY, JSON.stringify(pruned)); } catch { /* cuota */ }
  return list as Set<MobilityZone>;
}

export function routineSeconds(r: MobilityRoutine): number {
  return r.moves.reduce((a, m) => a + m.seconds * (m.perSide ? 2 : 1), 0);
}
