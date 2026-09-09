import SectionArt, { type ArtKind } from './SectionArt';
import { useState } from 'react';

interface Props {
  /**
   * Ilustración propia de sección. Tiene PRIORIDAD sobre `image`: donde hay
   * arte de marca no queremos foto de archivo. Ver SectionArt.
   */
  art?: ArtKind;
  /** Ruta de imagen en /images. Si falta o falla, se pinta un fondo diseñado. */
  image?: string;
  /** Pills arriba-izquierda. */
  chips?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Remix icon para el watermark fantasma del fondo diseñado. */
  icon?: string;
  onClick?: () => void;
  /** CSS aspect-ratio. Por defecto '16 / 11'. */
  aspect?: string;
  /** object-position de la imagen de fondo (p. ej. 'center top' para retratos). */
  objectPosition?: string;
  /** Contenido fijo al pie (CTA). */
  footer?: React.ReactNode;
  /** Sombra + glow (solo para la card principal de una pantalla). */
  primary?: boolean;
  className?: string;
}

// Franja oscura bajo el texto. Antes bajaba a 0.4 en el 52 %, y en las cards
// bajas (heroes 21/7) el título caía justo en esa zona clara: sobre una foto
// con partes brillantes no se leía. Ahora la rampa es más larga y más densa
// donde va el texto, y sigue dejando ver la foto arriba.
const LEGIBILITY =
  'linear-gradient(to top, rgba(10,10,11,0.96) 0%, rgba(10,10,11,0.78) 34%, rgba(10,10,11,0.42) 68%, rgba(10,10,11,0.08) 100%)';

// Cinturón de seguridad: aunque el degradado falle sobre una foto muy clara,
// el texto sigue teniendo borde propio.
const TEXT_SHADOW = '0 2px 10px rgba(0,0,0,0.85)';

/**
 * Card con imagen a sangre + degradado de legibilidad + texto encima. Es el
 * componente que da aspecto de producto: sustituye a las cajas de color plano.
 * Sin imagen (o si la imagen falla) pinta un fondo diseñado — nunca un hueco.
 */
export default function PhotoCard({
  art, image, chips, title, subtitle, icon, onClick, aspect = '16 / 11', objectPosition, footer, primary, className = '',
}: Props) {
  const [imgOk, setImgOk] = useState(true);
  const showImage = !art && !!image && imgOk;
  // Nunca un <button> exterior: el footer suele traer su propio CTA (no anidar
  // interactivos). Si hay onClick y NO hay footer, la card entera es clicable.
  const cardClickable = !!onClick && !footer;

  return (
    <div
      onClick={cardClickable ? onClick : undefined}
      role={cardClickable ? 'button' : undefined}
      tabIndex={cardClickable ? 0 : undefined}
      className={`relative w-full overflow-hidden text-left flex flex-col justify-end ${cardClickable ? 'cursor-pointer' : ''} ${className}`}
      style={{
        borderRadius: 'var(--r-card)',
        minHeight: footer ? 210 : 168,
        aspectRatio: footer ? undefined : aspect,
        boxShadow: primary ? 'var(--accent-glow), 0 8px 24px rgba(0,0,0,0.45)' : undefined,
      }}
    >
      {/* Fondo (capa absoluta detrás del contenido en flujo) */}
      {art ? (
        <div className="absolute inset-0" style={{ background: 'linear-gradient(150deg, var(--s-1) 0%, #0d0d0d 100%)' }}>
          <SectionArt kind={art} className="absolute inset-0 w-full h-full" />
        </div>
      ) : showImage ? (
        <img src={image} alt="" onError={() => setImgOk(false)} className="absolute inset-0 w-full h-full object-cover" style={objectPosition ? { objectPosition } : undefined} />
      ) : (
        <div className="absolute inset-0" style={{ background: 'linear-gradient(150deg, var(--s-1) 0%, #0d0d0d 100%)' }}>
          <div className="absolute inset-0 rk-grid-bg" style={{ opacity: 0.4 }} />
          <div className="rk-glow-red" style={{ inset: '-30% -20% auto -20%', height: '70%' }} />
          {icon && (
            <i className={icon} style={{ position: 'absolute', right: -20, bottom: -40, fontSize: 200, color: 'rgba(255,255,255,0.05)', lineHeight: 1 }} />
          )}
        </div>
      )}
      <div className="absolute inset-0 pointer-events-none" style={{ background: LEGIBILITY }} />

      {/* Chips */}
      {chips && <div className="absolute top-4 left-4 flex flex-wrap gap-2">{chips}</div>}

      {/* Texto (en flujo, alineado abajo por el flex del contenedor) */}
      <div className="relative p-5">
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, lineHeight: 1.05, color: 'var(--t-1)', letterSpacing: '0.01em', textShadow: TEXT_SHADOW }}>
          {title}
        </p>
        {subtitle && <p className="mt-1" style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', textShadow: TEXT_SHADOW, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{subtitle}</p>}
        {footer && <div className="mt-4">{footer}</div>}
      </div>
    </div>
  );
}
