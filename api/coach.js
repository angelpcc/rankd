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
  if (p.heightCm) lines.push(`- Altura: ${p.heightCm} cm`);
  if (p.currentWeight) lines.push(`- Peso actual: ${p.currentWeight} kg`);
  if (p.targetWeight) lines.push(`- Peso objetivo: ${p.targetWeight} kg`);
  if (p.record) lines.push(`- Récord: ${p.record}`);
  if (p.goal) lines.push(`- Objetivo declarado: ${p.goal}`);
  if (p.weeklyMinutes) lines.push(`- Volumen de entreno esta semana: ${p.weeklyMinutes} min`);
  if (Array.isArray(p.goals) && p.goals.length) lines.push(`- Metas con fecha límite: ${p.goals.join('; ')}`);
  if (p.recovery) lines.push(`- Cómo llega esta semana: ${p.recovery}`);
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

  const { section, profile, messages, extract, timerCombos } = req.body || {};
  const buildSystem = SYSTEMS[section];
  if (!buildSystem) return res.status(400).json({ error: 'Sección de IA no válida' });

  const clean = sanitize(messages);
  if (clean.length === 0 || clean[0].role !== 'user') {
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
