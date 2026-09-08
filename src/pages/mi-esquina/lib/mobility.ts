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

// ── Cómo se hace cada movimiento ──
//
// El `cue` de cada movimiento es un recordatorio de una línea, útil cuando ya
// sabes el ejercicio. Esto es la explicación para quien NO lo conoce: postura,
// recorrido y qué evitar.
//
// Va en un diccionario aparte y no dentro de cada `move` porque varios
// movimientos se repiten entre rutinas (el estiramiento de isquios está en
// piernas y en el post-entreno): así se escribe una sola vez y no pueden
// acabar diciendo cosas distintas.
//
// Clave: nombre en inglés, tal cual aparece en `name.en`.
export const MOBILITY_HOW: Record<string, Bi> = {
  'Arm circles': bi(
    'De pie con los brazos estirados a los lados. Haz círculos empezando pequeños y ampliándolos poco a poco, primero hacia delante y luego hacia atrás. Mantén los hombros bajos, sin encogerlos hacia las orejas.',
    'Stand with your arms straight out to the sides. Circle them starting small and growing wider, first forward and then backward. Keep the shoulders down, not shrugged toward your ears.',
  ),
  'Band/stick pass-throughs': bi(
    'Agarra una banda o un palo con las manos MUY separadas y los brazos estirados. Pásalo por encima de la cabeza hasta detrás de la espalda sin doblar los codos, y vuelve. Si no llegas, abre más el agarre: nunca fuerces el hombro.',
    'Hold a band or stick with your hands VERY wide and arms straight. Pass it overhead and behind your back without bending the elbows, then return. If you cannot reach, widen the grip: never force the shoulder.',
  ),
  'Cross-body shoulder stretch': bi(
    'Lleva un brazo estirado cruzando el pecho y sujétalo por encima del codo con la otra mano. Tira suave hacia el pecho manteniendo el hombro bajo. Aguanta sin rebotes; debe notarse un estiramiento, no dolor.',
    'Bring one straight arm across your chest and hold it above the elbow with the other hand. Pull gently toward your chest keeping the shoulder down. Hold without bouncing; it should feel like a stretch, not pain.',
  ),
  'Wall external rotation': bi(
    'De pie junto a una pared con el codo pegado al costado y doblado a 90 grados. Apoya el dorso de la mano en la pared y gira el antebrazo hacia fuera manteniendo el codo pegado. El codo no se separa en ningún momento.',
    'Stand beside a wall with your elbow tucked at your side and bent to 90 degrees. Rest the back of your hand on the wall and rotate the forearm outward keeping the elbow tucked. The elbow never leaves your side.',
  ),
  'Thoracic cat-cow': bi(
    'A cuatro patas con las manos bajo los hombros y las rodillas bajo la cadera. Redondea la parte ALTA de la espalda hacia el techo y luego húndela sacando pecho. Mueve solo la zona entre los omóplatos, no la lumbar.',
    'On all fours with hands under the shoulders and knees under the hips. Round the UPPER back toward the ceiling, then let it sink opening the chest. Move only the area between the shoulder blades, not the lower back.',
  ),
  'Standing hip circles': bi(
    'De pie, sujétate a algo si lo necesitas. Sube una rodilla hasta la altura de la cadera y ábrela describiendo un círculo hacia fuera, luego devuélvela. El tronco se queda quieto: solo se mueve la pierna.',
    'Standing, hold something for balance if needed. Lift one knee to hip height and sweep it open in a circle, then bring it back. The torso stays still: only the leg moves.',
  ),
  'Lunge with rotation': bi(
    'Da un paso largo al frente y baja a zancada con la rodilla de atrás cerca del suelo. Apoya la mano del lado contrario en el suelo y gira el tronco abriendo el otro brazo hacia el techo. Mira la mano que sube.',
    'Take a long step forward and drop into a lunge with the back knee near the floor. Place the opposite hand on the floor and rotate the torso opening the other arm toward the ceiling. Follow the rising hand with your eyes.',
  ),
  '90/90 hip stretch': bi(
    'Sentado en el suelo con la pierna de delante doblada a 90 grados hacia fuera y la de atrás a 90 grados hacia el lado. Con la espalda recta, inclínate despacio sobre la pierna de delante. Cambia de lado sin usar las manos si puedes.',
    'Seated on the floor with the front leg bent 90 degrees in front and the back leg 90 degrees to the side. With a tall back, lean slowly over the front leg. Switch sides without using your hands if you can.',
  ),
  'Glute bridge': bi(
    'Túmbate boca arriba con las rodillas dobladas y los pies apoyados a la anchura de la cadera. Empuja con los talones y sube la cadera hasta alinear tronco y muslos. Aprieta el glúteo arriba; no arquees la lumbar para subir más.',
    'Lie face up with knees bent and feet flat at hip width. Push through the heels and lift the hips until torso and thighs are in line. Squeeze the glutes at the top; do not arch the lower back to go higher.',
  ),
  'Deep squat hold': bi(
    'Baja a una sentadilla lo más profunda que puedas con los talones en el suelo y los pies a la anchura de los hombros. Apoya los codos por dentro de las rodillas y empuja suave hacia fuera. Pecho alto y respiración tranquila.',
    'Squat down as deep as you can with your heels on the floor and feet at shoulder width. Rest the elbows inside the knees and push gently outward. Chest tall and calm breathing.',
  ),
  'Standing hamstring stretch': bi(
    'Adelanta un pie con la pierna estirada y el talón apoyado, punta arriba. Con la ESPALDA RECTA, baja el pecho hacia esa pierna doblando desde la cadera. Si redondeas la espalda, el estiramiento se pierde.',
    'Step one foot forward with the leg straight and the heel down, toes up. With a FLAT BACK, lower your chest toward that leg by hinging at the hip. If you round the back, the stretch is lost.',
  ),
  'Standing quad stretch': bi(
    'De pie, sujétate si hace falta. Dobla una rodilla y agarra el tobillo llevándolo hacia el glúteo. Mantén las rodillas juntas y la cadera metida hacia delante. No arquees la espalda para tirar más.',
    'Standing, hold on if needed. Bend one knee and grab the ankle pulling it toward your glute. Keep the knees together and the hips tucked forward. Do not arch the back to pull harder.',
  ),
  'Wall calf stretch': bi(
    'Apoya las manos en la pared con un pie adelantado y el otro atrás. Estira la pierna de atrás con el TALÓN EN EL SUELO y empuja la cadera hacia la pared. Doblando un poco esa rodilla el estiramiento baja al sóleo.',
    'Place your hands on the wall with one foot forward and the other back. Straighten the back leg with the HEEL DOWN and push your hips toward the wall. Bending that knee slightly shifts the stretch to the soleus.',
  ),
  'Seated butterfly': bi(
    'Sentado en el suelo, junta las plantas de los pies y acércalas al cuerpo. Con la espalda recta, deja caer las rodillas hacia los lados por su propio peso. Puedes inclinarte hacia delante desde la cadera, sin curvar la espalda.',
    'Seated on the floor, put the soles of your feet together and bring them toward you. With a tall back, let the knees fall to the sides under their own weight. You may lean forward from the hips, without rounding the back.',
  ),
  'Adductor stretch': bi(
    'De pie con los pies muy separados. Dobla una rodilla llevando el peso a ese lado y mantén la otra pierna estirada con la punta del pie al frente. Baja hasta notar el estiramiento en la cara interna del muslo estirado.',
    'Stand with your feet very wide. Bend one knee shifting your weight to that side and keep the other leg straight with the toes forward. Sink until you feel the stretch on the inner thigh of the straight leg.',
  ),
  'Ankle circles': bi(
    'Sentado o de pie con un pie en el aire. Dibuja círculos amplios y lentos con la punta del pie, primero en un sentido y después en el otro. El movimiento sale del tobillo, no de la rodilla.',
    'Seated or standing with one foot off the floor. Draw wide slow circles with your toes, first one way and then the other. The movement comes from the ankle, not the knee.',
  ),
  'Knee-to-wall': bi(
    'Colócate frente a una pared con la punta del pie a un palmo de ella. Empuja la rodilla hacia la pared SIN levantar el talón. Si llegas fácil, aleja un poco el pie; si no llegas, acércalo.',
    'Stand facing a wall with your toes a hand-span away. Drive the knee toward the wall WITHOUT lifting the heel. If it touches easily, move the foot back; if it does not reach, move it closer.',
  ),
  'Calf raises': bi(
    'De pie con los pies a la anchura de la cadera, sujétate si lo necesitas. Sube todo lo alto que puedas sobre las puntas y baja despacio hasta apoyar del todo. Rango completo y control, sin rebotar.',
    'Standing with feet at hip width, hold on if needed. Rise as high as you can onto your toes and lower slowly until the heels are fully down. Full range and control, no bouncing.',
  ),
  'Toe walk': bi(
    'Ponte de puntillas y camina en el sitio o hacia delante manteniendo los talones siempre en el aire. Tronco erguido y pasos cortos. Si notas calambre en el gemelo, para y estíralo.',
    'Rise onto your toes and walk on the spot or forward keeping the heels off the ground the whole time. Tall torso and short steps. If the calf cramps, stop and stretch it.',
  ),
  'Heel walk': bi(
    'Levanta las puntas de los pies y camina apoyando solo los talones. Mantén la punta lo más arriba posible en cada paso; esto trabaja el tibial, que suele estar dormido. Tronco erguido.',
    'Lift your toes and walk on your heels only. Keep the toes as high as possible on every step; this works the tibialis, which is usually asleep. Tall torso.',
  ),
  'Easy jump rope': bi(
    'Salta a un ritmo cómodo que te permita hablar, con los saltos bajos y las rodillas blandas. No es un ejercicio de intensidad: es para subir la temperatura y despertar el tobillo.',
    'Skip at a comfortable pace where you could still talk, with low hops and soft knees. This is not an intensity exercise: it is to raise your temperature and wake the ankle up.',
  ),
  'Leg swings': bi(
    'Sujétate a algo firme. Balancea una pierna adelante y atrás con la rodilla suelta, ampliando el recorrido poco a poco. Después hazlo de lado a lado cruzando por delante del cuerpo. El tronco no se mueve.',
    'Hold something solid. Swing one leg forward and back with a loose knee, gradually increasing the range. Then swing it side to side crossing in front of the body. The torso stays still.',
  ),
  'Bodyweight squats': bi(
    'Pies a la anchura de los hombros con las puntas algo abiertas. Baja llevando la cadera atrás hasta el rango que tengas cómodo y sube empujando el suelo. Ritmo constante, pecho alto y talones apoyados.',
    'Feet at shoulder width with toes slightly out. Descend pushing the hips back to a comfortable range and rise driving through the floor. Steady tempo, chest tall and heels down.',
  ),
  'Light shadow boxing': bi(
    'Muévete en guardia lanzando golpes al 50 por ciento de fuerza. No busques potencia: busca soltar hombro y cadera y mover los pies. Mantén las manos arriba y respira por la nariz.',
    'Move in your stance throwing punches at 50 per cent power. Do not chase power: aim to loosen the shoulder and hip and move your feet. Keep your hands up and breathe through your nose.',
  ),
  'Slow nasal breathing': bi(
    'Sentado o tumbado con los hombros bajos. Inhala por la nariz contando cuatro y exhala contando seis, dejando que la barriga se hinche antes que el pecho. Es lo que baja las pulsaciones después de entrenar.',
    'Seated or lying down with your shoulders relaxed. Inhale through the nose for a count of four and exhale for six, letting the belly expand before the chest. This is what brings the heart rate down after training.',
  ),
  "Child's pose": bi(
    'De rodillas, siéntate sobre los talones y estira los brazos hacia delante apoyando la frente en el suelo. Deja caer el pecho entre los muslos y respira largo. Si las rodillas molestan, separa un poco más las piernas.',
    'Kneel, sit back onto your heels and reach the arms forward resting your forehead on the floor. Let the chest sink between the thighs and breathe long. If the knees complain, widen the legs a little.',
  ),
};

/** Explicación completa de un movimiento, o null si no la tiene. */
export function mobilityHow(nameEn: string, lang: 'es' | 'en'): string | null {
  const h = MOBILITY_HOW[nameEn];
  return h ? h[lang] : null;
}

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
