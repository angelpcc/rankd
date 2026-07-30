// Intérprete de dictado para el registro de entrenos.
//
// Convierte lenguaje natural ("hoy hice hora y media de saco, y acabé fundido")
// en campos estructurados que PRE-RELLENAN el formulario. Nunca guarda: el
// peleador revisa y confirma. Es determinista y funciona en el navegador, sin
// depender de la clave de IA (que puede refinarlo el día que se active).

export interface ParsedTraining {
  type?: string;        // sparring | tecnica | fuerza | cardio | flexibilidad | recuperacion
  durationMin?: number; // minutos
  intensity?: number;   // 1..5
  feeling?: number;     // 1..5 (cómo acabó)
  part?: string;        // morning | afternoon | evening
  notes: string;        // el dictado completo, para no perder nada
}

// Palabras → tipo de sesión (raíces, sin acentos).
const TYPE_WORDS: { type: string; words: string[] }[] = [
  { type: 'sparring', words: ['sparring', 'spar', 'guanteo'] },
  { type: 'tecnica', words: ['tecnica', 'saco', 'manopla', 'sombra', 'pao', 'mitts', 'bag', 'shadow', 'technique', 'pads'] },
  { type: 'fuerza', words: ['fuerza', 'pesas', 'gimnasio', 'gym', 'strength', 'weights', 'lifting'] },
  { type: 'cardio', words: ['cardio', 'correr', 'carrera', 'run', 'running', 'bici', 'bike', 'comba', 'cuerda', 'rope', 'hiit', 'natacion', 'swim'] },
  { type: 'flexibilidad', words: ['movilidad', 'estiramiento', 'estirar', 'yoga', 'mobility', 'stretch', 'flexibilidad'] },
  { type: 'recuperacion', words: ['recuperacion', 'descanso', 'masaje', 'recovery', 'rest', 'massage', 'fisio'] },
];

// Cómo acabó (feeling bajo) / a tope de esfuerzo (intensity alto).
const FEEL_LOW = ['fundido', 'reventado', 'muerto', 'agotado', 'destrozado', 'sin fuerzas', 'exhausted', 'wrecked', 'dead', 'shattered', 'drained'];
const FEEL_GOOD = ['genial', 'estupendo', 'fenomenal', 'de lujo', 'como nuevo', 'con fuerza', 'fresco', 'great', 'awesome', 'strong', 'fresh', 'amazing'];
const INT_HIGH = ['al limite', 'a tope', 'muy intenso', 'muy duro', 'durisimo', 'brutal', 'max', 'all out', 'very hard', 'very intense'];
const INT_HARD = ['intenso', 'duro', 'fuerte', 'exigente', 'hard', 'intense', 'tough'];
const INT_SOFT = ['suave', 'flojo', 'tranquilo', 'ligero', 'easy', 'light', 'gentle', 'chill'];

const PART_WORDS: { part: string; words: string[] }[] = [
  { part: 'morning', words: ['manana', 'temprano', 'morning'] },
  { part: 'afternoon', words: ['tarde', 'mediodia', 'afternoon', 'noon'] },
  { part: 'evening', words: ['noche', 'evening', 'night', 'tonight'] },
];

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function has(hay: string, words: string[]): boolean {
  return words.some((w) => hay.includes(w));
}

// "hora y media" = 90, "media hora" = 30, "hora y cuarto" = 75, "dos horas" = 120…
const NUM_WORDS: Record<string, number> = {
  media: 0.5, medio: 0.5, un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4,
  half: 0.5, an: 1, a: 1, one: 1, two: 2, three: 3, four: 4,
};

function parseDuration(raw: string): number | undefined {
  const s = norm(raw);
  // Frases hechas (con o sin artículo): "hora y media", "hora y cuarto".
  if (/hora\s+y\s+media|hour\s+and\s+a\s+half/.test(s)) return 90;
  if (/hora\s+y\s+cuarto|hour\s+and\s+a\s+quarter/.test(s)) return 75;
  if (/media\s+hora|half\s+an?\s+hour/.test(s)) return 30;
  // Horas explícitas con minutos: "1 h 30", "1h30"
  let m = s.match(/(\d+)\s*(?:h|hora|horas|hour|hours)\s*(?:y\s*)?(\d+)\s*(?:m|min|minuto|minutos|minute|minutes)/);
  if (m) { const h = parseInt(m[1], 10); const min = parseInt(m[2], 10); if (!Number.isNaN(h)) return h * 60 + min; }
  // Número en palabra + horas (+ fracción): "una hora", "dos horas", "una hora y media"
  m = s.match(/(un|una|uno|dos|tres|cuatro|one|two|three|four|a|an)\s+(?:hora|horas|hour|hours)(?:\s+y\s+(media|cuarto)|\s+and\s+a\s+(half|quarter))?/);
  if (m) {
    let h = NUM_WORDS[m[1]] ?? 1;
    const frac = m[2] || m[3];
    if (frac === 'media' || frac === 'half') h += 0.5;
    if (frac === 'cuarto' || frac === 'quarter') h += 0.25;
    return Math.round(h * 60);
  }
  // Minutos sueltos: "90 minutos", "45 min"
  m = s.match(/(\d+)\s*(?:m|min|minuto|minutos|minute|minutes)\b/);
  if (m) { const n = parseInt(m[1], 10); if (!Number.isNaN(n)) return n; }
  // Horas sueltas numéricas: "2 horas", "1h"
  m = s.match(/(\d+)\s*(?:h|hora|horas|hour|hours)\b/);
  if (m) { const n = parseInt(m[1], 10); if (!Number.isNaN(n)) return n * 60; }
  // "una hora" sin número explícito ya cubierto; "hora" a secas = 60.
  if (/\bhora\b|\bhour\b/.test(s)) return 60;
  return undefined;
}

export function parseTrainingFromSpeech(text: string): ParsedTraining {
  const s = norm(text);
  const out: ParsedTraining = { notes: text.trim() };

  for (const { type, words } of TYPE_WORDS) { if (has(s, words)) { out.type = type; break; } }
  for (const { part, words } of PART_WORDS) { if (has(s, words)) { out.part = part; break; } }

  const dur = parseDuration(text);
  if (dur && dur >= 5 && dur <= 600) out.durationMin = dur;

  if (has(s, INT_HIGH)) out.intensity = 5;
  else if (has(s, INT_HARD)) out.intensity = 4;
  else if (has(s, INT_SOFT)) out.intensity = 2;

  if (has(s, FEEL_LOW)) { out.feeling = 2; if (out.intensity === undefined) out.intensity = 5; }
  else if (has(s, FEEL_GOOD)) out.feeling = 5;

  return out;
}
