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
}

/**
 * Barra de pestañas compartida por los "hubs" de Mi Esquina (Agenda, Progreso,
 * Ring). Un único control segmentado para que las secciones fusionadas se
 * naveguen sin ensuciar la barra lateral. En móvil hace scroll horizontal.
 */
export default function HubTabs({ tabs, active, onChange }: Props) {
  const { t } = useTranslation();
  const activaRef = useRef<HTMLButtonElement>(null);

  // La pestaña activa, siempre A LA VISTA.
  //
  // En el móvil la tira se desliza, y si llegabas a una pestaña desde un
  // enlace —"Planificar" desde un aviso, por ejemplo— podía quedarse fuera
  // de la pantalla. Estabas en ella sin verla marcada, y parecía que el
  // enlace te había llevado a otro sitio.
  //
  // `inline: 'nearest'` y no 'center': si ya se ve, no se mueve nada. Una
  // tira que salta sola cada vez que tocas una pestaña marea.
  useEffect(() => {
    activaRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [active]);

  // Fade en los bordes: pista visual de que hay más pestañas al hacer scroll
  // horizontal en móvil. La máscara no afecta al layout ni a los toques.
  const fade =
    'linear-gradient(to right, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%)';
  return (
    <div
      className="overflow-x-auto rk-noscroll-x -mx-1 px-1 mb-6"
      style={{ WebkitMaskImage: fade, maskImage: fade }}
    >
      <div role="tablist" className="inline-flex gap-1 p-1 rounded-2xl bg-zinc-900/70 border border-zinc-800 min-w-max">
        {tabs.map((tab) => {
          const on = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={on ? activaRef : undefined}
              role="tab"
              aria-selected={on}
              onClick={() => onChange(tab.id)}
              style={{ minHeight: 44 }}
              className={`rk-press flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                on
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'
              }`}
            >
              <i className={`${tab.icon} text-base`}></i>
              <span>{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
