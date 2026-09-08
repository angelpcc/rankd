import type { CSSProperties } from 'react';

// Ilustraciones propias de cada sección de Mi Esquina.
//
// Sustituyen a las fotos de archivo de las cabeceras. Las fotos eran genéricas
// (un gimnasio cualquiera, alguien corriendo por una carretera cualquiera) y
// desentonaban con el resto de la interfaz, que es dibujo plano en rojo, oro y
// negro. Estas son SVG en los colores de marca, con el mismo criterio que la
// diana de Objetivos: trazo grueso, formas simples, cero degradados de foto.
//
// Van dibujadas "a sangre" como fondo de la cabecera, así que se recortan por
// los bordes a propósito: la composición está pensada para eso.

export type ArtKind = 'strength' | 'activity' | 'agenda' | 'nutrition' | 'ring' | 'weight';

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
  // FUERZA: barra olímpica con discos, vista de frente y ligeramente en fuga.
  strength: (
    <>
      {Grid}
      <g strokeLinecap="round" fill="none">
        {/* Barra */}
        <line x1="150" y1="60" x2="300" y2="60" stroke="rgba(255,255,255,0.55)" strokeWidth="5" />
        {/* Discos: los grandes en rojo, los pequeños en oro */}
        <rect x="196" y="24" width="13" height="72" rx="4" fill={RED} />
        <rect x="214" y="34" width="10" height="52" rx="3" fill="rgba(255,255,255,0.28)" />
        <rect x="229" y="44" width="8" height="32" rx="3" fill={GOLD} />
        <rect x="262" y="24" width="13" height="72" rx="4" fill={RED} />
        <rect x="247" y="34" width="10" height="52" rx="3" fill="rgba(255,255,255,0.28)" />
        <rect x="238" y="44" width="8" height="32" rx="3" fill={GOLD} />
        {/* Cierre exterior */}
        <rect x="280" y="50" width="7" height="20" rx="2" fill="rgba(255,255,255,0.4)" />
      </g>
    </>
  ),

  // ACTIVIDAD: pista con carriles y una zancada en rojo.
  activity: (
    <>
      {Grid}
      <g fill="none" strokeLinecap="round">
        {/* Carriles curvos */}
        <path d="M120 108 Q210 68 320 84" stroke={LINE} strokeWidth="3" />
        <path d="M120 96 Q210 56 320 72" stroke={LINE} strokeWidth="3" />
        <path d="M120 84 Q210 44 320 60" stroke="rgba(255,255,255,0.10)" strokeWidth="3" />
        {/* Corredor esquemático */}
        <g stroke={RED} strokeWidth="5" strokeLinejoin="round">
          <path d="M244 34 L238 56" />
          <path d="M238 56 L226 74" />
          <path d="M238 56 L256 70" />
          <path d="M244 42 L262 34" />
          <path d="M244 42 L226 44" />
        </g>
        <circle cx="248" cy="24" r="8" fill={RED} />
        {/* Estelas de velocidad */}
        <g stroke={GOLD} strokeWidth="2.5" opacity="0.8">
          <line x1="196" y1="34" x2="216" y2="34" />
          <line x1="188" y1="46" x2="212" y2="46" />
          <line x1="198" y1="58" x2="214" y2="58" />
        </g>
      </g>
    </>
  ),

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

  // NUTRICIÓN: plato visto desde arriba, dividido en macros.
  nutrition: (
    <>
      {Grid}
      <g>
        <circle cx="246" cy="60" r="44" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="3" />
        <circle cx="246" cy="60" r="33" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
        {/* Tres porciones: proteína (rojo), carbohidrato (oro), verdura (blanco) */}
        <path d="M246 60 L246 27 A33 33 0 0 1 274 76 Z" fill={RED} opacity="0.85" />
        <path d="M246 60 L274 76 A33 33 0 0 1 218 76 Z" fill={GOLD} opacity="0.85" />
        <path d="M246 60 L218 76 A33 33 0 0 1 246 27 Z" fill="rgba(255,255,255,0.22)" />
        {/* Cubiertos */}
        <line x1="176" y1="30" x2="176" y2="92" stroke="rgba(255,255,255,0.3)" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M168 30 L168 48 M176 28 L176 48 M184 30 L184 48" stroke="rgba(255,255,255,0.3)" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
    </>
  ),

  // RING: cuerdas y esquina, que es literalmente "tu esquina".
  ring: (
    <>
      {Grid}
      <g strokeLinecap="round" fill="none">
        {/* Poste de esquina */}
        <line x1="266" y1="14" x2="266" y2="108" stroke="rgba(255,255,255,0.4)" strokeWidth="7" />
        {/* Tres cuerdas que salen en fuga */}
        <path d="M266 34 Q186 42 120 32" stroke={RED} strokeWidth="4.5" />
        <path d="M266 58 Q186 66 120 56" stroke="rgba(255,255,255,0.3)" strokeWidth="4.5" />
        <path d="M266 82 Q186 90 120 80" stroke={GOLD} strokeWidth="4.5" />
        {/* Lona */}
        <path d="M120 96 L320 108" stroke="rgba(255,255,255,0.14)" strokeWidth="6" />
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
