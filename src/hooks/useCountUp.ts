import { useEffect, useRef, useState } from 'react';

// Conteo animado de una cifra. Al montar cuenta desde 0; si el valor cambia
// después (registras un peso nuevo), cuenta desde el valor anterior — que es lo
// que hace que el cambio se "vea" en vez de aparecer ya hecho.
//
// Respeta `prefers-reduced-motion`: quien lo tenga activado ve el número final
// directamente, sin animación.

interface Options {
  /** Duración en ms. El brief pide 600-800. */
  duration?: number;
  /** Decimales a mostrar (el peso va con 1). */
  decimals?: number;
  /** Retardo antes de arrancar, para escalonar varias cifras. */
  delay?: number;
}

/** Salida rápida al principio y frenada al final: se lee como algo que "llega". */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useCountUp(value: number, { duration = 700, decimals = 0, delay = 0 }: Options = {}): number {
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? value : 0));
  const fromRef = useRef(prefersReducedMotion() ? value : 0);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!Number.isFinite(value)) return;
    if (prefersReducedMotion() || duration <= 0) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    if (from === value) return;

    const factor = Math.pow(10, decimals);
    const round = (n: number) => Math.round(n * factor) / factor;

    const run = () => {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const current = from + (value - from) * easeOutCubic(t);
        setDisplay(round(current));
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          fromRef.current = value;
          setDisplay(value);
        }
      };
      rafRef.current = requestAnimationFrame(step);
    };

    if (delay > 0) timeoutRef.current = setTimeout(run, delay);
    else run();

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      // Si se desmonta a mitad, el próximo montaje arranca del último pintado.
      fromRef.current = value;
    };
  }, [value, duration, decimals, delay]);

  return display;
}
