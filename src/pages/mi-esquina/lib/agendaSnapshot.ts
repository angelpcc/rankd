// ════════════════════════════════════════════════════════════════
// RANKD · Lo que HAY PUESTO de verdad en la agenda
//
// ── POR QUÉ EXISTE ──
//
// El chat del plan solo conocía el plan de SU conversación. Si la conversación
// se había reiniciado, o el plan se guardó desde otro sitio, o se tocó algo a
// mano en la Agenda, el chat no lo sabía: le decías "reajústame el cardio de
// esta semana" y te contestaba que no tiene ningún plan previo — mientras el
// plan estaba ahí, en la Agenda, delante de los dos.
//
// Y aunque conserve el plan de la conversación, ESE plan es una foto de lo que
// se generó, no de lo que hay. Si después moviste el jueves, borraste un
// cardio o marcaste un día como hecho, el plan de la conversación miente.
//
// La verdad son los bloques del día (`day_plan_items`). Esto los lee y los deja
// en una forma corta que se le pueda enseñar al modelo sin gastar medio
// presupuesto de tokens.
//
// ── QUÉ SE INCLUYE Y QUÉ NO ──
//
// Va lo que define el entreno: fuerza, actividad y comidas, con su día y si ya
// está hecho. NO van los suplementos ni las notas: no se reprograman y solo
// ocupan sitio.
//
// Lo HECHO se marca expresamente. Es el dato que impide la peor respuesta
// posible —proponerte mover el martes cuando el martes ya lo entrenaste—, y
// tiene que llegar hasta el modelo, no quedarse en la comprobación del guardado.
// ════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import {
  ACTIVITY_KINDS, isoOf,
  type ActivityPayload, type DayPlanKind, type MealPayload, type StrengthPayload,
} from './dayPlan';

/** Un bloque, resumido en una línea legible. */
export interface AgendaBloque {
  kind: DayPlanKind;
  /** Lo que se lee: "Empuje — press banca 4x8…", "Cinta · 45 min". */
  text: string;
  /** Ya entrenado. Lo hecho no se toca: es un hecho, no una intención. */
  done: boolean;
}

export interface AgendaDia {
  /** Fecha ISO. */
  date: string;
  /** 0 = lunes … 6 = domingo. Es como habla el plan. */
  weekday: number;
  /** Semanas desde `weekStart` (0 = la primera). */
  week: number;
  items: AgendaBloque[];
}

interface Row {
  plan_date: string;
  kind: string;
  payload: Record<string, unknown> | null;
  completed: boolean;
  source: string | null;
}

/** Nombre corto del tipo de actividad, sin depender de i18n. */
function nombreActividad(kind: string): string {
  const cfg = ACTIVITY_KINDS.find((k) => k.value === kind);
  return cfg ? cfg.value : kind;
}

/** Resume un bloque en una línea. Corto a propósito: el modelo lo lee entero. */
function resumir(kind: string, payload: Record<string, unknown> | null): string {
  const p = payload || {};
  if (kind === 'strength') {
    const s = p as unknown as StrengthPayload;
    const cab = s.routine_name || (s.groups || []).join(' + ') || 'fuerza';
    const ejs = Array.isArray(s.exercises)
      ? s.exercises.slice(0, 8).map((e) => {
        const reps = e.reps_max && e.reps_max !== e.reps_min ? `${e.reps_min}-${e.reps_max}` : e.reps_min;
        return `${e.name} ${e.sets}x${reps ?? ''}`.trim();
      })
      : [];
    return ejs.length ? `${cab}: ${ejs.join(', ')}` : cab;
  }
  if (kind === 'activity') {
    const a = p as unknown as ActivityPayload;
    const bits = [a.protocol_name || nombreActividad(a.kind)];
    if (a.protocol_name) bits.push(`(${nombreActividad(a.kind)})`);
    if (a.duration_min) bits.push(`${a.duration_min} min`);
    if (a.distance_km) bits.push(`${a.distance_km} km`);
    if (a.rounds) bits.push(`${a.rounds} asaltos`);
    if (a.note) bits.push(String(a.note).slice(0, 120));
    return bits.join(' · ');
  }
  if (kind === 'meal') {
    const m = p as unknown as MealPayload;
    return `${m.slot}: ${String(m.text || '').slice(0, 120)}`;
  }
  return '';
}

/**
 * Lee la agenda desde `weekStart` durante `weeks` semanas.
 *
 * Solo entreno y comidas, y solo días con algo: mandar catorce días vacíos es
 * pagar tokens por decir que no hay nada.
 */
export async function loadAgendaSnapshot(
  profileId: string,
  weekStart: string,
  weeks: number,
): Promise<AgendaDia[]> {
  const total = Math.max(1, Math.min(8, weeks || 1));
  const ini = new Date(`${weekStart}T12:00:00`);
  const fin = new Date(ini);
  fin.setDate(fin.getDate() + total * 7 - 1);

  const { data, error } = await supabase
    .from('day_plan_items')
    .select('plan_date, kind, payload, completed, source')
    .eq('fighter_profile_id', profileId)
    .gte('plan_date', isoOf(ini))
    .lte('plan_date', isoOf(fin))
    .in('kind', ['strength', 'activity', 'meal'])
    .order('plan_date', { ascending: true });

  // Sin tabla o con error, el chat sigue funcionando sin esta ayuda: es
  // contexto, no un requisito. Devolver [] es "no sé qué hay", que es la verdad.
  if (error || !data) return [];

  const porFecha = new Map<string, AgendaBloque[]>();
  for (const r of data as Row[]) {
    // Los `logged` son el recibo de algo ya entrenado, no un plan. Se ignoran:
    // lo que importa de ellos —que ese día está hecho— ya viaja en `done`.
    if (r.source === 'logged') continue;
    const text = resumir(r.kind, r.payload);
    if (!text) continue;
    const lista = porFecha.get(r.plan_date) || [];
    lista.push({ kind: r.kind as DayPlanKind, text, done: !!r.completed });
    porFecha.set(r.plan_date, lista);
  }

  const dias: AgendaDia[] = [];
  for (const [date, items] of porFecha) {
    const d = new Date(`${date}T12:00:00`);
    const js = d.getDay();
    dias.push({
      date,
      weekday: js === 0 ? 6 : js - 1,
      // Se redondea a DÍAS antes de dividir por 7, y no se divide la resta de
      // milisegundos directamente.
      //
      // El último domingo de MARZO el reloj se adelanta una hora, así que dos
      // fechas separadas por siete días reales distan 167 horas y no 168.
      // Dividiendo en crudo eso da 6,96 y el lunes de la segunda semana se
      // reportaría como de la primera: un plan de dos semanas descolocado
      // entero, una vez al año y muy difícil de ver.
      //
      // (En octubre, que atrasa, pasan 169 horas y el cálculo crudo acierta por
      // casualidad. Solo falla en una de las dos direcciones, que es justo lo
      // que hace que un fallo así sobreviva años.)
      week: Math.floor(Math.round((d.getTime() - ini.getTime()) / 86400000) / 7),
      items,
    });
  }
  return dias.sort((a, b) => a.date.localeCompare(b.date));
}
