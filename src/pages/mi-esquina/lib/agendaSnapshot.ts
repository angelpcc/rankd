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

/** Un día de los que ya han pasado, con lo que se hizo DE VERDAD. */
export interface DiaEntrenado {
  date: string;
  /** "fuerza: pecho, espalda" · "cinta 45 min" — corto, para leerlo entero. */
  text: string;
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
 * Lo que se ha ENTRENADO de verdad en los últimos días.
 *
 * La agenda dice lo planificado y marca lo hecho, pero solo de lo que estaba
 * planificado. Lo que entrenas por tu cuenta —sales a correr un domingo, haces
 * una sesión extra— no aparece por ningún lado, y el asesor no se enteraba:
 * te proponía "esta semana no has hecho cardio" habiendo salido dos veces.
 *
 * Sale de las tablas de sesiones reales, que es el registro de los hechos.
 * Siete días: lo justo para saber cómo llega esta semana sin arrastrar un mes.
 */
export async function loadTrainedRecent(profileId: string, days = 7): Promise<DiaEntrenado[]> {
  const desde = new Date();
  desde.setDate(desde.getDate() - Math.max(1, days));
  const desdeISO = isoOf(desde);
  const hoy = isoOf(new Date());

  const [fuerza, actividad] = await Promise.all([
    supabase.from('strength_sets')
      .select('session_date, muscle_group')
      .eq('fighter_profile_id', profileId)
      .gte('session_date', desdeISO).lte('session_date', hoy),
    supabase.from('activity_sessions')
      .select('session_date, kind, duration_min')
      .eq('fighter_profile_id', profileId)
      .gte('session_date', desdeISO).lte('session_date', hoy),
  ]);

  const porDia = new Map<string, { grupos: Set<string>; act: string[] }>();
  const tocar = (d: string) => {
    const x = porDia.get(d) || { grupos: new Set<string>(), act: [] };
    porDia.set(d, x);
    return x;
  };

  for (const r of ((fuerza.data || []) as { session_date: string; muscle_group: string }[])) {
    if (r.muscle_group) tocar(r.session_date).grupos.add(r.muscle_group);
  }
  for (const r of ((actividad.data || []) as { session_date: string; kind: string; duration_min: number | null }[])) {
    tocar(r.session_date).act.push(r.duration_min ? `${r.kind} ${r.duration_min} min` : r.kind);
  }

  return [...porDia.entries()]
    .map(([date, x]) => {
      const partes: string[] = [];
      if (x.grupos.size > 0) partes.push(`fuerza: ${[...x.grupos].join(', ')}`);
      // Sin repetir: dos entradas de "cinta 45 min" el mismo día se dicen una vez.
      if (x.act.length > 0) partes.push([...new Set(x.act)].join(' · '));
      return { date, text: partes.join(' · ') };
    })
    .filter((d) => d.text)
    .sort((a, b) => a.date.localeCompare(b.date));
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
