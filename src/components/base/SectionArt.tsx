import type { CSSProperties } from 'react';

// Ilustraciones propias, para las cabeceras que NO tienen una buena foto.
//
// Donde hay foto que funcione (Fuerza, Actividad, Nutrición, Ring) se usa la
// foto: sustituirlas todas por dibujos fue un error. Esto es solo para los
// casos en que ninguna foto dice nada del contenido — una agenda, una báscula.
// Mismo criterio que la diana de Objetivos: trazo grueso, formas simples.
//
// Van dibujadas "a sangre" como fondo de la cabecera, así que se recortan por
// los bordes a propósito: la composición está pensada para eso.

export type ArtKind = 'agenda' | 'weight';

interface Props {
  kind: ArtKind;
  className?: string;
  style?: CSSProperties;
}

const RED = '#E10600';
const GOLD = '#C9A84C';
const LINE = 'rgba(255,255,255,0.20)';

/**
 * Arte de sección. Se dibuja sobre un viewBox 320x120 apaisado, que es la
 * proporción de las cabeceras (21/7). `preserveAspectRatio` recorta por los
 * lados en pantallas estrechas y deja el motivo principal a la derecha, donde
 * no pisa al título.
 */
export default function SectionArt({ kind, className = '', style }: Props) {
  return (
    <svg viewBox="0 0 320 120" preserveAspectRatio="xMaxYMid slice"
      className={className} style={style} aria-hidden focusable="false">
      {ART[kind]}
    </svg>
  );
}

// Retícula tenue de fondo, común a todas: da textura sin competir.
const Grid = (
  <g stroke={LINE} strokeWidth="1" opacity="0.5">
    {[0, 40, 80, 120, 160, 200, 240, 280, 320].map((x) => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="120" />)}
    {[0, 40, 80, 120].map((y) => <line key={`h${y}`} x1="0" y1={y} x2="320" y2={y} />)}
  </g>
);

const ART: Record<ArtKind, React.ReactNode> = {
  // AGENDA: rejilla de mes con un día marcado en rojo y otro en oro.
  agenda: (
    <>
      {Grid}
      <g>
        <rect x="188" y="20" width="112" height="86" rx="10" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="3" />
        {/* Anillas */}
        <line x1="210" y1="12" x2="210" y2="28" stroke="rgba(255,255,255,0.4)" strokeWidth="4" strokeLinecap="round" />
        <line x1="278" y1="12" x2="278" y2="28" stroke="rgba(255,255,255,0.4)" strokeWidth="4" strokeLinecap="round" />
        <line x1="188" y1="42" x2="300" y2="42" stroke="rgba(255,255,255,0.28)" strokeWidth="3" />
        {/* Días */}
        {[0, 1, 2, 3].map((c) => [0, 1, 2].map((r) => {
          const x = 200 + c * 24;
          const y = 54 + r * 18;
          const isToday = c === 2 && r === 1;
          const isDone = (c === 0 && r === 0) || (c === 1 && r === 2);
          return (
            <rect key={`${c}-${r}`} x={x} y={y} width="14" height="10" rx="3"
              fill={isToday ? RED : isDone ? GOLD : 'rgba(255,255,255,0.14)'} />
          );
        }))}
      </g>
    </>
  ),

  // PESO: báscula con aguja, más una línea de tendencia bajando.
  weight: (
    <>
      {Grid}
      <g fill="none" strokeLinecap="round">
        <path d="M204 96 A44 44 0 0 1 292 96" stroke="rgba(255,255,255,0.28)" strokeWidth="3" />
        <line x1="200" y1="96" x2="296" y2="96" stroke="rgba(255,255,255,0.28)" strokeWidth="3" />
        {/* Marcas del dial */}
        {[-60, -30, 0, 30, 60].map((deg) => {
          const rad = ((deg - 90) * Math.PI) / 180;
          const cx = 248, cy = 96;
          return (
            <line key={deg}
              x1={cx + Math.cos(rad) * 34} y1={cy + Math.sin(rad) * 34}
              x2={cx + Math.cos(rad) * 40} y2={cy + Math.sin(rad) * 40}
              stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" />
          );
        })}
        {/* Aguja */}
        <line x1="248" y1="96" x2="228" y2="66" stroke={RED} strokeWidth="4" />
        <circle cx="248" cy="96" r="5" fill={RED} />
        {/* Tendencia bajando */}
        <path d="M112 44 L140 54 L164 42 L190 58" stroke={GOLD} strokeWidth="3" />
        <circle cx="190" cy="58" r="4" fill={GOLD} />
      </g>
    </>
  ),
};
