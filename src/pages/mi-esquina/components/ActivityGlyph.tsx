// Glifos propios por tipo de actividad.
//
// Antes cada tipo usaba un icono de Remix: `ri-donut-chart-line` para la comba
// y `ri-drop-line` para natación no dicen nada — son iconos prestados. Estos
// están dibujados para RANKD: mismo grosor de trazo, mismo tamaño óptico, y
// cada uno reconocible de un vistazo a 20 px.
//
// Heredan el color con `currentColor`, así que sirven tanto en el color del
// tipo como en rojo de marca cuando el elemento está activo.

interface Props {
  kind: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

function Glyph({ kind }: { kind: string }) {
  const common = {
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  switch (kind) {
    // Figura corriendo: cabeza, tronco inclinado, brazos y zancada abierta.
    case 'correr':
      return (
        <>
          <circle cx="20" cy="7" r="3" {...common} />
          <path d="M18 12l-3 6 4 3 1 6" {...common} />
          <path d="M19 21l-6 6" {...common} />
          <path d="M18 14l-6 2M18 14l6 4" {...common} />
        </>
      );
    // Cinta: la misma zancada, pero sobre la banda y la consola de la máquina.
    // Se distingue de "correr" por lo que hay DEBAJO, que es justo la
    // diferencia real entre las dos.
    case 'cinta':
      return (
        <>
          <circle cx="17" cy="6" r="2.5" {...common} />
          <path d="M15.5 10.5l-2.5 5 3.5 2.5 1 4.5" {...common} />
          <path d="M16.5 18l-4 4" {...common} />
          <path d="M15.5 12.5l-4 1.5M15.5 12.5l4.5 3" {...common} />
          <path d="M4 27h22l3-9" {...common} />
          <path d="M26 27l3-9" {...common} opacity="0.6" />
        </>
      );
    // Guante de boxeo: puño con el pulgar y la muñequera.
    case 'boxeo':
      return (
        <>
          <path d="M8 13a7 7 0 0 1 7-7h4a7 7 0 0 1 7 7v5H8z" {...common} />
          <path d="M8 18h18v3a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z" {...common} />
          <path d="M12 24v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" {...common} />
          <path d="M8 14h-1a2 2 0 0 0 0 4h1" {...common} />
        </>
      );
    // Bici: dos ruedas, cuadro y manillar.
    case 'bici':
      return (
        <>
          <circle cx="8" cy="22" r="6" {...common} />
          <circle cx="24" cy="22" r="6" {...common} />
          <path d="M8 22l6-10h6l4 10" {...common} />
          <path d="M14 12h5" {...common} />
          <path d="M12 22h6" {...common} />
        </>
      );
    // Elíptica: los dos brazos largos y el arco que describen los pedales.
    case 'eliptica':
      return (
        <>
          <circle cx="16" cy="6" r="2.5" {...common} />
          <path d="M8 8l8 4 8-4" {...common} />
          <path d="M16 12v6" {...common} />
          <path d="M16 18l-6 6M16 18l6 6" {...common} />
          <path d="M4 26c4 3 20 3 24 0" {...common} opacity="0.6" />
        </>
      );
    // Remo: el remero flexionado y la pala tocando el agua.
    case 'remo':
      return (
        <>
          <circle cx="12" cy="8" r="2.5" {...common} />
          <path d="M11 11l-2 6h6" {...common} />
          <path d="M15 17l4 4" {...common} />
          <path d="M10 13l10 3" {...common} />
          <path d="M22 14l6 3" {...common} />
          <path d="M3 26c3-2 6-2 9 0s6 2 9 0 6-2 9 0" {...common} opacity="0.6" />
        </>
      );
    // Natación: brazada por encima del agua + dos crestas de ola.
    case 'natacion':
      return (
        <>
          <circle cx="14" cy="11" r="2.5" {...common} />
          <path d="M6 18l6-3 7 2 6-6" {...common} />
          <path d="M3 24c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 7 0" {...common} />
          <path d="M3 29c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 7 0" {...common} opacity="0.5" />
        </>
      );
    // Comba: figura con el arco de la cuerda pasando por encima.
    case 'cuerda':
      return (
        <>
          <path d="M8 20C4 14 6 5 16 5s12 9 8 15" {...common} />
          <circle cx="16" cy="13" r="2.5" {...common} />
          <path d="M16 16v6" {...common} />
          <path d="M16 22l-3 6M16 22l3 6" {...common} />
          <path d="M13 18h6" {...common} />
        </>
      );
    // Otro: un destello, para lo que no encaja en ningún tipo.
    default:
      return (
        <>
          <path d="M16 5l2.5 7.5L26 15l-7.5 2.5L16 25l-2.5-7.5L6 15l7.5-2.5z" {...common} />
          <path d="M25 24l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" {...common} opacity="0.6" />
        </>
      );
  }
}

export default function ActivityGlyph({ kind, size = 24, className = '', style }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} style={style} aria-hidden focusable="false">
      <Glyph kind={kind} />
    </svg>
  );
}
