// Cabecera de bloque de las páginas públicas (portada y directorios).
//
// ── POR QUÉ UNA SOLA ──
//
// Cada bloque de la portada montaba la suya a mano: uno con el título gigante
// en Bebas y la segunda línea en rojo con resplandor, otro en dorado, otro en
// gris translúcido, otro con letra de contorno. Nueve bloques seguidos, cada
// uno gritando con una voz distinta: eso era la sensación de "saturado".
//
// Aquí hay una: etiqueta pequeña, título en Inter con la palabra clave en rojo,
// una línea que explica y, si hace falta, un enlace a la página completa. El
// titular grande en Bebas se reserva para el principio de la portada.

interface Props {
  eyebrow?: string;
  title: string;
  /** Parte del título en rojo (va detrás, en la misma frase). */
  highlight?: string;
  sub?: string;
  align?: 'left' | 'center';
  /** Enlace a la página completa ("Ver todos →"). */
  action?: { label: string; onClick: () => void };
  className?: string;
}

export default function SectionHead({ eyebrow, title, highlight, sub, align = 'left', action, className = '' }: Props) {
  const centro = align === 'center';
  return (
    <div className={`rk-head ${centro ? 'rk-head--center' : ''} ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="rk-head-eyebrow">
            <span aria-hidden className="rk-head-dash" />{eyebrow}
          </p>
        )}
        <h2 className="rk-head-title">
          {title}{highlight && <> <span style={{ color: 'var(--accent)' }}>{highlight}</span></>}
        </h2>
        {sub && <p className="rk-head-sub">{sub}</p>}
      </div>
      {action && (
        <button onClick={action.onClick} className="rk-head-action rk-press">
          {action.label} <i className="ri-arrow-right-line" />
        </button>
      )}
    </div>
  );
}
