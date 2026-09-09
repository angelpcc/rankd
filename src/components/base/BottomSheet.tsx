import { useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  // PORTAL a <body>, no en el sitio donde se declara.
  //
  // `position: fixed` deja de medirse contra la pantalla en cuanto un ancestro
  // tiene `transform`, `filter` o `perspective` — y en Mi Esquina los hay por
  // todas partes (.rk-press, .rk-lift, las animaciones de entrada). El
  // resultado era una hoja dibujada cientos de píxeles por debajo del área
  // visible: parecía que el formulario "se quedaba enganchado" y el botón de
  // guardar no se alcanzaba nunca. Colgando de <body> no hay ancestro que
  // pueda capturarla.
  return createPortal((
    <div
      className="fixed inset-x-0 top-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      // `100dvh`, no `100vh`: en el móvil `vh` cuenta la barra del navegador
      // aunque esté visible, así que el pie de la hoja (donde vive el botón de
      // guardar) quedaba POR DEBAJO de la pantalla y parecía que el formulario
      // se quedaba colgado. `dvh` sigue a la altura real visible.
      style={{ height: '100vh', maxHeight: '100dvh' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
      <div
        className="relative w-full sm:max-w-md flex flex-col bg-[#0c0c0c] border border-white/[0.1] rounded-t-3xl sm:rounded-3xl anim-scale-in"
        style={{ boxShadow: '0 32px 90px rgba(0,0,0,0.8)', maxHeight: '92%' }}
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
  ), document.body);
}
