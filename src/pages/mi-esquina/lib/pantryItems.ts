// ════════════════════════════════════════════════════════════════
// RANKD · Mi Esquina · Productos propios del usuario (punto 20)
//
// La despensa del Asesor de comida es una lista CERRADA de etiquetas
// ('pollo', 'avena', 'atun'…). Sirve para filtrar el recetario, pero deja fuera
// lo que cada uno compra de verdad: "pechuga de pavo", "tortitas de arroz",
// "queso batido 0%". Aquí el usuario escribe lo suyo UNA vez y queda guardado
// para las siguientes planificaciones.
//
// Lo importante es qué se hace con un producto escrito a mano. No se le pueden
// inventar macros —sería mentir—, así que:
//
//   · Si el nombre encaja con una etiqueta conocida ("pechuga de pavo" → pollo),
//     el producto CUENTA como despensa y prioriza los platos que la usan. Además
//     el plan puede nombrar el producto real del usuario en vez de la etiqueta
//     genérica.
//   · Si no encaja con ninguna, el producto NO se pierde: se ofrece como
//     acompañamiento o snack disponible, sin fingir que se sabe cuánto aporta.
//
// Migración 0055. Como en el resto de Mi Esquina, sin tabla se guarda en este
// navegador y se avisa de ello.
// ════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import type { Pantry } from './recipes';

export interface PantryItem {
  id: string;
  name: string;
  /** Etiqueta de despensa asociada, o null si no encaja en ninguna. */
  tag: Pantry | null;
  available: boolean;
}

// ── Reconocer un producto por su nombre ────────────────────────
//
// Palabras clave por etiqueta, de la más específica a la más genérica. El
// orden importa: "leche de avena" debe caer en 'avena' antes que en 'lacteo',
// y "atún" antes que "pescado".

const KEYWORDS: { tag: Pantry; words: string[] }[] = [
  { tag: 'atun', words: ['atun', 'bonito', 'tuna'] },
  { tag: 'huevo', words: ['huevo', 'clara', 'tortilla', 'egg'] },
  { tag: 'pollo', words: ['pollo', 'pavo', 'pechuga', 'chicken', 'turkey'] },
  { tag: 'ternera', words: ['ternera', 'vacuno', 'buey', 'solomillo', 'filete', 'beef'] },
  { tag: 'cerdo', words: ['cerdo', 'lomo', 'jamon', 'bacon', 'pork'] },
  { tag: 'marisco', words: ['gamba', 'langostino', 'mejillon', 'calamar', 'pulpo', 'marisco'] },
  { tag: 'pescado', words: ['merluza', 'salmon', 'bacalao', 'lubina', 'dorada', 'sardina', 'caballa', 'pescado', 'fish'] },
  { tag: 'tofu', words: ['tofu', 'tempeh', 'seitan', 'soja texturizada'] },
  { tag: 'legumbre', words: ['lenteja', 'garbanzo', 'alubia', 'judia', 'frijol', 'soja', 'legumbre', 'hummus'] },
  { tag: 'yogur', words: ['yogur', 'yogurt', 'skyr', 'kefir', 'queso batido'] },
  { tag: 'queso', words: ['queso', 'mozzarella', 'parmesano', 'cheese'] },
  { tag: 'avena', words: ['avena', 'oats', 'porridge', 'muesli'] },
  { tag: 'lacteo', words: ['leche', 'bebida vegetal', 'milk', 'nata', 'requeson'] },
  { tag: 'quinoa', words: ['quinoa', 'cuscus', 'couscous', 'bulgur', 'mijo'] },
  { tag: 'arroz', words: ['arroz', 'rice', 'tortitas de arroz'] },
  { tag: 'pasta', words: ['pasta', 'macarron', 'espagueti', 'fideo', 'noodle', 'lasa'] },
  { tag: 'pan', words: ['pan', 'bread', 'tostada', 'biscote', 'wrap', 'tortilla de trigo', 'pita'] },
  { tag: 'patata', words: ['patata', 'boniato', 'batata', 'potato'] },
  { tag: 'platano', words: ['platano', 'banana'] },
  { tag: 'aguacate', words: ['aguacate', 'avocado', 'guacamole'] },
  { tag: 'tomate', words: ['tomate', 'tomato'] },
  { tag: 'ensalada', words: ['ensalada', 'lechuga', 'canonigo', 'rucula', 'espinaca baby', 'salad'] },
  { tag: 'fruta', words: ['manzana', 'naranja', 'pera', 'fresa', 'kiwi', 'uva', 'melon', 'sandia', 'arandano', 'mango', 'pina', 'fruta', 'fruit'] },
  { tag: 'verdura', words: ['brocoli', 'calabacin', 'pimiento', 'zanahoria', 'cebolla', 'judia verde', 'esparrago', 'coliflor', 'champinon', 'seta', 'espinaca', 'berenjena', 'verdura', 'vegetable'] },
  { tag: 'frutos_secos', words: ['almendra', 'nuez', 'nueces', 'anacardo', 'cacahuete', 'pistacho', 'crema de cacahuete', 'mantequilla de mani', 'frutos secos'] },
  { tag: 'aceite', words: ['aceite', 'oliva', 'oil'] },
  { tag: 'conserva', words: ['conserva', 'lata', 'bote', 'maiz dulce'] },
];

const strip = (s: string) => s
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

/**
 * Etiqueta de despensa a la que pertenece un producto escrito a mano.
 *
 * Devuelve null cuando no hay una coincidencia razonable. Es a propósito: es
 * mejor tratar "barritas de proteína marca X" como un extra disponible que
 * meterlo a la fuerza en 'snack' y montar un plan sobre una suposición.
 */
export function matchPantryTag(name: string): Pantry | null {
  const n = strip(name);
  if (!n) return null;
  for (const { tag, words } of KEYWORDS) {
    for (const w of words) {
      if (n.includes(w)) return tag;
    }
  }
  return null;
}

// ── Guardado ───────────────────────────────────────────────────

const LOCAL_KEY = 'rankd_pantry_items';

function localKey(profileId: string) { return `${LOCAL_KEY}:${profileId}`; }

function readLocal(profileId: string): PantryItem[] {
  try {
    const raw = localStorage.getItem(localKey(profileId));
    const list = raw ? (JSON.parse(raw) as PantryItem[]) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function writeLocal(profileId: string, list: PantryItem[]) {
  try { localStorage.setItem(localKey(profileId), JSON.stringify(list)); } catch { /* sin espacio */ }
}

let seq = 0;
function localItemId(): string {
  seq += 1;
  return `pi_${Date.now().toString(36)}_${seq.toString(36)}`;
}

interface ItemRow { id: string; name: string; tag: string | null; available: boolean }

export interface LoadedPantry { items: PantryItem[]; storedLocally: boolean }

export async function loadPantryItems(profileId: string): Promise<LoadedPantry> {
  const { data, error } = await supabase
    .from('pantry_items')
    .select('id, name, tag, available')
    .eq('fighter_profile_id', profileId)
    .order('name', { ascending: true })
    .limit(200);

  if (error) return { items: readLocal(profileId), storedLocally: true };

  const remote = ((data || []) as ItemRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    tag: (r.tag as Pantry | null) ?? null,
    available: r.available !== false,
  }));
  const local = readLocal(profileId).filter((i) => !remote.some((r) => strip(r.name) === strip(i.name)));
  return { items: [...remote, ...local], storedLocally: local.length > 0 && remote.length === 0 };
}

/** Añade un producto. Si ya estaba (mismo nombre), no lo duplica. */
export async function addPantryItem(profileId: string, name: string, existing: PantryItem[]): Promise<{ item: PantryItem | null; storedLocally: boolean; duplicate: boolean }> {
  const clean = name.trim().slice(0, 80);
  if (!clean) return { item: null, storedLocally: false, duplicate: false };
  if (existing.some((i) => strip(i.name) === strip(clean))) {
    return { item: null, storedLocally: false, duplicate: true };
  }

  const tag = matchPantryTag(clean);
  const { data, error } = await supabase.from('pantry_items').insert({
    fighter_profile_id: profileId,
    name: clean,
    tag,
    available: true,
  }).select('id, name, tag, available').maybeSingle();

  if (!error && data) {
    const row = data as ItemRow;
    return {
      item: { id: row.id, name: row.name, tag: (row.tag as Pantry | null) ?? null, available: row.available !== false },
      storedLocally: false,
      duplicate: false,
    };
  }

  const item: PantryItem = { id: localItemId(), name: clean, tag, available: true };
  writeLocal(profileId, [...readLocal(profileId), item]);
  return { item, storedLocally: true, duplicate: false };
}

/** Marca si el producto está o no en casa ahora mismo. */
export async function setPantryAvailable(profileId: string, item: PantryItem, available: boolean): Promise<void> {
  if (item.id.startsWith('pi_')) {
    writeLocal(profileId, readLocal(profileId).map((i) => (i.id === item.id ? { ...i, available } : i)));
    return;
  }
  const { error } = await supabase.from('pantry_items').update({ available }).eq('id', item.id);
  if (error) {
    writeLocal(profileId, [...readLocal(profileId).filter((i) => i.id !== item.id), { ...item, available }]);
  }
}

export async function deletePantryItem(profileId: string, item: PantryItem): Promise<void> {
  writeLocal(profileId, readLocal(profileId).filter((i) => i.id !== item.id));
  if (!item.id.startsWith('pi_')) {
    await supabase.from('pantry_items').delete().eq('id', item.id);
  }
}

/** Etiquetas de despensa que aportan los productos marcados como disponibles. */
export function tagsFromItems(items: PantryItem[]): Pantry[] {
  return [...new Set(items.filter((i) => i.available && i.tag).map((i) => i.tag as Pantry))];
}

/** Productos disponibles que NO encajan en ninguna etiqueta conocida. */
export function looseItems(items: PantryItem[]): PantryItem[] {
  return items.filter((i) => i.available && !i.tag);
}

/**
 * Producto real del usuario que cubre una etiqueta, si lo tiene.
 *
 * Permite que el plan diga "pechuga de pavo" en vez de "pollo" cuando eso es
 * exactamente lo que hay en su nevera.
 */
export function itemForTag(items: PantryItem[], tag: Pantry): PantryItem | null {
  return items.find((i) => i.available && i.tag === tag) || null;
}
