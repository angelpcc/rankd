// Migas de pan de sección (R16 · bloque 4).
//
// Da una señalización clara de "dónde estoy" en las pantallas con navegación
// anidada (Mi Esquina, espacio de club, dashboards). Muestra la raíz —que al
// pulsarla vuelve a la sección principal— y la sección actual resaltada. Va
// pegada arriba del contenido para que siempre esté a la vista, también en
// móvil, sin depender de recordar en qué pestaña estás.

interface Props {
  /** Etiqueta de la raíz (p. ej. "Mi Esquina", "Panel"). */
  root: string;
  /** Sección actual (p. ej. "Progreso"). Si es la propia raíz, se omite. */
  section?: string;
  /** Subsección opcional (p. ej. "Fuerza"). */
  sub?: string;
  /** Volver a la raíz (resumen/inicio de la sección). */
  onRoot?: () => void;
  accent?: 'red' | 'gold';
}

export default function PageBreadcrumb({ root, section, sub, onRoot, accent = 'red' }: Props) {
  const accentText = accent === 'gold' ? 'text-[#C9A84C]' : 'text-red-400';
  const showSection = section && section !== root;

  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-xs sm:text-sm mb-4 min-w-0 overflow-x-auto">
      <button
        onClick={onRoot}
        disabled={!onRoot}
        className={`flex items-center gap-1 flex-shrink-0 font-medium transition-colors ${onRoot ? 'text-zinc-400 hover:text-white cursor-pointer' : 'text-zinc-500 cursor-default'}`}
      >
        <i className="ri-home-4-line text-sm" />
        <span className="whitespace-nowrap">{root}</span>
      </button>
      {showSection && (
        <>
          <i className="ri-arrow-right-s-line text-zinc-600 flex-shrink-0" />
          <span className={`font-semibold whitespace-nowrap flex-shrink-0 ${sub ? 'text-zinc-300' : accentText}`}>{section}</span>
        </>
      )}
      {sub && (
        <>
          <i className="ri-arrow-right-s-line text-zinc-600 flex-shrink-0" />
          <span className={`font-semibold whitespace-nowrap flex-shrink-0 ${accentText}`}>{sub}</span>
        </>
      )}
    </nav>
  );
}
