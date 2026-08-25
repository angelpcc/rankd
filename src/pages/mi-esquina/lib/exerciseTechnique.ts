// Fichas de técnica por ejercicio (PROMPT_4 · B3).
//
// Contenido estático informativo y neutro (músculos secundarios, puntos de
// técnica, errores típicos, material). NO promete resultados ni da consejos
// médicos. Cubre los ~30 ejercicios más comunes de la biblioteca.
//
// Uso: `techniqueFor(name, lang)` devuelve la ficha (o null si el ejercicio no
// tiene ficha). El nombre se normaliza sin acentos y case-insensitive para
// casar tanto "Press banca" como "press banca" y en/es.

import { EXERCISE_LIBRARY, type ExerciseTechnique } from './exercises';

type Lang = 'es' | 'en';

// Clave interna = nombre en inglés en minúsculas sin acentos (identifica
// unívocamente al ejercicio en la biblioteca). El diccionario es en:es.
interface Bilingual { es: string; en: string }
interface FichaRaw { secondary: Bilingual[]; technique: Bilingual[]; mistakes: Bilingual[]; equipment: Bilingual }

const bi = (es: string, en: string): Bilingual => ({ es, en });

// ── DICCIONARIO DE FICHAS ──
// Clave: nombre en inglés en minúsculas (matches EXERCISE_LIBRARY[i].en).
const FICHAS: Record<string, FichaRaw> = {
  // ── ESPALDA ──
  'pull-ups': {
    secondary: [bi('bíceps', 'biceps'), bi('espalda media', 'mid back'), bi('core', 'core')],
    technique: [
      bi('Cuélgate con hombros activos, no relajados', 'Hang with active shoulders, not relaxed'),
      bi('Tira con los codos hacia abajo hasta que el mentón pase la barra', 'Pull with elbows down until chin clears the bar'),
      bi('Baja controlado, sin dejarte caer', 'Lower controlled, don\'t drop'),
      bi('Sin balanceo con las piernas', 'No kipping with the legs'),
    ],
    mistakes: [bi('Recorrido corto sin llegar arriba', 'Short range not reaching the top'), bi('Usar impulso de las piernas', 'Using leg momentum'), bi('Encoger hombros', 'Shrugging shoulders')],
    equipment: bi('Barra fija', 'Pull-up bar'),
  },
  'lat pulldown': {
    secondary: [bi('bíceps', 'biceps'), bi('espalda media', 'mid back')],
    technique: [
      bi('Agarre algo más ancho que los hombros', 'Grip slightly wider than shoulders'),
      bi('Lleva la barra al pecho, no a la nuca', 'Pull the bar to your chest, not behind the neck'),
      bi('Tira con los codos hacia abajo, no con las manos', 'Pull with your elbows down, not your hands'),
      bi('Pecho arriba, sin balancearte', 'Chest up, no rocking'),
    ],
    mistakes: [bi('Usar impulso con la espalda', 'Using back momentum'), bi('Agarre excesivamente ancho', 'Excessively wide grip'), bi('No completar el recorrido', 'Not completing the range')],
    equipment: bi('Polea alta', 'Cable machine'),
  },
  'barbell row': {
    secondary: [bi('bíceps', 'biceps'), bi('deltoide posterior', 'rear delts'), bi('core', 'core')],
    technique: [
      bi('Bisagra de cadera con espalda neutra', 'Hip hinge with neutral spine'),
      bi('Tira la barra hacia el abdomen bajo, no al pecho', 'Row the bar to the lower abs, not the chest'),
      bi('Codos cerca del cuerpo', 'Elbows close to the body'),
      bi('Aprieta escápulas al final', 'Squeeze shoulder blades at the top'),
    ],
    mistakes: [bi('Redondear la espalda', 'Rounding the back'), bi('Usar el tren inferior de impulso', 'Using leg drive'), bi('Codos muy abiertos', 'Elbows flaring out')],
    equipment: bi('Barra', 'Barbell'),
  },
  'dumbbell row': {
    secondary: [bi('bíceps', 'biceps'), bi('deltoide posterior', 'rear delts')],
    technique: [
      bi('Apoya la mano y rodilla contrarias en el banco', 'Support opposite hand and knee on the bench'),
      bi('Espalda paralela al suelo, neutra', 'Back parallel to floor, neutral'),
      bi('Sube la mancuerna al costado, no al pecho', 'Row the dumbbell to your side, not your chest'),
      bi('Baja controlado hasta estiramiento', 'Lower controlled to full stretch'),
    ],
    mistakes: [bi('Rotar el torso para subir más peso', 'Twisting torso to lift more'), bi('Codo demasiado abierto', 'Elbow flaring out'), bi('Recorrido corto', 'Short range')],
    equipment: bi('Mancuerna y banco', 'Dumbbell and bench'),
  },
  'deadlift': {
    secondary: [bi('glúteos', 'glutes'), bi('isquios', 'hamstrings'), bi('core', 'core'), bi('trapecios', 'traps')],
    technique: [
      bi('Barra pegada a la espinilla al empezar', 'Bar close to shin at start'),
      bi('Bisagra de cadera, no sentadilla', 'Hip hinge, not a squat'),
      bi('Espalda neutra, pecho arriba', 'Neutral spine, chest up'),
      bi('Empuja el suelo con los pies', 'Push the floor away with your feet'),
    ],
    mistakes: [bi('Redondear la zona lumbar', 'Rounding the lower back'), bi('Barra alejada del cuerpo', 'Bar drifting away from the body'), bi('Hiperextender arriba', 'Hyperextending at the top')],
    equipment: bi('Barra y discos', 'Barbell and plates'),
  },
  'romanian deadlift': {
    secondary: [bi('glúteos', 'glutes'), bi('espalda baja', 'lower back'), bi('core', 'core')],
    technique: [
      bi('Rodillas ligeramente flexionadas y fijas', 'Knees slightly bent and fixed'),
      bi('Empuja la cadera hacia atrás mientras bajas', 'Push hips back as you lower'),
      bi('Barra pegada a las piernas', 'Bar close to your legs'),
      bi('Baja hasta sentir estiramiento en isquios', 'Lower until you feel hamstring stretch'),
    ],
    mistakes: [bi('Doblar demasiado las rodillas (se convierte en peso muerto)', 'Bending knees too much (turns into deadlift)'), bi('Redondear la espalda', 'Rounding the back'), bi('Bajar más allá del rango cómodo', 'Going below your comfortable range')],
    equipment: bi('Barra', 'Barbell'),
  },

  // ── PECHO ──
  'bench press': {
    secondary: [bi('tríceps', 'triceps'), bi('deltoide anterior', 'front delts')],
    technique: [
      bi('Escápulas retraídas y bloqueadas', 'Shoulder blades retracted and locked'),
      bi('Pies firmes, glúteo apoyado en el banco', 'Feet planted, glutes on the bench'),
      bi('Baja la barra al pecho, tocándolo suave', 'Lower to your chest, touching lightly'),
      bi('Codos a ~45° del torso, no abiertos 90°', 'Elbows ~45° from torso, not flared 90°'),
    ],
    mistakes: [bi('Rebotar la barra en el pecho', 'Bouncing the bar off the chest'), bi('Codos muy abiertos (riesgo de hombro)', 'Elbows flared out (shoulder risk)'), bi('Levantar el glúteo del banco', 'Lifting glutes off the bench')],
    equipment: bi('Barra y banco', 'Barbell and bench'),
  },
  'incline barbell press': {
    secondary: [bi('deltoide anterior', 'front delts'), bi('tríceps', 'triceps')],
    technique: [
      bi('Banco a 30-45°, no más', 'Bench at 30-45°, no steeper'),
      bi('Baja la barra a la clavícula alta', 'Lower to upper chest / clavicle'),
      bi('Escápulas retraídas', 'Shoulder blades retracted'),
      bi('Muñecas alineadas con antebrazos', 'Wrists aligned with forearms'),
    ],
    mistakes: [bi('Inclinación muy alta (trabaja hombro, no pecho)', 'Too steep an angle (works shoulders, not chest)'), bi('Rebotar la barra', 'Bouncing the bar'), bi('Codos disparados hacia afuera', 'Elbows flaring out')],
    equipment: bi('Barra y banco inclinado', 'Barbell and incline bench'),
  },
  'dumbbell bench press': {
    secondary: [bi('tríceps', 'triceps'), bi('deltoide anterior', 'front delts'), bi('core', 'core')],
    technique: [
      bi('Baja hasta que las mancuernas casi toquen el pecho', 'Lower until dumbbells almost touch your chest'),
      bi('Muñecas rectas, alineadas con antebrazos', 'Wrists straight, in line with forearms'),
      bi('Junta las mancuernas arriba, sin chocarlas', 'Bring dumbbells together at the top, without clashing'),
      bi('Escápulas retraídas todo el rango', 'Shoulder blades retracted throughout'),
    ],
    mistakes: [bi('Bajar solo hasta el nivel del pecho sin estirar', 'Stopping at chest without stretch'), bi('Muñecas dobladas hacia atrás', 'Wrists bending back'), bi('Rebote arriba con las mancuernas', 'Clashing dumbbells at the top')],
    equipment: bi('Mancuernas y banco', 'Dumbbells and bench'),
  },
  'push-ups': {
    secondary: [bi('tríceps', 'triceps'), bi('deltoide anterior', 'front delts'), bi('core', 'core')],
    technique: [
      bi('Cuerpo recto de talones a cabeza', 'Body straight from heels to head'),
      bi('Manos ligeramente más anchas que los hombros', 'Hands slightly wider than shoulders'),
      bi('Baja hasta que el pecho casi roce el suelo', 'Lower until chest nearly touches the floor'),
      bi('Codos a ~45° del torso', 'Elbows ~45° from torso'),
    ],
    mistakes: [bi('Cadera hundida o levantada', 'Sagging or piking hips'), bi('Recorrido a medias', 'Half range'), bi('Codos totalmente abiertos', 'Elbows fully flared')],
    equipment: bi('Peso corporal', 'Bodyweight'),
  },
  'chest dips': {
    secondary: [bi('tríceps', 'triceps'), bi('deltoide anterior', 'front delts')],
    technique: [
      bi('Inclina el torso adelante para trabajar más pecho', 'Lean torso forward to work chest more'),
      bi('Baja hasta que el hombro quede al nivel del codo', 'Lower until shoulder is at elbow level'),
      bi('Codos ligeramente abiertos, no pegados', 'Elbows slightly out, not tight to body'),
      bi('Sube con control, sin bloquear codos con impulso', 'Press up controlled, don\'t lock elbows with momentum'),
    ],
    mistakes: [bi('Torso muy vertical (pasa a tríceps)', 'Torso too vertical (shifts to triceps)'), bi('Bajar excesivamente (estrés en hombro)', 'Going too deep (shoulder stress)'), bi('Balancear el cuerpo', 'Body swinging')],
    equipment: bi('Paralelas', 'Dip bars'),
  },

  // ── HOMBRO ──
  'overhead barbell press': {
    secondary: [bi('tríceps', 'triceps'), bi('trapecios', 'traps'), bi('core', 'core')],
    technique: [
      bi('Barra a la altura de las clavículas', 'Bar at collarbone height'),
      bi('Aprieta glúteos y core antes de empujar', 'Squeeze glutes and brace core before pressing'),
      bi('Empuja recto, pasando la cabeza al final', 'Press straight up, tucking chin as bar clears'),
      bi('Codos ligeramente por delante, no debajo', 'Elbows slightly in front, not directly below'),
    ],
    mistakes: [bi('Arquear la espalda baja en exceso', 'Excessive lower back arch'), bi('Empujar la barra hacia adelante', 'Pressing the bar forward'), bi('No estirar arriba', 'Not locking out at the top')],
    equipment: bi('Barra', 'Barbell'),
  },
  'dumbbell shoulder press': {
    secondary: [bi('tríceps', 'triceps'), bi('trapecios', 'traps')],
    technique: [
      bi('Mancuernas a la altura de las orejas al empezar', 'Dumbbells at ear level at start'),
      bi('Empuja hacia arriba, muñecas rectas', 'Press up, wrists straight'),
      bi('Escápulas activas, no encogidas', 'Shoulder blades active, not shrugged'),
      bi('Baja controlado al mismo punto', 'Lower controlled to the same point'),
    ],
    mistakes: [bi('Empujar mancuernas hacia atrás', 'Pressing dumbbells backward'), bi('Recorrido corto sin bajar', 'Short range without lowering'), bi('Encoger hombros al final', 'Shrugging at the top')],
    equipment: bi('Mancuernas', 'Dumbbells'),
  },
  'lateral raise': {
    secondary: [bi('trapecios', 'traps')],
    technique: [
      bi('Codos ligeramente flexionados, no rectos', 'Elbows slightly bent, not straight'),
      bi('Sube hasta la altura del hombro, no más', 'Raise to shoulder height, no higher'),
      bi('Guía el movimiento con el codo, no con la mano', 'Lead with the elbow, not the hand'),
      bi('Baja controlado', 'Lower controlled'),
    ],
    mistakes: [bi('Impulso con las caderas', 'Hip momentum'), bi('Subir por encima del hombro (usa trapecio)', 'Raising above shoulder (uses traps)'), bi('Muñecas por encima del codo', 'Wrists above elbows')],
    equipment: bi('Mancuernas', 'Dumbbells'),
  },
  'rear delt fly': {
    secondary: [bi('espalda media', 'mid back')],
    technique: [
      bi('Torso paralelo al suelo, espalda neutra', 'Torso parallel to floor, neutral spine'),
      bi('Codos ligeramente flexionados y fijos', 'Elbows slightly bent and fixed'),
      bi('Abre los brazos a los lados hasta la altura del hombro', 'Open arms out to shoulder height'),
      bi('Aprieta escápulas al final', 'Squeeze shoulder blades at the top'),
    ],
    mistakes: [bi('Usar impulso del torso', 'Using torso momentum'), bi('Codos totalmente estirados', 'Fully straight elbows'), bi('Subir demasiado (activa trapecio)', 'Going too high (activates traps)')],
    equipment: bi('Mancuernas o peck deck inverso', 'Dumbbells or reverse pec deck'),
  },

  // ── BÍCEPS ──
  'barbell curl': {
    secondary: [bi('antebrazos', 'forearms')],
    technique: [
      bi('Codos pegados al torso, fijos', 'Elbows glued to torso, fixed'),
      bi('Sube con contracción del bíceps, no con impulso', 'Curl with biceps contraction, no swing'),
      bi('Baja controlado hasta casi extensión', 'Lower controlled to near full extension'),
      bi('Muñecas rectas, alineadas con antebrazos', 'Wrists straight, in line with forearms'),
    ],
    mistakes: [bi('Balancear el cuerpo', 'Swinging the body'), bi('Codos hacia adelante al subir', 'Elbows moving forward on the way up'), bi('Recorrido corto', 'Short range')],
    equipment: bi('Barra Z o recta', 'EZ or straight bar'),
  },
  'dumbbell curl': {
    secondary: [bi('antebrazos', 'forearms')],
    technique: [
      bi('Codos pegados y fijos al torso', 'Elbows tight and fixed to torso'),
      bi('Sube contrayendo el bíceps sin girar el torso', 'Curl with biceps contraction, no torso rotation'),
      bi('Puedes rotar la muñeca ligeramente al subir', 'You can slightly rotate the wrist on the way up'),
      bi('Baja controlado hasta casi extensión', 'Lower controlled to near full extension'),
    ],
    mistakes: [bi('Balancear el cuerpo', 'Swinging the body'), bi('Codos hacia adelante', 'Elbows drifting forward'), bi('Bajar sin control', 'Uncontrolled descent')],
    equipment: bi('Mancuernas', 'Dumbbells'),
  },
  'hammer curl': {
    secondary: [bi('antebrazos', 'forearms'), bi('braquial', 'brachialis')],
    technique: [
      bi('Agarre neutro (pulgares hacia arriba)', 'Neutral grip (thumbs up)'),
      bi('Codos pegados al torso', 'Elbows tight to torso'),
      bi('Sube sin rotar la muñeca', 'Curl without rotating the wrist'),
      bi('Baja controlado', 'Lower controlled'),
    ],
    mistakes: [bi('Impulso del cuerpo', 'Body swing'), bi('Codos hacia adelante', 'Elbows drifting forward'), bi('Rotar muñeca (deja de ser martillo)', 'Rotating wrist (stops being a hammer)')],
    equipment: bi('Mancuernas', 'Dumbbells'),
  },

  // ── TRÍCEPS ──
  'triceps pushdown': {
    secondary: [],
    technique: [
      bi('Codos pegados al torso, no moverlos', 'Elbows tight to torso, don\'t move them'),
      bi('Baja hasta extensión completa', 'Push down to full extension'),
      bi('Sube solo hasta que los antebrazos queden paralelos', 'Return only until forearms are parallel'),
      bi('Muñecas rectas', 'Straight wrists'),
    ],
    mistakes: [bi('Mover codos hacia adelante', 'Elbows moving forward'), bi('Usar el peso del cuerpo', 'Using body weight'), bi('No extender totalmente abajo', 'Not fully extending at the bottom')],
    equipment: bi('Polea alta', 'Cable machine'),
  },
  'skull crusher': {
    secondary: [],
    technique: [
      bi('Codos apuntando al techo, fijos', 'Elbows pointing up, fixed'),
      bi('Baja la barra hacia la frente o detrás de la cabeza', 'Lower bar toward forehead or behind head'),
      bi('Solo se mueven los antebrazos', 'Only forearms should move'),
      bi('Sube extendiendo el tríceps, no con impulso', 'Extend with triceps, no momentum'),
    ],
    mistakes: [bi('Codos abriéndose hacia afuera', 'Elbows flaring out'), bi('Mover los brazos enteros (deja de ser aislamiento)', 'Moving the whole arm (stops being isolation)'), bi('Barra fuera de control cerca de la cara', 'Bar out of control near the face')],
    equipment: bi('Barra Z y banco', 'EZ bar and bench'),
  },
  'close-grip bench press': {
    secondary: [bi('pecho', 'chest'), bi('deltoide anterior', 'front delts')],
    technique: [
      bi('Manos separadas al ancho de los hombros, no más cerca', 'Hands shoulder-width, not closer'),
      bi('Codos cerca del torso al bajar', 'Elbows close to torso on descent'),
      bi('Baja al esternón, toque suave', 'Lower to sternum, light touch'),
      bi('Empuja recto hacia arriba', 'Press straight up'),
    ],
    mistakes: [bi('Agarre demasiado estrecho (estrés en muñeca)', 'Grip too narrow (wrist stress)'), bi('Codos abiertos', 'Elbows flaring'), bi('Rebote en el pecho', 'Bouncing off the chest')],
    equipment: bi('Barra y banco', 'Barbell and bench'),
  },

  // ── PIERNA ──
  'squat': {
    secondary: [bi('glúteos', 'glutes'), bi('isquios', 'hamstrings'), bi('core', 'core')],
    technique: [
      bi('Pies al ancho de los hombros, ligera apertura de puntas', 'Feet shoulder-width, toes slightly out'),
      bi('Baja empujando la cadera atrás y las rodillas afuera', 'Lower pushing hips back and knees out'),
      bi('Baja al menos hasta que los muslos queden paralelos', 'Descend at least until thighs are parallel'),
      bi('Empuja el suelo con toda la planta del pie', 'Push through the whole foot'),
    ],
    mistakes: [bi('Rodillas colapsando hacia dentro', 'Knees caving in'), bi('Redondear la espalda baja', 'Rounding lower back'), bi('Talones despegando del suelo', 'Heels lifting off the floor')],
    equipment: bi('Barra y jaula', 'Barbell and rack'),
  },
  'leg press': {
    secondary: [bi('glúteos', 'glutes'), bi('isquios', 'hamstrings')],
    technique: [
      bi('Pies al ancho de la cadera en la plataforma', 'Feet hip-width on the platform'),
      bi('Baja hasta 90° de rodilla, sin colapsar la zona lumbar', 'Lower to 90° knees, without lower back rounding'),
      bi('Empuja con toda la planta, no solo con la punta', 'Push through the whole foot'),
      bi('No bloquees rodillas arriba', 'Don\'t lock knees at the top'),
    ],
    mistakes: [bi('Bajar demasiado y despegar el glúteo', 'Going too deep and lifting glutes'), bi('Rodillas hacia dentro', 'Knees caving in'), bi('Bloquear rodillas al empujar', 'Locking knees on the press')],
    equipment: bi('Máquina de prensa', 'Leg press machine'),
  },
  'lunges': {
    secondary: [bi('glúteos', 'glutes'), bi('isquios', 'hamstrings'), bi('core', 'core')],
    technique: [
      bi('Paso largo, torso vertical', 'Long step, torso vertical'),
      bi('Baja hasta casi tocar rodilla trasera con el suelo', 'Lower until back knee nearly touches the floor'),
      bi('Rodilla delantera alineada con el pie, sin pasarlo', 'Front knee tracks over the foot, not past it'),
      bi('Empuja con el talón delantero para subir', 'Drive up with the front heel'),
    ],
    mistakes: [bi('Torso inclinado adelante', 'Torso leaning forward'), bi('Rodilla trasera golpeando el suelo', 'Back knee slamming the floor'), bi('Paso demasiado corto', 'Step too short')],
    equipment: bi('Peso corporal o mancuernas', 'Bodyweight or dumbbells'),
  },
  'hip thrust': {
    secondary: [bi('isquios', 'hamstrings'), bi('core', 'core')],
    technique: [
      bi('Espalda alta apoyada en el banco, pies planos', 'Upper back on the bench, feet flat'),
      bi('Barra sobre las caderas (usar almohadilla)', 'Bar on the hips (use a pad)'),
      bi('Empuja el suelo con los pies y aprieta glúteos arriba', 'Drive through the feet, squeeze glutes at the top'),
      bi('Barbilla al pecho, sin hiperextender lumbar', 'Chin tucked, don\'t hyperextend lower back'),
    ],
    mistakes: [bi('Hiperextender la zona lumbar', 'Hyperextending lower back'), bi('Pies muy adelantados o atrasados', 'Feet too far forward or back'), bi('Recorrido corto sin llegar arriba', 'Short range without full lockout')],
    equipment: bi('Barra y banco', 'Barbell and bench'),
  },
  'leg extension': {
    secondary: [],
    technique: [
      bi('Rodillas alineadas con el eje de la máquina', 'Knees aligned with the machine axis'),
      bi('Extiende hasta arriba sin bloqueo brusco', 'Extend to the top without harsh lockout'),
      bi('Baja controlado hasta 90°', 'Lower controlled to 90°'),
      bi('Agárrate al asiento para no compensar', 'Grip the seat to avoid compensating'),
    ],
    mistakes: [bi('Impulso con el cuerpo', 'Body momentum'), bi('Bajar sin control', 'Uncontrolled lowering'), bi('Hiperextender rodilla arriba', 'Hyperextending knee at the top')],
    equipment: bi('Máquina de extensión', 'Leg extension machine'),
  },
  'leg curl': {
    secondary: [bi('glúteos', 'glutes')],
    technique: [
      bi('Eje de la rodilla alineado con el eje de la máquina', 'Knee axis aligned with machine axis'),
      bi('Flexiona hasta contracción completa', 'Curl to full contraction'),
      bi('Baja controlado, sin caída libre', 'Lower controlled, no free fall'),
      bi('Cadera pegada al banco', 'Hips pressed to the bench'),
    ],
    mistakes: [bi('Levantar la cadera al subir', 'Hips lifting on the curl'), bi('Recorrido corto', 'Short range'), bi('Bajar sin control', 'Uncontrolled descent')],
    equipment: bi('Máquina de curl femoral', 'Hamstring curl machine'),
  },

  // ── CORE ──
  'plank': {
    secondary: [bi('hombros', 'shoulders'), bi('glúteos', 'glutes')],
    technique: [
      bi('Codos justo bajo los hombros', 'Elbows directly under shoulders'),
      bi('Cuerpo recto de talones a cabeza', 'Body straight from heels to head'),
      bi('Aprieta glúteos y abdomen', 'Squeeze glutes and abs'),
      bi('Respira normal, no aguantes', 'Breathe normally, don\'t hold breath'),
    ],
    mistakes: [bi('Cadera hundida', 'Sagging hips'), bi('Cadera muy elevada (posición de V)', 'Hips too high (piking)'), bi('Encoger los hombros', 'Shrugging shoulders')],
    equipment: bi('Peso corporal', 'Bodyweight'),
  },
  'hanging leg raise': {
    secondary: [bi('flexores de cadera', 'hip flexors')],
    technique: [
      bi('Cuélgate con hombros activos, no relajados', 'Hang with active shoulders'),
      bi('Sube las piernas rectas hasta 90° o más', 'Raise straight legs to 90° or higher'),
      bi('No balancearse', 'No swinging'),
      bi('Baja controlado', 'Lower controlled'),
    ],
    mistakes: [bi('Usar impulso para subir', 'Using swing to raise legs'), bi('Recorrido corto (por debajo de 90°)', 'Short range (below 90°)'), bi('Hombros pasivos', 'Passive shoulders')],
    equipment: bi('Barra fija', 'Pull-up bar'),
  },
};

/** Normaliza un nombre para casarlo con el diccionario (case + acentos + espacios). */
const normKey = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

// Índice inverso: cualquier alias en es/en → clave inglesa del diccionario.
const ALIAS_TO_KEY: Map<string, string> = (() => {
  const m = new Map<string, string>();
  EXERCISE_LIBRARY.forEach((e) => {
    const key = e.en.toLowerCase();
    if (FICHAS[key]) {
      m.set(normKey(e.es), key);
      m.set(normKey(e.en), key);
    }
  });
  return m;
})();

/** Devuelve la ficha en el idioma pedido, o null si el ejercicio no tiene. */
export function techniqueFor(nameOrKey: string, lang: Lang): import('./exercises').ExerciseTechnique | null {
  const k = ALIAS_TO_KEY.get(normKey(nameOrKey));
  if (!k) return null;
  const f = FICHAS[k];
  const pick = (b: Bilingual) => (lang === 'en' ? b.en : b.es);
  return {
    secondary: f.secondary.map(pick),
    technique: f.technique.map(pick),
    mistakes: f.mistakes.map(pick),
    equipment: pick(f.equipment),
  };
}

/** ¿Este ejercicio tiene ficha? (para saber si mostrar el icono de info). */
export function hasTechnique(nameOrKey: string): boolean {
  return ALIAS_TO_KEY.has(normKey(nameOrKey));
}
