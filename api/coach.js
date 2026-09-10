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

const MODEL = 'claude-opus-4-8';

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
- DIRECTO Y CORTO. Esto es una consulta, no un plan: 3-8 líneas bastan casi siempre. Si la respuesta pide más, da lo esencial y ofrece desarrollarlo ("si quieres te lo desgloso").
- CONCRETO. "Con eso te haces una tortilla de tres huevos con la patata cocida y un puñado de espinacas" sirve; "procura incluir proteína de calidad" no sirve.
- Usa lo que ya sabes de él (arriba) sin repetírselo: si sabes su peso y su disciplina, la respuesta ya viene ajustada sin tener que anunciarlo.
- MANTÉN EL HILO. Si pregunta por algo que acabas de decir, continúa desde ahí; no vuelvas a empezar ni repitas lo ya dicho.
- Si la pregunta es ambigua y la respuesta cambia mucho según el caso, haz UNA pregunta corta y espera. Una, no un cuestionario.
- Si no tienes suficiente información pero puedes dar una respuesta útil con un supuesto razonable, DALA diciendo el supuesto. Es mejor que un interrogatorio.
- TÉCNICA EN VÍDEO: cuando expliques un gesto técnico o un ejercicio concreto, añade justo después el marcador EXACTO [VIDEO: nombre del gesto] — por ejemplo "el gancho al hígado [VIDEO: gancho al higado boxeo tecnica]". NO inventes URLs. Máximo 2 por respuesta.
- Si lo que pregunta encaja mejor en una herramienta que ya tiene, dilo en una línea AL FINAL y sigue habiendo respondido: protocolos de cardio por tramos y rutinas preescritas en Actividad y Fuerza, plan de comidas en Nutrición, plan por objetivo en el propio Asesor, cronómetro de asaltos en el Temporizador.

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

function sanitize(messages) {
  return (messages || [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
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
    training_days: { type: 'integer', description: 'Días de entreno que el usuario ha dicho tener ESTA semana. Si no lo dice, dedúcelo del texto; nunca inventes un número fijo.' },
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
          name: { type: 'string', description: 'Nombre del día ("Espalda y pecho", "Push", "Pierna").' },
          groups: { type: 'array', description: 'Grupos musculares principales del día.', items: { type: 'string', enum: MUSCLE_GROUPS } },
          note: { type: ['string', 'null'] },
          exercises: { type: 'array', items: WEEK_EXERCISE_SCHEMA },
        },
        required: ['weekday', 'name', 'groups', 'note', 'exercises'],
        additionalProperties: false,
      },
    },
    protocols: {
      type: 'array',
      description: 'Un elemento por CADA cardio distinto que haya pedido. Si pide tres (tarde, mañana y post-entreno), devuelve tres.',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Identificador corto y único dentro del plan ("cardio_tarde").' },
          name: { type: 'string', description: 'Nombre con el que lo va a ver en Actividad ("Cardio tarde — grasa").' },
          kind: { type: 'string', description: 'Tipo de actividad: cinta, correr, bici, eliptica, remo, natacion, cuerda, boxeo u otro.' },
          when: { type: 'string', enum: ['morning', 'midday', 'afternoon', 'evening'] },
          weekdays: { type: 'array', description: 'Días (0 = lunes) en los que toca este cardio.', items: { type: 'integer' } },
          note: { type: ['string', 'null'] },
          segments: { type: 'array', description: 'Los tramos, en orden. Minuto a minuto si el usuario lo pide así.', items: WEEK_SEGMENT_SCHEMA },
        },
        required: ['key', 'name', 'kind', 'when', 'weekdays', 'note', 'segments'],
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
  required: ['summary', 'disclaimer', 'training_days', 'exclusions', 'strength', 'protocols', 'nutrition'],
  additionalProperties: false,
};

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
- La semana empieza el LUNES ${ctx.weekStart}. Los días van 0 = lunes … 6 = domingo.
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
// ~5MB en base64 ≈ 6.8M caracteres. Defensa del servidor.
const MAX_IMAGE_CHARS = 7_000_000;
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
    if (!ALLOWED_IMAGE_TYPES.includes(mediaType)) return { error: 'bad_image', message: 'Formato de imagen no válido. Usa JPEG, PNG o WebP.' };
    if (imageBase64.length > MAX_IMAGE_CHARS) return { error: 'image_too_large', message: 'La foto debe pesar menos de 5MB.' };
    parts.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } });
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
    creatorStudio, objectivePlan, protocolText, routineText, weekPlan,
  } = req.body || {};
  // Modos "estructurados": no usan `section` ni una conversación `messages`,
  // devuelven JSON validado. No deben pasar por las guardas de chat de abajo.
  const structuredMode = !!(objectivePlan || foodPhoto || routinePhoto || protocolText || routineText || weekPlan);

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
      const { name, schema } = creatorStudioSchema(kind, creatorStudio);
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: kind === 'videoScript' ? 2500 : 1200,
        system: creatorStudioSystem(kind, creatorStudio),
        messages: [{ role: 'user', content: creatorStudio.prompt || creatorStudio.goal || 'Genera el contenido pedido.' }],
        output_config: { format: { type: 'json_schema', name, schema } },
      });
      const text = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      let content;
      try { content = JSON.parse(text); } catch { content = null; }
      await recordUsage(gate.db, gate.user.id, 'creator-studio', 'chat', response.usage);
      if (!content) return res.status(422).json({ error: 'no_content', message: 'No se pudo generar el contenido. Prueba de nuevo.' });
      return res.status(200).json({ content, usage: response.usage });
    } catch (err) {
      const status = err?.status === 429 ? 429 : 500;
      return res.status(status).json({ error: 'ia_error', message: status === 429 ? 'La IA está saturada, prueba en un momento.' : 'No se pudo generar el contenido.' });
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
        output_config: { format: { type: 'json_schema', name: 'plan_objetivo', schema: OBJECTIVE_PLAN_SCHEMA } },
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
      const status = err?.status === 429 ? 429 : 500;
      return res.status(status).json({ error: 'ia_error', message: status === 429 ? 'La IA está saturada, prueba en un momento.' : 'No se pudo generar el plan.' });
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
        output_config: { format: { type: 'json_schema', name: 'analisis_nutricional', schema: FOOD_PHOTO_SCHEMA } },
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
      const status = err?.status === 429 ? 429 : 500;
      return res.status(status).json({ error: 'ia_error', message: status === 429 ? 'La IA está saturada, prueba en un momento.' : 'No se pudo analizar la foto.' });
    }
  }

  // ── MODO IMPORTAR RUTINA: foto de un plan → plan estructurado ──
  // Devuelve el mismo formato que el plan por objetivo (weeks/days) para pasar
  // por la misma pantalla de revisión. Cuenta como 1 turno (section='training').
  if (routinePhoto) {
    const { imageBase64, mediaType } = routinePhoto || {};
    if (!imageBase64 || !ALLOWED_IMAGE_TYPES.includes(mediaType)) {
      return res.status(400).json({ error: 'bad_image', message: 'Formato de imagen no válido. Usa JPEG, PNG o WebP.' });
    }
    if (imageBase64.length > MAX_IMAGE_CHARS) {
      return res.status(413).json({ error: 'image_too_large', message: 'La foto debe pesar menos de 5MB.' });
    }
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system: ROUTINE_PHOTO_SYSTEM,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: 'Lee este plan de entrenamiento y devuélvelo estructurado. No inventes nada que no esté en la foto.' },
          ],
        }],
        output_config: { format: { type: 'json_schema', name: 'plan_objetivo', schema: OBJECTIVE_PLAN_SCHEMA } },
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
      const status = err?.status === 429 ? 429 : 500;
      return res.status(status).json({ error: 'ia_error', message: status === 429 ? 'La IA está saturada, prueba en un momento.' : 'No se pudo leer la foto.' });
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
        output_config: { format: { type: 'json_schema', name: 'protocolo_actividad', schema: PROTOCOL_SCHEMA } },
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
      const status = err?.status === 429 ? 429 : 500;
      return res.status(status).json({ error: 'ia_error', message: status === 429 ? 'La IA está saturada, prueba en un momento.' : 'No se pudo leer el documento.' });
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
        output_config: { format: { type: 'json_schema', name: 'rutina_preescrita', schema: ROUTINE_SCHEMA } },
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
      const status = err?.status === 429 ? 429 : 500;
      return res.status(status).json({ error: 'ia_error', message: status === 429 ? 'La IA está saturada, prueba en un momento.' : 'No se pudo leer el documento.' });
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
        output_config: { format: { type: 'json_schema', name: 'plan_semanal', schema: WEEK_PLAN_SCHEMA } },
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
      const status = err?.status === 429 ? 429 : 500;
      return res.status(status).json({ error: 'ia_error', message: status === 429 ? 'La IA está saturada, prueba en un momento.' : 'No se pudo generar el plan de la semana.' });
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
        output_config: { format: { type: 'json_schema', name: cfg.name, schema: cfg.schema } },
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
      const status = err?.status === 429 ? 429 : 500;
      return res.status(status).json({ error: 'ia_error', message: status === 429 ? 'La IA está saturada, prueba en un momento.' : 'No se pudo extraer el plan.' });
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
        output_config: { format: { type: 'json_schema', name: 'combos_temporizador', schema: {
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
      const status = err?.status === 429 ? 429 : 500;
      return res.status(status).json({ error: 'ia_error', message: status === 429 ? 'La IA está saturada, prueba en un momento.' : 'No se pudieron generar las combinaciones.' });
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
    const params = { model: MODEL, max_tokens: 1500, messages: clean };
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
    params.system = systemPrompt;

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
      const status = err?.status === 429 ? 429 : 500;
      return res.status(status).json({
        error: 'ia_error',
        message: status === 429 ? 'La IA está saturada ahora mismo, prueba en un momento.' : 'No se pudo contactar con la IA.',
      });
    }
    res.write(`data: ${JSON.stringify({ error: 'No se pudo completar la respuesta.' })}\n\n`);
    res.end();
  }
}
