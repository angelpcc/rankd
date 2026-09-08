// Fichas de técnica por ejercicio.
//
// Contenido estático informativo y neutro: cómo se ejecuta el movimiento y qué
// fallos son los típicos. NO promete resultados, no prescribe cargas y no da
// consejos médicos. Cubre los 165 ejercicios de la biblioteca.
//
// Cada ficha describe, en este orden:
//   1. Postura inicial (dónde te colocas y cómo agarras)
//   2. Movimiento (qué recorre y con qué)
//   3. Punto de máxima contracción (dónde aprieta y qué hacer allí)
//   4. Vuelta / control (cómo se baja o se regresa)
// Y después los errores típicos que anulan el ejercicio o hacen daño.
//
// Los músculos secundarios y el material NO se escriben aquí: se derivan de
// EXERCISE_LIBRARY (campos `secondary` y `equipment`) y los traduce la tarjeta
// con las claves mc_str_mg_* y mc_eq_*. Así no pueden contradecirse.
//
// Uso: `techniqueFor(name, lang)` devuelve la ficha, o null si el ejercicio no
// está en la biblioteca. El nombre se normaliza sin acentos y sin distinguir
// mayúsculas, así que casa "Press banca con barra", "press banca" (alias
// antiguo) y el nombre en inglés.

import { EXERCISE_LIBRARY, type Equipment, type MuscleGroup } from './exercises';

type Lang = 'es' | 'en';

interface Bilingual { es: string; en: string }
interface FichaRaw { technique: Bilingual[]; mistakes: Bilingual[] }

/**
 * Construye una ficha desde cuatro listas paralelas: técnica en español, la
 * misma en inglés, errores en español y errores en inglés. Es mucho más
 * compacto que repetir `{ es, en }` en cada línea, y el script de verificación
 * `npm run check:tech` comprueba que las listas tienen la misma longitud.
 */
const f = (tEs: string[], tEn: string[], mEs: string[], mEn: string[]): FichaRaw => ({
  technique: tEs.map((s, i) => ({ es: s, en: tEn[i] ?? s })),
  mistakes: mEs.map((s, i) => ({ es: s, en: mEn[i] ?? s })),
});

// ── DICCIONARIO DE FICHAS ──
// Clave: nombre en inglés en minúsculas (coincide con EXERCISE_LIBRARY[i].en).
const FICHAS: Record<string, FichaRaw> = {
  // ══ ESPALDA ══
  'pull-ups': f(
    ['Cuélgate de la barra con las manos algo más abiertas que los hombros y los brazos estirados', 'Activa los hombros hacia abajo antes de tirar: hunde las escápulas, no te quedes colgado muerto', 'Tira llevando los codos hacia el suelo hasta que la barbilla pase la barra', 'Baja despacio hasta estirar del todo, sin soltarte de golpe'],
    ['Hang from the bar with hands slightly wider than shoulders and arms straight', 'Set your shoulders down before pulling: depress the shoulder blades, do not hang dead', 'Pull driving your elbows toward the floor until your chin clears the bar', 'Lower slowly to full extension, without dropping'],
    ['Balancear las piernas para coger impulso', 'Quedarse a media subida sin pasar la barbilla', 'Subir con los hombros encogidos hacia las orejas'],
    ['Swinging the legs for momentum', 'Stopping halfway without clearing the chin', 'Pulling with shoulders shrugged toward the ears'],
  ),
  'weighted pull-ups': f(
    ['Coloca el lastre en un cinturón o entre los pies y cuélgate con los brazos estirados', 'Empieza el tirón desde escápulas hundidas, sin balanceo, porque el peso extra invita a coger impulso', 'Sube hasta que la barbilla pase la barra manteniendo el tronco firme', 'Baja controlado; con lastre la bajada es la parte que más exige'],
    ['Attach the load to a belt or hold it between your feet and hang with straight arms', 'Start the pull from depressed shoulder blades, no swinging: extra load invites momentum', 'Pull until your chin clears the bar keeping the torso tight', 'Lower under control; with added load the descent is the most demanding part'],
    ['Añadir lastre antes de dominar el recorrido completo sin peso', 'Acortar el recorrido para poder con el peso', 'Dejarse caer al final de la serie'],
    ['Adding load before owning the full range unweighted', 'Cutting the range short to handle the weight', 'Dropping down at the end of the set'],
  ),
  'assisted pull-up (machine)': f(
    ['Ajusta la asistencia y apoya rodillas o pies en la plataforma, con las manos en la barra', 'Cuanto MÁS peso pones en la máquina, MÁS te ayuda: es al revés que en el resto', 'Tira con los codos hacia abajo hasta pasar la barbilla por la barra', 'Baja controlado y deja que la plataforma acompañe, no que te empuje'],
    ['Set the assistance and place knees or feet on the pad, hands on the bar', 'The MORE weight you set, the MORE it helps you: it is the opposite of every other machine', 'Pull with elbows down until your chin clears the bar', 'Lower under control and let the pad follow you, not push you'],
    ['Rebotar sobre la plataforma para subir', 'Poner tanta asistencia que la espalda casi no trabaja', 'Encoger los hombros en vez de tirar con los codos'],
    ['Bouncing off the pad to get up', 'Setting so much assistance that the back barely works', 'Shrugging instead of driving the elbows down'],
  ),
  'lat pulldown (cable)': f(
    ['Sentado, muslos fijos bajo el rodillo, agarre algo más ancho que los hombros', 'Saca pecho y deja el tronco casi vertical, con una inclinación mínima hacia atrás', 'Lleva la barra al pecho tirando con los codos hacia abajo y aprieta la espalda abajo del todo', 'Sube controlando, dejando que los brazos se estiren del todo arriba'],
    ['Seated, thighs locked under the pad, grip slightly wider than shoulders', 'Chest up and torso nearly vertical, with a minimal backward lean', 'Bring the bar to your chest driving the elbows down and squeeze the back at the bottom', 'Return under control, letting the arms straighten fully at the top'],
    ['Llevar la barra detrás de la nuca', 'Balancear el tronco para arrancar el peso', 'Tirar con las manos y los bíceps en vez de con los codos'],
    ['Pulling the bar behind the neck', 'Rocking the torso to start the weight', 'Pulling with hands and biceps instead of elbows'],
  ),
  'lat pulldown (plate-loaded machine)': f(
    ['Siéntate con el pecho apoyado o los muslos fijos y agarra las palancas', 'El recorrido va guiado: no tienes que estabilizar, así que puedes centrarte en apretar', 'Tira hasta que las manos queden a la altura del pecho y mantén un instante', 'Vuelve dejando que los brazos se estiren, sin soltar la tensión de golpe'],
    ['Sit with the chest supported or thighs locked and grab the handles', 'The path is guided: you do not stabilise, so you can focus on squeezing', 'Pull until your hands reach chest height and hold for an instant', 'Return letting the arms straighten, without dumping the tension'],
    ['Comparar el número de esta máquina con el de la polea: no miden lo mismo', 'Separar la espalda del respaldo para ayudarse', 'Recorrido corto por exceso de carga'],
    ['Comparing this machine number with the cable one: they do not measure the same', 'Peeling your back off the pad to help', 'Short range from too much load'],
  ),
  'v-bar pulldown (cable)': f(
    ['Sentado y fijado, agarra el triángulo con las palmas enfrentadas', 'El agarre estrecho y neutro permite bajar más los codos y llegar más abajo', 'Lleva el triángulo hasta la parte alta del pecho y aprieta las escápulas', 'Sube estirando del todo para notar el estiramiento del dorsal'],
    ['Seated and locked in, grab the V-handle with palms facing each other', 'The close neutral grip lets the elbows travel lower and reach further down', 'Bring the handle to the upper chest and squeeze the shoulder blades', 'Return to full extension to feel the lat stretch'],
    ['Echar el tronco muy atrás y convertirlo en un remo', 'Parar arriba sin estirar los brazos', 'Subir los hombros al final del tirón'],
    ['Leaning way back and turning it into a row', 'Stopping at the top without straightening the arms', 'Letting the shoulders rise at the end of the pull'],
  ),
  'close-grip pulldown (cable)': f(
    ['Sentado y fijado, agarre estrecho a la anchura de los hombros o menos', 'Pecho arriba y codos pegados al cuerpo durante todo el recorrido', 'Baja hasta el pecho apretando; el agarre cerrado carga más el dorsal bajo', 'Sube controlado hasta estirar los brazos por completo'],
    ['Seated and locked in, narrow grip at shoulder width or less', 'Chest up and elbows tucked close throughout the whole range', 'Pull to the chest and squeeze; the close grip loads the lower lat more', 'Return under control until the arms are fully straight'],
    ['Abrir los codos y perder el trabajo del dorsal', 'Usar impulso de cadera', 'Agarrar tan cerrado que se cargan las muñecas'],
    ['Flaring the elbows and losing the lat work', 'Using hip momentum', 'Gripping so narrow that the wrists take the load'],
  ),
  'neutral-grip pulldown (cable)': f(
    ['Sentado con muslos fijos, agarra la barra de palmas enfrentadas', 'El agarre neutro es el más cómodo para el hombro: úsalo si el prono te molesta', 'Tira al pecho con los codos hacia atrás y abajo, y aprieta abajo', 'Estira del todo arriba sin encoger los hombros'],
    ['Seated with thighs locked, take the bar with palms facing each other', 'The neutral grip is the friendliest for the shoulder: use it if pronated hurts', 'Pull to the chest with elbows back and down, and squeeze at the bottom', 'Fully straighten at the top without shrugging'],
    ['Arquear la espalda baja para ganar recorrido', 'Tirar solo con los brazos', 'No estirar arriba y trabajar medio rango'],
    ['Arching the lower back to gain range', 'Pulling with the arms only', 'Not stretching at the top and working half the range'],
  ),
  'single-arm pulldown (cable)': f(
    ['Sentado o de rodillas frente a la polea alta, agarra un asa con una mano', 'La mano libre en la cadera o en el asiento; el tronco no debe girar', 'Tira del asa hasta el costado llevando el codo abajo y atrás, y aprieta', 'Vuelve dejando que el brazo se estire y el hombro suba un poco'],
    ['Seated or kneeling in front of the high pulley, take one handle with one hand', 'Free hand on your hip or the seat; the torso must not rotate', 'Pull the handle to your side driving the elbow down and back, then squeeze', 'Return letting the arm straighten and the shoulder rise slightly'],
    ['Rotar el tronco para ayudarse con el otro lado', 'Tirar con el bíceps en vez del dorsal', 'Cargar tanto que el cuerpo se levanta del asiento'],
    ['Rotating the torso to help with the other side', 'Pulling with the biceps instead of the lat', 'Loading so heavy that the body lifts off the seat'],
  ),
  'barbell row': f(
    ['De pie, pies a la anchura de las caderas y barra sobre el medio del pie', 'Haz bisagra de cadera hasta que el tronco esté cerca de 45 grados, espalda neutra', 'Rema la barra hacia el abdomen bajo con los codos cerca del cuerpo y aprieta escápulas', 'Baja controlado sin que el tronco suba: el ángulo se mantiene toda la serie'],
    ['Standing, feet hip width and the bar over mid foot', 'Hinge at the hips until the torso is near 45 degrees, spine neutral', 'Row the bar to your lower abs with elbows close and squeeze the shoulder blades', 'Lower under control without the torso rising: hold the angle all set'],
    ['Redondear la espalda baja', 'Subir el tronco en cada repetición para ayudarse', 'Remar al pecho con los codos muy abiertos'],
    ['Rounding the lower back', 'Standing up on each rep to help', 'Rowing to the chest with elbows flared'],
  ),
  'dumbbell row': f(
    ['Apoya rodilla y mano del mismo lado en el banco, el otro pie firme en el suelo', 'Espalda plana y paralela al suelo, mancuerna colgando con el brazo estirado', 'Rema hacia la cadera llevando el codo atrás y aprieta la escápula arriba', 'Baja hasta estirar del todo, dejando que el hombro se alargue'],
    ['Place knee and hand of the same side on the bench, the other foot firm on the floor', 'Flat back parallel to the floor, dumbbell hanging with the arm straight', 'Row toward your hip driving the elbow back and squeeze the shoulder blade at the top', 'Lower to full extension, letting the shoulder lengthen'],
    ['Rotar el tronco para subir más peso', 'Tirar hacia el hombro en vez de hacia la cadera', 'Recorrido corto sin estirar abajo'],
    ['Rotating the torso to lift more weight', 'Rowing toward the shoulder instead of the hip', 'Short range without stretching at the bottom'],
  ),
  'two-dumbbell row': f(
    ['De pie con una mancuerna en cada mano, bisagra de cadera y espalda neutra', 'Tronco cerca de 45 grados y mancuernas colgando bajo los hombros', 'Rema las dos a la vez hacia las caderas y aprieta la espalda', 'Baja las dos controladas manteniendo el tronco quieto'],
    ['Standing with a dumbbell in each hand, hinge at the hips with a neutral spine', 'Torso near 45 degrees and dumbbells hanging under the shoulders', 'Row both at once toward your hips and squeeze the back', 'Lower both under control keeping the torso still'],
    ['Balancearse arriba y abajo con cada repetición', 'Perder la espalda neutra al cansarse', 'Golpear las mancuernas contra las piernas'],
    ['Bouncing up and down on each rep', 'Losing the neutral spine as you fatigue', 'Banging the dumbbells against your legs'],
  ),
  't-bar row': f(
    ['Colócate a horcajadas sobre la barra con los pies firmes y agarra el asa', 'Bisagra de cadera con pecho arriba y espalda neutra', 'Rema hasta que el asa toque el abdomen y aprieta la espalda media', 'Baja hasta estirar los brazos sin dejar caer el peso'],
    ['Straddle the bar with firm feet and grab the handle', 'Hinge at the hips with chest up and neutral spine', 'Row until the handle touches your abdomen and squeeze the mid back', 'Lower to straight arms without dropping the weight'],
    ['Incorporarse en cada repetición', 'Redondear la espalda por exceso de carga', 'Rebotar el peso contra el suelo'],
    ['Standing up on each rep', 'Rounding the back from too much load', 'Bouncing the weight off the floor'],
  ),
  'seated cable row': f(
    ['Sentado con los pies en la plataforma y rodillas algo flexionadas', 'Tronco vertical y pecho arriba; el peso arranca con los brazos estirados', 'Tira del agarre hacia el ombligo llevando los codos atrás y aprieta escápulas', 'Deja que los brazos vuelvan estirados y el hombro se alargue delante'],
    ['Seated with feet on the platform and knees slightly bent', 'Vertical torso and chest up; start with the arms straight', 'Pull the handle to your navel driving the elbows back and squeeze the shoulder blades', 'Let the arms return straight and the shoulder lengthen forward'],
    ['Echar el tronco muy atrás para tirar del peso', 'Encoger los hombros al final del tirón', 'No dejar estirar los brazos delante'],
    ['Leaning far back to pull the weight', 'Shrugging at the end of the pull', 'Not letting the arms straighten out front'],
  ),
  'wide-grip cable row': f(
    ['Sentado, agarra la barra larga con las manos más abiertas que los hombros', 'Tronco vertical; el agarre ancho lleva el trabajo a la espalda alta', 'Tira hacia la parte baja del pecho con los codos altos y abiertos, y aprieta', 'Vuelve controlado hasta estirar los brazos'],
    ['Seated, take the long bar with hands wider than your shoulders', 'Vertical torso; the wide grip shifts the work to the upper back', 'Pull toward the lower chest with elbows high and flared, then squeeze', 'Return under control to straight arms'],
    ['Bajar los codos y convertirlo en el remo estrecho', 'Tirar con el tronco en vez de con la espalda', 'Cargar tanto que se pierde el recorrido'],
    ['Dropping the elbows and turning it into the narrow row', 'Pulling with the torso instead of the back', 'Loading so heavy the range disappears'],
  ),
  'machine row': f(
    ['Siéntate y ajusta el asiento para que las asas queden a la altura del abdomen', 'Pecho apoyado o firme, brazos estirados al empezar', 'Tira de las asas hacia atrás y aprieta la espalda un instante', 'Vuelve dejando que los brazos se estiren, sin soltar de golpe'],
    ['Sit and set the seat so the handles are at abdomen height', 'Chest supported or braced, arms straight at the start', 'Pull the handles back and squeeze the back for an instant', 'Return letting the arms straighten, without releasing suddenly'],
    ['Asiento mal ajustado que cambia el ángulo de tirón', 'Separar el pecho del respaldo para ayudarse', 'Trabajar medio recorrido'],
    ['Wrong seat height that changes the pulling angle', 'Peeling the chest off the pad to help', 'Working half the range'],
  ),
  'chest-supported row (machine)': f(
    ['Pecho contra el respaldo inclinado y pies firmes en el suelo', 'El apoyo elimina el trabajo de la espalda baja: solo tiras', 'Rema las asas hacia atrás llevando los codos junto al cuerpo y aprieta', 'Vuelve estirando los brazos sin despegar el pecho'],
    ['Chest against the inclined pad and feet firm on the floor', 'The support removes the lower back work: you only pull', 'Row the handles back driving the elbows alongside the body and squeeze', 'Return straightening the arms without lifting the chest'],
    ['Despegar el pecho del apoyo en las últimas repeticiones', 'Encoger los hombros al tirar', 'Agarre demasiado ancho que carga el hombro'],
    ['Lifting the chest off the pad on the last reps', 'Shrugging while pulling', 'Grip too wide that loads the shoulder'],
  ),
  'chest-supported dumbbell row': f(
    ['Túmbate boca abajo en un banco inclinado a unos 30 o 45 grados', 'Mancuernas colgando con los brazos estirados bajo los hombros', 'Rema las dos hacia las caderas apretando las escápulas arriba', 'Baja despacio hasta estirar los brazos del todo'],
    ['Lie face down on a bench inclined around 30 to 45 degrees', 'Dumbbells hanging with straight arms under the shoulders', 'Row both toward your hips squeezing the shoulder blades at the top', 'Lower slowly to fully straight arms'],
    ['Levantar el pecho del banco para tirar más', 'Usar mancuernas tan pesadas que hay que balancearse', 'Parar antes de estirar abajo'],
    ['Lifting the chest off the bench to pull more', 'Using dumbbells so heavy you have to swing', 'Stopping before the bottom stretch'],
  ),
  'smith machine row': f(
    ['Coloca la barra guiada a la altura de las rodillas y agárrala en pronación', 'Bisagra de cadera con espalda neutra; la guía fija el recorrido vertical', 'Rema hasta el abdomen bajo con los codos cerca y aprieta la espalda', 'Baja controlado sin incorporarte'],
    ['Set the guided bar at knee height and take a pronated grip', 'Hinge at the hips with a neutral spine; the rail fixes the vertical path', 'Row to the lower abdomen with elbows close and squeeze the back', 'Lower under control without standing up'],
    ['Colocarse mal respecto a la guía y forzar el hombro', 'Redondear la espalda baja', 'Subir el tronco en cada repetición'],
    ['Standing wrong relative to the rail and forcing the shoulder', 'Rounding the lower back', 'Raising the torso on every rep'],
  ),
  'single-arm cable row': f(
    ['Sentado o de pie frente a la polea baja, agarra el asa con una mano', 'Tronco firme y sin rotar; el brazo empieza estirado del todo', 'Tira hacia el costado llevando el codo atrás y aprieta la escápula', 'Deja que el brazo vuelva estirado y el hombro se alargue delante'],
    ['Seated or standing at the low pulley, take the handle with one hand', 'Torso braced and not rotating; the arm starts fully straight', 'Pull to your side driving the elbow back and squeeze the shoulder blade', 'Let the arm return straight and the shoulder lengthen forward'],
    ['Rotar el tronco para ganar recorrido', 'Tirar con el bíceps', 'No estirar del todo al volver'],
    ['Rotating the torso to gain range', 'Pulling with the biceps', 'Not fully extending on the return'],
  ),
  deadlift: f(
    ['Pies a la anchura de las caderas, barra sobre el medio del pie, casi tocando la espinilla', 'Agarra fuera de las piernas, saca pecho y deja la espalda neutra con las caderas altas', 'Empuja el suelo con las piernas y sube la barra pegada al cuerpo hasta bloquear caderas y rodillas', 'Baja haciendo bisagra: primero cadera atrás, luego rodillas, con la barra siempre pegada'],
    ['Feet hip width, bar over mid foot, almost touching the shin', 'Grip outside the legs, chest up and spine neutral with high hips', 'Push the floor away with your legs and drive the bar up close to the body until hips and knees lock', 'Lower by hinging: hips back first, then knees, keeping the bar close'],
    ['Redondear la espalda baja al arrancar', 'Separar la barra del cuerpo y perder la vertical', 'Hiperextender la espalda arriba en vez de solo bloquear la cadera'],
    ['Rounding the lower back off the floor', 'Letting the bar drift away from the body', 'Hyperextending the back at the top instead of just locking the hips'],
  ),
  'romanian deadlift': f(
    ['De pie con la barra en las manos, rodillas ligeramente flexionadas y fijas', 'Lleva la cadera atrás bajando la barra pegada a los muslos, espalda neutra', 'Para cuando notes el estiramiento del femoral, normalmente a media espinilla', 'Vuelve empujando la cadera adelante y aprieta los glúteos arriba sin arquear'],
    ['Standing with the bar in your hands, knees slightly bent and fixed', 'Push the hips back lowering the bar along your thighs, spine neutral', 'Stop when you feel the hamstring stretch, usually mid shin', 'Return driving the hips forward and squeeze the glutes at the top without arching'],
    ['Doblar las rodillas y convertirlo en peso muerto', 'Redondear la espalda para bajar más', 'Separar la barra de las piernas'],
    ['Bending the knees and turning it into a deadlift', 'Rounding the back to go lower', 'Letting the bar drift off the legs'],
  ),
  'dumbbell romanian deadlift': f(
    ['De pie con una mancuerna en cada mano por delante de los muslos', 'Rodillas semiflexionadas fijas y cadera atrás, bajando las mancuernas pegadas', 'Baja hasta notar tensión en el femoral, sin redondear la espalda', 'Sube empujando la cadera adelante y aprieta glúteos arriba'],
    ['Standing with a dumbbell in each hand in front of your thighs', 'Knees softly bent and fixed, hips back, lowering the dumbbells close to the legs', 'Lower until you feel hamstring tension, without rounding the back', 'Rise driving the hips forward and squeeze the glutes at the top'],
    ['Bajar por flexión de columna en vez de por cadera', 'Alejar las mancuernas del cuerpo', 'Buscar tocar el suelo forzando el rango'],
    ['Lowering by bending the spine instead of the hips', 'Letting the dumbbells drift away', 'Chasing the floor and forcing the range'],
  ),
  'back extension': f(
    ['Ajusta el banco para que el borde quede justo debajo de la cadera', 'Cruza los brazos o sujeta un disco al pecho, espalda neutra', 'Baja doblando la cadera hasta sentir el femoral, no la lumbar', 'Sube hasta alinear tronco y piernas y aprieta glúteos, sin pasarte de recto'],
    ['Set the pad so its edge sits just below your hip', 'Cross your arms or hold a plate at your chest, spine neutral', 'Lower by bending at the hips until you feel the hamstrings, not the lower back', 'Rise until torso and legs are in line and squeeze the glutes, without over-extending'],
    ['Hiperextender la espalda arriba', 'Bajar redondeando la columna', 'Coger carrerilla con impulso'],
    ['Hyperextending the back at the top', 'Lowering by rounding the spine', 'Using momentum to swing up'],
  ),
  'barbell shrug': f(
    ['De pie con la barra delante de los muslos, brazos estirados y relajados', 'Pies a la anchura de las caderas y mirada al frente', 'Encoge los hombros recto hacia arriba, como si quisieras tocarte las orejas, y aprieta', 'Baja despacio dejando que los trapecios se estiren del todo'],
    ['Standing with the bar in front of your thighs, arms straight and relaxed', 'Feet hip width and eyes forward', 'Shrug straight up, as if reaching your ears, and squeeze', 'Lower slowly letting the traps stretch fully'],
    ['Rotar los hombros en círculos', 'Doblar los codos y remar', 'Recorrido mínimo con demasiado peso'],
    ['Rolling the shoulders in circles', 'Bending the elbows and rowing', 'Tiny range with too much weight'],
  ),
  'dumbbell shrug': f(
    ['De pie con una mancuerna a cada lado del cuerpo, brazos estirados', 'Las mancuernas a los lados permiten subir más recto que con barra', 'Encoge los hombros hacia arriba y mantén un segundo arriba', 'Baja controlado hasta estirar por completo'],
    ['Standing with a dumbbell at each side, arms straight', 'Dumbbells at your sides let you shrug straighter than with a bar', 'Shrug the shoulders up and hold for a second at the top', 'Lower under control to a full stretch'],
    ['Hacer círculos con los hombros', 'Ayudarse con impulso de rodillas', 'No mantener arriba y rebotar'],
    ['Circling the shoulders', 'Using knee bounce for momentum', 'Not pausing at the top and bouncing'],
  ),
  'machine shrug': f(
    ['Colócate en la máquina con los brazos estirados sujetando las asas', 'La guía fija el recorrido vertical: solo tienes que encoger', 'Sube los hombros al máximo y aprieta un instante arriba', 'Baja despacio hasta el estiramiento completo'],
    ['Get into the machine with straight arms holding the handles', 'The rail fixes the vertical path: you only have to shrug', 'Raise the shoulders as high as possible and squeeze for an instant', 'Lower slowly to a full stretch'],
    ['Doblar los codos para ayudarse', 'Rebotar en la parte baja', 'Cargar tanto que apenas hay recorrido'],
    ['Bending the elbows to help', 'Bouncing at the bottom', 'Loading so heavy there is barely any range'],
  ),
  'face pull': f(
    ['Coloca la polea a la altura de la cara y agarra la cuerda con las palmas enfrentadas', 'Da un paso atrás para tener tensión desde el inicio, brazos estirados', 'Tira separando las manos hacia las orejas, con los codos altos, y aprieta detrás del hombro', 'Vuelve controlado dejando que los hombros se alarguen delante'],
    ['Set the pulley at face height and grab the rope with palms facing each other', 'Step back so there is tension from the start, arms straight', 'Pull separating your hands toward your ears with high elbows, and squeeze behind the shoulder', 'Return under control letting the shoulders lengthen forward'],
    ['Bajar los codos y convertirlo en un remo', 'Usar tanto peso que hay que echarse atrás', 'Tirar a la barbilla en vez de a la cara'],
    ['Dropping the elbows and turning it into a row', 'Using so much weight you have to lean back', 'Pulling to the chin instead of the face'],
  ),
  'straight-arm pulldown': f(
    ['De pie frente a la polea alta con la barra o cuerda, brazos casi estirados', 'Inclínate ligeramente hacia delante desde la cadera y fija los codos', 'Baja los brazos en arco hasta los muslos y aprieta el dorsal abajo', 'Sube controlado dejando que los brazos vuelvan arriba sin doblar el codo'],
    ['Standing at the high pulley with a bar or rope, arms almost straight', 'Lean slightly forward from the hips and lock the elbows', 'Sweep the arms down to your thighs and squeeze the lat at the bottom', 'Return under control letting the arms rise without bending the elbow'],
    ['Doblar los codos y convertirlo en extensión de tríceps', 'Mover el tronco arriba y abajo', 'Usar demasiado peso y perder el arco'],
    ['Bending the elbows and turning it into a triceps extension', 'Rocking the torso up and down', 'Using too much weight and losing the arc'],
  ),
  'machine pullover': f(
    ['Siéntate con la espalda apoyada y ajusta el asiento a la altura del hombro', 'Agarra las palancas por encima con los codos apoyados donde marca la máquina', 'Tira hacia abajo y adelante con los brazos casi rectos y aprieta el dorsal', 'Vuelve arriba dejando que el dorsal se estire, sin soltar la tensión'],
    ['Sit with your back supported and set the seat to shoulder height', 'Grab the levers overhead with elbows on the pads where the machine indicates', 'Pull down and forward with near-straight arms and squeeze the lat', 'Return up letting the lat stretch, without dumping the tension'],
    ['Asiento mal ajustado que fuerza el hombro', 'Empujar con los brazos en vez de tirar con la espalda', 'Recorrido corto sin llegar al estiramiento'],
    ['Wrong seat height that strains the shoulder', 'Pushing with the arms instead of pulling with the back', 'Short range that never reaches the stretch'],
  ),
  // ══ PECHO ══
  'barbell bench press': f(
    ['Tumbado, ojos bajo la barra, pies firmes en el suelo y cinco puntos de apoyo', 'Junta las escápulas y mantén un arco natural en la espalda baja', 'Baja la barra al esternón con los codos a unos 45 grados, roza el pecho sin rebotar', 'Empuja hasta estirar los brazos manteniendo las escápulas apretadas'],
    ['Lying down, eyes under the bar, feet firm on the floor and five points of contact', 'Retract the shoulder blades and keep a natural arch in the lower back', 'Lower the bar to your sternum with elbows around 45 degrees, touch the chest without bouncing', 'Press to straight arms keeping the shoulder blades retracted'],
    ['Rebotar la barra en el pecho', 'Abrir los codos a 90 grados y castigar el hombro', 'Levantar la cadera del banco para empujar'],
    ['Bouncing the bar off the chest', 'Flaring the elbows to 90 degrees and punishing the shoulder', 'Lifting the hips off the bench to press'],
  ),
  'dumbbell bench press': f(
    ['Tumbado con una mancuerna en cada mano a la altura del pecho', 'Escápulas juntas y muñecas alineadas con el antebrazo', 'Baja hasta que las mancuernas queden a los lados del pecho, notando el estiramiento', 'Empuja arriba juntando ligeramente sin chocarlas y sin bloquear de golpe'],
    ['Lying with a dumbbell in each hand at chest level', 'Shoulder blades retracted and wrists stacked over the forearms', 'Lower until the dumbbells are beside your chest, feeling the stretch', 'Press up bringing them slightly together without clanging or snapping the elbows'],
    ['Bajar demasiado y forzar el hombro', 'Chocar las mancuernas arriba y perder tensión', 'Perder el control en la bajada'],
    ['Going too deep and straining the shoulder', 'Clanging the dumbbells at the top and losing tension', 'Losing control on the way down'],
  ),
  'machine chest press': f(
    ['Ajusta el asiento para que las asas queden a la altura media del pecho', 'Espalda apoyada, escápulas atrás y pies firmes', 'Empuja hasta casi estirar los brazos y aprieta el pecho un instante', 'Vuelve controlado hasta notar el estiramiento, sin golpear las placas'],
    ['Set the seat so the handles sit at mid chest height', 'Back supported, shoulder blades back and feet firm', 'Press to almost straight arms and squeeze the chest for an instant', 'Return under control to a stretch, without clanging the plates'],
    ['Asiento demasiado alto o bajo, que cambia el músculo trabajado', 'Despegar la espalda del respaldo', 'Bloquear los codos de golpe al final'],
    ['Seat too high or low, which changes the muscle worked', 'Peeling the back off the pad', 'Snapping the elbows straight at the end'],
  ),
  'smith machine bench press': f(
    ['Coloca el banco de modo que la barra guiada baje sobre la mitad del pecho', 'Escápulas juntas y pies firmes; la guía te libera de estabilizar', 'Baja hasta rozar el pecho controlando, sin rebotar en los topes', 'Empuja arriba y bloquea los ganchos solo al terminar la serie'],
    ['Place the bench so the guided bar comes down over mid chest', 'Shoulder blades retracted and feet firm; the rail frees you from stabilising', 'Lower to touch the chest under control, without bouncing off the stops', 'Press up and only hook the safeties when the set is over'],
    ['Colocar mal el banco y que la barra caiga en el cuello o el abdomen', 'Comparar el peso con el del banco libre: la guía cambia la cifra', 'Rebotar en el pecho aprovechando la guía'],
    ['Misplacing the bench so the bar lands on the neck or abdomen', 'Comparing the weight with free bench: the rail changes the number', 'Bouncing off the chest because the rail allows it'],
  ),
  'incline barbell press': f(
    ['Banco inclinado entre 30 y 45 grados, ojos bajo la barra', 'Escápulas juntas y pies firmes; el pecho queda alto', 'Baja la barra a la parte alta del pecho, justo bajo las clavículas', 'Empuja hasta estirar sin dejar que los hombros se adelanten'],
    ['Bench at 30 to 45 degrees, eyes under the bar', 'Shoulder blades retracted and feet firm; the chest sits high', 'Lower the bar to the upper chest, just below the collarbones', 'Press to straight arms without letting the shoulders roll forward'],
    ['Inclinar el banco por encima de 45 grados y convertirlo en press de hombro', 'Bajar la barra al esternón como en banca plana', 'Rebotar la barra'],
    ['Inclining above 45 degrees and turning it into a shoulder press', 'Lowering the bar to the sternum as in flat bench', 'Bouncing the bar'],
  ),
  'incline dumbbell press': f(
    ['Banco entre 30 y 45 grados con una mancuerna en cada mano', 'Sube las mancuernas con las rodillas para colocarte sin forzar el hombro', 'Baja hasta los lados de la parte alta del pecho notando el estiramiento', 'Empuja arriba sin chocarlas y sin bloquear de golpe'],
    ['Bench at 30 to 45 degrees with a dumbbell in each hand', 'Use your knees to kick the dumbbells up into place without straining the shoulder', 'Lower to the sides of the upper chest feeling the stretch', 'Press up without clanging and without snapping the elbows'],
    ['Bajar en exceso y pinzar el hombro', 'Arquear mucho la espalda y convertirlo en banca plana', 'Soltar las mancuernas a los lados al terminar'],
    ['Going too deep and pinching the shoulder', 'Over-arching and turning it into a flat press', 'Dropping the dumbbells to the sides when finishing'],
  ),
  'incline machine press': f(
    ['Ajusta el asiento para que las asas queden a la altura de la parte alta del pecho', 'Espalda apoyada y escápulas atrás', 'Empuja hacia arriba y adelante hasta casi estirar, y aprieta', 'Vuelve controlado hasta el estiramiento'],
    ['Set the seat so the handles are at upper chest height', 'Back supported and shoulder blades back', 'Press up and forward to almost straight and squeeze', 'Return under control to a stretch'],
    ['Altura de asiento equivocada', 'Empujar con los hombros encogidos', 'Recorrido corto por exceso de carga'],
    ['Wrong seat height', 'Pressing with shrugged shoulders', 'Short range from too much load'],
  ),
  'decline barbell press': f(
    ['Banco declinado con las piernas bien sujetas por los rodillos', 'Escápulas juntas y agarre algo más ancho que los hombros', 'Baja la barra a la parte baja del pecho con los codos cerca', 'Empuja hasta estirar sin perder el apoyo de la espalda'],
    ['Decline bench with your legs firmly locked under the pads', 'Shoulder blades retracted and grip slightly wider than shoulders', 'Lower the bar to the lower chest with elbows close', 'Press to straight arms without losing back contact'],
    ['Empezar sin sujetar bien las piernas', 'Bajar al abdomen en vez de al pecho bajo', 'Levantarse rápido al terminar y marearse'],
    ['Starting without locking the legs', 'Lowering to the abdomen instead of the lower chest', 'Standing up fast at the end and getting dizzy'],
  ),
  'decline machine press': f(
    ['Ajusta el asiento para que las asas queden bajo la línea del pecho', 'Espalda apoyada y pies firmes', 'Empuja hacia abajo y adelante hasta casi estirar, apretando el pecho bajo', 'Vuelve controlado hasta el estiramiento'],
    ['Set the seat so the handles sit below chest line', 'Back supported and feet firm', 'Press down and forward to almost straight, squeezing the lower chest', 'Return under control to a stretch'],
    ['Confundir la altura y trabajar el pecho medio', 'Bloquear los codos de golpe', 'Soltar el peso al volver'],
    ['Getting the height wrong and working mid chest', 'Snapping the elbows straight', 'Dropping the weight on the return'],
  ),
  'single-arm cable press': f(
    ['De pie frente a la polea a la altura del pecho, un pie ligeramente adelantado', 'Agarra el asa con una mano y aprieta el abdomen para no rotar', 'Empuja hacia delante cruzando ligeramente hacia el centro y aprieta el pecho', 'Vuelve controlado dejando que el hombro se alargue atrás'],
    ['Standing at the pulley set at chest height, one foot slightly forward', 'Take the handle with one hand and brace your abs so you do not rotate', 'Press forward crossing slightly toward the midline and squeeze the chest', 'Return under control letting the shoulder lengthen back'],
    ['Girar el tronco para ganar fuerza', 'Perder el equilibrio por poner demasiado peso', 'No dejar que el brazo vuelva del todo'],
    ['Twisting the torso for extra force', 'Losing balance from too much weight', 'Not letting the arm return fully'],
  ),
  'dumbbell fly': f(
    ['Tumbado con una mancuerna en cada mano encima del pecho, palmas enfrentadas', 'Codos ligeramente flexionados y FIJOS: ese ángulo no cambia en toda la serie', 'Abre los brazos en arco hasta notar el estiramiento a la altura del pecho', 'Cierra siguiendo el mismo arco, como si abrazaras, y aprieta arriba'],
    ['Lying with a dumbbell in each hand above your chest, palms facing each other', 'Elbows slightly bent and FIXED: that angle does not change all set', 'Open the arms in an arc until you feel the stretch at chest level', 'Close along the same arc, as if hugging, and squeeze at the top'],
    ['Doblar y estirar los codos, convirtiéndolo en un press', 'Bajar demasiado y forzar la cápsula del hombro', 'Usar demasiado peso y perder el arco'],
    ['Bending and straightening the elbows, turning it into a press', 'Going too deep and straining the shoulder capsule', 'Using too much weight and losing the arc'],
  ),
  'incline dumbbell fly': f(
    ['Banco a 30 grados con una mancuerna en cada mano sobre el pecho', 'Codos algo flexionados y fijos, palmas enfrentadas', 'Abre en arco hasta el estiramiento en la parte alta del pecho', 'Cierra apretando arriba sin chocar las mancuernas'],
    ['Bench at 30 degrees with a dumbbell in each hand over the chest', 'Elbows slightly bent and fixed, palms facing each other', 'Open in an arc until you feel the stretch in the upper chest', 'Close squeezing at the top without clanging the dumbbells'],
    ['Estirar los codos y convertirlo en press', 'Inclinar demasiado el banco y cargar el hombro', 'Abrir más allá de lo cómodo'],
    ['Straightening the elbows and turning it into a press', 'Inclining too much and loading the shoulder', 'Opening beyond a comfortable range'],
  ),
  'cable fly': f(
    ['De pie entre dos poleas a la altura del pecho, un pie adelantado para estabilizar', 'Codos algo flexionados y fijos, brazos abiertos con tensión desde el inicio', 'Junta las manos delante del pecho en arco y aprieta un instante', 'Abre controlado hasta notar el estiramiento, sin soltar la tensión'],
    ['Standing between two pulleys at chest height, one foot forward for balance', 'Elbows slightly bent and fixed, arms open with tension from the start', 'Bring your hands together in front of the chest in an arc and squeeze for an instant', 'Open under control to a stretch, without dumping the tension'],
    ['Doblar los codos y hacer un press', 'Encorvarse hacia delante al juntar', 'Abrir tanto que el hombro queda por detrás del cuerpo'],
    ['Bending the elbows and pressing', 'Hunching forward when closing', 'Opening so wide the shoulder goes behind the body'],
  ),
  'high-to-low cable crossover': f(
    ['Poleas en alto, agarra un asa con cada mano y da un paso adelante', 'Tronco ligeramente inclinado y codos algo flexionados y fijos', 'Baja las manos en arco hasta cruzarlas a la altura del abdomen y aprieta el pecho bajo', 'Vuelve arriba controlando hasta el estiramiento'],
    ['Pulleys set high, take a handle in each hand and step forward', 'Torso leaning slightly and elbows slightly bent and fixed', 'Sweep the hands down in an arc to cross at abdomen height and squeeze the lower chest', 'Return up under control to the stretch'],
    ['Usar los tríceps empujando en vez de cerrar en arco', 'Doblar el tronco en cada repetición', 'Cruzar sin apretar y volver de golpe'],
    ['Using the triceps to push instead of arcing', 'Bending the torso on every rep', 'Crossing without squeezing and snapping back'],
  ),
  'low-to-high cable crossover': f(
    ['Poleas abajo, agarra un asa con cada mano con las palmas hacia delante', 'Da un paso al centro, codos algo flexionados y fijos', 'Sube las manos en arco hasta juntarlas a la altura de la clavícula y aprieta el pecho alto', 'Baja controlado hasta el estiramiento'],
    ['Pulleys set low, take a handle in each hand with palms forward', 'Step to the middle, elbows slightly bent and fixed', 'Sweep the hands up in an arc to meet at collarbone height and squeeze the upper chest', 'Lower under control to the stretch'],
    ['Encoger los hombros al subir', 'Ayudarse con la espalda echándose atrás', 'Doblar los codos y hacer un curl'],
    ['Shrugging on the way up', 'Leaning back and using the back', 'Bending the elbows and curling'],
  ),
  'pec deck': f(
    ['Siéntate con la espalda apoyada y ajusta el asiento a la altura del pecho', 'Antebrazos o manos en las almohadillas, codos a la altura del hombro', 'Junta los brazos delante y aprieta el pecho un segundo en el centro', 'Abre controlado hasta notar el estiramiento sin pasarte'],
    ['Sit with the back supported and set the seat to chest height', 'Forearms or hands on the pads, elbows at shoulder height', 'Bring the arms together in front and squeeze the chest for a second', 'Open under control to a stretch without overdoing it'],
    ['Asiento mal ajustado y codos por encima del hombro', 'Abrir demasiado y forzar el hombro', 'Cerrar de golpe usando el impulso'],
    ['Wrong seat height with elbows above the shoulder', 'Opening too far and straining the shoulder', 'Slamming closed with momentum'],
  ),
  'chest dips': f(
    ['Súbete a las paralelas con los brazos estirados y el cuerpo suspendido', 'Inclina el tronco hacia delante y deja los codos algo abiertos: así carga el pecho', 'Baja hasta que los hombros queden a la altura de los codos, sin pasarte', 'Empuja arriba manteniendo la inclinación, sin ponerte vertical'],
    ['Get on the bars with straight arms and the body suspended', 'Lean the torso forward and let the elbows flare a bit: that loads the chest', 'Lower until the shoulders reach elbow height, no further', 'Press up keeping the forward lean, without going vertical'],
    ['Bajar por debajo de lo que aguanta el hombro', 'Ponerse vertical y convertirlo en fondos de tríceps', 'Balancear las piernas para subir'],
    ['Going deeper than the shoulder tolerates', 'Going vertical and turning it into triceps dips', 'Swinging the legs to get up'],
  ),
  'push-ups': f(
    ['Manos algo más abiertas que los hombros y cuerpo en línea recta de cabeza a talones', 'Aprieta abdomen y glúteos: el cuerpo es una tabla, no una hamaca', 'Baja hasta que el pecho quede a un puño del suelo, codos a unos 45 grados', 'Empuja hasta estirar los brazos sin que la cadera se adelante'],
    ['Hands slightly wider than shoulders and body in a straight line head to heels', 'Brace abs and glutes: the body is a plank, not a hammock', 'Lower until the chest is a fist off the floor, elbows around 45 degrees', 'Press to straight arms without the hips leading'],
    ['Dejar caer la cadera y arquear la lumbar', 'Bajar solo la cabeza en vez del pecho', 'Abrir los codos a 90 grados'],
    ['Letting the hips sag and arching the lower back', 'Lowering only the head instead of the chest', 'Flaring the elbows to 90 degrees'],
  ),
  'dumbbell pullover': f(
    ['Túmbate en el banco sujetando una mancuerna con las dos manos sobre el pecho', 'Codos algo flexionados y fijos, escápulas apoyadas', 'Lleva la mancuerna por detrás de la cabeza hasta notar el estiramiento en costillas y dorsal', 'Vuelve en arco hasta encima del pecho sin doblar más los codos'],
    ['Lie on the bench holding one dumbbell with both hands over your chest', 'Elbows slightly bent and fixed, shoulder blades on the bench', 'Take the dumbbell behind your head until you feel the stretch in the ribs and lat', 'Return in an arc to over the chest without bending the elbows further'],
    ['Arquear mucho la espalda al bajar', 'Doblar los codos y perder el arco', 'Ir más allá del rango cómodo del hombro'],
    ['Over-arching the back on the way down', 'Bending the elbows and losing the arc', 'Going past a comfortable shoulder range'],
  ),

  // ══ HOMBRO ══
  'overhead barbell press': f(
    ['De pie con la barra a la altura de las clavículas, manos algo más abiertas que los hombros', 'Aprieta abdomen y glúteos; codos ligeramente por delante de la barra', 'Empuja la barra recta hacia arriba y mete la cabeza cuando pase la frente', 'Bloquea arriba con la barra sobre la mitad del pie y baja controlado'],
    ['Standing with the bar at collarbone height, hands slightly wider than shoulders', 'Brace abs and glutes; elbows slightly in front of the bar', 'Press the bar straight up and move your head through once it passes your forehead', 'Lock out with the bar over mid foot and lower under control'],
    ['Arquear mucho la lumbar para empujar', 'Rodear la cabeza con la barra en vez de meterla', 'Empujar con las piernas sin querer'],
    ['Over-arching the lower back to press', 'Pushing the bar around the head instead of moving the head', 'Adding an unintended leg drive'],
  ),
  'dumbbell shoulder press': f(
    ['Sentado o de pie con una mancuerna en cada mano a la altura de las orejas', 'Palmas al frente y codos algo por delante del cuerpo, no en línea con la espalda', 'Empuja arriba hasta casi estirar, acercando las mancuernas sin chocarlas', 'Baja controlado hasta la altura de las orejas'],
    ['Seated or standing with a dumbbell in each hand at ear height', 'Palms forward and elbows slightly in front of the body, not in line with the back', 'Press up to almost straight, bringing the dumbbells together without clanging', 'Lower under control to ear height'],
    ['Abrir los codos totalmente hacia los lados', 'Arquear la espalda para empujar más', 'Bajar tanto que el hombro queda pinzado'],
    ['Flaring the elbows fully out to the sides', 'Arching the back to press more', 'Going so low the shoulder gets pinched'],
  ),
  'machine shoulder press': f(
    ['Ajusta el asiento para que las asas queden a la altura de los hombros', 'Espalda apoyada y pies firmes en el suelo', 'Empuja arriba hasta casi estirar y aprieta un instante', 'Vuelve controlado hasta la altura de los hombros'],
    ['Set the seat so the handles are at shoulder height', 'Back supported and feet firm on the floor', 'Press up to almost straight and squeeze for an instant', 'Return under control to shoulder height'],
    ['Asiento demasiado bajo, que obliga a empujar hacia delante', 'Despegar la espalda del respaldo', 'Bloquear los codos de golpe'],
    ['Seat too low, forcing you to press forward', 'Peeling the back off the pad', 'Snapping the elbows straight'],
  ),
  'smith machine shoulder press': f(
    ['Coloca el banco o el asiento de forma que la barra baje delante de la cara', 'Agarre algo más ancho que los hombros y abdomen apretado', 'Empuja hasta casi estirar siguiendo la guía', 'Baja hasta la barbilla controlando, sin rebotar'],
    ['Place the bench or seat so the bar comes down in front of your face', 'Grip slightly wider than shoulders and abs braced', 'Press to almost straight following the rail', 'Lower to chin height under control, no bouncing'],
    ['Colocarse de modo que la barra caiga detrás de la nuca', 'Comparar el peso con el press libre', 'Bajar demasiado por confiarse en la guía'],
    ['Positioning so the bar comes down behind the neck', 'Comparing the weight with the free press', 'Going too low because the rail feels safe'],
  ),
  'arnold press': f(
    ['Sentado con las mancuernas delante del pecho y las palmas hacia ti', 'Codos recogidos y abdomen apretado', 'Gira las palmas hacia fuera mientras subes, terminando con los brazos casi estirados', 'Baja invirtiendo el giro hasta volver a tener las palmas hacia ti'],
    ['Seated with the dumbbells in front of your chest and palms facing you', 'Elbows tucked and abs braced', 'Rotate the palms outward as you press, finishing with arms almost straight', 'Lower reversing the rotation until the palms face you again'],
    ['Girar de golpe al final en vez de durante todo el recorrido', 'Usar demasiado peso y perder el giro', 'Arquear la espalda al subir'],
    ['Rotating abruptly at the end instead of through the whole range', 'Using too much weight and losing the rotation', 'Arching the back on the way up'],
  ),
  'landmine press': f(
    ['Coloca un extremo de la barra en el anclaje y agarra el otro con una mano a la altura del hombro', 'De pie o de rodillas, con el abdomen apretado para no rotar', 'Empuja adelante y arriba en diagonal hasta estirar el brazo', 'Vuelve controlado al hombro sin dejar que el tronco gire'],
    ['Put one end of the bar in the anchor and hold the other at shoulder height with one hand', 'Standing or kneeling, abs braced so you do not rotate', 'Press forward and up on a diagonal until the arm is straight', 'Return under control to the shoulder without letting the torso twist'],
    ['Girar el tronco para empujar más', 'Encoger el hombro al final', 'Cargar el otro extremo pensando que es una barra simétrica'],
    ['Twisting the torso to press more', 'Shrugging at the top', 'Loading it as if it were a symmetric barbell'],
  ),
  'dumbbell lateral raise': f(
    ['De pie con una mancuerna en cada mano a los lados, codos ligeramente flexionados', 'Inclínate un par de grados hacia delante y aprieta el abdomen', 'Sube los brazos a los lados hasta la altura del hombro, guiando con el codo, no con la mano', 'Baja despacio resistiendo, sin dejar caer'],
    ['Standing with a dumbbell in each hand at your sides, elbows slightly bent', 'Lean a couple of degrees forward and brace your abs', 'Raise the arms out to shoulder height, leading with the elbow, not the hand', 'Lower slowly resisting, without dropping'],
    ['Subir por encima del hombro y meter el trapecio', 'Balancear el cuerpo para arrancar', 'Girar la muñeca hacia abajo al subir'],
    ['Raising above shoulder height and bringing in the traps', 'Swinging the body to start the rep', 'Turning the wrist down as you raise'],
  ),
  'cable lateral raise': f(
    ['Polea abajo, cruza el cable por delante y agarra el asa con la mano contraria', 'De pie de lado a la polea, con el brazo cruzado sobre el cuerpo', 'Sube el brazo hasta la altura del hombro con el codo ligeramente flexionado', 'Baja controlado; la polea mantiene tensión también abajo'],
    ['Pulley at the bottom, cross the cable in front and grab the handle with the opposite hand', 'Stand side on to the pulley with the arm crossed over the body', 'Raise the arm to shoulder height with the elbow slightly bent', 'Lower under control; the cable keeps tension at the bottom too'],
    ['Inclinar el cuerpo al lado contrario para ayudarse', 'Subir por encima del hombro', 'Doblar el codo y convertirlo en un remo'],
    ['Leaning to the opposite side to help', 'Raising above shoulder height', 'Bending the elbow and turning it into a row'],
  ),
  'single-arm cable lateral raise': f(
    ['De pie de lado a la polea baja, agarra el asa con la mano más alejada', 'Sujétate con la otra mano al armazón para no balancearte', 'Sube el brazo lateralmente hasta la altura del hombro y mantén un instante', 'Baja despacio sin perder la tensión del cable'],
    ['Stand side on to the low pulley, take the handle with the far hand', 'Hold the frame with the other hand so you do not swing', 'Raise the arm laterally to shoulder height and hold for an instant', 'Lower slowly without losing cable tension'],
    ['Usar el cuerpo como péndulo', 'Encoger el hombro al subir', 'Cargar tanto que el recorrido se acorta'],
    ['Using the body as a pendulum', 'Shrugging as you raise', 'Loading so heavy the range shortens'],
  ),
  'machine lateral raise': f(
    ['Siéntate y ajusta el asiento para que el eje quede a la altura del hombro', 'Antebrazos o codos contra las almohadillas', 'Sube hasta la altura del hombro y aprieta un instante arriba', 'Baja controlado sin golpear las placas'],
    ['Sit and set the seat so the pivot is at shoulder height', 'Forearms or elbows against the pads', 'Raise to shoulder height and squeeze for an instant at the top', 'Lower under control without clanging the plates'],
    ['Asiento mal ajustado que descoloca el eje del hombro', 'Empujar con el cuerpo hacia delante', 'Subir por encima del hombro'],
    ['Wrong seat height that misaligns the shoulder pivot', 'Pushing the body forward', 'Raising above shoulder height'],
  ),
  'dumbbell front raise': f(
    ['De pie con una mancuerna en cada mano delante de los muslos, palmas hacia el cuerpo', 'Abdomen apretado y codos casi estirados y fijos', 'Sube un brazo (o los dos) al frente hasta la altura del hombro', 'Baja despacio sin dejar caer ni balancearte'],
    ['Standing with a dumbbell in each hand in front of your thighs, palms toward the body', 'Abs braced and elbows nearly straight and fixed', 'Raise one arm (or both) to the front up to shoulder height', 'Lower slowly without dropping or swinging'],
    ['Echar el tronco atrás para subir', 'Pasar muy por encima del hombro', 'Doblar los codos y hacer un curl'],
    ['Leaning back to raise the weight', 'Going well above shoulder height', 'Bending the elbows and curling'],
  ),
  'cable front raise': f(
    ['Polea abajo, de espaldas a ella, agarra el asa por delante de los muslos', 'Abdomen apretado y codo casi estirado', 'Sube el brazo al frente hasta la altura del hombro con tensión constante', 'Baja controlado sin dejar que el peso tire de ti'],
    ['Pulley at the bottom, back to the machine, take the handle in front of your thighs', 'Abs braced and elbow nearly straight', 'Raise the arm to the front up to shoulder height with constant tension', 'Lower under control without letting the weight pull you'],
    ['Inclinarse hacia atrás para compensar', 'Encoger el hombro arriba', 'Recorrido corto por exceso de peso'],
    ['Leaning back to compensate', 'Shrugging at the top', 'Short range from too much weight'],
  ),
  'dumbbell rear delt fly': f(
    ['Sentado en el borde del banco o de pie, haz bisagra hasta que el tronco quede casi horizontal', 'Mancuernas colgando bajo el pecho con los codos algo flexionados y fijos', 'Abre los brazos hacia los lados hasta la altura del hombro y aprieta detrás', 'Baja despacio sin que las mancuernas choquen'],
    ['Seated on the bench edge or standing, hinge until the torso is nearly horizontal', 'Dumbbells hanging under the chest with elbows slightly bent and fixed', 'Open the arms out to shoulder height and squeeze behind the shoulder', 'Lower slowly without clanging the dumbbells'],
    ['Remar hacia atrás en vez de abrir', 'Incorporar el tronco en cada repetición', 'Usar peso que obliga a coger impulso'],
    ['Rowing back instead of opening out', 'Raising the torso on every rep', 'Using weight that forces momentum'],
  ),
  'reverse pec deck': f(
    ['Siéntate mirando al respaldo, pecho apoyado y asiento a la altura del hombro', 'Agarra las asas con los brazos al frente y los codos algo flexionados', 'Abre los brazos hacia atrás hasta la línea del cuerpo y aprieta el deltoide posterior', 'Vuelve controlado dejando que los brazos crucen delante'],
    ['Sit facing the pad, chest supported and seat at shoulder height', 'Take the handles with arms out front and elbows slightly bent', 'Open the arms back to body line and squeeze the rear delts', 'Return under control letting the arms cross in front'],
    ['Ir más atrás de la línea del cuerpo y forzar el hombro', 'Despegar el pecho del apoyo', 'Doblar y estirar los codos'],
    ['Going past body line and straining the shoulder', 'Lifting the chest off the pad', 'Bending and straightening the elbows'],
  ),
  'cable rear delt fly': f(
    ['Poleas altas cruzadas: agarra el asa derecha con la izquierda y al revés', 'Brazos cruzados delante con los codos algo flexionados y fijos', 'Abre hacia fuera y atrás describiendo una X, y aprieta detrás del hombro', 'Vuelve controlado dejando que los brazos se crucen otra vez'],
    ['High pulleys crossed: take the right handle with the left hand and vice versa', 'Arms crossed in front with elbows slightly bent and fixed', 'Open out and back describing an X, and squeeze behind the shoulder', 'Return under control letting the arms cross again'],
    ['Doblar los codos y remar', 'Usar el tronco para tirar', 'Poner tanto peso que hay que arquearse'],
    ['Bending the elbows and rowing', 'Using the torso to pull', 'Loading so heavy you have to arch'],
  ),
  'y-raise': f(
    ['Tumbado boca abajo en un banco inclinado o de pie con bisagra de cadera', 'Mancuernas ligeras con las palmas enfrentadas y brazos colgando', 'Sube los brazos en diagonal formando una Y, con los pulgares arriba', 'Baja despacio sin encoger los hombros'],
    ['Face down on an inclined bench or standing with a hip hinge', 'Light dumbbells with palms facing each other and arms hanging', 'Raise the arms on a diagonal forming a Y, thumbs up', 'Lower slowly without shrugging'],
    ['Usar demasiado peso: es un ejercicio de control', 'Encoger los hombros hacia las orejas', 'Perder la Y y abrir en cruz'],
    ['Using too much weight: this is a control exercise', 'Shrugging toward the ears', 'Losing the Y and opening into a T'],
  ),
  'band external rotation': f(
    ['Ancla la banda a la altura del codo y colócate de lado', 'Codo pegado al costado y doblado a 90 grados, antebrazo cruzando el abdomen', 'Gira el antebrazo hacia fuera manteniendo el codo pegado, y aprieta al final', 'Vuelve despacio resistiendo la banda'],
    ['Anchor the band at elbow height and stand side on', 'Elbow tucked at your side bent to 90 degrees, forearm across the abdomen', 'Rotate the forearm outward keeping the elbow tucked, and squeeze at the end', 'Return slowly resisting the band'],
    ['Separar el codo del costado', 'Girar el tronco en vez del hombro', 'Usar una banda tan dura que se pierde el control'],
    ['Letting the elbow drift from the side', 'Rotating the torso instead of the shoulder', 'Using a band so stiff you lose control'],
  ),
  'cable external rotation': f(
    ['Polea a la altura del codo, de lado, agarra el asa con la mano más alejada', 'Codo pegado al costado a 90 grados; puedes poner una toalla enrollada debajo', 'Gira hacia fuera con el codo fijo y aprieta al final del recorrido', 'Vuelve controlado sin dejar que el cable te arrastre'],
    ['Pulley at elbow height, standing side on, take the handle with the far hand', 'Elbow tucked at 90 degrees; a rolled towel underneath helps', 'Rotate outward with a fixed elbow and squeeze at the end of the range', 'Return under control without letting the cable yank you'],
    ['Usar demasiado peso en un músculo pequeño', 'Mover el codo hacia delante', 'Rotar el tronco'],
    ['Using too much weight on a small muscle', 'Letting the elbow travel forward', 'Rotating the torso'],
  ),
  'barbell upright row': f(
    ['De pie con la barra delante de los muslos, agarre a la anchura de los hombros', 'Un agarre demasiado estrecho aumenta el pinzamiento: mejor ancho', 'Sube la barra pegada al cuerpo llevando los codos arriba y afuera, hasta el pecho', 'Baja controlado hasta estirar los brazos'],
    ['Standing with the bar in front of your thighs, grip at shoulder width', 'Too narrow a grip increases impingement: go wider', 'Pull the bar up close to the body driving the elbows up and out, to chest height', 'Lower under control to straight arms'],
    ['Subir la barra hasta la barbilla y pinzar el hombro', 'Agarre muy estrecho', 'Balancearse para arrancar el peso'],
    ['Pulling the bar to the chin and impinging the shoulder', 'Very narrow grip', 'Swinging to start the weight'],
  ),
  'cable upright row': f(
    ['Polea baja con barra recta o cuerda, de pie muy cerca del cable', 'Brazos estirados delante de los muslos y abdomen apretado', 'Sube llevando los codos arriba y afuera hasta la altura del pecho', 'Baja controlado; el cable mantiene tensión todo el recorrido'],
    ['Low pulley with a straight bar or rope, standing close to the cable', 'Arms straight in front of the thighs and abs braced', 'Pull driving the elbows up and out to chest height', 'Lower under control; the cable keeps tension the whole way'],
    ['Subir por encima del pecho', 'Alejarse de la polea y cambiar el ángulo', 'Encoger los hombros al final'],
    ['Pulling above chest height', 'Standing too far from the pulley and changing the angle', 'Shrugging at the end'],
  ),
  // ══ BÍCEPS ══
  'barbell curl': f(
    ['De pie con la barra en las manos, agarre supino a la anchura de los hombros', 'Codos pegados al costado y abdomen apretado; los hombros no se mueven', 'Sube la barra flexionando solo el codo y aprieta arriba sin dejar que el codo suba', 'Baja despacio hasta estirar los brazos del todo'],
    ['Standing with the bar in your hands, supinated grip at shoulder width', 'Elbows tucked at your sides and abs braced; the shoulders do not move', 'Curl the bar bending only the elbow and squeeze at the top without letting the elbow rise', 'Lower slowly to fully straight arms'],
    ['Balancear el tronco para subir el peso', 'Adelantar los codos y convertirlo en un remo', 'No estirar abajo y trabajar medio rango'],
    ['Swinging the torso to lift the weight', 'Letting the elbows travel forward and turning it into a row', 'Not straightening at the bottom and working half the range'],
  ),
  'ez-bar curl': f(
    ['De pie con la barra Z, manos en las curvas con las palmas algo giradas', 'La barra Z reduce la tensión en la muñeca: úsala si la barra recta te molesta', 'Sube flexionando el codo, que se queda pegado al costado, y aprieta arriba', 'Baja controlado hasta estirar del todo'],
    ['Standing with the EZ-bar, hands on the angled sections with palms slightly turned', 'The EZ-bar eases wrist strain: use it if the straight bar bothers you', 'Curl bending the elbow, which stays tucked at your side, and squeeze at the top', 'Lower under control to full extension'],
    ['Mover los codos hacia delante', 'Coger impulso con la cadera', 'Agarrar en la parte recta y perder la ventaja de la barra Z'],
    ['Letting the elbows drift forward', 'Using hip momentum', 'Gripping the straight section and losing the EZ-bar advantage'],
  ),
  'dumbbell curl': f(
    ['De pie o sentado con una mancuerna en cada mano, palmas al frente o neutras', 'Codos pegados al costado y hombros quietos', 'Sube girando la palma hacia arriba si empiezas neutro, y aprieta arriba', 'Baja despacio hasta estirar el brazo por completo'],
    ['Standing or seated with a dumbbell in each hand, palms forward or neutral', 'Elbows tucked and shoulders still', 'Curl rotating the palm up if you started neutral, and squeeze at the top', 'Lower slowly to a fully straight arm'],
    ['Balancearse para subir', 'Levantar el codo al final del recorrido', 'Dejar caer el peso en la bajada'],
    ['Swinging to lift', 'Raising the elbow at the end of the range', 'Dropping the weight on the way down'],
  ),
  'hammer curl': f(
    ['De pie con una mancuerna en cada mano y las palmas enfrentadas, como un martillo', 'Codos pegados y muñeca firme; la palma NO gira en todo el recorrido', 'Sube hasta el hombro manteniendo el agarre neutro y aprieta', 'Baja controlado hasta estirar'],
    ['Standing with a dumbbell in each hand and palms facing each other, like a hammer', 'Elbows tucked and wrist firm; the palm does NOT rotate at any point', 'Curl to the shoulder keeping the neutral grip and squeeze', 'Lower under control to full extension'],
    ['Girar la palma y convertirlo en curl normal', 'Adelantar los codos', 'Coger impulso con el tronco'],
    ['Rotating the palm and turning it into a regular curl', 'Letting the elbows travel forward', 'Using torso momentum'],
  ),
  'rope hammer curl (cable)': f(
    ['Polea baja con cuerda, de pie con las palmas enfrentadas agarrando los extremos', 'Codos pegados al costado y abdomen apretado', 'Sube manteniendo el agarre neutro y separa un poco las manos arriba, apretando', 'Baja controlado; el cable mantiene tensión también abajo'],
    ['Low pulley with a rope, standing with palms facing each other holding the ends', 'Elbows tucked and abs braced', 'Curl keeping the neutral grip and spread the hands slightly at the top, squeezing', 'Lower under control; the cable keeps tension at the bottom too'],
    ['Echarse atrás para subir', 'Mover los codos hacia delante', 'Soltar la tensión abajo apoyando en la pila'],
    ['Leaning back to curl', 'Letting the elbows drift forward', 'Dumping tension at the bottom onto the stack'],
  ),
  'concentration curl': f(
    ['Sentado en el banco con las piernas abiertas, apoya el codo en la cara interna del muslo', 'Brazo colgando con la mancuerna y la palma hacia delante', 'Sube flexionando solo el codo hasta el hombro y aprieta fuerte arriba', 'Baja muy despacio hasta estirar el brazo del todo'],
    ['Seated on the bench with legs apart, brace your elbow against the inner thigh', 'Arm hanging with the dumbbell and palm forward', 'Curl bending only the elbow up to the shoulder and squeeze hard at the top', 'Lower very slowly to a fully straight arm'],
    ['Separar el codo del muslo', 'Balancear el tronco hacia atrás', 'Usar tanto peso que hace falta impulso'],
    ['Letting the elbow leave the thigh', 'Rocking the torso back', 'Using so much weight you need momentum'],
  ),
  'ez-bar preacher curl': f(
    ['Siéntate en el banco predicador con las axilas apoyadas en el borde alto', 'Agarra la barra Z en supinación con los brazos estirados sobre la almohadilla', 'Sube flexionando el codo hasta unos tres cuartos del recorrido y aprieta', 'Baja MUY controlado: abajo el bíceps queda muy estirado y es donde más se lesiona'],
    ['Sit at the preacher bench with your armpits over the top edge', 'Take the EZ-bar supinated with straight arms on the pad', 'Curl bending the elbow to about three quarters of the range and squeeze', 'Lower VERY slowly: at the bottom the biceps is fully stretched and most vulnerable'],
    ['Dejar caer el peso al estirar abajo', 'Despegar las axilas de la almohadilla', 'Rebotar en la posición baja'],
    ['Dropping the weight at the bottom stretch', 'Lifting the armpits off the pad', 'Bouncing out of the bottom position'],
  ),
  'machine preacher curl': f(
    ['Ajusta el asiento para que el codo quede alineado con el eje de la máquina', 'Brazos apoyados en la almohadilla y agarre firme', 'Sube flexionando el codo y aprieta arriba un instante', 'Baja controlado hasta casi estirar, sin soltar la tensión'],
    ['Set the seat so your elbow lines up with the machine pivot', 'Arms on the pad and a firm grip', 'Curl bending the elbow and squeeze at the top for an instant', 'Lower under control to almost straight, keeping the tension'],
    ['Codo mal alineado con el eje', 'Levantar el cuerpo del asiento para ayudarse', 'Soltar de golpe en la bajada'],
    ['Elbow misaligned with the pivot', 'Lifting off the seat to help', 'Letting go suddenly on the way down'],
  ),
  'cable curl': f(
    ['Polea baja con barra recta o Z, de pie a un paso del cable', 'Codos pegados al costado, abdomen apretado y brazos estirados abajo', 'Sube flexionando el codo y aprieta arriba con tensión constante', 'Baja controlado hasta estirar sin apoyar las placas'],
    ['Low pulley with a straight or EZ bar, standing a step from the cable', 'Elbows tucked, abs braced and arms straight at the bottom', 'Curl bending the elbow and squeeze at the top with constant tension', 'Lower under control to full extension without resting the plates'],
    ['Echarse atrás para levantar el peso', 'Adelantar los codos', 'Descansar el peso en la pila entre repeticiones'],
    ['Leaning back to lift the weight', 'Letting the elbows travel forward', 'Resting the weight on the stack between reps'],
  ),
  'incline dumbbell curl': f(
    ['Túmbate en un banco inclinado a unos 45 o 60 grados con los brazos colgando', 'La inclinación estira el bíceps desde el inicio: pesa más de lo que parece', 'Sube flexionando el codo sin adelantarlo y aprieta arriba', 'Baja despacio hasta que el brazo cuelgue estirado del todo'],
    ['Lie on a bench inclined to 45 or 60 degrees with the arms hanging', 'The incline stretches the biceps from the start: it feels heavier than it looks', 'Curl bending the elbow without letting it travel forward and squeeze at the top', 'Lower slowly until the arm hangs fully straight'],
    ['Adelantar el hombro y perder el estiramiento', 'Usar el mismo peso que de pie', 'Despegar la espalda del banco'],
    ['Letting the shoulder travel forward and losing the stretch', 'Using the same weight as standing', 'Lifting the back off the bench'],
  ),
  'spider curl': f(
    ['Túmbate boca abajo sobre un banco inclinado con los brazos colgando verticales', 'Mancuernas o barra Z con las palmas al frente', 'Sube flexionando solo el codo; el brazo cuelga perpendicular al suelo', 'Baja controlado hasta estirar por completo'],
    ['Lie face down on an inclined bench with the arms hanging vertically', 'Dumbbells or an EZ-bar with palms forward', 'Curl bending only the elbow; the upper arm hangs perpendicular to the floor', 'Lower under control to full extension'],
    ['Despegar el pecho del banco', 'Balancear las mancuernas', 'Recorrido corto por exceso de peso'],
    ['Lifting the chest off the bench', 'Swinging the dumbbells', 'Short range from too much weight'],
  ),
  'reverse barbell curl': f(
    ['De pie con la barra en agarre prono, manos a la anchura de los hombros', 'Codos pegados y muñecas firmes y rectas', 'Sube flexionando el codo con los nudillos hacia arriba y aprieta el antebrazo', 'Baja despacio manteniendo la muñeca recta'],
    ['Standing with the bar in a pronated grip, hands at shoulder width', 'Elbows tucked and wrists firm and straight', 'Curl with the knuckles facing up and squeeze the forearm', 'Lower slowly keeping the wrist straight'],
    ['Doblar la muñeca hacia abajo', 'Usar el mismo peso que en el curl normal: aquí se levanta menos', 'Coger impulso con el tronco'],
    ['Letting the wrist bend down', 'Using the same weight as the regular curl: you lift less here', 'Using torso momentum'],
  ),

  // ══ TRÍCEPS ══
  'triceps pushdown (bar)': f(
    ['Polea alta con barra recta, de pie a un paso, codos pegados al costado', 'Inclínate un poco hacia delante y aprieta el abdomen', 'Estira los brazos hacia abajo hasta bloquear y aprieta el tríceps un instante', 'Sube controlado hasta que el antebrazo pase de la horizontal, sin mover el codo'],
    ['High pulley with a straight bar, standing a step away, elbows tucked', 'Lean slightly forward and brace your abs', 'Extend the arms down to lockout and squeeze the triceps for an instant', 'Return under control until the forearm passes horizontal, without moving the elbow'],
    ['Separar los codos del costado', 'Empujar con el peso del cuerpo hacia abajo', 'Subir tanto que el hombro entra a trabajar'],
    ['Letting the elbows leave the sides', 'Pushing down with body weight', 'Coming up so high the shoulder takes over'],
  ),
  'rope pushdown': f(
    ['Polea alta con cuerda, agarra los extremos con las palmas enfrentadas', 'Codos pegados al costado y tronco ligeramente inclinado', 'Estira hacia abajo separando las manos al final y aprieta el tríceps', 'Sube controlado sin dejar que los codos se abran'],
    ['High pulley with a rope, hold the ends with palms facing each other', 'Elbows tucked and torso leaning slightly', 'Extend down separating the hands at the end and squeeze the triceps', 'Return under control without letting the elbows flare'],
    ['No separar la cuerda al final y perder la contracción', 'Mover los codos hacia atrás', 'Usar el cuerpo para empujar'],
    ['Not spreading the rope at the end and losing the contraction', 'Letting the elbows travel back', 'Using the body to push'],
  ),
  'machine triceps extension': f(
    ['Ajusta el asiento para que el codo quede alineado con el eje de la máquina', 'Brazos apoyados y agarre firme en las asas', 'Estira los brazos hasta bloquear y aprieta un instante', 'Vuelve controlado sin golpear las placas'],
    ['Set the seat so your elbow lines up with the machine pivot', 'Arms supported and a firm grip on the handles', 'Extend the arms to lockout and squeeze for an instant', 'Return under control without clanging the plates'],
    ['Codo desalineado con el eje', 'Empujar con el tronco', 'Recorrido corto por exceso de carga'],
    ['Elbow misaligned with the pivot', 'Pushing with the torso', 'Short range from too much load'],
  ),
  'single-arm cable pushdown': f(
    ['Polea alta con asa individual, agarra con una mano en supinación o neutro', 'Codo pegado al costado y la otra mano en la cadera', 'Estira el brazo hacia abajo y aprieta el tríceps al bloquear', 'Sube controlado hasta que el antebrazo pase la horizontal'],
    ['High pulley with a single handle, grip with one hand supinated or neutral', 'Elbow tucked and the other hand on your hip', 'Extend the arm down and squeeze the triceps at lockout', 'Return under control until the forearm passes horizontal'],
    ['Rotar el tronco para ayudarse', 'Separar el codo del costado', 'Cargar tanto que hay que empujar con el hombro'],
    ['Rotating the torso to help', 'Letting the elbow leave the side', 'Loading so heavy you push with the shoulder'],
  ),
  'reverse-grip pushdown': f(
    ['Polea alta con barra recta, agarre supino con las palmas hacia arriba', 'Codos pegados y muñecas firmes; se levanta menos peso que en prono', 'Estira hacia abajo hasta bloquear y aprieta la cabeza medial del tríceps', 'Sube controlado sin mover el codo'],
    ['High pulley with a straight bar, supinated grip with palms up', 'Elbows tucked and wrists firm; you lift less than with a pronated grip', 'Extend down to lockout and squeeze the medial head of the triceps', 'Return under control without moving the elbow'],
    ['Usar el mismo peso que con agarre prono', 'Doblar la muñeca', 'Abrir los codos al bajar'],
    ['Using the same weight as the pronated grip', 'Letting the wrist bend', 'Flaring the elbows on the way down'],
  ),
  'ez-bar skull crusher': f(
    ['Tumbado en el banco con la barra Z sobre el pecho y los brazos estirados', 'Lleva los brazos ligeramente hacia atrás para que el tríceps no descanse', 'Baja doblando SOLO el codo hasta la frente o algo por detrás de la cabeza', 'Estira volviendo al punto de partida sin mover el hombro'],
    ['Lying on the bench with the EZ-bar over your chest and arms straight', 'Angle the upper arms slightly back so the triceps never rests', 'Lower bending ONLY the elbow to your forehead or just behind the head', 'Extend back to the start without moving the shoulder'],
    ['Mover el hombro y convertirlo en un press', 'Bajar la barra a la nariz sin control', 'Bloquear los codos de golpe arriba'],
    ['Moving the shoulder and turning it into a press', 'Lowering the bar to the nose without control', 'Snapping the elbows straight at the top'],
  ),
  'dumbbell skull crusher': f(
    ['Tumbado con una mancuerna en cada mano, palmas enfrentadas, brazos estirados', 'Brazos ligeramente inclinados hacia atrás y codos fijos', 'Baja doblando el codo hasta los lados de la cabeza', 'Estira arriba apretando el tríceps sin abrir los codos'],
    ['Lying with a dumbbell in each hand, palms facing each other, arms straight', 'Upper arms angled slightly back and elbows fixed', 'Lower bending the elbow to the sides of your head', 'Extend up squeezing the triceps without flaring the elbows'],
    ['Abrir los codos hacia los lados', 'Mover el hombro', 'Bajar más allá del rango cómodo'],
    ['Flaring the elbows out', 'Moving the shoulder', 'Going past a comfortable range'],
  ),
  'overhead triceps extension': f(
    ['Polea baja con cuerda, de espaldas a la máquina, cuerda por detrás de la cabeza', 'Da un paso adelante e inclina el tronco; codos apuntando al frente y pegados', 'Estira los brazos hacia arriba y adelante hasta bloquear, apretando el tríceps', 'Baja controlado hasta notar el estiramiento detrás del brazo'],
    ['Low pulley with a rope, back to the machine, rope behind your head', 'Step forward and lean the torso; elbows pointing forward and tucked', 'Extend the arms up and forward to lockout, squeezing the triceps', 'Lower under control until you feel the stretch behind the arm'],
    ['Abrir los codos hacia los lados', 'Mover los hombros arriba y abajo', 'Arquear la espalda baja para empujar'],
    ['Flaring the elbows out', 'Moving the shoulders up and down', 'Arching the lower back to push'],
  ),
  'single-arm overhead extension': f(
    ['Sentado o de pie con una mancuerna sujeta con una mano por encima de la cabeza', 'Codo apuntando al techo y pegado a la oreja; la otra mano puede sujetarlo', 'Baja la mancuerna por detrás de la cabeza doblando solo el codo', 'Estira arriba apretando el tríceps sin mover el hombro'],
    ['Seated or standing holding a dumbbell overhead with one hand', 'Elbow pointing at the ceiling and close to your ear; the other hand can brace it', 'Lower the dumbbell behind your head bending only the elbow', 'Extend up squeezing the triceps without moving the shoulder'],
    ['Abrir el codo hacia fuera', 'Arquear la lumbar al estirar', 'Bajar sin control y forzar el codo'],
    ['Letting the elbow flare out', 'Arching the lower back on extension', 'Lowering without control and straining the elbow'],
  ),
  'bench dips': f(
    ['Apoya las manos en el borde del banco a la anchura de las caderas, dedos al frente', 'Piernas estiradas o dobladas por delante y cadera cerca del banco', 'Baja doblando los codos hacia atrás hasta unos 90 grados', 'Empuja hasta estirar los brazos sin bloquear de golpe'],
    ['Place your hands on the bench edge at hip width, fingers forward', 'Legs straight or bent in front and hips close to the bench', 'Lower bending the elbows straight back to about 90 degrees', 'Press up to straight arms without snapping the lockout'],
    ['Alejar la cadera del banco y cargar el hombro', 'Bajar más de 90 grados', 'Abrir los codos hacia los lados'],
    ['Letting the hips drift from the bench and loading the shoulder', 'Going deeper than 90 degrees', 'Flaring the elbows out'],
  ),
  'assisted dips': f(
    ['Apoya rodillas o pies en la plataforma y agarra las paralelas con los brazos estirados', 'Más peso en la máquina significa MÁS ayuda, no más esfuerzo', 'Baja con el tronco vertical y los codos hacia atrás hasta unos 90 grados', 'Empuja arriba hasta estirar sin encoger los hombros'],
    ['Place knees or feet on the pad and grab the bars with straight arms', 'More weight on the machine means MORE assistance, not more effort', 'Lower with a vertical torso and elbows back to about 90 degrees', 'Press up to straight arms without shrugging'],
    ['Rebotar sobre la plataforma', 'Inclinarse mucho y convertirlo en fondos de pecho', 'Bajar más de lo que tolera el hombro'],
    ['Bouncing off the pad', 'Leaning far forward and turning it into chest dips', 'Going deeper than the shoulder tolerates'],
  ),
  'triceps kickback': f(
    ['Bisagra de cadera con el tronco casi horizontal, una mano apoyada en el banco', 'Sube el codo hasta que el brazo quede paralelo al suelo y FÍJALO ahí', 'Estira el antebrazo hacia atrás hasta bloquear y aprieta el tríceps', 'Vuelve doblando el codo sin bajar el brazo'],
    ['Hinge at the hips with the torso nearly horizontal, one hand on the bench', 'Raise the elbow until the upper arm is parallel to the floor and FIX it there', 'Extend the forearm back to lockout and squeeze the triceps', 'Return bending the elbow without dropping the upper arm'],
    ['Bajar el codo en cada repetición', 'Balancear el brazo con impulso', 'Usar demasiado peso: es un ejercicio de contracción'],
    ['Dropping the elbow on every rep', 'Swinging the arm with momentum', 'Using too much weight: this is a contraction exercise'],
  ),
  'close-grip bench press': f(
    ['Tumbado con la barra y las manos a la anchura de los hombros, no más juntas', 'Escápulas juntas y codos pegados al cuerpo', 'Baja la barra a la parte baja del pecho con los codos rozando el costado', 'Empuja hasta estirar apretando el tríceps arriba'],
    ['Lying with the bar and hands at shoulder width, no closer', 'Shoulder blades retracted and elbows tucked to the body', 'Lower the bar to the lower chest with the elbows brushing your sides', 'Press to lockout squeezing the triceps at the top'],
    ['Juntar tanto las manos que se cargan las muñecas', 'Abrir los codos y convertirlo en banca normal', 'Rebotar la barra en el pecho'],
    ['Gripping so narrow the wrists take the load', 'Flaring the elbows and turning it into a regular bench', 'Bouncing the bar off the chest'],
  ),

  // ══ PIERNA ══
  'barbell squat': f(
    ['Barra apoyada en los trapecios, pies a la anchura de los hombros y puntas algo abiertas', 'Aprieta abdomen, saca pecho y mira al frente', 'Baja llevando cadera atrás y rodillas afuera hasta que el muslo pase la paralela si puedes', 'Sube empujando el suelo con todo el pie, sin que suba antes la cadera que el pecho'],
    ['Bar on the traps, feet at shoulder width and toes slightly out', 'Brace your abs, chest up and eyes forward', 'Descend pushing the hips back and knees out until the thigh passes parallel if you can', 'Drive up pushing the floor through the whole foot, without the hips rising before the chest'],
    ['Meter las rodillas hacia dentro al subir', 'Redondear la espalda baja al final de la bajada', 'Levantar los talones del suelo'],
    ['Letting the knees cave in on the way up', 'Rounding the lower back at the bottom', 'Lifting the heels off the floor'],
  ),
  'front squat': f(
    ['Barra apoyada en la parte delantera de los hombros con los codos MUY altos', 'Pies a la anchura de los hombros y tronco lo más vertical posible', 'Baja recto manteniendo los codos arriba; si caen, la barra rueda hacia delante', 'Sube empujando el suelo sin que el tronco se incline hacia delante'],
    ['Bar racked on the front of the shoulders with the elbows VERY high', 'Feet at shoulder width and torso as vertical as possible', 'Descend straight keeping the elbows up; if they drop, the bar rolls forward', 'Drive up without letting the torso tip forward'],
    ['Dejar caer los codos y perder la barra', 'Inclinar el tronco como en sentadilla trasera', 'Agarrar tan cerrado que la muñeca sufre'],
    ['Dropping the elbows and losing the bar', 'Leaning the torso like a back squat', 'Gripping so narrow the wrist suffers'],
  ),
  'smith machine squat': f(
    ['Coloca los pies algo por delante de la barra guiada, apoyada en los trapecios', 'La guía fija el recorrido: puedes adelantar los pies sin caerte', 'Baja hasta que el muslo pase la paralela con la espalda apoyada en la línea', 'Sube empujando con todo el pie y bloquea los ganchos solo al terminar'],
    ['Place the feet slightly in front of the guided bar, resting on the traps', 'The rail fixes the path: you can move the feet forward without falling', 'Lower until the thigh passes parallel with the back along the line', 'Drive up through the whole foot and only hook the safeties at the end'],
    ['Poner los pies debajo de la barra y forzar la rodilla', 'Comparar el peso con la sentadilla libre', 'Rebotar en el punto bajo confiando en la guía'],
    ['Placing the feet under the bar and straining the knee', 'Comparing the weight with the free squat', 'Bouncing at the bottom because the rail feels safe'],
  ),
  'hack squat (machine)': f(
    ['Apoya espalda y hombros en las almohadillas con los pies a media plataforma', 'Pies a la anchura de los hombros y puntas ligeramente abiertas', 'Baja doblando las rodillas hasta que el muslo pase la paralela, sin despegar la espalda', 'Empuja hasta casi estirar sin bloquear la rodilla de golpe'],
    ['Rest your back and shoulders on the pads with the feet mid platform', 'Feet at shoulder width and toes slightly out', 'Lower bending the knees until the thigh passes parallel, keeping the back on the pad', 'Press up to almost straight without snapping the knees'],
    ['Despegar la cadera de la almohadilla abajo', 'Bloquear la rodilla de golpe arriba', 'Poner los pies tan abajo que la rodilla se adelanta en exceso'],
    ['Letting the hips peel off the pad at the bottom', 'Snapping the knees straight at the top', 'Placing the feet so low the knee travels too far forward'],
  ),
  'goblet squat': f(
    ['Sujeta una mancuerna o kettlebell con las dos manos pegada al pecho', 'Pies a la anchura de los hombros y codos por dentro de las rodillas', 'Baja recto manteniendo el pecho alto; el peso delante te ayuda a no caerte', 'Sube empujando el suelo y aprieta glúteos arriba'],
    ['Hold a dumbbell or kettlebell with both hands against your chest', 'Feet at shoulder width and elbows inside the knees', 'Descend straight keeping the chest tall; the front load helps you stay upright', 'Drive up pushing the floor and squeeze the glutes at the top'],
    ['Separar el peso del pecho', 'Meter las rodillas hacia dentro', 'Redondear la espalda al bajar'],
    ['Letting the weight drift off the chest', 'Letting the knees cave in', 'Rounding the back at the bottom'],
  ),
  'dumbbell bulgarian split squat': f(
    ['Apoya el empeine del pie de atrás en un banco y adelanta el otro un paso largo', 'Una mancuerna en cada mano y tronco ligeramente inclinado adelante', 'Baja doblando la rodilla adelantada hasta que el muslo quede casi paralelo', 'Sube empujando con el talón del pie de delante, sin ayudarte con el de atrás'],
    ['Rest the top of your back foot on a bench and step the other forward a long stride', 'A dumbbell in each hand and torso leaning slightly forward', 'Lower bending the front knee until the thigh is nearly parallel', 'Drive up through the front heel, without pushing off the back foot'],
    ['Poner el pie de delante demasiado cerca del banco', 'Empujar con la pierna de atrás', 'Perder el equilibrio por mirar al suelo'],
    ['Placing the front foot too close to the bench', 'Pushing off the back leg', 'Losing balance by looking down'],
  ),
  'barbell bulgarian split squat': f(
    ['Barra en los trapecios y el empeine del pie de atrás sobre el banco', 'Pie de delante bien adelantado; el equilibrio es más difícil que con mancuernas', 'Baja doblando la rodilla adelantada con el tronco algo inclinado', 'Sube empujando con el talón de delante manteniendo la barra estable'],
    ['Bar on the traps and the top of the back foot on the bench', 'Front foot well forward; balance is harder than with dumbbells', 'Lower bending the front knee with the torso leaning slightly', 'Drive up through the front heel keeping the bar stable'],
    ['Cargar la barra antes de dominar la versión con mancuernas', 'Balancearse de lado', 'Apoyar el peso en la pierna de atrás'],
    ['Loading the bar before owning the dumbbell version', 'Swaying side to side', 'Shifting the load onto the back leg'],
  ),
  'leg press': f(
    ['Siéntate con la espalda y la cadera bien apoyadas en el respaldo', 'Pies a media plataforma, a la anchura de los hombros y puntas algo abiertas', 'Baja doblando las rodillas hasta unos 90 grados, sin que la cadera se despegue', 'Empuja hasta casi estirar sin bloquear la rodilla de golpe'],
    ['Sit with your back and hips firmly against the pad', 'Feet mid platform, shoulder width and toes slightly out', 'Lower bending the knees to about 90 degrees, without the hips lifting', 'Press to almost straight without snapping the knees'],
    ['Bajar tanto que la cadera se despega y la lumbar se redondea', 'Bloquear las rodillas de golpe arriba', 'Sujetar las rodillas con las manos'],
    ['Going so deep the hips lift and the lower back rounds', 'Snapping the knees straight at the top', 'Pushing on the knees with your hands'],
  ),
  'horizontal leg press': f(
    ['Siéntate con la espalda apoyada y los pies en la plataforma vertical', 'Pies a la anchura de los hombros y cadera pegada al respaldo', 'Empuja la plataforma hasta casi estirar las piernas', 'Vuelve controlado doblando las rodillas hasta unos 90 grados'],
    ['Sit with your back supported and feet on the vertical platform', 'Feet at shoulder width and hips against the pad', 'Push the platform until the legs are almost straight', 'Return under control bending the knees to about 90 degrees'],
    ['Despegar la cadera del respaldo', 'Bloquear las rodillas', 'Recorrido muy corto por exceso de carga'],
    ['Lifting the hips off the pad', 'Locking the knees', 'Very short range from too much load'],
  ),
  'dumbbell lunges': f(
    ['De pie con una mancuerna en cada mano a los lados y el tronco erguido', 'Da un paso al frente lo bastante largo para que la rodilla no se adelante en exceso', 'Baja hasta que la rodilla de atrás casi toque el suelo y el muslo de delante quede paralelo', 'Empuja con el talón de delante para volver a la posición inicial'],
    ['Standing with a dumbbell in each hand at your sides and a tall torso', 'Step forward long enough that the knee does not travel too far past the toes', 'Lower until the back knee almost touches the floor and the front thigh is parallel', 'Drive off the front heel to return to the start'],
    ['Paso demasiado corto y rodilla muy adelantada', 'Inclinar el tronco hacia delante', 'Meter la rodilla hacia dentro al subir'],
    ['Too short a step with the knee far past the toes', 'Leaning the torso forward', 'Letting the knee cave in on the way up'],
  ),
  'barbell lunges': f(
    ['Barra apoyada en los trapecios y tronco erguido', 'Da un paso al frente largo manteniendo el abdomen apretado', 'Baja hasta que la rodilla trasera casi toque el suelo', 'Empuja con el talón de delante para volver, sin perder la vertical del tronco'],
    ['Bar on the traps and a tall torso', 'Take a long step forward keeping the abs braced', 'Lower until the back knee almost touches the floor', 'Drive off the front heel to return, keeping the torso vertical'],
    ['Cargar antes de dominar el equilibrio sin peso', 'Inclinarse hacia delante y perder la barra', 'Pasos cortos que castigan la rodilla'],
    ['Loading before owning the balance unweighted', 'Leaning forward and losing the bar', 'Short steps that punish the knee'],
  ),
  'walking lunge (loaded)': f(
    ['De pie con una mancuerna en cada mano y espacio libre por delante', 'Da un paso largo y baja hasta que la rodilla de atrás casi roce el suelo', 'Empuja con el talón de delante y lleva el pie de atrás directo al siguiente paso', 'Encadena los pasos sin parar, manteniendo el tronco erguido'],
    ['Standing with a dumbbell in each hand and clear space ahead', 'Take a long step and lower until the back knee nearly grazes the floor', 'Drive off the front heel and bring the back foot straight into the next step', 'Chain the steps without stopping, keeping the torso tall'],
    ['Pasos cortos que adelantan mucho la rodilla', 'Inclinarse hacia delante al cansarse', 'Empezar sin mirar que hay sitio suficiente'],
    ['Short steps that push the knee far forward', 'Leaning forward as you fatigue', 'Starting without checking you have enough room'],
  ),
  'step-up': f(
    ['Colócate frente a un cajón o banco a la altura de la rodilla, mancuerna en cada mano', 'Apoya el pie entero en el cajón, no solo la punta', 'Sube empujando con la pierna de arriba, sin impulsarte con la de abajo', 'Baja controlado apoyando primero la punta del pie de atrás'],
    ['Stand facing a box or bench at knee height, a dumbbell in each hand', 'Place the whole foot on the box, not just the toes', 'Step up driving through the top leg, without pushing off the bottom one', 'Step down under control landing on the toes of the back foot first'],
    ['Impulsarse con la pierna de abajo', 'Cajón demasiado alto para el rango disponible', 'Dejarse caer al bajar'],
    ['Pushing off the bottom leg', 'Box too high for your available range', 'Dropping down on the descent'],
  ),
  'barbell hip thrust': f(
    ['Apoya la parte alta de la espalda en un banco y coloca la barra sobre la cadera con una almohadilla', 'Pies a la anchura de las caderas, talones bajo las rodillas', 'Empuja con los talones subiendo la cadera hasta alinear tronco y muslos, y aprieta glúteos arriba', 'Baja controlado sin apoyar del todo el peso en el suelo'],
    ['Rest your upper back on a bench and place the bar over your hips with a pad', 'Feet hip width, heels under the knees', 'Drive through the heels lifting the hips until torso and thighs align, and squeeze the glutes at the top', 'Lower under control without fully resting the weight on the floor'],
    ['Hiperextender la lumbar arriba en vez de apretar el glúteo', 'Levantar la barbilla y arquear el cuello', 'Pies demasiado lejos y trabajo al femoral'],
    ['Hyperextending the lower back at the top instead of squeezing the glute', 'Lifting the chin and arching the neck', 'Feet too far away shifting the work to the hamstrings'],
  ),
  'machine hip thrust': f(
    ['Siéntate en la máquina con la espalda apoyada y la almohadilla sobre la cadera', 'Pies en la plataforma a la anchura de las caderas', 'Empuja la cadera hasta extender del todo y aprieta el glúteo un instante', 'Vuelve controlado sin dejar que el peso caiga'],
    ['Sit in the machine with your back supported and the pad over your hips', 'Feet on the platform at hip width', 'Drive the hips to full extension and squeeze the glute for an instant', 'Return under control without letting the weight drop'],
    ['Arquear la lumbar en vez de extender la cadera', 'Recorrido corto por exceso de carga', 'Empujar con las puntas de los pies'],
    ['Arching the lower back instead of extending the hips', 'Short range from too much load', 'Pushing through the toes'],
  ),
  'glute bridge': f(
    ['Túmbate boca arriba con las rodillas dobladas y los pies apoyados a la anchura de las caderas', 'Talones cerca de los glúteos y brazos a los lados', 'Empuja con los talones subiendo la cadera hasta alinear tronco y muslos, y aprieta arriba', 'Baja controlado hasta rozar el suelo sin descansar'],
    ['Lie face up with knees bent and feet flat at hip width', 'Heels close to your glutes and arms at your sides', 'Drive through the heels lifting the hips until torso and thighs align, and squeeze at the top', 'Lower under control to graze the floor without resting'],
    ['Arquear la lumbar para subir más', 'Empujar con las puntas de los pies', 'Subir y bajar rápido sin apretar arriba'],
    ['Arching the lower back to go higher', 'Pushing through the toes', 'Rushing up and down without squeezing at the top'],
  ),
  'cable glute kickback': f(
    ['Polea baja con tobillera, de pie frente a la máquina agarrado al armazón', 'Inclínate ligeramente hacia delante con el abdomen apretado', 'Lleva la pierna atrás con la rodilla casi estirada y aprieta el glúteo al final', 'Vuelve controlado sin dejar que la pierna caiga'],
    ['Low pulley with an ankle strap, standing facing the machine holding the frame', 'Lean slightly forward with the abs braced', 'Drive the leg back with a nearly straight knee and squeeze the glute at the end', 'Return under control without letting the leg drop'],
    ['Arquear la lumbar para llevar la pierna más atrás', 'Girar la cadera hacia fuera', 'Usar impulso en vez de contracción'],
    ['Arching the lower back to swing the leg further', 'Rotating the hip outward', 'Using momentum instead of contraction'],
  ),
  'sumo deadlift': f(
    ['Pies muy abiertos con las puntas hacia fuera y la barra sobre el medio del pie', 'Agarra por dentro de las piernas, cadera baja y pecho alto', 'Empuja el suelo abriendo las rodillas y sube la barra pegada a las piernas', 'Bloquea cadera y rodillas arriba y baja por el mismo camino'],
    ['Feet very wide with toes out and the bar over mid foot', 'Grip inside the legs, hips low and chest tall', 'Push the floor spreading the knees and drive the bar up close to the legs', 'Lock hips and knees at the top and lower along the same path'],
    ['Meter las rodillas hacia dentro al arrancar', 'Subir primero la cadera y convertirlo en peso muerto convencional', 'Redondear la espalda baja'],
    ['Letting the knees cave in off the floor', 'Hips shooting up first and turning it into a conventional deadlift', 'Rounding the lower back'],
  ),
  'single-leg deadlift': f(
    ['De pie sobre una pierna con una mancuerna en la mano del lado contrario', 'Rodilla de apoyo ligeramente flexionada y cadera cuadrada', 'Baja llevando la cadera atrás y la pierna libre hacia arriba, formando una T', 'Vuelve apretando el glúteo de la pierna de apoyo, sin arquear la espalda'],
    ['Standing on one leg with a dumbbell in the opposite hand', 'Support knee softly bent and hips square', 'Hinge lowering the weight while the free leg rises back, forming a T', 'Return squeezing the glute of the support leg, without arching the back'],
    ['Abrir la cadera hacia el lado', 'Redondear la espalda para llegar más abajo', 'Empezar con demasiado peso y perder el equilibrio'],
    ['Letting the hip open to the side', 'Rounding the back to reach lower', 'Starting too heavy and losing balance'],
  ),
  'leg extension': f(
    ['Siéntate con la espalda apoyada y el rodillo justo encima del empeine', 'El eje de la máquina debe coincidir con la rodilla', 'Estira las piernas hasta arriba y aprieta el cuádriceps un instante', 'Baja controlado hasta unos 90 grados sin golpear las placas'],
    ['Sit with the back supported and the pad just above the instep', 'The machine pivot must line up with your knee', 'Extend the legs to the top and squeeze the quads for an instant', 'Lower under control to about 90 degrees without clanging the plates'],
    ['Rodillo demasiado alto en la espinilla', 'Levantar la cadera del asiento para empujar', 'Dejar caer el peso en la bajada'],
    ['Pad too high on the shin', 'Lifting the hips off the seat to push', 'Dropping the weight on the way down'],
  ),
  'lying leg curl': f(
    ['Túmbate boca abajo con el rodillo justo encima de los talones', 'Cadera pegada al banco y manos en las asas', 'Flexiona las rodillas llevando los talones hacia el glúteo y aprieta arriba', 'Baja despacio hasta casi estirar sin soltar la tensión'],
    ['Lie face down with the pad just above your heels', 'Hips pressed into the bench and hands on the handles', 'Curl the knees bringing the heels toward your glutes and squeeze at the top', 'Lower slowly to almost straight without dumping the tension'],
    ['Levantar la cadera del banco para ayudarse', 'Rodillo mal colocado sobre el gemelo', 'Bajar de golpe'],
    ['Lifting the hips off the bench to help', 'Pad misplaced over the calf', 'Dropping down fast'],
  ),
  'seated leg curl': f(
    ['Siéntate con la espalda apoyada y el rodillo sobre la parte baja de la pantorrilla', 'Ajusta el rodillo superior para que los muslos queden fijos', 'Flexiona las rodillas llevando los talones bajo el asiento y aprieta', 'Vuelve controlado hasta casi estirar'],
    ['Sit with your back supported and the pad on the lower calf', 'Set the upper pad so the thighs are locked down', 'Curl the knees bringing the heels under the seat and squeeze', 'Return under control to almost straight'],
    ['No fijar el rodillo superior y despegar el muslo', 'Recorrido corto por exceso de peso', 'Soltar el peso de golpe'],
    ['Not locking the upper pad and letting the thigh lift', 'Short range from too much weight', 'Releasing the weight suddenly'],
  ),
  'nordic curl': f(
    ['Arrodíllate con los tobillos bien sujetos por un compañero o bajo una espaldera', 'Cuerpo en línea de rodillas a hombros, abdomen y glúteos apretados', 'Baja MUY despacio resistiendo con el femoral todo lo que puedas', 'Amortigua con las manos al final y empuja para volver arriba'],
    ['Kneel with your ankles firmly held by a partner or under a bar', 'Body in a line from knees to shoulders, abs and glutes braced', 'Lower VERY slowly resisting with the hamstrings as long as you can', 'Catch yourself with your hands at the end and push back up'],
    ['Doblar la cadera y bajar el culo en vez de todo el cuerpo', 'Dejarse caer sin resistir', 'Intentarlo sin tener las manos listas para amortiguar'],
    ['Bending at the hips and dropping the butt instead of the whole body', 'Falling without resisting', 'Trying it without hands ready to catch you'],
  ),
  'standing calf raise': f(
    ['De pie en la máquina con la punta de los pies en el escalón y los talones al aire', 'Rodillas casi estiradas y hombros bajo las almohadillas', 'Sube todo lo alto que puedas sobre las puntas y aprieta un segundo arriba', 'Baja despacio hasta notar el estiramiento completo del gemelo'],
    ['Standing in the machine with the balls of your feet on the step and heels off the edge', 'Knees nearly straight and shoulders under the pads', 'Rise as high as you can onto the toes and squeeze for a second at the top', 'Lower slowly to a full calf stretch'],
    ['Rebotar arriba y abajo sin control', 'Doblar las rodillas y quitar trabajo al gemelo', 'Recorrido corto sin estirar abajo'],
    ['Bouncing up and down without control', 'Bending the knees and taking work off the calf', 'Short range without the bottom stretch'],
  ),
  'seated calf raise': f(
    ['Siéntate con las almohadillas sobre los muslos, justo encima de las rodillas', 'Puntas de los pies en el escalón y talones al aire', 'Sube sobre las puntas todo lo posible y aprieta arriba', 'Baja despacio hasta el estiramiento; la rodilla doblada carga el sóleo'],
    ['Sit with the pads on your thighs, just above the knees', 'Balls of the feet on the step and heels off the edge', 'Rise onto the toes as high as possible and squeeze at the top', 'Lower slowly to the stretch; the bent knee loads the soleus'],
    ['Rebotar sin control', 'Poner las almohadillas sobre la rodilla y no sobre el muslo', 'Recorrido mínimo'],
    ['Bouncing without control', 'Placing the pads on the knee instead of the thigh', 'Minimal range'],
  ),
  'calf press on leg press': f(
    ['Colócate en la prensa con las puntas de los pies en el borde inferior de la plataforma', 'Piernas casi estiradas pero SIN bloquear la rodilla', 'Empuja la plataforma con las puntas estirando el tobillo al máximo', 'Vuelve despacio dejando que el talón baje hasta estirar el gemelo'],
    ['Get in the leg press with the balls of your feet on the lower edge of the platform', 'Legs nearly straight but do NOT lock the knees', 'Push the platform with the toes extending the ankle fully', 'Return slowly letting the heel drop into a calf stretch'],
    ['Bloquear la rodilla: con carga alta es peligroso', 'Poner poco pie y que resbale', 'Rebotar sin controlar la bajada'],
    ['Locking the knee: dangerous under heavy load', 'Placing too little foot on and slipping off', 'Bouncing without controlling the descent'],
  ),
  'tibialis raise': f(
    ['De espaldas a la pared con los talones a unos 30 cm y la espalda apoyada', 'Piernas casi estiradas y peso en los talones', 'Sube las puntas de los pies hacia las espinillas todo lo que puedas y aprieta', 'Baja despacio hasta que las puntas toquen el suelo'],
    ['Back against a wall with the heels about 30 cm out and the back supported', 'Legs nearly straight and weight on the heels', 'Pull the toes up toward your shins as far as you can and squeeze', 'Lower slowly until the toes touch the floor'],
    ['Separar los talones del suelo', 'Doblar mucho las rodillas', 'Ir rápido sin llegar al final del recorrido'],
    ['Letting the heels leave the floor', 'Bending the knees a lot', 'Going fast without reaching the end of the range'],
  ),
  'hip abduction': f(
    ['Siéntate con la espalda apoyada y las almohadillas en la cara externa de los muslos', 'Pies apoyados y manos en las asas', 'Abre las piernas hacia fuera hasta el final del recorrido y aprieta el glúteo un instante', 'Cierra controlado sin dejar que las placas choquen'],
    ['Sit with the back supported and the pads on the outside of your thighs', 'Feet planted and hands on the handles', 'Open the legs out to the end of the range and squeeze the glute for an instant', 'Close under control without clanging the plates'],
    ['Echar el tronco atrás para abrir más', 'Cerrar de golpe soltando el peso', 'Recorrido corto por exceso de carga'],
    ['Leaning back to open further', 'Slamming closed and dropping the weight', 'Short range from too much load'],
  ),
  'hip adduction': f(
    ['Siéntate con las almohadillas en la cara interna de los muslos y las piernas abiertas', 'Espalda apoyada y manos en las asas', 'Cierra las piernas juntando las rodillas y aprieta un instante', 'Abre controlado hasta notar el estiramiento del aductor, sin pasarte'],
    ['Sit with the pads on the inside of your thighs and the legs open', 'Back supported and hands on the handles', 'Close the legs bringing the knees together and squeeze for an instant', 'Open under control to an adductor stretch, without overdoing it'],
    ['Abrir más de lo que permite tu movilidad', 'Soltar el peso y que las piernas se abran de golpe', 'Empujar con las manos en las rodillas'],
    ['Opening wider than your mobility allows', 'Letting go and having the legs fly open', 'Pushing on the knees with your hands'],
  ),
  "farmer's walk": f(
    ['Coge una mancuerna o kettlebell pesada en cada mano con las rodillas dobladas', 'Ponte de pie con el pecho alto, hombros atrás y abdomen apretado', 'Camina con pasos cortos y rápidos sin balancear las pesas', 'Deja las pesas en el suelo doblando las rodillas, no la espalda'],
    ['Pick up a heavy dumbbell or kettlebell in each hand with bent knees', 'Stand tall with chest up, shoulders back and abs braced', 'Walk with short quick steps without swinging the weights', 'Set the weights down by bending the knees, not the back'],
    ['Encorvarse hacia delante al cansarse', 'Balancear las pesas contra las piernas', 'Soltar el peso de golpe al terminar'],
    ['Hunching forward as you fatigue', 'Swinging the weights into your legs', 'Dropping the weights at the end'],
  ),
  // ══ CORE ══
  plank: f(
    ['Apoya antebrazos y puntas de los pies, codos justo bajo los hombros', 'Cuerpo en línea recta de cabeza a talones, sin cadera alta ni hundida', 'Aprieta abdomen y glúteos como si fueras a recibir un golpe, y respira', 'Mantén el tiempo marcado y baja las rodillas al suelo para terminar'],
    ['Support on forearms and toes, elbows directly under the shoulders', 'Body in a straight line from head to heels, hips neither high nor sagging', 'Brace abs and glutes as if about to take a punch, and keep breathing', 'Hold for the set time and drop the knees to finish'],
    ['Dejar caer la cadera y arquear la lumbar', 'Subir el culo para descansar', 'Aguantar la respiración todo el rato'],
    ['Letting the hips sag and arching the lower back', 'Piking the hips up to rest', 'Holding your breath the whole time'],
  ),
  'side plank': f(
    ['Túmbate de lado apoyando el antebrazo, codo justo bajo el hombro', 'Pies apilados o escalonados y cadera despegada del suelo', 'Cuerpo en línea recta vista de frente: la cadera no cae ni se va atrás', 'Aprieta el costado de abajo y mantén el tiempo; cambia de lado'],
    ['Lie on your side supported on the forearm, elbow directly under the shoulder', 'Feet stacked or staggered and hips lifted off the floor', 'Body in a straight line seen from the front: the hip neither drops nor rotates back', 'Brace the bottom side and hold; then switch sides'],
    ['Dejar caer la cadera hacia el suelo', 'Rotar el tronco hacia delante o atrás', 'Apoyar el codo por delante del hombro'],
    ['Letting the hip drop toward the floor', 'Rotating the torso forward or back', 'Placing the elbow in front of the shoulder'],
  ),
  'hollow hold': f(
    ['Túmbate boca arriba con brazos y piernas estirados', 'Pega la lumbar al suelo apretando el abdomen: esto es lo que sostiene todo', 'Sube hombros y piernas unos centímetros manteniendo la lumbar pegada', 'Aguanta respirando corto y baja cuando la lumbar empiece a despegarse'],
    ['Lie face up with arms and legs extended', 'Press the lower back into the floor by bracing the abs: this holds everything', 'Lift the shoulders and legs a few centimetres keeping the lower back down', 'Hold with short breaths and stop when the lower back starts to lift'],
    ['Despegar la lumbar y arquear la espalda', 'Empezar con brazos y piernas estirados sin tener fuerza para ello', 'Tirar del cuello con las manos'],
    ['Letting the lower back arch off the floor', 'Starting fully extended without the strength for it', 'Pulling on your neck with your hands'],
  ),
  'pallof press': f(
    ['De pie de lado a la polea a la altura del pecho, agarra el asa con las dos manos', 'Da un par de pasos para tener tensión y separa los pies a la anchura de los hombros', 'Estira los brazos al frente resistiendo el giro que provoca el cable, y aguanta', 'Vuelve al pecho controlado sin permitir que el tronco rote'],
    ['Stand side on to the pulley at chest height and grab the handle with both hands', 'Step out a couple of paces for tension and set the feet at shoulder width', 'Press the arms straight out resisting the twist the cable creates, and hold', 'Return to the chest under control without letting the torso rotate'],
    ['Dejar que el tronco gire hacia la polea', 'Usar tanto peso que es imposible aguantar la posición', 'Encoger los hombros al estirar'],
    ['Letting the torso rotate toward the pulley', 'Using so much weight the position cannot be held', 'Shrugging as you press out'],
  ),
  'cable chop (high to low)': f(
    ['Polea alta, de lado a la máquina, agarra el asa con las dos manos', 'Pies a la anchura de los hombros y rodillas algo flexionadas', 'Lleva las manos en diagonal desde el hombro alto hasta la cadera contraria, girando el tronco', 'Vuelve controlado resistiendo la subida del cable'],
    ['High pulley, standing side on, grab the handle with both hands', 'Feet at shoulder width and knees slightly bent', 'Sweep the hands diagonally from the high shoulder to the opposite hip, rotating the torso', 'Return under control resisting the cable back up'],
    ['Girar solo con los brazos sin mover el tronco', 'Redondear la espalda al bajar', 'Usar tanto peso que el movimiento se vuelve un tirón'],
    ['Rotating with the arms only without moving the torso', 'Rounding the back on the way down', 'Using so much weight the movement becomes a yank'],
  ),
  'cable lift (low to high)': f(
    ['Polea baja, de lado a la máquina, agarra el asa con las dos manos junto a la cadera', 'Rodillas algo flexionadas y abdomen apretado', 'Sube en diagonal hasta por encima del hombro contrario girando el tronco y la cadera', 'Baja controlado resistiendo la vuelta del cable'],
    ['Low pulley, standing side on, grab the handle with both hands next to your hip', 'Knees slightly bent and abs braced', 'Sweep up diagonally to above the opposite shoulder rotating torso and hips', 'Lower under control resisting the cable back down'],
    ['Arquear mucho la lumbar al subir', 'Mover solo los brazos', 'Perder el equilibrio por exceso de carga'],
    ['Over-arching the lower back on the way up', 'Moving only the arms', 'Losing balance from too much load'],
  ),
  'cable rotation': f(
    ['De pie de lado a la polea a la altura del pecho, brazos casi estirados al frente', 'Pies fijos y abdomen apretado; el giro sale del tronco, no de los brazos', 'Gira el tronco alejándote de la polea y aprieta el oblicuo al final', 'Vuelve controlado dejando que el cable te devuelva sin arrastrarte'],
    ['Standing side on to the pulley at chest height, arms nearly straight in front', 'Feet planted and abs braced; the rotation comes from the torso, not the arms', 'Rotate the torso away from the pulley and squeeze the oblique at the end', 'Return under control letting the cable bring you back without yanking'],
    ['Girar solo los brazos', 'Mover los pies para ganar rango', 'Rotar la columna lumbar en vez de la torácica'],
    ['Rotating only the arms', 'Moving the feet to gain range', 'Rotating the lower spine instead of the upper back'],
  ),
  'suitcase carry': f(
    ['Coge una pesa con UNA sola mano, como si fuera una maleta', 'Ponte de pie con el pecho alto y los hombros nivelados', 'Camina en línea recta sin inclinarte hacia el lado cargado ni hacia el contrario', 'Cambia de mano y repite la misma distancia'],
    ['Pick up a weight with ONE hand, like a suitcase', 'Stand tall with your chest up and shoulders level', 'Walk in a straight line without leaning toward the loaded side or away from it', 'Switch hands and repeat the same distance'],
    ['Inclinarse hacia el lado del peso', 'Encoger el hombro cargado', 'Hacer distinta distancia con cada mano'],
    ['Leaning toward the loaded side', 'Shrugging the loaded shoulder', 'Doing different distances on each hand'],
  ),
  'neck isometric hold': f(
    ['Coloca la palma de la mano en un lado de la cabeza, sentado o de pie', 'Empuja la cabeza contra la mano SIN que la cabeza se mueva', 'Aguanta la tensión el tiempo marcado, respirando con normalidad', 'Repite en los cuatro sentidos: frente, nuca y ambos lados'],
    ['Place your palm on one side of your head, seated or standing', 'Push the head into the hand WITHOUT the head moving', 'Hold the tension for the set time, breathing normally', 'Repeat in all four directions: front, back and both sides'],
    ['Dejar que la cabeza se mueva y forzar el rango del cuello', 'Empujar con toda la fuerza de golpe', 'Aguantar la respiración'],
    ['Letting the head move and forcing the neck range', 'Pushing at maximum force immediately', 'Holding your breath'],
  ),
  'leg raise': f(
    ['Túmbate boca arriba con las manos bajo los glúteos o a los lados', 'Pega la lumbar al suelo apretando el abdomen antes de empezar', 'Sube las piernas casi estiradas hasta la vertical sin despegar la lumbar', 'Baja despacio y para cuando la lumbar empiece a arquearse'],
    ['Lie face up with your hands under your glutes or at your sides', 'Press the lower back into the floor by bracing the abs before starting', 'Raise the near-straight legs to vertical without the lower back lifting', 'Lower slowly and stop when the lower back starts to arch'],
    ['Arquear la lumbar al bajar las piernas', 'Bajar hasta el suelo sin control', 'Coger impulso con las caderas'],
    ['Arching the lower back as the legs come down', 'Dropping to the floor without control', 'Using hip momentum'],
  ),
  'hanging knee raise': f(
    ['Cuélgate de la barra con los brazos estirados y los hombros activos', 'Evita balancearte: empieza el movimiento desde quieto', 'Sube las rodillas hacia el pecho enrollando la pelvis, no solo doblando la cadera', 'Baja controlado hasta estirar las piernas sin coger impulso'],
    ['Hang from the bar with straight arms and active shoulders', 'Avoid swinging: start the movement from a dead stop', 'Raise the knees toward your chest curling the pelvis, not just bending the hips', 'Lower under control to straight legs without gaining momentum'],
    ['Balancearse como un péndulo', 'Subir solo las rodillas sin enrollar la pelvis', 'Bajar de golpe y rebotar'],
    ['Swinging like a pendulum', 'Raising only the knees without curling the pelvis', 'Dropping down and bouncing'],
  ),
  'hanging leg raise': f(
    ['Cuélgate de la barra con los brazos estirados y el cuerpo quieto', 'Aprieta el abdomen antes de empezar para no balancearte', 'Sube las piernas estiradas hasta la horizontal o más, enrollando la pelvis al final', 'Baja MUY despacio hasta la vertical sin dejarte caer'],
    ['Hang from the bar with straight arms and a still body', 'Brace the abs before starting so you do not swing', 'Raise straight legs to horizontal or higher, curling the pelvis at the top', 'Lower VERY slowly to vertical without dropping'],
    ['Usar impulso del balanceo', 'Doblar las rodillas y convertirlo en la versión fácil', 'Bajar en caída libre'],
    ['Using swing momentum', 'Bending the knees and turning it into the easier version', 'Free-falling on the way down'],
  ),
  crunch: f(
    ['Túmbate boca arriba con las rodillas dobladas y los pies apoyados', 'Manos en el pecho o junto a las sienes, SIN tirar del cuello', 'Enrolla la columna despegando los omóplatos y aprieta el abdomen arriba', 'Baja despacio hasta apoyar sin descansar del todo'],
    ['Lie face up with knees bent and feet flat', 'Hands on your chest or beside your temples, WITHOUT pulling the neck', 'Curl the spine lifting the shoulder blades and squeeze the abs at the top', 'Lower slowly to the floor without fully resting'],
    ['Tirar de la cabeza con las manos', 'Subir con el tronco recto como una plancha', 'Ir rápido sin apretar arriba'],
    ['Pulling the head with your hands', 'Coming up with a flat torso like a board', 'Going fast without squeezing at the top'],
  ),
  'cable crunch': f(
    ['De rodillas frente a la polea alta con la cuerda a los lados de la cabeza', 'Cadera fija: no se mueve en todo el ejercicio', 'Enrolla la columna llevando los codos hacia los muslos y aprieta el abdomen', 'Vuelve controlado desenrollando vértebra a vértebra'],
    ['Kneel facing the high pulley with the rope beside your head', 'Hips fixed: they do not move at any point', 'Curl the spine bringing the elbows toward your thighs and squeeze the abs', 'Return under control unrolling vertebra by vertebra'],
    ['Mover la cadera y convertirlo en un movimiento de brazos', 'Tirar con los brazos en vez de enrollar el tronco', 'Recorrido corto por exceso de peso'],
    ['Moving the hips and turning it into an arm movement', 'Pulling with the arms instead of curling the torso', 'Short range from too much weight'],
  ),
  'machine crunch': f(
    ['Siéntate y ajusta el asiento para que el eje quede a la altura del ombligo', 'Agarra las asas o apoya el pecho en la almohadilla', 'Enrolla el tronco hacia delante apretando el abdomen y mantén un instante', 'Vuelve controlado sin dejar que las placas choquen'],
    ['Sit and set the seat so the pivot is at navel height', 'Grab the handles or rest your chest on the pad', 'Curl the torso forward squeezing the abs and hold for an instant', 'Return under control without clanging the plates'],
    ['Tirar con los brazos en vez del abdomen', 'Asiento mal ajustado', 'Recorrido mínimo con mucho peso'],
    ['Pulling with the arms instead of the abs', 'Wrong seat height', 'Minimal range with heavy load'],
  ),
  'ab wheel': f(
    ['De rodillas con la rueda en el suelo bajo los hombros', 'Aprieta abdomen y glúteos y mete la pelvis: la lumbar NO se arquea', 'Rueda hacia delante todo lo que puedas manteniendo la línea del cuerpo', 'Vuelve tirando con el abdomen, no con los brazos'],
    ['Kneel with the wheel on the floor under your shoulders', 'Brace abs and glutes and tuck the pelvis: the lower back does NOT arch', 'Roll forward as far as you can keeping the body line', 'Return pulling with the abs, not the arms'],
    ['Arquear la lumbar al extenderse', 'Ir más lejos de lo que puedes volver', 'Empezar de pie sin dominar la versión de rodillas'],
    ['Arching the lower back on the way out', 'Rolling further than you can return from', 'Starting standing without owning the kneeling version'],
  ),
  'russian twist': f(
    ['Sentado con las rodillas dobladas y el tronco inclinado hacia atrás unos 45 grados', 'Pies en el suelo o levantados si puedes mantener la espalda recta', 'Gira el tronco de lado a lado llevando las manos junto a la cadera', 'Controla el giro: la velocidad no aporta nada aquí'],
    ['Seated with knees bent and torso leaning back about 45 degrees', 'Feet on the floor or lifted if you can keep a straight back', 'Rotate the torso side to side bringing the hands beside your hip', 'Control the rotation: speed adds nothing here'],
    ['Redondear la espalda y girar solo los brazos', 'Ir muy rápido sin control', 'Tocar el suelo golpeando el peso'],
    ['Rounding the back and rotating only the arms', 'Going very fast without control', 'Slamming the weight into the floor'],
  ),
  'mountain climbers': f(
    ['Posición de flexión con las manos bajo los hombros y el cuerpo en línea', 'Aprieta abdomen y glúteos para que la cadera no suba ni caiga', 'Lleva una rodilla al pecho y cámbiala por la otra, alternando rápido', 'Mantén el ritmo sin que los hombros se desplacen hacia atrás'],
    ['Push-up position with hands under the shoulders and the body in line', 'Brace abs and glutes so the hips neither rise nor sag', 'Drive one knee to the chest and switch for the other, alternating quickly', 'Keep the rhythm without the shoulders drifting back'],
    ['Subir el culo con cada repetición', 'Apoyar mal las manos y cargar la muñeca', 'Ir tan rápido que se pierde la línea del cuerpo'],
    ['Piking the hips on every rep', 'Poor hand placement that loads the wrist', 'Going so fast the body line disappears'],
  ),

  // ══ POTENCIA ══
  'power clean': f(
    ['Barra sobre el medio del pie, agarre algo más ancho que los hombros, cadera media', 'Despega la barra pegada a las piernas manteniendo la espalda neutra', 'Al pasar las rodillas, extiende cadera, rodillas y tobillos con fuerza y encoge los hombros', 'Métete debajo girando los codos hacia delante y recibe la barra en los hombros con rodillas dobladas'],
    ['Bar over mid foot, grip slightly wider than shoulders, hips mid height', 'Break the bar off the floor close to the legs with a neutral spine', 'As it passes the knees, extend hips, knees and ankles explosively and shrug', 'Pull under whipping the elbows through and catch the bar on the shoulders with bent knees'],
    ['Tirar con los brazos antes de extender la cadera', 'Separar la barra del cuerpo', 'Recibir con las piernas rectas y golpear las clavículas'],
    ['Pulling with the arms before extending the hips', 'Letting the bar swing away from the body', 'Catching with straight legs and slamming the collarbones'],
  ),
  'push press': f(
    ['Barra en los hombros con los codos algo por delante y los pies bajo la cadera', 'Haz una flexión CORTA de rodillas, sin doblar la cadera hacia atrás', 'Extiende las piernas con fuerza y usa ese impulso para lanzar la barra arriba', 'Bloquea los brazos sobre la cabeza con la barra sobre la mitad del pie'],
    ['Bar on the shoulders with elbows slightly forward and feet under the hips', 'Make a SHORT dip with the knees, without hinging the hips back', 'Extend the legs explosively and use that drive to launch the bar overhead', 'Lock the arms overhead with the bar over mid foot'],
    ['Hacer una flexión demasiado profunda y convertirlo en sentadilla', 'Inclinarse hacia delante en la flexión', 'Empujar la barra hacia delante en vez de recta arriba'],
    ['Dipping too deep and turning it into a squat', 'Leaning forward during the dip', 'Pressing the bar forward instead of straight up'],
  ),
  'clean pull': f(
    ['Misma salida que la cargada: barra sobre el medio del pie y espalda neutra', 'Despega controlado manteniendo el ángulo del tronco hasta las rodillas', 'Extiende cadera, rodillas y tobillos con violencia y encoge los hombros', 'NO te metes debajo: solo tiras y bajas la barra controlada'],
    ['Same setup as the clean: bar over mid foot and neutral spine', 'Break the floor under control keeping the torso angle to the knees', 'Extend hips, knees and ankles violently and shrug', 'Do NOT pull under: you only pull and lower the bar under control'],
    ['Doblar los codos y remar la barra', 'Perder la espalda neutra por exceso de peso', 'Extender solo las rodillas sin la cadera'],
    ['Bending the elbows and rowing the bar', 'Losing the neutral spine from too much weight', 'Extending only the knees without the hips'],
  ),
  'kettlebell swing': f(
    ['Kettlebell en el suelo a un palmo por delante, pies algo más abiertos que la cadera', 'Bisagra de cadera con espalda neutra y engancha la pesa hacia atrás entre las piernas', 'Extiende la cadera con fuerza y aprieta los glúteos: la pesa sale disparada, no la levantas con los brazos', 'Deja que vuelva entre las piernas haciendo bisagra otra vez'],
    ['Kettlebell on the floor a hand-span in front, feet slightly wider than the hips', 'Hinge at the hips with a neutral spine and hike the bell back between your legs', 'Snap the hips forward and squeeze the glutes: the bell flies, you do not lift it with the arms', 'Let it swing back between the legs by hinging again'],
    ['Hacer sentadilla en vez de bisagra de cadera', 'Levantar la pesa con los brazos', 'Arquear la lumbar arriba en vez de apretar el glúteo'],
    ['Squatting instead of hinging', 'Lifting the bell with the arms', 'Arching the lower back at the top instead of squeezing the glute'],
  ),
  'box jump': f(
    ['Colócate a un paso del cajón con los pies a la anchura de la cadera', 'Flexiona rodillas y cadera y lanza los brazos atrás', 'Salta extendiendo todo el cuerpo y aterriza con los DOS pies a la vez, amortiguando', 'Baja del cajón caminando, nunca saltando'],
    ['Stand a step from the box with feet at hip width', 'Bend knees and hips and swing the arms back', 'Jump extending the whole body and land with BOTH feet at once, absorbing softly', 'Step down off the box, never jump down'],
    ['Bajar saltando y castigar el tendón de Aquiles', 'Elegir un cajón tan alto que hay que encoger mucho las rodillas', 'Aterrizar con las piernas rígidas'],
    ['Jumping down and punishing the Achilles tendon', 'Choosing a box so high you have to tuck the knees hard', 'Landing with stiff legs'],
  ),
  'jump squat': f(
    ['De pie con los pies a la anchura de los hombros y el abdomen apretado', 'Baja a media sentadilla, no completa', 'Salta con toda la fuerza extendiendo cadera, rodillas y tobillos', 'Aterriza suave sobre el medio del pie y encadena la siguiente'],
    ['Standing with feet at shoulder width and abs braced', 'Descend to a half squat, not a full one', 'Jump with everything, extending hips, knees and ankles', 'Land softly on mid foot and chain into the next rep'],
    ['Aterrizar con las piernas rígidas', 'Bajar hasta abajo del todo y perder la velocidad', 'Meter las rodillas hacia dentro al aterrizar'],
    ['Landing with stiff legs', 'Going all the way down and losing the speed', 'Letting the knees cave in on landing'],
  ),
  'jumping lunge': f(
    ['Empieza en posición de zancada con la rodilla trasera cerca del suelo', 'Aprieta el abdomen y mantén el tronco erguido', 'Salta cambiando de pierna en el aire y aterriza en zancada con la otra delante', 'Amortigua el aterrizaje bajando de nuevo, sin frenar en seco'],
    ['Start in a lunge with the back knee close to the floor', 'Brace your abs and keep the torso tall', 'Jump switching legs in the air and land in a lunge with the other leg forward', 'Absorb the landing by sinking again, without stopping abruptly'],
    ['Aterrizar con la rodilla rígida', 'Inclinar el tronco hacia delante', 'Dar pasos cortos que descolocan la rodilla'],
    ['Landing with a stiff knee', 'Leaning the torso forward', 'Short steps that misalign the knee'],
  ),
  'lateral bound': f(
    ['De pie sobre una pierna con la rodilla algo flexionada', 'Carga el peso en esa pierna y salta lateralmente hacia el otro lado', 'Aterriza sobre la pierna contraria absorbiendo con cadera y rodilla', 'Estabiliza un instante antes del siguiente salto'],
    ['Standing on one leg with the knee slightly bent', 'Load that leg and bound laterally to the other side', 'Land on the opposite leg absorbing with hip and knee', 'Stabilise for an instant before the next bound'],
    ['Aterrizar con la rodilla hacia dentro', 'Encadenar saltos sin estabilizar', 'Saltar más lejos de lo que puedes frenar'],
    ['Landing with the knee caving in', 'Chaining bounds without stabilising', 'Jumping further than you can decelerate'],
  ),
  'broad jump': f(
    ['De pie con los pies a la anchura de la cadera y espacio libre delante', 'Flexiona rodillas y cadera lanzando los brazos hacia atrás', 'Salta hacia delante extendiendo todo el cuerpo y lanzando los brazos al frente', 'Aterriza con los dos pies amortiguando con rodillas y cadera'],
    ['Standing with feet at hip width and clear space in front', 'Bend knees and hips swinging the arms back', 'Jump forward extending the whole body and throwing the arms ahead', 'Land on both feet absorbing with knees and hips'],
    ['Aterrizar rígido sin flexionar', 'No usar los brazos', 'Saltar sin comprobar que hay espacio'],
    ['Landing stiff without bending', 'Not using the arms', 'Jumping without checking you have space'],
  ),
  'medicine ball slam': f(
    ['De pie con el balón sujeto con las dos manos y los pies a la anchura de los hombros', 'Sube el balón por encima de la cabeza extendiendo el cuerpo', 'Lánzalo contra el suelo con toda la fuerza doblando la cadera y el tronco', 'Recógelo doblando las rodillas, no la espalda, y repite'],
    ['Standing with the ball in both hands and feet at shoulder width', 'Raise the ball overhead extending the body', 'Slam it into the floor as hard as you can folding at the hips and torso', 'Pick it up bending the knees, not the back, and repeat'],
    ['Recoger el balón redondeando la espalda', 'Usar un balón que rebota y te golpea', 'Lanzar solo con los brazos sin usar el tronco'],
    ['Picking the ball up with a rounded back', 'Using a bouncy ball that rebounds into you', 'Throwing with the arms only without the torso'],
  ),
  'medicine ball throw': f(
    ['De pie frente a una pared sólida con el balón a la altura del pecho', 'Pies a la anchura de los hombros y abdomen apretado', 'Lanza el balón contra la pared extendiendo los brazos con fuerza', 'Recíbelo amortiguando con los brazos y encadena el siguiente lanzamiento'],
    ['Standing facing a solid wall with the ball at chest height', 'Feet at shoulder width and abs braced', 'Throw the ball at the wall extending the arms explosively', 'Catch it absorbing with the arms and chain the next throw'],
    ['Lanzar contra una pared que no aguanta el impacto', 'Recibir con los brazos rígidos', 'Colocarse tan cerca que no da tiempo a reaccionar'],
    ['Throwing at a wall that cannot take the impact', 'Catching with stiff arms', 'Standing so close there is no time to react'],
  ),
  'rotational med ball throw': f(
    ['De lado a la pared con el balón sujeto a la altura de la cadera', 'Pies a la anchura de los hombros y rodillas algo flexionadas', 'Gira la cadera y el tronco hacia la pared y lanza el balón con esa rotación', 'Recoge y repite; cambia de lado para trabajar los dos'],
    ['Side on to the wall with the ball held at hip height', 'Feet at shoulder width and knees slightly bent', 'Rotate hips and torso toward the wall and release the ball with that rotation', 'Collect and repeat; switch sides to work both'],
    ['Lanzar solo con los brazos sin girar la cadera', 'Mantener los pies clavados y forzar la lumbar', 'Hacer más repeticiones de un lado que del otro'],
    ['Throwing with the arms only without hip rotation', 'Keeping the feet nailed down and straining the lower back', 'Doing more reps on one side than the other'],
  ),
  'sled push': f(
    ['Agarra el trineo por las asas altas o bajas con los brazos estirados', 'Inclina el cuerpo hacia delante en línea recta desde los tobillos', 'Empuja con pasos cortos y potentes manteniendo el abdomen apretado', 'Recorre la distancia marcada sin parar y da la vuelta'],
    ['Grab the sled by the high or low handles with straight arms', 'Lean the body forward in a straight line from the ankles', 'Drive with short powerful steps keeping the abs braced', 'Cover the set distance without stopping and turn around'],
    ['Encorvar la espalda en vez de inclinar todo el cuerpo', 'Dar pasos largos y perder empuje', 'Cargar tanto que apenas se mueve'],
    ['Rounding the back instead of leaning the whole body', 'Taking long steps and losing drive', 'Loading so heavy it barely moves'],
  ),
  'sled pull': f(
    ['Sujeta el arnés o las cuerdas con los brazos estirados y el trineo detrás', 'Inclínate hacia atrás ligeramente con el abdomen apretado', 'Camina hacia atrás o hacia delante con pasos firmes tirando del trineo', 'Completa la distancia manteniendo la tensión constante'],
    ['Hold the harness or straps with straight arms and the sled behind', 'Lean back slightly with the abs braced', 'Walk backward or forward with firm steps dragging the sled', 'Cover the distance keeping constant tension'],
    ['Tirar a tirones en vez de mantener la tensión', 'Redondear la espalda', 'Mirar atrás girando el cuello constantemente'],
    ['Yanking instead of keeping constant tension', 'Rounding the back', 'Constantly twisting the neck to look back'],
  ),

  // ══ FULL BODY ══
  thruster: f(
    ['Barra en la parte delantera de los hombros con los codos altos, pies a la anchura de los hombros', 'Haz una sentadilla completa manteniendo los codos arriba y el tronco vertical', 'Al subir, aprovecha el impulso de las piernas para lanzar la barra sobre la cabeza', 'Bloquea arriba y baja la barra a los hombros para encadenar la siguiente'],
    ['Bar on the front of the shoulders with high elbows, feet at shoulder width', 'Perform a full squat keeping the elbows up and the torso vertical', 'On the way up, use the leg drive to launch the bar overhead', 'Lock out at the top and bring the bar back to the shoulders for the next rep'],
    ['Separar la sentadilla del press en dos movimientos', 'Dejar caer los codos en la bajada', 'Empujar la barra hacia delante'],
    ['Splitting the squat and the press into two movements', 'Dropping the elbows on the way down', 'Pressing the bar forward'],
  ),
  burpee: f(
    ['De pie, baja las manos al suelo y lleva los pies atrás de un salto', 'Haz una flexión completa con el cuerpo en línea, sin dejar caer la cadera', 'Vuelve los pies bajo el pecho de un salto', 'Salta hacia arriba con los brazos extendidos y aterriza suave'],
    ['Standing, place the hands on the floor and jump the feet back', 'Do a full push-up with the body in line, without letting the hips sag', 'Jump the feet back under your chest', 'Jump up with the arms overhead and land softly'],
    ['Dejar caer la cadera en la flexión', 'Saltar sin extender del todo arriba', 'Aterrizar con las rodillas rígidas'],
    ['Letting the hips sag in the push-up', 'Jumping without fully extending at the top', 'Landing with stiff knees'],
  ),
  'clean and press': f(
    ['Barra en el suelo sobre el medio del pie con agarre algo más ancho que los hombros', 'Haz la cargada: extiende la cadera con fuerza y recibe la barra en los hombros', 'Estabiliza de pie con los codos altos y el abdomen apretado', 'Empuja la barra sobre la cabeza hasta bloquear los brazos y bájala controlada'],
    ['Bar on the floor over mid foot with a grip slightly wider than the shoulders', 'Perform the clean: extend the hips explosively and catch the bar on the shoulders', 'Stabilise standing with high elbows and abs braced', 'Press the bar overhead to a full lockout and lower it under control'],
    ['Encadenar cargada y press sin estabilizar en medio', 'Arquear mucho la lumbar en el press', 'Bajar la barra de golpe al suelo'],
    ['Chaining clean and press without stabilising in between', 'Over-arching the lower back on the press', 'Dropping the bar to the floor'],
  ),
  snatch: f(
    ['Agarre MUY ancho en la barra, sobre el medio del pie y espalda neutra', 'Despega controlado manteniendo el ángulo del tronco hasta pasar las rodillas', 'Extiende cadera, rodillas y tobillos con violencia y tira de la barra pegada al cuerpo', 'Métete debajo y recibe la barra bloqueada sobre la cabeza en sentadilla'],
    ['Take a VERY wide grip, bar over mid foot and neutral spine', 'Break the floor under control keeping the torso angle until past the knees', 'Extend hips, knees and ankles violently and pull the bar close to the body', 'Pull under and catch the bar locked out overhead in a squat'],
    ['Intentarlo sin haber trabajado antes la movilidad de hombro', 'Tirar con los brazos antes de extender la cadera', 'Recibir con los codos flexionados'],
    ['Attempting it without first building shoulder mobility', 'Pulling with the arms before extending the hips', 'Catching with bent elbows'],
  ),
  'man maker': f(
    ['Empieza de pie con una mancuerna en cada mano', 'Baja a plancha con las manos en las mancuernas y haz una flexión', 'Rema una mancuerna y luego la otra manteniendo la cadera estable', 'Salta los pies adelante, ponte de pie y termina con un press sobre la cabeza'],
    ['Start standing with a dumbbell in each hand', 'Drop into a plank with your hands on the dumbbells and do a push-up', 'Row one dumbbell and then the other keeping the hips stable', 'Jump the feet forward, stand up and finish with an overhead press'],
    ['Rotar mucho la cadera en el remo', 'Saltarse la flexión al cansarse', 'Usar mancuernas redondas que ruedan en la plancha'],
    ['Rotating the hips a lot during the row', 'Skipping the push-up as you fatigue', 'Using round dumbbells that roll in the plank'],
  ),
  'wall ball': f(
    ['Sujeta el balón a la altura del pecho frente a una pared con una marca alta', 'Haz una sentadilla completa manteniendo el balón pegado al pecho', 'Al subir, lanza el balón a la marca extendiendo todo el cuerpo', 'Recíbelo amortiguando y baja directo a la siguiente sentadilla'],
    ['Hold the ball at chest height facing a wall with a high target', 'Squat all the way down keeping the ball against your chest', 'On the way up, throw the ball at the target extending the whole body', 'Catch it absorbing and drop straight into the next squat'],
    ['Lanzar solo con los brazos sin usar las piernas', 'Recibir con los brazos rígidos', 'Sentadilla a medias por cansancio'],
    ['Throwing with the arms only without using the legs', 'Catching with stiff arms', 'Cutting the squat short from fatigue'],
  ),
  'turkish get-up': f(
    ['Túmbate boca arriba con la pesa en una mano y el brazo estirado hacia el techo', 'Dobla la rodilla del mismo lado y apóyate en el codo contrario, luego en la mano', 'Sube la cadera, pasa la pierna estirada por debajo y ponte de rodillas', 'Levántate del todo y deshaz el camino paso a paso sin bajar el brazo'],
    ['Lie face up with the weight in one hand and the arm straight toward the ceiling', 'Bend the knee on the same side and prop onto the opposite elbow, then the hand', 'Lift the hips, sweep the straight leg underneath and come to kneeling', 'Stand all the way up and reverse the sequence step by step without dropping the arm'],
    ['Perder la vertical del brazo en algún paso', 'Ir rápido y saltarse posiciones', 'Empezar con peso antes de dominar el patrón sin carga'],
    ['Losing the vertical arm at some step', 'Rushing and skipping positions', 'Starting loaded before owning the pattern unweighted'],
  ),
  'devil press': f(
    ['De pie con una mancuerna en cada mano', 'Baja a plancha sobre las mancuernas y haz una flexión', 'Salta los pies adelante y sube las dos mancuernas en un solo movimiento hasta la cabeza', 'Baja controlado y encadena la siguiente repetición'],
    ['Standing with a dumbbell in each hand', 'Drop into a plank on the dumbbells and do a push-up', 'Jump the feet forward and swing both dumbbells overhead in one movement', 'Lower under control and chain the next rep'],
    ['Redondear la espalda al subir las mancuernas', 'Saltarse la flexión', 'Usar demasiado peso y perder la técnica en el swing'],
    ['Rounding the back as the dumbbells come up', 'Skipping the push-up', 'Using too much weight and losing the swing technique'],
  ),
  'renegade row': f(
    ['Posición de plancha con las manos sobre dos mancuernas, pies algo separados', 'Aprieta abdomen y glúteos: la cadera NO debe girar', 'Rema una mancuerna hacia la cadera manteniendo el cuerpo inmóvil', 'Bájala controlada y repite con el otro brazo, alternando'],
    ['Plank position with your hands on two dumbbells, feet slightly apart', 'Brace abs and glutes: the hips must NOT rotate', 'Row one dumbbell to your hip keeping the body completely still', 'Lower it under control and repeat on the other arm, alternating'],
    ['Girar la cadera con cada remo', 'Pies demasiado juntos y perder estabilidad', 'Mancuernas redondas que ruedan bajo la mano'],
    ['Rotating the hips on every row', 'Feet too close together and losing stability', 'Round dumbbells that roll under the hand'],
  ),
};

// ── Resolución de nombres ──

const normKey = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

/**
 * Índice inverso: cualquier nombre (es, en o alias antiguo) → ficha de la
 * biblioteca. Se guarda la ENTRADA de la biblioteca, no solo la clave, para
 * poder sacar de ella los músculos secundarios y el material sin repetirlos
 * en el diccionario de fichas.
 */
const ALIAS_TO_EX: Map<string, import('./exercises').LibExercise> = (() => {
  const m = new Map<string, import('./exercises').LibExercise>();
  EXERCISE_LIBRARY.forEach((e) => {
    m.set(normKey(e.es), e);
    m.set(normKey(e.en), e);
    (e.aliases || []).forEach((a) => { if (!m.has(normKey(a))) m.set(normKey(a), e); });
  });
  return m;
})();

export interface Technique {
  /** Claves de músculo secundario; se traducen con `mc_str_mg_<clave>`. */
  secondary: MuscleGroup[];
  /** Clave de material; se traduce con `mc_eq_<clave>`. null si no consta. */
  equipment: Equipment | null;
  /** Postura, movimiento, contracción y control. Una línea cada uno. */
  technique: string[];
  /** Errores típicos. */
  mistakes: string[];
}

/**
 * Ficha completa del ejercicio en el idioma pedido.
 *
 * Devuelve null solo si el nombre no está en la biblioteca (ejercicio libre
 * escrito por el usuario). Si está en la biblioteca pero aún no tiene texto de
 * técnica, devuelve la ficha con `technique` y `mistakes` vacíos: los chips de
 * músculo y material siguen siendo útiles y la tarjeta los pinta igual.
 */
export function techniqueFor(nameOrKey: string, lang: Lang): Technique | null {
  const ex = ALIAS_TO_EX.get(normKey(nameOrKey));
  if (!ex) return null;
  const raw = FICHAS[ex.en.toLowerCase()];
  const pick = (b: Bilingual) => (lang === 'en' ? b.en : b.es);
  return {
    secondary: ex.secondary || [],
    equipment: ex.equipment ?? null,
    technique: raw ? raw.technique.map(pick) : [],
    mistakes: raw ? raw.mistakes.map(pick) : [],
  };
}

/** ¿Este ejercicio tiene explicación escrita? (para saber si ofrecer el icono). */
export function hasTechnique(nameOrKey: string): boolean {
  const ex = ALIAS_TO_EX.get(normKey(nameOrKey));
  return !!ex && !!FICHAS[ex.en.toLowerCase()];
}

/**
 * Cuántos ejercicios de la biblioteca tienen texto de técnica. Lo usa el script
 * `npm run check:tech` para que la cobertura no baje sin que nadie se entere.
 */
export function techniqueCoverage(): { total: number; withText: number; missing: string[] } {
  const missing = EXERCISE_LIBRARY.filter((e) => !FICHAS[e.en.toLowerCase()]).map((e) => e.en);
  return { total: EXERCISE_LIBRARY.length, withText: EXERCISE_LIBRARY.length - missing.length, missing };
}

/** Comprueba que las listas es/en de cada ficha tienen la misma longitud. */
export function techniqueMismatches(): string[] {
  const bad: string[] = [];
  Object.entries(FICHAS).forEach(([k, v]) => {
    if (v.technique.some((b) => !b.en || !b.es)) bad.push(`${k}: técnica sin par es/en`);
    if (v.mistakes.some((b) => !b.en || !b.es)) bad.push(`${k}: errores sin par es/en`);
  });
  return bad;
}
