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
  // Fade en los bordes: pista visual de que hay más pestañas al hacer scroll
  // horizontal en móvil. La máscara no afecta al layout ni a los toques.
  const fade =
    'linear-gradient(to right, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%)';
  return (
    <div
      className="overflow-x-auto -mx-1 px-1 mb-6"
      style={{ WebkitMaskImage: fade, maskImage: fade }}
    >
      <div className="inline-flex gap-1 p-1 rounded-2xl bg-zinc-900/70 border border-zinc-800 min-w-max">
        {tabs.map((tab) => {
          const on = tab.id === active;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
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
