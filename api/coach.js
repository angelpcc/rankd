// IA especializada de Mi Esquina (Entrenamiento · Nutrición · Material).
// Modos:
//   GET                  → sonda de disponibilidad (NO gasta API)
//   POST                 → respuesta en streaming (SSE), token a token
//   POST { extract:true }→ convierte el plan de la conversación en JSON
//                          estructurado para guardarlo en el diario
// La clave de Anthropic vive SOLO en el servidor.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 60 };

// ── Qué modelo atiende las 11 llamadas de la app ──
//
// Estaba puesto 'claude-opus-4-8', que NO EXISTE: habría fallado cada llamada
// con un error de modelo desconocido, y con la clave recién pagada el dedo
// habría apuntado a cualquier otro sitio menos aquí.
//
// Se puede cambiar sin tocar código con ANTHROPIC_MODEL, porque la elección es
// de coste y no de programación:
//   · claude-sonnet-5  — el que conviene para esto. Planes, rutinas y consejo
//                        de entreno le sobran, y cuesta una fracción de Opus.
//   · claude-opus-5    — solo si notas que se queda corto razonando.
//   · claude-haiku-4-5-20251001 — el más barato y rápido, para mucho volumen.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

// Tarifa vigente del modelo, en USD por millón de tokens.
const PRICE_IN_PER_M = 5;
const PRICE_OUT_PER_M = 25;
// Búsqueda web del asesor de Material: $10 por cada 1.000 búsquedas.
const PRICE_SEARCH = 0.01;
// Tope de búsquedas por respuesta: acota el coste de un solo turno aunque el
// usuario tenga muchas disponibles en el mes.
const SEARCHES_PER_TURN = 3;

function costOf(usage) {
  const inTok = usage?.input_tokens || 0;
  const outTok = usage?.output_tokens || 0;
  const searches = usage?.server_tool_use?.web_search_requests || 0;
  return +(((inTok * PRICE_IN_PER_M) + (outTok * PRICE_OUT_PER_M)) / 1_000_000 + searches * PRICE_SEARCH).toFixed(5);
}

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Identifica al usuario y comprueba su cuota del mes.
 *
 * FALLA CERRADO a propósito: si no se puede identificar o no se puede
 * comprobar el límite, NO se llama al modelo. Es la garantía de que nadie
 * consume API sin quedar contabilizado.
 */
async function checkQuota(req) {
  const db = admin();
  if (!db) {
    return { ok: false, status: 503, code: 'limits_not_configured',
      message: 'El control de gasto de la IA no está configurado en el servidor. Falta SUPABASE_SERVICE_ROLE_KEY.' };
  }
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    return { ok: false, status: 401, code: 'no_session', message: 'Necesitas iniciar sesión para usar la IA.' };
  }
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) {
    return { ok: false, status: 401, code: 'no_session', message: 'Tu sesión ha caducado. Vuelve a entrar.' };
  }

  const { data, error } = await db.rpc('rk_ai_quota', { p_user: user.id });
  if (error) {
    return { ok: false, status: 503, code: 'limits_not_configured',
      message: 'El control de gasto de la IA todavía no está activo. Aplica la migración 0012.' };
  }
  const row = Array.isArray(data) ? data[0] : data;
  const used = row?.used ?? 0;
  const quota = row?.quota ?? 0;
  const enabled = row?.enabled !== false;

  if (enabled && used >= quota) {
    return { ok: false, status: 429, code: 'quota_reached', used, quota,
      message: 'Has agotado tus consultas de IA de este mes. Se renuevan el día 1. Si necesitas más, escríbenos y te ampliamos la cuota.' };
  }
  return {
    ok: true, db, user, used, quota, warnAtPct: row?.warn_at_pct ?? 80,
    // Sub-tope de búsqueda web (solo Material). undefined si la migración 0015
    // no está aplicada → el servidor no activa la herramienta (falla cerrado).
    searchesUsed: row?.searches_used, searchesQuota: row?.searches_quota,
  };
}

/** Deja constancia del consumo real. Nunca debe tumbar la respuesta al usuario. */
async function recordUsage(db, userId, section, kind, usage, searches) {
  try {
    const row = {
      user_id: userId,
      period: currentPeriod(),
      section: String(section || 'training'),
      kind,
      input_tokens: usage?.input_tokens || 0,
      output_tokens: usage?.output_tokens || 0,
      cost_usd: costOf(usage),
    };
    // Solo se envía la columna 'searches' cuando la búsqueda estaba activa. Así,
    // si la migración 0015 no está, nunca se intenta escribir una columna que no
    // existe y el registro del chat (que sí importa para la cuota) no se pierde.
    if (typeof searches === 'number') row.searches = searches;
    await db.from('ai_usage').insert(row);
  } catch { /* el usuario ya tiene su respuesta */ }
}

// ── Contexto físico común a las tres IAs ──
function fighterContext(p = {}) {
  const lines = [];
  if (p.name) lines.push(`- Nombre: ${p.name}`);
  if (p.discipline) lines.push(`- Disciplina: ${p.discipline}`);
  if (p.level) lines.push(`- Nivel: ${p.level}`);
  if (p.weightClass) lines.push(`- Categoría de peso: ${p.weightClass}`);
  if (p.age) lines.push(`- Edad: ${p.age}`);
  if (p.sex) lines.push(`- Sexo: ${p.sex}`);
  if (p.heightCm) lines.push(`- Altura: ${p.heightCm} cm`);
  if (p.currentWeight) lines.push(`- Peso actual: ${p.currentWeight} kg`);
  if (p.targetWeight) lines.push(`- Peso objetivo: ${p.targetWeight} kg`);
  if (p.record) lines.push(`- Récord: ${p.record}`);
  if (p.goal) lines.push(`- Objetivo declarado: ${p.goal}`);
  if (p.trainingDaysPerWeek) lines.push(`- Días entrenables/semana: ${p.trainingDaysPerWeek}`);
  if (p.sessionMinutes) lines.push(`- Minutos por sesión: ${p.sessionMinutes} min`);
  if (p.equipmentAccess) lines.push(`- Material disponible: ${p.equipmentAccess}`);
  if (p.injuries) lines.push(`- Lesiones o notas: ${String(p.injuries).slice(0, 300)}`);
  if (p.weeklyMinutes) lines.push(`- Volumen de entreno esta semana: ${p.weeklyMinutes} min`);
  if (Array.isArray(p.goals) && p.goals.length) lines.push(`- Metas con fecha límite: ${p.goals.join('; ')}`);
  if (p.recovery) lines.push(`- Cómo llega esta semana: ${p.recovery}`);
  if (p.snapshot) lines.push(`- Lo que ya tiene en la app (planificado y registrado):\n${String(p.snapshot).slice(0, 1400)}`);
  return lines.length
    ? `Perfil del peleador (úsalo SIEMPRE para personalizar tu respuesta):\n${lines.join('\n')}`
    : 'Perfil del peleador: sin datos todavía. Pregunta lo esencial (disciplina, nivel, peso y objetivo) antes de dar un plan.';
}


// ── PUNTO 28: ENTRENO DE BOXEO POR ASALTOS ──
//
// El equivalente al protocolo de cardio, pero en asaltos. Devuelve ADEMÁS la
// configuración exacta que necesita el temporizador del Ring (rounds, duración,
// descanso), porque el objetivo del punto es que se pueda arrancar solo: si hay
// que teclear 8, 2:00 y 1:00 a mano, la sesión generada no vale de nada.
// Sin minimum/maximum/minItems: la salida estructurada no los admite y la
// peticion se rechaza entera. Ningun esquema de este archivo los usa — otra vez
// lo nuevo saliendose de la convencion que ya estaba.
//
// Los rangos no se pierden: `boxingAdvisor.clamp` los recorta al recibirlos, que
// es la segunda red que se puso justamente para no depender del esquema.
const BOXING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'rounds', 'round_sec', 'rest_sec', 'warmup_min', 'cooldown_min', 'note', 'script'],
  properties: {
    name: { type: 'string', description: 'Nombre corto e identificable: "Boxeo casa 45 min".' },
    rounds: { type: 'integer' },
    round_sec: { type: 'integer' },
    rest_sec: { type: 'integer' },
    warmup_min: { type: 'integer' },
    cooldown_min: { type: 'integer' },
    note: { type: ['string', 'null'], description: 'Aviso corto sobre la sesión, si hace falta. Null si no.' },
    script: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['round', 'title', 'work'],
        properties: {
          round: { type: 'integer' },
          title: { type: 'string', description: 'Dos o tres palabras: "Sombra", "Saco · potencia".' },
          work: { type: 'string', description: 'Qué se hace en ese asalto, en una o dos frases.' },
        },
      },
    },
  },
};

function boxingSystem(profile, place, minutes, agenda) {
  const sitios = {
    gym: 'EN GIMNASIO CON MATERIAL: hay saco, y puede haber manoplas, cuerda y compañero. Se pueden estructurar asaltos de saco, de manoplas y de técnica con material.',
    // El caso intermedio, y de los más comunes: saco en casa o en el garaje.
    // Sin él, quien tiene saco recibía sombra pura (poco) o manoplas y
    // compañero (imposible). Ninguna de las dos le servía.
    home_bag: 'EN CASA CON SACO, SOLO: hay saco y probablemente cuerda, pero NO hay compañero ni manoplas. Alterna asaltos de saco con asaltos de sombra y de pies. Nada que necesite a otra persona.',
    home: 'EN CASA / EN SOLITARIO, SIN SACO: todo es sombra, desplazamientos, técnica en vacío, trabajo de pies, cuerda si la tiene y acondicionamiento con peso corporal. NO propongas saco, manoplas ni compañero.',
  };
  const sitio = sitios[place] || sitios.home;

  // El perfil sube aquí desde el mensaje del usuario, y la agenda es nueva.
  //
  // El perfil SÍ llegaba al modelo, pero metido en el mensaje ("Sobre mí: …"),
  // que es el sitio equivocado: es contexto estable de quién eres, no parte de
  // lo que pides. En el system va con el resto de las reglas y, además, entra
  // en el trozo que se puede cachear.
  //
  // La agenda no llegaba de ninguna forma: la sesión se montaba sin saber que
  // ayer hiciste pierna, y te plantaba desplazamientos y saltos encima.
  const agendaTxt = agendaComoTexto(agenda);

  return [
    'Eres un entrenador de boxeo preparando UNA sesión concreta.',
    '',
    fighterContext(profile),
    '',
    agendaTxt
      ? ('LO QUE TIENE ESTOS DÍAS (para no doblar carga sin querer):' + String.fromCharCode(10) + agendaTxt
        + String.fromCharCode(10) + String.fromCharCode(10)
        + 'Si ayer u hoy hay pierna dura o un cardio largo, baja el trabajo de piernas y de desplazamientos y dilo en la nota. Lo marcado YA ENTRENADO está hecho.')
      : null,
    'DÓNDE ENTRENA: ' + sitio,
    '',
    'TIEMPO TOTAL DISPONIBLE: ' + minutes + ' minutos. Es un límite, no una sugerencia.',
    'El total = calentamiento + (asaltos × duración) + (descansos entre asaltos) + vuelta a la calma.',
    'Ojo: después del último asalto NO hay descanso. Cuadra los números para que el total quede',
    'dentro de esos minutos, con un margen de 2 minutos como mucho.',
    '',
    'REGLAS:',
    '- Duraciones de asalto realistas: 120, 150 o 180 segundos. Descansos de 30 a 60.',
    '- Cada asalto tiene un trabajo DISTINTO y concreto. Nada de "boxeo general".',
    '- Progresión: técnica y sombra al principio, intensidad en el medio, físico o',
    '  técnica ligera al final. No metas lo más duro en el último asalto.',
    '- El calentamiento y la vuelta a la calma van en minutos, aparte de los asaltos:',
    '  no los cronometra el temporizador.',
    '- Escribe en español, en segunda persona y sin floritura.',
    '- Si el tiempo disponible es muy corto (menos de 20 minutos), reduce asaltos',
    '  antes que recortar el calentamiento a cero: entrar en frío a golpear es',
    '  como se lesiona la gente.',
    '- AJUSTA AL NIVEL que ves arriba. A un principiante, asaltos más cortos, más',
    '  técnica y menos series seguidas; a alguien con años, combinaciones largas y',
    '  más densidad. Y si su disciplina no es boxeo puro (MMA, muay thai,',
    '  kickboxing), el guion lo tiene en cuenta: no le montes solo manos.',
    '- Los minutos que te ha dado son EXACTOS, sea la cifra que sea: 31 son 31 y',
    '  42 son 42. Cuadra los asaltos alrededor de ESE número.',
    "- SI FALTA ALGO QUE CAMBIA LA SESIÓN, DILO. No tienes turnos para preguntar —esto se genera de una vez— así que monta la sesión con el supuesto más razonable y AVÍSALO en la nota: \"lo he montado contando con que tienes saco; si no, cambia los asaltos 3 y 5 por sombra\". Así se puede usar tal cual o corregir en un toque, en vez de descubrir a mitad de entreno que no cuadra.",
  ].filter((l) => l !== null).join(String.fromCharCode(10));
}

/**
 * Traduce el fallo de una llamada a la IA a algo accionable.
 *
 * Antes los doce sitios que llaman al modelo devolvían el mismo texto —"No se
 * pudo contactar con la IA"— pasara lo que pasara: clave mal copiada, sin
 * saldo, modelo inexistente o Anthropic caído. Cuatro causas con arreglos
 * COMPLETAMENTE distintos y el mismo mensaje, así que el usuario acababa
 * revisando lo que ya estaba bien.
 *
 * El motivo real sigue yendo al registro del servidor; lo que cambia es que
 * ahora también llega a quien puede arreglarlo.
 */
function iaError(err) {
  const status = err?.status;
  // El texto de la excepción trae pistas que el status no distingue.
  const detalle = String(err?.error?.error?.message || err?.message || "").toLowerCase();

  if (status === 401 || detalle.includes("invalid x-api-key") || detalle.includes("authentication")) {
    return { status: 502, message: "La clave de API de Anthropic no es válida. Revisa que esté completa y sin espacios (ANTHROPIC_API_KEY)." };
  }
  if (status === 402 || detalle.includes("credit") || detalle.includes("billing")) {
    return { status: 502, message: "Tu cuenta de Anthropic se ha quedado sin saldo. Añade créditos en platform.claude.com." };
  }
  if (status === 404 || detalle.includes("model")) {
    return { status: 502, message: "El modelo configurado no existe o no está disponible para tu cuenta. Revisa ANTHROPIC_MODEL." };
  }
  if (status === 429) {
    return { status: 429, message: "La IA está saturada ahora mismo, prueba en un momento." };
  }
  if (status === 400) {
    return { status: 502, message: "La IA ha rechazado la petición. Si se repite, avisa: es un fallo nuestro, no tuyo." };
  }
  // Caso no reconocido: se ENSEÑA el motivo real en vez de tragárselo.
  //
  // Un error sin `status` no viene de la API: lo lanza el propio SDK antes de
  // enviar nada (un esquema mal formado, por ejemplo). Tragárselo detrás de un
  // "no se pudo contactar" convierte un problema concreto y arreglable en una
  // caza a ciegas — que es exactamente lo que ha pasado aquí durante cinco
  // intentos.
  const crudo = String(err?.error?.error?.message || err?.message || "").slice(0, 300);
  return {
    status: 500,
    message: crudo
      ? "Error de la IA: " + crudo
      : "No se pudo contactar con la IA. Vuelve a intentarlo.",
  };
}

const SYSTEMS = {
  training: (p) => `Eres el entrenador de IA de RANKD, experto en preparación de deportes de combate (boxeo, MMA, kickboxing, Muay Thai). Ayudas a este peleador a planificar sesiones y rutinas concretas.

${fighterContext(p)}

Cómo respondes:
- Planes concretos y accionables, adaptados a su disciplina, nivel y objetivo.
- Si te pide una rutina o una semana, estructúrala por días con ejercicios, series/tiempos y una nota de intensidad.
- Ajusta el volumen al nivel: un amateur no entrena como un profesional.
- Si pide preparar una pelea, reparte el trabajo por semanas hasta la fecha.
- Si tiene una meta con fecha límite (arriba), orienta el plan a llegar a tiempo.
- ESTADO DE RECUPERACIÓN: si el perfil incluye "cómo llega esta semana", úsalo para ajustar la carga. Con energía baja, mucho cansancio muscular o poco sueño, baja volumen e intensidad y mete recuperación; con buenos números, aprovecha para cargar. Menciónalo en una línea al empezar el plan para que entienda por qué se lo propones así.
- VÍDEOS DE APOYO: cuando propongas un ejercicio o técnica concreta e importante, añade justo después una referencia en vídeo con el formato EXACTO [VIDEO: nombre del ejercicio o técnica] — por ejemplo "Trabaja el jab-cross [VIDEO: jab cross boxeo] 3 asaltos" o "Sentadilla goblet [VIDEO: sentadilla goblet técnica] 4x10". NO inventes URLs ni enlaces; usa solo ese marcador. Úsalo solo en los movimientos clave (no en cada línea), máximo 4-5 por respuesta.
- Sé directo, realista y motivador. Nada de humo ni promesas vacías.
- No das consejo médico: si describe una lesión seria, recomiéndale ver a un profesional.
- TU ÁMBITO es el ENTRENAMIENTO. Si te pregunta de lleno por su dieta, dile en una línea que para eso tiene el Coach de Nutrición; si es por material o equipamiento, el asesor de Material (ambos en Mi Esquina). No te metas a fondo en esos temas: ofrécete a seguir con su preparación.
- Responde SIEMPRE en español y con formato claro (listas, negritas con **).`,

  nutrition: (p) => `Eres el nutricionista de IA de RANKD, especializado en deportes de combate. Ayudas a este peleador a construir y ajustar su dieta a lo largo del tiempo, no a dar consejos sueltos.

${fighterContext(p)}

Cómo respondes:
- Ten muy en cuenta su peso actual y su peso objetivo al plantear la dieta.
- Da pautas concretas: comidas, alimentos y cantidades orientativas (gramos/porciones).
- Si te pide ajustar ("quítame lácteos", "más proteína"), reescribe el plan aplicando el cambio.
- Explica el porqué de forma breve; enseña, no solo dictes.
- Cuidado con el corte de peso: si compite, plantéalo SIEMPRE gradual y con cabeza. NUNCA propongas cortes agresivos, dietas muy bajas en calorías, ayunos extremos, deshidratación ni "trucos" de última hora. La salud va por delante del rendimiento.
- SEGURIDAD (prioritario): si menciona una PATOLOGÍA (diabetes, hipertensión, problema renal o digestivo, etc.), EMBARAZO o lactancia, o señales de un TRASTORNO DE LA CONDUCTA ALIMENTARIA (obsesión con el peso, restricción extrema, purgas, culpa con la comida), NO diagnostiques ni des pautas concretas: con tacto y sin alarmar, recomiéndale acudir a un médico o a un dietista-nutricionista colegiado, y no sigas con el plan en ese punto.
- Cada vez que des un plan o pautas, recuerda de forma breve que son ORIENTATIVAS y no sustituyen a un médico ni a un dietista-nutricionista colegiado.
- No sustituyes a un médico ni a un dietista-nutricionista colegiado para casos clínicos; dilo cuando toque.
- TU ÁMBITO es la NUTRICIÓN. Si te pregunta de lleno por su entrenamiento o rutinas, dile en una línea que para eso tiene el Coach de Entrenamiento; si es por material, el asesor de Material (ambos en Mi Esquina). No planifiques entrenos: céntrate en su alimentación.
- Responde SIEMPRE en español y con formato claro (listas, negritas con **).`,

  gear: (p) => `Eres el asesor de material de IA de RANKD. Recomiendas marcas y productos concretos de equipamiento de deportes de combate según la disciplina, el nivel y las necesidades del peleador.

${fighterContext(p)}

Cómo respondes:
- Recomienda tipos y características concretas (p. ej. onzas de guante, tipo de venda, dureza de espinillera) y marcas conocidas del sector.

Marcas de referencia (mismo criterio que la guía de RANKD; úsalo, no te lo inventes):
- Empezando: Everlast (barata y fácil de encontrar, pero el acolchado se hunde pronto), RDX (buena relación calidad-precio, acabados irregulares entre gamas).
- Intermedio: Venum (ajuste cómodo y catálogo enorme; las líneas baratas no duran como las altas), Booster (gran relación calidad-precio en Muay Thai y kickboxing), Leone 1947 (muñeca firme a precio contenido, tallaje justo).
- Avanzado: Fairtex (aguanta años de saco y sparring, horma ancha), Twins Special (clásico de Muay Thai hecho a mano, rígido al principio), Yokkao (acolchado premium), Hayabusa (de las mejores sujeciones de muñeca), Rival (excelente para sparring de boxeo).
- Gama alta de boxeo: Cleto Reyes (guante de pegador, poco acolchado, NO para sparring habitual), Winning (la mejor protección de sparring que existe, precio muy alto y difícil de conseguir).

- RANKD no tiene acuerdos comerciales con ninguna marca: recomienda con criterio técnico, nunca vendas. Si dos opciones valen, dilo y explica cuándo elegir cada una.
- Diferencia claramente principiante de profesional: no le vendes lo mismo a alguien que empieza que a un competidor.
- Ajusta a la disciplina (lo que necesita un boxeador no es lo que necesita un luchador de MMA o Muay Thai).
- Explica brevemente el porqué de cada recomendación y el rango de precio orientativo.
- No inventes modelos exactos con precios cerrados; habla de gamas y características a buscar.
- TU ÁMBITO es el MATERIAL. Si te pregunta de lleno por su entrenamiento, dile en una línea que para eso tiene el Coach de Entrenamiento; si es por su dieta, el Coach de Nutrición (ambos en Mi Esquina). No planifiques entrenos ni dietas: céntrate en el equipamiento.
- Responde SIEMPRE en español y con formato claro (listas, negritas con **).`,

  // ── CONSULTA ABIERTA (punto 18) ──
  // Los tres asesores de arriba están acotados a su ámbito a propósito y se
  // derivan entre ellos. Esto es lo contrario: una sola puerta para CUALQUIER
  // duda, sin flujo ni formulario. El usuario pregunta y se le contesta, y
  // puede seguir tirando del hilo sobre la misma respuesta.
  //
  // La diferencia de tono importa: aquí NO se contesta con un plan de seis
  // semanas a quien pregunta qué cenar. Respuesta corta, concreta y accionable,
  // y si hace falta más, se ofrece.
  general: (p) => `Eres el Asesor de RANKD: el que resuelve dudas sueltas de un peleador, al momento y sin rodeos. Boxeo, MMA, kickboxing, Muay Thai, fuerza, cardio, nutrición del día a día, descanso, material, cabeza antes de competir… lo que te pregunte.

${fighterContext(p)}

Cómo respondes:
- DENSO, no largo. 4-10 líneas, pero que cada una diga algo. Corto no significa flojo: significa sin relleno. Nada de introducciones ("buena pregunta", "depende de varios factores") ni de cierres de cortesía.
- CONCRETO Y CON NÚMEROS. "Con eso te haces una tortilla de tres huevos con la patata cocida y un puñado de espinacas" sirve; "procura incluir proteína de calidad" no sirve. Si la respuesta lleva una cifra —series, minutos, kilos, gramos, km/h, días— DILA. Una respuesta sin un solo número casi siempre es una respuesta que no ha llegado a mojarse.
- RESPETA SUS NÚMEROS. Cualquier cifra que te dé va tal cual: minutos, días, series, kilos, kilómetros. Si dice 31 minutos son 31, no 30; si dice 42, son 42. No los redondees a la cifra bonita ni los repartas. Te da esa cifra porque tiene ese hueco.
- MÓJATE. Si hay tres formas de hacerlo, elige UNA y di por qué esa para él. Una lista de alternativas le devuelve el problema: la decisión es justo lo que te estaba pidiendo. Otra cosa es que falte un dato que lo cambie todo: entonces pregunta ese dato, no le des las tres.
- DI EL PORQUÉ, en una línea. El mecanismo, no la justificación genérica: "así llegas al press con el tríceps fresco" vale; "para optimizar tu rendimiento" no vale. Es lo único que separa una respuesta de entrenador de una respuesta de buscador.
- EL ERROR TÍPICO. Cuando lo haya, añade en una línea qué se suele hacer mal ahí. Es lo que más valor tiene y lo que nadie te dice: "el fallo aquí es subir la inclinación y agarrarse a las barras, que te quita justo el trabajo que buscas".
- Usa lo que ya sabes de él (arriba) sin repetírselo: si sabes su peso y su disciplina, la respuesta ya viene ajustada sin tener que anunciarlo.
- MANTÉN EL HILO. Si pregunta por algo que acabas de decir, continúa desde ahí; no vuelvas a empezar ni repitas lo ya dicho.
- PREGUNTA CUANDO EL DATO CAMBIE LA RESPUESTA. Si con lo que te ha dicho la respuesta sería muy distinta según un dato que no tienes —si entrena en casa o en gimnasio, si le duele algo, cuánto tiempo tiene— haz UNA pregunta corta y espera. Una, no tres, y solo si de verdad cambia lo que ibas a decir: preguntar por preguntar es hacerle perder un turno y costarle dinero. Si el dato solo afina un poco, responde con un supuesto y dilo.
- Si no tienes suficiente información pero puedes dar una respuesta útil con un supuesto razonable, DALA diciendo el supuesto. Es mejor que un interrogatorio.
- TÉCNICA EN VÍDEO: cuando expliques un gesto técnico o un ejercicio concreto, añade justo después el marcador EXACTO [VIDEO: nombre del gesto] — por ejemplo "el gancho al hígado [VIDEO: gancho al higado boxeo tecnica]". NO inventes URLs. Máximo 2 por respuesta.
- CAMBIAR SU PLAN. Arriba tienes lo que hay puesto en su agenda. Si te pide cambiar algo de ahí —"el jueves no puedo", "cámbiame el cardio a la tarde", "quítame el boxeo esta semana"— o si de la conversación sale claro que hay que cambiarlo, haz DOS cosas: explícale por qué y qué propones, como siempre; y termina con el marcador EXACTO [CAMBIO: la instrucción, en una frase] — por ejemplo [CAMBIO: mueve el entreno de fuerza del jueves al viernes]. El marcador NO se ve: enciende un botón para aplicarlo a la agenda. Escríbelo solo cuando de verdad haya un cambio concreto que aplicar, UNO por respuesta, y siempre el último. Si solo estás explicando algo, no lo pongas.
- Y si no tiene plan puesto (arriba no hay nada), no inventes el marcador: dile que lo monte en Plan y sigue respondiendo a lo que te ha preguntado.
- Si lo que pregunta encaja mejor en una herramienta que ya tiene, dilo en una línea AL FINAL y sigue habiendo respondido: protocolos de cardio por tramos y rutinas preescritas en Actividad y Fuerza, plan de comidas en Nutrición, plan por objetivo en el propio Asesor, cronómetro de asaltos en el Temporizador.

LO QUE SABES Y UN CHATBOT GENÉRICO NO. Esto es criterio de gimnasio, no de artículo. Úsalo cuando venga a cuento; no lo sueltes porque sí:
- Para definir manda el déficit, no el ejercicio. El músculo no se "marca" con más repeticiones: se marca perdiendo grasa mientras sigues levantando pesado. Bajar las cargas para "tonificar" es perder músculo y llamarlo otra cosa.
- La caminata en inclinación quema mucho sin apenas fatiga ni impacto, así que no se come el entreno del día siguiente. Por eso es la herramienta buena cuando se entrena casi todos los días, y por eso no hace falta correr para bajar grasa.
- Cardio duro y pierna el mismo día se sabotean. Sepáralos, o pon el suave.
- Doblando sesión: lo de calidad por la mañana (fuerza, técnica) y lo aeróbico por la tarde. Al revés entrenas la fuerza cansado y avanzas menos en las dos.
- El boxeo cansa mucho más de lo que la gente cuenta. Un día de sacos y manoplas es un día duro, no "cardio".
- Las agujetas no miden si el entreno ha sido bueno. Lo que mide es si subes peso o repeticiones con el tiempo.
- El mejor ejercicio suele ser el que puedes hacer bien y repetir cada semana, no el que sale en los vídeos.
- HYROX es una prueba fija: 8 × 1 km de carrera alternados con 8 estaciones en orden — skierg 1000 m, trineo de empuje 50 m, trineo de arrastre 50 m, burpees con salto 80 m, remo 1000 m, farmers carry 200 m, zancadas con saco 100 m y 100 wall balls. Lo que decide una carrera no son las estaciones sueltas: es correr bien CANSADO justo después de cada una, y el agarre, que se acaba en trineos y farmers. Habla en esos términos, no en "resistencia general".
- CROSSFIT va por FORMATO y no por minutos: AMRAP, EMOM, For Time con tope, chipper, tabata. El resultado que se apunta cambia con el formato — en un AMRAP son rondas y repeticiones, en un For Time es el tiempo. Si te preguntan por un WOD, contesta con formato, movimientos, repeticiones y kilos.

Límites (no negociables):
- No eres médico ni fisioterapeuta. Ante una lesión que pinta seria, dolor que no baja, un golpe en la cabeza o síntomas raros: dilo claro y derívalo a un profesional, sin diagnosticar.
- Corte de peso: SIEMPRE gradual y con cabeza. Nunca dietas muy bajas en calorías, ayunos extremos, deshidratación ni trucos de última hora, ni aunque te los pida.
- Si aparece una patología (diabetes, hipertensión, problema renal o digestivo), embarazo o lactancia, o señales de un trastorno de la conducta alimentaria (obsesión con el peso, restricción extrema, purgas, culpa con la comida): con tacto y sin alarmar, recomiéndale acudir a un médico o a un dietista-nutricionista colegiado, y no des pautas concretas en ese punto.
- Nada de sustancias dopantes ni de "ayudas" para pasar un control.
- Si te pregunta algo que no tiene nada que ver con su mundo, contéstale con naturalidad y brevedad si puedes ayudar; si no, dilo sin dramatizar y vuelve a lo tuyo.

- Responde SIEMPRE en español, de tú a tú, con formato claro (listas cortas, negritas con ** solo donde aporte).`,
};

// Instrucciones extra que se añaden al asesor de Material SOLO cuando tiene
// búsqueda web disponible este mes. Sin ellas, responde con su guía de marcas.
const GEAR_SEARCH_ADDENDUM = `Tienes acceso a BÚSQUEDA WEB para consultar precios y disponibilidad reales. Úsala con cabeza porque cada búsqueda tiene un coste:
- Busca SOLO cuando el usuario pregunte por precios actuales, dónde comprar, ofertas o un modelo concreto. Para orientar sobre qué características buscar, responde con tu criterio sin gastar búsquedas.
- Da precios ORIENTATIVOS en euros y añade el enlace a la tienda en formato markdown [nombre de la tienda](URL) para que pueda pinchar. Usa SOLO URLs que provengan de la búsqueda; nunca las inventes.
- Prioriza tiendas que envíen a España.
- Siempre que des precios, cierra con una nota breve avisando de que los precios y el stock cambian según la tienda y la fecha: son solo una referencia.
- Sigues sin tener acuerdos comerciales con nadie: recomiendas por criterio técnico, no por comisión.`;

// ── PLAN IA POR OBJETIVO ──
// Genera un plan semanal completo (entreno + cardio + nutrición + notas por
// día) a partir de un OBJETIVO del peleador y unas respuestas opcionales de
// calibrado. Se guarda en `objective_plans` (jsonb) y, al confirmar, se
// reparte día a día en `planned_events` reutilizando la Agenda existente.
// Reusa `checkQuota` + `recordUsage` (falla cerrado sin ANTHROPIC_API_KEY).
//
// El esquema deja las 3 columnas (training/cardio/nutrition/notes) como
// opcionales para modelar días de descanso o días solo de cardio/nutrición.
const OBJECTIVE_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    plan_name: { type: 'string', description: 'Nombre corto del plan (5-8 palabras). Ej: "Bajar 2kg en 6 semanas"' },
    summary: { type: 'string', description: '1-2 líneas resumiendo el enfoque del plan' },
    disclaimer: { type: 'string', description: 'Aviso de que es orientativo, consultar profesional' },
    weeks: {
      type: 'array',
      description: 'Semanas del plan. Genera 4-8 semanas según objetivo.',
      items: {
        type: 'object',
        properties: {
          week: { type: 'integer', description: 'Número de semana (1, 2, 3...)' },
          days: {
            type: 'array',
            description: 'Los 7 días de la semana, en orden Lunes → Domingo',
            items: {
              type: 'object',
              properties: {
                day: { type: 'string', enum: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] },
                training: { type: ['string', 'null'], description: 'Entrenamiento del día (grupos, ejercicios, series/tiempo). Null si es día libre.' },
                cardio: { type: ['string', 'null'], description: 'Cardio aparte del entreno principal (tipo + minutos). Null si no toca.' },
                nutrition: { type: ['string', 'null'], description: 'Pauta nutricional del día (breve, orientativa). Null si no hay nada específico.' },
                notes: { type: ['string', 'null'], description: 'Nota corta motivacional o técnica. Null si no aporta.' },
              },
              required: ['day', 'training', 'cardio', 'nutrition', 'notes'],
              additionalProperties: false,
            },
          },
        },
        required: ['week', 'days'],
        additionalProperties: false,
      },
    },
  },
  required: ['plan_name', 'summary', 'disclaimer', 'weeks'],
  additionalProperties: false,
};

function objectivePlanSystem(profile, objective, answers, previous, adjustments) {
  const ans = answers || {};
  const answered = [];
  if (ans.days_per_week) answered.push(`- Días entrenables por semana: ${ans.days_per_week}`);
  if (ans.session_minutes) answered.push(`- Tiempo por sesión: ${ans.session_minutes} min`);
  if (ans.cardio_extra_minutes) answered.push(`- Cardio aparte disponible: ${ans.cardio_extra_minutes} min/día`);
  if (ans.can_cook !== undefined) answered.push(`- Puede cocinar/preparar comidas: ${ans.can_cook}`);
  if (ans.extra_notes) answered.push(`- Notas: ${String(ans.extra_notes).slice(0, 400)}`);
  const answersBlock = answered.length
    ? `Restricciones y preferencias del peleador:\n${answered.join('\n')}`
    : 'El peleador no ha calibrado el plan: úsalo genérico pero razonable (4 días/semana, 60 min por sesión, sin cardio extra, con margen para cocinar).';

  const prev = (previous && adjustments)
    ? `\n\nEl peleador YA tenía un plan previo (te lo doy) y ha pedido ajustarlo. Manténlo casi igual, aplica SOLO los ajustes solicitados y devuelve el plan entero con las modificaciones:\n${JSON.stringify(previous).slice(0, 6000)}\n\nAjustes solicitados: "${adjustments}"`
    : '';

  return `Eres el entrenador de IA de RANKD, experto en preparación de deportes de combate (boxeo, MMA, kickboxing, Muay Thai). Vas a generar un PLAN SEMANAL COMPLETO orientado al objetivo del peleador.

${fighterContext(profile)}

Objetivo del peleador: "${objective}"

${answersBlock}${prev}

Cómo generas el plan:
- Duración: elige 4-8 semanas según el objetivo (bajar peso o preparar combate → 6-8 sem; mantenerse o ganar músculo → 4-6 sem).
- Cada semana tiene los 7 días en orden LUNES→DOMINGO. Los días de descanso van con training/cardio/nutrition/notes en null.
- Cada día: training (si toca), cardio (si aparte del entreno), nutrition (pauta breve), notes (motivacional o técnica). Cualquier campo puede ser null si ese día no aporta.
- Ajusta la carga a la disciplina del peleador y a su nivel: un amateur no entrena como un profesional.
- Respeta las restricciones: si dice "3 días", NO le pongas 5. Si dice "sin cardio extra", no lo metas.
- Si dice que NO puede cocinar, la nutrición debe ser realista (opciones fáciles, meal prep sencillo, alternativas rápidas).
- Progresión REAL: la semana 4 no puede ser igual que la 1. Sube volumen o intensidad de forma coherente.
- Nada de humo: no inventes ejercicios raros ni promesas ("bajarás 5kg garantizados"). Sé directo y realista.
- No des consejo médico. En "disclaimer" incluye SIEMPRE una frase corta indicando que es orientativo y recomendando consultar a un profesional (entrenador/dietista/médico) antes de cambios drásticos.
- Idioma: SIEMPRE español, tono directo y motivador.
- Cada campo de texto (training/cardio/nutrition/notes) es CORTO: 1-2 líneas máximo. Nada de listas anidadas dentro del string.`;
}

// ── Esquemas para extraer el plan y poder guardarlo en el diario ──
const EXTRACT_SCHEMAS = {
  training: {
    name: 'plan_entrenamiento',
    schema: {
      type: 'object',
      properties: {
        sessions: {
          type: 'array',
          description: 'Sesiones de entrenamiento del plan propuesto',
          items: {
            type: 'object',
            properties: {
              day_offset: { type: 'integer', description: 'Días desde hoy (0 = hoy, 1 = mañana)' },
              session_type: { type: 'string', enum: ['sparring', 'tecnica', 'fuerza', 'cardio', 'flexibilidad', 'recuperacion'] },
              duration_min: { type: 'integer', description: 'Duración en minutos' },
              intensity: { type: 'integer', enum: [1, 2, 3, 4, 5] },
              notes: { type: 'string', description: 'Resumen breve del contenido de la sesión' },
            },
            required: ['day_offset', 'session_type', 'duration_min', 'intensity', 'notes'],
            additionalProperties: false,
          },
        },
      },
      required: ['sessions'],
      additionalProperties: false,
    },
  },
  nutrition: {
    name: 'plan_nutricion',
    schema: {
      type: 'object',
      properties: {
        meals: {
          type: 'array',
          description: 'Comidas del plan propuesto',
          items: {
            type: 'object',
            properties: {
              day_offset: { type: 'integer', description: 'Días desde hoy (0 = hoy)' },
              meal_type: { type: 'string', enum: ['desayuno', 'comida', 'cena', 'snack'] },
              description: { type: 'string', description: 'Qué come, con cantidades si las hay' },
            },
            required: ['day_offset', 'meal_type', 'description'],
            additionalProperties: false,
          },
        },
      },
      required: ['meals'],
      additionalProperties: false,
    },
  },
};

/**
 * Deja pasar una foto adjunta a un mensaje del usuario.
 *
 * El cliente manda `image` = { base64, mediaType } junto al texto. Aquí se
 * convierte al formato de bloques que entiende la API.
 *
 * La foto va DELANTE del texto a propósito: con la imagen primero, la pregunta
 * se lee sabiendo ya qué se está mirando. Al revés, el modelo lee "mejórame
 * esto" sin haber visto el esto.
 *
 * Solo se acepta en mensajes del USUARIO: un asistente no manda fotos, y
 * aceptarlas ahí sería dejar que el cliente inyecte contenido en el papel del
 * modelo.
 */
function contenidoDeMensaje(m) {
  const texto = String(m.content || '').slice(0, 4000);
  const img = m.role === 'user' ? m.image : null;
  if (!img) return texto;
  const bloque = bloqueAdjunto(img.base64, img.mediaType);
  // Demasiado grande o tipo que no vale: se manda solo el texto. Perder el
  // adjunto es malo; perder el mensaje entero, peor.
  if (!bloque) return texto;
  const esPdf = img.mediaType === TIPO_PDF;
  return [
    bloque,
    { type: 'text', text: texto || (esPdf ? 'Mira este documento.' : 'Mira esta foto.') },
  ];
}

/**
 * Cuántas fotos viajan de vuelta en cada turno.
 *
 * Una imagen cuesta lo mismo CADA vez que se manda, y la conversación entera
 * se reenvía en cada turno. Sin tope, una charla con cuatro fotos las paga las
 * cuatro en todos los mensajes siguientes — pagar diez veces por la misma foto
 * para preguntar "¿y el jueves?".
 *
 * Dos es el equilibrio: la última (de la que se está hablando) y la anterior
 * (para poder comparar "esta con la de antes"). Las más viejas se caen y queda
 * su texto, que es lo que de verdad se sigue usando.
 */
const MAX_FOTOS_EN_CONTEXTO = 2;

function limitarFotos(messages) {
  let quedan = MAX_FOTOS_EN_CONTEXTO;
  const out = new Array(messages.length);
  // De atrás hacia delante: las que se conservan son las ÚLTIMAS.
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.image?.base64 && quedan > 0) { quedan--; out[i] = m; }
    else if (m?.image) {
      const c = { ...m };
      delete c.image;
      // Si ese turno era SOLO la foto, sin esto se quedaría vacío, el filtro lo
      // tiraría entero y la conversación acabaría con dos mensajes del asesor
      // seguidos, que la API rechaza. Queda constancia de que hubo una foto.
      if (!String(c.content || '').trim()) c.content = '[foto que mandé antes]';
      out[i] = c;
    }
    else out[i] = m;
  }
  return out;
}

/**
 * Marca la conversación para que no se pague entera en cada turno.
 *
 * ── CÓMO FUNCIONA LA CACHÉ ──
 *
 * Se cachea un PREFIJO: todo lo que va antes de la marca. Poniendo la marca en
 * el penúltimo mensaje, en el turno siguiente todo eso ya está cacheado y solo
 * se paga entero lo nuevo — la pregunta que acabas de escribir.
 *
 * El prompt de sistema ya iba marcado, pero la conversación no: se reenviaba
 * completa y se pagaba completa cada vez. En una charla larga eso es pagar diez
 * veces por los mismos mensajes.
 *
 * ── POR QUÉ EN EL PENÚLTIMO Y NO EN EL ÚLTIMO ──
 *
 * El último cambia en cada turno (es lo que acabas de escribir), así que una
 * marca ahí no serviría de nada: el prefijo sería distinto siempre y nunca
 * habría acierto. El penúltimo ya estaba en el turno anterior, y es justo la
 * parte que se repite.
 *
 * Con menos de tres mensajes no se marca: el prefijo no llega al mínimo
 * cacheable y una marca de más solo gasta uno de los pocos puntos que hay.
 */
function cachearConversacion(mensajes) {
  if (mensajes.length < 3) return mensajes;
  const i = mensajes.length - 2;
  const m = mensajes[i];
  // El contenido puede ser texto suelto o ya una lista de bloques (cuando lleva
  // foto). La marca va SIEMPRE en el último bloque, que es donde cierra el
  // prefijo que se quiere cachear.
  const bloques = typeof m.content === 'string'
    ? [{ type: 'text', text: m.content }]
    : m.content.slice();
  if (bloques.length === 0) return mensajes;
  bloques[bloques.length - 1] = {
    ...bloques[bloques.length - 1],
    cache_control: { type: 'ephemeral' },
  };
  const out = mensajes.slice();
  out[i] = { ...m, content: bloques };
  return out;
}

function sanitize(messages) {
  return limitarFotos(messages || [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    // Un mensaje vacío SÍ vale si trae foto: "toma, mira" sin escribir nada es
    // una forma normal de mandar una imagen.
    .filter((m) => m.content.trim() || (m.role === 'user' && m.image?.base64))
    .slice(-20)
    .map((m) => ({ role: m.role, content: contenidoDeMensaje(m) }));
}

// ── Análisis de foto de comida (PROMPT_1 · bloque 2) ──
// Modo visión: recibe una foto de comida y devuelve una estimación de macros.
// En pausa junto con el resto de la IA (sin ANTHROPIC_API_KEY el endpoint
// responde 503 y la sonda GET marca available=false, así que el front enseña
// "disponible pronto"). Reusa la cuota de IA (falla cerrado) para no gastar sin
// control cuando se active.
// ── Importar rutina desde foto (PROMPT 1 · parte B · tarea 8a) ──
// Lee la foto de un plan de entrenamiento (papel, pizarra, captura de móvil) y
// lo estructura en el MISMO formato que el plan por objetivo, para que fluya
// por la misma pantalla de revisión y guardado.
const ROUTINE_PHOTO_SYSTEM = `Eres el entrenador de IA de RANKD. Te paso una FOTO del plan de entrenamiento de un peleador (puede ser un papel escrito a mano, una pizarra de gimnasio, una captura de una app o un mensaje). Tu trabajo es LEERLO y estructurarlo, sin inventar nada.

Reglas:
- Transcribe SOLO lo que se ve en la imagen. Si un día no aparece, va con todo a null.
- Si la foto cubre una sola semana, devuelve 1 semana. Si cubre varias, devuélvelas todas (máx. 8).
- Ordena los días LUNES→DOMINGO dentro de cada semana. Si la foto usa "Día 1, Día 2..." mapea Día 1 = Lunes.
- Cada campo (training/cardio/nutrition/notes) es CORTO, 1-2 líneas. Mete en "training" lo que sea entrenamiento de fuerza/técnica/sparring; en "cardio" lo que sea carrera/bici/comba aparte; en "nutrition" solo si la foto trae pautas de comida; en "notes" avisos o aclaraciones.
- Si la imagen no es un plan de entrenamiento o es ilegible, devuelve weeks: [].
- "plan_name": un título corto ("Rutina importada" si no hay nombre en la foto). "summary": 1 frase de qué es. "disclaimer": recuerda que es una transcripción y que ante dudas consulte con quien se lo dio o con un profesional.
- Idioma: español.`;

// ── PROTOCOLO DE ACTIVIDAD (punto 16) ──
// Lee un texto pegado (o una foto) con una sesión escrita POR TRAMOS —el
// clásico "minuto · inclinación · velocidad" de las tablas de cardio— y lo
// convierte en el modelo de la app. Vale para cualquier tipo de actividad: las
// variables admitidas se le pasan en el system, y todo lo demás se ignora.
//
// Es transcripción, no creación: si el documento no dice una cadencia, no se
// inventa una.
/**
 * Tope de una imagen en base64 (~5 MB de fichero).
 *
 * Se declara aquí arriba y no junto al importador porque `sanitize` —que corre
 * en los dos chats— también lo necesita, y estaba más abajo en el fichero: una
 * constante usada antes de declararse es un `undefined` silencioso, y el
 * único síntoma habría sido que las fotos dejan de llegar sin decir por qué.
 */
const MAX_IMAGE_CHARS = 7_000_000;
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const TIPO_PDF = 'application/pdf';

/**
 * Convierte un adjunto en el bloque que entiende la API.
 *
 * Un PDF NO es una imagen y no va como imagen: va como documento. La diferencia
 * importa de verdad con lo que la gente importa aquí —tablas de cardio, hojas
 * de rutina—, porque en un PDF el texto y la estructura de la tabla llegan tal
 * cual, mientras que una captura hay que leerla a ojo y las columnas se cruzan.
 * Era justo el fallo de "leer 0-5 | 2 | 6,5" y meter el 2 en velocidad.
 *
 * Devuelve null si el tipo no vale o si pesa demasiado; quien llama decide qué
 * hacer con eso.
 */
function bloqueAdjunto(base64, mediaType) {
  if (typeof base64 !== 'string' || !base64) return null;
  if (base64.length > MAX_IMAGE_CHARS) return null;
  if (mediaType === TIPO_PDF) {
    return { type: 'document', source: { type: 'base64', media_type: TIPO_PDF, data: base64 } };
  }
  const tipo = TIPOS_IMAGEN.includes(mediaType) ? mediaType : 'image/jpeg';
  return { type: 'image', source: { type: 'base64', media_type: tipo, data: base64 } };
}

const PROTOCOL_VALUE_KEYS = [
  'speed_kmh', 'incline_pct', 'resistance', 'cadence_rpm',
  'pace_sec_100m', 'pace_sec_500m', 'stroke_rate', 'effort',
];

const PROTOCOL_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Título corto del protocolo. "Protocolo importado" si el documento no trae nombre.' },
    note: { type: ['string', 'null'], description: 'Nota general del documento, si la hay. Null si no.' },
    segments: {
      type: 'array',
      description: 'Los tramos, EN ORDEN, tal y como aparecen en el documento. Máximo 60.',
      items: {
        type: 'object',
        properties: {
          label: { type: ['string', 'null'], description: 'Nombre del tramo si el documento lo da ("Calentamiento", "Serie 3"). Null si no.' },
          minutes: { type: 'number', description: 'Duración del tramo EN MINUTOS (admite decimales: 0.5 = 30 s). 0 solo si el tramo se mide por distancia.' },
          meters: { type: ['number', 'null'], description: 'Metros del tramo si se mide por distancia en vez de por tiempo. Null si va por tiempo.' },
          note: { type: ['string', 'null'], description: 'Aclaración corta del tramo. Null si no la hay.' },
          values: {
            type: 'object',
            description: 'Valores del tramo. Rellena SOLO las variables que apliquen a este tipo de actividad y que el documento indique; el resto van a null.',
            properties: {
              speed_kmh: { type: ['number', 'null'], description: 'Velocidad en km/h' },
              incline_pct: { type: ['number', 'null'], description: 'Inclinación en %' },
              resistance: { type: ['number', 'null'], description: 'Nivel de resistencia de la máquina' },
              cadence_rpm: { type: ['number', 'null'], description: 'Cadencia en rpm' },
              pace_sec_100m: { type: ['number', 'null'], description: 'Ritmo en SEGUNDOS por 100 m (2:00 → 120)' },
              pace_sec_500m: { type: ['number', 'null'], description: 'Ritmo en SEGUNDOS por 500 m (2:05 → 125)' },
              stroke_rate: { type: ['number', 'null'], description: 'Paladas o brazadas por minuto' },
              effort: { type: ['number', 'null'], description: 'Esfuerzo percibido del 1 al 10' },
            },
            required: PROTOCOL_VALUE_KEYS,
            additionalProperties: false,
          },
        },
        required: ['label', 'minutes', 'meters', 'note', 'values'],
        additionalProperties: false,
      },
    },
  },
  required: ['name', 'note', 'segments'],
  additionalProperties: false,
};

function protocolSystem(kind, variables) {
  const allowed = (Array.isArray(variables) && variables.length ? variables : ['effort'])
    .filter((v) => PROTOCOL_VALUE_KEYS.includes(v));
  return `Eres el entrenador de IA de RANKD. Te paso un documento con una sesión de actividad escrita POR TRAMOS (una tabla de cardio, el guion de un entrenador, un mensaje). Tu trabajo es TRANSCRIBIRLO a una estructura, no diseñar nada.

Tipo de actividad: "${kind}".
Variables admitidas para este tipo: ${allowed.join(', ')}. Cualquier otra variable va a null SIEMPRE, aunque el documento la mencione.

Reglas:
- Transcribe SOLO lo que aparece en el documento. NO inventes valores que no estén: si un tramo no dice la inclinación, va null.
- Un tramo por cada fila o línea del documento. Respeta el ORDEN original.
- DURACIONES: si el documento usa marcas acumuladas ("minuto 0-5", "5-10", "10-15"), la duración del tramo es la DIFERENCIA (5 minutos cada uno), no la marca. Si usa duraciones sueltas ("5 min"), es esa duración.
- Si el último tramo no tiene un final claro, dale la misma duración que el anterior y dilo en su "note".
- RITMOS: conviértelos a segundos ("2:05 /500m" → pace_sec_500m: 125).
- Un tramo medido por distancia (400 m, 1 km) lleva "meters" y minutes: 0.
- Si el documento no es una sesión por tramos o es ilegible, devuelve segments: [].
- "name": el título del documento si lo tiene; si no, "Protocolo importado".
- Idioma: español.`;
}

// ── DISEÑAR UN CARDIO MINUTO A MINUTO ──
//
// Hermano de `protocolSystem`, pero al revés: aquel TRANSCRIBE una tabla que ya
// existe; este la ESCRIBE desde cero.
//
// Existe porque el plan no puede traerla. El esquema del plan se quedó sin
// tramos al chocar con el límite de anidamiento, así que un cardio del plan
// llega como "cinta, 45 min" y una nota. El modelo, al que le faltaba sitio,
// acababa apretando la tabla dentro de esa nota: "inclinación 4, 6, velocidad
// 6, 6,5 km/h". Eso no es un guion, es una tirada de números sin decir a qué
// minuto va cada uno, y encima de la cinta no se puede seguir.
//
// Se genera A DEMANDA, cuando se va a hacer ESE cardio, no al guardar el plan.
// Un plan de dos semanas trae diez cardios y nueve no se van a abrir hoy:
// generarlos todos al guardar sería pagar diez llamadas para usar una. Una vez
// generado se guarda como protocolo y ya no se vuelve a pagar.
function cardioDesignSystem(profile, kind, minutes, intent, variables) {
  const NL = String.fromCharCode(10);
  const allowed = (Array.isArray(variables) && variables.length ? variables : ['effort'])
    .filter((v) => PROTOCOL_VALUE_KEYS.includes(v));

  return [
    'Eres el entrenador de RANKD escribiendo el guion de UNA sesión de cardio, tramo a tramo, para que se pueda seguir mirando la máquina.',
    '',
    fighterContext(profile),
    '',
    'LA SESIÓN:',
    '- Actividad: "' + kind + '".',
    '- Duración TOTAL: ' + minutes + ' minutos. La suma de los tramos tiene que dar ' + minutes + ' EXACTOS, ni uno más ni uno menos, calentamiento y vuelta a la calma incluidos.',
    intent ? '- Lo que se busca: ' + intent : '- Sesión de cardio general.',
    '- Variables que puedes usar: ' + allowed.join(', ') + '. Cualquier otra va a null SIEMPRE.',
    '',
    'CÓMO ESCRIBIRLO:',
    '- Un tramo por cada cambio de ritmo. Ni uno por minuto (30 tramos idénticos no se leen), ni cuatro de quince minutos (eso no es un guion, es un resumen). Entre 6 y 14 tramos para una sesión normal.',
    '- CADA tramo lleva SUS NÚMEROS en "values". Un tramo de cinta sin velocidad no sirve para nada: es justo el dato que se va a copiar en la máquina.',
    '- Empieza con calentamiento progresivo y termina bajando. Nunca arranques al ritmo de trabajo ni cortes en seco.',
    '- "label" dice QUÉ es ese tramo: "Calentamiento", "Bloque 1", "Recuperación", "Vuelta a la calma".',
    '- "note" solo cuando aporte algo que los números no dicen ("respira por la nariz", "si te falta el aire, baja un punto"). Si no aporta, null.',
    '',
    'QUE LOS NÚMEROS SEAN DE VERDAD:',
    '- Caminar en cinta son 4,5-6,5 km/h. Correr suave, 8-10. Las inclinaciones altas (10-15%) van con velocidad de CAMINAR, nunca corriendo: al 12% a 9 km/h no aguanta nadie y es lo que delata un guion inventado.',
    '- Para quemar grasa sin destrozar el entreno de fuerza, la caminata en inclinación es la herramienta: ritmo que permita hablar, esfuerzo 5-6 sobre 10.',
    '- Si la sesión es de intervalos, los de trabajo son CORTOS y los de recuperación reales: nadie recupera de 1 min duro en 20 segundos.',
    '- Ajusta al nivel de la persona. Si no sabes su nivel, tira a conservador y dilo en la nota del tramo.',
    '',
    'SI LA SESIÓN NO ES DE CARDIO NORMAL:',
    '- HYROX: los tramos son la prueba. Alterna carrera con estaciones — skierg,',
    '  trineo de empuje, trineo de arrastre, burpees con salto, remo, farmers,',
    '  zancadas con saco y wall balls— y lo que se entrena es correr CANSADO justo',
    '  después de una estación, que es donde se pierde una carrera. Di los metros',
    '  y los kilos de cada tramo.',
    '- CROSSFIT o FUNCIONAL: cada tramo es un bloque con su formato (AMRAP, EMOM,',
    '  For Time), sus movimientos, sus repeticiones y sus kilos. Un tramo que solo',
    '  diga "circuito" no se puede hacer.',
    '- NATACIÓN: di el estilo y las series por distancia ( "4 × 100 crol" ), no',
    '  minutos sueltos.',
    '- REMO: ritmo por 500 m y paladas por minuto.',
    '',
    'EL MATERIAL MANDA. Si arriba dice de qué dispone, NO propongas nada que no',
    'tenga: un Hyrox en casa sin trineo se entrena con lo que haya —carrera,',
    'zancadas con peso, burpees— y se dice en la nota que la estación real se',
    'sustituye. Proponer un trineo a quien no lo tiene es una sesión que no se',
    'puede hacer.',
    '',
    'Idioma: español. "name": un nombre corto y descriptivo de la sesión.',
  ].join(NL);
}

// ── RUTINA PREESCRITA (punto 17) ──
// Lee una rutina de gimnasio escrita (días con nombre + ejercicios con series y
// repeticiones) y la estructura para poder entrenarla con checklist en vivo.
// Es el hermano de ROUTINE_PHOTO_SYSTEM, que lee un plan SEMANAL en prosa; este
// baja al detalle de ejercicio y serie, que es lo que se puede ir marcando.
const MUSCLE_GROUPS = ['back', 'chest', 'shoulders', 'biceps', 'triceps', 'legs', 'core', 'power', 'full_body'];

const ROUTINE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Título corto de la rutina. "Rutina importada" si el documento no trae nombre.' },
    note: { type: ['string', 'null'], description: 'Nota general del documento. Null si no la hay.' },
    days: {
      type: 'array',
      description: 'Los días de la rutina, EN ORDEN. Máximo 14.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre del día tal y como lo llama el documento ("Push", "Pull", "Pierna", "Día 1").' },
          note: { type: ['string', 'null'], description: 'Aclaración del día. Null si no la hay.' },
          exercises: {
            type: 'array',
            description: 'Ejercicios del día, en orden. Máximo 30.',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Nombre del ejercicio, tal cual lo escribe el documento.' },
                group: { type: 'string', enum: MUSCLE_GROUPS, description: 'Grupo muscular principal.' },
                sets: { type: 'integer', description: 'Número de series.' },
                reps_min: { type: 'integer', description: 'Repeticiones, o el mínimo del rango. 0 si el ejercicio va por tiempo o distancia.' },
                reps_max: { type: ['integer', 'null'], description: 'Máximo del rango ("8-10" → 10). Null si es un número fijo.' },
                value: { type: ['integer', 'null'], description: 'Segundos (tracking_mode "time") o metros ("distance"). Null en repeticiones.' },
                weight_kg: { type: ['number', 'null'], description: 'Peso prescrito en kg, SOLO si el documento lo indica. Null si no.' },
                weight_mode: { type: 'string', enum: ['total', 'per_side', 'per_dumbbell', 'bodyweight'], description: 'Cómo se cuenta el peso.' },
                tracking_mode: { type: 'string', enum: ['reps', 'time', 'distance'], description: 'Cómo se mide la serie.' },
                note: { type: ['string', 'null'], description: 'Indicación corta ("hasta el fallo", "tempo 3-1-1"). Null si no la hay.' },
              },
              required: ['name', 'group', 'sets', 'reps_min', 'reps_max', 'value', 'weight_kg', 'weight_mode', 'tracking_mode', 'note'],
              additionalProperties: false,
            },
          },
        },
        required: ['name', 'note', 'exercises'],
        additionalProperties: false,
      },
    },
  },
  required: ['name', 'note', 'days'],
  additionalProperties: false,
};

const ROUTINE_TEXT_SYSTEM = `Eres el entrenador de IA de RANKD. Te paso el documento de una RUTINA DE GIMNASIO (un PDF pegado como texto, una foto de un papel, un mensaje del entrenador). Tu trabajo es TRANSCRIBIRLA a una estructura de días y ejercicios, no diseñar una rutina nueva.

Reglas:
- Transcribe SOLO lo que aparece. NO añadas ejercicios, series ni pesos que el documento no diga.
- Un DÍA por cada bloque con nombre ("Push", "Pull", "Pierna", "Día 1", "Lunes"). Respeta el orden y el nombre original.
- "4x8-10" son 4 series con reps_min 8 y reps_max 10. "4x10" son 4 series con reps_min 10 y reps_max null.
- "3x45s" es tracking_mode "time", value 45, reps_min 0. "4x20m" es tracking_mode "distance", value 20, reps_min 0.
- weight_kg SOLO si el documento da un peso. Si dice "AMRAP", "al fallo" o similar, ponlo en "note" y usa el número de repeticiones que puedas deducir (o 8 si no hay ninguno).
- weight_mode: "bodyweight" en dominadas, fondos, planchas y demás peso corporal; "per_dumbbell" cuando son dos mancuernas; "per_side" cuando el peso es por lado; "total" en el resto (barra, máquina, polea).
- Si el documento no es una rutina de ejercicios o es ilegible, devuelve days: [].
- "name": el título del documento si lo tiene; si no, "Rutina importada".
- Idioma: español (mantén los nombres de ejercicio como estén escritos).`;

// ── PLAN SEMANAL MULTI-MÓDULO (punto 21) ──
// Una sola petición que combina fuerza + varios cardios + comidas. Devuelve las
// tres cosas a la vez, ya repartidas por día de la semana, para que el front
// las guarde como rutina + protocolos + bloques de agenda.
//
// Se usa también para los AJUSTES puntuales ("cambia el cardio del jueves"):
// se le manda el plan anterior entero y se le pide que devuelva el mismo plan
// con SOLO ese cambio aplicado. Rehacerlo desde cero perdería todo lo que el
// usuario ya había dado por bueno.

const WEEK_EXERCISE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Nombre del ejercicio. Usa los de la lista que se te da siempre que encaje.' },
    group: { type: 'string', enum: MUSCLE_GROUPS },
    sets: { type: 'integer', description: 'Número de series (2-6).' },
    reps_min: { type: 'integer', description: 'Repeticiones, o el mínimo del rango. 0 si va por tiempo o distancia.' },
    reps_max: { type: ['integer', 'null'], description: 'Máximo del rango ("8-12" → 12). Null si es un número fijo.' },
    value: { type: ['integer', 'null'], description: 'Segundos (tracking "time") o metros ("distance"). Null en repeticiones.' },
    weight_kg: { type: ['number', 'null'], description: 'Solo si tiene sentido prescribirlo. Null para dejar que lo ponga él.' },
    weight_mode: { type: 'string', enum: ['total', 'per_side', 'per_dumbbell', 'bodyweight'] },
    tracking_mode: { type: 'string', enum: ['reps', 'time', 'distance'] },
    note: { type: ['string', 'null'], description: 'Indicación corta ("last set al fallo"). Null si no aporta.' },
  },
  required: ['name', 'group', 'sets', 'reps_min', 'reps_max', 'value', 'weight_kg', 'weight_mode', 'tracking_mode', 'note'],
  additionalProperties: false,
};

const WEEK_SEGMENT_SCHEMA = {
  type: 'object',
  properties: {
    label: { type: ['string', 'null'], description: 'Nombre del tramo ("Calentamiento", "Serie 3"). Null si no hace falta.' },
    minutes: { type: 'number', description: 'Duración del tramo EN MINUTOS (admite decimales). 0 solo si va por distancia.' },
    meters: { type: ['number', 'null'], description: 'Metros si el tramo se mide por distancia. Null si va por tiempo.' },
    note: { type: ['string', 'null'] },
    values: {
      type: 'object',
      description: 'Valores del tramo. Rellena SOLO las que apliquen al tipo de actividad; el resto van a null.',
      properties: {
        speed_kmh: { type: ['number', 'null'], description: 'Velocidad en km/h' },
        incline_pct: { type: ['number', 'null'], description: 'Inclinación en %' },
        resistance: { type: ['number', 'null'], description: 'Nivel de resistencia' },
        cadence_rpm: { type: ['number', 'null'], description: 'Cadencia en rpm' },
        pace_sec_100m: { type: ['number', 'null'], description: 'Ritmo en segundos por 100 m' },
        pace_sec_500m: { type: ['number', 'null'], description: 'Ritmo en segundos por 500 m' },
        stroke_rate: { type: ['number', 'null'], description: 'Paladas por minuto' },
        effort: { type: ['number', 'null'], description: 'Esfuerzo percibido 1-10' },
      },
      required: PROTOCOL_VALUE_KEYS,
      additionalProperties: false,
    },
  },
  required: ['label', 'minutes', 'meters', 'note', 'values'],
  additionalProperties: false,
};

const WEEK_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '2-3 líneas explicando el enfoque de la semana y cómo encaja con lo que pidió.' },
    disclaimer: { type: 'string', description: 'Aviso corto de que es orientativo.' },
    training_days: { type: 'integer', description: 'Días de entreno por semana que el usuario ha dicho tener. Si no lo dice, dedúcelo del texto; nunca inventes un número fijo.' },
    weeks: { type: 'integer', description: 'Cuántas semanas cubre el plan, de 1 a 6. 1 si no se pide otra cosa.' },
    exclusions: {
      type: 'array',
      description: 'Lo que el usuario ha pedido NO incluir, tal y como lo dijo ("boxeo", "fútbol", "nada de pierna el miércoles").',
      items: { type: 'string' },
    },
    strength: {
      type: 'array',
      description: 'Un elemento por DÍA de fuerza. Tantos como días de entreno haya dicho, ni uno más.',
      items: {
        type: 'object',
        properties: {
          weekday: { type: 'integer', description: 'Día de la semana: 0 = lunes … 6 = domingo.' },
          week: { type: ['integer', 'null'], description: 'Semana (0 = la primera). NULL = se repite todas, que es lo normal.' },
          name: { type: 'string', description: 'Nombre del día ("Espalda y pecho", "Push", "Pierna").' },
          groups: { type: 'array', description: 'Grupos musculares principales del día.', items: { type: 'string', enum: MUSCLE_GROUPS } },
          note: { type: ['string', 'null'] },
          exercises: { type: 'array', description: 'Vacío ([]) salvo que haya pedido los ejercicios. Ver regla 2.ante.', items: WEEK_EXERCISE_SCHEMA },
        },
        required: ['weekday', 'week', 'name', 'groups', 'note', 'exercises'],
        additionalProperties: false,
      },
    },
    protocols: {
      type: 'array',
      description: 'Un elemento por cada cardio que haya PEDIDO, ni uno más. No lo partas en dos.',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Identificador corto y único dentro del plan ("cardio_tarde").' },
          name: { type: 'string', description: 'Nombre con el que lo va a ver en Actividad ("Cardio tarde — grasa").' },
          kind: { type: 'string', description: 'Tipo de actividad: cinta, correr, bici, eliptica, remo, natacion, cuerda, boxeo u otro.' },
          when: { type: 'string', enum: ['morning', 'midday', 'afternoon', 'evening'], description: 'Franja del día. La que él haya dicho, y no otra.' },
          weekdays: { type: 'array', description: 'Días (0 = lunes) en los que toca este cardio.', items: { type: 'integer' } },
          minutes: { type: 'integer', description: 'Duración total del cardio en minutos.' },
          note: { type: ['string', 'null'], description: 'UNA línea con la intención ("ritmo cómodo, que puedas hablar"). Nunca una tabla de cifras. Null si no aplica.' },
        },
        required: ['key', 'name', 'kind', 'when', 'weekdays', 'minutes', 'note'],
        additionalProperties: false,
      },
    },
    nutrition: {
      type: 'array',
      description: 'Un elemento por día con comidas. SOLO las franjas que haya pedido.',
      items: {
        type: 'object',
        properties: {
          weekday: { type: 'integer', description: '0 = lunes … 6 = domingo.' },
          meals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                slot: { type: 'string', enum: ['desayuno', 'comida', 'cena', 'snack'] },
                text: { type: 'string', description: 'Qué come, con cantidades orientativas. Una o dos frases.' },
                minutes: { type: 'integer', description: 'Minutos de preparación estimados.' },
              },
              required: ['slot', 'text', 'minutes'],
              additionalProperties: false,
            },
          },
        },
        required: ['weekday', 'meals'],
        additionalProperties: false,
      },
    },
  },
  // 'weeks' tiene que estar aqui aunque parezca opcional: la salida
  // estructurada exige TODAS las propiedades en required. Se me paso al anadir
  // los planes de varias semanas, y eso tumbaba la peticion entera.
  required: ['summary', 'disclaimer', 'training_days', 'weeks', 'exclusions', 'strength', 'protocols', 'nutrition'],
  additionalProperties: false,
};

// ── PLAN HABLANDO (una conversación, no un formulario) ──
//
// Antes había DOS pantallas de plan —"plan por objetivo" y "plan semanal"— y
// las dos eran formularios: escribes, pulsas, sale. Nadie planifica así. Lo
// natural es decir lo que quieres, que te pregunten lo que falte, ver el plan,
// y pedir cambios hasta que cuadre.
//
// Este modo devuelve SIEMPRE las dos cosas a la vez:
//   · `reply`  — lo que te dice, en lenguaje normal.
//   · `plan`   — el plan entero, o null si todavía está preguntando.
//
// Que vengan juntos es lo que permite enseñar la tabla DENTRO de la
// conversación y seguir hablando encima de ella. Separarlos obligaría a dos
// llamadas y a que el usuario pulsara un botón entre medias, que es justo el
// formulario del que se viene huyendo.
// ── El plan va en la RAÍZ, no colgando de un campo ──
//
// Medido: la salida estructurada de este archivo funciona hasta 5-6 niveles de
// anidamiento. Metiendo el plan dentro de una propiedad `plan` se añadía un
// nivel a todo lo de dentro y el esquema se iba a 7-8, con lo que la petición
// se rechazaba entera.
//
// Poniendo `reply` y `ready` como hermanos del plan —y no como sus padres— el
// esquema queda exactamente igual de hondo que WEEK_PLAN_SCHEMA, que es la
// profundidad que ya usan la rutina y el plan por objetivo.
// ── POR QUÉ LAS DESCRIPCIONES DE AQUÍ SON TAN CORTAS ──
//
// El esquema viaja ENTERO en cada llamada y NO entra en la parte cacheada del
// prompt. Medido: 1726 tokens, de los cuales 894 eran descripciones — y las
// seis más caras repetían palabra por palabra reglas que ya están escritas en
// `planChatSystem`, que sí se cachea.
//
// Así que la regla larga vive en el prompt (se paga una vez y luego al 10%) y
// aquí queda solo el recordatorio corto que hace falta leyendo el campo. No se
// ha quitado ninguna regla: se ha quitado la COPIA.
//
// Si añades una regla nueva, escríbela en el prompt, no aquí.
const PLAN_CHAT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'ready', ...WEEK_PLAN_SCHEMA.required],
  properties: {
    reply: { type: 'string', description: 'Lo que le dices al usuario. Breve y de tú a tú. Si preguntas algo, que sean UNA o DOS preguntas cortas, nunca un cuestionario.' },
    ready: { type: 'boolean', description: 'true cuando el plan ya está montado y sirve. false mientras preguntas: en ese caso deja strength, protocols y nutrition como listas vacías y no te esfuerces en rellenarlas.' },
    ...WEEK_PLAN_SCHEMA.properties,
  },
};

/**
 * Lo ENTRENADO de verdad, en texto corto. "" si no hay nada.
 *
 * Va aparte de la agenda porque son dos cosas distintas: la agenda es lo que
 * está PREVISTO y el historial es lo que ha PASADO, incluido lo que se hizo sin
 * estar planificado. Mezclarlos haría imposible distinguir "tenía que hacerlo"
 * de "lo hice", que es justo la diferencia que importa.
 */
function historialComoTexto(historial) {
  if (!Array.isArray(historial) || historial.length === 0) return '';
  const NL = String.fromCharCode(10);
  return historial.slice(-14)
    .map((d) => '  ' + d.date + ': ' + String(d.text || '').slice(0, 200))
    .join(NL);
}

/**
 * Recorta sin partir un ejercicio por la mitad.
 *
 * Cortar a pelo por el carácter N deja cosas como "Elevaciones late", y el
 * modelo no tiene forma de saber que eso es un recorte y no el nombre: te
 * contesta sobre un ejercicio que no existe. Se corta por la última coma que
 * quepa y se dice expresamente que hay más.
 */
function recortarLimpio(texto, limite) {
  const s = String(texto || '');
  if (s.length <= limite) return s;
  const coma = s.lastIndexOf(', ', limite);
  // Si la primera coma ya se pasa del límite (un nombre larguísimo), se corta
  // por donde sea: es preferible a devolver la línea entera sin límite.
  return (coma > limite * 0.5 ? s.slice(0, coma) : s.slice(0, limite)) + '… (y alguno más)';
}

/** Convierte la agenda real en texto corto. Devuelve "" si no hay nada. */
function agendaComoTexto(agenda) {
  if (!Array.isArray(agenda) || agenda.length === 0) return '';
  const NL = String.fromCharCode(10);
  const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const lineas = agenda.slice(0, 40).map((d) => {
    const items = (d.items || []).slice(0, 8)
      // La fuerza tiene más sitio que lo demás, y no por capricho: un día de
      // fuerza son seis u ocho ejercicios con series y repeticiones, y con 200
      // caracteres se cortaba a la mitad. Es justo el dato que hace falta para
      // responder a "cámbiame el press por otro". Las actividades y las comidas
      // vienen ya recortadas a 120 desde el cliente, así que esto no las toca.
      .map((it) => '    - [' + it.kind + '] ' + recortarLimpio(it.text, it.kind === 'strength' ? 340 : 200) + (it.done ? '  ← YA ENTRENADO' : ''))
      .join(NL);
    return '  ' + d.date + ' (' + (DIAS[d.weekday] || '?') + ', semana ' + ((d.week || 0) + 1) + '):' + NL + items;
  });
  return lineas.join(NL);
}

/**
 * @param parcial true cuando la agenda viene PODADA (ver `compactarAgenda` en el
 *   cliente): solo trae lo ya entrenado y lo que no salió del plan, porque el
 *   resto viaja dentro del propio plan. Cambia lo que se le puede decir al
 *   modelo: una agenda podada NO es "todo lo que hay", y presentarla como tal
 *   le haría creer que los días que faltan están vacíos.
 */
function planChatSystem(profile, ctx, previous, agenda, historial, parcial) {
  const NL = String.fromCharCode(10);
  const kinds = (ctx.activityKinds || []).join(", ");
  const agendaTxt = agendaComoTexto(agenda);
  const histTxt = historialComoTexto(historial);
  const prev = previous
    ? "PLAN ACTUAL (el que ya está montado; si te piden un cambio, devuelve este MISMO plan con ese cambio aplicado y nada más tocado):" + NL + JSON.stringify(previous)
    : "Todavía no hay plan montado en esta conversación.";

  // El prompt se parte en dos a propósito.
  //
  // Todo lo de abajo —las reglas, los límites, la lista de ejercicios— es
  // IDÉNTICO en todos los turnos de la conversación, y son unos cuantos miles
  // de caracteres que se estaban pagando enteros una y otra vez. Marcado como
  // cacheable, del segundo turno en adelante cuesta una décima parte.
  //
  // El plan actual va aparte y SIN marcar porque cambia cada turno: metido
  // dentro del bloque cacheado invalidaría la caché en cada mensaje, que es
  // exactamente lo contrario de lo que se busca. Por eso se manda al final:
  // la caché solo funciona sobre un prefijo, así que lo variable va detrás.
  const estable = [
    "Eres el entrenador de RANKD montando el plan de alguien, hablando con él.",
    "",
    fighterContext(profile),
    "",
    "Contexto:",
    "- La PRIMERA semana empieza el LUNES " + ctx.weekStart + ". Días: 0 = lunes … 6 = domingo.",
    "- Hoy es " + ctx.today + ". No pongas nada en días que ya han pasado.",
    "- El plan cubre " + (ctx.weeks || 1) + " semana(s). Con más de una, escribe la estructura UNA vez y omite \"week\": omitirlo significa que se repite. Usa \"week\" solo en lo que progrese de verdad.",
    "- Tipos de actividad válidos para \"kind\": " + kinds + ".",
    "- Usa nombres de ejercicio de esta lista siempre que encajen: " + (ctx.exerciseNames || []).slice(0, 220).join(", ") + ".",
    "",
    "CÓMO TRABAJAS:",
    "",
    "1. QUÉ PREGUNTAR. Solo lo que de verdad cambie el plan y no puedas deducir:",
    "   cuántos días puede entrenar, cuánto rato tiene, si entrena en casa o en",
    "   gimnasio, si hay lesiones, y qué material tiene si hace falta.",
    "   NUNCA preguntes porcentaje de grasa, calorías que come, ni nada que una",
    "   persona normal no sepa de memoria. Si necesitas su peso y no lo tienes,",
    "   pídelo en kilos y ya está.",
    "   Una o dos preguntas por turno. Si con lo que tienes puedes montar algo",
    "   razonable, MÓNTALO y di el supuesto: \"lo he hecho contando con que...\".",
    "",
    "2. CUÁNDO MONTAR EL PLAN. En cuanto sepas los días y el tiempo. No esperes",
    "   a tenerlo todo: un plan que se puede corregir vale más que tres",
    "   preguntas más.",
    "",
    "2.ante. LA RUTINA, SIN EJERCICIOS SALVO QUE LOS PIDA. Si te dice \"hazme una",
    "   rutina push pull pierna\" o \"móntame la semana de fuerza\", devuelve los",
    "   DÍAS con lo que se trabaja en cada uno (\"Día 1: pecho, hombro y tríceps\")",
    "   y deja \"exercises\" VACÍO. Mucha gente ya sabe qué ejercicios hace y solo",
    "   quiere el reparto; ponérselos sin pedirlo le obliga a borrarlos.",
    "   Y en reply, ofrécelo en una línea: \"¿te los completo yo o los pones tú?\".",
    "   Solo cuando diga que sí —o cuando lo haya pedido de entrada— los pones.",
    "",
    "2.quater. PREGUNTA CUANDO NO CUADRE. Si lo que pide no encaja —cuatro días",
    "   de pierna seguidos, una hora de plan en veinte minutos, cardio duro el",
    "   día antes de competir— NO lo montes en silencio ni lo montes mal. Dilo en",
    "   una línea y propón la salida: \"así no te recuperas; te lo paso al jueves,",
    "   ¿lo hago?\". Eres su entrenador, no un formulario que obedece.",
    "",
    "2.bis. CUÁNDO **NO** DEVOLVER EL PLAN. Si el plan ya está montado y este",
    "   turno NO lo cambia —te preguntan por qué algo, te dan las gracias, te",
    "   dicen \"vale\", o pides tú un dato— pon ready:false y deja las listas",
    "   VACÍAS. La pantalla conserva el plan que ya tiene. Reescribirlo entero",
    "   para no cambiar nada tarda mucho y le cuesta dinero a quien lo usa.",
    "   Devuélvelo SOLO cuando lo hayas montado o lo hayas cambiado.",
    "",
    "2.ter. FOTOS. Puede mandarte una foto: la hoja de su plan, la pantalla de",
    "   una maquina, una tabla de un entrenador, un WhatsApp. Leela y trabaja",
    "   con lo que pone. Si te dice \"mejorame esto\", primero di en una linea",
    "   QUE has entendido que hay ahi, y despues monta el plan con tus cambios:",
    "   asi el sabe si has leido bien antes de fiarse. Lo que no se lea, di que",
    "   no se lee y preguntalo; no lo rellenes a ojo.",
    "",
    "3. CAMBIOS: SOLO LO QUE TE PIDE. Esto es lo que más se rompe, así que va",
    "   antes que nada. \"Cámbiame el cardio\" significa el cardio. La fuerza se",
    "   devuelve IDÉNTICA —mismos días, mismos nombres, mismos ejercicios, misma",
    "   lista vacía si estaba vacía—, y las comidas igual. Si el día de fuerza no",
    "   traía ejercicios, SIGUE sin traerlos: rellenarlos ahora es cambiar lo que",
    "   no te han tocado, y desde su lado es \"le pido el cardio y me monta fuerza\".",
    "   Copia, no rehagas. Y en reply di solo lo que has cambiado.",
    "",
    "3.bis. CAMBIOS (resto). Si te pide cambiar algo concreto (\"el jueves no puedo\",",
    "   \"cámbiame la cena del martes\"), devuelve el MISMO plan con ESE cambio.",
    "   No rehagas lo que no te han tocado. Si te pide que propongas tú, propón",
    "   UNA alternativa concreta y pregunta si la quiere.",
    "",
    "4. CÓMO HABLAS. Como un entrenador, no como un chatbot. Sin listas",
    "   interminables en `reply`: el plan ya se ve en pantalla, así que en",
    "   `reply` explica el CRITERIO —por qué ese reparto, qué esperar— en 3-6",
    "   líneas. Nada de repetir el plan en texto.",
    "",
    "LO QUE SABES Y UN CHATBOT GENÉRICO NO:",
    "- Para definir, lo que manda es el déficit y mantener la fuerza. El músculo",
    "  no se \"marca\" con más repeticiones: se marca perdiendo grasa mientras",
    "  sigues levantando pesado. No bajes las cargas para \"tonificar\".",
    "- La caminata en inclinación quema mucho sin apenas fatiga ni impacto, así",
    "  que no se come el entreno de fuerza del día siguiente. Por eso es la",
    "  herramienta buena cuando se entrena seis días.",
    "- El cardio largo y duro el mismo día que la pierna sabotea los dos.",
    "  Sepáralos o pon el suave.",
    "- Doble sesión: lo de calidad por la mañana (fuerza, técnica), lo aeróbico",
    "  por la tarde. Al revés se entrena la fuerza cansado.",
    "- El boxeo cansa más de lo que la gente cree: cuenta como día duro.",
    "",
    "HYROX, CROSSFIT Y FUNCIONAL. Si pide uno de estos, NO devuelvas \"45 min de",
    "funcional\": eso no se puede hacer ni comparar. Di de qué está hecha la",
    "sesión, en la nota del cardio:",
    "- HYROX es una prueba fija: 8 km repartidos en 8 tramos de 1 km, y entre",
    "  tramo y tramo una estación, SIEMPRE en este orden: skierg 1000 m, trineo",
    "  de empuje 50 m, trineo de arrastre 50 m, burpees con salto 80 m, remo",
    "  1000 m, farmers carry 200 m, zancadas con saco 100 m y 100 wall balls.",
    "  Para entrenarlo se trabajan COMPROMISOS: correr cansado justo después de",
    "  una estación (lo que mata la carrera), y la fuerza de agarre y de piernas",
    "  de trineos y zancadas. Di qué estaciones toca ese día y a qué ritmo.",
    "- CROSSFIT y FUNCIONAL van por FORMATO, no por minutos sueltos: AMRAP (las",
    "  rondas que dé en X min), EMOM (un bloque al empezar cada minuto), FOR",
    "  TIME (trabajo fijo lo antes posible, con tope), CHIPPER o TABATA. Di el",
    "  formato, los minutos y los movimientos con sus repeticiones y sus kilos:",
    "  \"AMRAP 12: 10 thrusters 40 kg + 12 dominadas\". Sin formato no hay WOD.",
    "- Y no metas un metcon duro el día antes de la pierna ni el día después:",
    "  compiten por lo mismo y las dos salen a medias.",
    "",
    "LÍMITES (no negociables):",
    "- No eres médico. Lesión seria, dolor que no baja o golpe en la cabeza: al",
    "  profesional, sin diagnosticar.",
    "- Nada de dietas muy bajas en calorías, ayunos extremos ni deshidratación,",
    "  ni aunque te lo pida. El déficit, moderado y sostenible.",
    "- Patología, embarazo, lactancia o señales de trastorno alimentario: con",
    "  tacto, derívalo a un médico o dietista colegiado y no des pautas ahí.",
    "- Nada de sustancias dopantes.",
    "",
    "",
    "ECONOMIA (importante): esto se genera en UNA sola respuesta y hay un limite",
    "de tiempo real. Se escueto en el JSON o no llegas a terminarlo:",
    "- 4-6 ejercicios por dia como mucho.",
    "- Los cardios van con sus minutos totales y UNA linea de intencion. El guion",
    "  minuto a minuto NO se escribe aqui: se monta despues, en su pantalla, con",
    "  sus columnas de inclinacion y velocidad. Una tirada de cifras sueltas en la",
    "  nota no se entiende ni se puede seguir encima de la cinta.",
    "- Un cardio pedido es UN cardio. \"45 minutos de cinta\" es una sesion de 45",
    "  minutos, no una de 20 en ayunas y otra de 25 por la tarde. Doblar solo si",
    "  lo pide el — y si pide dos sesiones, entonces son dos.",
    "- CUALQUIER numero que te de es EXACTO, y esto vale para todos: minutos,",
    "  dias, semanas, series, repeticiones, kilos, kilometros. 31 son 31, 42 son",
    "  42, 45 son 45. No redondees a la cifra bonita mas cercana ni lo repartas",
    "  en dos. Si te dice una cifra rara es porque tiene ese hueco o ese material:",
    "  cambiarsela por su cuenta es decidir por el sobre lo unico que el sabe",
    "  seguro. Si de verdad no cuadra, DILO y que decida el (ver 2.quater).",
    "- Y a la HORA que te diga. Si dice \"tengo 45 minutos por la tarde\", ese",
    "  cardio es de tarde. Da igual lo que rinda mas en ayunas: un entreno a una",
    "  hora a la que no puede es un entreno que no hace. Si crees que otra franja",
    "  le vendria mejor, dilo en reply y que decida el.",
    "- Comidas en una linea: \"pollo a la plancha con arroz y ensalada\".",
    "- Notas de una linea, y solo si aportan.",
    "El detalle largo va en reply, que no cuenta para el tamano del plan.",
    "",
    "Responde SIEMPRE en espanol.",
  ].join(NL);

  // La agenda va en el bloque VOLÁTIL, junto al plan: cambia en cuanto el
  // usuario toca un día, así que meterla en el cacheado invalidaría la caché
  // cada vez, que es justo lo contrario de para lo que está.
  const bloqueHist = histTxt
    ? [
      '',
      'LO QUE HA ENTRENADO DE VERDAD ESTOS DÍAS (incluido lo que hizo por su',
      'cuenta, sin estar planificado):',
      histTxt,
      'Úsalo para saber cómo llega: si lleva seis días seguidos, mete descanso;',
      'si lleva tres parado, no le montes la semana más dura del mes. Y no le',
      'digas que no ha hecho algo que aquí aparece hecho.',
    ].join(NL)
    : '';

  const volatil = agendaTxt
    ? [
      parcial
        ? 'DE SU AGENDA, SOLO LO QUE EL PLAN DE ABAJO NO DICE: lo que ya está entrenado y lo que él haya puesto o movido a mano. TODO LO DEMÁS de esos días está en el plan de abajo; que un día no salga aquí NO significa que esté vacío.'
        : 'LO QUE HAY PUESTO AHORA MISMO EN SU AGENDA. Esto es la VERDAD: manda sobre cualquier plan que recuerdes de la conversación, porque recoge también lo que él haya movido a mano.',
      agendaTxt,
      '',
      'CÓMO USARLA:',
      '- Si te pide cambiar UNA cosa ("reajústame el cardio de esta semana"),',
      '  devuelve el plan ENTERO: la fuerza y las comidas EXACTAMENTE como están',
      '  aquí arriba, y solo el cardio cambiado. Si devuelves solo el cardio, el',
      '  resto desaparece de su agenda.',
      '- Lo marcado YA ENTRENADO no se toca ni se mueve. Es un hecho, no una',
      '  intención. Si el cambio que pide chocara con un día ya entrenado, aplícalo',
      '  a partir del siguiente y dilo en una línea.',
      '- Nunca digas que no tienes un plan previo si aquí arriba hay algo: lo',
      '  tienes delante.',
      bloqueHist,
      '',
      prev,
    ].join(NL)
    : (bloqueHist ? bloqueHist + NL + NL + prev : prev);

  return [
    { type: 'text', text: estable, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: volatil },
  ];
}

function weekPlanSystem(profile, ctx, previous, adjustments) {
  const names = Array.isArray(ctx.exerciseNames) ? ctx.exerciseNames.slice(0, 400) : [];
  const kinds = Array.isArray(ctx.activityKinds) && ctx.activityKinds.length
    ? ctx.activityKinds.join(', ')
    : 'cinta, correr, bici, eliptica, remo, natacion, cuerda, boxeo, otro';

  const adjustBlock = (previous && adjustments)
    ? `

═══ AJUSTE PUNTUAL ═══
El peleador YA tiene este plan y ha pedido UN CAMBIO concreto. Devuelve el plan ENTERO con SOLO ese cambio aplicado: todo lo demás debe quedar EXACTAMENTE igual (mismos días, mismos ejercicios, mismos tramos, mismas comidas, mismas claves de protocolo).

Plan actual:
${JSON.stringify(previous).slice(0, 14000)}

Cambio que pide: "${adjustments}"

Reglas del ajuste:
- Toca solo lo que afecte a ese cambio. Si pide cambiar el cardio del jueves, la fuerza y las comidas NO se tocan.
- Si el cambio choca con algo que ya había pedido (una exclusión, los días disponibles), aplícalo igual y dilo en "summary".
- Mantén las mismas "key" de los protocolos que no cambian.`
    : '';

  return `Eres el Asesor de RANKD. Vas a resolver de UNA SOLA VEZ una petición que mezcla varios módulos: rutina de fuerza, uno o varios cardios con su guion por tramos, y pauta de comidas.

${fighterContext(profile)}

Contexto de la semana:
- La PRIMERA semana empieza el LUNES ${ctx.weekStart}. Los días van 0 = lunes … 6 = domingo.
- El plan cubre ${ctx.weeks || 1} semana(s).
  ${(ctx.weeks || 1) > 1 ? `IMPORTANTE: NO copies la misma estructura ${ctx.weeks} veces. Escribe la semana UNA sola vez y OMITE el campo "week": omitirlo ya significa "se repite todas las semanas". Usa "week" (0 = la primera) SOLO en lo que de verdad cambie de una semana a otra: una progresion de volumen, un cardio mas largo, una semana de descarga. Si no hay progresion, no pongas ningun "week".` : 'Es un plan de una sola semana: no uses el campo "week".'}
- Hoy es ${ctx.today}. NO coloques nada en días de esta semana que ya hayan pasado.
- Tipos de actividad válidos para "kind": ${kinds}.
${names.length ? `- Nombres de ejercicio disponibles (úsalos tal cual siempre que encajen, para que la app los reconozca):\n${names.join(' · ')}` : ''}

Cómo montas el plan:

1. DÍAS. Usa EXACTAMENTE los días que diga tener esta semana. Si dice "esta semana tengo 5", son 5 días de fuerza, no 4 ni 6. Si no lo dice, dedúcelo de lo que escriba y refléjalo en "training_days"; nunca asumas un número por costumbre. Reparte los días de forma sensata (sin dos días seguidos del mismo grupo) y empezando por el próximo día que no haya pasado.

2. EXCLUSIONES. Lo que diga que NO quiere es INNEGOCIABLE. Si dice "nada de boxeo ni fútbol", no aparece nada de eso aunque exista en la biblioteca. Copia sus exclusiones en "exclusions" con sus palabras, para que pueda comprobarlo de un vistazo.

3. FUERZA. Un elemento de "strength" por día, con su nombre, sus grupos y sus ejercicios ya con series y rango de repeticiones. Ajusta el planteamiento al objetivo que pida (hipertrofia → 3-4 series de 8-12 con poco descanso; fuerza → menos repeticiones; resistencia → más). 4-7 ejercicios por día.

4. CARDIOS. Un elemento de "protocols" por CADA cardio distinto que pida. Si pide tres, devuelve tres, cada uno con su nombre reconocible ("Cardio tarde — grasa", "Cardio mañana express", "Cardio post-entreno").
   - Si pide el detalle "minuto a minuto", devuelve un tramo POR MINUTO con su inclinación y su velocidad. No lo resumas en bloques de cinco si te ha pedido minuto a minuto.
   - Rellena solo las variables que apliquen a ese tipo: cinta → speed_kmh e incline_pct; bici y elíptica → resistance y cadence_rpm; natación → pace_sec_100m; remo → pace_sec_500m y stroke_rate; el resto → effort. Las demás, null.
   - La suma de los minutos de los tramos debe dar la duración que pidió.
   - Un cardio "para quemar grasa" en cinta es caminata con inclinación a intensidad sostenible, no series a tope: velocidades de 4,5 a 6,5 km/h e inclinaciones que suban y bajen entre 2 % y 12 %.
   - "weekdays" son los días en los que toca ese cardio. Un cardio post-entreno va en los días de fuerza; uno de mañana, en los que diga.

5. COMIDAS. Solo las franjas que pida. Si dice "el desayuno lo tengo resuelto", NO devuelvas desayunos. Si pide "comida y cena para 5 días", devuelve 5 días con esas dos franjas. Alimentos básicos, de supermercado y rápidos: si pide rapidez, que "minutes" sea de verdad bajo (10-20 min), no un guiso de una hora con la etiqueta de rápido.

6. HONESTIDAD. Si algo de lo que pide no te cuadra (le da para tres días y pide cinco, o pide bajar mucho peso en poco tiempo), hazlo lo mejor posible y DILO en "summary" en una línea. No calles el problema ni te niegues a dar el plan.

Límites:
- No eres médico ni dietista colegiado. Nada de dietas muy bajas en calorías, ayunos extremos ni deshidratación, aunque los pida.
- Si menciona una patología, embarazo o señales de trastorno de la conducta alimentaria, deja la parte de nutrición en pautas muy generales y recomiéndale un profesional en "summary".
- Nada de sustancias dopantes.
- Idioma: SIEMPRE español.${adjustBlock}`;
}

const FOOD_PHOTO_SYSTEM = `Eres un asistente nutricional especializado en deportes de combate. Analizas una foto de comida y das una estimación orientativa de sus macros.

Reglas:
- Estima cantidades y macros con criterio realista de raciones. La proteína y los carbohidratos aportan ~4 kcal/g y las grasas ~9 kcal/g: procura que las calorías sean coherentes con esos macros.
- Si un alimento no se identifica con claridad, inclúyelo igualmente con tu mejor estimación y nombre "desconocido".
- Si en la foto NO hay comida reconocible, devuelve la lista de alimentos vacía.
- Responde SIEMPRE en el idioma del usuario (por defecto español).`;

const FOOD_PHOTO_SCHEMA = {
  type: 'object',
  properties: {
    alimentos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          gramos: { type: 'number' },
          calorias: { type: 'number' },
          proteina: { type: 'number' },
          carbohidratos: { type: 'number' },
          grasas: { type: 'number' },
        },
        required: ['nombre', 'gramos', 'calorias', 'proteina', 'carbohidratos', 'grasas'],
        additionalProperties: false,
      },
    },
    total: {
      type: 'object',
      properties: {
        calorias: { type: 'number' },
        proteina: { type: 'number' },
        carbohidratos: { type: 'number' },
        grasas: { type: 'number' },
      },
      required: ['calorias', 'proteina', 'carbohidratos', 'grasas'],
      additionalProperties: false,
    },
    disclaimer: { type: 'string' },
  },
  required: ['alimentos', 'total', 'disclaimer'],
  additionalProperties: false,
};

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// MAX_IMAGE_CHARS está declarado arriba del todo: lo necesita también
// `sanitize`, que corre antes que esto en el fichero.
// Tope del texto pegado por el usuario en los importadores. Un PDF de rutina
// entero cabe de sobra; lo que no cabe es un libro.
const MAX_IMPORT_TEXT = 12_000;

/**
 * Construye el `content` de un mensaje que puede traer texto, imagen o ambos.
 *
 * Devuelve null cuando no hay nada válido que mandar: los importadores tienen
 * que responder 400 antes de gastar cuota, no llamar al modelo con las manos
 * vacías.
 */
function importContent({ text, imageBase64, mediaType }, prompt) {
  const parts = [];
  if (imageBase64) {
    const esPdf = mediaType === TIPO_PDF;
    if (!esPdf && !ALLOWED_IMAGE_TYPES.includes(mediaType)) {
      return { error: 'bad_image', message: 'Formato no válido. Sube un PDF o una foto JPEG, PNG o WebP.' };
    }
    if (imageBase64.length > MAX_IMAGE_CHARS) {
      return { error: 'image_too_large', message: esPdf ? 'El PDF debe pesar menos de 5MB.' : 'La foto debe pesar menos de 5MB.' };
    }
    const bloque = bloqueAdjunto(imageBase64, mediaType);
    if (!bloque) return { error: 'bad_image', message: 'No he podido leer ese archivo.' };
    parts.push(bloque);
  }
  const clean = typeof text === 'string' ? text.slice(0, MAX_IMPORT_TEXT).trim() : '';
  if (clean) parts.push({ type: 'text', text: `Documento:\n\n${clean}` });
  if (parts.length === 0) return { error: 'no_input', message: 'Pega el texto o sube una foto del documento.' };
  parts.push({ type: 'text', text: prompt });
  return { content: parts };
}

// ── Creator Studio: fábrica de contenido (solo admin) ──
// Mismo modelo/cuota que el resto de la IA, pero con dos guardas extra:
//   1. Solo el email de Ángel puede generar (comprobado ANTES de llamar al
//      modelo, para no gastar ni un token si alguien más encuentra el modo).
//   2. Los guiones de vídeo tienen tope de 5/día (las publicaciones y los
//      mensajes son ilimitados, como pide el encargo).
// El contexto de marca vive inline aquí (no se importa de src/) siguiendo el
// mismo criterio que la guía de marcas del asesor de Material: todo lo que
// alimenta un system prompt de la IA queda autocontenido en este archivo.
const ADMIN_EMAIL = 'angelpc2005@gmail.com';
const DAILY_VIDEO_LIMIT = 5;

function creatorStudioBrandContext() {
  return `Eres el redactor de contenido de marca de RANKD: la plataforma de peleadores, promotoras y marcas de deportes de combate para España y Latinoamérica.
Misión: dar a cada peleador (amateur o profesional) las mismas herramientas que un gimnasio grande — entrenamiento, nutrición, seguimiento y visibilidad ante promotoras y marcas. Disciplinas: Boxeo, MMA, Kickboxing, Muay Thai.

Identidad visual (referencia, no la describas salvo que se pida): negro (#030303/#0B0B0B), rojo (#E10600), oro (#C9A84C); titulares en Bebas Neue, cuerpo en Barlow Condensed.

Secciones del producto y su valor:
- Mi Esquina: el entrenador personal 24/7 (diario, peso, fuerza, nutrición, Coach IA).
- Oportunidades: combates, castings y colaboraciones publicados por organizaciones y marcas.
- Directorio de peleadores: perfiles verificados con récord real.
- Temporizador de asaltos: cronómetro de boxeo con combos por IA.
- Club/Gimnasios: vincula gimnasio y alumnos en un mismo panel.

Tono según destinatario: Peleador → directo y motivador, de tú a tú. Organización/Promotora → profesional y eficiente, habla de talento verificado. Marca → orientado a resultados y alcance de audiencia nicho. Gimnasio → cercano y práctico. Entrenador → técnico pero accesible.

Tono general: español de España por defecto salvo que se indique otro idioma; directo, sin relleno corporativo, cercano al mundo de los deportes de combate; nunca "hype" vacío — las afirmaciones se respaldan con lo que la plataforma realmente hace.`;
}

const VIDEO_SCRIPT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          startTime: { type: 'number' },
          endTime: { type: 'number' },
          action: { type: 'string', description: 'Qué ocurre en pantalla' },
          ui: { type: 'string', description: 'Qué pantalla/elemento de la app se ve' },
          text: { type: 'string', description: 'Texto en pantalla, corto e impactante' },
          transition: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['startTime', 'endTime', 'action', 'ui', 'text', 'transition', 'notes'],
        additionalProperties: false,
      },
    },
    caption: { type: 'string' },
    hashtags: { type: 'array', items: { type: 'string' } },
    musicSuggestion: { type: 'string' },
    cta: { type: 'string' },
  },
  required: ['title', 'scenes', 'caption', 'hashtags', 'musicSuggestion', 'cta'],
  additionalProperties: false,
};

const PUBLICATION_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    body: { type: 'string' },
    cta: { type: 'string' },
    hashtags: { type: 'array', items: { type: 'string' } },
    emoji: { type: 'string' },
  },
  required: ['headline', 'body', 'cta', 'hashtags', 'emoji'],
  additionalProperties: false,
};

const MESSAGE_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: ['string', 'null'], description: 'Solo si el canal es email; si no, null' },
    body: { type: 'string' },
    cta: { type: 'string' },
    tone: { type: 'string' },
    alternatives: { type: 'array', items: { type: 'string' }, description: '2-3 variantes alternativas del mensaje' },
  },
  required: ['subject', 'body', 'cta', 'tone', 'alternatives'],
  additionalProperties: false,
};

function creatorStudioSystem(kind, input) {
  const base = creatorStudioBrandContext();
  if (kind === 'videoScript') {
    return `${base}

Generas GUIONES DE VÍDEO corto (Reels/TikTok/Shorts) para promocionar RANKD. Devuelve un array de escenas con tiempos que sumen la duración pedida (${input.duration}s), texto en pantalla corto e impactante, y una sugerencia de música. CTA clara al final.
Plataforma: ${input.platform}. Incluir texto en pantalla: ${input.includeText}. Subtítulos: ${input.includeSubtitles}. Música: ${input.includeMusic}. CTA: ${input.includeCta}.`;
  }
  if (kind === 'publication') {
    return `${base}

Generas el COPY de una publicación para redes sociales (no el diseño visual, solo el texto). Formato: ${input.format}. Plataformas: ${(input.platforms || []).join(', ') || 'genérico'}. Tono pedido: ${input.tone}.
Incluir hashtags: ${input.includeHashtags}. Incluir emoji: ${input.includeEmoji}. Incluir CTA: ${input.includeCta}. Incluir menciones: ${input.includeMentions}.
Si no se piden hashtags, devuelve un array vacío. Si no se pide emoji, deja el campo emoji vacío.`;
  }
  if (kind === 'message') {
    return `${base}

Generas un MENSAJE para contactar o responder a alguien en nombre de Ángel (fundador de RANKD). Destinatario: ${input.recipientType}. Canal: ${input.channel} (ajusta la longitud: SMS/WhatsApp cortos, email más desarrollado). Tono: ${input.tone}.
${input.receivedMessage ? `El destinatario ha escrito esto y hay que RESPONDER: "${input.receivedMessage}"` : `Objetivo del mensaje: ${input.goal}`}
${input.context ? `Contexto adicional: ${input.context}` : ''}
Da 2-3 alternativas breves en "alternatives" además del mensaje principal en "body". "subject" solo si el canal es email.`;
  }
  // variation
  return `${base}

Genera una VARIANTE distinta del contenido "${input.type}" que se te da en JSON, manteniendo su intención pero cambiando el enfoque, ejemplos o estructura. Tipo de variación pedida: ${input.variationType}. Contenido original: ${JSON.stringify(input.original)}. Devuelve el mismo esquema de campos que el original.`;
}

function creatorStudioSchema(kind, input) {
  if (kind === 'videoScript') return { name: 'guion_video', schema: VIDEO_SCRIPT_SCHEMA };
  if (kind === 'publication') return { name: 'copy_publicacion', schema: PUBLICATION_SCHEMA };
  if (kind === 'message') return { name: 'mensaje', schema: MESSAGE_SCHEMA };
  // variation: mismo esquema que el tipo original
  if (input.type === 'video') return { name: 'guion_video', schema: VIDEO_SCRIPT_SCHEMA };
  if (input.type === 'publication') return { name: 'copy_publicacion', schema: PUBLICATION_SCHEMA };
  return { name: 'mensaje', schema: MESSAGE_SCHEMA };
}

export default async function handler(req, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Sonda de disponibilidad: el front la consulta al abrir la sección para
  // mostrar "próximamente" de entrada. NO gasta API (no llama a Claude).
  if (req.method === 'GET') {
    return res.status(200).json({ available: !!apiKey });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  if (!apiKey) {
    return res.status(503).json({ error: 'not_configured', message: 'La IA aún no está configurada en el servidor.' });
  }

  const {
    section, profile, messages, extract, timerCombos, foodPhoto, routinePhoto,
    creatorStudio, objectivePlan, protocolText, routineText, weekPlan, boxingSession, planChat,
    cardioDesign, agenda, historial,
  } = req.body || {};
  // Modos "estructurados": no usan `section` ni una conversación `messages`,
  // devuelven JSON validado. No deben pasar por las guardas de chat de abajo.
  const structuredMode = !!(objectivePlan || foodPhoto || routinePhoto || protocolText || routineText || weekPlan || boxingSession || planChat || cardioDesign);

  // ── CREATOR STUDIO: solo admin, gasto contabilizado aparte de las cuotas
  //    de Mi Esquina (section:'creator-studio' en ai_usage) ──
  if (creatorStudio) {
    const gate = await checkQuota(req);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.code, message: gate.message });
    }
    if ((gate.user.email || '').toLowerCase() !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'forbidden', message: 'Creator Studio es solo para administradores.' });
    }
    const { kind } = creatorStudio;
    if (!['videoScript', 'publication', 'message', 'variation'].includes(kind)) {
      return res.status(400).json({ error: 'bad_kind', message: 'Tipo de generación no válido.' });
    }
    if (kind === 'videoScript') {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const { count, error: countErr } = await gate.db.from('content_generated')
        .select('id', { count: 'exact', head: true })
        .eq('creator_id', gate.user.id).eq('type', 'video').gte('created_at', todayStart.toISOString());
      if (countErr) {
        return res.status(503).json({ error: 'limits_not_configured', message: 'No se pudo comprobar el límite diario de vídeos. Aplica la migración 0028.' });
      }
      if ((count || 0) >= DAILY_VIDEO_LIMIT) {
        return res.status(429).json({ error: 'daily_limit', message: `Has llegado al límite de ${DAILY_VIDEO_LIMIT} guiones de vídeo por hoy. Vuelve mañana.` });
      }
    }
    const anthropic = new Anthropic({ apiKey });
    try {
      const { schema } = creatorStudioSchema(kind, creatorStudio);
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: kind === 'videoScript' ? 2500 : 1200,
        system: creatorStudioSystem(kind, creatorStudio),
        messages: [{ role: 'user', content: creatorStudio.prompt || creatorStudio.goal || 'Genera el contenido pedido.' }],
        output_config: { format: { type: 'json_schema', schema } },
      });
      const text = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      let content;
      try { content = JSON.parse(text); } catch { content = null; }
      await recordUsage(gate.db, gate.user.id, 'creator-studio', 'chat', response.usage);
      if (!content) return res.status(422).json({ error: 'no_content', message: 'No se pudo generar el contenido. Prueba de nuevo.' });
      return res.status(200).json({ content, usage: response.usage });
    } catch (err) {
      console.error('[ia]', err?.status, err?.message);
      const e = iaError(err);
      return res.status(e.status).json({ error: 'ia_error', message: e.message });
    }
  }
  const buildSystem = SYSTEMS[section];
  if (!structuredMode && !buildSystem) return res.status(400).json({ error: 'Sección de IA no válida' });

  const clean = sanitize(messages);
  if (!structuredMode && (clean.length === 0 || clean[0].role !== 'user')) {
    return res.status(400).json({ error: 'La conversación debe empezar por el usuario' });
  }

  // ── CONTROL DE GASTO ──
  // Se comprueba ANTES de tocar el modelo. Si no se puede comprobar, no se
  // llama: es lo que garantiza que no haya consumo sin contabilizar.
  const gate = await checkQuota(req);
  if (!gate.ok) {
    return res.status(gate.status).json({
      error: gate.code, message: gate.message, used: gate.used, quota: gate.quota,
    });
  }

  const anthropic = new Anthropic({ apiKey });

  // ── MODO PLAN POR OBJETIVO ──
  // Genera un plan semanal completo a partir de un objetivo + respuestas
  // opcionales. Si `previous` viene, es una re-generación con ajustes: se
  // manda el plan previo entero al modelo para que lo modifique en vez de
  // rehacerlo. Cuenta como 1 turno de la cuota (kind='chat', section='training').
  if (objectivePlan) {
    const objective = String(objectivePlan.objective || '').trim().slice(0, 500);
    if (!objective) {
      return res.status(400).json({ error: 'bad_objective', message: 'Falta el objetivo del plan.' });
    }
    const answers = objectivePlan.answers || {};
    const previous = objectivePlan.previous || null;   // plan anterior si es refine
    const adjustments = String(objectivePlan.adjustments || '').trim().slice(0, 500) || null;
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system: objectivePlanSystem(profile || {}, objective, answers, previous, adjustments),
        messages: [{ role: 'user', content: previous && adjustments
          ? `Aquí tienes el objetivo, mi plan actual y los ajustes que quiero. Devuelve el plan entero con los ajustes aplicados.`
          : `Genera el plan semanal para mi objetivo.` }],
        output_config: { format: { type: 'json_schema', schema: OBJECTIVE_PLAN_SCHEMA } },
      });
      const text = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      let plan;
      try { plan = JSON.parse(text); } catch { plan = null; }
      await recordUsage(gate.db, gate.user.id, 'training', 'chat', response.usage);
      if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) {
        return res.status(422).json({ error: 'no_plan', message: 'No he podido generar un plan concreto. Prueba a especificar más el objetivo.' });
      }
      return res.status(200).json({ plan, usage: response.usage });
    } catch (err) {
      console.error('[ia]', err?.status, err?.message);
      const e = iaError(err);
      return res.status(e.status).json({ error: 'ia_error', message: e.message });
    }
  }

  // ── MODO FOTO DE COMIDA: imagen → estimación de macros ──
  // Cuenta como un turno normal de la cuota. Devuelve JSON validado.
  if (foodPhoto) {
    const { imageBase64, mediaType } = foodPhoto || {};
    if (!imageBase64 || !ALLOWED_IMAGE_TYPES.includes(mediaType)) {
      return res.status(400).json({ error: 'bad_image', message: 'Formato de imagen no válido. Usa JPEG, PNG o WebP.' });
    }
    if (imageBase64.length > MAX_IMAGE_CHARS) {
      return res.status(413).json({ error: 'image_too_large', message: 'La foto debe pesar menos de 5MB.' });
    }
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1200,
        system: FOOD_PHOTO_SYSTEM,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: 'Analiza esta foto de comida y estima los macros.' },
          ],
        }],
        output_config: { format: { type: 'json_schema', schema: FOOD_PHOTO_SCHEMA } },
      });
      const text = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      let analysis;
      try { analysis = JSON.parse(text); } catch { analysis = null; }
      await recordUsage(gate.db, gate.user.id, 'nutrition', 'chat', response.usage);
      if (!analysis || !Array.isArray(analysis.alimentos) || !analysis.total) {
        return res.status(422).json({ error: 'no_food', message: 'No he podido identificar la comida. Prueba con una foto más clara.' });
      }
      if (!analysis.disclaimer) {
        analysis.disclaimer = 'Esta es una estimación orientativa. Para precisión, usa una balanza de cocina.';
      }
      return res.status(200).json({ analysis, usage: response.usage });
    } catch (err) {
      console.error('[ia]', err?.status, err?.message);
      const e = iaError(err);
      return res.status(e.status).json({ error: 'ia_error', message: e.message });
    }
  }

  // ── MODO IMPORTAR RUTINA: foto de un plan → plan estructurado ──
  // Devuelve el mismo formato que el plan por objetivo (weeks/days) para pasar
  // por la misma pantalla de revisión. Cuenta como 1 turno (section='training').
  if (routinePhoto) {
    const { imageBase64, mediaType } = routinePhoto || {};
    const esPdfRutina = mediaType === TIPO_PDF;
    if (!imageBase64 || (!esPdfRutina && !ALLOWED_IMAGE_TYPES.includes(mediaType))) {
      return res.status(400).json({ error: 'bad_image', message: 'Formato no válido. Sube un PDF o una foto JPEG, PNG o WebP.' });
    }
    if (imageBase64.length > MAX_IMAGE_CHARS) {
      return res.status(413).json({ error: 'image_too_large', message: esPdfRutina ? 'El PDF debe pesar menos de 5MB.' : 'La foto debe pesar menos de 5MB.' });
    }
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system: ROUTINE_PHOTO_SYSTEM,
        messages: [{
          role: 'user',
          content: [
            bloqueAdjunto(imageBase64, mediaType),
            { type: 'text', text: 'Lee este plan de entrenamiento y devuélvelo estructurado. No inventes nada que no esté en el documento.' },
          ],
        }],
        output_config: { format: { type: 'json_schema', schema: OBJECTIVE_PLAN_SCHEMA } },
      });
      const text = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      let plan;
      try { plan = JSON.parse(text); } catch { plan = null; }
      await recordUsage(gate.db, gate.user.id, 'training', 'chat', response.usage);
      if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) {
        return res.status(422).json({ error: 'no_plan', message: 'No he podido leer un plan en esa foto. Prueba con una imagen más nítida o mételo a mano.' });
      }
      return res.status(200).json({ plan, usage: response.usage });
    } catch (err) {
      console.error('[ia]', err?.status, err?.message);
      const e = iaError(err);
      return res.status(e.status).json({ error: 'ia_error', message: e.message });
    }
  }

  // ── MODO PROTOCOLO DE ACTIVIDAD (punto 16) ──
  // Texto pegado o foto de una tabla por tramos → protocolo estructurado. Vale
  // para cualquier tipo de actividad: el front dice qué variables admite ese
  // tipo y el modelo se ciñe a ellas. Cuenta como 1 turno (section='training').
  if (protocolText) {
    const kind = String(protocolText.kind || 'otro').slice(0, 40);
    const built = importContent(protocolText, 'Transcribe este documento a tramos. No inventes ningún valor que no aparezca.');
    if (built.error) {
      return res.status(built.error === 'image_too_large' ? 413 : 400).json({ error: built.error, message: built.message });
    }
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system: protocolSystem(kind, protocolText.variables),
        messages: [{ role: 'user', content: built.content }],
        output_config: { format: { type: 'json_schema', schema: PROTOCOL_SCHEMA } },
      });
      const text = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      let protocol;
      try { protocol = JSON.parse(text); } catch { protocol = null; }
      await recordUsage(gate.db, gate.user.id, 'training', 'chat', response.usage);
      if (!protocol || !Array.isArray(protocol.segments) || protocol.segments.length === 0) {
        return res.status(422).json({ error: 'no_protocol', message: 'No he podido leer una sesión por tramos en ese documento. Revísalo o mete los tramos a mano.' });
      }
      return res.status(200).json({ protocol, usage: response.usage });
    } catch (err) {
      console.error('[ia]', err?.status, err?.message);
      const e = iaError(err);
      return res.status(e.status).json({ error: 'ia_error', message: e.message });
    }
  }

  // ── MODO DISEÑAR CARDIO MINUTO A MINUTO ──
  if (cardioDesign) {
    const kind = String(cardioDesign.kind || 'otro').slice(0, 40);
    const minutes = Math.max(5, Math.min(180, parseInt(cardioDesign.minutes, 10) || 30));
    const intent = String(cardioDesign.intent || '').slice(0, 400);
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 3000,
        system: cardioDesignSystem(profile, kind, minutes, intent, cardioDesign.variables),
        messages: [{ role: 'user', content: 'Escríbeme el guion de esa sesión, tramo a tramo.' }],
        output_config: { format: { type: 'json_schema', schema: PROTOCOL_SCHEMA } },
      });
      const text = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      let protocol;
      try { protocol = JSON.parse(text); } catch { protocol = null; }
      await recordUsage(gate.db, gate.user.id, 'training', 'chat', response.usage);
      if (!protocol || !Array.isArray(protocol.segments) || protocol.segments.length === 0) {
        return res.status(422).json({ error: 'no_protocol', message: 'No he podido montar el guion de ese cardio. Vuelve a intentarlo.' });
      }
      return res.status(200).json({ protocol, usage: response.usage });
    } catch (err) {
      console.error('[ia]', err?.status, err?.message);
      const e = iaError(err);
      return res.status(e.status).json({ error: 'ia_error', message: e.message });
    }
  }

  // ── MODO RUTINA PREESCRITA (punto 17) ──
  // Texto pegado o foto de una rutina de gimnasio → días con ejercicios,
  // series y repeticiones, listos para el checklist en vivo.
  if (routineText) {
    const built = importContent(routineText, 'Transcribe esta rutina a días y ejercicios. No añadas nada que no aparezca.');
    if (built.error) {
      return res.status(built.error === 'image_too_large' ? 413 : 400).json({ error: built.error, message: built.message });
    }
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 5000,
        system: ROUTINE_TEXT_SYSTEM,
        messages: [{ role: 'user', content: built.content }],
        output_config: { format: { type: 'json_schema', schema: ROUTINE_SCHEMA } },
      });
      const text = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      let routine;
      try { routine = JSON.parse(text); } catch { routine = null; }
      await recordUsage(gate.db, gate.user.id, 'training', 'chat', response.usage);
      if (!routine || !Array.isArray(routine.days) || routine.days.length === 0) {
        return res.status(422).json({ error: 'no_routine', message: 'No he podido leer una rutina en ese documento. Revísalo o métela a mano.' });
      }
      return res.status(200).json({ routine, usage: response.usage });
    } catch (err) {
      console.error('[ia]', err?.status, err?.message);
      const e = iaError(err);
      return res.status(e.status).json({ error: 'ia_error', message: e.message });
    }
  }

  // ── MODO PLAN HABLANDO ──
  // Una conversación que además devuelve el plan. Sustituye a las dos pantallas
  // de formulario que había antes; ver PLAN_CHAT_SCHEMA para el porqué.
  // Cuenta como 1 turno de la cuota (section='training').
  if (planChat) {
    const historia = Array.isArray(planChat.messages) ? planChat.messages.slice(-14) : [];
    if (historia.length === 0) {
      return res.status(400).json({ error: 'bad_request', message: 'Cuéntame qué plan quieres.' });
    }
    const ctx = {
      weekStart: String(planChat.weekStart || '').slice(0, 10),
      today: String(planChat.today || '').slice(0, 10),
      weeks: Math.max(1, Math.min(6, parseInt(planChat.weeks, 10) || 1)),
      exerciseNames: planChat.exerciseNames,
      activityKinds: planChat.activityKinds,
    };
    const mensajes = limitarFotos(historia)
      // Un mensaje sin texto vale si trae foto: mandar la hoja del plan sin
      // escribir nada es una forma normal de pedir que te lo mejore.
      .filter((m) => m && typeof m.content === 'string' && (m.content.trim() || m.image?.base64))
      .map((m) => {
        const role = m.role === 'assistant' ? 'assistant' : 'user';
        return { role, content: contenidoDeMensaje({ ...m, role }) };
      });

    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: planChatSystem(profile || {}, ctx, planChat.previous || null, planChat.agenda, planChat.historial, !!planChat.agendaParcial),
        messages: cachearConversacion(mensajes),
        output_config: { format: { type: 'json_schema', schema: PLAN_CHAT_SCHEMA } },
      });
      const text = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      let out;
      try { out = JSON.parse(text); } catch { out = null; }
      await recordUsage(gate.db, gate.user.id, 'training', 'chat', response.usage);
      if (!out || typeof out.reply !== 'string') {
        return res.status(422).json({ error: 'no_reply', message: 'No he podido montarlo. Prueba a decírmelo de otra forma.' });
      }
      // El plan viene desgranado en la raíz: se vuelve a juntar aquí para que
      // el cliente reciba la misma forma de siempre y no se entere del cambio.
      const { reply, ready, ...plan } = out;
      // Sin `ready` no hay plan: mientras pregunta, las listas vienen vacías y
      // colarlo borraría de la pantalla el plan bueno que ya estuviera montado.
      const listo = ready === true
        && ((plan.strength || []).length > 0 || (plan.protocols || []).length > 0);
      return res.status(200).json({ reply, plan: listo ? plan : null, usage: response.usage });
    } catch (err) {
      console.error('[ia]', err?.status, err?.message);
      const e = iaError(err);
      return res.status(e.status).json({ error: 'ia_error', message: e.message });
    }
  }

  // ── MODO ENTRENO DE BOXEO POR ASALTOS (punto 28) ──
  // El usuario dice de cuánto tiempo dispone y dónde entrena; sale la sesión
  // entera estructurada en asaltos, con la configuración lista para que el
  // temporizador del Ring arranque sin que nadie teclee nada.
  // Cuenta como 1 turno de la cuota (section='training').
  if (boxingSession) {
    const minutes = Math.max(10, Math.min(180, parseInt(boxingSession.minutes, 10) || 45));
    const place = ['gym', 'home_bag', 'home'].includes(boxingSession.place) ? boxingSession.place : 'home';
    const extra = String(boxingSession.notes || '').slice(0, 600);
    // El perfil ya NO va aquí: ahora lo pone `boxingSystem` en el system, que es
    // su sitio. Dejarlo en los dos lo mandaría dos veces — se pagaría dos veces
    // y el modelo leería el mismo bloque repetido.
    const peticion = [
      'Prepárame una sesión de boxeo de ' + minutes + ' minutos.',
      extra ? 'Ten en cuenta además: ' + extra : '',
    ].filter(Boolean).join(String.fromCharCode(10));

    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system: boxingSystem(profile || {}, place, minutes, agenda),
        messages: [{ role: 'user', content: peticion }],
        output_config: { format: { type: 'json_schema', schema: BOXING_SCHEMA } },
      });
      const text = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      let session;
      try { session = JSON.parse(text); } catch { session = null; }
      await recordUsage(gate.db, gate.user.id, 'training', 'chat', response.usage);
      if (!session || !Array.isArray(session.script) || session.script.length === 0) {
        return res.status(422).json({ error: 'no_boxing', message: 'No he podido montar la sesión. Prueba a decirme otra vez de cuánto tiempo dispones.' });
      }
      return res.status(200).json({ session, usage: response.usage });
    } catch (err) {
      console.error('[ia]', err?.status, err?.message);
      const e = iaError(err);
      return res.status(e.status).json({ error: 'ia_error', message: e.message });
    }
  }

  // ── MODO PLAN SEMANAL MULTI-MÓDULO (punto 21) ──
  // Una petición → fuerza por día + N protocolos de cardio + comidas. El mismo
  // modo resuelve los ajustes puntuales: con `previous` + `adjustments` se le
  // manda el plan entero y devuelve el mismo con ese cambio aplicado.
  // Cuenta como 1 turno de la cuota (section='training').
  if (weekPlan) {
    const request = String(weekPlan.request || '').trim().slice(0, 4000);
    const adjustments = String(weekPlan.adjustments || '').trim().slice(0, 600) || null;
    const previous = weekPlan.previous || null;

    if (!request && !adjustments) {
      return res.status(400).json({ error: 'bad_request', message: 'Cuéntame qué quieres para esta semana.' });
    }
    const ctx = {
      weekStart: String(weekPlan.weekStart || '').slice(0, 10),
      today: String(weekPlan.today || '').slice(0, 10),
      // Duracion pedida, recortada a 1-6. Sin esto el contexto no la llevaba y
      // el prompt hablaba siempre de UNA semana, dijera el usuario lo que
      // dijera: pedir dos devolvia una y a nadie le cuadraba por que.
      weeks: Math.max(1, Math.min(6, parseInt(weekPlan.weeks, 10) || 1)),
      exerciseNames: weekPlan.exerciseNames,
      activityKinds: weekPlan.activityKinds,
    };
    if (!ctx.weekStart || !ctx.today) {
      return res.status(400).json({ error: 'bad_week', message: 'Falta la semana sobre la que planificar.' });
    }

    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        // El plan entero (fuerza de 5 días + tres cardios minuto a minuto + 10
        // comidas) es mucho JSON: un tope corto lo cortaría por la mitad.
        max_tokens: 16000,
        system: weekPlanSystem(profile || {}, ctx, previous, adjustments),
        messages: [{
          role: 'user',
          content: previous && adjustments
            ? `Aquí tienes mi plan y el cambio que quiero. Devuélvemelo entero con ese cambio aplicado.`
            : request,
        }],
        output_config: { format: { type: 'json_schema', schema: WEEK_PLAN_SCHEMA } },
      });
      const text = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      let plan;
      try { plan = JSON.parse(text); } catch { plan = null; }
      await recordUsage(gate.db, gate.user.id, 'training', 'chat', response.usage);

      const empty = !plan
        || ((plan.strength || []).length === 0
          && (plan.protocols || []).length === 0
          && (plan.nutrition || []).length === 0);
      if (empty) {
        return res.status(422).json({ error: 'no_plan', message: 'No he podido montar un plan con eso. Dime cuántos días tienes y qué quieres en cada uno.' });
      }
      return res.status(200).json({ plan, usage: response.usage });
    } catch (err) {
      console.error('[ia]', err?.status, err?.message);
      const e = iaError(err);
      return res.status(e.status).json({ error: 'ia_error', message: e.message });
    }
  }

  // ── MODO EXTRAER: convierte el plan en JSON para guardarlo ──
  if (extract) {
    const cfg = EXTRACT_SCHEMAS[section];
    if (!cfg) return res.status(400).json({ error: 'Esta sección no genera planes guardables' });
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2000,
        system: `Extrae el plan concreto que se ha acordado en esta conversación y devuélvelo estructurado. Reglas:
- Usa SOLO lo que aparece en la conversación; no inventes sesiones ni comidas que no se hayan propuesto.
- day_offset 0 es hoy. Si el plan habla de "lunes/martes...", reparte los días de forma coherente empezando por el próximo día que corresponda.
- Si la conversación no contiene un plan concreto, devuelve la lista vacía.`,
        messages: [...clean, { role: 'user', content: 'Extrae el plan acordado en formato estructurado.' }],
        output_config: { format: { type: 'json_schema', schema: cfg.schema } },
      });
      const text = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      let plan;
      try { plan = JSON.parse(text); } catch { plan = null; }
      // La extracción también cuesta: se contabiliza para que el coste real
      // aparezca en el panel, pero NO gasta cuota de mensajes del usuario.
      await recordUsage(gate.db, gate.user.id, section, 'extract', response.usage);
      if (!plan) return res.status(422).json({ error: 'no_plan', message: 'No he podido leer un plan concreto de la conversación.' });
      return res.status(200).json({ plan, usage: response.usage });
    } catch (err) {
      console.error('[ia]', err?.status, err?.message);
      const e = iaError(err);
      return res.status(e.status).json({ error: 'ia_error', message: e.message });
    }
  }

  // ── MODO COMBINACIONES DEL TEMPORIZADOR ──
  // Reparte una combinación por asalto y las devuelve como texto listo para
  // cargarse en el temporizador. Cuenta como un turno normal de la cuota.
  if (timerCombos) {
    const rounds = Math.max(1, Math.min(30, Number(timerCombos.rounds) || 3));
    const DISC = { boxing: 'boxeo', mma: 'MMA', kickboxing: 'kickboxing', muay_thai: 'Muay Thai' };
    const disc = DISC[timerCombos.discipline] || 'boxeo';
    const ask = String(timerCombos.prompt || '').slice(0, 500);
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 900,
        system: `Eres el entrenador de IA de RANKD. Genera EXACTAMENTE ${rounds} combinaciones de ${disc}, una por asalto.
Reglas estrictas:
- Cada combinación es SOLO la secuencia de golpes en notación de gimnasio, separada por comas (ej. "jab, cross, gancho izquierdo" o "jab al cuerpo, cross, salgo lateral").
- Nada de numeración, títulos ni explicaciones: solo la secuencia.
- Varía las combinaciones entre asaltos; adáptalas al nivel y a lo que pida el usuario.
${ask ? `- El usuario quiere trabajar: ${ask}` : ''}
Responde en el idioma del usuario (por defecto español).`,
        messages: [...clean, { role: 'user', content: `Dame ${rounds} combinaciones, una por asalto.` }],
        output_config: { format: { type: 'json_schema', schema: {
          type: 'object',
          properties: { combos: { type: 'array', description: 'Una combinación por asalto', items: { type: 'string' } } },
          required: ['combos'], additionalProperties: false,
        } } },
      });
      const text = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      let out;
      try { out = JSON.parse(text); } catch { out = null; }
      await recordUsage(gate.db, gate.user.id, section, 'chat', response.usage);
      const combos = Array.isArray(out?.combos) ? out.combos.filter((c) => typeof c === 'string' && c.trim()).map((c) => c.trim()) : [];
      if (combos.length === 0) return res.status(422).json({ error: 'no_combos', message: 'No se pudieron generar combinaciones.' });
      return res.status(200).json({ combos });
    } catch (err) {
      console.error('[ia]', err?.status, err?.message);
      const e = iaError(err);
      return res.status(e.status).json({ error: 'ia_error', message: e.message });
    }
  }

  // ── MODO STREAMING: la respuesta va apareciendo token a token ──
  try {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // evita buffering en proxies

    // ── BÚSQUEDA WEB: solo en Material y solo si al usuario le quedan búsquedas ──
    // Falla cerrado: si la migración 0015 no está, searchesQuota es undefined y
    // no se activa nada (el asesor responde con su guía de marcas, sin gastar).
    const searchRemaining = (typeof gate.searchesQuota === 'number')
      ? Math.max(0, gate.searchesQuota - (gate.searchesUsed || 0))
      : 0;
    const canSearch = section === 'gear' && searchRemaining > 0;

    let systemPrompt = buildSystem(profile || {});
    // 2000 y no 1500: con fotos, una respuesta que primero dice qué ha leído en
    // la imagen y luego contesta se quedaba a medias y se cortaba en seco.
    const params = { model: MODEL, max_tokens: 2000, messages: cachearConversacion(clean) };
    if (canSearch) {
      systemPrompt += '\n\n' + GEAR_SEARCH_ADDENDUM;
      params.tools = [{
        type: 'web_search_20260209',
        name: 'web_search',
        // Nunca más búsquedas por turno que las que le quedan en el mes.
        max_uses: Math.min(SEARCHES_PER_TURN, searchRemaining),
        // Sesga precios y tiendas a España (resultados en euros).
        user_location: { type: 'approximate', country: 'ES', timezone: 'Europe/Madrid' },
      }];
    }
    // El prompt va marcado como cacheable, que ahora sí compensa.
    //
    // Cuando se midió la primera vez, los cuatro prompts de sección se quedaban
    // entre 500 y 800 tokens y el mínimo cacheable son 1024: marcarlo no habría
    // ahorrado nada. Al darle criterio propio a Consulta, el suyo se ha ido a
    // ~1400 y ya pasa de sobra — y Consulta es la sección que de verdad se usa.
    //
    // Los otros tres siguen por debajo del mínimo. Marcarlos no hace daño: un
    // prefijo demasiado corto sencillamente no se cachea, no da error. Y el día
    // que alguno crezca, empieza a ahorrar solo.
    //
    // La agenda va en un SEGUNDO bloque, sin marcar: cambia en cuanto el usuario
    // toca un día, y metida dentro del cacheado invalidaría la caché en cada
    // mensaje, que es exactamente lo contrario de para lo que está.
    const agendaTxt = agendaComoTexto(agenda);
    const histTxt = historialComoTexto(historial);
    params.system = [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }];
    if (histTxt) {
      params.system.push({
        type: 'text',
        text: 'LO QUE HA ENTRENADO ESTOS DÍAS:' + String.fromCharCode(10) + histTxt
          + String.fromCharCode(10) + 'No le digas que no ha hecho algo que aquí aparece hecho.',
      });
    }
    if (agendaTxt) {
      params.system.push({
        type: 'text',
        text: [
          'LO QUE TIENE PUESTO ESTOS DÍAS (hoy es ' + new Date().toISOString().slice(0, 10) + '):',
          agendaTxt,
          '',
          'Úsalo cuando cambie la respuesta: qué cenar depende de si hoy le toca',
          'pierna o descanso, y si le da tiempo a algo depende de lo que ya tenga.',
          'Lo marcado YA ENTRENADO está hecho, no se lo propongas otra vez. Y no se',
          'lo recites si no viene a cuento: es contexto, no un parte.',
        ].join(String.fromCharCode(10)),
      });
    }

    const stream = anthropic.messages.stream(params);

    stream.on('text', (delta) => {
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    });

    // Avisa al front en cuanto el modelo lanza una búsqueda, para mostrar
    // "buscando precios..." mientras aún no ha llegado texto.
    if (canSearch) {
      stream.on('streamEvent', (event) => {
        if (event?.type === 'content_block_start'
            && event.content_block?.type === 'server_tool_use'
            && event.content_block?.name === 'web_search') {
          res.write(`data: ${JSON.stringify({ searching: true })}\n\n`);
        }
      });
    }

    const final = await stream.finalMessage();
    const searchCount = final.usage?.server_tool_use?.web_search_requests || 0;
    await recordUsage(gate.db, gate.user.id, section, 'chat', final.usage, canSearch ? searchCount : undefined);

    // Se devuelve la cuota ya actualizada para que el front avise al usuario
    // cuando se acerque al tope, sin tener que consultarlo aparte.
    const usedAfter = (gate.used || 0) + 1;
    res.write(`data: ${JSON.stringify({
      done: true, usage: final.usage,
      quota: { used: usedAfter, quota: gate.quota, warnAtPct: gate.warnAtPct },
    })}\n\n`);
    res.end();
  } catch (err) {
    // Si aún no hemos enviado cabeceras, respondemos JSON normal
    if (!res.headersSent) {
      console.error('[ia]', err?.status, err?.message);
      const e = iaError(err);
      return res.status(e.status).json({ error: 'ia_error', message: e.message });
    }
    res.write(`data: ${JSON.stringify({ error: 'No se pudo completar la respuesta.' })}\n\n`);
    res.end();
  }
}
