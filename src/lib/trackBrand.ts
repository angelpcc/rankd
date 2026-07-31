import { supabase } from '@/lib/supabase';

// Telemetría del escaparate de marca (R13-T4). Registra eventos anónimos para
// que la marca vea su embudo en el panel. Falla en silencio: si la tabla aún no
// existe (migración 0024 pendiente) o la red falla, no molesta al visitante.

type BrandEventKind = 'view' | 'website_click' | 'product_click';

// El id del usuario actual, cacheado, para no contar a la propia marca viendo
// su escaparate. Se resuelve una vez por carga de página.
let ownUidPromise: Promise<string | null> | null = null;
function ownUid(): Promise<string | null> {
  if (!ownUidPromise) {
    ownUidPromise = supabase.auth.getUser().then(({ data }) => data.user?.id ?? null).catch(() => null);
  }
  return ownUidPromise;
}

async function logEvent(orgId: string, kind: BrandEventKind, productId?: string) {
  if (!orgId) return;
  try {
    const uid = await ownUid();
    if (uid && uid === orgId) return; // la marca no se cuenta a sí misma
    await supabase.from('brand_events').insert({
      org_profile_id: orgId,
      kind,
      product_id: productId ?? null,
    });
  } catch { /* silencioso */ }
}

// Vista del escaparate: una sola vez por marca y por sesión, para no inflar
// la cifra cada vez que el visitante hace scroll arriba y abajo.
const VIEW_KEY = 'rankd_brand_viewed';
function alreadyViewed(orgId: string): boolean {
  try {
    const raw = sessionStorage.getItem(VIEW_KEY);
    const set: string[] = raw ? JSON.parse(raw) : [];
    if (set.includes(orgId)) return true;
    set.push(orgId);
    sessionStorage.setItem(VIEW_KEY, JSON.stringify(set));
    return false;
  } catch {
    return false;
  }
}

export function trackBrandView(orgId: string) {
  if (!orgId || alreadyViewed(orgId)) return;
  void logEvent(orgId, 'view');
}

export function trackBrandWebsiteClick(orgId: string) {
  void logEvent(orgId, 'website_click');
}

export function trackBrandProductClick(orgId: string, productId: string) {
  void logEvent(orgId, 'product_click', productId);
}
