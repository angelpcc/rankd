import { SECTION_COLOR, tinte } from '../lib/sectionTheme';

// Cabecera de cada sección de Mi Esquina.
//
// ── v4: DE BANNER A CABECERA ──
//
// Era una foto a sangre de proporción 21:7: en el ordenador, 380 px de alto
// antes de ver un solo dato; en el móvil, media pantalla. Cada sección
// empezaba igual —foto, título en mayúsculas— y lo que venías a hacer quedaba
// debajo del pliegue.
//
// Ahora es una franja de ~100 px: el icono en el color de la sección, el
// título y una línea que dice qué hay aquí, y la foto se queda como textura a
// la derecha, fundida con el fondo. Sigue siendo visual —cada sección tiene su
// color y su imagen— pero el contenido empieza arriba.
//
// Misma interfaz que antes (kind, eyebrow, title, subtitle, action): las siete
// secciones que la usan cambian sin tocarlas.

export type HeroKind = 'strength' | 'activity' | 'agenda' | 'nutrition' | 'ring' | 'advisor' | 'weight';

const HERO: Record<HeroKind, { image?: string; icon: string; color: string }> = {
  strength:  { image: '/images/fuerza.webp',    icon: 'ri-hammer-line',        color: SECTION_COLOR.fuerza },
  activity:  { image: '/images/correr.webp',    icon: 'ri-run-line',           color: SECTION_COLOR.actividad },
  nutrition: { image: '/images/nutricion.webp', icon: 'ri-restaurant-2-line',  color: SECTION_COLOR.nutricion },
  ring:      { image: '/images/sparring.webp',  icon: 'ri-boxing-line',        color: SECTION_COLOR.ring },
  agenda:    {                                  icon: 'ri-calendar-todo-line', color: SECTION_COLOR.agenda },
  advisor:   { image: '/images/guantes.webp',   icon: 'ri-sparkling-2-line',   color: SECTION_COLOR.asesor },
  weight:    {                                  icon: 'ri-scales-2-line',      color: SECTION_COLOR.peso },
};

interface Props {
  kind: HeroKind;
  /** Eyebrow corto (mayúsculas). */
  eyebrow?: string;
  title: string;
  /** Una línea con un dato de la sección. */
  subtitle?: string;
  /** Acción opcional (botón secundario: el rojo se reserva a la acción principal). */
  action?: { label: string; icon?: string; onClick: () => void };
}

export default function SectionHero({ kind, eyebrow, title, subtitle, action }: Props) {
  const h = HERO[kind];
  return (
    <header className="rk-sec-hero" style={{ ['--sec' as string]: h.color }}>
      {/* La foto, como textura a la derecha. Sin foto, una rejilla fina. */}
      <div aria-hidden className="rk-sec-hero-bg"
        style={h.image ? { backgroundImage: `url(${h.image})` } : undefined}
        data-sin-foto={h.image ? undefined : ''} />
      <div aria-hidden className="rk-sec-hero-glow" style={{ background: `radial-gradient(420px 160px at 0% 0%, ${tinte(h.color, 0.16)}, transparent 70%)` }} />

      <div className="relative flex items-center gap-3.5 sm:gap-4">
        <span className="rk-sec-hero-icon" style={{ background: tinte(h.color, 0.14), borderColor: tinte(h.color, 0.32), color: h.color }}>
          <i className={h.icon} />
        </span>
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="rk-label" style={{ color: h.color }}>{eyebrow}</p>}
          <h1 className="rk-sec-hero-title">{title}</h1>
          {subtitle && <p className="rk-sec-hero-sub">{subtitle}</p>}
        </div>
        {action && (
          <button onClick={action.onClick}
            className="rk-nav-btn rk-press hidden sm:inline-flex items-center gap-2 flex-shrink-0" style={{ minHeight: 42 }}>
            {action.icon && <i className={action.icon} />} {action.label}
          </button>
        )}
      </div>
      {/* En el móvil la acción baja a su propia línea: al lado del título no cabe. */}
      {action && (
        <button onClick={action.onClick}
          className="rk-nav-btn rk-press sm:hidden relative mt-3 inline-flex items-center gap-2" style={{ minHeight: 42 }}>
          {action.icon && <i className={action.icon} />} {action.label}
        </button>
      )}
    </header>
  );
}
