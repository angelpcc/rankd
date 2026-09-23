// ════════════════════════════════════════════════════════════════
// RANKD · Mi Esquina · El color de cada sección
//
// ── POR QUÉ UN COLOR POR SECCIÓN ──
//
// Todo era rojo: el menú activo, las pestañas, los botones, los avisos. Cuando
// todo es rojo, nada destaca, y encontrar una sección obligaba a leer las
// etiquetas una a una.
//
// Ahora cada sección tiene su color: el icono del menú, la cabecera de la
// sección y la tarjeta del registro rápido lo comparten. Se reconoce Fuerza por
// el naranja o Nutrición por el azul antes de leer nada. El rojo de RANKD se
// queda para lo que es acción (el botón principal) y para el Resumen.
//
// Los de fuerza, actividad y comida son los MISMOS que ya usaba la Agenda para
// sus bloques (KIND_META en dayPlan.ts): un naranja de fuerza en el menú y otro
// naranja distinto en la agenda serían dos idiomas.
// ════════════════════════════════════════════════════════════════

export type SectionId =
  | 'resumen' | 'agenda' | 'peso' | 'fuerza' | 'actividad' | 'nutricion'
  | 'asesor' | 'ring' | 'timer' | 'documentos' | 'compartir';

export const SECTION_COLOR: Record<SectionId, string> = {
  resumen: '#E10600',
  agenda: '#818CF8',
  peso: '#C9A84C',
  fuerza: '#FB923C',
  actividad: '#4ADE80',
  nutricion: '#38BDF8',
  asesor: '#A78BFA',
  ring: '#F43F5E',
  timer: '#2DD4BF',
  documentos: '#94A3B8',
  compartir: '#94A3B8',
};

/** El color con transparencia, para fondos de icono y halos. */
export function tinte(hex: string, alfa: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}
