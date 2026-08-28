import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SegmentedProgress from '@/components/base/SegmentedProgress';

interface Props {
  /** Fechas ISO (YYYY-MM-DD) con actividad registrada. */
  activeDates: Set<string>;
  /** Entrenos completados esta semana y objetivo. */
  done: number;
  total: number;
  onDayClick?: (iso: string) => void;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Tira de 7 días de la semana en curso (L→D). Hoy va en círculo punteado rojo;
 * los días pasados con actividad llevan un punto rojo debajo. Debajo, una línea
 * con el progreso de la semana en segmentos. Solo presentación.
 */
export default function WeekStrip({ activeDates, done, total, onDayClick }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const days = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const dow = now.getDay() === 0 ? 6 : now.getDay() - 1; // lunes = 0
    const monday = new Date(now); monday.setDate(now.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      return d;
    });
  }, []);

  const todayISO = iso(new Date());

  return (
    <div>
      <div className="flex items-start justify-between gap-1">
        {days.map((d) => {
          const dISO = iso(d);
          const isToday = dISO === todayISO;
          const isPast = dISO < todayISO;
          const active = activeDates.has(dISO);
          const numColor = isToday
            ? 'var(--accent)'
            : active
              ? 'var(--t-1)'
              : isPast
                ? 'var(--t-3)'
                : 'var(--t-2)';
          return (
            <button
              key={dISO}
              onClick={onDayClick ? () => onDayClick(dISO) : undefined}
              className={`flex flex-col items-center gap-1.5 flex-1 min-w-0 ${onDayClick ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t-3)' }}>
                {d.toLocaleDateString(locale, { weekday: 'narrow' })}
              </span>
              <span
                className="flex items-center justify-center"
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 18,
                  lineHeight: 1,
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  color: numColor,
                  border: isToday ? '2px dashed var(--accent)' : '2px solid transparent',
                }}
              >
                {d.getDate()}
              </span>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: isPast && active ? 'var(--accent)' : 'transparent' }} />
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        <p className="mb-1.5" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--t-2)' }}>
          {t('mc_week_completed', { done, total })}
        </p>
        <SegmentedProgress total={total} done={done} />
      </div>
    </div>
  );
}
