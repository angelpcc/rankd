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
    if (!res.ok) return { reply: '', plan: null, error: data?.message || 'error' };

    const reply = String(data?.reply || '').trim();
    // El plan se normaliza con el MISMO normalizador que usaba el formulario:
    // recorta rangos, descarta días imposibles y rellena lo que falte. Así el
    // chat no puede colar un plan con formas que el resto de la app no entienda.
    const plan = data?.plan
      ? normalizeWeekPlan(data.plan as Record<string, unknown>, lastUserText(messages), ctx, planId)
      : null;

    return { reply, plan, error: null };
  } catch {
    return { reply: '', plan: null, error: 'network' };
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
      exercises: s.exercises.map((e) => ({
        name: e.name, sets: e.sets, reps_min: e.reps_min, reps_max: e.reps_max,
        value: e.value, weight_kg: e.weight_kg,
      })),
    })),
    protocols: plan.protocols.map((p) => ({
      key: p.key, name: p.name, kind: p.kind, when: p.when,
      weekdays: p.weekdays, weeks: p.weeks, segments: p.segments, note: p.note,
    })),
    nutrition: plan.nutrition.map((n) => ({
      weekday: n.weekday, week: n.week, meals: n.meals,
    })),
  };
}
