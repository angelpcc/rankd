import { useState, useEffect, useRef } from 'react';

interface Props {
  value: number;
  /** Sufijo pegado al número, p. ej. "kg" o "%" */
  suffix?: string;
  /** Duración de la cuenta, en ms */
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Número que cuenta hasta su valor al aparecer.
 *
 * Es una microinteracción con intención: al entrar en el resumen, ver la racha
 * subir de 0 a 12 hace que la cifra se lea, en vez de pasar desapercibida como
 * un dato estático más.
 *
 * Respeta prefers-reduced-motion: quien lo tenga activado ve el número final
 * directamente, sin animación.
 */
export default function CountUp({ value, suffix, duration = 900, className, style }: Props) {
  const [shown, setShown] = useState(value);
  const frame = useRef(0);
  const prev = useRef(value);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || value === prev.current) { setShown(value); prev.current = value; return; }

    const from = prev.current;
    const delta = value - from;
    const start = performance.now();
    prev.current = value;

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      // Desaceleración: rápido al principio, se posa al final
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + delta * eased));
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration]);

  return (
    <span className={className} style={style}>
      {shown.toLocaleString()}{suffix ? <span style={{ fontSize: '0.5em', marginLeft: 3 }}>{suffix}</span> : null}
    </span>
  );
}
