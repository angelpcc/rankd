// Cliente del sistema de correo de RANKD.
// Todo pasa por /api/email (función serverless): la clave de Resend nunca
// llega al navegador. Si el servicio no está configurado, estas funciones
// devuelven { skipped: true } en lugar de lanzar: nada se rompe.

export interface EmailStatus {
  configured: boolean;
  canBroadcast: boolean;
  missing: string[];
  from: string | null;
}

export interface SendResult {
  ok: boolean;
  skipped?: boolean;
  sent?: number;
  total?: number;
  message?: string;
  error?: string;
}

/** Sonda de disponibilidad. No envía nada ni consume cuota. */
export async function getEmailStatus(): Promise<EmailStatus> {
  try {
    const res = await fetch('/api/email');
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return { configured: false, canBroadcast: false, missing: ['RESEND_API_KEY'], from: null };
  }
}

/**
 * Correo de bienvenida tras el registro.
 * Deliberadamente silencioso: si falla, el usuario ya está dentro y no
 * tiene por qué enterarse de un problema de correo.
 */
export async function sendWelcomeEmail(to: string, name: string, userType: string): Promise<void> {
  try {
    await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'welcome', to, name, userType }),
    });
  } catch {
    // Sin ruido: el registro es lo importante.
  }
}

/** Envío masivo desde el panel de administración. Requiere sesión de admin. */
export async function sendBroadcast(opts: {
  accessToken: string;
  subject: string;
  message: string;
  audience: string;
  test?: boolean;
}): Promise<SendResult> {
  try {
    const res = await fetch('/api/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.accessToken}`,
      },
      body: JSON.stringify({
        type: 'broadcast',
        subject: opts.subject,
        message: opts.message,
        audience: opts.audience,
        test: opts.test,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || 'No se pudo enviar el comunicado' };
    if (data.skipped) return { ok: false, skipped: true, message: data.message };
    return { ok: true, sent: data.sent ?? 0, total: data.total };
  } catch {
    return { ok: false, error: 'No se pudo contactar con el servicio de correo' };
  }
}
