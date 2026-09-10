// ════════════════════════════════════════════════════════════════
// RANKD · Mi Esquina · ¿Qué me acabas de pegar?
//
// ── POR QUÉ EXISTE ──
//
// Importar un plan estaba repartido en tres sitios: las rutinas se metían en
// Fuerza, los protocolos de cardio en Actividad y el plan de la semana en el
// Asesor. Para meter un documento había que saber ANTES de qué era y entrar por
// la puerta correcta — y si el documento traía fuerza y cardio a la vez, no
// había puerta buena.
//
// Ahora la puerta es una: Planificar. Pegas lo que sea y esto decide qué es.
//
// ── CÓMO DECIDE ──
//
// Cuenta señales, no adivina con una regla suelta. Cada tipo tiene sus pistas
// y gana el que más suma, con una condición: si el segundo va muy cerca, no
// se decide — se PREGUNTA. Equivocarse en silencio es peor que preguntar, y
// aquí equivocarse significa meter una tabla de cinta en el historial de
// fuerza.
//
// Es un detector de texto, sin IA, y eso es a propósito: la IA mejora el
// resultado del import, pero decidir a qué pantalla va el documento no puede
// depender de que haya clave configurada ni de que la red responda.
// ════════════════════════════════════════════════════════════════

import { MUSCLE_GROUPS, muscleGroupOf } from './exercises';
import { ACTIVITY_KINDS } from './dayPlan';

export type PlanKind = 'routine' | 'protocol' | 'week' | 'meals';

export interface PlanGuess {
  /** El tipo que más señales acumula. */
  kind: PlanKind;
  /**
   * true si la decisión está clara. false si hay empate o hay tan poca señal
   * que sería adivinar: en ese caso la pantalla pregunta en vez de actuar.
   */
  confident: boolean;
  /** Puntuación de cada tipo, para poder enseñar por qué se ha decidido así. */
  scores: Record<PlanKind, number>;
  /** Pistas concretas encontradas ("6 nombres de ejercicio", "3 días"). */
  signals: string[];
  /** Tipo de actividad detectado, si lo hay. Ahorra un paso al importar cardio. */
  activityKind?: string;
}

const norm = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const DIAS = [
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

const COMIDAS = [
  'desayuno', 'almuerzo', 'comida', 'cena', 'merienda', 'snack', 'tentempie',
  'breakfast', 'lunch', 'dinner',
  'proteina', 'hidratos', 'carbohidratos', 'grasas', 'kcal', 'caloria', 'gramos',
  'arroz', 'pollo', 'avena', 'huevo', 'atun', 'batido',
];

/** Palabras que solo aparecen en un guion de cardio por tramos. */
const CARDIO = [
  'inclinacion', 'incline', 'velocidad', 'speed', 'km/h', 'ritmo', 'pace',
  'calentamiento', 'warm up', 'warmup', 'enfriamiento', 'cooldown', 'cool down',
  'serie', 'sprint', 'intervalo', 'interval', 'recuperacion', 'trote',
  'pulsaciones', 'ppm', 'bpm', 'zona 2', 'z2',
];

/** Palabras propias de una rutina de pesas. */
const FUERZA = [
  'serie', 'series', 'repeticion', 'repeticiones', 'reps', 'rep',
  'push', 'pull', 'pierna', 'torso', 'empuje', 'traccion', 'fullbody', 'full body',
  'rm', 'rir', 'descanso', 'superserie', 'dropset', 'al fallo',
];

function contar(txt: string, palabras: string[]): number {
  let n = 0;
  for (const p of palabras) if (txt.includes(p)) n++;
  return n;
}

/**
 * Mira un texto y dice de qué es.
 *
 * `text` es lo que el usuario ha pegado, dictado o escrito. No se le pide
 * ningún formato: la gracia es justamente que valga tal cual venga.
 */
export function detectPlanKind(text: string): PlanGuess {
  const txt = norm(text);
  const lineas = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const signals: string[] = [];
  const scores: Record<PlanKind, number> = { routine: 0, protocol: 0, week: 0, meals: 0 };

  // ── Días de la semana ── varios días = plan de semana, no una sola sesión.
  const diasVistos = DIAS.filter((d) => txt.includes(d));
  if (diasVistos.length >= 2) {
    scores.week += diasVistos.length * 2;
    signals.push(`${diasVistos.length} días de la semana`);
  } else if (diasVistos.length === 1) {
    scores.week += 1;
  }

  // ── Nombres de ejercicio que la biblioteca reconoce ──
  // Es la señal más fiable de que es fuerza: "press banca" no aparece en una
  // tabla de cinta ni en una pauta de comidas.
  let ejercicios = 0;
  for (const l of lineas) {
    // Se prueba la línea entera y su primer trozo antes de un separador, que es
    // donde suele estar el nombre ("Press banca — 4x8").
    const cabeza = l.split(/[-–—:|,(]/)[0].trim();
    if (muscleGroupOf(l) || (cabeza.length > 2 && muscleGroupOf(cabeza))) ejercicios++;
  }
  if (ejercicios > 0) {
    scores.routine += ejercicios * 3;
    signals.push(`${ejercicios} ${ejercicios === 1 ? 'ejercicio reconocido' : 'ejercicios reconocidos'}`);
  }

  // ── Grupos musculares nombrados ──
  const grupos = MUSCLE_GROUPS.filter((g) => txt.includes(norm(g)));
  if (grupos.length > 0) scores.routine += grupos.length;

  // ── Series y repeticiones: "4x8", "3 x 10" ──
  const seriesXreps = (text.match(/\b\d{1,2}\s*[x×]\s*\d{1,3}\b/gi) || []).length;
  if (seriesXreps > 0) {
    scores.routine += seriesXreps * 2;
    signals.push(`${seriesXreps} veces "series × repeticiones"`);
  }

  // ── Tramos de tiempo: "0-5 min", "5 a 10 minutos" ──
  // Es LA firma de un protocolo de cardio: una tabla por minutos.
  const tramos = (text.match(/\b\d{1,3}\s*(?:-|–|a|to)\s*\d{1,3}\s*(?:min|'|minutos?)\b/gi) || []).length;
  if (tramos > 0) {
    scores.protocol += tramos * 4;
    signals.push(`${tramos} ${tramos === 1 ? 'tramo por minutos' : 'tramos por minutos'}`);
  }

  const cardio = contar(txt, CARDIO);
  scores.protocol += cardio * 2;
  const fuerza = contar(txt, FUERZA);
  scores.routine += fuerza;
  const comidas = contar(txt, COMIDAS);
  scores.meals += comidas * 2;
  if (comidas >= 2) signals.push(`${comidas} términos de nutrición`);

  // ── Tipo de actividad nombrado ──
  let activityKind: string | undefined;
  for (const a of ACTIVITY_KINDS) {
    if (a.value === 'otro') continue;
    if (txt.includes(norm(a.value))) { activityKind = a.value; scores.protocol += 3; break; }
  }
  if (txt.includes('cinta') || txt.includes('treadmill')) { activityKind = activityKind || 'cinta'; scores.protocol += 3; }
  if (activityKind) signals.push(`actividad: ${activityKind}`);

  // ── Decisión ──
  const orden = (Object.keys(scores) as PlanKind[]).sort((a, b) => scores[b] - scores[a]);
  const [primero, segundo] = orden;
  const mejor = scores[primero];

  // Un plan de semana con fuerza dentro puntúa en los dos. Manda "week" cuando
  // hay varios días: repartirlo por días es lo que el usuario espera, y desde
  // ahí cada día acaba en su sección igualmente.
  if (diasVistos.length >= 3 && scores.week >= 4) {
    return { kind: 'week', confident: true, scores, signals, activityKind };
  }

  // Sin señal suficiente, o con el segundo pisándole los talones, se pregunta.
  const confident = mejor >= 4 && mejor >= scores[segundo] * 1.5;

  return { kind: primero, confident, scores, signals, activityKind };
}

/** Etiqueta i18n de cada tipo, para pintar la decisión y dejar cambiarla. */
export const PLAN_KIND_LABEL: Record<PlanKind, string> = {
  routine: 'mc_imp_kind_routine',
  protocol: 'mc_imp_kind_protocol',
  week: 'mc_imp_kind_week',
  meals: 'mc_imp_kind_meals',
};

export const PLAN_KIND_ICON: Record<PlanKind, string> = {
  routine: 'ri-boxing-line',
  protocol: 'ri-timer-line',
  week: 'ri-calendar-todo-line',
  meals: 'ri-restaurant-line',
};
