// Marca de "acceso interno" mientras RANKD no está lanzada.
// Ver src/components/feature/PublicGate.tsx y ACCESO_DEMO.md.

const PREVIEW_KEY = 'rk_preview_ok';

/** Marca este navegador como "acceso interno". Idempotente. */
export function unlockPreview(): void {
  try { localStorage.setItem(PREVIEW_KEY, '1'); } catch { /* almacenamiento deshabilitado */ }
}

export function isPreviewUnlocked(): boolean {
  try { return localStorage.getItem(PREVIEW_KEY) === '1'; } catch { return false; }
}
