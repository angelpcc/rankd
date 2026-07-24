import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, OrgEvent, EventTicket } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  event: OrgEvent;
  isPast: boolean;
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || code === 'PGRST200' || msg.includes('does not exist') || msg.includes('could not find the table');
}

function fmtPrice(cents: number): string {
  if (cents === 0) return 'Gratis';
  return (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

function remaining(t: EventTicket): number {
  return t.quantity_total === 0 ? Infinity : Math.max(0, t.quantity_total - t.quantity_sold);
}

export default function EventTickets({ event, isPast }: Props) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('event_tickets')
      .select('*')
      .eq('event_id', event.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('price_cents', { ascending: true });
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    setTickets((data as EventTicket[]) || []);
    setLoading(false);
  }, [event.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (profile?.full_name) setName(profile.full_name);
    if (user?.email) setEmail(user.email);
  }, [profile, user]);

  const selected = tickets.find((t) => t.id === selectedId) || null;

  const reserve = async () => {
    if (!user) { navigate('/auth'); return; }
    if (!selected) { setError('Elige un tipo de entrada'); return; }
    if (!name.trim() || !email.trim()) { setError('Completa nombre y email'); return; }
    const avail = remaining(selected);
    if (qty < 1 || qty > avail) { setError('Cantidad no disponible'); return; }
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.from('ticket_orders').insert({
      ticket_id: selected.id,
      event_id: event.id,
      org_profile_id: event.org_profile_id,
      buyer_user_id: user.id,
      buyer_name: name.trim(),
      buyer_email: email.trim(),
      quantity: qty,
      unit_price_cents: selected.price_cents,
      total_cents: selected.price_cents * qty,
      status: 'pending',
    });
    if (error) { setError('No se pudo completar la reserva. Inténtalo de nuevo.'); setSubmitting(false); return; }
    setDone(true);
    setSubmitting(false);
    load();
  };

  // ── Cabecera reutilizable ──
  const Header = (
    <div className="px-5 py-4 border-b border-white/[0.07] flex items-center gap-2">
      <i className="ri-ticket-2-line text-red-400"></i>
      <h2 className="rk-h3 text-white" style={{ fontSize: '1rem' }}>ENTRADAS</h2>
    </div>
  );

  // ── Fallback: sin ticketing en plataforma (migración no aplicada o sin entradas) ──
  const ExternalFallback = (
    <div className="p-5">
      {event.external_link ? (
        <>
          <p className="text-sm text-zinc-400 mb-4 leading-relaxed">Consigue tu entrada a través de la promotora.</p>
          <a href={event.external_link} target="_blank" rel="nofollow noreferrer" className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2" style={{ fontSize: '0.95rem' }}>
            <i className="ri-ticket-2-line"></i> COMPRAR ENTRADAS
          </a>
          <p className="text-[11px] text-zinc-600 mt-3 text-center">Te lleva a la web de venta de la promotora.</p>
        </>
      ) : (
        <div className="text-center py-4">
          <i className="ri-time-line text-2xl text-zinc-600"></i>
          <p className="text-sm text-zinc-300 font-medium mt-2">Entradas muy pronto</p>
          <p className="text-xs text-zinc-500 mt-1">La promotora aún no ha abierto la venta para este evento.</p>
        </div>
      )}
    </div>
  );

  if (loading) {
    return <div className="rk-card">{Header}<div className="flex items-center justify-center py-10"><div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div></div>;
  }

  if (isPast) {
    return <div className="rk-card">{Header}<div className="p-5 text-center py-6"><i className="ri-checkbox-circle-line text-2xl text-zinc-600"></i><p className="text-sm text-zinc-400 mt-2">Este evento ya ha finalizado.</p></div></div>;
  }

  if (unavailable || tickets.length === 0) {
    return <div className="rk-card">{Header}{ExternalFallback}</div>;
  }

  if (done) {
    return (
      <div className="rk-card">
        {Header}
        <div className="p-5 text-center py-8">
          <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-green-500/12 border border-green-500/30">
            <i className="ri-check-line text-2xl text-green-400"></i>
          </div>
          <h3 className="rk-h3 text-white" style={{ fontSize: '1.1rem' }}>RESERVA CONFIRMADA</h3>
          <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
            Hemos registrado tu reserva de <span className="text-white font-semibold">{qty} × {selected?.name}</span>. La promotora te contactará en <span className="text-white">{email}</span> con los detalles de pago y acceso.
          </p>
          <button onClick={() => { setDone(false); setSelectedId(null); setQty(1); }} className="rk-btn rk-btn-ghost mt-5" style={{ fontSize: '0.8rem', padding: '0.6rem 1.2rem' }}>
            Reservar otra entrada
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rk-card">
      {Header}
      <div className="p-4 space-y-2.5">
        {tickets.map((t) => {
          const avail = remaining(t);
          const soldOut = avail <= 0;
          const isSel = selectedId === t.id;
          return (
            <button key={t.id} disabled={soldOut} onClick={() => { setSelectedId(t.id); setQty(1); setError(null); }}
              className={`w-full text-left rounded-xl border p-3.5 transition-all ${soldOut ? 'opacity-50 cursor-not-allowed border-white/[0.06] bg-white/[0.01]' : isSel ? 'border-red-500/50 bg-red-600/[0.08] cursor-pointer' : 'border-white/10 bg-white/[0.02] hover:border-white/25 cursor-pointer'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-white">{t.name}</span>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20 }} className={t.price_cents === 0 ? 'text-green-400' : 'text-[#C9A84C]'}>{fmtPrice(t.price_cents)}</span>
              </div>
              {t.description && <p className="text-xs text-zinc-500 mt-1 leading-snug">{t.description}</p>}
              <div className="flex items-center gap-2 mt-2">
                {soldOut ? (
                  <span className="text-[11px] font-bold text-red-400">AGOTADAS</span>
                ) : t.quantity_total === 0 ? (
                  <span className="text-[11px] text-zinc-500">Disponibles</span>
                ) : (
                  <span className="text-[11px] text-zinc-500">{avail} disponibles</span>
                )}
                {isSel && !soldOut && <i className="ri-checkbox-circle-fill text-red-400 text-sm ml-auto"></i>}
              </div>
            </button>
          );
        })}

        {selected && (
          <div className="pt-2 space-y-3 anim-fade-up">
            <div className="rk-rule" style={{ opacity: 0.4 }} />
            {/* Cantidad */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-300">Cantidad</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/10 text-white hover:bg-white/10 cursor-pointer"><i className="ri-subtract-line"></i></button>
                <span className="text-white font-bold w-6 text-center">{qty}</span>
                <button onClick={() => setQty((q) => Math.min(remaining(selected) === Infinity ? 10 : remaining(selected), q + 1))} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/10 text-white hover:bg-white/10 cursor-pointer"><i className="ri-add-line"></i></button>
              </div>
            </div>

            {user ? (
              <>
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1">Nombre</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500" placeholder="Tu nombre" />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1">Email de contacto</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500" placeholder="tu@email.com" />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm text-zinc-400">Total</span>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26 }} className="text-white">{fmtPrice(selected.price_cents * qty)}</span>
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button onClick={reserve} disabled={submitting} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.95rem' }}>
                  {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> RESERVANDO...</> : <><i className="ri-ticket-2-line"></i> {selected.price_cents === 0 ? 'CONSEGUIR ENTRADA' : 'RESERVAR'}</>}
                </button>
                <p className="text-[11px] text-zinc-600 text-center leading-relaxed">Reserva sin pago online todavía. La promotora confirmará el pago y el acceso por email.</p>
              </>
            ) : (
              <button onClick={() => navigate('/auth')} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2" style={{ fontSize: '0.9rem' }}>
                <i className="ri-login-circle-line"></i> INICIA SESIÓN PARA RESERVAR
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
