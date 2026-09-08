import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import CountUp from '@/components/base/CountUp';

// Racha en forma de fila de marcas, no de número suelto. Cada día encendido se
// ilumina con un pequeño retardo respecto al anterior, así que la racha se lee
// como algo que se ha ido construyendo.
//
// La marca de "hoy" lleva borde punteado aunque no esté encendida: es la que
// falta por ganar.

interface Props {
  /** Fechas ISO con algo registrado. */
  activeDates: Set<string>;
  /** Racha viva en días, ya calculada por quien lo monta. */
  streak: number;
  /** Cuántos días mostrar hacia atrás. */
  days?: number;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function StreakRow({ activeDates, streak, days = 14 }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const cells = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(today); d.setDate(today.getDate() - (days - 1 - i));
      const key = iso(d);
      return { key, date: d, active: activeDates.has(key), isToday: i === days - 1 };
    });
  }, [activeDates, days]);

  return (
    <div className="rk-card" style={{ padding: 18 }}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="rk-label" style={{ color: 'var(--t-2)' }}>{t('mc_streak_row_title')}</p>
        <p className="flex items-baseline gap-1.5">
          <i className="ri-fire-fill" style={{ color: streak > 0 ? 'var(--accent)' : 'var(--t-3)', fontSize: 16 }} />
          <CountUp value={streak} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: 'var(--t-1)', lineHeight: 1 }} />
          <span className="text-xs" style={{ color: 'var(--t-3)' }}>
            {t(streak === 1 ? 'mc_metric_day' : 'mc_metric_days')}
          </span>
        </p>
      </div>

      <div className="flex items-end gap-1 mt-3.5" role="img" aria-label={t('mc_streak_row_aria', { n: streak, d: days })}>
        {cells.map((c, i) => (
          <div key={c.key} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span
              className={c.active ? 'rk-pop' : undefined}
              style={{
                width: '100%', height: 26, borderRadius: 5,
                background: c.active ? 'var(--accent)' : 'var(--s-2)',
                border: c.isToday && !c.active ? '1.5px dashed var(--accent)' : '1px solid var(--s-3)',
                animationDelay: `${i * 45}ms`,
              }}
            />
            {/* Solo se etiquetan algunos días: 14 números seguidos no se leen */}
            <span style={{ fontSize: 9, color: 'var(--t-3)', lineHeight: 1 }}>
              {i === 0 || c.isToday || i === Math.floor(days / 2)
                ? c.date.toLocaleDateString(locale, { day: 'numeric' })
                : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
