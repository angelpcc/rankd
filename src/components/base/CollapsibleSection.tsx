import { useId, useState } from 'react';

interface Props {
  /** Texto de la cabecera (se pinta en mayúsculas, estilo rk-label). */
  title: string;
  /** Nº opcional junto al título (p. ej. cuántos módulos hay dentro). */
  count?: number;
  /** Abierto de inicio. Por defecto cerrado. */
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Bloque plegable reutilizable. Cabecera táctil (48px) con chevron que gira;
 * el contenido se monta siempre pero se oculta con `hidden` para no perder
 * estado de los hijos al plegar. Accesible: aria-expanded + aria-controls.
 *
 * Se usa en el Resumen de Mi Esquina para bajar de nivel los módulos menos
 * urgentes ("Más de tu progreso") sin sacarlos de la pantalla.
 */
export default function CollapsibleSection({ title, count, defaultOpen = false, children, className = '' }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center gap-2 cursor-pointer"
        style={{ minHeight: 48, background: 'none', border: 'none', padding: 0 }}
      >
        <span className="rk-label" style={{ color: 'var(--t-2)' }}>{title}</span>
        {count != null && (
          <span
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700,
              minWidth: 18, height: 18, padding: '0 5px', borderRadius: 'var(--r-pill)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--s-2)', border: '1px solid var(--s-3)', color: 'var(--t-3)',
            }}
          >
            {count}
          </span>
        )}
        <span style={{ flex: 1, height: 1, background: 'var(--s-3)' }} />
        <i
          className="ri-arrow-down-s-line"
          style={{ fontSize: 20, color: 'var(--t-3)', transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      <div id={panelId} hidden={!open} className="rk-stack" style={{ marginTop: open ? 'var(--sp-4)' : 0 }}>
        {children}
      </div>
    </div>
  );
}
