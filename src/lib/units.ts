// ════════════════════════════════════════════════════════════════
// RANKD · Kilos y libras
//
// ── LA REGLA, Y NO SE TOCA ──
//
// TODO SE GUARDA EN KILOS. Siempre. Las libras son una forma de ESCRIBIR y de
// LEER, nunca de almacenar.
//
// Si se guardara cada número en la unidad en la que se tecleó, cualquier
// comparación se rompería: un 100 de hace un mes y un 100 de hoy podrían ser
// 100 kg y 45 kg, las gráficas mezclarían las dos escalas y un récord personal
// sería una lotería. Y arreglarlo después es imposible, porque no hay forma de
// saber qué quiso decir cada número.
//
// Así que se convierte al entrar y al salir, y en la base solo hay kilos.
//
// ── POR QUÉ HACE FALTA ──
//
// Las mancuernas y las máquinas de medio mundo están en libras, y quien viaja
// o entrena en un gimnasio así se encuentra con que tiene que dividir entre
// 2,2 de cabeza en mitad de la serie. Apuntar mal por eso es lo normal.
//
// ── DÓNDE SE GUARDA LA PREFERENCIA ──
//
// En `localStorage`, por perfil. No es un dato: es cómo prefieres ver los
// números en ESTE dispositivo, que es justo lo que cambia cuando te vas de
// viaje o entrenas en otro sitio. Perderla no pierde nada — los kilos siguen
// ahí — y así no hace falta ni migración ni red.
// ════════════════════════════════════════════════════════════════

export type WeightUnit = 'kg' | 'lb';

/** Factor oficial. 1 lb = 0,45359237 kg, exacto por definición. */
const KG_POR_LB = 0.45359237;

export const lbAKg = (lb: number): number => lb * KG_POR_LB;
export const kgALb = (kg: number): number => kg / KG_POR_LB;

/**
 * Convierte un valor escrito por el usuario a los kilos que se guardan.
 *
 * Se redondea a 2 decimales: 45 lb son 20,4116... kg, y arrastrar los decimales
 * enteros ensucia la base sin aportar nada — nadie levanta con esa precisión.
 */
export function aKg(valor: number, unidad: WeightUnit): number {
  if (unidad === 'kg') return valor;
  return Math.round(lbAKg(valor) * 100) / 100;
}

/** Los kilos guardados, en la unidad en la que quiere verlos. */
export function desdeKg(kg: number, unidad: WeightUnit): number {
  if (unidad === 'kg') return kg;
  // Media libra de resolución: es lo que marcan los discos y las máquinas.
  return Math.round(kgALb(kg) * 2) / 2;
}

/** "62,5 kg" / "137,5 lb". Con coma, que es como se escribe en español. */
export function fmtPeso(kg: number, unidad: WeightUnit): string {
  const v = desdeKg(kg, unidad);
  const n = Number.isInteger(v) ? String(v) : String(+v.toFixed(1)).replace('.', ',');
  return `${n} ${unidad}`;
}

// ── La preferencia ───────────────────────────────────────────────

const CLAVE = 'rankd_weight_unit';

export function leerUnidad(profileId: string): WeightUnit {
  try {
    return localStorage.getItem(`${CLAVE}_${profileId}`) === 'lb' ? 'lb' : 'kg';
  } catch {
    // Almacenamiento bloqueado: kilos, que es lo que usa la mayoría y lo que
    // hay en la base de todas formas.
    return 'kg';
  }
}

export function guardarUnidad(profileId: string, u: WeightUnit): void {
  try { localStorage.setItem(`${CLAVE}_${profileId}`, u); } catch { /* da igual */ }
}
