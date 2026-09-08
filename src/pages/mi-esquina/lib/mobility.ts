// Movilidad y estiramientos (pestaña propia dentro de Fuerza).
//
// Son DOS COSAS DISTINTAS y se guardan separadas a propósito:
//
//   · MOVILIDAD    → movimiento activo de una articulación por su recorrido.
//                    Se hace ANTES de entrenar, en movimiento, sin aguantar.
//   · ESTIRAMIENTO → posición sostenida para alargar un tejido. Se hace
//                    DESPUÉS o aparte, quieto y sin rebotes.
//
// Mezclarlas en una sola lista era el problema: parecían intercambiables y no
// lo son. Cada una se organiza por ZONA del cuerpo para poder ir directo a lo
// que te molesta.
//
// Contenido de CONSULTA: no se registra por serie ni por repeticiones, solo se
// marca "hecho hoy" (localStorage, sin migración). Cada movimiento lleva sus
// segundos, y `how` explica la ejecución para quien NO conoce el ejercicio
// (el `cue` de una línea solo sirve de recordatorio).

export type MobilityKind = 'mobility' | 'stretch';

/** Zonas del cuerpo. El orden es el de presentación. */
export type MobilityZone =
  | 'neck' | 'shoulder' | 'spine' | 'hip' | 'legs' | 'ankle' | 'wrist';

export const MOBILITY_ZONES: MobilityZone[] = [
  'neck', 'shoulder', 'spine', 'hip', 'legs', 'ankle', 'wrist',
];

/** Icono por zona (Remix Icon), para las pastillas del selector. */
export const ZONE_ICON: Record<MobilityZone, string> = {
  neck: 'ri-user-3-line',
  shoulder: 'ri-body-scan-line',
  spine: 'ri-git-commit-line',
  hip: 'ri-walk-line',
  legs: 'ri-run-line',
  ankle: 'ri-footprint-line',
  wrist: 'ri-hand-heart-line',
};

interface Bi { es: string; en: string }
const bi = (es: string, en: string): Bi => ({ es, en });

export interface MobilityItem {
  id: string;
  kind: MobilityKind;
  zone: MobilityZone;
  name: Bi;
  /** Duración sugerida en segundos (por lado si es unilateral). */
  seconds: number;
  /** true si se hace por lado (la duración es por lado). */
  perSide?: boolean;
  /** Recordatorio de una línea, para quien ya lo conoce. */
  cue: Bi;
  /** Ejecución completa: colocación, recorrido y qué evitar. */
  how: Bi;
}

// ══════════════════════ MOVILIDAD ══════════════════════
const MOBILITY: MobilityItem[] = [
  // ── CUELLO ──
  {
    id: 'neck-rotations', kind: 'mobility', zone: 'neck', seconds: 30,
    name: bi('Rotaciones de cuello', 'Neck rotations'),
    cue: bi('Lentas y cortas, sin llegar al tope', 'Slow and short, never to the end range'),
    how: bi(
      'Sentado o de pie con los hombros relajados. Gira la cabeza despacio hacia un lado hasta donde vaya sola, sin empujar, y vuelve al centro antes de ir al otro. El movimiento es corto y controlado: el cuello no se fuerza nunca.',
      'Seated or standing with relaxed shoulders. Turn your head slowly to one side as far as it goes on its own, without pushing, and return to centre before going the other way. The range is short and controlled: never force the neck.',
    ),
  },
  {
    id: 'chin-tuck', kind: 'mobility', zone: 'neck', seconds: 30,
    name: bi('Retracción de barbilla', 'Chin tuck'),
    cue: bi('Lleva la barbilla atrás, no abajo', 'Draw the chin back, not down'),
    how: bi(
      'De pie o sentado con la espalda recta. Lleva la barbilla hacia atrás como si quisieras hacerte papada, manteniendo la mirada al frente. Aguanta dos segundos y suelta. No bajes la cabeza: el movimiento es horizontal.',
      'Standing or seated with a tall back. Draw your chin straight back as if making a double chin, keeping your eyes forward. Hold two seconds and release. Do not tip the head down: the movement is horizontal.',
    ),
  },
  {
    id: 'neck-side-bend-active', kind: 'mobility', zone: 'neck', seconds: 30, perSide: true,
    name: bi('Inclinación lateral controlada', 'Controlled side bend'),
    cue: bi('Oreja al hombro, hombro quieto', 'Ear to shoulder, shoulder still'),
    how: bi(
      'Sentado con la espalda recta y las manos en los muslos. Lleva la oreja hacia el hombro SIN subir el hombro, aguanta un segundo y vuelve al centro. Repite alternando. Si notas tirón agudo en vez de tensión, has ido demasiado lejos.',
      'Seated tall with your hands on your thighs. Take your ear toward your shoulder WITHOUT lifting the shoulder, hold a second and return to centre. Alternate sides. Sharp pulling instead of tension means you went too far.',
    ),
  },

  // ── HOMBRO ──
  {
    id: 'arm-circles', kind: 'mobility', zone: 'shoulder', seconds: 30,
    name: bi('Círculos de brazo', 'Arm circles'),
    cue: bi('De pequeños a grandes, en los dos sentidos', 'Small to large, both directions'),
    how: bi(
      'De pie con los brazos estirados a los lados. Haz círculos empezando pequeños y ampliándolos poco a poco, primero hacia delante y luego hacia atrás. Mantén los hombros bajos, sin encogerlos hacia las orejas.',
      'Standing with your arms straight out to the sides. Circle them starting small and growing wider, first forward and then backward. Keep the shoulders down, not shrugged toward your ears.',
    ),
  },
  {
    id: 'pass-throughs', kind: 'mobility', zone: 'shoulder', seconds: 40,
    name: bi('Dislocaciones con banda o palo', 'Band or stick pass-throughs'),
    cue: bi('Agarre MUY ancho y brazos rectos', 'VERY wide grip and straight arms'),
    how: bi(
      'Agarra una banda o un palo con las manos muy separadas y los brazos estirados. Pásalo por encima de la cabeza hasta detrás de la espalda sin doblar los codos, y vuelve. Si no llegas, abre más el agarre: nunca fuerces el hombro para completar el recorrido.',
      'Hold a band or stick with your hands very wide and arms straight. Pass it overhead and behind your back without bending the elbows, then return. If you cannot reach, widen the grip: never force the shoulder to complete the range.',
    ),
  },
  {
    id: 'wall-ext-rotation', kind: 'mobility', zone: 'shoulder', seconds: 30, perSide: true,
    name: bi('Rotación externa en pared', 'Wall external rotation'),
    cue: bi('Codo pegado al costado todo el rato', 'Elbow tucked the whole time'),
    how: bi(
      'De pie junto a una pared con el codo pegado al costado y doblado a 90 grados. Apoya el dorso de la mano en la pared y gira el antebrazo hacia fuera manteniendo el codo pegado. El codo no se separa en ningún momento; si lo hace, has perdido el ejercicio.',
      'Stand beside a wall with your elbow tucked at your side and bent to 90 degrees. Rest the back of your hand on the wall and rotate the forearm outward keeping the elbow tucked. The elbow never leaves your side; if it does, the exercise is gone.',
    ),
  },
  {
    id: 'wall-slides', kind: 'mobility', zone: 'shoulder', seconds: 40,
    name: bi('Deslizamiento en pared', 'Wall slides'),
    cue: bi('Manos y antebrazos pegados a la pared', 'Hands and forearms on the wall'),
    how: bi(
      'De espaldas a la pared, apoya la parte baja de la espalda, los antebrazos y el dorso de las manos. Desliza los brazos hacia arriba sin despegar nada y baja controlando. Si la lumbar se arquea para dejarte subir más, has llegado a tu tope real.',
      'With your back to the wall, rest your lower back, forearms and the backs of your hands against it. Slide the arms up without letting anything peel off, then lower under control. If the lower back arches to let you go higher, that is your real limit.',
    ),
  },

  // ── COLUMNA Y ESPALDA ──
  {
    id: 'cat-cow', kind: 'mobility', zone: 'spine', seconds: 40,
    name: bi('Gato-camello', 'Cat-cow'),
    cue: bi('Vértebra a vértebra, sin prisa', 'Vertebra by vertebra, unhurried'),
    how: bi(
      'A cuatro patas con las manos bajo los hombros y las rodillas bajo la cadera. Redondea la espalda hacia el techo metiendo la barbilla, y luego húndela sacando pecho y mirada al frente. Encadena los dos sin parar, moviendo la columna entera poco a poco.',
      'On all fours with hands under the shoulders and knees under the hips. Round the back toward the ceiling tucking the chin, then let it sink opening the chest and looking ahead. Flow between the two, moving the whole spine gradually.',
    ),
  },
  {
    id: 'thoracic-cat-cow', kind: 'mobility', zone: 'spine', seconds: 40,
    name: bi('Gato-camello torácico', 'Thoracic cat-cow'),
    cue: bi('Solo la parte alta, la lumbar quieta', 'Upper back only, lower back still'),
    how: bi(
      'A cuatro patas, aprieta el abdomen para bloquear la zona lumbar. Mueve SOLO la parte alta de la espalda, la que queda entre los omóplatos, arriba y abajo. Es un recorrido corto: si la lumbar se mueve, estás haciendo el gato-camello normal.',
      'On all fours, brace your abs to lock the lower back. Move ONLY the upper back, the area between the shoulder blades, up and down. The range is short: if the lower back moves, you are doing the regular cat-cow.',
    ),
  },
  {
    id: 'open-book', kind: 'mobility', zone: 'spine', seconds: 40, perSide: true,
    name: bi('Rotación torácica tumbado', 'Lying thoracic rotation'),
    cue: bi('Rodillas juntas y quietas en el suelo', 'Knees together and still on the floor'),
    how: bi(
      'Túmbate de lado con las rodillas dobladas a 90 grados y los brazos estirados juntos delante. Abre el brazo de arriba hacia el otro lado siguiéndolo con la mirada, dejando que el pecho gire, pero SIN que las rodillas se despeguen del suelo. Vuelve despacio.',
      'Lie on your side with knees bent to 90 degrees and both arms straight out in front. Open the top arm across to the other side, following it with your eyes and letting the chest rotate, but WITHOUT letting the knees lift off the floor. Return slowly.',
    ),
  },
  {
    id: 'thoracic-extension', kind: 'mobility', zone: 'spine', seconds: 40,
    name: bi('Extensión torácica sobre rodillo', 'Thoracic extension over a roller'),
    cue: bi('Rodillo bajo los omóplatos, cadera abajo', 'Roller under the shoulder blades, hips down'),
    how: bi(
      'Túmbate boca arriba con un rodillo o una toalla enrollada cruzado bajo los omóplatos. Sujétate la nuca con las manos y deja caer la parte alta de la espalda hacia atrás sobre el rodillo. La cadera se queda apoyada en el suelo: si se levanta, el arco se va a la lumbar.',
      'Lie face up with a roller or rolled towel across your back under the shoulder blades. Support your head with your hands and let the upper back drape back over the roller. The hips stay on the floor: if they lift, the arch moves into the lower back.',
    ),
  },

  // ── CADERA ──
  {
    id: 'standing-hip-circles', kind: 'mobility', zone: 'hip', seconds: 30, perSide: true,
    name: bi('Círculos de cadera de pie', 'Standing hip circles'),
    cue: bi('Rodilla arriba y abre en círculo', 'Knee up, then sweep it open'),
    how: bi(
      'De pie, sujétate a algo si lo necesitas. Sube una rodilla hasta la altura de la cadera y ábrela describiendo un círculo hacia fuera, luego devuélvela por el mismo camino. El tronco se queda quieto: solo se mueve la pierna desde la cadera.',
      'Standing, hold something for balance if needed. Lift one knee to hip height and sweep it open in a circle, then bring it back the same way. The torso stays still: only the leg moves, from the hip.',
    ),
  },
  {
    id: 'lunge-rotation', kind: 'mobility', zone: 'hip', seconds: 40, perSide: true,
    name: bi('Zancada con rotación', 'Lunge with rotation'),
    cue: bi('Abre el pecho hacia la pierna de delante', 'Open the chest toward the front leg'),
    how: bi(
      'Da un paso largo al frente y baja a zancada con la rodilla de atrás cerca del suelo. Apoya la mano del lado contrario en el suelo y gira el tronco abriendo el otro brazo hacia el techo, siguiéndolo con la mirada. Aguanta un segundo arriba y cambia.',
      'Take a long step forward and drop into a lunge with the back knee near the floor. Place the opposite hand on the floor and rotate your torso, opening the other arm toward the ceiling and following it with your eyes. Hold a second at the top and switch.',
    ),
  },
  {
    id: '90-90-switch', kind: 'mobility', zone: 'hip', seconds: 40, perSide: true,
    name: bi('Cambios 90/90', '90/90 switches'),
    cue: bi('Pasa de un lado al otro sin manos', 'Switch sides without using your hands'),
    how: bi(
      'Sentado en el suelo con una pierna doblada a 90 grados delante y la otra a 90 grados al lado. Sin apoyar las manos si puedes, gira las dos rodillas al suelo del otro lado y quédate en la posición espejo. Ve y vuelve a ritmo lento y controlado.',
      'Seated on the floor with one leg bent 90 degrees in front and the other 90 degrees to the side. Without using your hands if you can, sweep both knees over to the other side and settle in the mirror position. Go back and forth slowly and under control.',
    ),
  },
  {
    id: 'deep-squat-hold', kind: 'mobility', zone: 'hip', seconds: 45,
    name: bi('Sentadilla profunda sostenida', 'Deep squat hold'),
    cue: bi('Talones en el suelo, pecho alto', 'Heels down, chest tall'),
    how: bi(
      'Baja a una sentadilla lo más profunda que puedas con los talones en el suelo y los pies a la anchura de los hombros. Apoya los codos por dentro de las rodillas y empuja suave hacia fuera. Si los talones se levantan, separa un poco más los pies o abre las puntas.',
      'Squat down as deep as you can with your heels on the floor and feet at shoulder width. Rest your elbows inside your knees and push gently outward. If the heels lift, widen the stance a little or turn the toes out.',
    ),
  },
  {
    id: 'leg-swings', kind: 'mobility', zone: 'hip', seconds: 30, perSide: true,
    name: bi('Balanceos de pierna', 'Leg swings'),
    cue: bi('Adelante-atrás y luego lateral', 'Front-to-back, then side-to-side'),
    how: bi(
      'Sujétate a algo firme. Balancea una pierna adelante y atrás con la rodilla suelta, ampliando el recorrido poco a poco. Después hazlo de lado a lado cruzando por delante del cuerpo. El tronco no se mueve; el impulso sale de la cadera, no de la espalda.',
      'Hold something solid. Swing one leg forward and back with a loose knee, gradually increasing the range. Then swing it side to side crossing in front of the body. The torso stays still; the drive comes from the hip, not the back.',
    ),
  },

  // ── PIERNAS ──
  {
    id: 'knee-circles', kind: 'mobility', zone: 'legs', seconds: 30,
    name: bi('Círculos de rodilla', 'Knee circles'),
    cue: bi('Pies juntos, recorrido pequeño', 'Feet together, small range'),
    how: bi(
      'De pie con los pies juntos y las rodillas ligeramente dobladas, apoya las manos encima de las rodillas. Dibuja círculos pequeños y lentos con las dos a la vez, primero en un sentido y luego en el otro. Nada de círculos grandes ni de forzar.',
      'Standing with feet together and knees slightly bent, rest your hands on your knees. Draw small slow circles with both together, first one way and then the other. No wide circles and no forcing.',
    ),
  },
  {
    id: 'active-hamstring-lower', kind: 'mobility', zone: 'legs', seconds: 40, perSide: true,
    name: bi('Bajada activa de pierna', 'Active leg lowering'),
    cue: bi('Lumbar pegada al suelo todo el rato', 'Lower back pressed down throughout'),
    how: bi(
      'Túmbate boca arriba con las dos piernas estiradas hacia el techo y la lumbar pegada al suelo. Baja UNA pierna despacio hacia el suelo manteniendo la otra arriba y la lumbar pegada, y súbela. En cuanto la lumbar se despegue, has llegado a tu rango real.',
      'Lie face up with both legs straight toward the ceiling and the lower back pressed into the floor. Lower ONE leg slowly toward the floor keeping the other up and the lower back down, then raise it again. The moment the lower back lifts, that is your real range.',
    ),
  },

  // ── TOBILLO ──
  {
    id: 'ankle-circles', kind: 'mobility', zone: 'ankle', seconds: 30, perSide: true,
    name: bi('Círculos de tobillo', 'Ankle circles'),
    cue: bi('Amplios y lentos, los dos sentidos', 'Wide and slow, both directions'),
    how: bi(
      'Sentado o de pie con un pie en el aire. Dibuja círculos amplios y lentos con la punta del pie, primero en un sentido y después en el otro. El movimiento sale del tobillo: la rodilla y la pierna se quedan quietas.',
      'Seated or standing with one foot off the floor. Draw wide slow circles with your toes, first one way and then the other. The movement comes from the ankle: the knee and leg stay still.',
    ),
  },
  {
    id: 'knee-to-wall', kind: 'mobility', zone: 'ankle', seconds: 40, perSide: true,
    name: bi('Rodilla a la pared', 'Knee-to-wall'),
    cue: bi('Talón clavado en el suelo', 'Heel nailed to the floor'),
    how: bi(
      'Colócate frente a una pared con la punta del pie a un palmo de ella. Empuja la rodilla hacia la pared sin levantar el talón. Si llegas fácil, aleja un poco el pie; si no llegas, acércalo. Es la prueba y el ejercicio a la vez.',
      'Stand facing a wall with your toes a hand-span away. Drive the knee toward the wall without lifting the heel. If it touches easily, move the foot back; if it does not reach, move it closer. It is both the test and the drill.',
    ),
  },
  {
    id: 'toe-walk', kind: 'mobility', zone: 'ankle', seconds: 30,
    name: bi('Caminar de puntillas', 'Toe walk'),
    cue: bi('Talones siempre en el aire', 'Heels off the ground the whole time'),
    how: bi(
      'Ponte de puntillas y camina en el sitio o hacia delante manteniendo los talones siempre en el aire. Tronco erguido y pasos cortos. Si notas calambre en el gemelo, para y estíralo antes de seguir.',
      'Rise onto your toes and walk on the spot or forward keeping the heels off the ground the whole time. Tall torso and short steps. If the calf cramps, stop and stretch it before continuing.',
    ),
  },
  {
    id: 'heel-walk', kind: 'mobility', zone: 'ankle', seconds: 30,
    name: bi('Caminar sobre talones', 'Heel walk'),
    cue: bi('Punta del pie lo más arriba posible', 'Toes as high as they go'),
    how: bi(
      'Levanta las puntas de los pies y camina apoyando solo los talones, con la punta lo más arriba posible en cada paso. Trabaja el tibial anterior, que suele estar dormido y es lo que protege la espinilla al correr. Tronco erguido.',
      'Lift your toes and walk on your heels only, keeping the toes as high as possible on every step. It works the tibialis anterior, usually asleep, which is what protects the shin when running. Tall torso.',
    ),
  },

  // ── MUÑECA ──
  {
    id: 'wrist-circles', kind: 'mobility', zone: 'wrist', seconds: 30,
    name: bi('Círculos de muñeca', 'Wrist circles'),
    cue: bi('Dedos entrelazados, círculos lentos', 'Fingers interlaced, slow circles'),
    how: bi(
      'Entrelaza los dedos de las dos manos delante del pecho y dibuja círculos lentos con las muñecas, en los dos sentidos. Es lo primero que hay que hacer antes de cargar peso en las manos, sobre todo antes de fondos o cargadas.',
      'Interlace your fingers in front of your chest and draw slow circles with the wrists, in both directions. It is the first thing to do before loading the hands, especially before dips or cleans.',
    ),
  },
  {
    id: 'wrist-rocks', kind: 'mobility', zone: 'wrist', seconds: 40,
    name: bi('Balanceo sobre las manos', 'Wrist rocks on all fours'),
    cue: bi('Palmas fijas, mueve el cuerpo', 'Palms planted, move the body'),
    how: bi(
      'A cuatro patas con las palmas planas en el suelo y los dedos hacia delante. Balancea el peso del cuerpo adelante y atrás sobre las manos, sin despegar las palmas. Ve poco a poco: es un rango que se gana con semanas, no con una sesión.',
      'On all fours with flat palms and fingers pointing forward. Rock your bodyweight forward and back over the hands without letting the palms peel off. Go gradually: this range is earned over weeks, not in one session.',
    ),
  },
  {
    id: 'wrist-flex-ext', kind: 'mobility', zone: 'wrist', seconds: 40,
    name: bi('Flexión y extensión en el suelo', 'Floor wrist flexion and extension'),
    cue: bi('Dedos hacia ti y luego al revés', 'Fingers toward you, then away'),
    how: bi(
      'A cuatro patas, gira las manos hasta poner los dedos apuntando hacia tus rodillas y lleva el peso atrás con suavidad. Después ponte sobre el dorso de las manos con los dedos hacia ti y repite. Muy poco peso al principio: la muñeca no está acostumbrada.',
      'On all fours, turn your hands so the fingers point toward your knees and gently shift your weight back. Then come onto the backs of your hands with the fingers pointing toward you and repeat. Very little weight at first: the wrist is not used to it.',
    ),
  },
];

// ══════════════════════ ESTIRAMIENTOS ══════════════════════
const STRETCH: MobilityItem[] = [
  // ── CUELLO ──
  {
    id: 'neck-side-stretch', kind: 'stretch', zone: 'neck', seconds: 30, perSide: true,
    name: bi('Estiramiento lateral de cuello', 'Neck side stretch'),
    cue: bi('Sin tirar con la mano al principio', 'No hand pull to begin with'),
    how: bi(
      'Sentado con la espalda recta, deja caer la oreja hacia el hombro y sujeta el borde del asiento con la mano del lado que estiras para que el hombro no suba. Aguanta respirando. Si quieres más, apoya la otra mano en la cabeza sin tirar: solo su peso.',
      'Seated tall, let your ear drop toward your shoulder and hold the seat edge with the hand of the side you are stretching so the shoulder cannot rise. Hold and breathe. For more, rest your other hand on your head without pulling: just its weight.',
    ),
  },
  {
    id: 'upper-trap-stretch', kind: 'stretch', zone: 'neck', seconds: 30, perSide: true,
    name: bi('Estiramiento de trapecio superior', 'Upper trap stretch'),
    cue: bi('Mira hacia la axila contraria', 'Look toward the opposite armpit'),
    how: bi(
      'Sentado, gira la cabeza unos 45 grados y baja la mirada hacia la axila contraria. Sujeta el asiento con la mano del lado que estiras. Notarás la tensión en la parte de atrás del cuello y arriba del hombro, no en la garganta.',
      'Seated, turn your head about 45 degrees and look down toward the opposite armpit. Hold the seat with the hand of the side you are stretching. You should feel it at the back of the neck and top of the shoulder, not in the throat.',
    ),
  },

  // ── HOMBRO ──
  {
    id: 'cross-body-shoulder', kind: 'stretch', zone: 'shoulder', seconds: 30, perSide: true,
    name: bi('Estiramiento cruzado de hombro', 'Cross-body shoulder stretch'),
    cue: bi('Sujeta por encima del codo, sin rebotes', 'Hold above the elbow, no bouncing'),
    how: bi(
      'Lleva un brazo estirado cruzando el pecho y sujétalo por ENCIMA del codo con la otra mano, no en la muñeca. Tira suave hacia el pecho manteniendo el hombro bajo. Debe notarse un estiramiento en la parte de atrás del hombro, nunca dolor articular.',
      'Bring one straight arm across your chest and hold it ABOVE the elbow with the other hand, not at the wrist. Pull gently toward your chest keeping the shoulder down. It should feel like a stretch at the back of the shoulder, never joint pain.',
    ),
  },
  {
    id: 'overhead-triceps-stretch', kind: 'stretch', zone: 'shoulder', seconds: 30, perSide: true,
    name: bi('Estiramiento de tríceps sobre la cabeza', 'Overhead triceps stretch'),
    cue: bi('Codo al techo, mano entre los omóplatos', 'Elbow to the ceiling, hand between the shoulder blades'),
    how: bi(
      'Levanta un brazo y dobla el codo llevando la mano hacia el centro de la espalda. Con la otra mano empuja suavemente el codo hacia atrás y hacia dentro. Mantén las costillas metidas: si arqueas la espalda, el estiramiento se escapa.',
      'Raise one arm and bend the elbow taking your hand toward the middle of your back. With the other hand, gently push the elbow back and in. Keep your ribs down: if you arch the back, the stretch escapes.',
    ),
  },
  {
    id: 'doorway-chest-stretch', kind: 'stretch', zone: 'shoulder', seconds: 30, perSide: true,
    name: bi('Estiramiento de pecho en marco de puerta', 'Doorway chest stretch'),
    cue: bi('Antebrazo en el marco y gira el cuerpo', 'Forearm on the frame, then turn the body'),
    how: bi(
      'Apoya el antebrazo en el marco de una puerta con el codo a la altura del hombro. Da un paso adelante con el pie del mismo lado y gira el cuerpo despacio hacia el lado contrario. Notarás el pecho, no el hombro; si notas pinchazo, baja el codo.',
      'Place your forearm on a doorframe with the elbow at shoulder height. Step forward with the foot on the same side and slowly turn your body away. You should feel the chest, not the shoulder; if it pinches, lower the elbow.',
    ),
  },

  // ── COLUMNA Y ESPALDA ──
  {
    id: 'childs-pose', kind: 'stretch', zone: 'spine', seconds: 45,
    name: bi('Postura del niño', "Child's pose"),
    cue: bi('Cadera a los talones, brazos largos', 'Hips to heels, long arms'),
    how: bi(
      'De rodillas, siéntate sobre los talones y estira los brazos hacia delante apoyando la frente en el suelo. Deja caer el pecho entre los muslos y respira largo. Si las rodillas molestan, separa un poco más las piernas o pon una toalla detrás.',
      'Kneel, sit back onto your heels and reach the arms forward resting your forehead on the floor. Let the chest sink between the thighs and breathe long. If your knees complain, widen the legs or place a towel behind them.',
    ),
  },
  {
    id: 'seated-spinal-twist', kind: 'stretch', zone: 'spine', seconds: 30, perSide: true,
    name: bi('Torsión espinal sentado', 'Seated spinal twist'),
    cue: bi('Crece primero, gira después', 'Grow tall first, then rotate'),
    how: bi(
      'Sentado en el suelo con una pierna estirada y la otra cruzada por encima con el pie apoyado. Estírate hacia arriba y gira el tronco hacia la rodilla doblada, usando el brazo contrario como apoyo. La espalda se queda recta: es rotación, no una curva.',
      'Seated on the floor with one leg straight and the other crossed over with the foot planted. Lengthen upward and rotate your torso toward the bent knee, using the opposite arm as a brace. Keep the spine tall: this is rotation, not a slump.',
    ),
  },
  {
    id: 'lat-hang-stretch', kind: 'stretch', zone: 'spine', seconds: 30,
    name: bi('Estiramiento de dorsal colgado', 'Hanging lat stretch'),
    cue: bi('Cuélgate y deja que el hombro suba', 'Hang and let the shoulder rise'),
    how: bi(
      'Cuélgate de una barra con los brazos estirados y relaja los hombros dejando que suban hacia las orejas. Si no puedes colgarte, agarra un poste o el marco de una puerta y siéntate hacia atrás con los brazos estirados. Respira y deja que la espalda se abra.',
      'Hang from a bar with straight arms and relax the shoulders, letting them rise toward your ears. If you cannot hang, grab a post or doorframe and sit your hips back with straight arms. Breathe and let the back open up.',
    ),
  },

  // ── CADERA ──
  {
    id: 'butterfly', kind: 'stretch', zone: 'hip', seconds: 40,
    name: bi('Mariposa sentado', 'Seated butterfly'),
    cue: bi('Plantas juntas, espalda recta', 'Soles together, back tall'),
    how: bi(
      'Sentado en el suelo, junta las plantas de los pies y acércalas al cuerpo. Con la espalda recta, deja caer las rodillas hacia los lados por su propio peso, sin empujarlas con las manos. Puedes inclinarte hacia delante desde la cadera, no curvando la espalda.',
      'Seated on the floor, put the soles of your feet together and bring them toward you. With a tall back, let the knees fall to the sides under their own weight, without pushing them down. You may lean forward from the hips, not by rounding the back.',
    ),
  },
  {
    id: 'pigeon', kind: 'stretch', zone: 'hip', seconds: 40, perSide: true,
    name: bi('Postura de la paloma', 'Pigeon pose'),
    cue: bi('Cadera cuadrada al frente', 'Hips square to the front'),
    how: bi(
      'Desde cuadrupedia, lleva una rodilla hacia la mano del mismo lado y apoya la espinilla cruzada delante. Estira la otra pierna hacia atrás y baja la cadera manteniéndola cuadrada al frente. Si la cadera se va de lado, pon una toalla debajo del glúteo.',
      'From all fours, bring one knee toward the hand on the same side and lay the shin across in front of you. Extend the other leg back and lower your hips keeping them square to the front. If the hip drifts to one side, put a towel under that glute.',
    ),
  },
  {
    id: 'hip-flexor-lunge', kind: 'stretch', zone: 'hip', seconds: 30, perSide: true,
    name: bi('Flexor de cadera en zancada', 'Kneeling hip flexor stretch'),
    cue: bi('Mete la pelvis antes de avanzar', 'Tuck the pelvis before pushing forward'),
    how: bi(
      'Arrodíllate con una pierna delante en ángulo recto. Antes de empujar hacia delante, METE la pelvis apretando el glúteo de la pierna de atrás: ahí ya notarás el estiramiento delante de la cadera. Solo entonces avanza un poco. Sin arquear la lumbar.',
      'Kneel with one leg forward at a right angle. Before pushing forward, TUCK the pelvis by squeezing the glute of the back leg: you should already feel the stretch at the front of the hip. Only then edge forward. Do not arch the lower back.',
    ),
  },
  {
    id: 'figure-four', kind: 'stretch', zone: 'hip', seconds: 30, perSide: true,
    name: bi('Figura 4 tumbado', 'Lying figure four'),
    cue: bi('Tira del muslo, no de la rodilla', 'Pull the thigh, not the knee'),
    how: bi(
      'Túmbate boca arriba y cruza un tobillo sobre la rodilla contraria formando un 4. Pasa las manos por detrás del muslo de abajo y tira de él hacia el pecho. Empuja suave la rodilla cruzada hacia fuera con el codo. La cabeza y los hombros, en el suelo.',
      'Lie face up and cross one ankle over the opposite knee to make a 4. Reach behind the lower thigh and pull it toward your chest. Gently push the crossed knee away with your elbow. Keep your head and shoulders on the floor.',
    ),
  },
  {
    id: '90-90-hold', kind: 'stretch', zone: 'hip', seconds: 40, perSide: true,
    name: bi('90/90 sostenido', '90/90 hold'),
    cue: bi('Inclínate sobre la pierna de delante', 'Lean over the front leg'),
    how: bi(
      'Sentado con la pierna de delante doblada a 90 grados hacia fuera y la de atrás a 90 grados al lado. Con la espalda recta, inclínate despacio sobre la pierna de delante hasta notar el glúteo. Aguanta respirando y cambia de lado.',
      'Seated with the front leg bent 90 degrees in front and the back leg 90 degrees to the side. With a tall back, lean slowly over the front leg until you feel the glute. Hold and breathe, then switch sides.',
    ),
  },

  // ── PIERNAS ──
  {
    id: 'standing-hamstring', kind: 'stretch', zone: 'legs', seconds: 30, perSide: true,
    name: bi('Isquios de pie', 'Standing hamstring stretch'),
    cue: bi('Espalda recta, baja desde la cadera', 'Flat back, hinge from the hip'),
    how: bi(
      'Adelanta un pie con la pierna estirada y el talón apoyado, punta arriba. Con la ESPALDA RECTA, baja el pecho hacia esa pierna doblando desde la cadera. Si redondeas la espalda, el estiramiento se va a la lumbar y se pierde el del isquio.',
      'Step one foot forward with the leg straight and the heel down, toes up. With a FLAT BACK, lower your chest toward that leg by hinging at the hip. If you round the back, the stretch moves to the lower back and the hamstring loses it.',
    ),
  },
  {
    id: 'standing-quad', kind: 'stretch', zone: 'legs', seconds: 30, perSide: true,
    name: bi('Cuádriceps de pie', 'Standing quad stretch'),
    cue: bi('Rodillas juntas y pelvis metida', 'Knees together and pelvis tucked'),
    how: bi(
      'De pie, sujétate si hace falta. Dobla una rodilla y agarra el tobillo llevándolo hacia el glúteo. Mantén las rodillas juntas y METE la pelvis hacia delante: eso es lo que hace el estiramiento. No arquees la espalda para tirar más del pie.',
      'Standing, hold on if needed. Bend one knee and grab the ankle pulling it toward your glute. Keep the knees together and TUCK the pelvis forward: that is what creates the stretch. Do not arch the back to pull the foot harder.',
    ),
  },
  {
    id: 'wall-calf', kind: 'stretch', zone: 'legs', seconds: 30, perSide: true,
    name: bi('Gemelo en pared', 'Wall calf stretch'),
    cue: bi('Talón en el suelo, pierna de atrás recta', 'Heel down, back leg straight'),
    how: bi(
      'Apoya las manos en la pared con un pie adelantado y el otro atrás. Estira la pierna de atrás con el TALÓN EN EL SUELO y empuja la cadera hacia la pared. El pie de atrás mira al frente: si se abre hacia fuera, el gemelo se escapa.',
      'Place your hands on the wall with one foot forward and the other back. Straighten the back leg with the HEEL DOWN and push your hips toward the wall. The back foot points forward: if it turns out, the calf escapes the stretch.',
    ),
  },
  {
    id: 'soleus-stretch', kind: 'stretch', zone: 'legs', seconds: 30, perSide: true,
    name: bi('Sóleo con rodilla doblada', 'Bent-knee soleus stretch'),
    cue: bi('Igual que el gemelo pero doblando la rodilla', 'Same as the calf but with a bent knee'),
    how: bi(
      'Misma posición que el estiramiento de gemelo, pero DOBLA la rodilla de atrás manteniendo el talón pegado al suelo. Al doblarla, la tensión baja del gemelo al sóleo, que es el músculo profundo. Es un recorrido más corto: no esperes notar tanto.',
      'Same position as the calf stretch, but BEND the back knee while keeping the heel down. Bending shifts the tension from the calf to the soleus, the deeper muscle. The range is shorter: do not expect to feel as much.',
    ),
  },
  {
    id: 'adductor-stretch', kind: 'stretch', zone: 'legs', seconds: 30, perSide: true,
    name: bi('Aductores en zancada lateral', 'Side-lunge adductor stretch'),
    cue: bi('Peso a un lado, la otra pierna recta', 'Weight to one side, other leg straight'),
    how: bi(
      'De pie con los pies muy separados. Dobla una rodilla llevando el peso a ese lado y mantén la otra pierna estirada con la punta del pie al frente. Baja hasta notar la cara interna del muslo de la pierna estirada. Apóyate en el suelo con las manos si hace falta.',
      'Stand with your feet very wide. Bend one knee shifting your weight to that side and keep the other leg straight with the toes forward. Sink until you feel the inner thigh of the straight leg. Put your hands on the floor for support if needed.',
    ),
  },

  // ── TOBILLO ──
  {
    id: 'instep-stretch', kind: 'stretch', zone: 'ankle', seconds: 30, perSide: true,
    name: bi('Estiramiento de empeine', 'Instep stretch'),
    cue: bi('Sentado sobre los talones, empeines abajo', 'Sit on your heels, insteps down'),
    how: bi(
      'Arrodíllate con los empeines planos contra el suelo y siéntate despacio sobre los talones. Notarás la parte de delante del tobillo y la espinilla. Si es demasiado, pon una toalla enrollada bajo los tobillos y ve bajando con las semanas.',
      'Kneel with your insteps flat on the floor and slowly sit back onto your heels. You will feel the front of the ankle and shin. If it is too much, place a rolled towel under the ankles and work lower over the weeks.',
    ),
  },

  // ── MUÑECA ──
  {
    id: 'forearm-extensors', kind: 'stretch', zone: 'wrist', seconds: 30, perSide: true,
    name: bi('Extensores del antebrazo', 'Forearm extensor stretch'),
    cue: bi('Palma hacia abajo, dedos al suelo', 'Palm down, fingers toward the floor'),
    how: bi(
      'Estira un brazo al frente con la palma hacia abajo y deja caer la mano. Con la otra mano tira suave del dorso hacia ti hasta notar la parte de arriba del antebrazo. Codo estirado pero sin bloquear. Sin rebotes.',
      'Extend one arm in front with the palm down and let the hand drop. With the other hand gently pull the back of it toward you until you feel the top of the forearm. Elbow straight but not locked. No bouncing.',
    ),
  },
  {
    id: 'forearm-flexors', kind: 'stretch', zone: 'wrist', seconds: 30, perSide: true,
    name: bi('Flexores del antebrazo', 'Forearm flexor stretch'),
    cue: bi('Palma hacia arriba, dedos hacia ti', 'Palm up, fingers toward you'),
    how: bi(
      'Estira un brazo al frente con la palma hacia ARRIBA y los dedos apuntando al suelo. Con la otra mano tira suave de los dedos hacia ti hasta notar la parte de dentro del antebrazo. Es la que se carga con el agarre pesado y las dominadas.',
      'Extend one arm in front with the palm UP and the fingers pointing down. With the other hand gently pull the fingers toward you until you feel the inside of the forearm. This is the side that gets loaded by heavy grip work and pull-ups.',
    ),
  },
];

export const MOBILITY_ITEMS: MobilityItem[] = [...MOBILITY, ...STRETCH];

/** Ítems de un tipo y una zona, en el orden del catálogo. */
export function itemsFor(kind: MobilityKind, zone: MobilityZone): MobilityItem[] {
  return MOBILITY_ITEMS.filter((m) => m.kind === kind && m.zone === zone);
}

/** Zonas que tienen al menos un ítem de ese tipo (no pintar chips vacíos). */
export function zonesWith(kind: MobilityKind): MobilityZone[] {
  return MOBILITY_ZONES.filter((z) => MOBILITY_ITEMS.some((m) => m.kind === kind && m.zone === z));
}

// ══════════════════════ RUTINAS COMPLETAS ══════════════════════
// Pre y post entreno: secuencias listas para seguir de arriba abajo, cuando no
// quieres elegir zona. Referencian ítems del catálogo por id, así que su texto
// nunca puede contradecir al de la ficha.

export interface FullRoutine {
  id: 'warmup' | 'cooldown';
  title: Bi;
  subtitle: Bi;
  icon: string;
  itemIds: string[];
}

export const FULL_ROUTINES: FullRoutine[] = [
  {
    id: 'warmup',
    title: bi('Antes de entrenar', 'Before training'),
    subtitle: bi('Movilidad de arriba abajo, unos 5 minutos', 'Mobility head to toe, about 5 minutes'),
    icon: 'ri-fire-line',
    itemIds: ['neck-rotations', 'arm-circles', 'pass-throughs', 'thoracic-cat-cow', 'leg-swings', 'deep-squat-hold', 'ankle-circles'],
  },
  {
    id: 'cooldown',
    title: bi('Después de entrenar', 'After training'),
    subtitle: bi('Estiramientos para bajar pulsaciones, unos 4 minutos', 'Stretches to bring the heart rate down, about 4 minutes'),
    icon: 'ri-heart-pulse-line',
    itemIds: ['childs-pose', 'cross-body-shoulder', 'standing-hamstring', 'standing-quad', 'wall-calf', 'figure-four'],
  },
];

const BY_ID = new Map(MOBILITY_ITEMS.map((m) => [m.id, m]));

/** Ítems de una rutina completa, en orden. Ignora ids que ya no existan. */
export function routineItems(r: FullRoutine): MobilityItem[] {
  return r.itemIds.map((id) => BY_ID.get(id)).filter((m): m is MobilityItem => !!m);
}

/** Segundos totales de una lista, contando doble lo que va por lado. */
export function totalSeconds(items: MobilityItem[]): number {
  return items.reduce((a, m) => a + m.seconds * (m.perSide ? 2 : 1), 0);
}

// ── Tick "hecho hoy" en localStorage (sin BD) ──
//
// La clave es "<tipo>:<zona>" o el id de la rutina completa, así que marcar
// "movilidad de hombro" no marca "estiramientos de hombro".
const KEY = 'rankd_mobility_done';
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
type DoneMap = Record<string, string[]>;

function read(): DoneMap {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as DoneMap; } catch { return {}; }
}

export function mobilityDoneToday(): Set<string> {
  const m = read();
  return new Set(m[todayISO()] || []);
}

export function toggleMobilityDone(key: string): Set<string> {
  const m = read();
  const day = todayISO();
  const list = new Set(m[day] || []);
  if (list.has(key)) list.delete(key); else list.add(key);
  m[day] = [...list];
  // Poda: quedarse solo con los últimos ~10 días.
  const days = Object.keys(m).sort().slice(-10);
  const pruned: DoneMap = {};
  days.forEach((d) => { pruned[d] = m[d]; });
  try { localStorage.setItem(KEY, JSON.stringify(pruned)); } catch { /* cuota */ }
  return list;
}
