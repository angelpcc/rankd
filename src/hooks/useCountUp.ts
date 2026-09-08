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
  const guardRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!Number.isFinite(value)) return;
    if (prefersReducedMotion() || duration <= 0) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    // Ya estamos en el valor: solo hay que asegurarse de pintarlo.
    if (from === value) { setDisplay(value); return; }

    const factor = Math.pow(10, decimals);
    const round = (n: number) => Math.round(n * factor) / factor;

    const run = () => {
      const start = performance.now();
      const step = (now: number) => {
        // Se acota por ARRIBA y por ABAJO. El timestamp que pasa rAF puede ser
        // anterior al performance.now() de justo antes; con t negativo,
        // easeOutCubic devuelve valores enormes en negativo y la cifra pega un
        // salto absurdo (se vio un "-63.3 kg" en un peso de 66.2).
        const t = Math.max(0, Math.min(1, (now - start) / duration));
        const current = round(from + (value - from) * easeOutCubic(t));
        // Se guarda el valor REALMENTE pintado: si el efecto se corta a mitad
        // (React 18 en desarrollo monta, limpia y vuelve a montar), el siguiente
        // pase continúa desde aquí en vez de creerse que ya había terminado.
        fromRef.current = current;
        setDisplay(current);
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

    // Red de seguridad: en una pestaña de fondo el navegador NO ejecuta
    // requestAnimationFrame, así que la animación no avanza y la cifra se
    // quedaría en 0 hasta que el usuario volviera a la pestaña. Este temporizador
    // (que sí corre en segundo plano) fuerza el valor final pasado el tiempo de
    // la animación. Primero el dato correcto; la animación es un extra.
    guardRef.current = setTimeout(() => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
      setDisplay(value);
    }, delay + duration + 120);

    // La limpieza SOLO cancela lo pendiente. Antes ponía `fromRef.current =
    // value`, y con el doble montaje de desarrollo eso hacía que la segunda
    // pasada viera `from === value`, saliera antes de animar y dejara la cifra
    // congelada.
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      if (guardRef.current !== null) clearTimeout(guardRef.current);
    };
  }, [value, duration, decimals, delay]);

  return display;
}
