import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  open: boolean;
  onClose: () => void;
}

const TOPICS = [
  { id: 'bug', label: 'Algo no funciona', icon: 'ri-bug-line', desc: 'Un botón, una pantalla o una función que falla' },
  { id: 'cuenta', label: 'Mi cuenta', icon: 'ri-user-settings-line', desc: 'Acceso, perfil, verificación o datos' },
  { id: 'pago', label: 'Pagos y entradas', icon: 'ri-bank-card-line', desc: 'Reservas, cobros o entradas de eventos' },
  { id: 'contenido', label: 'Reportar contenido', icon: 'ri-flag-line', desc: 'Un perfil, evento o publicación inadecuada' },
  { id: 'otro', label: 'Otra cosa', icon: 'ri-question-line', desc: 'Sugerencias, dudas o cualquier otro tema' },
];

/**
 * Formulario de incidencias. Lo que se envía aquí aparece en el panel de
 * administración (Soporte → Incidencias), con su estado y respuesta por correo.
 */
export default function SupportModal({ open, onClose }: Props) {
  const { user, profile } = useAuth();
  const [topic, setTopic] = useState('bug');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setDone(false); setError(''); setEmail(user?.email || ''); }
  }, [open, user?.email]);

  // Bloquear el scroll de fondo mientras el modal está abierto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setError('Necesitas tener la sesión iniciada para enviar una incidencia.'); return; }
    if (subject.trim().length < 4 || message.trim().length < 10) {
      setError('Cuéntanos un poco más: un asunto y una descripción del problema.');
      return;
    }
    setSending(true);
    setError('');
    const { error: err } = await supabase.from('support_tickets').insert({
      user_id: user.id,
      topic,
      subject: subject.trim(),
      message: message.trim(),
      contact_email: email.trim() || user.email || null,
    });
    setSending(false);
    if (err) {
      setError('No hemos podido registrar la incidencia. Escríbenos a hola@rankd.com y lo miramos.');
      return;
    }
    setDone(true);
    setSubject('');
    setMessage('');
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-[#0c0c0c] border border-white/[0.1] rounded-t-3xl sm:rounded-3xl anim-scale-in"
        style={{ boxShadow: '0 32px 90px rgba(0,0,0,0.8)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #E10600, #ff4020 45%, transparent)' }} />

        <div className="flex items-start justify-between gap-4 p-6 pb-4">
          <div>
            <p className="rk-eyebrow">Estamos al otro lado</p>
            <h2 className="rk-h3 mt-1.5" style={{ color: '#fff' }}>¿QUÉ HA PASADO?</h2>
          </div>
          <button onClick={onClose} aria-label="Cerrar"
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-white/[0.05] border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer">
            <i className="ri-close-line"></i>
          </button>
        </div>

        {done ? (
          <div className="px-6 pb-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-green-500/12 border border-green-500/30">
              <i className="ri-check-double-line text-3xl text-green-400"></i>
            </div>
            <p className="text-white font-bold">Recibido</p>
            <p className="text-sm text-zinc-400 mt-2 leading-relaxed max-w-sm mx-auto">
              Lo tenemos en la bandeja. Si hace falta, te escribimos a <span className="text-zinc-200">{email || user?.email}</span>.
              Gracias por avisar: así se arreglan las cosas.
            </p>
            <button onClick={onClose}
              className="mt-6 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-7 py-3 rounded-xl cursor-pointer transition-colors">
              Cerrar
            </button>
          </div>
        ) : !user ? (
          <div className="px-6 pb-8 text-center">
            <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-white/[0.04] border border-white/10">
              <i className="ri-lock-2-line text-2xl text-zinc-500"></i>
            </div>
            <p className="text-white font-bold text-sm">Necesitas iniciar sesión</p>
            <p className="text-sm text-zinc-400 mt-2 leading-relaxed max-w-sm mx-auto">
              Así podemos responderte y seguir el caso. Si prefieres no entrar, escríbenos directamente a{' '}
              <a href="mailto:hola@rankd.com" className="text-[#C9A84C] underline underline-offset-2">hola@rankd.com</a>.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="px-6 pb-6 space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2.5">Tipo</label>
              <div className="space-y-2">
                {TOPICS.map((t) => (
                  <button key={t.id} type="button" onClick={() => setTopic(t.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                      topic === t.id ? 'bg-red-600/10 border-red-500/45' : 'bg-white/[0.025] border-white/[0.08] hover:border-white/20'
                    }`}>
                    <i className={t.icon} style={{ color: topic === t.id ? '#E10600' : 'rgba(255,255,255,0.4)', fontSize: 17 }}></i>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-white">{t.label}</span>
                      <span className="block text-[11px] text-zinc-500 mt-0.5">{t.desc}</span>
                    </span>
                    {topic === t.id && <i className="ri-check-line text-red-400 flex-shrink-0"></i>}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Asunto</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={90}
                placeholder="Resume el problema en una línea"
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 transition-colors" />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Qué ha pasado</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5}
                placeholder="Cuéntanos qué estabas haciendo y qué esperabas que ocurriera. Cuanto más concreto, antes lo arreglamos."
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 resize-y leading-relaxed transition-colors" />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Email de contacto</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 transition-colors" />
              <p className="text-[11px] text-zinc-600 mt-1.5">
                {profile?.full_name ? `Enviando como ${profile.full_name}. ` : ''}Solo lo usamos para responderte.
              </p>
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">{error}</p>
            )}

            <button type="submit" disabled={sending}
              className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-3.5 rounded-xl cursor-pointer transition-colors disabled:opacity-60">
              {sending ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Enviando...</> : <><i className="ri-send-plane-line"></i> Enviar incidencia</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
