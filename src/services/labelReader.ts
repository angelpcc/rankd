// ════════════════════════════════════════════════════════════════
// RANKD · Leer la etiqueta de un bote
//
// ── POR QUÉ NO VALE EL ANALIZADOR DE PLATOS ──
//
// Un plato se ESTIMA: cuánto arroz hay, cuánto aceite lleva. Una etiqueta no
// se estima, se LEE: los números están impresos y la única forma de fallar es
// leerlos mal.
//
// Pasarle un bote de proteína al analizador de platos devolvía cosas como "un
// bote de plástico, 300 g, 1.100 kcal" — una estimación de la comida que se
// ve, no la tabla nutricional que hay detrás.
//
// Y lo que interesa es POR DOSIS, no por 100 g: nadie se toma cien gramos de
// proteína en polvo, se toma un cacito.
// ════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';

export interface MacrosDosis {
  calorias: number;
  proteina: number;
  carbohidratos: number;
  grasas: number;
}

export interface EtiquetaLeida {
  producto: string;
  /** Gramos de una dosis (un cacito, un sobre). */
  dosisG: number;
  porDosis: MacrosDosis;
  /** false si ha tenido que estimar algo porque no se leía. */
  leido: boolean;
  /** Lo que conviene saber: tabla por 100 g, foto borrosa, dato que faltaba. */
  aviso: string | null;
}

export interface ResultadoEtiqueta {
  etiqueta: EtiquetaLeida | null;
  error: string | null;
}

/** ¿Está disponible la IA? Misma sonda que el resto; no gasta cuota. */
export async function checkLabelReaderAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/coach', { method: 'GET' });
    if (!res.ok) return false;
    return !!(await res.json())?.available;
  } catch {
    return false;
  }
}

const n = (v: unknown, def = 0): number => {
  const x = Number(v);
  return Number.isFinite(x) && x >= 0 ? Math.round(x * 10) / 10 : def;
};

export async function leerEtiqueta(base64: string, mediaType: string): Promise<ResultadoEtiqueta> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { etiqueta: null, error: 'auth' };

  try {
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ labelPhoto: { imageBase64: base64, mediaType } }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { etiqueta: null, error: data?.message || `error ${res.status}` };

    const l = data?.label;
    if (!l?.por_dosis) return { etiqueta: null, error: 'sin_etiqueta' };

    // Se normaliza aquí y no se confía en lo que venga: un NaN colado en los
    // macros acabaría guardado en el diario y ensuciando el total del día.
    return {
      etiqueta: {
        producto: String(l.producto || '').trim().slice(0, 80) || 'Suplemento',
        dosisG: n(l.dosis_g, 30) || 30,
        porDosis: {
          calorias: n(l.por_dosis.calorias),
          proteina: n(l.por_dosis.proteina),
          carbohidratos: n(l.por_dosis.carbohidratos),
          grasas: n(l.por_dosis.grasas),
        },
        leido: l.leido !== false,
        aviso: l.aviso ? String(l.aviso).slice(0, 200) : null,
      },
      error: null,
    };
  } catch {
    return { etiqueta: null, error: 'network' };
  }
}

// ── Lo que se recuerda de TU bote ────────────────────────────────
//
// El segundo batido no debería costar lo mismo que el primero. Una vez leída
// la etiqueta, el producto se guarda por perfil y la próxima vez solo hay que
// decir cuántos cacitos.
//
// En localStorage y no en la base: es de este dispositivo y perderlo no pierde
// nada — vuelves a hacer la foto. No merece ni tabla ni migración.

export interface ProductoGuardado {
  producto: string;
  dosisG: number;
  porDosis: MacrosDosis;
}

const CLAVE = 'rankd_suplementos';

export function cargarProductos(profileId: string): ProductoGuardado[] {
  try {
    const raw = localStorage.getItem(`${CLAVE}:${profileId}`);
    const lista = raw ? JSON.parse(raw) : [];
    return Array.isArray(lista) ? lista.slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function guardarProducto(profileId: string, p: ProductoGuardado): void {
  try {
    const clave = p.producto.trim().toLowerCase();
    // El mismo producto no se duplica: se actualiza y pasa al principio, que
    // es lo que hace que el de siempre esté siempre el primero.
    const resto = cargarProductos(profileId).filter((x) => x.producto.trim().toLowerCase() !== clave);
    localStorage.setItem(`${CLAVE}:${profileId}`, JSON.stringify([p, ...resto].slice(0, 8)));
  } catch { /* sin almacenamiento se sigue pudiendo usar, solo no se recuerda */ }
}

export function olvidarProducto(profileId: string, producto: string): void {
  try {
    const clave = producto.trim().toLowerCase();
    const resto = cargarProductos(profileId).filter((x) => x.producto.trim().toLowerCase() !== clave);
    localStorage.setItem(`${CLAVE}:${profileId}`, JSON.stringify(resto));
  } catch { /* igual */ }
}
