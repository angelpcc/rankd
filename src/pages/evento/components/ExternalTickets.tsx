import { useTranslation } from 'react-i18next';
import type { OrgEvent } from '@/lib/supabase';

interface Props {
  event: OrgEvent;
  isPast: boolean;
}

/**
 * Entradas del evento.
 *
 * De momento RANKD no vende entradas: cada promotora enlaza a su propia web,
 * donde ya las vende. El flujo de compra interno (event_tickets) sigue
 * construido en el repositorio pero desconectado de la interfaz, por si algún
 * día se decide activarlo.
 */
export default function ExternalTickets({ event, isPast }: Props) {
  const { t } = useTranslation();
  const url = (event.external_link || '').trim();

  // Evento pasado: no tiene sentido mandar a comprar
  if (isPast) {
    return (
      <div className="rk-card" style={{ padding: '22px 24px', transform: 'none' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-white/[0.05] border border-white/10 text-zinc-500">
            <i className="ri-time-line text-lg"></i>
          </div>
          <div>
            <p className="text-sm font-bold text-white">{t('ev_finished')}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{t('ev_finished_desc')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Sin enlace: se dice claramente que aún no están a la venta
  if (!url) {
    return (
      <div className="rk-card" style={{ padding: '22px 24px', transform: 'none' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-[#C9A84C]/12 border border-[#C9A84C]/30 text-[#C9A84C]">
            <i className="ri-ticket-2-line text-lg"></i>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">{t('ev_tickets_soon')}</p>
            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{t('ev_tickets_soon_desc')}</p>
          </div>
        </div>
      </div>
    );
  }

  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { host = ''; }

  return (
    <div className="rk-card relative overflow-hidden" style={{ padding: '22px 24px', transform: 'none', borderColor: 'rgba(225,6,0,0.28)' }}>
      <div className="rk-glow-red" style={{ width: 200, height: 200, top: -110, right: -60, borderRadius: '50%' }} />
      <div className="relative">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-red-600/12 border border-red-500/30 text-red-400">
            <i className="ri-ticket-2-line text-lg"></i>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">{t('ev_tickets_title')}</p>
            {host && <p className="text-xs text-zinc-500 truncate">{host}</p>}
          </div>
        </div>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2"
          style={{ fontSize: '0.9rem', padding: '0.95rem 1.2rem', textDecoration: 'none' }}
        >
          {t('ev_tickets_cta')} <i className="ri-external-link-line"></i>
        </a>

        <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed flex items-start gap-1.5">
          <i className="ri-information-line mt-0.5 flex-shrink-0"></i>
          {t('ev_tickets_external_note')}
        </p>
      </div>
    </div>
  );
}
