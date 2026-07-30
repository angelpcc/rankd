// Biblioteca de combinaciones de deportes de combate.
//
// Cada golpe es un TOKEN (jab, cross, low_kick...) que se traduce en pantalla
// vía i18n (clave tm_move_<token>), de modo que toda combinación queda escrita
// en español o inglés con la notación real de gimnasio sin duplicar datos.
// Un combo = lista de tokens + etiquetas (disciplina, nivel, enfoque).
//
// Se asume guardia orthodox (zurda adelantada) para nombrar izquierda/derecha,
// que es la convención estándar al escribir combinaciones.

import type { Discipline, Level, Focus, RoundCombo } from './session';

export interface Combo {
  id: string;
  discipline: Discipline;
  level: Level;
  focus: Focus[];
  moves: string[];
}

// Golpes agrupados para el creador de combinaciones propias.
export const MOVE_GROUPS: { key: string; tokens: string[] }[] = [
  { key: 'hands', tokens: ['jab', 'cross', 'lead_hook', 'rear_hook', 'lead_uppercut', 'rear_uppercut', 'overhand', 'body_jab', 'lead_body_hook', 'rear_body_cross'] },
  { key: 'defense', tokens: ['slip', 'roll', 'parry', 'block', 'pull', 'catch', 'shoulder_roll', 'sprawl'] },
  { key: 'movement', tokens: ['pivot', 'step_out', 'lateral_left', 'lateral_right', 'feint', 'level_change', 'angle_off', 'clinch'] },
  { key: 'kicks', tokens: ['teep', 'low_kick', 'body_kick', 'high_kick', 'switch_kick', 'knee', 'clinch_knee', 'elbow'] },
  { key: 'grappling', tokens: ['takedown', 'double_leg'] },
];

export const ALL_MOVES: string[] = MOVE_GROUPS.flatMap((g) => g.tokens);

export const DISCIPLINES: Discipline[] = ['boxing', 'kickboxing', 'muay_thai', 'mma'];
export const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];
export const FOCUSES: Focus[] = ['attack', 'counter', 'defense', 'body', 'footwork', 'exits'];

const C = (id: string, discipline: Discipline, level: Level, focus: Focus[], moves: string[]): Combo =>
  ({ id, discipline, level, focus, moves });

export const COMBOS: Combo[] = [
  // ── BOXEO ──
  C('bx01', 'boxing', 'beginner', ['attack'], ['jab', 'cross']),
  C('bx02', 'boxing', 'beginner', ['attack'], ['jab', 'jab', 'cross']),
  C('bx03', 'boxing', 'beginner', ['attack'], ['jab', 'cross', 'lead_hook']),
  C('bx04', 'boxing', 'beginner', ['attack'], ['cross', 'lead_hook']),
  C('bx05', 'boxing', 'beginner', ['attack', 'body'], ['jab', 'cross', 'lead_body_hook']),
  C('bx06', 'boxing', 'beginner', ['body'], ['body_jab', 'cross']),
  C('bx07', 'boxing', 'beginner', ['defense', 'counter'], ['slip', 'cross']),
  C('bx08', 'boxing', 'beginner', ['defense', 'counter'], ['parry', 'jab']),
  C('bx09', 'boxing', 'beginner', ['footwork'], ['jab', 'lateral_right']),
  C('bx10', 'boxing', 'beginner', ['footwork', 'exits'], ['jab', 'cross', 'pivot']),
  C('bx11', 'boxing', 'intermediate', ['attack'], ['jab', 'cross', 'lead_hook', 'rear_hook']),
  C('bx12', 'boxing', 'intermediate', ['attack'], ['jab', 'cross', 'lead_uppercut', 'rear_hook']),
  C('bx13', 'boxing', 'intermediate', ['attack'], ['lead_hook', 'cross', 'lead_hook']),
  C('bx14', 'boxing', 'intermediate', ['attack'], ['jab', 'rear_uppercut', 'lead_hook']),
  C('bx15', 'boxing', 'intermediate', ['attack', 'body'], ['jab', 'cross', 'lead_body_hook', 'lead_hook']),
  C('bx16', 'boxing', 'intermediate', ['body', 'attack'], ['rear_body_cross', 'lead_hook', 'cross']),
  C('bx17', 'boxing', 'intermediate', ['defense', 'counter'], ['roll', 'lead_hook', 'cross']),
  C('bx18', 'boxing', 'intermediate', ['counter'], ['slip', 'rear_uppercut', 'lead_hook']),
  C('bx19', 'boxing', 'intermediate', ['counter', 'defense'], ['catch', 'cross', 'lead_hook']),
  C('bx20', 'boxing', 'intermediate', ['defense', 'counter'], ['pull', 'cross']),
  C('bx21', 'boxing', 'intermediate', ['attack', 'exits'], ['jab', 'cross', 'step_out']),
  C('bx22', 'boxing', 'intermediate', ['footwork'], ['jab', 'pivot', 'cross']),
  C('bx23', 'boxing', 'intermediate', ['footwork', 'attack'], ['feint', 'cross', 'lateral_left']),
  C('bx24', 'boxing', 'advanced', ['attack'], ['jab', 'cross', 'lead_hook', 'rear_uppercut', 'lead_hook']),
  C('bx25', 'boxing', 'advanced', ['attack'], ['overhand', 'lead_hook', 'rear_body_cross']),
  C('bx26', 'boxing', 'advanced', ['attack', 'body'], ['jab', 'cross', 'lead_hook', 'cross', 'lead_body_hook']),
  C('bx27', 'boxing', 'advanced', ['defense', 'counter'], ['shoulder_roll', 'overhand', 'lead_hook']),
  C('bx28', 'boxing', 'advanced', ['counter', 'exits'], ['slip', 'cross', 'lead_hook', 'pivot']),
  C('bx29', 'boxing', 'advanced', ['attack', 'defense'], ['jab', 'jab', 'cross', 'roll', 'lead_hook', 'cross']),

  // ── KICKBOXING ──
  C('kb01', 'kickboxing', 'beginner', ['attack'], ['jab', 'cross', 'low_kick']),
  C('kb02', 'kickboxing', 'beginner', ['attack'], ['jab', 'low_kick']),
  C('kb03', 'kickboxing', 'beginner', ['attack'], ['teep', 'cross']),
  C('kb04', 'kickboxing', 'beginner', ['defense', 'counter'], ['block', 'low_kick']),
  C('kb05', 'kickboxing', 'intermediate', ['attack'], ['jab', 'cross', 'lead_hook', 'low_kick']),
  C('kb06', 'kickboxing', 'intermediate', ['attack', 'body'], ['jab', 'cross', 'body_kick']),
  C('kb07', 'kickboxing', 'intermediate', ['attack'], ['low_kick', 'cross', 'lead_hook']),
  C('kb08', 'kickboxing', 'intermediate', ['counter'], ['catch', 'cross', 'low_kick']),
  C('kb09', 'kickboxing', 'intermediate', ['attack'], ['switch_kick', 'cross']),
  C('kb10', 'kickboxing', 'advanced', ['attack'], ['jab', 'cross', 'lead_hook', 'high_kick']),
  C('kb11', 'kickboxing', 'advanced', ['attack'], ['low_kick', 'low_kick', 'cross', 'high_kick']),
  C('kb12', 'kickboxing', 'advanced', ['counter', 'body'], ['parry', 'cross', 'body_kick']),

  // ── MUAY THAI ──
  C('mt01', 'muay_thai', 'beginner', ['attack'], ['teep', 'cross']),
  C('mt02', 'muay_thai', 'beginner', ['attack'], ['jab', 'cross', 'low_kick']),
  C('mt03', 'muay_thai', 'beginner', ['attack', 'body'], ['jab', 'body_kick']),
  C('mt04', 'muay_thai', 'beginner', ['defense', 'counter'], ['block', 'body_kick']),
  C('mt05', 'muay_thai', 'intermediate', ['attack'], ['jab', 'cross', 'body_kick', 'low_kick']),
  C('mt06', 'muay_thai', 'intermediate', ['attack'], ['cross', 'lead_hook', 'knee']),
  C('mt07', 'muay_thai', 'intermediate', ['attack'], ['clinch', 'knee', 'knee']),
  C('mt08', 'muay_thai', 'intermediate', ['attack', 'body'], ['teep', 'body_kick']),
  C('mt09', 'muay_thai', 'intermediate', ['attack'], ['jab', 'cross', 'elbow']),
  C('mt10', 'muay_thai', 'advanced', ['attack', 'body'], ['jab', 'cross', 'lead_hook', 'body_kick', 'low_kick']),
  C('mt11', 'muay_thai', 'advanced', ['attack'], ['clinch', 'clinch_knee', 'elbow']),
  C('mt12', 'muay_thai', 'advanced', ['counter'], ['parry', 'cross', 'low_kick']),
  C('mt13', 'muay_thai', 'advanced', ['attack'], ['switch_kick', 'cross', 'elbow']),

  // ── MMA ──
  C('mm01', 'mma', 'beginner', ['attack'], ['jab', 'cross', 'level_change', 'double_leg']),
  C('mm02', 'mma', 'beginner', ['attack'], ['jab', 'low_kick']),
  C('mm03', 'mma', 'beginner', ['defense', 'counter'], ['sprawl', 'cross']),
  C('mm04', 'mma', 'intermediate', ['attack'], ['jab', 'cross', 'low_kick', 'level_change', 'takedown']),
  C('mm05', 'mma', 'intermediate', ['attack', 'footwork'], ['feint', 'double_leg']),
  C('mm06', 'mma', 'intermediate', ['attack'], ['jab', 'cross', 'clinch', 'knee']),
  C('mm07', 'mma', 'intermediate', ['counter', 'defense'], ['sprawl', 'cross', 'lead_hook']),
  C('mm08', 'mma', 'intermediate', ['attack'], ['teep', 'cross', 'low_kick']),
  C('mm09', 'mma', 'advanced', ['attack', 'body'], ['jab', 'cross', 'lead_hook', 'body_kick', 'level_change', 'takedown']),
  C('mm10', 'mma', 'advanced', ['attack'], ['overhand', 'lead_hook', 'clinch', 'knee']),
  C('mm11', 'mma', 'advanced', ['counter', 'attack'], ['slip', 'cross', 'level_change', 'double_leg']),
  C('mm12', 'mma', 'advanced', ['footwork', 'attack'], ['feint', 'angle_off', 'cross', 'low_kick']),
];

// ── Vídeos de técnica de referencia (Tarea 7) ──
// Integración AUTOMÁTICA: al colocar un archivo <token>.mp4 en
// src/assets/technique/ y volver a compilar, Vite lo detecta con este glob y
// el golpe muestra su clip. Sin archivo, no aparece nada (ni hueco ni error).
const clipModules = import.meta.glob('/src/assets/technique/*.mp4', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;

export const TECHNIQUE_VIDEOS: Record<string, string> = Object.fromEntries(
  Object.entries(clipModules).map(([path, url]) => {
    const name = path.split('/').pop()!.replace(/\.mp4$/i, '');
    return [name, url];
  }),
);

export function hasVideo(token: string): boolean {
  return !!TECHNIQUE_VIDEOS[token];
}

export function comboById(id: string): Combo | undefined {
  return COMBOS.find((c) => c.id === id);
}

// Devuelve los tokens y el texto suelto de una combinación asignada a un asalto.
// Los de biblioteca y los propios traen tokens (para renderizar con vídeos);
// los generados por IA pueden traer solo texto libre.
export function roundComboParts(rc: RoundCombo): { moves: string[]; text: string } {
  if (!rc) return { moves: [], text: '' };
  if (rc.kind === 'library') return { moves: comboById(rc.comboId)?.moves ?? [], text: '' };
  return { moves: rc.moves ?? [], text: rc.moves && rc.moves.length ? '' : rc.text };
}
