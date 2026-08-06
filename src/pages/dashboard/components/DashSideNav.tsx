import { useState } from 'react';

// Barra lateral agrupada en acordeón (R15-B1). En vez de una lista larga de
// opciones sueltas, las secciones se agrupan por categorías que se despliegan:
// el usuario abre una categoría, ve las 2-3 funciones relacionadas y la cierra
// para volver a la vista limpia. Se usa en los dashboards de organización, marca
// y en el espacio del entrenador.

export interface DashNavItem { id: string; label: string; icon: string; badge?: number }
export interface DashNavGroup { key: string; label: string; icon: string; items: DashNavItem[] }

interface Props {
  /** Elemento suelto siempre visible (ej. Resumen). */
  topItem?: DashNavItem;
  groups: DashNavGroup[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Color de acento del elemento activo (rojo por defecto, dorado para marca). */
  accent?: 'red' | 'gold';
}

export default function DashSideNav({ topItem, groups, activeId, onSelect, accent = 'red' }: Props) {
  // Por defecto se abre solo el grupo que contiene la sección activa.
  const activeGroup = groups.find((g) => g.items.some((i) => i.id === activeId))?.key;
  const [open, setOpen] = useState<string | null>(activeGroup ?? null);

  const activeCls = accent === 'gold'
    ? 'bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/35'
    : 'bg-red-600 text-white';
  const badgeCls = accent === 'gold' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'bg-red-600/20 text-red-400';

  const itemBtn = (it: DashNavItem, nested: boolean) => (
    <button key={it.id} onClick={() => onSelect(it.id)}
      className={`w-full flex items-center gap-3 ${nested ? 'pl-9 pr-3' : 'px-3'} py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer text-left ${activeId === it.id ? activeCls : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
      <i className={`${it.icon} text-base flex-shrink-0`}></i>
      <span className="flex-1 min-w-0 truncate">{it.label}</span>
      {it.badge ? (
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${activeId === it.id ? 'bg-white/20 text-current' : badgeCls}`}>{it.badge}</span>
      ) : null}
    </button>
  );

  return (
    <nav className="flex-1 p-3 space-y-1">
      {topItem && itemBtn(topItem, false)}
      {groups.map((g) => {
        const isOpen = open === g.key;
        const hasActive = g.items.some((i) => i.id === activeId);
        const groupBadge = g.items.reduce((a, i) => a + (i.badge || 0), 0);
        return (
          <div key={g.key}>
            <button onClick={() => setOpen(isOpen ? null : g.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer text-left ${hasActive && !isOpen ? 'text-white bg-zinc-800/60' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'}`}>
              <i className={`${g.icon} text-base flex-shrink-0`}></i>
              <span className="flex-1 min-w-0 truncate">{g.label}</span>
              {groupBadge > 0 && !isOpen && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${badgeCls}`}>{groupBadge}</span>
              )}
              <i className={`ri-arrow-down-s-line text-zinc-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
            </button>
            {isOpen && <div className="mt-1 space-y-1">{g.items.map((it) => itemBtn(it, true))}</div>}
          </div>
        );
      })}
    </nav>
  );
}
