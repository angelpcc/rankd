import { useState } from 'react';

// Barra lateral agrupada en acordeón (R15-B1). En vez de una lista larga de
// opciones sueltas, las secciones se agrupan por categorías que se despliegan:
// el usuario abre una categoría, ve las 2-3 funciones relacionadas y la cierra
// para volver a la vista limpia. Se usa en los dashboards de organización, marca
// y en el espacio del entrenador.
//
// v4: el mismo lenguaje que el menú de Mi Esquina (.rk-side-item): cada opción
// con su icono en una baldosa del color de la cuenta y la activa marcada con
// una barra a la izquierda y la baldosa rellena, en lugar de un bloque rojo o
// dorado entero. Así los paneles y Mi Esquina se ven como una sola app.

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

const HEX = { red: '#E10600', gold: '#C9A84C' } as const;
const tinte = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export default function DashSideNav({ topItem, groups, activeId, onSelect, accent = 'red' }: Props) {
  // Por defecto se abre solo el grupo que contiene la sección activa.
  const activeGroup = groups.find((g) => g.items.some((i) => i.id === activeId))?.key;
  const [open, setOpen] = useState<string | null>(activeGroup ?? null);
  const c = HEX[accent];

  const badge = (n: number, on: boolean) => (
    <span className="text-[11px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0"
      style={{ background: on ? tinte(c, 0.3) : tinte(c, 0.16), color: on ? '#fff' : c }}>{n}</span>
  );

  const itemBtn = (it: DashNavItem, nested: boolean) => {
    const on = activeId === it.id;
    return (
      <button key={it.id} onClick={() => onSelect(it.id)} aria-current={on ? 'page' : undefined}
        className={`rk-side-item rk-press ${nested ? 'pl-5' : ''}`} style={{ ['--sec' as string]: c }}>
        <span className="rk-side-icon" style={{ width: nested ? 28 : 32, height: nested ? 28 : 32, background: on ? c : tinte(c, 0.1), color: on ? '#0A0A0B' : c }}>
          <i className={it.icon} />
        </span>
        <span className="flex-1 min-w-0 truncate">{it.label}</span>
        {it.badge ? badge(it.badge, on) : null}
      </button>
    );
  };

  return (
    <nav className="flex-1 p-3 space-y-0.5">
      {topItem && itemBtn(topItem, false)}
      {groups.map((g) => {
        const isOpen = open === g.key;
        const hasActive = g.items.some((i) => i.id === activeId);
        const groupBadge = g.items.reduce((a, i) => a + (i.badge || 0), 0);
        return (
          <div key={g.key} className="pt-1">
            <button onClick={() => setOpen(isOpen ? null : g.key)} aria-expanded={isOpen}
              className="rk-side-item rk-press" style={{ color: hasActive || isOpen ? '#fff' : undefined, fontWeight: 600 }}>
              <span className="rk-side-icon" style={{ background: 'rgba(255,255,255,0.05)', color: hasActive ? c : 'var(--t-2)' }}>
                <i className={g.icon} />
              </span>
              <span className="flex-1 min-w-0 truncate">{g.label}</span>
              {groupBadge > 0 && !isOpen && badge(groupBadge, false)}
              <i className={`ri-arrow-down-s-line flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--t-3)' }}></i>
            </button>
            {isOpen && <div className="mt-0.5 space-y-0.5">{g.items.map((it) => itemBtn(it, true))}</div>}
          </div>
        );
      })}
    </nav>
  );
}
