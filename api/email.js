// ════════════════════════════════════════════════════════════════
// RANKD · Sistema de correo (Resend)
//
// Modos:
//   GET                        → sonda: dice si el servicio está configurado
//                                (NO envía nada, NO gasta cuota)
//   POST { type: 'welcome' }   → correo de bienvenida al registrarse
//   POST { type: 'broadcast' } → envío masivo desde el panel de admin
//                                (requiere sesión de administrador)
//
// La clave de Resend vive SOLO en el servidor.
// Si no hay clave configurada, nada se rompe: se responde 200 con
// { skipped: true } y el front enseña un aviso en vez de un error.
// ════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 60 };

const RESEND_API = 'https://api.resend.com';
const ADMIN_EMAILS = ['angelpc2005@gmail.com'];

// Resend acepta hasta 100 correos por llamada al endpoint de lote.
const BATCH_SIZE = 100;

const SITE_URL = process.env.SITE_URL || 'https://rankd.es';

function env() {
  return {
    resendKey: process.env.RESEND_API_KEY || '',
    from: process.env.RESEND_FROM || 'RANKD <onboarding@resend.dev>',
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  };
}

// ────────────────────────────────────────────────────────────────
// PLANTILLA DE MARCA
// Los clientes de correo no cargan fuentes externas ni entienden flex/grid,
// así que va todo en tablas y con estilos en línea. Se ve igual en Gmail,
// Outlook y Apple Mail.
// ────────────────────────────────────────────────────────────────

function escapeHtml(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Convierte el texto plano del panel en párrafos HTML respetando saltos de línea. */
function textToHtml(text = '') {
  return escapeHtml(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.65;color:#c9c9c9;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function shell({ eyebrow, title, bodyHtml, ctaText, ctaUrl, footerNote }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#050505;">
  <!-- Vista previa en la bandeja de entrada -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(eyebrow || '')} · RANKD</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#0c0c0c;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;">

        <!-- Filo rojo superior -->
        <tr><td style="height:4px;background:#E10600;line-height:4px;font-size:0;">&nbsp;</td></tr>

        <!-- Cabecera -->
        <tr><td style="padding:30px 34px 0;">
          <span style="font-family:'Arial Black',Arial,Helvetica,sans-serif;font-size:26px;font-weight:900;letter-spacing:-1px;color:#ffffff;">RAN</span><span style="font-family:'Arial Black',Arial,Helvetica,sans-serif;font-size:26px;font-weight:900;letter-spacing:-1px;color:#E10600;">KD</span>
        </td></tr>

        <!-- Cuerpo -->
        <tr><td style="padding:26px 34px 34px;">
          ${eyebrow ? `<p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;">${escapeHtml(eyebrow)}</p>` : ''}
          <h1 style="margin:0 0 20px;font-family:'Arial Black',Arial,Helvetica,sans-serif;font-size:30px;line-height:1.12;color:#ffffff;text-transform:uppercase;letter-spacing:-0.5px;">${title}</h1>
          ${bodyHtml}
          ${ctaText && ctaUrl ? `
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 6px;">
            <tr><td style="background:#E10600;border-radius:10px;">
              <a href="${ctaUrl}" style="display:inline-block;padding:15px 34px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#ffffff;text-decoration:none;">${escapeHtml(ctaText)}</a>
            </td></tr>
          </table>` : ''}
        </td></tr>

        <!-- Pie -->
        <tr><td style="padding:22px 34px 30px;border-top:1px solid rgba(255,255,255,0.07);">
          ${footerNote ? `<p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#6f6f6f;">${footerNote}</p>` : ''}
          <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5a5a5a;">
            <a href="${SITE_URL}/fighters" style="color:#8a8a8a;text-decoration:none;">Peleadores</a> &nbsp;·&nbsp;
            <a href="${SITE_URL}/eventos" style="color:#8a8a8a;text-decoration:none;">Eventos</a> &nbsp;·&nbsp;
            <a href="${SITE_URL}/noticias" style="color:#8a8a8a;text-decoration:none;">Noticias</a> &nbsp;·&nbsp;
            <a href="${SITE_URL}/brands" style="color:#8a8a8a;text-decoration:none;">Marcas</a>
          </p>
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#4a4a4a;">
            RANKD · La casa de los deportes de contacto.<br>
            Recibes este correo porque tienes una cuenta en RANKD.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Bienvenida: cambia según el tipo de cuenta ──
const WELCOME_BY_TYPE = {
  fighter: {
    eyebrow: 'Ya estás dentro',
    title: 'Bienvenido al <span style="color:#E10600;">ring</span>',
    lead: 'Gracias por unirte a RANKD. Acabas de entrar en la casa de los deportes de contacto.',
    points: [
      ['Completa tu perfil', 'Récord, disciplina, categoría y vídeo. Un perfil completo es lo que hace que promotoras y marcas te encuentren.'],
      ['Abre Mi Esquina', 'Tu centro de entrenamiento: planificador semanal, temporizador de asaltos, control de peso, nutrición y material.'],
      ['Busca oportunidades', 'Combates, sparrings, campamentos y patrocinios publicados por promotoras reales.'],
    ],
    cta: ['Completar mi perfil', '/dashboard'],
  },
  promoter: {
    eyebrow: 'Ya estás dentro',
    title: 'Bienvenida a <span style="color:#E10600;">RANKD</span>',
    lead: 'Gracias por unirte. A partir de ahora tienes el talento y tus eventos en el mismo sitio.',
    points: [
      ['Publica tu evento', 'Ficha pública, cartel y venta de entradas por tipos, con aforo real controlado.'],
      ['Busca peleadores', 'Filtra el directorio por disciplina, categoría, récord y disponibilidad.'],
      ['Publica oportunidades', 'Lanza una convocatoria y recibe candidaturas ordenadas en tu panel.'],
    ],
    cta: ['Ir a mi panel', '/dashboard'],
  },
  gym: {
    eyebrow: 'Ya estás dentro',
    title: 'Bienvenido a <span style="color:#E10600;">RANKD</span>',
    lead: 'Gracias por unirte. Tu gimnasio ya tiene su sitio en el mapa de los deportes de contacto.',
    points: [
      ['Monta tu escaparate', 'Galería, disciplinas y datos de contacto en una ficha pública dentro del directorio.'],
      ['Encuentra peleadores', 'Busca talento por disciplina, nivel y zona.'],
      ['Anuncia lo tuyo', 'Veladas internas, campamentos y plazas de sparring.'],
    ],
    cta: ['Ir a mi panel', '/dashboard'],
  },
  manager: {
    eyebrow: 'Ya estás dentro',
    title: 'Bienvenido a <span style="color:#E10600;">RANKD</span>',
    lead: 'Gracias por unirte. Gestiona a tus representados y sus oportunidades desde un único panel.',
    points: [
      ['Explora el directorio', 'Récords, disciplinas y disponibilidad de peleadores verificados.'],
      ['Contacta directamente', 'Mensajería interna con peleadores, promotoras y marcas.'],
      ['Sigue las oportunidades', 'Combates y patrocinios abiertos, filtrados por lo que buscas.'],
    ],
    cta: ['Ir a mi panel', '/dashboard'],
  },
  brand: {
    eyebrow: 'Ya estás dentro',
    title: 'Bienvenida a <span style="color:#E10600;">RANKD</span>',
    lead: 'Gracias por unirte. Aquí tu marca llega directamente a quien vive de esto.',
    points: [
      ['Publica tu escaparate', 'Productos y servicios visibles para toda la comunidad.'],
      ['Encuentra a quién patrocinar', 'Peleadores filtrados por disciplina, nivel y proyección.'],
      ['Patrocina eventos', 'Busca veladas por zona y fecha y contacta con la promotora.'],
    ],
    cta: ['Ir a mi panel', '/dashboard'],
  },
};

function welcomeEmail({ name, userType }) {
  const cfg = WELCOME_BY_TYPE[userType] || WELCOME_BY_TYPE.fighter;
  const firstName = (name || '').trim().split(' ')[0];

  const points = cfg.points.map(([t, d], i) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
      <tr>
        <td width="34" valign="top" style="padding-top:2px;">
          <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:8px;background:rgba(225,6,0,0.12);border:1px solid rgba(225,6,0,0.3);font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:#E10600;">${i + 1}</span>
        </td>
        <td valign="top">
          <p style="margin:0 0 3px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;">${t}</p>
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#9a9a9a;">${d}</p>
        </td>
      </tr>
    </table>`).join('');

  const bodyHtml = `
    <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.6;color:#e8e8e8;">
      ${firstName ? `${escapeHtml(firstName)}, g` : 'G'}racias por unirte a RANKD.
    </p>
    <p style="margin:0 0 26px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.65;color:#a8a8a8;">
      ${cfg.lead.replace(/^Gracias por unirte( a RANKD)?\.\s*/, '')}
    </p>
    <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:2.5px;text-transform:uppercase;color:#6a6a6a;">Por dónde empezar</p>
    ${points}`;

  return {
    subject: firstName ? `${firstName}, bienvenido a RANKD` : 'Bienvenido a RANKD',
    html: shell({
      eyebrow: cfg.eyebrow,
      title: cfg.title,
      bodyHtml,
      ctaText: cfg.cta[0],
      ctaUrl: SITE_URL + cfg.cta[1],
      footerNote: '¿Alguna duda? Responde a este correo y te contestamos nosotros, no un robot.',
    }),
  };
}

function broadcastEmail({ subject, body, name }) {
  const greeting = name ? `<p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.65;color:#e8e8e8;">Hola ${escapeHtml(String(name).trim().split(' ')[0])},</p>` : '';
  return {
    subject,
    html: shell({
      eyebrow: 'Comunicado',
      title: escapeHtml(subject),
      bodyHtml: greeting + textToHtml(body),
      ctaText: 'Entrar en RANKD',
      ctaUrl: SITE_URL + '/dashboard',
      footerNote: '',
    }),
  };
}

// ────────────────────────────────────────────────────────────────
// ENVÍO
// ────────────────────────────────────────────────────────────────

async function resendSend(payload, key) {
  const res = await fetch(`${RESEND_API}/emails`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Resend respondió ${res.status}`);
  return data;
}

async function resendBatch(list, key) {
  const res = await fetch(`${RESEND_API}/emails/batch`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(list),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Resend respondió ${res.status}`);
  return data;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ────────────────────────────────────────────────────────────────
// HANDLER
// ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { resendKey, from, supabaseUrl, serviceKey } = env();

  // ── Sonda: no envía nada ni gasta cuota ──
  if (req.method === 'GET') {
    return res.status(200).json({
      configured: !!resendKey,
      canBroadcast: !!resendKey && !!serviceKey && !!supabaseUrl,
      missing: [
        !resendKey && 'RESEND_API_KEY',
        !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY',
      ].filter(Boolean),
      from: resendKey ? from : null,
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const type = body.type;

  // Sin clave no se rompe nada: se avisa y el front lo muestra con elegancia.
  if (!resendKey) {
    return res.status(200).json({
      skipped: true,
      reason: 'not_configured',
      message: 'El servicio de email todavía no está configurado.',
    });
  }

  try {
    // ══ BIENVENIDA ══
    if (type === 'welcome') {
      const { to, name, userType } = body;
      if (!to) return res.status(400).json({ error: 'Falta el destinatario' });
      const { subject, html } = welcomeEmail({ name, userType });
      await resendSend({ from, to: [to], subject, html }, resendKey);
      return res.status(200).json({ sent: 1 });
    }

    // ══ ENVÍO MASIVO (solo administradores) ══
    if (type === 'broadcast') {
      const { subject, message, audience = 'all', test } = body;
      if (!subject?.trim() || !message?.trim()) {
        return res.status(400).json({ error: 'El asunto y el mensaje son obligatorios' });
      }
      if (!serviceKey || !supabaseUrl) {
        return res.status(200).json({
          skipped: true,
          reason: 'no_service_key',
          message: 'Falta SUPABASE_SERVICE_ROLE_KEY para poder leer la lista de destinatarios.',
        });
      }

      // Verificamos que quien llama es de verdad un administrador.
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) return res.status(401).json({ error: 'Sesión no encontrada' });

      const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      const { data: userData, error: userErr } = await admin.auth.getUser(token);
      const callerEmail = userData?.user?.email?.toLowerCase();
      if (userErr || !callerEmail || !ADMIN_EMAILS.includes(callerEmail)) {
        return res.status(403).json({ error: 'No tienes permiso para enviar comunicados' });
      }

      // Prueba: solo a mí mismo, para ver cómo queda antes de disparar a todos.
      if (test) {
        const { subject: s, html } = broadcastEmail({ subject, body: message, name: userData.user.user_metadata?.full_name });
        await resendSend({ from, to: [callerEmail], subject: `[PRUEBA] ${s}`, html }, resendKey);
        return res.status(200).json({ sent: 1, test: true, recipients: [callerEmail] });
      }

      // Destinatarios: perfiles filtrados por tipo + su email desde auth.
      let profileQuery = admin.from('profiles').select('id, full_name, user_type');
      if (audience !== 'all') profileQuery = profileQuery.eq('user_type', audience);
      const { data: profiles, error: profErr } = await profileQuery;
      if (profErr) return res.status(500).json({ error: 'No se pudo leer la lista de usuarios' });

      const wanted = new Map((profiles || []).map((p) => [p.id, p.full_name]));
      if (wanted.size === 0) return res.status(200).json({ sent: 0, recipients: [], empty: true });

      // listUsers viene paginado; recorremos hasta agotar.
      const recipients = [];
      for (let page = 1; page <= 20; page++) {
        const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (listErr) break;
        const users = usersPage?.users || [];
        users.forEach((u) => {
          if (u.email && wanted.has(u.id)) recipients.push({ email: u.email, name: wanted.get(u.id) });
        });
        if (users.length < 1000) break;
      }

      if (recipients.length === 0) return res.status(200).json({ sent: 0, recipients: [], empty: true });

      let sent = 0;
      const failed = [];
      for (const group of chunk(recipients, BATCH_SIZE)) {
        const payload = group.map((r) => {
          const { subject: s, html } = broadcastEmail({ subject, body: message, name: r.name });
          return { from, to: [r.email], subject: s, html };
        });
        try {
          await resendBatch(payload, resendKey);
          sent += group.length;
        } catch (e) {
          failed.push(e.message);
        }
      }

      // Dejamos constancia del envío para el historial del panel.
      // Si la tabla aún no existe, el comunicado ya salió: no lo damos por fallido.
      await admin.from('email_campaigns').insert({
        subject, body: message, audience,
        recipients_count: sent,
        sent_by: userData.user.id,
      }).then(() => {}, () => {});

      return res.status(200).json({
        sent,
        total: recipients.length,
        failed: failed.length ? failed : undefined,
      });
    }

    return res.status(400).json({ error: 'Tipo de correo desconocido' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Error enviando el correo' });
  }
}
