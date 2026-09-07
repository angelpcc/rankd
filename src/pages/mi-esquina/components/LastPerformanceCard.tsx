import { useTranslation } from 'react-i18next';
import type { LastPerformance, Suggestion } from '../lib/lastPerformance';
import type { TrackingMode } from '../lib/exercises';

// Tarjeta "cómo fue la última vez" dentro de un ejercicio del formulario de
// fuerza. Muestra la última sesión, la mejor marca, la nota que dejaste y una
// sugerencia que solo PRE-RELLENA campos editables. Nada aquí es prescriptivo.

interface Props {
  perf: LastPerformance;
  suggestion: Suggestion;
  tracking: TrackingMode;
  /** Pone las series de la última vez tal cual. */
  onRepeat: () => void;
  /** Pone las series con la carga siguiente propuesta. */
  onStepUp: () => void;
}

export default function LastPerformanceCard({ perf, suggestion, tracking, onRepeat, onStepUp }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const ago = perf.daysAgo <= 0
    ? t('mc_str_today')
    : perf.daysAgo === 1
      ? t('mc_str_yesterday')
      : t('mc_str_days_ago', { n: perf.daysAgo });

  const unit = tracking === 'time' ? ` ${t('mc_str_unit_sec')}` : tracking === 'distance' ? ` ${t('mc_str_unit_m')}` : '';
  const detail = `${suggestion.lastSetCount}×${suggestion.lastRepsLabel}${unit}${suggestion.lastWeight > 0 ? ` · ${suggestion.lastWeight} kg` : ''}`;

  // La mejor marca solo aporta si supera lo que hiciste la última vez.
  const showBest = perf.bestWeight > 0 && perf.bestWeight > suggestion.lastWeight;

  const fmtDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  return (
    <div
      className="mt-2"
      style={{ background: 'var(--s-2)', border: '1px solid var(--s-3)', borderRadius: 'var(--r-cta)', padding: '10px 12px' }}
    >
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <p className="rk-label" style={{ color: 'var(--t-2)' }}>{t('mc_lp_last')}</p>
        <p className="text-[11px]" style={{ color: 'var(--t-3)' }}>{ago} · {fmtDate(perf.lastDate)}</p>
      </div>
      <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--t-1)' }}>{detail}</p>

      {showBest && (
        <p className="text-[11px] mt-1.5 flex items-center gap-1.5" style={{ color: 'var(--t-2)' }}>
          <i className="ri-trophy-line" style={{ color: 'var(--accent)' }} />
          {t('mc_lp_best')}: <strong style={{ color: 'var(--t-1)' }}>{perf.bestWeight} kg</strong>
          {perf.bestWeightDate && <span style={{ color: 'var(--t-3)' }}>({fmtDate(perf.bestWeightDate)})</span>}
        </p>
      )}

      {perf.note && (
        <p className="text-[11px] mt-1.5 leading-snug" style={{ color: 'var(--t-2)' }}>
          <i className="ri-sticky-note-line mr-1" style={{ color: 'var(--t-3)' }} />
          <span style={{ fontStyle: 'italic' }}>{perf.note}</span>
        </p>
      )}

      <p className="text-[11px] mt-2 leading-snug" style={{ color: 'var(--t-2)' }}>
        {suggestion.stepUp && suggestion.nextWeight !== null
          ? t('mc_lp_hint_step', { detail, next: suggestion.nextWeight })
          : t('mc_lp_hint_repeat', { detail })}
      </p>

      <div className="flex gap-2 mt-2">
        <button type="button" onClick={onRepeat} style={{ minHeight: 36, padding: '0 12px' }}
          className="rk-nav-btn text-xs font-bold inline-flex items-center gap-1.5">
          <i className="ri-repeat-line" /> {t('mc_lp_repeat')}
        </button>
        {suggestion.stepUp && suggestion.nextWeight !== null && (
          <button type="button" onClick={onStepUp} style={{ minHeight: 36, padding: '0 12px' }}
            className="rk-nav-btn text-xs font-bold inline-flex items-center gap-1.5">
            <i className="ri-arrow-up-line" /> {t('mc_lp_try', { w: suggestion.nextWeight })}
          </button>
        )}
      </div>
    </div>
  );
}
