import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Contenido fijo al pie (p.ej. el botón "Aplicar"/"Guardar"), separado del scroll. */
  footer?: React.ReactNode;
}

/**
 * Modal que sube desde abajo en móvil y se centra en desktop. Es el mismo
 * recipe que se repetía suelto en QuickRoutines/SupportModal/DashMobileNav
 * (overlay + rounded-t-3xl + safe-area-inset-bottom), extraído aquí para no
 * seguir duplicándolo. El `footer`, si se pasa, queda fuera del área con
 * scroll para que un botón de guardar/aplicar sea siempre alcanzable.
 */
export default function BottomSheet({ open, onClose, title, children, footer }: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
      <div
        className="relative w-full sm:max-w-md max-h-[90vh] flex flex-col bg-[#0c0c0c] border border-white/[0.1] rounded-t-3xl sm:rounded-3xl anim-scale-in"
        style={{ boxShadow: '0 32px 90px rgba(0,0,0,0.8)' }}
      >
        <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-4 flex-shrink-0">
          {title ? <h3 className="rk-h3" style={{ fontSize: '1.15rem', color: '#fff' }}>{title}</h3> : <span />}
          <button onClick={onClose} aria-label={t('mc_close')}
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-white/[0.05] border border-white/10 text-zinc-400 hover:text-white cursor-pointer transition-colors">
            <i className="ri-close-line"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
          {children}
        </div>

        {footer && (
          <div
            className="flex-shrink-0 px-6 pt-4 border-t border-white/[0.08] bg-[#0c0c0c]"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
