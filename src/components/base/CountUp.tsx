import { useCountUp } from '@/hooks/useCountUp';

interface Props {
  value: number;
  decimals?: number;
  duration?: number;
  delay?: number;
  /** Texto pequeño tras la cifra (kg, %, días…). */
  suffix?: string;
  prefix?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Estilo del sufijo; por defecto más pequeño y atenuado. */
  suffixStyle?: React.CSSProperties;
}

/**
 * Cifra que cuenta hasta su valor. El número va en `tabular-nums` para que no
 * baile el ancho mientras cuenta, y se marca `aria-live="off"` porque anunciar
 * cada fotograma a un lector de pantalla sería ruido: el valor final ya está en
 * el DOM cuando termina.
 */
export default function CountUp({
  value, decimals = 0, duration = 700, delay = 0,
  suffix, prefix, className = '', style, suffixStyle,
}: Props) {
  const n = useCountUp(value, { duration, decimals, delay });
  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }} aria-live="off">
      {prefix}
      {n.toFixed(decimals)}
      {suffix && (
        <span style={{ fontSize: '0.45em', marginLeft: 4, color: 'var(--t-3)', ...suffixStyle }}>{suffix}</span>
      )}
    </span>
  );
}
