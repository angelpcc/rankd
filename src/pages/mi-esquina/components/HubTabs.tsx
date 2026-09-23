import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface HubTab {
  id: string;
  labelKey: string;
  icon: string;
}

interface Props {
  tabs: HubTab[];
  active: string;
  onChange: (id: string) => void;
  /**
   * Color de la sección (lib/sectionTheme.ts) para el icono de la pestaña
   * activa. Sin él, blanco.
   */
  color?: string;
}

/**
 * Barra de pestañas compartida por los "hubs" de Mi Esquina (Agenda, Fuerza,
 * Nutrición, Asesor, Ring). Control segmentado; en móvil hace scroll
 * horizontal.
 *
 * ── v4: LA ACTIVA YA NO ES UN BLOQUE ROJO ──
 *
 * Con la pestaña activa en rojo sólido había en la misma pantalla tres o cuatro
 * cosas rojas —menú, pestaña, botón, aviso— y el ojo no sabía cuál era la
 * acción. Ahora la activa se ilumina (fondo claro, texto blanco, icono en el
 * color de la sección) y el rojo queda para el botón que hace algo.
 */
export default function HubTabs({ tabs, active, onChange, color }: Props) {
  const { t } = useTranslation();
  const activaRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activaRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [active]);

  const fade =
    'linear-gradient(to right, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%)';
  return (
    <div
      className="overflow-x-auto rk-noscroll-x -mx-1 px-1 mb-6"
      style={{ WebkitMaskImage: fade, maskImage: fade }}
    >
      <div role="tablist" className="inline-flex gap-1 p-1 rounded-2xl min-w-max"
        style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid var(--line)' }}>
        {tabs.map((tab) => {
          const on = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={on ? activaRef : undefined}
              role="tab"
              aria-selected={on}
              onClick={() => onChange(tab.id)}
              style={{
                minHeight: 42,
                background: on ? 'rgba(255,255,255,0.1)' : 'transparent',
                boxShadow: on ? 'inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 3px rgba(0,0,0,0.4)' : undefined,
              }}
              className={`rk-press flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-all cursor-pointer ${
                on ? 'text-white font-semibold' : 'text-zinc-400 font-medium hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <i className={`${tab.icon} text-base`} style={{ color: on ? (color || '#fff') : undefined }}></i>
              <span>{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
