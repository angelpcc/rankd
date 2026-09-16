// Leer lo que el usuario escribe en el campo de repeticiones.
//
// Vivía dentro de `StrengthSessionForm.tsx`, pero no pinta nada y la usan dos
// pantallas (el formulario y el planificador de fuerza). Una función pura
// exportada desde un fichero de componentes rompe además el refresco en
// caliente de Vite: al tocar el formulario recargaba la página entera en vez de
// solo ese componente, y perdías lo que estuvieras escribiendo.

/**
 * Parsea el valor del input de repeticiones.
 *
 * Acepta las formas en que la gente escribe un rango de verdad:
 *   "8"        → { reps: 8 }
 *   "8-10"     → { reps: 8, repsMax: 10 }
 *   "8 a 10"   → { reps: 8, repsMax: 10 }
 *   "8 - 10"   → { reps: 8, repsMax: 10 }
 *
 * Devuelve null si no se puede leer o si el rango está del revés (min > max),
 * que es la forma de decirle al formulario "esto no lo guardes".
 */
export function parseRepsInput(raw: string): { reps: number; repsMax?: number } | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;
  // Rango: "8-10", "8 - 10", "8 a 10", "8 to 10"
  const range = s.match(/^(\d+)\s*(?:-|–|a|to)\s*(\d+)$/);
  if (range) {
    const lo = parseInt(range[1], 10);
    const hi = parseInt(range[2], 10);
    if (!lo || !hi || lo <= 0 || hi <= 0 || hi < lo) return null;
    // "8-8" es 8, no un rango: guardarlo como rango pintaría "8-8" en el
    // historial, que se lee como un error.
    return lo === hi ? { reps: lo } : { reps: lo, repsMax: hi };
  }
  const single = s.match(/^(\d+)$/);
  if (single) {
    const n = parseInt(single[1], 10);
    return n > 0 ? { reps: n } : null;
  }
  return null;
}
