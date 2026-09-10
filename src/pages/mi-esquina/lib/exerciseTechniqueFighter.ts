// Fichas de técnica del REPERTORIO DE PELEADOR.
//
// Mismo criterio y mismo formato que `exerciseTechnique.ts` (postura inicial →
// movimiento → punto de máxima tensión → vuelta, y después los errores
// típicos). Vive en un archivo aparte solo por tamaño: el diccionario general
// ya pasaba de mil líneas y mezclar los dos habría hecho imposible revisarlos.
//
// `exerciseTechnique.ts` lo importa y lo fusiona, así que para el resto de la
// app no hay diferencia: `techniqueFor()` los resuelve igual.
//
// Contenido estático, informativo y neutro. No promete resultados, no
// prescribe cargas y no da consejo médico. Donde un ejercicio tiene un riesgo
// real (cuello, pliometría, neumático) se dice en los errores, que es donde el
// usuario lo va a leer.

interface Bilingual { es: string; en: string }
export interface FighterFicha { technique: Bilingual[]; mistakes: Bilingual[] }

/** Mismo constructor compacto que el diccionario general. */
const f = (tEs: string[], tEn: string[], mEs: string[], mEn: string[]): FighterFicha => ({
  technique: tEs.map((s, i) => ({ es: s, en: tEn[i] ?? s })),
  mistakes: mEs.map((s, i) => ({ es: s, en: mEn[i] ?? s })),
});

/** Clave: nombre en inglés en minúsculas (coincide con EXERCISE_LIBRARY[i].en). */
export const FICHAS_FIGHTER: Record<string, FighterFicha> = {
  // ══ BARRA DE DOMINADAS Y TRACCIÓN ══
  'chin-ups': f(
    ['Cuélgate con las palmas hacia ti, manos a la anchura de los hombros y brazos estirados', 'Hunde las escápulas antes de tirar: el hombro baja, no se queda colgado muerto', 'Sube llevando los codos hacia las costillas hasta que la barbilla pase la barra', 'Baja controlado hasta estirar del todo, sin soltarte de golpe'],
    ['Hang with palms facing you, hands at shoulder width and arms straight', 'Depress the shoulder blades before pulling: the shoulder sets down, it does not hang dead', 'Pull driving your elbows toward your ribs until the chin clears the bar', 'Lower under control to full extension, without dropping'],
    ['Balancear las piernas para coger impulso', 'Sacar la barbilla estirando el cuello en vez de subir el cuerpo', 'Bajar a plomo y castigar el codo al final'],
    ['Swinging the legs for momentum', 'Craning the neck to get the chin over instead of pulling the body up', 'Dropping fast and hammering the elbow at the bottom'],
  ),
  'wide-grip pull-ups': f(
    ['Agarre prono bastante más ancho que los hombros, brazos estirados y cuerpo quieto', 'Piensa en llevar los codos hacia los costados, no hacia atrás', 'Sube hasta que la barbilla pase la barra manteniendo el pecho hacia la barra', 'Baja despacio; el agarre ancho acorta el recorrido, así que no lo acortes más'],
    ['Pronated grip clearly wider than shoulders, arms straight and body still', 'Think about driving the elbows toward your sides, not backward', 'Pull until the chin clears the bar keeping the chest toward the bar', 'Lower slowly; the wide grip already shortens the range, do not shorten it more'],
    ['Abrir tanto que el hombro trabaja en una posición forzada', 'Quedarse a media subida por elegir un agarre demasiado ancho', 'Encoger los hombros hacia las orejas al tirar'],
    ['Going so wide that the shoulder works in a forced position', 'Stalling halfway because the grip is too wide', 'Shrugging toward the ears while pulling'],
  ),
  'neutral-grip pull-ups': f(
    ['Agarra las dos asas paralelas con las palmas enfrentadas y cuélgate con los brazos estirados', 'Es el agarre más amable para el hombro: úsalo si el prono te molesta', 'Tira llevando los codos abajo y atrás hasta pasar el pecho por las asas', 'Vuelve estirando del todo, sin perder la tensión de la espalda'],
    ['Grab the two parallel handles with palms facing each other and hang with straight arms', 'This is the friendliest grip for the shoulder: use it if pronated bothers you', 'Pull driving the elbows down and back until your chest reaches the handles', 'Return to full extension without dumping the tension in the back'],
    ['Convertirlo en un ejercicio de bíceps tirando solo con los brazos', 'No estirar arriba y trabajar medio recorrido', 'Arquear la espalda baja para llegar más alto'],
    ['Turning it into a biceps exercise by pulling with the arms only', 'Not straightening at the top and working half the range', 'Arching the lower back to reach higher'],
  ),
  'towel pull-ups': f(
    ['Pasa una o dos toallas por la barra y agárralas lo más arriba posible, cerca de la barra', 'El antebrazo va a fallar antes que la espalda: la serie termina cuando el agarre se abre', 'Sube con el cuerpo firme hasta que las manos queden a la altura del pecho', 'Baja controlado y suelta antes de que la toalla se te escurra de golpe'],
    ['Loop one or two towels over the bar and grab them as high as possible, close to the bar', 'The forearm gives out before the back: the set ends when the grip opens', 'Pull with a tight body until your hands reach chest height', 'Lower under control and let go before the towel slips out of your hands'],
    ['Agarrar la toalla muy abajo y perder recorrido', 'Aguantar hasta que el agarre falla de golpe y caer mal', 'Usarlas como trabajo de espalda: aquí manda el agarre'],
    ['Gripping the towel too low and losing range', 'Holding until the grip fails suddenly and landing badly', 'Treating them as back work: here the grip is the limit'],
  ),
  'inverted row': f(
    ['Coloca una barra a la altura de la cadera y ponte debajo, cuerpo estirado y talones apoyados', 'Cuanto más horizontal estés, más pesa: para hacerlo fácil, sube la barra', 'Tira del pecho hacia la barra llevando los codos atrás y aprieta las escápulas arriba', 'Baja despacio hasta estirar los brazos, sin que la cadera se caiga'],
    ['Set a bar at hip height and get underneath, body straight and heels on the floor', 'The more horizontal you are, the heavier it gets: raise the bar to make it easier', 'Pull your chest to the bar driving the elbows back and squeeze the shoulder blades at the top', 'Lower slowly until the arms straighten, without letting the hips sag'],
    ['Dejar caer la cadera y romper la línea del cuerpo', 'Subir solo la barbilla en vez del pecho', 'Recorrido corto por poner el cuerpo demasiado horizontal'],
    ['Letting the hips drop and breaking the body line', 'Bringing only the chin up instead of the chest', 'Short range from setting the body too horizontal'],
  ),
  'rope climb': f(
    ['Agarra la cuerda por encima de la cabeza con las dos manos y muérdela entre los pies', 'La pierna hace la mayor parte del trabajo: pisas la cuerda, te estiras y subes las manos', 'Sube alternando: manos arriba, pies suben, vuelves a pisar y empujas', 'Baja SIEMPRE controlando con los pies; nunca te dejes resbalar por la cuerda'],
    ['Grab the rope overhead with both hands and clamp it between your feet', 'The legs do most of the work: you stand on the rope, extend and move the hands up', 'Climb alternating: hands up, feet up, clamp again and push', 'ALWAYS come down under control with the feet; never slide down the rope'],
    ['Subir solo a brazo y quemarse en dos metros', 'Bajar resbalando y quemarse las manos o las piernas', 'Empezar sin dominar antes el bloqueo con los pies'],
    ['Climbing arms-only and burning out in two metres', 'Sliding down and burning hands or legs', 'Starting before owning the foot lock'],
  ),
  'dead hang': f(
    ['Cuélgate de la barra con las manos a la anchura de los hombros y los brazos estirados del todo', 'Deja el hombro activo, no hundido del todo: baja las escápulas ligeramente', 'Aguanta respirando tranquilo, con las piernas quietas y el abdomen firme', 'Bájate antes de que el agarre falle, no cuando ya te estás soltando'],
    ['Hang from the bar with hands at shoulder width and arms fully straight', 'Keep the shoulder active, not fully collapsed: depress the blades slightly', 'Hold breathing calmly, legs still and abs braced', 'Come down before the grip fails, not when you are already slipping'],
    ['Colgarse muerto del todo con el hombro hundido en el encaje', 'Balancearse y convertirlo en un columpio', 'Aguantar hasta caerse en vez de bajar tú'],
    ['Hanging fully passive with the shoulder collapsed into the joint', 'Swinging and turning it into a pendulum', 'Holding until you fall instead of getting down yourself'],
  ),

  // ══ EMPUJE CON EL PROPIO PESO ══
  'hindu push-ups': f(
    ['Empieza en V invertida: manos y pies apoyados, cadera alta y espalda estirada', 'Baja el pecho pasando cerca del suelo, como si te colaras por debajo de una valla', 'Termina con los brazos estirados, la cadera baja y el pecho abierto mirando arriba', 'Vuelve al inicio deshaciendo el recorrido o levantando la cadera directamente'],
    ['Start in a downward V: hands and feet down, hips high and back long', 'Lower your chest passing close to the floor, as if sliding under a fence', 'Finish with arms straight, hips low and chest open looking up', 'Return by reversing the path or lifting the hips straight back'],
    ['Hacer el recorrido a tirones en vez de fluido', 'Forzar la espalda baja al abrir el pecho arriba', 'Dejar los codos abiertos del todo al pasar por abajo'],
    ['Doing the path in jerks instead of flowing', 'Cranking the lower back when opening the chest at the top', 'Letting the elbows flare wide on the way through'],
  ),
  'feet-elevated push-ups': f(
    ['Pon los pies en un banco o cajón y las manos algo más abiertas que los hombros', 'Cuanto más alto el apoyo, más peso va al pecho alto y al hombro', 'Baja el pecho hasta rozar el suelo con el cuerpo en línea, codos a unos 45 grados', 'Empuja hasta estirar los brazos sin dejar que la cadera se hunda'],
    ['Put your feet on a bench or box and hands slightly wider than shoulders', 'The higher the support, the more load goes to the upper chest and shoulder', 'Lower your chest to touch the floor with the body in line, elbows around 45 degrees', 'Press to straight arms without letting the hips sag'],
    ['Sacar la cadera hacia arriba para que sea más fácil', 'Bajar solo la cabeza y no el pecho', 'Poner los pies tan altos que se convierte en un press de hombro mal hecho'],
    ['Piking the hips up to make it easier', 'Lowering only the head and not the chest', 'Setting the feet so high it becomes a badly done shoulder press'],
  ),
  'diamond push-ups': f(
    ['Manos juntas bajo el pecho formando un triángulo con índices y pulgares', 'Codos pegados al cuerpo durante todo el recorrido: son ellos los que mandan', 'Baja hasta rozar las manos con el esternón, cuerpo en línea', 'Empuja hasta estirar del todo apretando el tríceps arriba'],
    ['Hands together under the chest forming a triangle with index fingers and thumbs', 'Elbows tucked close throughout: they are what drives the movement', 'Lower until your sternum touches your hands, body in line', 'Press to full extension squeezing the triceps at the top'],
    ['Abrir los codos y convertirlo en una flexión normal', 'Bajar la cadera antes que el pecho', 'Forzar la muñeca poniendo las manos demasiado juntas'],
    ['Flaring the elbows and turning it into a regular push-up', 'Dropping the hips before the chest', 'Straining the wrist by placing the hands too close'],
  ),
  'pike push-ups': f(
    ['Ponte en V invertida con la cadera lo más alta posible y las manos a la anchura de los hombros', 'Cuanto más vertical esté el tronco, más se parece a un press de hombro', 'Baja la coronilla hacia el suelo por delante de las manos, codos hacia los lados', 'Empuja hasta estirar los brazos volviendo a la V'],
    ['Get into a downward V with hips as high as possible and hands at shoulder width', 'The more vertical the torso, the closer it is to a shoulder press', 'Lower the crown of your head toward the floor in front of your hands, elbows out to the sides', 'Press back to straight arms returning to the V'],
    ['Bajar la cabeza entre las manos y convertirlo en una flexión', 'Apoyar la cabeza en el suelo para descansar', 'Cadera baja: deja de trabajar el hombro'],
    ['Lowering the head between the hands and turning it into a push-up', 'Resting the head on the floor between reps', 'Low hips: the shoulder stops working'],
  ),
  'handstand push-ups': f(
    ['Sube a pino contra la pared con las manos algo más abiertas que los hombros', 'Abdomen y glúteo apretados: el cuerpo es una tabla, no un plátano', 'Baja controlado hasta rozar la coronilla con el suelo y empuja hasta estirar', 'Si no controlas la bajada, haz el recorrido parcial antes que dejarte caer'],
    ['Kick up to a wall handstand with hands slightly wider than shoulders', 'Abs and glutes tight: the body is a plank, not a banana', 'Lower under control until the crown touches the floor and press to full extension', 'If you cannot control the descent, work a partial range rather than dropping'],
    ['Dejarse caer de cabeza sin control', 'Arquear la espalda baja para compensar', 'Intentarlo sin dominar antes el pino y las flexiones en pica'],
    ['Dropping onto the head without control', 'Arching the lower back to compensate', 'Trying it before owning the handstand hold and pike push-ups'],
  ),

  // ══ HOMBRO DE ASALTO ══
  'shadow boxing with dumbbells': f(
    ['Coge dos mancuernas MUY ligeras (1-2 kg) y ponte en guardia', 'Lanza tu repertorio normal con el recorrido completo: el peso no cambia la técnica', 'Mantén la guardia arriba entre golpe y golpe; es ahí donde se acumula la fatiga', 'Al terminar el asalto, suelta las mancuernas y lanza unos segundos sin peso'],
    ['Take two VERY light dumbbells (1-2 kg) and set your guard', 'Throw your usual repertoire with full range: the weight does not change the technique', 'Keep the guard up between shots; that is where the fatigue builds', 'When the round ends, drop the dumbbells and throw a few seconds unweighted'],
    ['Usar peso alto y deformar la mecánica del golpe', 'Extender el codo a fondo con peso y castigar la articulación', 'Bajar la guardia en cuanto aprieta el hombro, que es justo lo que se entrena'],
    ['Using heavy weight and deforming the punching mechanics', 'Snapping the elbow to full lockout under load and hammering the joint', 'Dropping the guard as soon as the shoulder burns, which is exactly what you are training'],
  ),
  'battle rope circles': f(
    ['Un extremo de la cuerda en cada mano, pies a la anchura de la cadera y rodillas algo flexionadas', 'Dibuja círculos con las dos manos a la vez, hacia fuera o hacia dentro', 'Mantén el tronco firme y los brazos casi estirados: el movimiento sale del hombro', 'Cambia de sentido a mitad del tiempo para repartir el trabajo'],
    ['One rope end in each hand, feet hip width and knees slightly bent', 'Draw circles with both hands at once, outward or inward', 'Keep the torso solid and the arms nearly straight: the movement comes from the shoulder', 'Switch direction halfway through to share the work'],
    ['Mover el tronco en vez de los brazos', 'Círculos tan pequeños que la cuerda apenas se mueve', 'Encoger los hombros hacia las orejas durante todo el intervalo'],
    ['Moving the torso instead of the arms', 'Circles so small the rope barely moves', 'Shrugging toward the ears for the whole interval'],
  ),

  // ══ PIERNA SIN MÁQUINAS ══
  'hindu squat': f(
    ['De pie, pies a la anchura de los hombros y brazos relajados delante', 'Baja levantando los talones y llevando los brazos atrás, como remando', 'Abajo, el peso queda en la punta del pie y las rodillas pasan del pie: es parte del ejercicio', 'Sube empujando con la punta y llevando los brazos adelante, con ritmo continuo'],
    ['Standing, feet at shoulder width and arms relaxed in front', 'Descend lifting the heels and sweeping the arms back, like rowing', 'At the bottom the weight is on the ball of the foot and the knees travel past the toes: that is part of the exercise', 'Come up pushing off the ball of the foot and sweeping the arms forward, in a continuous rhythm'],
    ['Hacerla con carga o con prisa antes de dominar el recorrido', 'Rebotar abajo en vez de controlar', 'Insistir si la rodilla molesta: es una sentadilla con mucha rodilla por diseño'],
    ['Doing it loaded or fast before owning the range', 'Bouncing at the bottom instead of controlling', 'Pushing through knee pain: by design this squat loads the knee a lot'],
  ),
  'pistol squat': f(
    ['De pie sobre una pierna, la otra estirada al frente y los brazos como contrapeso', 'Baja despacio manteniendo el talón de apoyo pegado al suelo', 'Abajo, muslo por debajo de la paralela y la pierna libre sin tocar el suelo', 'Sube empujando con el talón sin girar la rodilla hacia dentro'],
    ['Standing on one leg, the other extended forward and arms as a counterweight', 'Lower slowly keeping the supporting heel glued to the floor', 'At the bottom the thigh is below parallel and the free leg does not touch the floor', 'Drive up through the heel without letting the knee cave inward'],
    ['Levantar el talón y perder el equilibrio hacia delante', 'Dejar caer el cuerpo abajo en vez de controlar', 'Intentarla sin la movilidad de tobillo necesaria: primero, versión asistida'],
    ['Lifting the heel and losing balance forward', 'Dumping into the bottom instead of controlling', 'Trying it without the ankle mobility it needs: start with an assisted version'],
  ),
  'wall sit': f(
    ['Espalda pegada a la pared y pies adelantados, a la anchura de la cadera', 'Baja hasta que rodillas y caderas formen 90 grados, con las espinillas verticales', 'Aguanta con todo el peso en los talones y la espalda pegada a la pared', 'Al terminar, sube empujando con las piernas, sin apoyarte en las manos'],
    ['Back against the wall and feet forward, hip width apart', 'Slide down until knees and hips make 90 degrees, with the shins vertical', 'Hold with the weight on your heels and the back flat against the wall', 'To finish, push up with the legs, without pressing on your hands'],
    ['Apoyar las manos en los muslos para descansar', 'Quedarse por encima de los 90 grados y creer que cuenta igual', 'Aguantar la respiración durante todo el tiempo'],
    ['Resting the hands on the thighs to take load off', 'Staying above 90 degrees and counting it the same', 'Holding your breath for the whole set'],
  ),
  'duck walk': f(
    ['Ponte en cuclillas profundas con el pecho lo más alto que puedas', 'Avanza dando pasos cortos SIN levantarte: la cadera se queda abajo', 'Mantén la mirada al frente y el abdomen firme para no caer hacia delante', 'Al terminar la distancia, levántate despacio y estira el cuádriceps'],
    ['Get into a deep squat with the chest as tall as you can keep it', 'Walk forward with short steps WITHOUT standing up: the hips stay low', 'Keep your eyes forward and the abs braced so you do not fall forward', 'When the distance is done, stand up slowly and stretch the quads'],
    ['Levantarse a media distancia y seguir andando de pie', 'Hacerlo con la espalda muy redondeada', 'Meter distancias largas de golpe: castiga mucho la rodilla'],
    ['Standing up halfway and continuing on your feet', 'Doing it with a heavily rounded back', 'Jumping into long distances: it is very demanding on the knee'],
  ),
  'frog jumps': f(
    ['Ponte en cuclillas con los pies algo más abiertos que los hombros y las manos delante', 'Salta hacia delante y arriba a la vez, extendiendo cadera, rodilla y tobillo', 'Cae con los pies planos y absorbe volviendo a la cuclilla, sin frenar en seco', 'Encadena el siguiente salto solo cuando hayas estabilizado la caída'],
    ['Squat down with feet slightly wider than shoulders and hands in front', 'Jump forward and up at the same time, extending hip, knee and ankle', 'Land flat-footed and absorb by returning to the squat, without a hard stop', 'Chain the next jump only once the landing is stable'],
    ['Caer con las rodillas hacia dentro', 'Encadenar saltos a toda prisa perdiendo la técnica de caída', 'Hacerlos sobre suelo duro y sin calentar el tobillo'],
    ['Landing with the knees caving inward', 'Chaining jumps in a rush and losing the landing mechanics', 'Doing them on hard ground with cold ankles'],
  ),

  // ══ CORE QUE AGUANTA EL IMPACTO Y GIRA ══
  'windshield wipers': f(
    ['Tumbado boca arriba con los brazos en cruz, sube las piernas hasta la vertical', 'Baja las piernas juntas hacia un lado sin que los hombros se despeguen del suelo', 'Para antes de tocar el suelo y vuelve al centro controlando el giro', 'Alterna lados con el mismo control; el rango lo marcan tus hombros, no tus piernas'],
    ['Lying face up with arms out to the sides, raise your legs to vertical', 'Lower both legs together to one side without letting the shoulders peel off the floor', 'Stop before touching the floor and return to the centre controlling the rotation', 'Alternate sides with the same control; your shoulders set the range, not your legs'],
    ['Dejar caer las piernas por peso en vez de controlarlas', 'Despegar el hombro contrario y girar toda la espalda', 'Hacerlas con las piernas estiradas antes de controlarlas dobladas'],
    ['Letting the legs drop with gravity instead of controlling them', 'Peeling the opposite shoulder off and rotating the whole back', 'Doing them with straight legs before you can control them bent'],
  ),
  'v-ups': f(
    ['Tumbado boca arriba, brazos estirados por encima de la cabeza y piernas juntas', 'Sube tronco y piernas a la vez buscando tocar los pies con las manos', 'Arriba, el cuerpo forma una V y el peso queda sobre el glúteo', 'Baja controlando hasta rozar el suelo con manos y talones, sin apoyar del todo'],
    ['Lying face up, arms extended overhead and legs together', 'Raise torso and legs at the same time reaching your hands toward your feet', 'At the top the body makes a V and the weight sits on the glutes', 'Lower under control until hands and heels graze the floor, without fully resting'],
    ['Subir a tirones usando impulso de los brazos', 'Doblar las rodillas para llegar más arriba', 'Tirar del cuello con las manos'],
    ['Jerking up using arm momentum', 'Bending the knees to reach higher', 'Pulling on the neck with the hands'],
  ),
  'shoulder tap plank': f(
    ['Posición de plancha alta con las manos bajo los hombros y los pies algo separados', 'Aprieta abdomen y glúteo: la cadera NO debe girar ni un centímetro', 'Toca el hombro contrario con una mano y vuelve a apoyar; alterna sin prisa', 'Cuanto más juntes los pies, más difícil; sepáralos si la cadera se mueve'],
    ['High plank with hands under the shoulders and feet slightly apart', 'Brace abs and glutes: the hips must NOT rotate an inch', 'Tap the opposite shoulder with one hand and place it back; alternate without rushing', 'The closer your feet, the harder it is; widen them if the hips move'],
    ['Balancear la cadera con cada toque', 'Ir rápido y perder la posición del tronco', 'Dejar caer la zona lumbar'],
    ['Rocking the hips on every tap', 'Going fast and losing torso position', 'Letting the lower back sag'],
  ),
  'dead bug': f(
    ['Tumbado boca arriba, brazos hacia el techo y caderas y rodillas a 90 grados', 'Pega la zona lumbar al suelo y mantenla pegada TODO el ejercicio', 'Baja un brazo y la pierna contraria hasta rozar el suelo, sin arquear la espalda', 'Vuelve al centro y alterna; el rango lo marca hasta dónde puedes sin despegar la lumbar'],
    ['Lying face up, arms toward the ceiling and hips and knees at 90 degrees', 'Press the lower back into the floor and keep it there the WHOLE time', 'Lower one arm and the opposite leg until they graze the floor, without arching the back', 'Return to the centre and alternate; the range is how far you can go without the lower back lifting'],
    ['Arquear la lumbar al estirar la pierna', 'Aguantar la respiración en vez de exhalar al bajar', 'Ir demasiado rápido y perder el control'],
    ['Arching the lower back when the leg extends', 'Holding your breath instead of exhaling on the way down', 'Going too fast and losing control'],
  ),
  'bird dog': f(
    ['A cuatro patas, manos bajo los hombros y rodillas bajo las caderas', 'Espalda neutra: imagina un vaso de agua en la zona lumbar que no puede volcarse', 'Estira a la vez un brazo y la pierna contraria hasta la horizontal y mantén un instante', 'Vuelve al apoyo con control y cambia de lado'],
    ['On all fours, hands under the shoulders and knees under the hips', 'Neutral back: imagine a glass of water on your lower back that must not tip', 'Extend one arm and the opposite leg to horizontal at the same time and hold for a moment', 'Return to the floor with control and switch sides'],
    ['Subir la pierna por encima de la horizontal y arquear la lumbar', 'Girar la cadera al estirar la pierna', 'Mirar hacia arriba y forzar el cuello'],
    ['Raising the leg above horizontal and arching the lower back', 'Rotating the hip when the leg extends', 'Looking up and cranking the neck'],
  ),
  'landmine rotation': f(
    ['Encaja un extremo de la barra en la esquina o en el soporte y agarra el otro con las dos manos', 'De pie, brazos casi estirados y la barra a la altura del pecho', 'Lleva la barra de un lado a otro girando desde la CADERA, dejando que el pie de atrás pivote', 'Controla el cambio de sentido: la barra no debe caer sola de un lado al otro'],
    ['Wedge one end of the bar into the corner or the holder and grab the other with both hands', 'Standing, arms nearly straight and the bar at chest height', 'Take the bar from side to side rotating from the HIPS, letting the rear foot pivot', 'Control the change of direction: the bar must not fall from one side to the other on its own'],
    ['Girar solo con los brazos y la espalda baja', 'Dejar los pies clavados y torcer la rodilla', 'Meter tanto peso que el recorrido se descontrola'],
    ['Rotating with the arms and lower back only', 'Keeping the feet planted and twisting the knee', 'Loading so much that the path goes out of control'],
  ),
  'med ball sit-up throw': f(
    ['Siéntate con las rodillas dobladas y el balón sujeto en el pecho o por encima de la cabeza', 'Baja el tronco controlando hasta tocar el suelo con la espalda alta', 'Sube en un solo movimiento y lanza el balón contra la pared o a un compañero', 'Recoge y encadena: el trabajo está en no perder la posición entre repetición y repetición'],
    ['Sit with knees bent and the ball held at your chest or overhead', 'Lower the torso under control until your upper back touches the floor', 'Come up in one motion and throw the ball against the wall or to a partner', 'Catch and chain: the work is in not losing position between reps'],
    ['Lanzar con los brazos sin que suba el tronco', 'Engancharse los pies y tirar con el flexor de la cadera', 'Usar un balón que rebota si estás lanzando contra la pared'],
    ['Throwing with the arms without the torso coming up', 'Hooking the feet and pulling with the hip flexors', 'Using a bouncy ball if you are throwing against a wall'],
  ),
  'lateral neck isometric': f(
    ['De pie o sentado, coloca la palma en un lado de la cabeza, por encima de la oreja', 'Empuja la cabeza contra la mano SIN que la cabeza se mueva: es una isometría', 'Sube la fuerza poco a poco hasta un nivel medio y mantenla, respirando con normalidad', 'Baja la fuerza igual de despacio y cambia de lado'],
    ['Standing or seated, place your palm on one side of your head, above the ear', 'Press your head into your hand WITHOUT the head moving: it is an isometric', 'Build the force gradually to a moderate level and hold it, breathing normally', 'Release just as gradually and switch sides'],
    ['Empujar a tope de golpe en vez de subir la fuerza poco a poco', 'Dejar que la cabeza ceda y convertirlo en un movimiento', 'Seguir si aparece hormigueo, mareo o dolor: eso se para y se consulta'],
    ['Pushing all-out at once instead of building the force gradually', 'Letting the head give way and turning it into a movement', 'Continuing if tingling, dizziness or pain appear: stop and get it checked'],
  ),
  'banded neck work': f(
    ['Sujeta la banda a un punto fijo a la altura de la cabeza y pásala por la frente o la nuca', 'Aléjate hasta que la banda tenga tensión y coloca los pies firmes', 'Mueve la cabeza en el recorrido que toque (adelante, atrás o lateral) muy despacio', 'Vuelve controlando: la banda no debe tirar de tu cuello de vuelta'],
    ['Anchor the band at head height and pass it around your forehead or the back of your head', 'Step away until the band has tension and set your feet firmly', 'Move the head through the chosen range (forward, backward or lateral) very slowly', 'Return under control: the band must not yank your neck back'],
    ['Usar una banda demasiado dura y perder el control del recorrido', 'Hacerlo rápido o a tirones', 'Empezar con este trabajo antes que con las isometrías'],
    ['Using a band that is too strong and losing control of the range', 'Doing it fast or in jerks', 'Starting here instead of with the isometric holds'],
  ),
  "wrestler's bridge": f(
    ['Tumbado boca arriba con las rodillas dobladas, lleva las manos junto a las orejas', 'Levanta la cadera y apoya progresivamente el peso en la parte alta de la espalda y las manos', 'Solo cuando ese apoyo sea cómodo, reparte algo de peso hacia la coronilla, sin girar la cabeza', 'Baja deshaciendo el movimiento con el mismo control con el que subiste'],
    ['Lying face up with knees bent, bring your hands beside your ears', 'Lift the hips and progressively load the upper back and the hands', 'Only when that feels comfortable, shift some weight toward the crown of the head, without turning the head', 'Come down reversing the movement with the same control you used going up'],
    ['Cargar el cuello desde el primer día en vez de progresar durante semanas con las manos', 'Girar la cabeza con peso encima: es el gesto que lesiona', 'Hacerlo con molestias de cuello o de espalda previas, o sin alguien que lo supervise'],
    ['Loading the neck from day one instead of progressing for weeks with the hands taking the weight', 'Turning the head while loaded: that is the movement that injures', 'Doing it with a pre-existing neck or back issue, or without someone supervising'],
  ),

  // ══ POTENCIA Y GOLPEO ══
  'plyo push-up': f(
    ['Posición de flexión con las manos bajo los hombros y el cuerpo en línea', 'Baja controlando hasta que el pecho casi toca el suelo', 'Empuja con toda la fuerza que puedas hasta despegar las manos del suelo', 'Cae con los codos algo doblados y encadena la siguiente bajando otra vez controlado'],
    ['Push-up position with hands under the shoulders and body in line', 'Lower under control until the chest almost touches the floor', 'Press as hard as you can until the hands leave the floor', 'Land with the elbows slightly bent and chain the next rep lowering under control again'],
    ['Caer con los brazos rígidos y bloqueados', 'Hacer series largas: la potencia se entrena fresco, no cansado', 'Empezar sin hacer antes flexiones normales con soltura'],
    ['Landing with stiff, locked arms', 'Doing long sets: power is trained fresh, not fatigued', 'Starting before you can do regular push-ups comfortably'],
  ),
  'clapping push-ups': f(
    ['Flexión normal con el cuerpo firme y los pies a la anchura de la cadera', 'Baja controlado y empuja con la máxima intensidad posible', 'Da la palmada en el aire y vuelve a colocar las manos ANTES de caer', 'Amortigua doblando los codos y encadena solo si mantienes la técnica'],
    ['Regular push-up with a tight body and feet at hip width', 'Lower under control and press with maximum intensity', 'Clap in the air and get the hands back down BEFORE you land', 'Absorb by bending the elbows and only chain reps if the technique holds'],
    ['Intentar la palmada sin despegarse lo suficiente', 'Caer de bruces por llegar tarde con las manos', 'Sacar la cadera arriba para ganar impulso'],
    ['Attempting the clap without enough air', 'Landing on your face because the hands come back late', 'Piking the hips up to get momentum'],
  ),
  'depth jump': f(
    ['Ponte de pie en un cajón bajo (empieza por 30-40 cm) con los pies a la anchura de la cadera', 'DÉJATE CAER al suelo, no saltes desde el cajón: el objetivo es la caída', 'En cuanto tocas el suelo, salta hacia arriba lo antes posible y lo más alto que puedas', 'Cae con las rodillas alineadas y descansa entre repeticiones: esto es potencia, no acondicionamiento'],
    ['Stand on a low box (start at 30-40 cm) with feet at hip width', 'STEP OFF and drop to the floor, do not jump off the box: the drop is the point', 'The moment you touch the floor, jump up as fast and as high as you can', 'Land with aligned knees and rest between reps: this is power work, not conditioning'],
    ['Usar un cajón demasiado alto y pasar medio segundo en el suelo', 'Encadenar repeticiones sin descanso: deja de ser trabajo de potencia', 'Hacerlo con las piernas cansadas o sin base previa de fuerza'],
    ['Using too high a box and spending half a second on the floor', 'Chaining reps without rest: it stops being power work', 'Doing it on tired legs or without a strength base'],
  ),
  'sledgehammer strikes': f(
    ['Coloca el neumático delante, separa los pies y agarra el mazo con las dos manos', 'La mano de abajo se queda fija; la de arriba DESLIZA hacia ella durante el golpe', 'Sube el mazo por encima del hombro y golpea acelerando con la cadera, no solo con los brazos', 'Deja que rebote y recoloca; cambia de lado a mitad del intervalo'],
    ['Set the tyre in front of you, feet apart, and grab the hammer with both hands', 'The bottom hand stays fixed; the top hand SLIDES down to meet it during the strike', 'Raise the hammer past your shoulder and strike accelerating from the hips, not just the arms', 'Let it bounce and reset; switch sides halfway through the interval'],
    ['Golpear solo con los brazos y cargar la espalda baja', 'No cambiar de lado y trabajar solo una rotación', 'Usar un mazo demasiado pesado y perder el control del recorrido'],
    ['Striking with the arms only and loading the lower back', 'Not switching sides and training only one rotation', 'Using too heavy a hammer and losing control of the path'],
  ),
  'tyre flip': f(
    ['Ponte pegado al neumático con el pecho apoyado en él y los pies atrás', 'Mete las manos por debajo del borde, espalda recta y cadera abajo: es un peso muerto, no un curl', 'Extiende las piernas empujando hacia arriba y adelante y, al llegar a la altura del pecho, cambia las manos y empuja', 'Acompaña la caída y recolócate antes de la siguiente'],
    ['Get right up against the tyre with your chest on it and feet back', 'Get your hands under the edge, back flat and hips down: this is a deadlift, not a curl', 'Extend the legs driving up and forward and, at chest height, switch the hands and push', 'Follow the tyre down and reset before the next rep'],
    ['Tirar con la espalda redondeada', 'Separarse del neumático y tirar en horizontal', 'Empezar con un neumático que no puedes voltear con técnica limpia'],
    ['Pulling with a rounded back', 'Standing away from the tyre and pulling horizontally', 'Starting with a tyre you cannot flip with clean technique'],
  ),
  'alternating rope waves': f(
    ['Un extremo en cada mano, pies a la anchura de los hombros y rodillas algo flexionadas', 'Cadera atrás y pecho ligeramente adelante: la postura es de atleta, no de pie recto', 'Sube y baja los brazos alternando, generando olas que lleguen hasta el anclaje', 'Mantén el ritmo todo el intervalo; el trabajo es que las olas no se apaguen'],
    ['One end in each hand, feet at shoulder width and knees slightly bent', 'Hips back and chest slightly forward: athletic stance, not standing upright', 'Raise and lower the arms alternately, sending waves all the way to the anchor', 'Hold the rhythm for the whole interval; the work is keeping the waves alive'],
    ['Quedarse de pie recto y mover solo las muñecas', 'Bajar el ritmo hasta que las olas se apagan a medio camino', 'Encoger los hombros durante todo el intervalo'],
    ['Standing upright and moving only the wrists', 'Slowing until the waves die halfway to the anchor', 'Shrugging the shoulders for the whole interval'],
  ),
  'double rope waves': f(
    ['Misma postura que en las alternas, con un extremo en cada mano', 'Mueve LOS DOS brazos a la vez arriba y abajo, acompañando con una flexión de rodilla', 'La cadera trabaja en cada onda: no es un movimiento solo de brazo', 'Aguanta la amplitud hasta el final del intervalo, no solo los primeros segundos'],
    ['Same stance as the alternating version, one end in each hand', 'Move BOTH arms up and down together, adding a knee bend on each wave', 'The hips work on every wave: it is not an arms-only movement', 'Keep the amplitude to the end of the interval, not just the first seconds'],
    ['Hacerlo sin acompañar con las piernas', 'Perder amplitud a los diez segundos y seguir moviendo las manos', 'Arquear la espalda baja en cada onda'],
    ['Doing it without the legs joining in', 'Losing amplitude after ten seconds and just moving the hands', 'Arching the lower back on every wave'],
  ),
  'rope slams': f(
    ['Un extremo en cada mano, pies a la anchura de los hombros', 'Sube las dos manos por encima de la cabeza extendiéndote del todo', 'Golpea la cuerda contra el suelo con fuerza acompañando con la cadera y una sentadilla corta', 'Recoge y encadena; cada repetición empieza otra vez desde arriba del todo'],
    ['One end in each hand, feet at shoulder width', 'Raise both hands overhead extending fully', 'Slam the rope into the floor hard, driving with the hips and a short squat', 'Reset and chain; every rep starts again from full extension'],
    ['Golpear solo con los brazos sin usar la cadera', 'No subir del todo y recortar el recorrido a la mitad', 'Redondear la espalda al bajar en cada golpe'],
    ['Slamming with the arms only without using the hips', 'Not going fully overhead and cutting the range in half', 'Rounding the back on every slam'],
  ),
  'banded punch': f(
    ['Ancla la banda detrás de ti a la altura del pecho y pásala por debajo de la axila', 'Ponte en guardia con la banda ya en tensión y el pie de atrás listo para pivotar', 'Lanza el golpe con la mecánica de siempre: pivota el pie, gira la cadera y extiende', 'Recoge la mano a la guardia CONTROLANDO la banda, que es donde está la mitad del trabajo'],
    ['Anchor the band behind you at chest height and run it under your armpit', 'Set your guard with the band already under tension and the rear foot ready to pivot', 'Throw the punch with your usual mechanics: pivot the foot, turn the hip and extend', 'Bring the hand back to the guard CONTROLLING the band, which is where half the work is'],
    ['Dejar que la banda te devuelva el brazo de golpe', 'Bloquear el codo a fondo con tensión', 'Usar una banda tan dura que cambia la mecánica del golpe'],
    ['Letting the band snap your arm back', 'Locking the elbow out hard under tension', 'Using a band so strong it changes the punching mechanics'],
  ),

  // ══ SUELO Y DESPLAZAMIENTO ══
  'bear crawl': f(
    ['A cuatro patas con las rodillas justo despegadas del suelo, unos centímetros', 'Manos bajo los hombros y rodillas bajo las caderas: la espalda queda plana como una mesa', 'Avanza moviendo mano y pie CONTRARIOS a la vez, con pasos cortos', 'La cadera no debe balancearse: si se mueve, acorta el paso'],
    ['On all fours with the knees hovering just a few centimetres off the floor', 'Hands under the shoulders and knees under the hips: the back stays flat like a table', 'Move the OPPOSITE hand and foot together, with short steps', 'The hips must not sway: if they do, shorten the step'],
    ['Subir la cadera y convertirlo en un paseo de oso alto', 'Dar pasos largos y balancearse de lado a lado', 'Dejar caer la cabeza y perder la línea del cuello'],
    ['Piking the hips up and turning it into a high bear walk', 'Taking long steps and swaying side to side', 'Letting the head drop and losing the neck line'],
  ),
  sprawl: f(
    ['De pie en guardia, con el peso repartido y las rodillas algo flexionadas', 'Lanza las piernas atrás de golpe y deja caer la cadera al suelo, con el pecho alto', 'El objetivo es que la cadera baje ANTES que el pecho: por eso frena un derribo', 'Recoge los pies debajo del cuerpo y vuelve a la guardia lo más rápido que puedas'],
    ['Standing in your stance, weight balanced and knees slightly bent', 'Kick the legs back sharply and drop the hips to the floor, chest tall', 'The point is that the hips drop BEFORE the chest: that is what stops a takedown', 'Bring the feet back under you and return to your stance as fast as you can'],
    ['Caer de pecho como en un burpee en vez de hundir la cadera', 'Levantarse despacio: la mitad del ejercicio es volver a la guardia', 'Dejar caer las rodillas de golpe sobre suelo duro'],
    ['Landing chest-first like a burpee instead of sinking the hips', 'Getting up slowly: half the drill is returning to your stance', 'Slamming the knees onto a hard floor'],
  ),
};
