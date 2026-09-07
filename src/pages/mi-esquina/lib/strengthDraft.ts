// Borrador local de una sesión de fuerza a medias.
//
// Por qué localStorage y no Supabase: un entreno se registra CON el móvil en la
// mano entre series, a menudo sin cobertura en el sótano del gimnasio. El
// borrador tiene que sobrevivir a que se cierre la app o se recargue la página
// sin depender de la red. No es un dato compartido ni consultable: es estado de
// un formulario a medias, así que no merece tabla ni migración.
//
// Se limpia SOLO cuando la sesión se guarda de verdad en `strength_sets`
// (lo hace StrengthLog tras el insert correcto), nunca al cerrar el formulario.

const PREFIX = 'rankd_strength_draft';
const VERSION = 1;
/** Un borrador de hace más de 2 días ya no es "el entreno que dejaste a medias". */
const MAX_AGE_MS = 48 * 60 * 60 * 1000;

export interface DraftSet { reps: string; weight: string }
export interface DraftExercise { label: string; sets: DraftSet[]; note?: string }
export interface DraftBlock { group: string; exercises: DraftExercise[] }

export interface StrengthDraft {
  v: number;
  savedAt: number;
  date: string;
  slot: 'morning' | 'afternoon' | 'evening' | null;
  blocks: DraftBlock[];
}

function keyFor(profileId: string): string {
  return `${PREFIX}:${profileId}`;
}

/** ¿Tiene el borrador algo que merezca la pena recuperar? */
export function draftHasContent(d: Pick<StrengthDraft, 'blocks'>): boolean {
  return d.blocks.some((b) => b.exercises.some((e) => e.label.trim() !== ''));
}

export function saveDraft(profileId: string, draft: Omit<StrengthDraft, 'v' | 'savedAt'>): boolean {
  if (!profileId) return false;
  if (!draftHasContent(draft)) { clearDraft(profileId); return false; }
  try {
    const payload: StrengthDraft = { ...draft, v: VERSION, savedAt: Date.now() };
    localStorage.setItem(keyFor(profileId), JSON.stringify(payload));
    return true;
  } catch {
    // Cuota llena o modo privado: el formulario sigue funcionando sin borrador.
    return false;
  }
}

export function loadDraft(profileId: string): StrengthDraft | null {
  if (!profileId) return null;
  let raw: string | null = null;
  try { raw = localStorage.getItem(keyFor(profileId)); } catch { return null; }
  if (!raw) return null;

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { clearDraft(profileId); return null; }

  const d = parsed as Partial<StrengthDraft>;
  // Versión distinta = formato que ya no sabemos leer; se descarta en silencio
  // en vez de intentar migrarlo y arriesgar un formulario corrupto.
  if (!d || d.v !== VERSION || typeof d.savedAt !== 'number' || !Array.isArray(d.blocks)) {
    clearDraft(profileId);
    return null;
  }
  if (Date.now() - d.savedAt > MAX_AGE_MS) { clearDraft(profileId); return null; }
  if (!draftHasContent({ blocks: d.blocks })) { clearDraft(profileId); return null; }

  return {
    v: VERSION,
    savedAt: d.savedAt,
    date: typeof d.date === 'string' ? d.date : '',
    slot: d.slot ?? null,
    blocks: d.blocks,
  };
}

export function clearDraft(profileId: string): void {
  if (!profileId) return;
  try { localStorage.removeItem(keyFor(profileId)); } catch { /* nada que hacer */ }
}
