import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Reveal from '@/components/base/Reveal';

interface Props {
  /** Último peso registrado. */
  current: number | null;
  /** Límite de la categoría. */
  target: number | null;
  /** Fecha del pesaje (YYYY-MM-DD). */
  weighIn: string | null;
  /** Categoría, para el encabezado del veredicto. */
  classLabel: string | null;
  /** Abre el modal de objetivo del control de peso. */
  onSetGoal: () => void;
}

interface Milestone {
  date: Date;
  weight: number;
  phase: 'gradual' | 'final';
}

const todayMidnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const round1 = (n: number) => Math.round(n * 10) / 10;
const addDays = (d: Date, days: number) => { const r = new Date(d); r.setDate(r.getDate() + days); return r; };

/**
 * Planificador de corte de peso (solo el que compite).
 *
 * A partir del peso actual, el límite de la categoría y la fecha del pesaje,
 * traza un plan realista en dos fases, SIN IA (cálculo puro, funciona siempre):
 *
 *   1. Bajada gradual (semanas) → pérdida de peso "real" a ritmo sano hasta un
 *      peso de semana de pelea = límite + un pequeño margen (el agua que se
 *      manipula al final).
 *   2. Semana de pelea → de ese margen al límite mediante ajuste de líquidos,
 *      que SIEMPRE se recomienda hacer con un profesional.
 *
 * Es orientativo y prioriza la salud: si el ritmo necesario es agresivo, avisa.
 * Recibe los datos del control de peso que lo envuelve, así no hay 2ª consulta.
 */
export default function WeightCutPlanner({ current, target, weighIn, classLabel, onSetGoal }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const plan = useMemo(() => {
    if (current === null || target === null || !weighIn) return null;
    const today = todayMidnight();
    const weighInDate = new Date(weighIn + 'T12:00:00'); weighInDate.setHours(0, 0, 0, 0);
    const daysToWeighIn = Math.round((weighInDate.getTime() - today.getTime()) / 86400000);
    if (daysToWeighIn < 0) return { kind: 'past' as const };

    const toLose = round1(current - target);
    if (toLose <= 0.1) return { kind: 'onweight' as const, daysToWeighIn };

    // Margen de agua a manipular en los últimos días: ~2% del límite, acotado
    // entre 1 y 3 kg. Es lo que NO se baja con dieta gradual.
    const buffer = Math.min(3, Math.max(1, round1(target * 0.02)));
    const fightWeekWeight = round1(target + buffer);
    // Fase final (semana de pelea): los últimos 7 días, o todo lo que quede.
    const finalDays = Math.min(7, daysToWeighIn);
    const fightWeekStart = addDays(weighInDate, -finalDays);
    const gradualDays = daysToWeighIn - finalDays;

    const milestones: Milestone[] = [];
    let weeklyLoss = 0;
    let verdict: 'comfortable' | 'ok' | 'aggressive' = 'comfortable';

    const needsGradual = current > fightWeekWeight && gradualDays > 0;
    if (needsGradual) {
      const gradualToLose = round1(current - fightWeekWeight);
      const weeks = Math.max(1, Math.round(gradualDays / 7));
      weeklyLoss = round1(gradualToLose / (gradualDays / 7));
      verdict = weeklyLoss <= 0.7 ? 'comfortable' : weeklyLoss <= 1.0 ? 'ok' : 'aggressive';
      for (let i = 1; i <= weeks; i++) {
        const frac = i / weeks;
        milestones.push({
          date: addDays(fightWeekStart, -(weeks - i) * 7),
          weight: round1(current - gradualToLose * frac),
          phase: 'gradual',
        });
      }
    } else {
      // No queda bajada gradual: casi todo el corte es agua en los últimos días.
      // Eso es exigente por definición: avisamos.
      verdict = 'aggressive';
    }

    // Fila de semana de pelea (el ajuste de líquidos hasta el límite).
    milestones.push({ date: weighInDate, weight: target, phase: 'final' });

    return {
      kind: 'plan' as const,
      daysToWeighIn, toLose, fightWeekWeight, needsGradual,
      weeklyLoss, verdict, milestones,
    };
  }, [current, target, weighIn]);

  if (plan?.kind === 'past') return null;

  const fmtDate = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  const Header = (
    <div>
      <p className="rk-eyebrow">{t('mc_wc_eyebrow')}</p>
      <h2 className="rk-h2" style={{ fontSize: 'clamp(1.5rem,3.4vw,2rem)', color: '#fff', margin: '4px 0 0' }}>
        {t('mc_wc_title')} <span className="rk-red-glow">{t('mc_wc_title_2')}</span>
      </h2>
      <p className="text-zinc-400 text-sm mt-1.5 max-w-md">{t('mc_wc_sub')}</p>
    </div>
  );

  // ── Faltan datos: categoría o fecha de pesaje ──
  if (!plan) {
    return (
      <Reveal>
        <div className="space-y-4">
          {Header}
          <div className="rk-card flex items-start gap-3.5" style={{ padding: '18px 20px', transform: 'none' }}>
            <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-[#C9A84C]/12 border border-[#C9A84C]/30 text-[#C9A84C]">
              <i className="ri-flag-line text-lg"></i>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">{t('mc_wc_need_data_title')}</p>
              <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                {current === null ? t('mc_wc_need_weight') : t('mc_wc_need_goal')}
              </p>
            </div>
            {current !== null && (
              <button onClick={onSetGoal} className="rk-btn rk-btn-ghost flex-shrink-0" style={{ fontSize: '0.78rem', padding: '0.55rem 1.1rem' }}>
                {t('mc_wc_set_goal')}
              </button>
            )}
          </div>
        </div>
      </Reveal>
    );
  }

  // ── Ya da el peso ──
  if (plan.kind === 'onweight') {
    return (
      <Reveal>
        <div className="space-y-4">
          {Header}
          <div className="rk-card flex items-start gap-3.5" style={{ padding: '18px 20px', transform: 'none', borderColor: 'rgba(34,197,94,0.28)' }}>
            <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-green-500/12 border border-green-500/30 text-green-400">
              <i className="ri-checkbox-circle-line text-lg"></i>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-green-300">{t('mc_wc_onweight_title')}</p>
              <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{t('mc_wc_onweight_desc', { n: plan.daysToWeighIn })}</p>
            </div>
          </div>
        </div>
      </Reveal>
    );
  }

  const verdictCfg = {
    comfortable: { color: '#4ade80', icon: 'ri-shield-check-line', textKey: 'mc_wc_verdict_comfortable' },
    ok: { color: '#C9A84C', icon: 'ri-speed-up-line', textKey: 'mc_wc_verdict_ok' },
    aggressive: { color: '#E10600', icon: 'ri-alarm-warning-line', textKey: 'mc_wc_verdict_aggressive' },
  }[plan.verdict];

  return (
    <Reveal>
      <div className="space-y-4 max-w-4xl">
        {Header}

        {/* Resumen del corte */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rk-card" style={{ padding: '16px 14px', textAlign: 'center' }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, lineHeight: 0.9, color: '#E10600' }}>{plan.toLose}</span>
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider mt-1.5">{t('mc_wc_to_lose')}</p>
          </div>
          <div className="rk-card" style={{ padding: '16px 14px', textAlign: 'center' }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, lineHeight: 0.9, color: '#fff' }}>{plan.daysToWeighIn}</span>
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider mt-1.5">{t('mc_wc_days')}</p>
          </div>
          <div className="rk-card" style={{ padding: '16px 14px', textAlign: 'center' }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, lineHeight: 0.9, color: plan.needsGradual ? verdictCfg.color : '#E10600' }}>
              {plan.needsGradual ? plan.weeklyLoss : '—'}
            </span>
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider mt-1.5">{t('mc_wc_per_week')}</p>
          </div>
        </div>

        {/* Veredicto de ritmo */}
        <div className="rk-card flex items-start gap-3.5" style={{ padding: '14px 18px', transform: 'none', borderColor: `${verdictCfg.color}45` }}>
          <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl border"
            style={{ background: `${verdictCfg.color}1a`, borderColor: `${verdictCfg.color}45`, color: verdictCfg.color }}>
            <i className={`${verdictCfg.icon} text-lg`}></i>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold" style={{ color: verdictCfg.color }}>
              {classLabel ? `${classLabel} · ` : ''}{t('mc_wc_target_at', { kg: target })}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{t(verdictCfg.textKey)}</p>
          </div>
        </div>

        {/* Plan semana a semana */}
        <div className="rk-card" style={{ padding: '18px 20px', transform: 'none' }}>
          <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-zinc-600 mb-4">{t('mc_wc_roadmap')}</p>
          <div className="relative">
            {/* Línea vertical del recorrido */}
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-white/10" />
            <div className="space-y-4">
              {plan.milestones.map((m, i) => {
                const isFinal = m.phase === 'final';
                const dotColor = isFinal ? '#E10600' : '#C9A84C';
                return (
                  <div key={i} className="relative flex items-start gap-4 pl-0">
                    <div className="relative z-10 w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full border-2"
                      style={{ background: '#0b0b0b', borderColor: dotColor, color: dotColor }}>
                      <i className={isFinal ? 'ri-sword-line text-sm' : 'ri-check-line text-sm'}></i>
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white">
                          {isFinal ? t('mc_wc_step_final') : t('mc_wc_step_week', { n: i + 1 })}
                        </p>
                        <span className="text-xs text-zinc-500 capitalize">{fmtDate(m.date)}</span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: dotColor }}>
                        {isFinal
                          ? t('mc_wc_step_final_target', { from: plan.fightWeekWeight, to: m.weight })
                          : t('mc_wc_step_target', { kg: m.weight })}
                      </p>
                      {isFinal && (
                        <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{t('mc_wc_final_note')}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Guía de la semana de pelea */}
        <div className="rk-card" style={{ padding: '18px 20px', transform: 'none' }}>
          <div className="flex items-center gap-2.5 mb-3">
            <i className="ri-drop-line text-[#38bdf8] text-lg"></i>
            <h3 className="text-sm font-bold text-white">{t('mc_wc_fightweek_title')}</h3>
          </div>
          <ul className="space-y-2">
            {['mc_wc_fw_1', 'mc_wc_fw_2', 'mc_wc_fw_3', 'mc_wc_fw_4'].map((k) => (
              <li key={k} className="flex items-start gap-2.5 text-xs text-zinc-400 leading-relaxed">
                <i className="ri-checkbox-blank-circle-fill text-[5px] text-[#38bdf8] mt-1.5 flex-shrink-0"></i>
                <span>{t(k)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Aviso de salud */}
        <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5">
          <i className="ri-information-line mt-0.5 flex-shrink-0"></i>{t('mc_wc_health')}
        </p>
      </div>
    </Reveal>
  );
}
