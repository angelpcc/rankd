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
