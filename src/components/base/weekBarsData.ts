// Los datos de la tira de 7 días, aparte del componente que los pinta.
//
// ── POR QUÉ EN SU PROPIO FICHERO ──
//
// `last7Days` es una función pura: no pinta nada y no necesita React. Vivía
// dentro de `WeekBars.tsx`, y eso tiene dos costes:
//
//   1. Quien solo quiere calcular los siete días se traía el componente entero.
//   2. Un fichero que exporta componentes Y funciones rompe el refresco en
//      caliente de Vite: al tocarlo, en vez de recargar solo ese componente,
//      recarga la página y pierdes el estado de lo que estuvieras probando.
//
// El segundo es el que avisaba el linter, y tenía razón.

export interface WeekBarDay {
  /** YYYY-MM-DD */
  iso: string;
  /** Valor del día. null = ese día no hay dato (hueco, no cero). */
  value: number | null;
}

/**
 * Últimos 7 días terminando HOY, con el valor que le corresponda a cada uno.
 *
 * Los días sin dato salen con `null`, no con cero: no es lo mismo "ese día comí
 * 0 kcal" que "ese día no apunté nada", y pintarlos igual sería inventarse un
 * dato que el usuario no ha dado.
 */
export function last7Days(valueByISO: Map<string, number>): WeekBarDay[] {
  const out: WeekBarDay[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    // Mediodía y no medianoche: con la hora a cero, un cambio de horario o un
    // desfase de zona puede tirar la fecha al día anterior.
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push({ iso, value: valueByISO.has(iso) ? valueByISO.get(iso)! : null });
  }
  return out;
}
