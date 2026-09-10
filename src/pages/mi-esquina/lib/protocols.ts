// ════════════════════════════════════════════════════════════════
// RANKD · Mi Esquina · Protocolos de actividad (punto 16)
//
// Un PROTOCOLO es una sesión escrita por tramos: "0–5 min, inclinación 2 y
// velocidad 6; 5–10 min, inclinación 4 y velocidad 7,5". Se guarda una vez y se
// REPRODUCE en vivo tantas veces como haga falta.
//
// Esto NO es una función de cinta. Es un patrón para CUALQUIER actividad
// registrable: lo único que cambia entre tipos son las VARIABLES de cada tramo
// (inclinación y velocidad en cinta, resistencia y cadencia en bici, ritmo en
// natación o remo…), no la estructura. Por eso:
//
//   · Las variables se declaran en VAR_DEFS y se asignan por tipo en KIND_VARS.
//   · Un tipo de actividad que no esté en KIND_VARS NO se queda fuera: recibe
//     la variable genérica de esfuerzo. Añadir un tipo nuevo a ACTIVITY_KINDS
//     lo hace "protocolizable" sin tocar este archivo.
//
// Sin IA también funciona: `parseProtocolText` entiende el formato de las
// tablas de cardio (minuto · inclinación · velocidad) sin salir del navegador.
// El Asesor (services/protocolImport.ts) es el atajo cómodo, no el requisito.
// ════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { isMissingTable, writeDroppingMissingColumns } from '@/lib/dbState';
import { activityKindCfg, todayISO } from './dayPlan';
import { reconcileDayTicks } from './planTicks';

// ── Variables de tramo ─────────────────────────────────────────

export type ProtocolVarId =
  | 'speed_kmh' | 'incline_pct' | 'resistance' | 'cadence_rpm'
  | 'pace_sec_100m' | 'pace_sec_500m' | 'stroke_rate' | 'effort';

export interface ProtocolVarDef {
  id: ProtocolVarId;
  labelKey: string;
  /** Sufijo corto que se pinta junto al número. Vacío en los ritmos (m:ss). */
  unit: string;
  /** 'pace' se guarda en segundos y se enseña como m:ss. */
  format: 'number' | 'pace';
  step: number;
  min: number;
  max: number;
  /** Decimales al mostrar (solo format 'number'). */
  decimals: number;
}

export const VAR_DEFS: Record<ProtocolVarId, ProtocolVarDef> = {
  speed_kmh:     { id: 'speed_kmh',     labelKey: 'mc_pt_var_speed',     unit: 'km/h', format: 'number', step: 0.5, min: 0,  max: 30,   decimals: 1 },
  incline_pct:   { id: 'incline_pct',   labelKey: 'mc_pt_var_incline',   unit: '%',    format: 'number', step: 0.5, min: 0,  max: 40,   decimals: 1 },
  resistance:    { id: 'resistance',    labelKey: 'mc_pt_var_resist',    unit: '',     format: 'number', step: 1,   min: 0,  max: 30,   decimals: 0 },
  cadence_rpm:   { id: 'cadence_rpm',   labelKey: 'mc_pt_var_cadence',   unit: 'rpm',  format: 'number', step: 5,   min: 0,  max: 160,  decimals: 0 },
  pace_sec_100m: { id: 'pace_sec_100m', labelKey: 'mc_pt_var_pace100',   unit: '/100m', format: 'pace',  step: 5,   min: 30, max: 400,  decimals: 0 },
  pace_sec_500m: { id: 'pace_sec_500m', labelKey: 'mc_pt_var_pace500',   unit: '/500m', format: 'pace',  step: 5,   min: 60, max: 600,  decimals: 0 },
  stroke_rate:   { id: 'stroke_rate',   labelKey: 'mc_pt_var_stroke',    unit: 'spm',  format: 'number', step: 1,   min: 10, max: 60,   decimals: 0 },
  effort:        { id: 'effort',        labelKey: 'mc_pt_var_effort',    unit: '/10',  format: 'number', step: 1,   min: 1,  max: 10,   decimals: 0 },
};

/**
 * Qué variables pide cada tipo de actividad.
 *
 * Lo que NO esté aquí recibe `['effort']`: cualquier actividad se puede
 * protocolizar aunque solo se pueda describir por intensidad. Es la regla que
 * hace que esto valga para "cualquier otra que exista o se añada".
 */
const KIND_VARS: Record<string, ProtocolVarId[]> = {
  correr:   ['speed_kmh', 'incline_pct', 'effort'],
  cinta:    ['speed_kmh', 'incline_pct'],
  bici:     ['resistance', 'cadence_rpm', 'effort'],
  eliptica: ['resistance', 'cadence_rpm', 'effort'],
  natacion: ['pace_sec_100m', 'effort'],
  remo:     ['pace_sec_500m', 'stroke_rate', 'effort'],
  cuerda:   ['effort'],
  boxeo:    ['effort'],
};

const FALLBACK_VARS: ProtocolVarId[] = ['effort'];

/**
 * Orden en el que aparecen las COLUMNAS en las tablas impresas de cada
 * actividad, que no siempre coincide con el orden en que conviene enseñarlas.
 *
 * En una cinta se lee "minuto · inclinación · velocidad" —así vienen las
 * tablas de cardio de toda la vida— pero en pantalla pesa más la velocidad. Sin
 * esta distinción, leer "0-5 | 2 | 6,5" metería el 2 en velocidad y el 6,5 en
 * inclinación: un tramo imposible presentado como si fuera correcto.
 *
 * Solo se declara donde hay una convención clara; el resto usa su orden normal.
 */
const KIND_COLUMN_ORDER: Record<string, ProtocolVarId[]> = {
  correr: ['incline_pct', 'speed_kmh', 'effort'],
  cinta: ['incline_pct', 'speed_kmh'],
};

/** Definiciones de las variables de ese tipo de actividad, en orden. */
export function protocolVarsFor(kind: string): ProtocolVarDef[] {
  return (KIND_VARS[kind] || FALLBACK_VARS).map((id) => VAR_DEFS[id]);
}

/** Las mismas variables, en el orden de columnas del documento original. */
export function protocolColumnOrder(kind: string): ProtocolVarDef[] {
  const order = KIND_COLUMN_ORDER[kind];
  if (!order) return protocolVarsFor(kind);
  const allowed = new Set(protocolVarsFor(kind).map((v) => v.id));
  return order.filter((id) => allowed.has(id)).map((id) => VAR_DEFS[id]);
}

/** "6,5" / "2:05". Cómo se enseña un valor de tramo. */
export function formatVarValue(def: ProtocolVarDef, value: number): string {
  if (def.format === 'pace') {
    const s = Math.max(0, Math.round(value));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  return def.decimals > 0
    ? String(+value.toFixed(def.decimals)).replace('.', ',')
    : String(Math.round(value));
}

// ── El protocolo ───────────────────────────────────────────────

export interface ProtocolSegment {
  id: string;
  /** Nombre del tramo ("Calentamiento", "Serie 3"). Opcional. */
  label?: string;
  /** Duración en segundos. 0 solo si el tramo se mide por distancia. */
  seconds: number;
  /** Alternativa a la duración: metros a cubrir. */
  meters?: number;
  /** Valores que tocan en ESE tramo. Solo las variables de su tipo. */
  values: Partial<Record<ProtocolVarId, number>>;
  note?: string;
}

export interface Protocol {
  id: string;
  name: string;
  /** Clave de ACTIVITY_KINDS. */
  kind: string;
  segments: ProtocolSegment[];
  note?: string;
  source: 'manual' | 'import';
  createdAt: string;
  /** Última reproducción terminada, si la hay. */
  lastRunAt?: string | null;
}

let seq = 0;
/** Identificador local para tramos y protocolos sin fila en la base. */
export function localId(prefix = 'seg'): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}`;
}

export function emptySegment(kind: string): ProtocolSegment {
  const vars = protocolVarsFor(kind);
  const values: Partial<Record<ProtocolVarId, number>> = {};
  // Un tramo nuevo arranca con un valor razonable en cada variable: teclearlo
  // todo desde cero en el móvil es justo lo que hace que nadie use esto.
  vars.forEach((v) => { values[v.id] = defaultValueFor(v); });
  return { id: localId(), seconds: 300, values };
}

function defaultValueFor(v: ProtocolVarDef): number {
  if (v.id === 'speed_kmh') return 6;
  if (v.id === 'incline_pct') return 1;
  if (v.id === 'resistance') return 5;
  if (v.id === 'cadence_rpm') return 80;
  if (v.id === 'pace_sec_100m') return 120;
  if (v.id === 'pace_sec_500m') return 150;
  if (v.id === 'stroke_rate') return 24;
  return 5;
}

export function emptyProtocol(kind: string, name: string): Protocol {
  return {
    id: localId('prot'),
    name,
    kind,
    segments: [emptySegment(kind)],
    source: 'manual',
    createdAt: new Date().toISOString(),
  };
}

// ── Cuentas del protocolo ──────────────────────────────────────

export interface ProtocolTotals {
  seconds: number;
  meters: number;
  segments: number;
  /** true si algún tramo se mide por distancia (no se puede cronometrar solo). */
  hasDistance: boolean;
}

export function protocolTotals(p: Protocol): ProtocolTotals {
  let seconds = 0;
  let meters = 0;
  let hasDistance = false;
  for (const s of p.segments) {
    seconds += Math.max(0, s.seconds || 0);
    if (s.meters && s.meters > 0) { meters += s.meters; hasDistance = true; }
  }
  return { seconds, meters, segments: p.segments.length, hasDistance };
}

/** "12:30" o "1:05:00". Segundos a reloj. */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

/** Minuto en el que ARRANCA cada tramo. Para pintar la tabla completa. */
export function segmentStarts(p: Protocol): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const s of p.segments) { out.push(acc); acc += Math.max(0, s.seconds || 0); }
  return out;
}

/** ¿Han cambiado los valores respecto al tramo anterior? Para resaltar el cambio. */
export function changedVars(prev: ProtocolSegment | undefined, next: ProtocolSegment): ProtocolVarId[] {
  if (!prev) return [];
  const ids = new Set<ProtocolVarId>([
    ...(Object.keys(prev.values) as ProtocolVarId[]),
    ...(Object.keys(next.values) as ProtocolVarId[]),
  ]);
  return [...ids].filter((id) => (prev.values[id] ?? null) !== (next.values[id] ?? null));
}

// ── Leer un protocolo escrito a mano (sin IA) ──────────────────
//
// Las tablas de cardio que maneja la gente son casi siempre "minuto ·
// inclinación · velocidad", con mil variantes de formato. Este parser cubre las
// habituales y, cuando tiene que suponer algo, lo dice en `warnings` en vez de
// callárselo: un tramo mal leído en una sesión de intervalos no es un detalle.

export interface ParsedProtocol {
  segments: ProtocolSegment[];
  /** Avisos de lo que ha tenido que suponer. Se enseñan al usuario. */
  warnings: string[];
}

/** Palabras que identifican cada variable, en español e inglés. */
const VAR_WORDS: { id: ProtocolVarId; words: string[] }[] = [
  { id: 'incline_pct',   words: ['inclinacion', 'inclinación', 'incl', 'pendiente', 'incline', 'grade', 'gradient'] },
  { id: 'speed_kmh',     words: ['velocidad', 'vel', 'speed', 'km/h', 'kmh', 'kph'] },
  { id: 'resistance',    words: ['resistencia', 'resist', 'res', 'resistance', 'nivel', 'level', 'carga', 'load'] },
  { id: 'cadence_rpm',   words: ['cadencia', 'cadence', 'rpm'] },
  { id: 'stroke_rate',   words: ['paladas', 'brazadas', 'spm', 'stroke'] },
  { id: 'pace_sec_100m', words: ['ritmo100', '100m', 'pace100'] },
  { id: 'pace_sec_500m', words: ['ritmo500', '500m', 'pace500'] },
  { id: 'effort',        words: ['esfuerzo', 'intensidad', 'rpe', 'effort', 'intensity'] },
];

const strip = (s: string) => s
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const num = (raw: string): number => parseFloat(raw.replace(',', '.'));

/** "5:30" o "5" → segundos (el número suelto se lee como minutos). */
function timeToSeconds(raw: string): number {
  const m = raw.match(/^(\d+):(\d{1,2})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const n = num(raw);
  return Number.isFinite(n) ? Math.round(n * 60) : 0;
}

/**
 * Convierte un texto pegado en tramos.
 *
 * Reconoce, por línea:
 *   · "0-5"  "0:00-5:00"  "min 0 a 5"     → tramo que va de un minuto a otro
 *   · "5 min"  "90 s"  "3'"                → duración suelta
 *   · "400 m"  "1 km"                      → tramo por distancia
 *   · "inclinación 2  velocidad 6,5"       → valores con su nombre
 *   · "0-5 | 2 | 6,5"                      → valores por posición, en el orden
 *                                            de las variables del tipo
 */
export function parseProtocolText(text: string, kind: string): ParsedProtocol {
  const vars = protocolVarsFor(kind);
  // Para leer números sueltos manda el orden de COLUMNAS del documento, no el
  // de pantalla: en una tabla de cinta la inclinación va antes que la velocidad.
  const columns = protocolColumnOrder(kind);
  const warnings: string[] = [];
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  interface Draft {
    startSec: number | null;
    seconds: number;
    meters?: number;
    label?: string;
    values: Partial<Record<ProtocolVarId, number>>;
  }
  const drafts: Draft[] = [];

  for (const line of rawLines) {
    // Cabeceras de tabla ("minuto | inclinación | velocidad") — se saltan.
    if (!/\d/.test(line)) continue;

    const d: Draft = { startSec: null, seconds: 0, values: {} };
    let rest = line;

    // 1. Rango de minutos: "0-5", "0:00 - 5:00", "del 5 al 10".
    const range = rest.match(/(?:^|[^\d])(\d{1,3}(?::\d{2})?)\s*(?:-|–|—|a|to|hasta)\s*(\d{1,3}(?::\d{2})?)/i);
    if (range) {
      const a = timeToSeconds(range[1]);
      const b = timeToSeconds(range[2]);
      if (b > a) {
        d.startSec = a;
        d.seconds = b - a;
        rest = rest.replace(range[0], ' ');
      }
    }

    // 2. Distancia explícita.
    const dist = rest.match(/(\d+(?:[.,]\d+)?)\s*(km|m)\b(?!\/)/i);
    if (dist) {
      const v = num(dist[1]);
      if (Number.isFinite(v) && v > 0) {
        d.meters = Math.round(dist[2].toLowerCase() === 'km' ? v * 1000 : v);
        rest = rest.replace(dist[0], ' ');
      }
    }

    // 3. Duración suelta: "5 min", "90 s", "3'", "45\"".
    //    El corte de unidad va con un lookahead en vez de `\b`: la comilla de
    //    los minutos no es un carácter de palabra y `\b` nunca la habría
    //    reconocido, que es justo el formato que usa media gente.
    if (d.seconds === 0) {
      const dur = rest.match(/(\d+(?:[.,]\d+)?)\s*(minutos|minuto|mins|min|segundos|segs|seg|sec|s|'|")(?![a-zA-Z0-9])/i);
      if (dur) {
        const v = num(dur[1]);
        const unit = strip(dur[2]);
        if (Number.isFinite(v) && v > 0) {
          const inSeconds = unit.startsWith('s') || unit === '"';
          d.seconds = inSeconds ? Math.round(v) : Math.round(v * 60);
          rest = rest.replace(dur[0], ' ');
        }
      }
    }

    // 4. Un "minuto N" suelto marca dónde EMPIEZA el tramo; la duración sale
    //    de la distancia hasta el siguiente. Es el formato más común de las
    //    tablas de cinta.
    if (d.seconds === 0 && d.startSec === null && !d.meters) {
      const at = rest.match(/(?:min(?:uto)?s?\.?|minute)\s*(\d{1,3}(?::\d{2})?)/i);
      if (at) {
        d.startSec = timeToSeconds(at[1]);
        rest = rest.replace(at[0], ' ');
      }
    }

    // 5. Valores con nombre: "inclinación 2", "vel 6,5", "rpm 85".
    for (const { id, words } of VAR_WORDS) {
      if (!vars.some((v) => v.id === id)) continue;
      for (const w of words) {
        // `\b` delante: sin él, "vel" se colaba dentro de "nivel 8" y una
        // resistencia acababa guardada como velocidad.
        const re = new RegExp(`\\b${w.replace(/[/.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:=]?\\s*(\\d{1,3}(?::\\d{2})?(?:[.,]\\d+)?)`, 'i');
        const m = strip(rest).match(re);
        if (m) {
          const def = VAR_DEFS[id];
          d.values[id] = def.format === 'pace' ? timeToSeconds(m[1]) : num(m[1]);
          // Se borra del texto restante para que no lo pille la lectura por
          // posición de abajo.
          const idx = strip(rest).indexOf(m[0]);
          if (idx >= 0) rest = rest.slice(0, idx) + ' '.repeat(m[0].length) + rest.slice(idx + m[0].length);
          break;
        }
      }
    }

    // 6. Lo que quede sin nombre se lee POR POSICIÓN, en el orden de columnas
    //    del documento. Es lo que hace que "0-5 | 2 | 6,5" funcione.
    const pending = columns.filter((v) => d.values[v.id] === undefined);
    let loose = (rest.match(/\d+(?:[.,]\d+)?/g) || []).map(num).filter((n) => Number.isFinite(n));

    // Muchas tablas de cardio no escriben la palabra "minuto": la primera
    // columna es la marca de tiempo a secas ("3 | 2 | 6,0"). Se detecta porque
    // sobra un número por la izquierda y no se ha encontrado duración por
    // ningún otro camino. Sin esto, el minuto se colaba como inclinación.
    if (loose.length > pending.length && d.seconds === 0 && !d.meters && d.startSec === null) {
      d.startSec = Math.round(loose[0] * 60);
      loose = loose.slice(1);
    }

    pending.forEach((v, i) => { if (i < loose.length) d.values[v.id] = loose[i]; });
    if (loose.length > pending.length) warnings.push('EXTRA_NUMBERS');

    // 7. Nombre del tramo: el texto que quede sin números ni símbolos.
    const label = rest.replace(/[\d.,:|·\-–—/%]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (label.length >= 3) d.label = label.slice(0, 40);

    drafts.push(d);
  }

  // Duraciones que faltaban: se deducen del arranque del tramo siguiente.
  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i];
    if (d.seconds > 0 || d.meters) continue;
    const next = drafts[i + 1];
    if (d.startSec !== null && next?.startSec !== null && next?.startSec !== undefined && next.startSec > d.startSec) {
      d.seconds = next.startSec - d.startSec;
    } else if (d.startSec !== null && i > 0 && drafts[i - 1].seconds > 0) {
      // El último tramo de la tabla no tiene "siguiente": se le da la misma
      // duración que al anterior y se avisa de que es una suposición.
      d.seconds = drafts[i - 1].seconds;
      warnings.push('LAST_GUESS');
    } else {
      d.seconds = 300;
      warnings.push('LAST_GUESS');
    }
  }

  const segments: ProtocolSegment[] = drafts
    .filter((d) => d.seconds > 0 || (d.meters || 0) > 0)
    .map((d) => ({
      id: localId(),
      label: d.label,
      seconds: Math.max(0, Math.round(d.seconds)),
      meters: d.meters,
      values: d.values,
    }));

  return { segments, warnings: [...new Set(warnings)] };
}

// ── Guardado ───────────────────────────────────────────────────
//
// Igual que el resto de Mi Esquina: primero la base (migración 0053) y, si la
// tabla todavía no existe, este navegador. `storedLocally` permite decírselo al
// usuario en vez de aparentar que está en su cuenta.

const LOCAL_KEY = 'rankd_protocols';

function localKey(profileId: string) { return `${LOCAL_KEY}:${profileId}`; }

function readLocal(profileId: string): Protocol[] {
  try {
    const raw = localStorage.getItem(localKey(profileId));
    const list = raw ? (JSON.parse(raw) as Protocol[]) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function writeLocal(profileId: string, list: Protocol[]) {
  try { localStorage.setItem(localKey(profileId), JSON.stringify(list)); } catch { /* sin espacio */ }
}

interface ProtocolRow {
  id: string;
  name: string;
  kind: string;
  segments: ProtocolSegment[];
  note: string | null;
  source: string;
  created_at: string;
}

const rowToProtocol = (r: ProtocolRow): Protocol => ({
  id: r.id,
  name: r.name,
  kind: r.kind || 'otro',
  segments: Array.isArray(r.segments) ? r.segments : [],
  note: r.note || undefined,
  source: r.source === 'import' ? 'import' : 'manual',
  createdAt: r.created_at,
});

export interface LoadedProtocols {
  protocols: Protocol[];
  storedLocally: boolean;
}

/** Todos los protocolos del usuario, más recientes primero. */
export async function loadProtocols(profileId: string): Promise<LoadedProtocols> {
  const { data, error } = await supabase
    .from('activity_protocols')
    .select('id, name, kind, segments, note, source, created_at')
    .eq('fighter_profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return { protocols: readLocal(profileId), storedLocally: true };
  }
  const remote = ((data || []) as ProtocolRow[]).map(rowToProtocol);
  // Los que se guardaron sin base siguen a la vista hasta que se apliquen las
  // migraciones: perderlos de golpe sería peor que enseñarlos mezclados.
  const local = readLocal(profileId).filter((p) => !remote.some((r) => r.id === p.id));
  return { protocols: [...remote, ...local], storedLocally: local.length > 0 && remote.length === 0 };
}

/** Crea o actualiza. Devuelve el protocolo con su id definitivo. */
export async function saveProtocol(profileId: string, p: Protocol): Promise<{ protocol: Protocol; storedLocally: boolean }> {
  const payload = {
    fighter_profile_id: profileId,
    name: p.name.trim().slice(0, 120) || 'Protocolo',
    kind: p.kind,
    segments: p.segments,
    note: p.note?.trim() || null,
    source: p.source,
    updated_at: new Date().toISOString(),
  };

  // Un id local ("prot_…") nunca existe en la base: siempre es alta.
  const isLocalId = p.id.startsWith('prot_');

  const { result } = await writeDroppingMissingColumns(
    [payload],
    (rows) => (isLocalId
      ? supabase.from('activity_protocols').insert(rows).select().maybeSingle()
      : supabase.from('activity_protocols').update(rows[0]).eq('id', p.id).select().maybeSingle()),
    ['fighter_profile_id', 'name', 'kind', 'segments'],
  );

  if (!result.error && result.data) {
    // Si estaba en local, se limpia: ya vive en la cuenta.
    writeLocal(profileId, readLocal(profileId).filter((x) => x.id !== p.id));
    return { protocol: rowToProtocol(result.data as ProtocolRow), storedLocally: false };
  }

  // Sin base: se conserva en este navegador con su id local.
  const stored: Protocol = { ...p, id: isLocalId ? p.id : localId('prot') };
  const list = readLocal(profileId).filter((x) => x.id !== stored.id);
  writeLocal(profileId, [stored, ...list]);
  return { protocol: stored, storedLocally: true };
}

/**
 * Un protocolo concreto por id, mire donde mire (cuenta o navegador).
 *
 * Lo usa la Agenda para abrir el reproductor al tocar el bloque de cardio. Se
 * apoya en `loadProtocols` y no en un SELECT propio porque los protocolos
 * guardados sin base viven en localStorage: el acceso directo tiene que
 * funcionar también con las migraciones sin aplicar.
 */
export async function loadProtocolById(profileId: string, id: string): Promise<Protocol | null> {
  const { protocols } = await loadProtocols(profileId);
  return protocols.find((p) => p.id === id) ?? null;
}

export async function deleteProtocol(profileId: string, id: string): Promise<void> {
  writeLocal(profileId, readLocal(profileId).filter((x) => x.id !== id));
  if (!id.startsWith('prot_')) {
    await supabase.from('activity_protocols').delete().eq('id', id);
  }
}

// ── Reproducciones ─────────────────────────────────────────────

export interface ProtocolRun {
  id: string;
  protocolId: string | null;
  protocolName: string;
  kind: string;
  runDate: string;
  secondsDone: number;
  segmentsDone: number;
  completed: boolean;
}

interface RunRow {
  id: string;
  protocol_id: string | null;
  protocol_name: string;
  kind: string;
  run_date: string;
  seconds_done: number;
  segments_done: number;
  completed: boolean;
}

const LOCAL_RUNS_KEY = 'rankd_protocol_runs';

function readLocalRuns(profileId: string): ProtocolRun[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_RUNS_KEY}:${profileId}`);
    const list = raw ? (JSON.parse(raw) as ProtocolRun[]) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function writeLocalRuns(profileId: string, list: ProtocolRun[]) {
  try { localStorage.setItem(`${LOCAL_RUNS_KEY}:${profileId}`, JSON.stringify(list.slice(0, 60))); } catch { /* nada */ }
}

/** Últimas reproducciones, para enseñar "última vez" en la biblioteca. */
export async function loadRuns(profileId: string): Promise<ProtocolRun[]> {
  const { data, error } = await supabase
    .from('protocol_runs')
    .select('id, protocol_id, protocol_name, kind, run_date, seconds_done, segments_done, completed')
    .eq('fighter_profile_id', profileId)
    .order('run_date', { ascending: false })
    .limit(60);
  if (isMissingTable(error) || error) return readLocalRuns(profileId);
  return ((data || []) as RunRow[]).map((r) => ({
    id: r.id,
    protocolId: r.protocol_id,
    protocolName: r.protocol_name,
    kind: r.kind,
    runDate: r.run_date,
    secondsDone: r.seconds_done,
    segmentsDone: r.segments_done,
    completed: r.completed,
  }));
}

export interface FinishResult {
  /** Sesión creada en el historial de Actividad. */
  sessionId: string | null;
  /** true si la marca de "protocolo completado" se quedó en este navegador. */
  storedLocally: boolean;
  /** true si ni siquiera se pudo crear la sesión de actividad. */
  sessionFailed: boolean;
}

/**
 * Cierra una reproducción.
 *
 * Hace las DOS cosas que pide el encargo, en este orden de importancia:
 *   1. La sesión entra en el HISTORIAL de siempre (`activity_sessions`), con la
 *      duración y la distancia realmente hechas. Es lo que alimenta gráficas,
 *      rachas y resumen semanal: un protocolo hecho es un entreno hecho.
 *   2. Se deja la marca de "este protocolo se completó tal día"
 *      (`protocol_runs`), que es lo que permite enseñar "última vez" y saber si
 *      se llegó al final o se cortó a medias.
 *
 * Si la 2 falla (migración sin aplicar) NO se pierde la 1: el entreno queda
 * registrado igual y la marca se guarda en este navegador.
 */
export async function finishRun(
  profileId: string,
  protocol: Protocol,
  done: { secondsDone: number; segmentsDone: number; completed: boolean; distanceMeters: number; note?: string },
  /**
   * Día al que pertenece la sesión. Lo pasa la Agenda cuando el protocolo se
   * abre desde el bloque de un día concreto; sin él, hoy. Nunca se registra en
   * el futuro: hacer una sesión "el viernes que viene" no es una sesión hecha.
   */
  onDate?: string,
): Promise<FinishResult> {
  const today = todayISO();
  const date = onDate && onDate < today ? onDate : today;
  const cfg = activityKindCfg(protocol.kind);
  const minutes = Math.max(1, Math.round(done.secondsDone / 60));

  // ── 1. Historial de Actividad ──
  const session: Record<string, unknown> = {
    fighter_profile_id: profileId,
    session_date: date,
    kind: protocol.kind,
    duration_min: minutes,
    note: (done.note || protocol.name).slice(0, 400),
  };
  if (cfg.fields.includes('distance_km') && done.distanceMeters > 0) {
    session.distance_km = +(done.distanceMeters / 1000).toFixed(2);
  }
  if (cfg.fields.includes('meters') && done.distanceMeters > 0) {
    session.meters = Math.round(done.distanceMeters);
  }
  // Inclinación media de los tramos que la llevan: es el dato que el usuario
  // esperaría ver luego en la ficha de la sesión.
  if (cfg.fields.includes('incline')) {
    const inclines = protocol.segments
      .map((s) => s.values.incline_pct)
      .filter((v): v is number => typeof v === 'number');
    if (inclines.length > 0) {
      session.incline_percent = +(inclines.reduce((a, b) => a + b, 0) / inclines.length).toFixed(1);
    }
  }

  const { result: sessRes } = await writeDroppingMissingColumns(
    [session],
    (rows) => supabase.from('activity_sessions').insert(rows).select().maybeSingle(),
    ['fighter_profile_id', 'session_date', 'kind', 'duration_min'],
  );
  const sessionId = (sessRes.data as { id?: string } | null)?.id ?? null;

  // ── 2. Marca de protocolo completado ──
  const run = {
    fighter_profile_id: profileId,
    protocol_id: protocol.id.startsWith('prot_') ? null : protocol.id,
    protocol_name: protocol.name,
    kind: protocol.kind,
    run_date: date,
    seconds_done: Math.round(done.secondsDone),
    segments_done: done.segmentsDone,
    completed: done.completed,
    activity_session_id: sessionId,
  };
  const { result: runRes } = await writeDroppingMissingColumns(
    [run],
    (rows) => supabase.from('protocol_runs').insert(rows).select().maybeSingle(),
    ['fighter_profile_id', 'protocol_name', 'run_date'],
  );

  let storedLocally = false;
  if (runRes.error) {
    storedLocally = true;
    writeLocalRuns(profileId, [{
      id: localId('run'),
      protocolId: protocol.id,
      protocolName: protocol.name,
      kind: protocol.kind,
      runDate: date,
      secondsDone: Math.round(done.secondsDone),
      segmentsDone: done.segmentsDone,
      completed: done.completed,
    }, ...readLocalRuns(profileId)]);
  }

  // ── 3. Cerrar el círculo con la Agenda ──
  // El bloque planificado de ese día pasa a "hecho" solo. Va aquí y no en cada
  // pantalla que llama a `finishRun` para que ninguna se olvide: terminar un
  // protocolo SIEMPRE debe marcar el día, se haya abierto desde donde se haya
  // abierto. Es best-effort y silencioso.
  if (!sessRes.error) void reconcileDayTicks(profileId, date);

  return { sessionId, storedLocally, sessionFailed: !!sessRes.error };
}
