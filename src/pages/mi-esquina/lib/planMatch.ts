// ════════════════════════════════════════════════════════════════
// RANKD · Mi Esquina · ¿Este registro real resuelve este bloque del plan?
//
// UNA sola respuesta a esa pregunta, para TODA Mi Esquina.
//
// ── POR QUÉ EXISTE ESTE ARCHIVO ──
//
// La pregunta se contestaba en dos sitios con dos códigos parecidos pero no
// iguales:
//
//   · `planTicks.ts`     → decide si MARCA el bloque como hecho en la Agenda.
//   · `todayTraining.ts` → decide si lo ESCONDE de "hoy toca".
//
// Parecidos no basta. Cuando uno decía sí y el otro no, el usuario veía la
// Agenda con el entreno hecho y el Resumen insistiendo con "entreno pendiente".
// Eso es exactamente el fallo reportado. Ahora los dos llaman aquí, así que no
// pueden discrepar: si discrepan, es un fallo de ESTE archivo y se arregla en
// un sitio.
//
// ── LA REGLA ──
//
// FUERZA · el bloque queda resuelto si se ha entrenado hoy al menos uno de sus
// grupos musculares. Por GRUPO, no "¿ha entrenado algo?": si planificas Espalda
// y haces Pierna, Espalda SIGUE pendiente y hay que decirlo.
// Excepción: un bloque de fuerza SIN grupos (texto libre, "circuito", lo que
// escribió el asesor sin desglosar) no se puede comparar por grupo — a ese lo
// resuelve cualquier sesión de fuerza del día. Si no, se queda pendiente para
// siempre y no hay forma humana de quitarlo.
//
// ACTIVIDAD · el bloque queda resuelto si se ha registrado hoy una actividad de
// su MISMA FAMILIA. Familia, no tipo exacto: correr y cinta son la misma cosa
// con distinto suelo, y planificar "correr" para luego darle a la cinta no
// puede dejar el aviso colgado.
// Excepción, igual que arriba: "otro" y un bloque sin tipo son comodines — no
// dicen qué actividad es, así que cualquier actividad del día los resuelve.
// Esto importa más de lo que parece: el asesor, cuando no reconocía el cardio
// que él mismo había escrito, lo guardaba como "correr" por defecto, y un
// bloque que en realidad era bici quedaba imposible de resolver. Ahora ese
// caso cae en "otro" y se resuelve con lo que sea que se haya hecho.
//
// ── LO QUE NO HACE ──
// No exige que coincidan ejercicios, series, duración, distancia ni asaltos.
// Es a propósito: el plan es una intención, no un contrato. Apretar aquí
// significa dejar avisos colgados, y un aviso colgado se ignora — y a partir de
// ahí se ignoran todos.
// ════════════════════════════════════════════════════════════════

import { ACTIVITY_KINDS, type ActivityPayload, type StrengthPayload } from './dayPlan';

/**
 * Actividades que resuelven el mismo bloque.
 *
 * Un tipo que no esté aquí es su propia familia: añadir uno nuevo a
 * `ACTIVITY_KINDS` no obliga a tocar este mapa, solo lo hace si de verdad es
 * intercambiable con otro (y casi nunca lo es).
 */
const ACTIVITY_FAMILY: Record<string, string> = {
  // Correr por la calle y correr en cinta: la misma sesión.
  correr: 'run',
  cinta: 'run',
};

/** Los tipos que la app conoce de verdad. Cualquier otro no significa nada. */
const KNOWN_KINDS = new Set(ACTIVITY_KINDS.map((k) => k.value));

/**
 * Tipos que no dicen qué actividad es. Cualquier actividad del día los resuelve.
 *
 * Son tres casos, y los tres van juntos a propósito:
 *   · 'otro'      → el usuario (o el asesor) eligió el cajón de sastre.
 *   · '' / null   → el bloque se guardó sin tipo.
 *   · desconocido → un tipo que esta versión de la app no conoce (lo escribió
 *                   la IA, o venía de una versión anterior). No se puede
 *                   comparar con nada, así que tratarlo como concreto lo dejaba
 *                   pendiente para siempre.
 */
const WILDCARD_KINDS = new Set(['otro']);

/** Familia de un tipo de actividad. Lo que se compara de verdad. */
export function activityFamily(kind: string | null | undefined): string {
  const k = (kind || '').trim().toLowerCase();
  return ACTIVITY_FAMILY[k] || k;
}

/** ¿Es un tipo comodín (no concreta la actividad)? */
export function isWildcardKind(kind: string | null | undefined): boolean {
  const k = (kind || '').trim().toLowerCase();
  return k === '' || WILDCARD_KINDS.has(k) || !KNOWN_KINDS.has(k);
}

/**
 * Lo que de VERDAD se ha registrado en un día.
 *
 * Se construye una vez por día y se pasa a cada comparación: así una pantalla
 * con veinte bloques no lanza veinte consultas.
 */
export interface DayFacts {
  /** Grupos musculares entrenados (de `strength_sets`). */
  groups: Set<string>;
  /** Tipos de actividad registrados, TAL CUAL (de `activity_sessions`). */
  kinds: Set<string>;
  /** ¿Hay alguna serie de fuerza registrada ese día? */
  anyStrength: boolean;
  /** ¿Hay alguna actividad registrada ese día? */
  anyActivity: boolean;
}

/** Contenedor vacío, para arrancar antes de leer nada. */
export function emptyDayFacts(): DayFacts {
  return { groups: new Set(), kinds: new Set(), anyStrength: false, anyActivity: false };
}

/**
 * Construye los hechos del día a partir de las filas ya leídas.
 *
 * Recibe las filas en vez de consultarlas para no imponer una consulta: cada
 * pantalla ya lee lo que necesita (unas piden solo fuerza, otras las dos cosas)
 * y aquí solo se normaliza.
 *
 * `muscle_group` llega a null en filas anteriores a la migración 0029: en ese
 * caso el grupo se deduce del nombre con `resolveGroup`, que le pasa quien
 * llama (para no arrastrar la biblioteca de ejercicios hasta aquí).
 */
export function buildDayFacts(
  strengthRows: { muscle_group?: string | null; exercise_label?: string | null }[],
  activityRows: { kind?: string | null }[],
  resolveGroup?: (label: string) => string | null,
): DayFacts {
  const facts = emptyDayFacts();

  for (const r of strengthRows) {
    facts.anyStrength = true;
    const g = r.muscle_group
      || (r.exercise_label && resolveGroup ? resolveGroup(r.exercise_label) : null);
    if (g) facts.groups.add(g);
  }
  for (const r of activityRows) {
    facts.anyActivity = true;
    const k = (r.kind || '').trim();
    if (k) facts.kinds.add(k);
  }

  return facts;
}

/** ¿Resuelve lo entrenado hoy este bloque de FUERZA? */
export function strengthCovered(payload: StrengthPayload | null | undefined, facts: DayFacts): boolean {
  const groups = (payload?.groups || []).filter(Boolean);
  // Sin grupos no hay nada que comparar: lo resuelve cualquier sesión de fuerza.
  if (groups.length === 0) return facts.anyStrength;
  return groups.some((g) => facts.groups.has(g));
}

/** ¿Resuelve lo registrado hoy este bloque de ACTIVIDAD? */
export function activityCovered(payload: ActivityPayload | null | undefined, facts: DayFacts): boolean {
  const kind = payload?.kind;
  // Comodín: no dice qué actividad es, así que cualquiera vale.
  if (isWildcardKind(kind)) return facts.anyActivity;
  const fam = activityFamily(kind);
  for (const k of facts.kinds) {
    if (activityFamily(k) === fam) return true;
    // Lo registrado como "otro" tampoco concreta: resuelve cualquier bloque.
    if (isWildcardKind(k)) return true;
  }
  return false;
}

/**
 * ¿Resuelve lo registrado hoy este bloque del plan?
 *
 * Comidas, suplementos y notas devuelven `false` siempre: son anotaciones, no
 * registros, y nadie las marca automáticamente.
 */
export function coversPlanItem(
  kind: string,
  payload: StrengthPayload | ActivityPayload | null | undefined,
  facts: DayFacts,
): boolean {
  if (kind === 'strength') return strengthCovered(payload as StrengthPayload, facts);
  if (kind === 'activity') return activityCovered(payload as ActivityPayload, facts);
  return false;
}
