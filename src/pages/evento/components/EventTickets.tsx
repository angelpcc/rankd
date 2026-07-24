import { OrgEvent } from '@/lib/supabase';

interface Props {
  event: OrgEvent;
  isPast: boolean;
}

// T3: versión inicial basada en el enlace externo existente.
// T4 sustituye esto por tipos de entrada y compra dentro de la plataforma.
export default function EventTickets({ event, isPast }: Props) {
  return (
    <div className="rk-card overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.07] flex items-center gap-2">
        <i className="ri-ticket-2-line text-red-400"></i>
        <h2 className="rk-h3 text-white" style={{ fontSize: '1rem' }}>ENTRADAS</h2>
      </div>
      <div className="p-5">
        {isPast ? (
          <div className="text-center py-4">
            <i className="ri-checkbox-circle-line text-2xl text-zinc-600"></i>
            <p className="text-sm text-zinc-400 mt-2">Este evento ya ha finalizado.</p>
          </div>
        ) : event.external_link ? (
          <>
            <p className="text-sm text-zinc-400 mb-4 leading-relaxed">Consigue tu entrada para <span className="text-white font-semibold">{event.title}</span> a través de la promotora.</p>
            <a href={event.external_link} target="_blank" rel="nofollow noreferrer"
              className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2" style={{ fontSize: '0.95rem' }}>
              <i className="ri-ticket-2-line"></i> COMPRAR ENTRADAS
            </a>
            <p className="text-[11px] text-zinc-600 mt-3 text-center">Te lleva a la web de venta de la promotora.</p>
          </>
        ) : (
          <div className="text-center py-4">
            <i className="ri-time-line text-2xl text-zinc-600"></i>
            <p className="text-sm text-zinc-300 font-medium mt-2">Entradas muy pronto</p>
            <p className="text-xs text-zinc-500 mt-1">La promotora aún no ha abierto la venta de entradas para este evento.</p>
          </div>
        )}
      </div>
    </div>
  );
}
