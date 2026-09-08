import type { CSSProperties } from 'react';

// Figura esquemática animada por PATRÓN DE MOVIMIENTO.
//
// No es una demostración del ejercicio: es un monigote que repite el gesto
// básico del patrón (empujar, traccionar, sentadilla, bisagra...) para que de
// un vistazo se entienda de qué familia es el ejercicio. Se dibuja con SVG y
// se anima con CSS, así que no pesa nada, no hay vídeo ni red, y escala a
// cualquier tamaño sin pixelarse.
//
// El muñeco es SIEMPRE el mismo: cambian las piezas que se mueven, según la
// clase `mf-<patrón>` que se pone en la raíz. Las animaciones viven en
// index.css (bloque "Figura de patrón de movimiento") y quedan neutralizadas
// bajo prefers-reduced-motion: entonces se ve la postura, quieta.

export type FigurePattern =
  | 'push' | 'pull' | 'squat' | 'hinge' | 'lunge'
  | 'carry' | 'rotation' | 'antirotation' | 'jump' | 'isolation';

interface Props {
  pattern: FigurePattern;
  size?: number;
  /** Texto para lectores de pantalla. Sin él, la figura es decorativa. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export default function MovementFigure({ pattern, size = 96, label, className = '', style }: Props) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={`rk-mf mf-${pattern} ${className}`}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {/* Suelo: da referencia de altura, y en salto/sentadilla se nota el
          desplazamiento vertical del cuerpo respecto a él. */}
      <line className="mf-ground" x1="18" y1="104" x2="102" y2="104" />

      {/* El grupo entero se mueve en sentadilla, salto y acarreo. */}
      <g className="mf-body">
        {/* Piernas primero: quedan por debajo del torso al dibujarse antes. */}
        <path className="mf-leg mf-leg-l" d="M60 66 L48 94" />
        <path className="mf-leg mf-leg-r" d="M60 66 L72 94" />

        <g className="mf-trunk">
          <path className="mf-torso" d="M60 34 L60 66" />
          <circle className="mf-head" cx="60" cy="24" r="9" />
          <path className="mf-arm mf-arm-l" d="M60 42 L44 54" />
          <path className="mf-arm mf-arm-r" d="M60 42 L76 54" />
          {/* Carga: solo se ve en los patrones que la usan (CSS la oculta en
              el resto). Es la barra/mancuerna que justifica el gesto. */}
          <path className="mf-load" d="M40 54 L80 54" />
        </g>
      </g>
    </svg>
  );
}
