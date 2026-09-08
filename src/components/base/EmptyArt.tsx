// Ilustraciones de estado vacío, dibujadas a mano en SVG con los colores de
// marca. Sustituyen al icono genérico gris: un hueco vacío tiene que invitar a
// llenarlo, no parecer un error.
//
// Todas comparten lenguaje: retícula tenue de fondo, trazo blanco al 22 % para
// lo estructural y rojo RANKD solo en el elemento que representa "lo que falta".

export type EmptyArtKind =
  | 'weight' | 'strength' | 'activity' | 'nutrition'
  | 'agenda' | 'search' | 'notes' | 'plan' | 'people';

interface Props {
  kind: EmptyArtKind;
  size?: number;
  className?: string;
}

const LINE = 'rgba(255,255,255,0.22)';
const DIM = 'rgba(255,255,255,0.10)';
const ACCENT = '#E10600';

function Art({ kind }: { kind: EmptyArtKind }) {
  switch (kind) {
    // Báscula con la aguja marcando y una línea de tendencia subiendo.
    case 'weight':
      return (
        <>
          <rect x="12" y="34" width="40" height="20" rx="4" stroke={LINE} strokeWidth="2" fill="none" />
          <path d="M22 34a10 10 0 0 1 20 0" stroke={LINE} strokeWidth="2" fill="none" />
          <path d="M32 30v-8" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="32" cy="20" r="2.5" fill={ACCENT} />
          <path d="M16 46h8l4-5 5 7 4-6h9" stroke={ACCENT} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
        </>
      );
    // Barra con discos: el disco derecho en rojo = la carga que falta poner.
    case 'strength':
      return (
        <>
          <rect x="10" y="28" width="6" height="12" rx="2" stroke={LINE} strokeWidth="2" fill="none" />
          <rect x="18" y="24" width="7" height="20" rx="2" stroke={LINE} strokeWidth="2" fill="none" />
          <rect x="27" y="31" width="10" height="6" rx="2" fill={DIM} />
          <rect x="39" y="24" width="7" height="20" rx="2" stroke={ACCENT} strokeWidth="2" fill="none" />
          <rect x="48" y="28" width="6" height="12" rx="2" stroke={ACCENT} strokeWidth="2" fill="none" />
        </>
      );
    // Recorrido: una ruta con el punto de salida marcado en rojo.
    case 'activity':
      return (
        <>
          <path d="M14 46c6-2 6-12 12-12s6 12 12 12 8-10 12-14" stroke={LINE} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <circle cx="14" cy="46" r="4" fill={ACCENT} />
          <circle cx="50" cy="32" r="3" stroke={LINE} strokeWidth="2" fill="none" />
          <path d="M20 20h10M20 26h6" stroke={DIM} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    // Plato dividido: un cuarto en rojo = lo que aún no has registrado.
    case 'nutrition':
      return (
        <>
          <circle cx="32" cy="32" r="18" stroke={LINE} strokeWidth="2" fill="none" />
          <circle cx="32" cy="32" r="11" stroke={DIM} strokeWidth="2" fill="none" />
          <path d="M32 14a18 18 0 0 1 18 18" stroke={ACCENT} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M32 21v22M21 32h22" stroke={DIM} strokeWidth="1.5" />
        </>
      );
    // Calendario con un solo día encendido.
    case 'agenda':
      return (
        <>
          <rect x="12" y="16" width="40" height="36" rx="5" stroke={LINE} strokeWidth="2" fill="none" />
          <path d="M12 26h40" stroke={LINE} strokeWidth="2" />
          <path d="M22 12v8M42 12v8" stroke={LINE} strokeWidth="2.5" strokeLinecap="round" />
          <rect x="19" y="32" width="7" height="6" rx="2" fill={DIM} />
          <rect x="29" y="32" width="7" height="6" rx="2" fill={ACCENT} />
          <rect x="39" y="32" width="7" height="6" rx="2" fill={DIM} />
          <rect x="19" y="42" width="7" height="6" rx="2" fill={DIM} />
        </>
      );
    // Lupa con el haz en rojo.
    case 'search':
      return (
        <>
          <circle cx="29" cy="29" r="14" stroke={LINE} strokeWidth="2.5" fill="none" />
          <path d="M39 39l11 11" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" />
          <path d="M23 29a6 6 0 0 1 6-6" stroke={ACCENT} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7" />
        </>
      );
    // Libreta: la primera línea escrita en rojo, el resto por escribir.
    case 'notes':
      return (
        <>
          <rect x="16" y="12" width="32" height="40" rx="4" stroke={LINE} strokeWidth="2" fill="none" />
          <path d="M23 24h18" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M23 32h18M23 40h11" stroke={DIM} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    // Tres fichas de perfil; la del centro, la que falta, en rojo. Para
    // directorios vacíos (peleadores, marcas, promotoras, gimnasios).
    case 'people':
      return (
        <>
          <rect x="8" y="22" width="14" height="20" rx="3" stroke={LINE} strokeWidth="2" fill="none" />
          <circle cx="15" cy="29" r="3" stroke={LINE} strokeWidth="1.8" fill="none" />
          <path d="M11 38a4 4 0 0 1 8 0" stroke={LINE} strokeWidth="1.8" fill="none" />

          <rect x="25" y="17" width="14" height="30" rx="3" stroke={ACCENT} strokeWidth="2" fill="none" />
          <circle cx="32" cy="27" r="3.4" stroke={ACCENT} strokeWidth="1.8" fill="none" />
          <path d="M27.5 38a4.5 4.5 0 0 1 9 0" stroke={ACCENT} strokeWidth="1.8" fill="none" />

          <rect x="42" y="22" width="14" height="20" rx="3" stroke={LINE} strokeWidth="2" fill="none" />
          <circle cx="49" cy="29" r="3" stroke={LINE} strokeWidth="1.8" fill="none" />
          <path d="M45 38a4 4 0 0 1 8 0" stroke={LINE} strokeWidth="1.8" fill="none" />
        </>
      );
    // Diana: el patrón que el usuario dice que ya funciona en Objetivos.
    case 'plan':
    default:
      return (
        <>
          <circle cx="32" cy="32" r="18" stroke={LINE} strokeWidth="2" fill="none" />
          <circle cx="32" cy="32" r="11" stroke={DIM} strokeWidth="2" fill="none" />
          <circle cx="32" cy="32" r="4" fill={ACCENT} />
          <path d="M32 32L48 16" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M43 16h5v5" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      );
  }
}

export default function EmptyArt({ kind, size = 96, className = '' }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden focusable="false">
      {/* Retícula tenue: da textura sin competir con el motivo */}
      <defs>
        <pattern id={`rk-grid-${kind}`} width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M8 0H0V8" stroke="rgba(255,255,255,0.045)" strokeWidth="1" fill="none" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="64" height="64" fill={`url(#rk-grid-${kind})`} rx="14" />
      <Art kind={kind} />
    </svg>
  );
}
