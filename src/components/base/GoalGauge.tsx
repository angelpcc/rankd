import { useEffect, useRef, useState } from 'react';

// Indicador semicircular de avance hacia el objetivo de peso. El brief pedía
// que la distancia que falta se viera de forma GRÁFICA, no como un número
// suelto: aquí el arco se rellena desde 0 al montar y la aguja se coloca en la
// posición actual.
//
// Es solo presentación: recibe el porcentaje ya calculado.

interface Props {
  /** 0-100. Avance desde el peso de partida hasta el objetivo. */
  pct: number;
  /** Texto grande del centro (p. ej. "2,4"). */
  value: string;
  /** Texto pequeño bajo el valor (p. ej. "kg para el objetivo"). */
  label: string;
  size?: number;
}

const R = 52;
const CX = 60;
const CY = 60;
/** Semicírculo: media circunferencia. */
const ARC_LEN = Math.PI * R;

function prefersReduced(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function GoalGauge({ pct, value, label, size = 132 }: Props) {
  const clamped = Math.max(0, Math.min(100, pct));
  const [drawn, setDrawn] = useState(() => (prefersReduced() ? clamped : 0));
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReduced()) { setDrawn(clamped); return; }
    const start = performance.now();
    const from = drawn;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 800);
      const eased = 1 - Math.pow(1 - t, 3);
      setDrawn(from + (clamped - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current !== null) cancelAnimationFrame(raf.current); };
    // Solo re-anima cuando cambia el objetivo real, no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped]);

  const offset = ARC_LEN * (1 - drawn / 100);
  // Aguja: 180° de recorrido, empezando a la izquierda.
  const angle = Math.PI * (1 - drawn / 100);
  const nx = CX + Math.cos(angle) * (R - 10);
  const ny = CY - Math.sin(angle) * (R - 10);

  return (
    <div style={{ width: size }} role="img" aria-label={`${value} ${label}`}>
      <svg viewBox="0 0 120 72" width={size} height={size * 0.6} aria-hidden focusable="false">
        {/* Carril */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          stroke="var(--s-3)" strokeWidth="9" fill="none" strokeLinecap="round"
        />
        {/* Avance */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          stroke="var(--accent)" strokeWidth="9" fill="none" strokeLinecap="round"
          strokeDasharray={ARC_LEN} strokeDashoffset={offset}
        />
        {/* Aguja */}
        <circle cx={nx} cy={ny} r="5" fill="#fff" />
        <circle cx={nx} cy={ny} r="2.2" fill="var(--accent)" />
      </svg>
      <div style={{ textAlign: 'center', marginTop: -6 }}>
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, lineHeight: 1, color: 'var(--t-1)', margin: 0 }}>{value}</p>
        <p className="rk-label" style={{ marginTop: 4 }}>{label}</p>
      </div>
    </div>
  );
}
