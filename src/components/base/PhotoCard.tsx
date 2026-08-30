import { useState } from 'react';

interface Props {
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

const LEGIBILITY =
  'linear-gradient(to top, rgba(10,10,11,0.94) 0%, rgba(10,10,11,0.4) 52%, rgba(10,10,11,0.05) 100%)';

/**
 * Card con imagen a sangre + degradado de legibilidad + texto encima. Es el
 * componente que da aspecto de producto: sustituye a las cajas de color plano.
 * Sin imagen (o si la imagen falla) pinta un fondo diseñado — nunca un hueco.
 */
export default function PhotoCard({
  image, chips, title, subtitle, icon, onClick, aspect = '16 / 11', objectPosition, footer, primary, className = '',
}: Props) {
  const [imgOk, setImgOk] = useState(true);
  const showImage = !!image && imgOk;
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
      {showImage ? (
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
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, lineHeight: 1.05, color: 'var(--t-1)', letterSpacing: '0.01em' }}>
          {title}
        </p>
        {subtitle && <p className="mt-1" style={{ fontSize: 13, color: 'var(--t-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{subtitle}</p>}
        {footer && <div className="mt-4">{footer}</div>}
      </div>
    </div>
  );
}
