interface Props {
  total: number;
  done: number;
  /** Alto de cada segmento en px. Por defecto 8. */
  height?: number;
  className?: string;
}

/**
 * Progreso segmentado: N tramos inclinados (skewX -12°) en lugar de una barra
 * continua. Los `done` primeros van en rojo de acento; el resto en --s-3.
 * Puramente presentacional.
 */
export default function SegmentedProgress({ total, done, height = 8, className = '' }: Props) {
  const n = Math.max(0, Math.floor(total));
  const filled = Math.max(0, Math.min(n, Math.floor(done)));
  if (n === 0) return null;
  return (
    <div className={`flex gap-1 ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={n} aria-valuenow={filled}>
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className="flex-1"
          style={{
            height,
            borderRadius: 2,
            transform: 'skewX(-12deg)',
            background: i < filled ? 'var(--accent)' : 'var(--s-3)',
          }}
        />
      ))}
    </div>
  );
}
