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

  const { section, profile, messages, extract, timerCombos, foodPhoto, routinePhoto, creatorStudio, objectivePlan } = req.body || {};
  // Modos "estructurados": no usan `section` ni una conversación `messages`,
  // devuelven JSON validado. No deben pasar por las guardas de chat de abajo.
  const structuredMode = !!(objectivePlan || foodPhoto || routinePhoto);

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
    // Límite de tamaño (~5MB en base64 ≈ 6.8M caracteres). Defensa del servidor.
    if (imageBase64.length > 7_000_000) {
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
    if (imageBase64.length > 7_000_000) {
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
