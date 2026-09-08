// Vigencia por fecha de los suplementos (migración 0048).
//
// La lista de suplementos es un ESTADO PRESENTE, y la Agenda mira días
// concretos, muchos de ellos pasados. Sin fechas, añadir omega-3 hoy lo haría
// aparecer también el martes pasado, cuando no lo tomabas: sería reescribir el
// historial hacia atrás.
//
// Por eso cada suplemento tiene un intervalo: `started_on` (desde cuándo) y
// `ended_on` (hasta cuándo, NULL = se sigue tomando). Quitar uno no lo borra,
// le pone fecha de fin.

/** Lo mínimo que hace falta para decidir si estaba vigente un día. */
export interface SupplementValidity {
  /** Desde qué día se toma. Ausente = migración sin aplicar. */
  started_on?: string | null;
  /** Día en que se dejó de tomar. NULL = se sigue tomando. */
  ended_on?: string | null;
}

/**
 * ¿Estaba vigente este suplemento el día `iso` (YYYY-MM-DD)?
 *
 * El intervalo es cerrado por abajo y ABIERTO por arriba: el día en que se
 * deja de tomar ya no lo muestra. Es lo que espera el usuario al pulsar
 * "dejar de tomar" hoy: hoy ya no aparece, ayer sí.
 *
 * Sin las columnas de la 0048 devuelve siempre true, que es el comportamiento
 * anterior (todo vigente siempre).
 */
export function supplementActiveOn(s: SupplementValidity, iso: string): boolean {
  if (s.started_on && iso < s.started_on) return false;
  if (s.ended_on && iso >= s.ended_on) return false;
  return true;
}

/** Filtra una lista por vigencia en un día concreto. */
export function activeSupplementsOn<T extends SupplementValidity>(list: T[], iso: string): T[] {
  return list.filter((s) => supplementActiveOn(s, iso));
}

/** Fecha de hoy en formato ISO local (no UTC: importa el día del usuario). */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
