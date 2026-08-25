import { useEffect } from 'react';
import type { ReactNode } from 'react';

/**
 * Modal · overlay bloqueante para acciones puntuales.
 *
 * En DESKTOP se centra sobre la página. En MÓVIL se transforma en
 * bottom sheet automáticamente (safe-area, tirador, esquinas superiores
 * redondeadas) — el mismo componente para ambos, coherente con el
 * principio 11 (mobile no es "desktop responsive").
 *
 * Uso:
 *   <Modal open={open} onClose={close} title="Nuevo objetivo">
 *     …contenido…
 *     <Modal.Footer>
 *       <Button variant="ghost" onClick={close}>Cancelar</Button>
 *       <Button variant="primary" onClick={save}>Guardar</Button>
 *     </Modal.Footer>
 *   </Modal>
 *
 * Tamaños:
 *   sm  · confirmación, alerta                         (max-w-sm 400px)
 *   md  · default: form corto, decisión                (max-w-md 480px)
 *   lg  · asistente multi-paso, listado de opciones    (max-w-lg 620px)
 *
 * Este componente NO reimplementa BottomSheet; convive con él.
 * BottomSheet legacy sigue funcionando y sirve cuando quieres FORZAR
 * sheet en desktop también (p.ej. formulario largo de la app). Modal
 * es la elección default cuando quieres "diálogo en desktop,
 * sheet en mobile".
 */

type ModalSize = 'sm' | 'md' | 'lg';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: ModalSize;
  children: ReactNode;
  /** Contenido fijo al pie (fuera del scroll). Usar Modal.Footer. */
  footer?: ReactNode;
  /** Cerrar al pulsar el fondo. Default true; false en flujos que exigen
   *  confirmación explícita (ej. destructivos, guardado en curso). */
  closeOnOverlay?: boolean;
  /** aria-label del botón cerrar. Si se omite, se usa "Close" (i18n en
   *  consumidor si aplica; el DS no importa i18n). */
  closeLabel?: string;
}

const SIZE: Record<ModalSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
};

function Modal({ open, onClose, title, size = 'md', children, footer, closeOnOverlay = true, closeLabel = 'Close' }: Props) {
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
      className="fixed inset-0 z-[var(--rk-z-modal)] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (closeOnOverlay && e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Dialog'}
    >
      {/* Scrim */}
      <div className="absolute inset-0 bg-[var(--rk-surface-scrim)]" />
      {/* Panel */}
      <div
        className={[
          'relative w-full flex flex-col',
          'bg-[var(--rk-surface-feature)] border border-[var(--rk-border-strong)]',
          'shadow-[var(--rk-shadow-xl)]',
          'max-h-[92svh]',
          // Mobile: sheet
          'rounded-t-[var(--rk-radius-2xl)]',
          // Desktop: modal
          'sm:rounded-[var(--rk-radius-xl)]',
          SIZE[size],
        ].join(' ')}
      >
        {/* Tirador (solo mobile) */}
        <div aria-hidden className="sm:hidden flex justify-center pt-2.5">
          <span className="block w-10 h-1 rounded-full bg-white/15" />
        </div>
        {/* Cabecera */}
        {(title || onClose) && (
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
            {title ? (
              <h3 className="text-[16px] font-bold text-[var(--rk-text-primary)] tracking-wide truncate">{title}</h3>
            ) : <span />}
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-[var(--rk-radius-sm)] text-[var(--rk-text-quiet)] hover:text-[var(--rk-text-primary)] hover:bg-white/[0.05] cursor-pointer transition-colors rk-ds-focus-ring"
            >
              <i className="ri-close-line" aria-hidden />
            </button>
          </div>
        )}
        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 min-h-0">{children}</div>
        {/* Pie */}
        {footer && (
          <div
            className="flex-shrink-0 px-5 pt-3 border-t border-[var(--rk-border-quiet)]"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Botones al pie de un Modal — flex row alineados a la derecha en desktop,
 *  columna en mobile (stack). El primero se lee como "cancelar",
 *  el último como "acción principal". */
Modal.Footer = function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="flex flex-col sm:flex-row sm:justify-end gap-2">{children}</div>;
};

export default Modal;
