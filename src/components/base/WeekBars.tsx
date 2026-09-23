import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WeekBarDay } from './weekBarsData';

// Tira de los últimos 7 días en barras.
//
// Da de un vistazo lo que ninguna cifra suelta da: si esta semana has ido
// entrenando o comiendo de forma constante, o si llevas tres días parado. Se
// dibuja con divs, no con una librería de gráficos: son siete barras y meter
// Recharts aquí sería pagar 40 KB por nada.
//
// SIEMPRE datos reales. Un día sin dato se pinta como hueco, no como cero
// inventado: no es lo mismo "ese día comí 0 kcal" que "ese día no apunté nada".
//
// ── EL NÚMERO, TAMBIÉN EN EL MÓVIL ──
//
// El valor de cada barra solo salía en el `title`, que es lo que enseña el
// navegador al pasar el ratón por encima. En el móvil no hay ratón: las barras
// se veían y el número no había forma de leerlo. Ahora cada barra se puede
// tocar, y debajo sale el valor del día elegido junto a la media de la semana.

// El tipo y el cálculo viven en `weekBarsData`: son datos, no pintura, y un
// fichero que exporta componentes Y funciones rompe el refresco en caliente.
// Se re-exporta el tipo para no obligar a nadie a importar de dos sitios.
export type { WeekBarDay } from './weekBarsData';

interface Props {
  days: WeekBarDay[];
  /** Color de las barras con dato. */
  color?: string;
  /** Sufijo del valor en el pie ("kcal", "min"...). */
  unit?: string;
  /** Altura de la zona de barras. */
  height?: number;
  /** Texto bajo el título cuando no hay ni un solo dato. */
  emptyLabel?: string;
}

export default function WeekBars({ days, color = 'var(--accent)', unit, height = 64, emptyLabel }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const values = days.map((d) => d.value).filter((v): v is number => v != null);
  const max = values.length > 0 ? Math.max(...values) : 0;
  const todayISO = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  // Por defecto, hoy si tiene dato; si no, el último día que lo tenga.
  const porDefecto = [...days].reverse().find((d) => d.value != null)?.iso ?? null;
  const [sel, setSel] = useState<string | null>(null);
  const elegido = days.find((d) => d.iso === (sel ?? porDefecto)) || null;

  if (values.length === 0) {
    return (
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--t-3)' }}>
        {emptyLabel || t('mc_wb_empty')}
      </p>
    );
  }

  const fmt = (n: number) => `${Math.round(n).toLocaleString(locale)}${unit ? ` ${unit}` : ''}`;
  const media = values.reduce((a, b) => a + b, 0) / values.length;
  const nombreDia = (iso: string) => {
    if (iso === todayISO) return t('mc_wb_today');
    const s = new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { weekday: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {days.map((d) => {
          const isToday = d.iso === todayISO;
          const isSel = elegido?.iso === d.iso;
          // Mínimo visible del 6%: una barra de valor bajo tiene que verse,
          // pero un día SIN dato no dibuja barra en absoluto.
          const pct = d.value == null ? 0 : Math.max(6, max > 0 ? (d.value / max) * 100 : 0);
          return (
            <button key={d.iso} type="button" onClick={() => setSel(d.iso)}
              aria-pressed={isSel}
              aria-label={`${nombreDia(d.iso)}: ${d.value == null ? t('mc_wb_no_data') : fmt(d.value)}`}
              className="flex-1 flex flex-col justify-end h-full cursor-pointer">
              <div
                style={{
                  height: `${pct}%`,
                  minHeight: d.value == null ? 3 : undefined,
                  borderRadius: 4,
                  background: d.value == null ? 'var(--s-3)' : color,
                  opacity: d.value == null ? 1 : isSel ? 1 : 0.55,
                  boxShadow: isSel && d.value != null ? '0 0 0 1.5px rgba(255,255,255,0.7)' : undefined,
                  transition: 'opacity 160ms ease, box-shadow 160ms ease',
                }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {days.map((d) => {
          const isToday = d.iso === todayISO;
          const isSel = elegido?.iso === d.iso;
          return (
            <span key={d.iso} className="flex-1 text-center text-[10px] font-bold uppercase"
              style={{ color: isSel || isToday ? 'var(--t-1)' : 'var(--t-3)' }}>
              {new Date(`${d.iso}T12:00:00`).toLocaleDateString(locale, { weekday: 'narrow' })}
            </span>
          );
        })}
      </div>
      {/* El pie: el día elegido a la izquierda, la media a la derecha. */}
      <div className="flex items-baseline justify-between gap-3 mt-3 pt-2.5" style={{ borderTop: '1px solid var(--s-3)' }}>
        {elegido && (
          <p className="text-xs min-w-0 truncate" style={{ color: 'var(--t-2)' }}>
            {nombreDia(elegido.iso)}
            <span className="font-bold ml-1.5" style={{ color: 'var(--t-1)' }}>
              {elegido.value == null ? t('mc_wb_no_data') : fmt(elegido.value)}
            </span>
          </p>
        )}
        <p className="text-xs flex-shrink-0" style={{ color: 'var(--t-3)' }}>
          {t('mc_wb_avg', { n: fmt(media) })}
        </p>
      </div>
    </div>
  );
}
