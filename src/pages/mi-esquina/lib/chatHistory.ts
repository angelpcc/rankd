// ════════════════════════════════════════════════════════════════
// RANKD · Mi Esquina · Que la conversación siga ahí al volver
//
// ── EL PROBLEMA ──
//
// Los dos chats del Asesor —Consulta y Plan— vivían solo en memoria. Salías un
// momento a mirar la Agenda, volvías, y la conversación había desaparecido.
// Con el Plan es todavía peor: te has pasado cinco turnos afinando el plan y al
// volver hay que empezar de cero, y cada turno cuesta dinero de verdad.
//
// ── POR QUÉ localStorage Y NO UNA TABLA ──
//
// Es estado de una conversación a medias, no un dato que se consulte, se
// comparta ni se necesite en otro dispositivo. Igual que el borrador de fuerza
// (lib/strengthDraft.ts), que resuelve lo mismo con el mismo criterio. Y así
// funciona sin red y sin pedir otra migración.
//
// ── POR QUÉ CADUCA ──
//
// Una conversación de hace una semana ya no es "lo que estaba haciendo": es
// ruido que confunde al abrir. Se guarda un día. Lo que de verdad importa —el
// plan— no vive aquí: vive en la Agenda en cuanto le das a guardar.
// ════════════════════════════════════════════════════════════════

const PREFIX = 'rankd_chat';
const VERSION = 1;
/** Un día. Pasado eso, lo que había ya no es la conversación en curso. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
/**
 * Tope de turnos guardados.
 *
 * No es por espacio: es que `localStorage` tiene unos pocos MB por dominio y un
 * plan entero en JSON ocupa bastante. Guardar los últimos 30 turnos cubre
 * cualquier conversación real y deja sitio al resto de la app.
 */
const MAX_TURNS = 30;

export interface StoredTurn {
  role: 'user' | 'assistant';
  content: string;
  /** Cualquier cosa que el chat quiera recordar con ese turno (un plan). */
  data?: unknown;
}

interface Guardado {
  v: number;
  at: number;
  turns: StoredTurn[];
}

const clave = (profileId: string, chat: string): string => `${PREFIX}_${chat}_${profileId}`;

/** Lee la conversación guardada. Devuelve [] si no hay, caducó o está rota. */
export function loadChat(profileId: string, chat: string): StoredTurn[] {
  try {
    const raw = localStorage.getItem(clave(profileId, chat));
    if (!raw) return [];
    const g = JSON.parse(raw) as Guardado;
    if (g.v !== VERSION || !Array.isArray(g.turns)) return [];
    if (Date.now() - g.at > MAX_AGE_MS) {
      localStorage.removeItem(clave(profileId, chat));
      return [];
    }
    return g.turns;
  } catch {
    // Almacenamiento bloqueado, lleno o con basura: se sigue sin historial.
    return [];
  }
}

export function saveChat(profileId: string, chat: string, turns: StoredTurn[]): void {
  try {
    if (turns.length === 0) { localStorage.removeItem(clave(profileId, chat)); return; }
    const g: Guardado = { v: VERSION, at: Date.now(), turns: turns.slice(-MAX_TURNS) };
    localStorage.setItem(clave(profileId, chat), JSON.stringify(g));
  } catch {
    // Si no cabe, se prueba con la mitad antes que rendirse: perder los turnos
    // viejos es mucho mejor que perder los últimos, que son los que importan.
    try {
      const g: Guardado = { v: VERSION, at: Date.now(), turns: turns.slice(-8) };
      localStorage.setItem(clave(profileId, chat), JSON.stringify(g));
    } catch { /* no se puede guardar: la conversación sigue viva en memoria */ }
  }
}

export function clearChat(profileId: string, chat: string): void {
  try { localStorage.removeItem(clave(profileId, chat)); } catch { /* da igual */ }
}
