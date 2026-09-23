// ════════════════════════════════════════════════════════════════
// RANKD · El plan, hablando (no rellenando un formulario)
//
// ── POR QUÉ EXISTE ──
//
// Había DOS pantallas de plan, "plan por objetivo" y "plan semanal", y las dos
// eran lo mismo: un formulario. Escribes, pulsas, sale. Nadie planifica así.
// Lo natural es decir lo que quieres, que te pregunten lo que falte, ver el
// plan, y pedir cambios hasta que cuadre.
//
// Este servicio manda la CONVERSACIÓN ENTERA más el plan que ya hubiera, y
// recibe las dos cosas de vuelta: lo que te dice y el plan actualizado. Que
// vengan juntas es lo que permite enseñar la tabla dentro del chat y seguir
// hablando encima de ella; separarlas obligaría a pulsar un botón entre medias,
// que es el formulario del que se viene huyendo.
// ════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import type { WeekContext, WeekPlan } from '@/pages/mi-esquina/lib/weekPlan';
import type { AgendaDia, DiaEntrenado } from '@/pages/mi-esquina/lib/agendaSnapshot';
import { normalizeWeekPlan } from './weekPlanAdvisor';

export interface PlanChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Foto adjunta, ya reducida y en base64 sin prefijo. Solo del usuario. */
  image?: { base64: string; mediaType: string };
}

export interface PlanChatResult {
  /**
   * Codigo HTTP cuando algo falla. Existe para poder DECIRLO.
   *
   * Sin esto, cualquier fallo que no viniera de la propia app —la funcion
   * cortada por tiempo, la red, un 500— acababa en el mismo "no se pudo
   * generar respuesta", y desde fuera no habia forma de saber cual de los
   * tres era. Se enseña al usuario a proposito: es lo unico que permite
   * que cuente lo que ha visto y se pueda arreglar.
   */
  status?: number;
  /** Lo que te dice, en lenguaje normal. */
  reply: string;
  /** El plan, si ya ha podido montarlo. null mientras pregunta. */
  plan: WeekPlan | null;
  error: string | null;
}

/**
 * Un turno de la conversación.
 *
 * `previous` es el plan que ya está montado. Va aparte del historial a
 * propósito: si viajara dentro de los mensajes, cada turno arrastraría el plan
 * entero otra vez y en cinco turnos el contexto sería casi todo JSON repetido.
 */
export async function sendPlanChat(
  messages: PlanChatMessage[],
  ctx: WeekContext,
  profile: Record<string, unknown>,
  previous: WeekPlan | null,
  planId: string,
  agenda?: AgendaDia[],
  historial?: DiaEntrenado[],
  /** true si la agenda viene podada porque el plan ya dice el resto. */
  agendaParcial = false,
): Promise<PlanChatResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { reply: '', plan: null, error: 'auth' };

  try {
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        planChat: {
          messages,
          weekStart: ctx.weekStart,
          today: ctx.today,
          weeks: ctx.weeks || 1,
          exerciseNames: ctx.exerciseNames,
          activityKinds: ctx.activityKinds,
          // Sin los ids locales, que al modelo no le dicen nada y se llevan
          // medio presupuesto de tokens.
          previous: previous ? stripForModel(previous) : null,
          // Lo que HAY PUESTO en la Agenda ahora mismo.
          //
          // `previous` es una foto de lo que se generó; esto es lo que hay. Si
          // se movió un día a mano, se borró un cardio o se entrenó algo, solo
          // lo sabe la Agenda. Sin esto, "reajústame el cardio de esta semana"
          // recibía "no tengo ningún plan previo" con el plan delante.
          agenda: agenda && agenda.length ? agenda : null,
          // Sin esto, el servidor presentaría una agenda podada como si fuera
          // todo lo que hay, y el modelo daría por vacíos los días que faltan.
          agendaParcial,
          // Lo ENTRENADO de verdad, que es otra cosa que lo previsto: incluye lo
          // que hizo por su cuenta y no estaba en ningún plan.
          historial: historial && historial.length ? historial : null,
        },
        // El perfil va en la RAÍZ del cuerpo: es donde lo lee el servidor.
        // Metido dentro de `planChat` se perdería en silencio y el plan saldría
        // sin personalizar. Ya pasó una vez con el plan semanal.
        profile,
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      // Cuando falla la PLATAFORMA y no la app, la respuesta no es JSON: un
      // 413 de Vercel llega como texto plano (`FUNCTION_PAYLOAD_TOO_LARGE`),
      // `data` sale null y el aviso acababa diciendo literalmente "error".
      // Se devuelve un código que la pantalla sabe traducir.
      // 504/502 tampoco los manda la app: es Vercel matando la función.
      // Montar un plan de seis días son ~53 s medidos, así que este caso
      // NO es raro, y decir "no se pudo generar respuesta" no ayuda a nadie:
      // lo que hay que saber es que tardó demasiado y que se puede pedir
      // por partes.
      const codigo = res.status === 413 ? 'too_large'
        : (res.status === 504 || res.status === 502) ? 'timeout'
          : 'server';
      return { reply: '', plan: null, status: res.status, error: data?.message || codigo };
    }

    const reply = String(data?.reply || '').trim();
    // El plan se normaliza con el MISMO normalizador que usaba el formulario:
    // recorta rangos, descarta días imposibles y rellena lo que falte. Así el
    // chat no puede colar un plan con formas que el resto de la app no entienda.
    const plan = data?.plan
      ? normalizeWeekPlan(data.plan as Record<string, unknown>, lastUserText(messages), ctx, planId)
      : null;

    // Lo que el modelo NO ha tocado vuelve del plan que ya teniamos.
    //
    // Se le pide expresamente que no reescriba lo que no cambia: medido,
    // cambiar tres cardios le costaba reescribir los seis dias de fuerza con
    // sus 36 ejercicios, 5.044 tokens y 42 segundos. Ahora manda el apartado
    // vacio y dice "este lo dejo igual", y se rellena aqui.
    //
    // Solo se rellena si viene VACIO: si el modelo se contradice y manda a la
    // vez el apartado con contenido y su nombre en `keep`, gana lo que ha
    // escrito. Pisarlo con lo viejo seria descartar un cambio que si pidio.
    if (plan && previous && Array.isArray(data?.keep)) {
      for (const parte of data.keep as string[]) {
        if (parte === 'strength' && (plan.strength || []).length === 0) plan.strength = previous.strength;
        if (parte === 'protocols' && (plan.protocols || []).length === 0) plan.protocols = previous.protocols;
        if (parte === 'nutrition' && (plan.nutrition || []).length === 0) plan.nutrition = previous.nutrition;
      }
    }

    return { reply, plan, error: null };
  } catch {
    // 0 = ni siquiera hubo respuesta: se corto la conexion o el navegador
    // aborto. Se distingue de un error del servidor a proposito.
    return { reply: '', plan: null, status: 0, error: 'network' };
  }
}

/** La última petición del usuario, que es lo que queda como `request` del plan. */
function lastUserText(messages: PlanChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content;
  }
  return '';
}

/** El plan sin ids ni fechas resueltas: al modelo solo le sirve la estructura. */
function stripForModel(plan: WeekPlan): Record<string, unknown> {
  return {
    weeks: plan.weeks,
    training_days: plan.trainingDays,
    summary: plan.summary,
    exclusions: plan.exclusions,
    strength: plan.strength.map((s) => ({
      weekday: s.weekday, week: s.week, name: s.name, groups: s.groups, note: s.note,
      optional: s.optional === true,
      exercises: s.exercises.map((e) => ({
        name: e.name, sets: e.sets, reps_min: e.reps_min, reps_max: e.reps_max,
        value: e.value, weight_kg: e.weight_kg,
      })),
    })),
    // `optional` y `minutes` viajan también. Sin ellos, al pedirle un cambio el
    // modelo veía las tres opciones de un sábado como tres cardios fijos y, al
    // reescribirlas, las devolvía fijas: lo opcional dejaba de serlo solo por
    // tocar el plan. Y un cardio sin tramos no decía cuánto duraba.
    // Los tramos, en la MISMA forma en que el modelo los escribe (minutos,
    // reps, detail…) y no en la de la app (segundos, ids). Con la de la app,
    // al pedir un cambio el modelo recibía una forma y tenía que devolver otra,
    // y en la traducción se perdían las reps de un Hyrox o el detalle de un
    // tramo. Sin ids ni ceros, que solo gastan tokens.
    protocols: plan.protocols.map((p) => ({
      key: p.key, name: p.name, kind: p.kind, when: p.when,
      weekdays: p.weekdays, weeks: p.weeks, note: p.note,
      segments: p.segments.map((s) => ({
        label: s.label || '',
        minutes: +(Math.max(0, s.seconds || 0) / 60).toFixed(2),
        ...(s.meters ? { meters: s.meters } : {}),
        ...(s.reps ? { reps: s.reps } : {}),
        ...s.values,
        ...(s.note ? { detail: s.note } : {}),
      })),
      optional: p.optional === true, ...(p.minutes ? { minutes: p.minutes } : {}),
      ...(p.place ? { place: p.place } : {}),
    })),
    nutrition: plan.nutrition.map((n) => ({
      weekday: n.weekday, week: n.week, meals: n.meals,
    })),
  };
}
