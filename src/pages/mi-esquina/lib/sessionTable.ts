// ════════════════════════════════════════════════════════════════
// RANKD · Mi Esquina · De la tabla del Asesor al cronómetro
//
// El Asesor contesta las sesiones (un Hyrox, un WOD, un cardio de cinta) en
// una tabla con cuatro columnas fijas: Tramo | Qué hacer | Tiempo | Detalle.
// Este archivo lee esa tabla EN EL NAVEGADOR y la convierte en un protocolo
// que el reproductor sabe seguir tramo a tramo.
//
// Sin volver a llamar a la IA: la tabla ya está escrita, pedirle a un modelo
// que la pase a JSON sería pagar dos veces por lo mismo y esperar diez
// segundos más con el dedo en el botón.
//
// No depende de que la IA acierte el formato al pie de la letra. Las columnas
// se reconocen por su nombre ("Tiempo", "Duración", "Time"…), no por su
// posición, y las celdas se leen con las mismas tolerancias que las tablas de
// cardio pegadas a mano. Si no hay columna de tiempo, no es una sesión: es una
// tabla de otra cosa (macros, comparativa de guantes) y no se ofrece nada.
// ════════════════════════════════════════════════════════════════

import { ACTIVITY_KINDS } from './dayPlan';
import { localId, protocolVarsFor, type Protocol, type ProtocolSegment, type ProtocolVarId } from './protocols';
import { emptyBoxingSession, type BoxingPlace, type BoxingSession } from './boxing';

// ── Tablas markdown ────────────────────────────────────────────

export interface TablaMd {
  cabecera: string[];
  filas: string[][];
}

const esFilaTabla = (l: string) => /^\s*\|.*\|\s*$/.test(l) || /^\s*\|.+\|/.test(l);
const esSeparador = (celdas: string[]) => celdas.length > 0 && celdas.every((c) => /^:?-{2,}:?$/.test(c.replace(/\s/g, '')));

/** "| a | b |" → ["a", "b"]. */
export function celdasDe(linea: string): string[] {
  let s = linea.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

/**
 * Trocea un texto en bloques de texto normal y tablas, en orden.
 *
 * Lo usan el formateador del chat (para pintar las tablas) y el lector de
 * sesiones (para convertirlas): así los dos ven exactamente las mismas tablas.
 */
export function trocearTablas(texto: string): ({ tipo: 'texto'; lineas: string[] } | { tipo: 'tabla'; tabla: TablaMd })[] {
  const lineas = texto.split('\n');
  const out: ({ tipo: 'texto'; lineas: string[] } | { tipo: 'tabla'; tabla: TablaMd })[] = [];
  let i = 0;
  while (i < lineas.length) {
    if (esFilaTabla(lineas[i])) {
      const bloque: string[][] = [];
      while (i < lineas.length && esFilaTabla(lineas[i])) { bloque.push(celdasDe(lineas[i])); i++; }
      // Una sola línea con barras no es una tabla: es una frase con "|".
      if (bloque.length >= 2) {
        const cabecera = bloque[0];
        const resto = esSeparador(bloque[1]) ? bloque.slice(2) : bloque.slice(1);
        const filas = resto.filter((f) => !esSeparador(f) && f.some((c) => c));
        out.push({ tipo: 'tabla', tabla: { cabecera, filas } });
        continue;
      }
      const ult = out[out.length - 1];
      const raw = lineas[i - 1];
      if (ult && ult.tipo === 'texto') ult.lineas.push(raw); else out.push({ tipo: 'texto', lineas: [raw] });
      continue;
    }
    const ult = out[out.length - 1];
    if (ult && ult.tipo === 'texto') ult.lineas.push(lineas[i]); else out.push({ tipo: 'texto', lineas: [lineas[i]] });
    i++;
  }
  return out;
}

// ── El marcador ────────────────────────────────────────────────

/** [SESION: hyrox] — no se enseña; dice de qué tipo es la sesión. */
export const SESION_RE = /\[SESI[OÓ]N:\s*([^\]]*)\]/i;

export function sinMarcadorSesion(texto: string): string {
  return texto.replace(new RegExp(SESION_RE.source, 'gi'), '').trimEnd();
}

// ── Lectura de celdas ──────────────────────────────────────────

const plano = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const num = (raw: string) => parseFloat(raw.replace(',', '.'));
const sinMd = (s: string) => s.replace(/\*\*/g, '').replace(/`/g, '').trim();

/** Busca la columna cuyo nombre encaje. -1 si no hay. */
function columna(cabecera: string[], re: RegExp): number {
  return cabecera.findIndex((c) => re.test(plano(sinMd(c))));
}

const COL_TIEMPO = /tiempo|duracion|time|duration|^min(uto)?s?$|distancia|distance|volumen|reps|repeticiones/;
const COL_QUE = /que hacer|ejercicio|exercise|what|actividad|movimiento|accion|estacion|station|trabajo|work/;
const COL_TRAMO = /tramo|bloque|fase|ronda|round|serie|set|asalto|segment|block|step|paso|parte/;
const COL_DETALLE = /detalle|detail|carga|load|ritmo|pace|nota|notes|intensidad|intensity|como|how|peso/;

/**
 * Lo que dice una celda de tiempo.
 *
 * "4 min", "45 s", "1:30", "1 min 30 s", "3'", "0-5 min"  → segundos
 * "400 m", "1 km", "1,5 km"                                 → metros
 * "20 reps", "100 reps (~4 min)"                            → repeticiones (+ estimación)
 * "3 x 4 min"                                               → se repite 3 veces
 */
interface CeldaTiempo { seconds: number; meters?: number; reps?: number; veces: number }

function duracion(s: string): number {
  const t = plano(s);
  // m:ss (o h:mm:ss) suelto
  const reloj = t.match(/(?:^|[^\d])(\d{1,2}):(\d{2})(?::(\d{2}))?(?![\d/])/);
  if (reloj && !/\/\s*(km|100|500)/.test(t)) {
    return reloj[3] !== undefined
      ? parseInt(reloj[1], 10) * 3600 + parseInt(reloj[2], 10) * 60 + parseInt(reloj[3], 10)
      : parseInt(reloj[1], 10) * 60 + parseInt(reloj[2], 10);
  }
  let total = 0;
  const h = t.match(/(\d+(?:[.,]\d+)?)\s*(?:h|horas?)(?![a-z])/);
  if (h) total += num(h[1]) * 3600;
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:min(?:utos?|s)?|')(?![a-z])/);
  if (m) total += num(m[1]) * 60;
  const sg = t.match(/(\d+(?:[.,]\d+)?)\s*(?:s|seg(?:undos?|s)?|sec|")(?![a-z])/);
  if (sg) total += num(sg[1]);
  return Math.round(total);
}

function leerTiempo(celda: string): CeldaTiempo | null {
  const t = plano(sinMd(celda));
  if (!/\d/.test(t)) return null;
  let resto = t;
  let veces = 1;
  const rep = resto.match(/^(\d{1,2})\s*[x×]\s*(?=\d)/);
  if (rep) { veces = Math.min(20, Math.max(1, parseInt(rep[1], 10))); resto = resto.slice(rep[0].length); }

  // Repeticiones: mandan sobre el tiempo, que en ese caso es una estimación.
  const reps = resto.match(/(\d{1,4})\s*(?:reps?|repeticiones|rep\.)(?![a-z])/);
  // Rango de minutos: "0-5", "5-10 min".
  const rango = resto.match(/^(?:min(?:uto)?s?\.?\s*)?(\d{1,3})\s*[-–]\s*(\d{1,3})\s*(?:min(?:utos?)?)?\s*$/);
  const dist = resto.match(/(\d+(?:[.,]\d+)?)\s*(km|m)(?![a-z/])/);
  const dur = rango ? (parseInt(rango[2], 10) - parseInt(rango[1], 10)) * 60 : duracion(resto);

  if (reps) {
    return { seconds: dur > 0 ? dur : 0, reps: parseInt(reps[1], 10), veces };
  }
  if (dist) {
    const v = num(dist[1]);
    const metros = Math.round(dist[2] === 'km' ? v * 1000 : v);
    if (metros > 0) return { seconds: dur > 0 ? dur : 0, meters: metros, veces };
  }
  if (dur > 0) return { seconds: dur, veces };
  return null;
}

/** Números de máquina que haya en el detalle, solo los que su tipo entiende. */
function leerValores(detalle: string, kind: string): Partial<Record<ProtocolVarId, number>> {
  const t = plano(detalle);
  const admite = new Set(protocolVarsFor(kind).map((v) => v.id));
  const out: Partial<Record<ProtocolVarId, number>> = {};
  const poner = (id: ProtocolVarId, v: number) => { if (admite.has(id) && Number.isFinite(v)) out[id] = +v.toFixed(2); };

  const vel = t.match(/(\d+(?:[.,]\d+)?)\s*km\s*\/?\s*h/);
  if (vel) poner('speed_kmh', num(vel[1]));
  // Ritmo por km → velocidad, que es lo que se teclea en una cinta.
  const ritmoKm = t.match(/(\d{1,2}):(\d{2})\s*(?:min\s*)?\/\s*km/);
  if (ritmoKm && out.speed_kmh === undefined) {
    const seg = parseInt(ritmoKm[1], 10) * 60 + parseInt(ritmoKm[2], 10);
    if (seg > 0) poner('speed_kmh', 3600 / seg);
  }
  const incl = t.match(/(?:inclinacion|incl\.?|pendiente)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/) || t.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (incl) poner('incline_pct', num(incl[1]));
  const res = t.match(/(?:resistencia|nivel|level|resist\.?)\s*[:=]?\s*(\d{1,2})/);
  if (res) poner('resistance', num(res[1]));
  const rpm = t.match(/(\d{2,3})\s*rpm/);
  if (rpm) poner('cadence_rpm', num(rpm[1]));
  const p500 = t.match(/(\d):(\d{2})\s*(?:min\s*)?\/\s*500/);
  if (p500) poner('pace_sec_500m', parseInt(p500[1], 10) * 60 + parseInt(p500[2], 10));
  const p100 = t.match(/(\d):(\d{2})\s*(?:min\s*)?\/\s*100/);
  if (p100) poner('pace_sec_100m', parseInt(p100[1], 10) * 60 + parseInt(p100[2], 10));
  const spm = t.match(/(\d{2})\s*(?:spm|paladas)/);
  if (spm) poner('stroke_rate', num(spm[1]));
  const esf = t.match(/(?:rpe|esfuerzo|intensidad)\s*[:=]?\s*(\d{1,2})/) || t.match(/(?:^|[^\d])(\d{1,2})\s*\/\s*10(?!\d)/);
  if (esf) { const v = num(esf[1]); if (v >= 1 && v <= 10) poner('effort', v); }
  return out;
}

const ES_DESCANSO = /descans|recupera|rest\b|pausa|transici/;

/** Segundos que se tarda en cubrir unos metros, para el total de la sesión. */
function estimarSegundos(metros: number, detalle: string, kind: string): number {
  const t = plano(detalle);
  const ritmoKm = t.match(/(\d{1,2}):(\d{2})\s*(?:min\s*)?\/\s*km/);
  if (ritmoKm) return Math.round((parseInt(ritmoKm[1], 10) * 60 + parseInt(ritmoKm[2], 10)) * (metros / 1000));
  const vel = t.match(/(\d+(?:[.,]\d+)?)\s*km\s*\/?\s*h/);
  if (vel && num(vel[1]) > 0) return Math.round((metros / 1000) / num(vel[1]) * 3600);
  const p500 = t.match(/(\d):(\d{2})\s*(?:min\s*)?\/\s*500/);
  if (p500) return Math.round((parseInt(p500[1], 10) * 60 + parseInt(p500[2], 10)) * (metros / 500));
  // Ritmos de referencia por actividad: rodaje, remo y nado tranquilos.
  const porKm = kind === 'remo' ? 260 : kind === 'natacion' ? 1200 : kind === 'bici' ? 150 : kind === 'caminar' ? 660 : 360;
  return Math.round(porKm * (metros / 1000));
}

/** "descanso 1 min" dentro del detalle. */
function descansoEn(detalle: string): number {
  const t = plano(detalle);
  const m = t.match(/(?:descanso|descansa|rest|recupera(?:cion)?)(?:\s+entre\s+[a-z]+)?\s*[:=]?\s*(\d+(?::\d{2})?(?:[.,]\d+)?\s*(?:min(?:utos?)?|s|seg(?:undos?)?|'|")?(?:\s*\d+\s*(?:s|seg|"))?)/);
  if (!m) return 0;
  const s = duracion(m[1]);
  // Un número sin unidad tras "descanso" casi siempre son segundos si es
  // grande y minutos si es pequeño ("descanso 90" / "descanso 2").
  if (s === 0) {
    const n = num(m[1]);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n >= 10 ? n : n * 60);
  }
  return s;
}

// ── Tipo de sesión ─────────────────────────────────────────────

const KINDS = new Set(ACTIVITY_KINDS.map((k) => k.value));

function adivinarTipo(texto: string): string {
  const t = plano(texto);
  if (/hyrox/.test(t)) return 'hyrox';
  if (/crossfit|\bwod\b|amrap|emom|for time/.test(t)) return 'crossfit';
  if (/cinta|treadmill/.test(t)) return 'cinta';
  if (/\bbici|spinning|assault bike|cycling/.test(t)) return 'bici';
  if (/\bremo\b|row(ing|er)/.test(t)) return 'remo';
  if (/eliptica/.test(t)) return 'eliptica';
  if (/natacion|piscina|nadar/.test(t)) return 'natacion';
  if (/comba|cuerda|jump rope/.test(t)) return 'cuerda';
  if (/asalto|saco|sombra|manoplas|sparring|boxeo/.test(t)) return 'boxeo';
  if (/calistenia|dominadas/.test(t)) return 'calistenia';
  if (/correr|carrera|rodaje|series de|\bkm\b/.test(t)) return 'correr';
  return 'funcional';
}

function tipoDe(texto: string): string {
  const m = texto.match(SESION_RE);
  if (m) {
    const k = plano(m[1]).trim().replace(/\s+/g, '');
    if (KINDS.has(k)) return k;
  }
  return adivinarTipo(texto);
}

/** Título de la sesión: el último encabezado o línea en negrita antes de la tabla. */
function tituloAntes(lineas: string[]): string {
  for (let i = lineas.length - 1; i >= 0; i--) {
    const l = lineas[i].trim();
    if (!l) continue;
    const h = l.match(/^#{1,4}\s+(.+)$/);
    if (h) return sinMd(h[1]).replace(/:$/, '').slice(0, 60);
    const b = l.match(/^\*\*([^*]{3,70})\*\*:?$/);
    if (b) return b[1].replace(/:$/, '').trim().slice(0, 60);
  }
  return '';
}

// ── De la tabla al protocolo ───────────────────────────────────

export interface SesionDelChat {
  protocol: Protocol;
  /** Filas de la tabla, para decir "12 tramos" antes de abrirla. */
  filas: number;
}

/**
 * La sesión que haya en una respuesta del Asesor, lista para el reproductor.
 *
 * Si hay varias tablas se usa la que más tramos saque (la sesión; las otras
 * suelen ser el calentamiento aparte o una tabla de cargas). `null` si no hay
 * ninguna tabla que se pueda cronometrar.
 */
export function sesionDelTexto(
  texto: string,
  /** Textos en el idioma del usuario: el nombre si la tabla no trae título y el del descanso. */
  txt: { nombre: string; descanso: string },
): SesionDelChat | null {
  const kind = tipoDe(texto);
  const trozos = trocearTablas(sinMarcadorSesion(texto));
  let mejor: { segs: ProtocolSegment[]; filas: number; titulo: string } | null = null;

  for (let n = 0; n < trozos.length; n++) {
    const tr = trozos[n];
    if (tr.tipo !== 'tabla') continue;
    const { cabecera, filas } = tr.tabla;
    const iT = columna(cabecera, COL_TIEMPO);
    if (iT < 0) continue;
    let iQ = columna(cabecera, COL_QUE);
    let iR = columna(cabecera, COL_TRAMO);
    const iD = columna(cabecera, COL_DETALLE);
    if (iR === iT) iR = -1;
    if (iQ === iT || iQ === iR) iQ = -1;
    // Sin columna de "qué" reconocible, la primera que no sea otra cosa.
    if (iQ < 0 && iR < 0) iQ = cabecera.findIndex((_, i) => i !== iT && i !== iD);
    // Una columna que dice lo mismo en todas las filas ("Cinta", "Cinta"…) no
    // informa: el nombre del tramo pasa a ser el del bloque. Si no, el
    // reproductor enseñaría "CINTA" en grande durante toda la sesión.
    if (iQ >= 0 && iR >= 0) {
      const distintos = new Set(filas.map((f) => plano(sinMd(f[iQ] || ''))).filter(Boolean));
      if (filas.length >= 3 && distintos.size === 1) iQ = -1;
    }

    const segs: ProtocolSegment[] = [];
    let leidas = 0;
    filas.forEach((f, fi) => {
      const tiempo = leerTiempo(f[iT] || '');
      if (!tiempo) return;
      // "Rondas 3-5" con el tiempo de UNA: son tres filas iguales en una.
      const grupo = plano(sinMd(iR >= 0 ? f[iR] || '' : '')).match(/^(rondas|asaltos|series|rounds|sets|vueltas|bloques)\s+(\d{1,2})\s*(?:-|–|a|al)\s*(\d{1,2})/);
      if (grupo && tiempo.veces === 1) {
        const n = parseInt(grupo[3], 10) - parseInt(grupo[2], 10) + 1;
        if (n > 1) tiempo.veces = Math.min(20, n);
      }
      leidas++;
      const tramo = iR >= 0 ? sinMd(f[iR] || '') : '';
      const que = iQ >= 0 ? sinMd(f[iQ] || '') : '';
      const detalle = iD >= 0 ? sinMd(f[iD] || '') : '';
      const label = (que || tramo).slice(0, 60) || undefined;
      const stage = que && tramo && plano(que) !== plano(tramo) ? tramo.slice(0, 40) : undefined;
      const values = leerValores(`${detalle} ${que}`, kind);
      const esDescanso = ES_DESCANSO.test(plano(`${tramo} ${que}`));
      // Un tramo por distancia sin tiempo estimado no cuenta en el total, y la
      // sesión diría "25 min" cuando son 45. Se estima con el ritmo que traiga
      // el detalle o, si no trae, con uno de rodaje.
      if (tiempo.meters && !tiempo.seconds) tiempo.seconds = estimarSegundos(tiempo.meters, detalle, kind);

      for (let k = 0; k < tiempo.veces; k++) {
        segs.push({
          id: localId(),
          label,
          stage: tiempo.veces > 1 ? `${stage ? `${stage} · ` : ''}${k + 1}/${tiempo.veces}` : stage,
          seconds: tiempo.seconds,
          ...(tiempo.meters ? { meters: tiempo.meters } : {}),
          ...(tiempo.reps ? { reps: tiempo.reps } : {}),
          values,
          ...(detalle ? { note: detalle.slice(0, 160) } : {}),
          ...(esDescanso ? { rest: true } : {}),
        });
        // "descanso 1 min" en el detalle → tramo de descanso propio, salvo que
        // la fila siguiente ya sea el descanso (así no sale dos veces).
        const pausa = esDescanso ? 0 : descansoEn(detalle);
        const siguiente = filas[fi + 1];
        const siguienteDescansa = siguiente && ES_DESCANSO.test(plano(`${iR >= 0 ? siguiente[iR] || '' : ''} ${iQ >= 0 ? siguiente[iQ] || '' : ''}`));
        const ultimaVuelta = k === tiempo.veces - 1;
        if (pausa > 0 && !(ultimaVuelta && siguienteDescansa)) {
          segs.push({ id: localId(), label: txt.descanso, seconds: pausa, values: {}, rest: true });
        }
      }
    });

    if (leidas >= 2 && (!mejor || segs.length > mejor.segs.length)) {
      const antes = trozos.slice(0, n).flatMap((x) => (x.tipo === 'texto' ? x.lineas : []));
      mejor = { segs, filas: leidas, titulo: tituloAntes(antes) };
    }
  }

  if (!mejor) return null;
  // Un descanso al final no es parte de la sesión.
  while (mejor.segs.length > 1 && mejor.segs[mejor.segs.length - 1].rest && mejor.segs[mejor.segs.length - 1].label === txt.descanso) {
    mejor.segs.pop();
  }

  return {
    protocol: {
      id: localId('prot'),
      name: mejor.titulo || txt.nombre,
      kind,
      segments: mejor.segs,
      source: 'import',
      createdAt: new Date().toISOString(),
    },
    filas: mejor.filas,
  };
}

// ── Una sesión de boxeo, al temporizador ───────────────────────

/**
 * La misma sesión, en asaltos, para el temporizador del Ring.
 *
 * El reproductor de tramos sirve para seguir una tabla, pero para boxear lo
 * que se quiere es el temporizador de siempre: campana, aviso de fin de asalto
 * y, en cada uno, lo que toca ("jab-cross-gancho, salir por la izquierda").
 * El temporizador pide asaltos IGUALES, así que se toma la duración más
 * repetida; lo de antes de los asaltos es calentamiento y lo de después, vuelta
 * a la calma.
 *
 * `null` si no hay al menos dos asaltos: entonces no es una sesión por asaltos
 * y se queda en el reproductor.
 */
export function boxeoDesdeSesion(p: Protocol, texto: string): BoxingSession | null {
  const segs = p.segments;
  const nombre = (s: ProtocolSegment) => plano(`${s.stage || ''} ${s.label || ''}`);
  const calienta = (s: ProtocolSegment) => /calenta|movilidad|activacion|comba|warm/.test(nombre(s));
  const calma = (s: ProtocolSegment) => /calma|estira|enfria|cool|vuelta/.test(nombre(s));
  let a = 0;
  while (a < segs.length && calienta(segs[a])) a++;
  let b = segs.length;
  while (b > a && calma(segs[b - 1])) b--;
  const centro = segs.slice(a, b);
  const asaltos = centro.filter((s) => !s.rest && (s.seconds || 0) > 0);
  const descansos = centro.filter((s) => s.rest && (s.seconds || 0) > 0);
  if (asaltos.length < 2) return null;

  const moda = (xs: number[]) => {
    const n = new Map<number, number>();
    xs.forEach((x) => n.set(x, (n.get(x) || 0) + 1));
    return [...n.entries()].sort((x, y) => y[1] - x[1])[0][0];
  };
  const entre = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));
  const minutos = (xs: ProtocolSegment[]) => Math.round(xs.reduce((s, x) => s + (x.seconds || 0), 0) / 60);

  const t = plano(texto);
  const place: BoxingPlace = /manoplas|sparring|gimnasio|\bgym\b/.test(t) ? 'gym'
    : /\bsaco\b/.test(t) && !/sin saco/.test(t) ? 'home_bag' : 'home';

  const rondas = asaltos.slice(0, 20);
  return {
    ...emptyBoxingSession(p.name),
    place,
    rounds: rondas.length,
    roundSec: entre(moda(rondas.map((s) => s.seconds)), 30, 600),
    restSec: descansos.length ? entre(moda(descansos.map((s) => s.seconds)), 0, 300) : 60,
    warmupMin: minutos(segs.slice(0, a)),
    cooldownMin: minutos(segs.slice(b)),
    script: rondas.map((s, i) => ({
      round: i + 1,
      title: (s.label || `${i + 1}`).slice(0, 60),
      work: (s.note || '').slice(0, 300),
    })),
    source: 'advisor',
  };
}
