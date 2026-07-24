import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getEmailStatus, sendBroadcast, type EmailStatus } from '@/lib/email';

interface Props {
  showToast: (msg: string, ok?: boolean) => void;
  usersByType: Record<string, number>;
  totalUsers: number;
}

interface Campaign {
  id: string;
  subject: string;
  body: string;
  audience: string;
  recipients_count: number;
  created_at: string;
}

const AUDIENCES = [
  { id: 'all', label: 'Todos', icon: 'ri-group-line' },
  { id: 'fighter', label: 'Peleadores', icon: 'ri-boxing-line' },
  { id: 'promoter', label: 'Promotoras', icon: 'ri-trophy-line' },
  { id: 'gym', label: 'Gimnasios', icon: 'ri-building-4-line' },
  { id: 'manager', label: 'Managers', icon: 'ri-user-star-line' },
  { id: 'brand', label: 'Marcas', icon: 'ri-store-2-line' },
];

const AUDIENCE_LABEL: Record<string, string> = Object.fromEntries(AUDIENCES.map((a) => [a.id, a.label]));

// Puntos de partida para no empezar ante un cuadro en blanco.
const TEMPLATES = [
  {
    name: 'Novedad de producto',
    subject: 'Novedades en RANKD',
    message: 'Hemos añadido algo nuevo que creemos que te va a gustar.\n\n[Cuenta aquí qué es y para qué sirve, en dos o tres frases.]\n\nEntra y pruébalo. Como siempre, si algo no te cuadra, responde a este correo.',
  },
  {
    name: 'Evento destacado',
    subject: 'Velada este fin de semana',
    message: 'Se acerca una velada que merece la pena.\n\n[Nombre del evento, fecha, lugar y por qué importa.]\n\nTienes la ficha completa y las entradas en la sección de Eventos.',
  },
  {
    name: 'Reactivar cuentas',
    subject: 'Te echamos de menos en el gimnasio',
    message: 'Hace tiempo que no te vemos por RANKD.\n\nMi Esquina sigue ahí: tu diario de entrenos, el planificador semanal, el temporizador de asaltos y el control de peso.\n\nVuelve cuando quieras. El primer entreno registrado es el más difícil.',
  },
];

export default function BroadcastPanel({ showToast, usersByType, totalUsers }: Props) {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [audience, setAudience] = useState('all');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [history, setHistory] = useState<Campaign[]>([]);

  useEffect(() => { getEmailStatus().then(setStatus); }, []);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('email_campaigns').select('*')
      .order('created_at', { ascending: false }).limit(10);
    if (data) setHistory(data as Campaign[]);
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const recipientCount = audience === 'all' ? totalUsers : (usersByType[audience] || 0);
  const ready = !!status?.canBroadcast;
  const canSend = ready && subject.trim().length > 2 && message.trim().length > 10 && !sending;

  const doSend = async (test: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { showToast('Tu sesión ha caducado. Vuelve a entrar.', false); return; }

    setSending(true);
    const res = await sendBroadcast({
      accessToken: session.access_token,
      subject: subject.trim(),
      message: message.trim(),
      audience,
      test,
    });
    setSending(false);
    setConfirming(false);

    if (res.skipped) { showToast(res.message || 'El servicio de email no está configurado', false); return; }
    if (!res.ok) { showToast(res.error || 'No se pudo enviar', false); return; }

    if (test) {
      showToast('Correo de prueba enviado a tu bandeja ✓');
      return;
    }
    showToast(`Comunicado enviado a ${res.sent} ${res.sent === 1 ? 'persona' : 'personas'} ✓`);
    setSubject('');
    setMessage('');
    loadHistory();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(30px,5vw,44px)', letterSpacing: 1, lineHeight: 1 }}>
          ENVIAR <span className="rk-red-glow">COMUNICADO</span>
        </h1>
        <p className="text-zinc-400 text-sm mt-2">Escribe un mensaje y llega de golpe a toda la plataforma o solo a un tipo de cuenta.</p>
      </div>

      {/* Estado del servicio */}
      {status && !ready && (
        <div className="rk-card p-5 flex items-start gap-4" style={{ borderColor: 'rgba(234,179,8,0.3)' }}>
          <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl bg-yellow-500/12 border border-yellow-500/30 text-yellow-400">
            <i className="ri-mail-settings-line text-xl"></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-yellow-400">Servicio de email no configurado todavía</p>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              La herramienta está lista y puedes escribir y guardar tu mensaje. Para que salga de verdad falta{' '}
              {status.missing.length === 1 ? 'esta variable' : 'estas variables'} de entorno en Vercel:
            </p>
            <div className="flex flex-wrap gap-2 mt-2.5">
              {status.missing.map((m) => (
                <code key={m} className="text-[11px] font-mono text-yellow-300 bg-yellow-500/10 border border-yellow-500/25 px-2 py-1 rounded-lg">{m}</code>
              ))}
            </div>
            <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed">
              Vercel → <span className="text-zinc-300">Settings → Environment Variables</span> → añadir → <span className="text-zinc-300">Redeploy</span>.
              La clave de Resend se saca en <span className="text-zinc-300">resend.com → API Keys</span>.
            </p>
          </div>
        </div>
      )}
      {ready && (
        <div className="flex items-center gap-2.5 text-xs text-green-400 bg-green-500/[0.07] border border-green-500/25 rounded-xl px-4 py-2.5">
          <i className="ri-checkbox-circle-fill"></i>
          Servicio de email activo · se enviará desde <span className="font-mono text-green-300">{status?.from}</span>
        </div>
      )}

      {/* Redacción */}
      <div className="rk-card p-6 space-y-5" style={{ transform: 'none' }}>
        {/* Destinatarios */}
        <div>
          <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2.5">Para quién</label>
          <div className="flex flex-wrap gap-2">
            {AUDIENCES.map((a) => {
              const n = a.id === 'all' ? totalUsers : (usersByType[a.id] || 0);
              return (
                <button key={a.id} onClick={() => setAudience(a.id)} disabled={n === 0 && a.id !== 'all'}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border disabled:opacity-35 disabled:cursor-not-allowed ${
                    audience === a.id ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/25'
                  }`}>
                  <i className={a.icon}></i>{a.label}
                  <span className={audience === a.id ? 'text-white/70' : 'text-zinc-600'}>{n}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Plantillas */}
        <div>
          <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2.5">Empezar desde una base</label>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button key={t.name} onClick={() => { setSubject(t.subject); setMessage(t.message); }}
                className="text-xs text-zinc-300 bg-white/[0.03] border border-white/10 hover:border-red-500/40 hover:text-white px-3 py-2 rounded-xl transition-colors cursor-pointer">
                <i className="ri-file-text-line mr-1.5"></i>{t.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Asunto</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={90}
            placeholder="Lo primero que van a leer en la bandeja"
            className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 transition-colors" />
          <p className="text-[11px] text-zinc-600 mt-1.5">{subject.length}/90 · los asuntos cortos y concretos se abren más</p>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Mensaje</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={9}
            placeholder="Escribe aquí el cuerpo del correo. Una línea en blanco separa párrafos."
            className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 resize-y leading-relaxed transition-colors" />
          <p className="text-[11px] text-zinc-600 mt-1.5">
            Se envía con la plantilla de RANKD (cabecera, colores y pie). Cada persona lo recibe con su nombre.
          </p>
        </div>

        {/* Vista previa */}
        {(subject.trim() || message.trim()) && (
          <div className="rounded-2xl border border-white/[0.08] overflow-hidden">
            <div className="px-4 py-2 bg-white/[0.03] border-b border-white/[0.07] flex items-center gap-2">
              <i className="ri-eye-line text-zinc-500 text-sm"></i>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Vista previa</span>
            </div>
            <div className="p-6" style={{ background: '#0a0a0a' }}>
              <div className="h-1 w-full rounded-full mb-5" style={{ background: '#E10600' }} />
              <p style={{ fontFamily: 'Arial Black, Arial, sans-serif', fontSize: 20, letterSpacing: -0.5 }}>
                <span className="text-white">RAN</span><span className="text-[#E10600]">KD</span>
              </p>
              <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#C9A84C] mt-4">Comunicado</p>
              <p className="text-white font-black uppercase mt-2 leading-tight" style={{ fontFamily: 'Arial Black, Arial, sans-serif', fontSize: 21 }}>
                {subject || 'Tu asunto aquí'}
              </p>
              <p className="text-zinc-300 text-sm mt-4">Hola [nombre],</p>
              <p className="text-zinc-400 text-sm mt-3 whitespace-pre-wrap leading-relaxed">
                {message || 'Tu mensaje aparecerá aquí.'}
              </p>
              <span className="inline-block mt-5 bg-[#E10600] text-white text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-lg">
                Entrar en RANKD
              </span>
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button onClick={() => doSend(true)} disabled={!canSend}
            className="flex items-center justify-center gap-2 bg-white/[0.05] border border-white/12 hover:border-white/30 text-zinc-200 text-sm font-bold px-5 py-3.5 rounded-xl cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            <i className="ri-send-plane-line"></i> Enviarme una prueba
          </button>

          {!confirming ? (
            <button onClick={() => setConfirming(true)} disabled={!canSend}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-5 py-3.5 rounded-xl cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <i className="ri-mail-send-line"></i>
              Enviar a {recipientCount} {recipientCount === 1 ? 'persona' : 'personas'}
            </button>
          ) : (
            <div className="flex-1 flex items-center gap-2.5 bg-red-600/10 border border-red-500/35 rounded-xl px-4 py-3">
              <i className="ri-alert-line text-red-400 flex-shrink-0"></i>
              <span className="text-xs text-zinc-300 flex-1 leading-snug">
                Va a salir a <b className="text-white">{recipientCount}</b> {recipientCount === 1 ? 'persona' : 'personas'}
                {audience !== 'all' && <> ({AUDIENCE_LABEL[audience]})</>}. Esto no se puede deshacer.
              </span>
              <button onClick={() => setConfirming(false)} className="text-xs text-zinc-400 hover:text-white cursor-pointer px-2">Cancelar</button>
              <button onClick={() => doSend(false)} disabled={sending}
                className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors disabled:opacity-60 whitespace-nowrap">
                {sending ? 'Enviando...' : 'Sí, enviar'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Historial */}
      {history.length > 0 && (
        <div>
          <h2 className="rk-h3 mb-3" style={{ fontSize: '1rem', color: '#fff' }}>ÚLTIMOS ENVÍOS</h2>
          <div className="space-y-2">
            {history.map((c) => (
              <div key={c.id} className="rk-card p-4 flex items-start gap-3.5" style={{ transform: 'none' }}>
                <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-white/[0.05] border border-white/10 text-zinc-400">
                  <i className="ri-mail-check-line"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{c.subject}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {AUDIENCE_LABEL[c.audience] || c.audience} · {c.recipients_count} {c.recipients_count === 1 ? 'destinatario' : 'destinatarios'} ·{' '}
                    {new Date(c.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button onClick={() => { setSubject(c.subject); setMessage(c.body); setAudience(c.audience); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  title="Reutilizar este mensaje"
                  className="text-xs text-zinc-400 hover:text-white bg-white/[0.04] border border-white/10 hover:border-white/25 px-3 py-2 rounded-lg cursor-pointer transition-colors flex-shrink-0">
                  <i className="ri-file-copy-line"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
