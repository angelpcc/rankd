import { useTranslation } from 'react-i18next';

// Tira de los últimos 7 días en barras.
//
// Da de un vistazo lo que ninguna cifra suelta da: si esta semana has ido
// entrenando o comiendo de forma constante, o si llevas tres días parado. Se
// dibuja con divs, no con una librería de gráficos: son siete barras y meter
// Recharts aquí sería pagar 40 KB por nada.
//
// SIEMPRE datos reales. Un día sin dato se pinta como hueco, no como cero
// inventado: no es lo mismo "ese día comí 0 kcal" que "ese día no apunté nada".

export interface WeekBarDay {
  /** YYYY-MM-DD */
  iso: string;
  /** Valor del día. null = ese día no hay dato (hueco, no cero). */
  value: number | null;
}

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

const DAY_INITIALS_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Últimos 7 días terminando HOY, con el valor que le corresponda a cada uno. */
export function last7Days(valueByISO: Map<string, number>): WeekBarDay[] {
  const out: WeekBarDay[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push({ iso, value: valueByISO.has(iso) ? valueByISO.get(iso)! : null });
  }
  return out;
}

export default function WeekBars({ days, color = 'var(--accent)', unit, height = 64, emptyLabel }: Props) {
  const { t } = useTranslation();
  const values = days.map((d) => d.value).filter((v): v is number => v != null);
  const max = values.length > 0 ? Math.max(...values) : 0;
  const todayISO = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  if (values.length === 0) {
    return (
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--t-3)' }}>
        {emptyLabel || t('mc_wb_empty')}
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {days.map((d) => {
          const isToday = d.iso === todayISO;
          // Mínimo visible del 6%: una barra de valor bajo tiene que verse,
          // pero un día SIN dato no dibuja barra en absoluto.
          const pct = d.value == null ? 0 : Math.max(6, max > 0 ? (d.value / max) * 100 : 0);
          return (
            <div key={d.iso} className="flex-1 flex flex-col justify-end h-full">
              <div
                title={d.value == null ? undefined : `${Math.round(d.value)}${unit ? ` ${unit}` : ''}`}
                style={{
                  height: `${pct}%`,
                  minHeight: d.value == null ? 3 : undefined,
                  borderRadius: 4,
                  background: d.value == null ? 'var(--s-3)' : color,
                  opacity: d.value == null ? 1 : isToday ? 1 : 0.72,
                  border: isToday && d.value != null ? '1px solid rgba(255,255,255,0.5)' : undefined,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {days.map((d) => {
          const isToday = d.iso === todayISO;
          const dow = new Date(`${d.iso}T12:00:00`).getDay();
          const idx = dow === 0 ? 6 : dow - 1;
          return (
            <span key={d.iso} className="flex-1 text-center text-[10px] font-bold"
              style={{ color: isToday ? 'var(--t-1)' : 'var(--t-3)' }}>
              {DAY_INITIALS_ES[idx]}
            </span>
          );
        })}
      </div>
    </div>
  );
}
