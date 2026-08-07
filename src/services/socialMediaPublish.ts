// Framework para publicar directamente en redes sociales desde Creator
// Studio. MVP: solo la forma (interfaces + stubs); post-MVP implementará cada
// proveedor real. Hasta entonces, todo devuelve `not_implemented` y el flujo
// de la app sigue siendo "descarga/copia y publica manualmente".

export type SocialProvider = 'meta' | 'tiktok' | 'youtube' | 'twitter' | 'linkedin';

export interface SocialCredentials {
  provider: SocialProvider;
  /** Token cifrado en BD; nunca en texto plano en el cliente. */
  accessTokenEncrypted: string;
  expiresAt: string | null;
}

export interface PublishResult {
  ok: boolean;
  postUrl?: string;
  error?: string;
}

export interface Metrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

const NOT_IMPLEMENTED: PublishResult = { ok: false, error: 'not_implemented' };

export async function uploadVideo(_provider: SocialProvider, _videoUrl: string, _caption: string): Promise<PublishResult> {
  return NOT_IMPLEMENTED;
}

export async function uploadPost(_provider: SocialProvider, _imageUrl: string, _copy: string): Promise<PublishResult> {
  return NOT_IMPLEMENTED;
}

export async function schedule(_provider: SocialProvider, _contentId: string, _at: string): Promise<PublishResult> {
  return NOT_IMPLEMENTED;
}

export async function getMetrics(_provider: SocialProvider, _postUrl: string): Promise<Metrics | null> {
  return null;
}
