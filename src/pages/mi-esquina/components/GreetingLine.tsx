import { useTranslation } from 'react-i18next';
import CountUp from '@/components/base/CountUp';

// Saludo de la pantalla principal. Cambia según la hora y según la racha, para
// que la primera línea que se lee no sea siempre la misma frase.
//
// No inventa datos: la racha viene ya calculada del Resumen y la franja horaria
// sale del reloj del dispositivo.

interface Props {
  name: string;
  /** Días consecutivos registrando. 0 = sin racha viva. */
  streak: number;
  /** Sesiones registradas en total; 0 = usuario nuevo. */
  totalSessions: number;
  isHobby: boolean;
}

/** madrugada < 6 · mañana < 13 · tarde < 21 · noche */
function slotOfDay(hour: number): 'night' | 'morning' | 'afternoon' | 'evening' {
  if (hour < 6) return 'night';
  if (hour < 13) return 'morning';
  if (hour < 21) return 'afternoon';
  return 'evening';
}

export default function GreetingLine({ name, streak, totalSessions, isHobby }: Props) {
  const { t } = useTranslation();
  const slot = slotOfDay(new Date().getHours());

  return (
    <div className="rk-enter">
      <h1 className="rk-screen-title" style={{ fontSize: 'clamp(24px,6vw,32px)' }}>
        {t(`mc_greet_${slot}`, { name })}
      </h1>

      {streak > 0 ? (
        <p className="mt-1.5 flex items-center gap-1.5 flex-wrap" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'var(--t-2)' }}>
          <i className="ri-fire-fill" style={{ color: 'var(--accent)' }} />
          <CountUp
            value={streak}
            duration={700}
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: 'var(--t-1)', lineHeight: 1 }}
          />
          {t(streak === 1 ? 'mc_greet_streak_one' : 'mc_greet_streak', { n: streak })}
        </p>
      ) : (
        <p className="mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--t-3)' }}>
          {totalSessions === 0
            ? t('mc_greet_first')
            : isHobby ? t('mc_hb_consistency_desc') : t('mc_sum_sub_pro')}
        </p>
      )}
    </div>
  );
}
