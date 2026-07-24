import { useState, useEffect, useCallback } from 'react';
import { supabase, OrgEvent, EventTicket, Profile } from '@/lib/supabase';

interface Props {
  event: OrgEvent;
  profile: Profile;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
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

export default function EventTicketsManager({ event, profile, onClose, showToast }: Props) {
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [reservCount, setReservCount] = useState(0);
  const [reservQty, setReservQty] = useState(0);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('event_tickets')
      .select('*')
      .eq('event_id', event.id)
      .order('sort_order', { ascending: true });
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    setTickets((data as EventTicket[]) || []);

    const { data: orders } = await supabase
      .from('ticket_orders')
      .select('quantity')
      .eq('event_id', event.id);
    if (orders) {
      setReservCount(orders.length);
      setReservQty(orders.reduce((a, o) => a + (o.quantity || 0), 0));
    }
    setLoading(false);
  }, [event.id]);

  useEffect(() => { load(); }, [load]);

  const addTicket = async () => {
    if (!name.trim()) { showToast('Ponle nombre a la entrada', 'error'); return; }
    const priceEur = parseFloat((price || '0').replace(',', '.'));
    if (isNaN(priceEur) || priceEur < 0) { showToast('Precio no válido', 'error'); return; }
    const qty = parseInt(quantity || '0', 10) || 0;
    setSaving(true);
    const { data, error } = await supabase.from('event_tickets').insert({
      event_id: event.id,
      org_profile_id: profile.id,
      name: name.trim(),
      price_cents: Math.round(priceEur * 100),
      quantity_total: qty,
      is_active: true,
      sort_order: tickets.length,
    }).select('*').maybeSingle();
    if (error || !data) { showToast('No se pudo crear la entrada', 'error'); setSaving(false); return; }
    setTickets((prev) => [...prev, data as EventTicket]);
    setName(''); setPrice(''); setQuantity('');
    showToast('Entrada creada');
    setSaving(false);
  };

  const removeTicket = async (id: string) => {
    const { error } = await supabase.from('event_tickets').delete().eq('id', id);
    if (error) { showToast('No se pudo eliminar', 'error'); return; }
    setTickets((prev) => prev.filter((t) => t.id !== id));
    showToast('Entrada eliminada');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
      <div className="relative rk-card w-full max-w-lg max-h-[92vh] overflow-y-auto" style={{ background: '#0d0d0d' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] sticky top-0 bg-[#0d0d0d] z-10">
          <div className="min-w-0">
            <p className="rk-eyebrow" style={{ fontSize: '0.6rem' }}>ENTRADAS</p>
            <h3 className="text-base font-bold text-white truncate">{event.title}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer transition-colors flex-shrink-0">
            <i className="ri-close-line"></i>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-10"><div className="w-7 h-7 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>
          ) : unavailable ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25"><i className="ri-ticket-2-line text-2xl text-red-400"></i></div>
              <p className="text-sm text-zinc-300 font-medium">Venta de entradas en preparación</p>
              <p className="text-xs text-zinc-500 mt-1.5 max-w-xs mx-auto">La gestión de entradas se activará en el servidor muy pronto. Mientras, puedes usar el campo "link de entradas" del evento.</p>
            </div>
          ) : (
            <>
              {/* Resumen reservas */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rk-card" style={{ padding: '14px 16px' }}>
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#fff', lineHeight: 1 }}>{reservCount}</p>
                  <p className="text-[11px] text-zinc-400 uppercase tracking-wider mt-1">Reservas</p>
                </div>
                <div className="rk-card" style={{ padding: '14px 16px' }}>
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#C9A84C', lineHeight: 1 }}>{reservQty}</p>
                  <p className="text-[11px] text-zinc-400 uppercase tracking-wider mt-1">Entradas reservadas</p>
                </div>
              </div>

              {/* Lista de tipos */}
              {tickets.length > 0 && (
                <div className="space-y-2">
                  {tickets.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3.5 group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{t.name}</span>
                          <span className="text-xs font-bold text-[#C9A84C]">{fmtPrice(t.price_cents)}</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {t.quantity_total === 0 ? 'Aforo sin límite' : `${t.quantity_sold} / ${t.quantity_total} vendidas`}
                        </p>
                      </div>
                      <button onClick={() => removeTicket(t.id)} className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer transition-colors flex-shrink-0">
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Nuevo tipo de entrada */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Nueva entrada</p>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder="Nombre (General, VIP, Ringside...)" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl pl-4 pr-8 py-2.5 focus:outline-none focus:border-red-500" placeholder="Precio" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">€</span>
                  </div>
                  <input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder="Aforo (0 = ∞)" />
                </div>
                <button onClick={addTicket} disabled={saving} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.85rem', padding: '0.7rem' }}>
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><i className="ri-add-line"></i> AÑADIR ENTRADA</>}
                </button>
              </div>

              <p className="text-[11px] text-zinc-600 leading-relaxed">
                Las reservas llegan sin pago online (aún). Para cobrar automáticamente con tarjeta hay que conectar una pasarela — ver <span className="text-zinc-400">PAGOS.md</span> en el repositorio.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
