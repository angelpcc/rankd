import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  showToast: (msg: string, ok?: boolean) => void;
}

interface Ticket {
  id: string;
  topic: string;
  subject: string;
  message: string;
  contact_email: string | null;
  status: 'open' | 'in_progress' | 'closed';
  admin_note: string | null;
  created_at: string;
}

interface ContactMsg {
  id: string;
  name: string;
  email: string;
  role: string | null;
  discipline: string | null;
  message: string;
  created_at: string;
}

interface Inquiry {
  id: string;
  fighter_name: string | null;
  contact_name: string;
  email: string;
  organization: string | null;
  interest_type: string | null;
  message: string;
  created_at: string;
}

type Source = 'incidencias' | 'formulario' | 'peleadores';

const TOPIC_LABEL: Record<string, string> = {
  bug: 'Fallo técnico', cuenta: 'Cuenta', pago: 'Pagos', contenido: 'Contenido', otro: 'Otro',
};

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  open: { label: 'Abierta', cls: 'bg-red-600/15 border-red-500/30 text-red-400' },
  in_progress: { label: 'En curso', cls: 'bg-yellow-500/12 border-yellow-500/30 text-yellow-400' },
  closed: { label: 'Cerrada', cls: 'bg-green-500/12 border-green-500/30 text-green-400' },
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Tarjeta plegable: el asunto siempre visible, el cuerpo bajo demanda. */
function Card({ title, meta, badge, email, body, children }: {
  title: string; meta: string; badge?: React.ReactNode; email?: string | null; body: string; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rk-card overflow-hidden" style={{ transform: 'none' }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full text-left p-4 flex items-start gap-3.5 cursor-pointer">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-white">{title}</p>
            {badge}
          </div>
          <p className="text-xs text-zinc-500 mt-1">{meta}</p>
        </div>
        <i className={`${open ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-zinc-500 flex-shrink-0 mt-0.5`}></i>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="rounded-xl bg-black/40 border border-white/[0.06] p-4">
            <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{body}</p>
          </div>
          {email && (
            <a href={`mailto:${email}`}
              className="inline-flex items-center gap-2 text-xs font-bold text-zinc-300 bg-white/[0.04] border border-white/10 hover:border-white/25 hover:text-white px-3.5 py-2 rounded-lg transition-colors">
              <i className="ri-reply-line"></i> Responder a {email}
            </a>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

export default function SupportInbox({ showToast }: Props) {
  const [source, setSource] = useState<Source>('incidencias');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [contacts, setContacts] = useState<ContactMsg[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyOpen, setOnlyOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, c, q] = await Promise.all([
      supabase.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('contact_submissions').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('fighter_inquiries').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    setTickets((t.data || []) as Ticket[]);
    setContacts((c.data || []) as ContactMsg[]);
    setInquiries((q.data || []) as Inquiry[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: Ticket['status']) => {
    const { error } = await supabase.from('support_tickets')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { showToast('No se pudo actualizar la incidencia', false); return; }
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    showToast(status === 'closed' ? 'Incidencia cerrada ✓' : 'Estado actualizado ✓');
  };

  const openTickets = tickets.filter((t) => t.status !== 'closed');
  const visibleTickets = onlyOpen ? openTickets : tickets;

  const SOURCES: { id: Source; label: string; icon: string; n: number }[] = [
    { id: 'incidencias', label: 'Incidencias', icon: 'ri-bug-line', n: openTickets.length },
    { id: 'formulario', label: 'Formulario de contacto', icon: 'ri-mail-line', n: contacts.length },
    { id: 'peleadores', label: 'Contactos a peleadores', icon: 'ri-user-received-line', n: inquiries.length },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(30px,5vw,44px)', letterSpacing: 1, lineHeight: 1 }}>
            BANDEJA DE <span className="rk-red-glow">ENTRADA</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-2">Todo lo que llega de fuera: incidencias, formulario de contacto y peticiones a peleadores.</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 text-xs font-bold text-zinc-300 bg-white/[0.04] border border-white/10 hover:border-white/25 px-4 py-2.5 rounded-xl cursor-pointer transition-colors disabled:opacity-50">
          <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`}></i> Actualizar
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto">
        {SOURCES.map((s) => (
          <button key={s.id} onClick={() => setSource(s.id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
              source === s.id ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/25'
            }`}>
            <i className={s.icon}></i>{s.label}
            {s.n > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${source === s.id ? 'bg-white/20' : 'bg-white/[0.07] text-zinc-500'}`}>{s.n}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <>
          {/* ── Incidencias ── */}
          {source === 'incidencias' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button onClick={() => setOnlyOpen((v) => !v)}
                  className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white cursor-pointer transition-colors">
                  <i className={onlyOpen ? 'ri-checkbox-fill text-red-500' : 'ri-checkbox-blank-line'}></i>
                  Ver solo las abiertas
                </button>
                <span className="text-xs text-zinc-600">{visibleTickets.length} de {tickets.length}</span>
              </div>

              {visibleTickets.length === 0 ? (
                <div className="text-center py-16 rk-card" style={{ transform: 'none' }}>
                  <div className="w-14 h-14 mx-auto mb-3 flex items-center justify-center rounded-2xl bg-green-500/10 border border-green-500/25">
                    <i className="ri-check-double-line text-2xl text-green-400"></i>
                  </div>
                  <p className="text-zinc-300 text-sm font-medium">{tickets.length === 0 ? 'Sin incidencias' : 'Nada abierto'}</p>
                  <p className="text-zinc-600 text-xs mt-1 max-w-xs mx-auto leading-relaxed">
                    {tickets.length === 0
                      ? 'Cuando alguien reporte un problema desde la plataforma, aparecerá aquí.'
                      : 'Todas las incidencias están cerradas. Buen trabajo.'}
                  </p>
                </div>
              ) : visibleTickets.map((t) => {
                const st = STATUS_STYLE[t.status] || STATUS_STYLE.open;
                return (
                  <Card key={t.id} title={t.subject}
                    meta={`${TOPIC_LABEL[t.topic] || t.topic} · ${fmt(t.created_at)}`}
                    email={t.contact_email}
                    body={t.message}
                    badge={<span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>}
                  >
                    <div className="flex gap-2 flex-wrap">
                      {(['open', 'in_progress', 'closed'] as const).map((s) => (
                        <button key={s} onClick={() => setStatus(t.id, s)} disabled={t.status === s}
                          className={`text-xs font-bold px-3.5 py-2 rounded-lg border transition-colors cursor-pointer disabled:opacity-100 disabled:cursor-default ${
                            t.status === s ? STATUS_STYLE[s].cls : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/25'
                          }`}>
                          {STATUS_STYLE[s].label}
                        </button>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ── Formulario de contacto ── */}
          {source === 'formulario' && (
            <div className="space-y-3">
              {contacts.length === 0 ? (
                <div className="text-center py-16 rk-card" style={{ transform: 'none' }}>
                  <i className="ri-mail-line text-4xl text-zinc-700"></i>
                  <p className="text-zinc-400 text-sm mt-3 font-medium">Sin mensajes</p>
                  <p className="text-zinc-600 text-xs mt-1">Los envíos del formulario de la home caen aquí.</p>
                </div>
              ) : contacts.map((c) => (
                <Card key={c.id} title={c.name}
                  meta={[c.role, c.discipline, fmt(c.created_at)].filter(Boolean).join(' · ')}
                  email={c.email} body={c.message} />
              ))}
            </div>
          )}

          {/* ── Contactos a peleadores ── */}
          {source === 'peleadores' && (
            <div className="space-y-3">
              {inquiries.length === 0 ? (
                <div className="text-center py-16 rk-card" style={{ transform: 'none' }}>
                  <i className="ri-user-received-line text-4xl text-zinc-700"></i>
                  <p className="text-zinc-400 text-sm mt-3 font-medium">Sin peticiones</p>
                  <p className="text-zinc-600 text-xs mt-1">Aquí verás quién contacta a los peleadores desde su ficha pública.</p>
                </div>
              ) : inquiries.map((q) => (
                <Card key={q.id} title={`${q.contact_name} → ${q.fighter_name || 'un peleador'}`}
                  meta={[q.organization, q.interest_type, fmt(q.created_at)].filter(Boolean).join(' · ')}
                  email={q.email} body={q.message} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
