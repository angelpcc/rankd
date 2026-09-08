import PhotoCard from '@/components/base/PhotoCard';

// Cabecera de cada sección de Mi Esquina.
//
// Foto real donde la foto funciona (Fuerza, Actividad, Nutrición, Ring: las
// que ya había y quedaban bien) e ilustración propia donde no hay una foto que
// aporte. No es todo-o-nada: sustituir las buenas por dibujos fue un error.
//
// Si la foto no carga, PhotoCard pinta su fondo diseñado — nunca un hueco.

export type HeroKind = 'strength' | 'activity' | 'agenda' | 'nutrition' | 'ring';

// Fotos reales (Unsplash, licencia libre) en WebP. `art` solo donde la foto no
// aportaba nada mejor que un dibujo.
const HERO: Record<HeroKind, { image?: string; art?: 'agenda'; icon: string }> = {
  strength:  { image: '/images/fuerza.webp',    icon: 'ri-hammer-line' },
  activity:  { image: '/images/correr.webp',    icon: 'ri-run-line' },
  nutrition: { image: '/images/nutricion.webp', icon: 'ri-restaurant-2-line' },
  ring:      { image: '/images/sparring.webp',  icon: 'ri-boxing-line' },
  // La foto de silueta no decía nada de una agenda; la rejilla de mes sí.
  agenda:    { art: 'agenda',                   icon: 'ri-calendar-todo-line' },
};

interface Props {
  kind: HeroKind;
  /** Eyebrow corto (mayúsculas). */
  eyebrow?: string;
  title: string;
  /** Una línea con un dato de la sección. */
  subtitle?: string;
  /** Acción opcional (pill translúcido, no CTA rojo: el rojo se reserva). */
  action?: { label: string; icon?: string; onClick: () => void };
}

export default function SectionHero({ kind, eyebrow, title, subtitle, action }: Props) {
  const h = HERO[kind];
  return (
    <PhotoCard
      art={h.art}
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
        <button onClick={action.onClick} style={{ minHeight: 44 }}
          className="rk-nav-btn rk-press inline-flex items-center gap-2">
          {action.icon && <i className={action.icon} />} {action.label}
        </button>
      ) : undefined}
    />
  );
}
