// Detecta el error típico de "la tabla aún no existe" (migración sin aplicar).
// Mi Esquina se construye por delante de las migraciones: hasta que el usuario
// las ejecuta a mano en Supabase, las secciones nuevas muestran un estado
// "en camino" cuidado en vez de romperse.
export function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();
  return (
    code === '42P01' ||       // undefined_table (Postgres)
    code === 'PGRST205' ||    // PostgREST: tabla no encontrada en el esquema
    code === 'PGRST200' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  );
}

// Detecta el error de "esa columna aún no existe" (migración aditiva sin
// aplicar). Permite insertar con las columnas nuevas y, si fallan, reintentar
// sin ellas — igual que hace GearChecklist con la vida útil del material.
/**
 * Saca el NOMBRE de la columna que falta del mensaje de error.
 *
 * Los dos formatos que llegan:
 *   · Postgres 42703 → "column strength_sets.machine_label does not exist"
 *   · PostgREST PGRST204 → "Could not find the 'machine_label' column of
 *     'strength_sets' in the schema cache"
 *
 * Sirve para reintentar quitando SOLO esa columna en vez de tirar todas las
 * opcionales de golpe. Sin esto, a una base a la que le falta una sola columna
 * se le acababan guardando las filas peladas, perdiendo datos que sí admitía.
 *
 * Devuelve null si el mensaje no nombra ninguna columna reconocible.
 */
export function missingColumnName(error: { code?: string; message?: string } | null | undefined): string | null {
  if (!error) return null;
  const msg = error.message || '';
  // PostgREST: la columna va entre comillas simples.
  const rest = msg.match(/could not find the '([^']+)' column/i);
  if (rest) return rest[1];
  // Postgres: tabla.columna, o solo la columna entre comillas.
  const pg = msg.match(/column\s+"?(?:[\w.]+\.)?([\w]+)"?\s+does not exist/i);
  if (pg) return pg[1];
  return null;
}

export function isMissingColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();
  return (
    code === '42703' ||       // undefined_column (Postgres)
    code === 'PGRST204' ||    // PostgREST: columna no encontrada en el esquema
    (msg.includes('column') && (msg.includes('does not exist') || msg.includes('could not find')))
  );
}

/**
 * Ejecuta una escritura quitando UNA A UNA las columnas que la base todavía no
 * tiene, en vez de tirar de golpe todas las opcionales.
 *
 * Mi Esquina se construye por delante de las migraciones, así que es normal que
 * a una base le falte alguna columna suelta. El reintento antiguo era "si falla
 * algo, quita todas las opcionales": bastaba con que faltara UNA para que se
 * guardaran filas peladas, perdiendo grupo muscular, rango de repeticiones o
 * modo de peso que esa base sí soportaba.
 *
 * Aquí se lee del error qué columna concreta falta, se quita solo esa y se
 * reintenta. `protectedKeys` son las que nunca deben quitarse (si falta una de
 * esas, el problema es otro y se devuelve el error tal cual).
 *
 * @param rows filas a escribir
 * @param run  hace la escritura con las filas que se le pasen
 * @param protectedKeys columnas imprescindibles
 * @param maxAttempts tope de reintentos, para no entrar en bucle si el mensaje
 *                    no se puede interpretar
 */
export async function writeDroppingMissingColumns<
  Row extends Record<string, unknown>,
  // PromiseLike, no Promise: los builders de Supabase son "thenables" y no
  // traen catch/finally hasta que se les hace await.
  Res extends { error: { code?: string; message?: string } | null },
>(
  rows: Row[],
  run: (rows: Record<string, unknown>[]) => PromiseLike<Res>,
  protectedKeys: string[] = [],
  maxAttempts = 8,
): Promise<{ result: Res; dropped: string[] }> {
  let current: Record<string, unknown>[] = rows;
  const dropped: string[] = [];
  let result = await run(current);
  for (let i = 0; i < maxAttempts && isMissingColumn(result.error); i += 1) {
    const col = missingColumnName(result.error);
    // Sin nombre reconocible, o es una columna imprescindible: no se puede
    // arreglar quitando nada, así que se devuelve el error como está.
    if (!col || protectedKeys.includes(col)) break;
    // Ya la habíamos quitado: el mensaje no avanza, cortamos para no ciclar.
    if (dropped.includes(col)) break;
    dropped.push(col);
    current = current.map((r) => {
      const copy = { ...r };
      delete copy[col];
      return copy;
    });
    result = await run(current);
  }
  return { result, dropped };
}
