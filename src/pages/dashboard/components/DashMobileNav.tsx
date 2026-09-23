import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// Barra de navegación inferior para móvil de los dashboards (R16).
//
// Antes la barra mostraba solo las primeras 4-5 pestañas con tabs.slice(),
// dejando el resto de secciones INALCANZABLES en móvil (p. ej. el acceso al
// espacio de entrenador del gimnasio, o el perfil de la promotora). Ahora
// muestra unas pocas en línea y un botón "Más" que abre una hoja con TODAS las
// secciones, así nunca queda ninguna escondida. Como RANKD se usa sobre todo
// desde el móvil, esto es clave.

export interface MobileNavTab { id: string; label: string; icon: string; badge?: number }

interface Props {
  tabs: MobileNavTab[];
  activeId: string;
  onSelect: (id: string) => void;
  accent?: 'red' | 'gold';
  /** Cuántas pestañas mostrar en línea antes del botón "Más". */
  inlineCount?: number;
}

export default function DashMobileNav({ tabs, activeId, onSelect, accent = 'red', inlineCount = 4 }: Props) {
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);

  const activeText = accent === 'gold' ? 'text-[#C9A84C]' : 'text-red-400';
  // Fondo de la pestaña activa y color del punto de arriba. Mismo lenguaje
  // que la barra de Mi Esquina: el mismo gesto tiene que verse igual en
  // toda la app, sea peleador, marca o promotora.
  const activeBg = accent === 'gold' ? 'rgba(201,168,76,0.14)' : 'rgba(225,6,0,0.14)';
  const dotColor = accent === 'gold' ? '#C9A84C' : 'var(--accent)';
  const badgeBg = accent === 'gold' ? 'bg-[#C9A84C] text-zinc-950' : 'bg-red-600 text-white';
  const sheetActive = accent === 'gold'
    ? 'bg-[#C9A84C]/15 border-[#C9A84C]/40 text-[#C9A84C]'
    : 'bg-red-600/15 border-red-500/40 text-red-400';

  // Si caben todas en línea (+1 hueco de sobra), no hace falta el botón "Más".
  const needsMore = tabs.length > inlineCount + 1;
  const inline = needsMore ? tabs.slice(0, inlineCount) : tabs;
  const overflow = needsMore ? tabs.slice(inlineCount) : [];
  const overflowActive = overflow.some((tb) => tb.id === activeId);
  const overflowBadge = overflow.reduce((a, tb) => a + (tb.badge || 0), 0);

  const pick = (id: string) => { onSelect(id); setSheetOpen(false); };

  const slot = (tab: MobileNavTab) => (
    <button
      key={tab.id}
      onClick={() => onSelect(tab.id)}
      aria-current={activeId === tab.id ? 'page' : undefined}
      // La activa solo cambiaba el color de la letra: en una barra con cinco
      // iconos iguales de tamaño, no se sabía dónde estabas sin leer. Ahora
      // lleva fondo y el punto arriba, como en Mi Esquina.
      style={{ minHeight: 52, background: activeId === tab.id ? activeBg : 'transparent' }}
      className={`rk-press rk-nav-tab flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 px-1 mx-0.5 my-1 rounded-xl text-[10px] cursor-pointer relative ${activeId === tab.id ? `${activeText} font-bold` : 'text-zinc-500 font-medium'}`}
    >
      {activeId === tab.id && <span aria-hidden className="rk-nav-tab-dot" style={{ background: dotColor, boxShadow: `0 0 8px ${dotColor}` }} />}
      <i className={`${tab.icon} text-lg`}></i>
      <span className="truncate max-w-full leading-tight">{tab.label}</span>
      {tab.badge !== undefined && tab.badge > 0 && (
        <span className={`absolute top-1 right-[22%] min-w-4 h-4 px-1 ${badgeBg} text-[10px] rounded-full flex items-center justify-center font-bold`}>
          {tab.badge > 9 ? '9+' : tab.badge}
        </span>
      )}
    </button>
  );

  return (
    <>
      {/* Hoja de secciones */}
      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSheetOpen(false)} />
          <div className="relative bg-zinc-950 border-t border-white/10 rounded-t-3xl px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] anim-fade-up max-h-[75vh] overflow-y-auto">
            <div className="w-10 h-1 rounded-full bg-zinc-700 mx-auto mb-4" />
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-xs font-bold tracking-[0.18em] uppercase text-zinc-500">{t('dash_more_title')}</p>
              <button onClick={() => setSheetOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white cursor-pointer">
                <i className="ri-close-line text-xl" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => pick(tab.id)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-4 px-2 rounded-2xl border text-center cursor-pointer transition-colors relative ${activeId === tab.id ? sheetActive : 'bg-white/[0.03] border-white/10 text-zinc-300 hover:text-white hover:border-white/25'}`}
                >
                  <i className={`${tab.icon} text-xl`} />
                  <span className="text-[11px] font-semibold leading-tight">{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`absolute top-2 right-2 min-w-4 h-4 px-1 ${badgeBg} text-[10px] rounded-full flex items-center justify-center font-bold`}>
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Barra inferior */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur border-t border-white/10 flex rk-safe-bottom">
        {inline.map(slot)}
        {needsMore && (
          <button
            onClick={() => setSheetOpen(true)}
            style={{ minHeight: 52, background: overflowActive ? activeBg : 'transparent' }}
            className={`rk-press rk-nav-tab flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 px-1 mx-0.5 my-1 rounded-xl text-[10px] cursor-pointer relative ${overflowActive ? `${activeText} font-bold` : 'text-zinc-500 font-medium'}`}
          >
            <i className="ri-menu-line text-lg" />
            <span className="truncate max-w-full leading-tight">{t('dash_more')}</span>
            {overflowBadge > 0 && (
              <span className={`absolute top-1 right-[22%] min-w-4 h-4 px-1 ${badgeBg} text-[10px] rounded-full flex items-center justify-center font-bold`}>
                {overflowBadge > 9 ? '9+' : overflowBadge}
              </span>
            )}
          </button>
        )}
      </div>
    </>
  );
}
