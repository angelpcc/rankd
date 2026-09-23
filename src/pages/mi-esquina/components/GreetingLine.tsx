import { useTranslation } from 'react-i18next';
import CountUp from '@/components/base/CountUp';

// Saludo de la pantalla principal. Cambia según la hora y según la racha, para
// que la primera línea que se lee no sea siempre la misma frase.
//
// No inventa datos: la racha viene ya calculada del Resumen y la franja horaria
// sale del reloj del dispositivo.
//
// v4: encima, la fecha de hoy (el Resumen es "lo de hoy" y no decía qué día
// era); la racha va en una pastilla, que se lee de un vistazo, en vez de en una
// frase en letra estrecha.

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
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const slot = slotOfDay(new Date().getHours());
  const fecha = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="rk-enter flex items-end justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <p className="rk-label first-letter:uppercase" style={{ letterSpacing: '0.06em' }}>{fecha}</p>
        <h1 className="rk-screen-title mt-1" style={{ fontSize: 'clamp(26px,5vw,34px)' }}>
          {t(`mc_greet_${slot}`, { name })}
        </h1>
        {streak === 0 && (
          <p className="mt-1.5 text-sm" style={{ color: 'var(--t-2)' }}>
            {totalSessions === 0
              ? t('mc_greet_first')
              : isHobby ? t('mc_hb_consistency_desc') : t('mc_sum_sub_pro')}
          </p>
        )}
      </div>

      {streak > 0 && (
        <p className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm flex-shrink-0"
          style={{ background: 'rgba(225,6,0,0.1)', border: '1px solid rgba(225,6,0,0.28)', color: 'var(--t-2)' }}>
          <i className="ri-fire-fill" style={{ color: 'var(--accent)' }} />
          <CountUp
            value={streak}
            duration={700}
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: '#fff', lineHeight: 1 }}
          />
          <span className="font-medium">{t('mc_greet_pill', { count: streak })}</span>
        </p>
      )}
    </div>
  );
}
