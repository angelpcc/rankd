// ════════════════════════════════════════════════════════════════
// RANKD · Mi Esquina · Plan semanal multi-módulo (punto 21)
//
// Una sola petición conversacional que combina TRES módulos:
//
//   "Tengo 5 días esta semana. Fuerza orientada a hipertrofia, sin boxeo.
//    Cardio de tarde de 40 min de caminata con inclinación, dime la
//    inclinación minuto a minuto. Otro corto por la mañana y otro suave
//    post-entreno. Y comida y cena para 5 días, básico y rápido."
//
// Lo que hace este archivo:
//   · Define el plan generado (fuerza por día + N protocolos + pauta de comidas).
//   · Lo guarda como BORRADOR revisable (`week_plans`, migración 0056), para
//     que pedir ajustes puntuales no obligue a rehacer la petición entera.
//   · Al confirmar, lo REPARTE en las tablas que ya existen:
//       – una rutina preescrita (`workout_routines`) con los días de fuerza
//       – un protocolo por cardio (`activity_protocols`)
//       – bloques de agenda (`day_plan_items`) para fuerza, cardio y comidas,
//         cada uno ENLAZADO a lo que lo resuelve (routine_id / protocol_id)
//
// Ese enlace es lo que permite el punto 21bis: tocar el bloque del viernes en
// la Agenda abre directamente el checklist de ese día o el reproductor de ese
// cardio, sin ir a buscarlos.
//
// No se inventa un cuarto sitio donde vivan las cosas: al confirmar, el plan
// deja de ser una entidad aparte y pasa a ser rutina + protocolos + agenda.
// ════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import { isoOf, todayISO, type MealSlot, type MuscleGroup } from './dayPlan';
import { localId as protocolLocalId, saveProtocol, type Protocol, type ProtocolSegment } from './protocols';
import { designCardio } from '@/services/protocolImport';
import { localId as routineLocalId, saveRoutine, type PrescribedExercise, type Routine, type RoutineDay } from './routines';

// ── El plan generado ───────────────────────────────────────────

export interface WeekStrengthDay {
  /** 0..6 dentro de la semana (0 = lunes). */
  weekday: number;
  /**
   * Semana a la que pertenece, empezando en 0.
   *
   * Ausente = "todas las semanas". Es el caso normal: una rutina Push/Pull se
   * repite igual cada semana y obligar al modelo a escribirla N veces sería
   * pedirle que copie y pegue, con el riesgo de que se le descuadre una copia.
   * Solo se declara cuando ESA semana es distinta (progresión, descarga).
   */
  week?: number;
  /** Fecha real ya resuelta. */
  date: string;
  /** Nombre del día tal y como lo llamó el Asesor ("Push", "Espalda y pecho"). */
  name: string;
  groups: MuscleGroup[];
  exercises: PrescribedExercise[];
  note?: string;
}

export interface WeekProtocol {
  /** Identificador interno dentro del plan, para los ajustes. */
  key: string;
  /** Nombre con el que quedará en Actividad ("Cardio tarde — grasa"). */
  name: string;
  /** Tipo de actividad (cinta, correr, bici…). */
  kind: string;
  /** Franja del día en la que toca. Solo informativa. */
  when: 'morning' | 'midday' | 'afternoon' | 'evening';
  segments: ProtocolSegment[];
  /**
   * Minutos totales, cuando el cardio NO trae tramos.
   *
   * Un plan generado hablando dice "cinta 40 min, 10 al 6 y 20 al 8" en la nota
   * y no desglosa los tramos: desglosarlos hundía el esquema a ocho niveles de
   * anidamiento y la petición se rechazaba entera. El guion tramo a tramo se
   * monta aparte, en Actividad, que es donde se reproduce.
   */
  minutes?: number;
  /** Días de la semana (0..6) en los que va este cardio. */
  weekdays: number[];
  /** Semanas (0..N-1) en las que va. Ausente = todas. Ver WeekStrengthDay.week. */
  weeks?: number[];
  note?: string;
}

export interface WeekMeal {
  slot: MealSlot;
  text: string;
  /** Minutos de preparación estimados. */
  minutes: number;
}

export interface WeekMealDay {
  weekday: number;
  /** Semana a la que pertenece. Ausente = todas. */
  week?: number;
  date: string;
  meals: WeekMeal[];
}

export interface WeekPlan {
  /** id de la fila en `week_plans`; local mientras no haya base. */
  id: string;
  /** Lo que escribió el usuario, literal. */
  request: string;
  /** Lunes de la semana que cubre. */
  weekStart: string;
  /** Días de entreno que el usuario dijo tener ESA semana. */
  trainingDays: number;
  /**
   * Cuántas semanas cubre el plan. 1 = una semana, como hasta ahora.
   *
   * Antes esto no existía y el modelo entero daba por hecho UNA semana: pedir
   * "dos semanas" devolvía una y el usuario se quedaba buscando la otra.
   */
  weeks: number;
  /** Lo que pidió NO incluir. Se enseña siempre: es lo que más se incumple. */
  exclusions: string[];
  summary: string;
  disclaimer: string;
  strength: WeekStrengthDay[];
  protocols: WeekProtocol[];
  nutrition: WeekMealDay[];
  status: 'draft' | 'committed';
  createdAt: string;
}

export interface CommitResult {
  routineId: string | null;
  protocolIds: string[];
  agendaItems: number;
  /** true si algo se ha tenido que quedar en este navegador. */
  storedLocally: boolean;
  /** Bloques de agenda que NO se pudieron crear (migración 0042 sin aplicar). */
  agendaUnavailable: boolean;
  /** Ids de los bloques creados, para poder volver sobre ellos y cambiarlos. */
  agendaItemIds: string[];
  /**
   * Fechas que se han dejado como estaban por tener algo YA COMPLETADO.
   *
   * Un día entrenado es un hecho, no una intención: reescribirlo borraría el
   * historial de algo que de verdad pasó. Se devuelven para poder decírselo al
   * usuario en vez de tragárselo en silencio, que es lo que hacía antes.
   */
  keptCompleted: string[];
}

// ── Fechas ─────────────────────────────────────────────────────

/** Lunes de la semana de `d`. */
export function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay() === 0 ? 6 : x.getDay() - 1;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Lunes de esta semana en ISO. */
export function currentWeekStart(): string {
  return isoOf(mondayOf(new Date()));
}

/** Fecha del día `weekday` (0 = lunes) de la semana que empieza en `weekStart`. */
export function dateOfWeekday(weekStart: string, weekday: number, week = 0): string {
  const d = new Date(`${weekStart}T12:00:00`);
  d.setDate(d.getDate() + Math.max(0, week) * 7 + Math.max(0, Math.min(6, weekday)));
  return isoOf(d);
}

/**
 * En qué semanas del plan cae algo.
 *
 * Sin `week` declarado se repite en todas: es lo que se espera de una rutina o
 * de un cardio fijo, y evita que el modelo tenga que copiar la misma estructura
 * N veces. Con `week` declarado manda lo declarado, que es como se expresa una
 * progresión o una semana de descarga.
 */
export function weeksOf(total: number, declarado?: number | number[]): number[] {
  const todas = Array.from({ length: Math.max(1, total) }, (_, i) => i);
  if (declarado === undefined || declarado === null) return todas;
  const lista = Array.isArray(declarado) ? declarado : [declarado];
  const validas = lista.filter((w) => Number.isFinite(w) && w >= 0 && w < Math.max(1, total));
  return validas.length > 0 ? [...new Set(validas)] : todas;
}

/** Días con algo planificado, para el resumen. */
export function planTotals(plan: WeekPlan): { strengthDays: number; protocols: number; cardioSlots: number; mealDays: number; meals: number } {
  return {
    strengthDays: plan.strength.length,
    protocols: plan.protocols.length,
    cardioSlots: plan.protocols.reduce((a, p) => a + p.weekdays.length, 0),
    mealDays: plan.nutrition.length,
    meals: plan.nutrition.reduce((a, d) => a + d.meals.length, 0),
  };
}

/**
 * Días de la semana que TOCAN algo, ordenados. Sirve para pintar el resumen
 * por día en vez de por módulo, que es como lo va a leer el usuario.
 */
export function planWeekdays(plan: WeekPlan): number[] {
  const set = new Set<number>();
  plan.strength.forEach((s) => set.add(s.weekday));
  plan.protocols.forEach((p) => p.weekdays.forEach((w) => set.add(w)));
  plan.nutrition.forEach((n) => set.add(n.weekday));
  return [...set].sort((a, b) => a - b);
}

// ── Guardado del borrador ──────────────────────────────────────
//
// Mismo criterio que el resto de Mi Esquina: primero la base (migración 0056)
// y, si no está aplicada, este navegador, avisando de ello.

const LOCAL_KEY = 'rankd_week_plan';

function localKey(profileId: string) { return `${LOCAL_KEY}:${profileId}`; }

function readLocal(profileId: string): WeekPlan | null {
  try {
    const raw = localStorage.getItem(localKey(profileId));
    return raw ? (JSON.parse(raw) as WeekPlan) : null;
  } catch { return null; }
}

function writeLocal(profileId: string, plan: WeekPlan | null) {
  try {
    if (plan) localStorage.setItem(localKey(profileId), JSON.stringify(plan));
    else localStorage.removeItem(localKey(profileId));
  } catch { /* sin espacio */ }
}

export interface LoadedWeekPlan { plan: WeekPlan; storedLocally: boolean }

interface PlanRow { id: string; request: string; week_start: string; training_days: number; plan_json: WeekPlan; status: string; created_at: string }

/** El borrador a medias, si lo hay. Lo que se pide al abrir la pantalla. */
export async function loadDraft(profileId: string): Promise<LoadedWeekPlan | null> {
  const { data, error } = await supabase
    .from('week_plans')
    .select('id, request, week_start, training_days, plan_json, status, created_at')
    .eq('fighter_profile_id', profileId).eq('status', 'draft')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (!error && data) {
    const row = data as PlanRow;
    return { plan: { ...row.plan_json, id: row.id, status: 'draft' }, storedLocally: false };
  }
  const local = readLocal(profileId);
  return local && local.status === 'draft' ? { plan: local, storedLocally: true } : null;
}


/**
 * El plan YA GUARDADO que sigue vigente, si lo hay.
 *
 * ── POR QUÉ HACÍA FALTA ──
 *
 * `loadDraft` solo devolvía borradores. En cuanto confirmabas un plan,
 * desaparecía de la pantalla: no había forma de volver sobre él para pedir un
 * cambio. Pedirlo en una conversación nueva generaba OTRO plan que se
 * machacaba encima del anterior.
 *
 * Se busca por semana, no "el último": un plan de la semana pasada ya no manda
 * sobre ésta, y aplicarle cambios reescribiría días que ya pasaron.
 */
export async function loadActivePlan(profileId: string, weekStart?: string): Promise<LoadedWeekPlan | null> {
  const ws = weekStart || currentWeekStart();

  /** ¿La semana `ws` cae DENTRO del plan? Un plan de 3 semanas cubre 3, no 1. */
  const cubre = (p: WeekPlan | null | undefined): boolean => {
    if (!p?.weekStart) return false;
    const total = Math.max(1, p.weeks || 1);
    const ini = new Date(`${p.weekStart}T12:00:00`);
    const fin = new Date(ini);
    fin.setDate(fin.getDate() + (total - 1) * 7);
    return ws >= isoOf(ini) && ws <= isoOf(fin);
  };

  // Se piden los últimos y se filtra en memoria por el RANGO que cubren.
  //
  // Antes se comparaba `week_start` por igualdad, y con planes de una semana
  // funcionaba. Con un plan de dos, en cuanto entraba la segunda semana el plan
  // dejaba de encontrarse: seguía vivo en la Agenda pero no se podía abrir ni
  // ajustar, y pedir un cambio habría creado uno nuevo encima — justo lo que el
  // punto 27 vino a arreglar.
  const { data, error } = await supabase
    .from('week_plans')
    .select('id, request, week_start, training_days, plan_json, status, created_at')
    .eq('fighter_profile_id', profileId)
    .eq('status', 'committed')
    .lte('week_start', ws)
    .order('week_start', { ascending: false }).limit(8);

  if (!error && data) {
    for (const row of data as PlanRow[]) {
      const plan = { ...row.plan_json, id: row.id, status: 'committed' as const };
      if (cubre(plan)) return { plan, storedLocally: false };
    }
  }
  const local = readLocal(profileId);
  return local && local.status === 'committed' && cubre(local)
    ? { plan: local, storedLocally: true }
    : null;
}

/**
 * ¿Este cambio es un retoque o es rehacer la semana entera?
 *
 * Importa porque la respuesta cambia lo que hay que hacer: un retoque se aplica
 * y ya está, mientras que rehacer la semana tira los bloques pendientes del
 * plan anterior y eso hay que PREGUNTARLO antes, no decidirlo por el usuario.
 *
 * Se mira la intención escrita, no el resultado: cuando alguien dice "cámbiame
 * toda la semana" está pidiendo otra cosa distinta de "mueve el jueves", por
 * mucho que el plan que salga se parezca.
 */
const AMPLIO = [
  'toda la semana', 'semana entera', 'todo el plan', 'plan entero', 'de cero',
  'empezar de nuevo', 'otro plan', 'plan nuevo', 'rehaz', 'rehacer', 'replantea',
  'cambiamelo todo', 'cambialo todo', 'todo de nuevo',
  'whole week', 'entire week', 'whole plan', 'from scratch', 'start over',
  'new plan', 'redo', 'rewrite everything',
];

export function isWholesaleChange(instruction: string): boolean {
  const s = instruction.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return AMPLIO.some((p) => s.includes(p));
}

/**
 * Retira los bloques PENDIENTES de un plan, dejando intactos los ya hechos.
 *
 * Es lo que se ejecuta cuando el usuario confirma que quiere sustituir el plan:
 * sin esto, el plan nuevo se sumaría al viejo y la Agenda acabaría con cada día
 * duplicado. Los días completados sobreviven a propósito — son historial.
 *
 * Devuelve cuántos se retiraron y las fechas que se respetaron por estar hechas.
 */
export async function clearPlanPending(
  profileId: string,
  planId: string,
): Promise<{ removed: number; keptCompleted: string[] }> {
  const { data, error } = await supabase.from('day_plan_items')
    .select('id, plan_date, completed, payload')
    .eq('fighter_profile_id', profileId);
  if (error) return { removed: 0, keptCompleted: [] };

  const rows = (data || []) as { id: string; plan_date: string; completed: boolean; payload: Record<string, unknown> | null }[];
  const mios = rows.filter((r) => r.payload?.week_plan_id === planId);
  const kept = [...new Set(mios.filter((r) => r.completed).map((r) => r.plan_date))];
  const ids = mios.filter((r) => !r.completed).map((r) => r.id);
  if (ids.length === 0) return { removed: 0, keptCompleted: kept };

  const del = await supabase.from('day_plan_items').delete().in('id', ids);
  return { removed: del.error ? 0 : ids.length, keptCompleted: kept };
}

/**
 * Retira el plan de en medio: quita lo pendiente y lo saca de la Agenda.
 *
 * ── QUÉ SE BORRA Y QUÉ NO ──
 *
 * Lo PENDIENTE se borra. Lo ya ENTRENADO se queda, siempre: es historial, un
 * hecho, no una intención. Borrar un día entrenado porque cambias de plan sería
 * reescribir lo que hiciste, y eso no se toca nunca.
 *
 * ── POR QUÉ 'archived' Y NO BORRAR LA FILA ──
 *
 * El plan sigue existiendo para los días que ya se entrenaron con él: si se
 * borrara la fila, esos bloques completados apuntarían a un plan que no existe.
 * 'archived' ya está permitido por la tabla (migración 0056), así que esto no
 * necesita ninguna migración nueva. `loadActivePlan` solo mira los 'committed',
 * así que archivado deja de salir por todas partes.
 */
export async function archiveWeekPlan(
  profileId: string,
  planId: string,
): Promise<{ removed: number; keptCompleted: string[] }> {
  const limpieza = await clearPlanPending(profileId, planId);

  // Un id local ("wp_…") nunca llegó a la base: solo vivía aquí.
  if (!planId.startsWith('wp_')) {
    await supabase.from('week_plans')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', planId);
  }

  // Y la copia local, si la que hay guardada era ésta.
  const local = readLocal(profileId);
  if (local && local.id === planId) writeLocal(profileId, null);

  return limpieza;
}

/**
 * Días de este plan que ya están entrenados.
 *
 * Se consulta ANTES de pedirle un cambio al Asesor para poder decírselo: si no,
 * propondría alegremente mover el martes cuando el martes ya está hecho.
 */
export async function completedDatesOfPlan(profileId: string, planId: string): Promise<string[]> {
  const { data } = await supabase.from('day_plan_items')
    .select('plan_date, completed, payload')
    .eq('fighter_profile_id', profileId)
    .eq('completed', true);
  const rows = (data || []) as { plan_date: string; payload: Record<string, unknown> | null }[];
  return [...new Set(rows.filter((r) => r.payload?.week_plan_id === planId).map((r) => r.plan_date))];
}

/** Guarda o actualiza el borrador. Devuelve el plan con su id definitivo. */
export async function saveDraft(profileId: string, plan: WeekPlan): Promise<{ plan: WeekPlan; storedLocally: boolean }> {
  const payload = {
    fighter_profile_id: profileId,
    request: plan.request.slice(0, 4000),
    week_start: plan.weekStart,
    training_days: Math.max(0, Math.min(7, plan.trainingDays)),
    plan_json: plan,
    status: 'draft',
    updated_at: new Date().toISOString(),
  };
  const isLocalId = plan.id.startsWith('wp_');

  const res = isLocalId
    ? await supabase.from('week_plans').insert(payload).select('id').maybeSingle()
    : await supabase.from('week_plans').update(payload).eq('id', plan.id).select('id').maybeSingle();

  if (!res.error && res.data) {
    const saved: WeekPlan = { ...plan, id: (res.data as { id: string }).id };
    writeLocal(profileId, null);
    return { plan: saved, storedLocally: false };
  }

  const stored: WeekPlan = { ...plan, id: isLocalId ? plan.id : newPlanId() };
  writeLocal(profileId, stored);
  return { plan: stored, storedLocally: true };
}

/** Tira el borrador sin confirmarlo. */
export async function discardDraft(profileId: string, plan: WeekPlan): Promise<void> {
  writeLocal(profileId, null);
  if (!plan.id.startsWith('wp_')) {
    await supabase.from('week_plans').update({ status: 'archived' }).eq('id', plan.id);
  }
}

let seq = 0;
export function newPlanId(): string {
  seq += 1;
  return `wp_${Date.now().toString(36)}_${seq.toString(36)}`;
}

// ── Confirmar: repartir el plan en sus secciones ───────────────

/**
 * Confirma el plan.
 *
 * El orden importa: primero se crean rutina y protocolos (para tener sus ids),
 * y solo después los bloques de la Agenda, que los enlazan. Si la Agenda no
 * está disponible (migración 0042 sin aplicar), la rutina y los protocolos YA
 * se han guardado y siguen siendo utilizables desde Fuerza y Actividad: se
 * pierde el acceso directo desde el día, no el trabajo.
 *
 * Los bloques del plan anterior generados por el Asesor en esas mismas fechas
 * se retiran antes de escribir los nuevos. Sin eso, regenerar el plan de la
 * semana dejaría el día con dos entrenos de fuerza y tres cardios.
 */
export interface CommitOptions {
  /** Perfil del peleador, para que los guiones salgan a su nivel. */
  profile?: Record<string, unknown>;
  /** Para contar por dónde va: generar los guiones tarda unos segundos. */
  onProgress?: (paso: 'cardios', hechos: number, total: number) => void;
}

export async function commitWeekPlan(
  profileId: string,
  plan: WeekPlan,
  opts: CommitOptions = {},
): Promise<CommitResult> {
  const out: CommitResult = {
    routineId: null, protocolIds: [], agendaItems: 0,
    storedLocally: false, agendaUnavailable: false,
    agendaItemIds: [], keptCompleted: [],
  };

  // ── 0. Los guiones de cardio, ANTES de guardar nada ──
  //
  // Antes esto se hacía al ir a entrenar: abrías el bloque y te preguntaba si
  // querías montarlo. Se hizo así para no pagar por guiones que igual nunca se
  // usan, pero el resultado era que el plan quedaba a medias — te plantabas en
  // Actividad a entrenar y lo que te encontrabas era una pantalla montando el
  // cardio. Cuando vas a entrenar quieres entrenar.
  //
  // Lo que hace que esto sea asumible es que se genera UNO POR CARDIO DISTINTO,
  // no por día: "cinta 45 min" lunes, miércoles y viernes durante dos semanas
  // son seis bloques y UNA sola llamada. Un plan normal trae uno o dos.
  //
  // En paralelo porque son peticiones independientes: tres seguidas son treinta
  // segundos mirando una rueda, y a la vez son diez.
  const sinGuion = plan.protocols.filter((p) => p.segments.length === 0 && (p.minutes || 0) >= 5);
  if (sinGuion.length > 0) {
    opts.onProgress?.('cardios', 0, sinGuion.length);
    let hechos = 0;
    await Promise.all(sinGuion.map(async (p) => {
      try {
        const { protocol } = await designCardio({
          kind: p.kind,
          minutes: p.minutes || 30,
          intent: [p.name, p.note].filter(Boolean).join('. '),
          profile: opts.profile,
        });
        // Si falla, el plan se guarda igual y sin guion: perder el plan entero
        // porque la IA no ha contestado sería mucho peor. El bloque del día
        // sigue ofreciendo montarlo a mano más tarde.
        if (protocol && protocol.segments.length > 0) p.segments = protocol.segments;
      } catch { /* ver arriba: el plan se guarda igual */ }
      hechos += 1;
      opts.onProgress?.('cardios', hechos, sinGuion.length);
    }));
  }

  // ── 1. La rutina de fuerza de la semana ──
  let routine: Routine | null = null;
  if (plan.strength.length > 0) {
    const days: RoutineDay[] = plan.strength.map((s) => ({
      id: routineLocalId('day'),
      name: s.name || dayLabelFallback(s.weekday),
      note: s.note,
      exercises: s.exercises,
    }));
    const draft: Routine = {
      id: routineLocalId('rt'),
      name: plan.summary ? routineNameFrom(plan) : 'Rutina de la semana',
      note: plan.exclusions.length > 0 ? `Sin: ${plan.exclusions.join(', ')}` : undefined,
      days,
      source: 'import',
      createdAt: new Date().toISOString(),
    };
    const saved = await saveRoutine(profileId, draft);
    routine = saved.routine;
    out.routineId = saved.routine.id;
    if (saved.storedLocally) out.storedLocally = true;
  }

  // ── 2. Un protocolo por cardio ──
  const savedProtocols = new Map<string, Protocol>();
  for (const p of plan.protocols) {
    // Sin tramos no se guarda protocolo.
    //
    // Un plan hecho hablando describe el cardio en texto ("40 min, 10 al 6 y 20
    // al 8") y no lo desglosa. Guardarlo igualmente crearía un protocolo vacío
    // y, al tocar el bloque del día, se abriría un reproductor sin nada que
    // reproducir. El bloque de la Agenda vale solo: dice el tipo, los minutos y
    // el detalle en la nota, que es lo que se lee al ir a entrenar.
    if (p.segments.length === 0) continue;
    const draft: Protocol = {
      id: protocolLocalId('prot'),
      name: p.name,
      kind: p.kind,
      segments: p.segments,
      note: p.note,
      source: 'import',
      createdAt: new Date().toISOString(),
    };
    const saved = await saveProtocol(profileId, draft);
    savedProtocols.set(p.key, saved.protocol);
    out.protocolIds.push(saved.protocol.id);
    if (saved.storedLocally) out.storedLocally = true;
  }

  // ── 3. Los bloques de la Agenda ──
  const total = Math.max(1, plan.weeks || 1);

  /**
   * Un día que ya pasó no recibe bloques.
   *
   * Con planes de varias semanas hace falta aquí y no solo al generar: la
   * estructura se repite en todas, así que el lunes existe cuatro veces, pero
   * el lunes de ESTA semana puede haber pasado ya. Crear ese bloque solo añade
   * un entreno pendiente que nadie va a hacer.
   */
  const hoy = isoOf(new Date());
  const pasado = (fecha: string) => fecha < hoy;

  const dates = new Set<string>();
  plan.strength.forEach((s) => weeksOf(total, s.week)
    .forEach((w) => dates.add(dateOfWeekday(plan.weekStart, s.weekday, w))));
  plan.protocols.forEach((p) => weeksOf(total, p.weeks)
    .forEach((w) => p.weekdays.forEach((d) => dates.add(dateOfWeekday(plan.weekStart, d, w)))));
  plan.nutrition.forEach((n) => weeksOf(total, n.week)
    .forEach((w) => dates.add(dateOfWeekday(plan.weekStart, n.weekday, w))));

  // ── Limpieza quirúrgica, no una escoba ──
  //
  // Antes esto borraba TODO lo que el Asesor hubiera dejado en esas fechas.
  // Dos daños: se llevaba por delante los días YA ENTRENADOS (un hecho, no una
  // intención — reescribirlo borra historial real), y arrasaba bloques de otros
  // planes que compartieran fecha.
  //
  // Ahora solo se retira lo que cumple las tres condiciones: es de ESTE plan,
  // sigue PENDIENTE y está en una de las fechas que el plan nuevo va a ocupar.
  const keptCompleted = new Set<string>();
  if (dates.size > 0) {
    const { data: previos } = await supabase.from('day_plan_items')
      .select('id, plan_date, completed, payload, source')
      .eq('fighter_profile_id', profileId)
      .in('plan_date', [...dates]);

    const mios = ((previos || []) as { id: string; plan_date: string; completed: boolean; payload: Record<string, unknown> | null; source: string | null }[])
      .filter((r) => {
        const dePlan = r.payload?.week_plan_id;
        // Sin sello es un bloque anterior a este cambio: se reconoce por venir
        // del Asesor, como antes. Con sello, solo si es de ESTE plan.
        return dePlan ? dePlan === plan.id : r.source === 'advisor';
      });

    for (const r of mios) {
      if (r.completed) keptCompleted.add(r.plan_date);
    }
    const borrables = mios.filter((r) => !r.completed).map((r) => r.id);
    if (borrables.length > 0) {
      await supabase.from('day_plan_items').delete().in('id', borrables);
    }
  }
  out.keptCompleted = [...keptCompleted];

  /**
   * Un día con algo ya completado no recibe bloques nuevos de ese mismo tipo.
   *
   * Si el jueves ya entrenaste fuerza, el plan nuevo no puede plantarte otro
   * bloque de fuerza ese día: quedarían dos, uno hecho y otro pendiente, y la
   * Agenda diría que te falta un entreno que ya hiciste.
   */
  const yaHecho = new Set<string>();
  if (dates.size > 0) {
    const { data: hechos } = await supabase.from('day_plan_items')
      .select('plan_date, kind')
      .eq('fighter_profile_id', profileId)
      .eq('completed', true)
      .in('plan_date', [...dates]);
    for (const r of (hechos || []) as { plan_date: string; kind: string }[]) {
      yaHecho.add(`${r.plan_date}|${r.kind}`);
    }
  }

  interface Row { fighter_profile_id: string; plan_date: string; kind: string; payload: unknown; source: string; completed: boolean }
  const rows: Row[] = [];

  /**
   * Sello de propiedad en el propio payload.
   *
   * Va en el jsonb y no en una columna nueva para no pedir otra migración, y
   * sobre todo para que sobreviva a que se pierda `committed_json`: con esto,
   * un bloque siempre sabe de qué plan salió.
   */
  const marcar = (p: Record<string, unknown>) => ({ ...p, week_plan_id: plan.id });

  plan.strength.forEach((s, i) => {
    const day = routine?.days[i];
    // Una fila por cada semana en la que toca este día. Sin `week` declarado
    // se repite en todas, que es lo que se espera de una rutina.
    weeksOf(total, s.week).forEach((wk) => {
    const fecha = dateOfWeekday(plan.weekStart, s.weekday, wk);
    if (pasado(fecha)) return;
    // Ese día ya se entrenó fuerza: se respeta y no se añade nada encima.
    if (yaHecho.has(`${fecha}|strength`)) return;
    rows.push({
      fighter_profile_id: profileId,
      plan_date: fecha,
      kind: 'strength',
      payload: marcar({
        groups: s.groups,
        exercises: s.exercises.map((e) => ({
          name: e.name, sets: e.sets, reps_min: e.reps_min, reps_max: e.reps_max,
          value: e.value, weight_kg: e.weight_kg, weight_mode: e.weight_mode, tracking_mode: e.tracking_mode,
        })),
        note: s.note,
        routine_id: routine?.id,
        routine_day_id: day?.id,
        routine_name: s.name || routine?.name,
      }),
      source: 'advisor',
      completed: false,
    });
    });
  });

  plan.protocols.forEach((p) => {
    const saved = savedProtocols.get(p.key);
    // Con tramos manda su suma; sin ellos, los minutos que dijo el plan.
    const seconds = p.segments.length > 0
      ? p.segments.reduce((a, s) => a + Math.max(0, s.seconds || 0), 0)
      : Math.max(0, p.minutes || 0) * 60;
    weeksOf(total, p.weeks).forEach((wk) => p.weekdays.forEach((w) => {
      const fecha = dateOfWeekday(plan.weekStart, w, wk);
      if (pasado(fecha)) return;
      if (yaHecho.has(`${fecha}|activity`)) return;
      rows.push({
        fighter_profile_id: profileId,
        plan_date: fecha,
        kind: 'activity',
        payload: marcar({
          kind: p.kind,
          duration_min: seconds > 0 ? Math.round(seconds / 60) : undefined,
          note: p.note,
          protocol_id: saved?.id,
          protocol_name: p.name,
        }),
        source: 'advisor',
        completed: false,
      });
    }));
  });

  plan.nutrition.forEach((n) => {
    weeksOf(total, n.week).forEach((wk) => {
      const fecha = dateOfWeekday(plan.weekStart, n.weekday, wk);
      if (pasado(fecha)) return;
      n.meals.forEach((m) => {
      rows.push({
        fighter_profile_id: profileId,
        plan_date: fecha,
        kind: 'meal',
        payload: marcar({ slot: m.slot, text: m.text, minutes: m.minutes }),
        source: 'advisor',
        completed: false,
      });
      });
    });
  });

  if (rows.length > 0) {
    let ins = await supabase.from('day_plan_items').insert(rows).select('id');
    // `source: 'advisor'` es un valor que la base admite (texto libre), pero si
    // algún CHECK lo rechazara, mejor guardar como 'manual' que perder el plan.
    if (ins.error && !isMissingTable(ins.error)) {
      ins = await supabase.from('day_plan_items')
        .insert(rows.map((r) => ({ ...r, source: 'manual' }))).select('id');
    }
    if (isMissingTable(ins.error)) out.agendaUnavailable = true;
    else {
      const creados = (ins.data || []) as { id: string }[];
      out.agendaItems = creados.length;
      out.agendaItemIds = creados.map((r) => r.id);
    }
  }

  // ── 3bis. Dejar constancia como PLAN ACTIVO ──
  //
  // Cinco pantallas leen `objective_plans` para saber si hay un plan en marcha:
  // el Resumen, Fuerza, los pasos de activación, la línea de IA del resumen y
  // la impresión. Antes lo escribía el "plan por objetivo", que era una pantalla
  // aparte; al unificarlo todo aquí, si nadie escribe esa tabla esas cinco se
  // quedan pensando que no tienes plan cuando sí lo tienes.
  //
  // Es best-effort: si falla, el plan ya está en la Agenda, que es lo que
  // importa. Solo se pierde el rótulo de "tienes un plan activo".
  try {
    // Solo puede haber UNO activo: el anterior se archiva, no se borra.
    await supabase.from('objective_plans')
      .update({ status: 'archived' })
      .eq('fighter_profile_id', profileId).eq('status', 'active');

    await supabase.from('objective_plans').insert({
      fighter_profile_id: profileId,
      objective_text: plan.request.slice(0, 2000),
      answers_json: {},
      plan_json: {
        plan_title: plan.summary?.slice(0, 120) || plan.request.slice(0, 120),
        summary: plan.summary,
        disclaimer: plan.disclaimer,
        week_start: plan.weekStart,
        weeks: total,
        source: 'plan_chat',
      },
      status: 'active',
    });
  } catch { /* la Agenda ya tiene el plan: esto es solo el rótulo */ }

  // ── 4. Cerrar el borrador ──
  const committed = { ...plan, status: 'committed' as const };
  writeLocal(profileId, null);
  if (!plan.id.startsWith('wp_')) {
    await supabase.from('week_plans').update({
      status: 'committed',
      plan_json: committed,
      committed_json: {
        routine_id: out.routineId,
        protocol_ids: out.protocolIds,
        agenda_items: out.agendaItems,
        // Los ids, no solo el recuento. Sin esto no había forma de volver sobre
        // lo que creó este plan para cambiarlo o retirarlo.
        agenda_item_ids: out.agendaItemIds,
        kept_completed: out.keptCompleted,
      },
      committed_at: new Date().toISOString(),
    }).eq('id', plan.id);
  }

  return out;
}

/** Nombre de la rutina a partir del plan. Corto y reconocible en la lista. */
function routineNameFrom(plan: WeekPlan): string {
  const d = new Date(`${plan.weekStart}T12:00:00`);
  const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `Semana del ${label} · ${plan.strength.length} días`;
}

function dayLabelFallback(weekday: number): string {
  const names = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  return names[Math.max(0, Math.min(6, weekday))];
}

// ── Contexto que se le pasa al Asesor ──────────────────────────

export interface WeekContext {
  /** Lunes de la PRIMERA semana del plan. */
  weekStart: string;
  /** Cuántas semanas debe cubrir. 1 = una semana, como siempre. */
  weeks?: number;
  /** Hoy, para que no planifique días que ya han pasado. */
  today: string;
  /** Nombres de ejercicio de la biblioteca, para que no se los invente. */
  exerciseNames: string[];
  /** Tipos de actividad válidos. */
  activityKinds: string[];
}

/** Fechas de la semana con su nombre, para el resumen. */
export function weekDates(weekStart: string): { weekday: number; date: string }[] {
  return Array.from({ length: 7 }, (_, i) => ({ weekday: i, date: dateOfWeekday(weekStart, i) }));
}

/** ¿Este día ya ha pasado? El plan no debe colocar nada ahí. */
export function isPast(date: string): boolean {
  return date < todayISO();
}
