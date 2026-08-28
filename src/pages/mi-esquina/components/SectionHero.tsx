import PhotoCard from '@/components/base/PhotoCard';

// Cabecera "hero" de cada sección de Mi Esquina: mismo tratamiento que la card
// HOY del Resumen (fondo a sangre + degradado + título encima) pero adaptado a
// cada sección — imagen, icono y color propios. El fondo diseñado de PhotoCard
// se usa si el SVG no carga.

export type HeroKind = 'strength' | 'activity' | 'agenda' | 'nutrition';

const HERO: Record<HeroKind, { image: string; icon: string }> = {
  strength:  { image: '/images/hero-strength.svg',  icon: 'ri-hammer-line' },
  activity:  { image: '/images/hero-activity.svg',  icon: 'ri-run-line' },
  agenda:    { image: '/images/hero-agenda.svg',    icon: 'ri-calendar-todo-line' },
  nutrition: { image: '/images/hero-nutrition.svg', icon: 'ri-restaurant-2-line' },
};

interface Props {
  kind: HeroKind;
  /** Eyebrow corto (mayúsculas). */
  eyebrow?: string;
  title: string;
  /** Una línea con un dato de la sección. */
  subtitle?: string;
  /** Acción opcional (se pinta como pill translúcido, no como CTA rojo). */
  action?: { label: string; icon?: string; onClick: () => void };
}

export default function SectionHero({ kind, eyebrow, title, subtitle, action }: Props) {
  const h = HERO[kind];
  return (
    <PhotoCard
      image={h.image}
      icon={h.icon}
      aspect="21 / 7"
      chips={eyebrow ? (
        <span style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--t-1)', borderRadius: 'var(--r-pill)', padding: '4px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {eyebrow}
        </span>
      ) : undefined}
      title={title.toUpperCase()}
      subtitle={subtitle}
      footer={action ? (
        <button onClick={action.onClick} className="rk-nav-btn inline-flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.1)' }}>
          {action.icon && <i className={action.icon}></i>} {action.label}
        </button>
      ) : undefined}
    />
  );
}
