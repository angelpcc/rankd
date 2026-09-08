import SectionArt, { type ArtKind } from '@/components/base/SectionArt';

// Cabecera de cada sección de Mi Esquina.
//
// Antes eran fotos de archivo (un gimnasio cualquiera, alguien corriendo por
// una carretera cualquiera). Se veían genéricas y desentonaban con el resto de
// la interfaz, que es dibujo plano en rojo, oro y negro. Ahora cada sección
// lleva su propia ilustración SVG en los colores de marca, con el mismo
// criterio que la diana de Objetivos.
//
// Ventaja de paso: pesan unos cientos de bytes en vez de decenas de kilobytes,
// se ven nítidas en cualquier pantalla y no hay hueco roto si algo no carga.

export type HeroKind = ArtKind;

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

const LEGIBILITY =
  'linear-gradient(100deg, rgba(10,10,11,0.97) 0%, rgba(10,10,11,0.86) 46%, rgba(10,10,11,0.35) 100%)';

export default function SectionHero({ kind, eyebrow, title, subtitle, action }: Props) {
  return (
    <div className="relative w-full overflow-hidden flex flex-col justify-end"
      style={{
        borderRadius: 'var(--r-card)',
        background: 'linear-gradient(150deg, var(--s-1) 0%, #0d0d0d 100%)',
        border: '1px solid var(--s-3)',
        minHeight: action ? 168 : 132,
      }}>
      {/* La ilustración va a sangre por la derecha; el degradado de la
          izquierda garantiza que el texto se lea encima de ella. */}
      <SectionArt kind={kind} className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: LEGIBILITY }} />

      <div className="relative p-5">
        {eyebrow && (
          <p className="rk-eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</p>
        )}
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, lineHeight: 1.02, color: 'var(--t-1)', letterSpacing: '0.01em' }}>
          {title.toUpperCase()}
        </p>
        {subtitle && (
          <p className="mt-1" style={{ fontSize: 13, color: 'var(--t-2)', maxWidth: '30ch' }}>{subtitle}</p>
        )}
        {action && (
          <button onClick={action.onClick} style={{ minHeight: 44 }}
            className="rk-nav-btn rk-press inline-flex items-center gap-2 mt-4">
            {action.icon && <i className={action.icon} />} {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
