// Esqueletos de carga: bloques con la MISMA forma que el contenido final, para
// que la pantalla no salte al llegar los datos. Sustituyen a los spinners.
//
// El brillo que recorre el bloque se apaga con `prefers-reduced-motion` (ver
// index.css): queda el bloque gris quieto, que sigue comunicando "cargando".

interface BoxProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export function SkeletonBox({ width = '100%', height = 16, radius = 8, className = '', style }: BoxProps) {
  return (
    <div
      className={`rk-skeleton ${className}`}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden
    />
  );
}

/** Varias líneas de texto; la última más corta, como un párrafo real. */
export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={className} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox key={i} height={12} width={i === lines - 1 ? '60%' : '100%'} style={{ marginTop: i === 0 ? 0 : 8 }} />
      ))}
    </div>
  );
}

/** Card con cifra grande + etiqueta: la forma de las métricas del Resumen. */
export function SkeletonStat({ className = '' }: { className?: string }) {
  return (
    <div className={`rk-surface-2 ${className}`} style={{ padding: 16, minHeight: 104 }} aria-hidden>
      <SkeletonBox height={10} width="55%" />
      <SkeletonBox height={30} width="45%" style={{ marginTop: 12 }} />
      <SkeletonBox height={6} width="100%" style={{ marginTop: 12 }} />
    </div>
  );
}

/** Zona de gráfico: barras de altura variable, como un gráfico real. */
export function SkeletonChart({ height = 220, className = '' }: { height?: number; className?: string }) {
  const bars = [42, 66, 38, 78, 52, 88, 60, 72];
  return (
    <div className={className} style={{ height, display: 'flex', alignItems: 'flex-end', gap: 8 }} aria-hidden>
      {bars.map((h, i) => (
        <SkeletonBox key={i} height={`${h}%`} radius={6} style={{ flex: 1, animationDelay: `${i * 70}ms` }} />
      ))}
    </div>
  );
}

/** Filas de lista con avatar/icono + dos líneas. */
export function SkeletonList({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`rk-stack ${className}`} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rk-card flex items-center gap-3" style={{ padding: 14 }}>
          <SkeletonBox width={40} height={40} radius={12} />
          <div className="flex-1 min-w-0">
            <SkeletonBox height={13} width="45%" />
            <SkeletonBox height={10} width="70%" style={{ marginTop: 8 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Panel de control: saludo, fila de cuatro indicadores y lista de actividad.
 * Es la forma de los dashboards de peleador, promotora y marca.
 */
export function SkeletonDashboard({ className = '' }: { className?: string }) {
  return (
    <div className={`max-w-5xl mx-auto px-5 py-8 space-y-6 ${className}`} role="status" aria-busy="true">
      <div>
        <SkeletonBox height={11} width={100} />
        <SkeletonBox height={32} width="55%" style={{ marginTop: 10 }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonStat key={i} />)}
      </div>
      <SkeletonList rows={4} />
    </div>
  );
}

/**
 * Portada de perfil: banda de cabecera con avatar y nombre, fila de cifras y
 * dos bloques de contenido. Se usa mientras carga una ficha pública (peleador,
 * marca, promotora) para que al llegar los datos no salte todo de sitio.
 */
export function SkeletonProfile({ className = '' }: { className?: string }) {
  return (
    <div className={className} role="status" aria-busy="true">
      {/* Cabecera a sangre */}
      <div style={{ background: 'var(--s-1)', borderBottom: '1px solid var(--s-3)', padding: '32px 20px' }}>
        <div className="max-w-4xl mx-auto flex items-end gap-4">
          <SkeletonBox width={96} height={96} radius={20} />
          <div className="flex-1 min-w-0">
            <SkeletonBox height={12} width={90} />
            <SkeletonBox height={30} width="60%" style={{ marginTop: 10 }} />
            <SkeletonBox height={12} width="40%" style={{ marginTop: 10 }} />
          </div>
        </div>
      </div>
      {/* Cifras + contenido */}
      <div className="max-w-4xl mx-auto px-5 py-6 space-y-5">
        <div className="grid grid-cols-4 gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rk-surface-2" style={{ padding: '16px 8px' }}>
              <SkeletonBox height={26} width="60%" />
              <SkeletonBox height={9} width="85%" style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
        <div className="rk-card" style={{ padding: 20 }}>
          <SkeletonBox height={11} width={120} />
          <SkeletonText lines={3} className="mt-4" />
        </div>
        <SkeletonList rows={2} />
      </div>
    </div>
  );
}

/**
 * Esqueleto por defecto de una sección de Mi Esquina: cabecera + cifras +
 * gráfico. Es el que usa `StateBlock variant="loading"`.
 */
export default function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-5 ${className}`} role="status" aria-label="…">
      <div>
        <SkeletonBox height={10} width={90} />
        <SkeletonBox height={30} width="55%" style={{ marginTop: 10 }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SkeletonStat />
        <SkeletonStat />
      </div>
      <div className="rk-card" style={{ padding: 20 }}>
        <SkeletonBox height={11} width={120} />
        <SkeletonChart height={180} className="mt-4" />
      </div>
    </div>
  );
}
