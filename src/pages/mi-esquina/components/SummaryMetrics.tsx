import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import CountUp from '@/components/base/CountUp';
import { activityKindCfg, isoOf, KIND_META, strengthTitle, type ActivityPayload, type StrengthPayload } from '../lib/dayPlan';

// Grid 2×2 de métricas compactas: PESO · OBJETIVO / COMIDA DE HOY · PRÓXIMO.
// Cada una card --s-2: label arriba, dato grande (Bebas) en blanco. El delta de
// peso conserva verde/naranja porque la dirección (bajas/subes) es información
// esencial, no decoración.
//
// ── POR QUÉ ESTAS CUATRO Y NO LAS DE ANTES ──
//
// Antes eran PESO · ENTRENOS SEMANA · RACHA · OBJETIVO. Entrenos de la semana y
// racha ya los enseña la tira de la semana, justo encima, con su barra de
// segmentos y su línea de racha: en el ordenador quedaban una al lado de la
// otra diciendo dos veces lo mismo, y en el móvil una debajo de la otra.
//
// Las dos que entran responden cosas que no se ven en ninguna otra parte del
// Resumen: cuánto llevas comido hoy y qué te toca la próxima vez. Y peso y
// objetivo van en la misma fila, porque se leen juntos (antes quedaban en
// diagonal).

interface Props {
  profile: Profile;
  onOpenWeight: () => void;
  onOpenNutrition: () => void;
  onOpenAgenda: () => void;
}

interface WeightPoint { date: string; value: number }
interface Comido { kcal: number; prot: number; carbs: number; fat: number; n: number }
interface Proximo { date: string; icon: string; hex?: string; title: string; extra: number }

/** Días de hoy a `iso` (1 = mañana). */
function diasHasta(iso: string): number {
  const a = new Date(iso + 'T00:00:00');
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

export default function SummaryMetrics({ profile, onOpenWeight, onOpenNutrition, onOpenAgenda }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const [weightHistory, setWeightHistory] = useState<WeightPoint[]>([]);
  const [weightCurrent, setWeightCurrent] = useState<number | null>(null);
  const [weightDelta, setWeightDelta] = useState<number | null>(null);
  const [targetWeight, setTargetWeight] = useState<number | null>(null);
  const [comido, setComido] = useState<Comido | null>(null);
  const [proximo, setProximo] = useState<Proximo | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const hoy = isoOf(new Date());
      const [{ data: entries, error: wErr }, { data: goal }, { data: meals }, { data: plan }] = await Promise.all([
        supabase.from('weight_entries').select('weight_kg, entry_date')
          .eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(14),
        supabase.from('nutrition_goals').select('target_weight_kg').eq('fighter_profile_id', profile.id).maybeSingle(),
        supabase.from('meal_entries').select('calories, protein_g, carbs_g, fat_g')
          .eq('fighter_profile_id', profile.id).eq('entry_date', hoy),
        // Lo que viene DESPUÉS de hoy: lo de hoy ya lo cuenta la tarjeta de
        // "Tu siguiente acción". Treinta filas sobran para encontrar el primer
        // día con algo aunque haya comidas planificadas por medio.
        supabase.from('day_plan_items').select('plan_date, kind, payload, completed, source')
          .eq('fighter_profile_id', profile.id).gt('plan_date', hoy)
          .in('kind', ['strength', 'activity'])
          .order('plan_date', { ascending: true }).limit(30),
      ]);
      if (!alive) return;

      if (!isMissingTable(wErr) && entries && entries.length) {
        const ordered = [...entries].reverse();
        setWeightHistory(ordered.map((e) => ({ date: e.entry_date, value: Number(e.weight_kg) })));
        setWeightCurrent(Number(entries[0].weight_kg));
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        const ref = entries.find((e) => new Date(e.entry_date) <= weekAgo) || entries[1];
        setWeightDelta(ref ? +(Number(entries[0].weight_kg) - Number(ref.weight_kg)).toFixed(1) : null);
      }
      const tw = (goal as { target_weight_kg?: number } | null)?.target_weight_kg;
      if (tw != null) setTargetWeight(Number(tw));

      const ms = (meals || []) as { calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null }[];
      if (ms.length > 0) {
        setComido(ms.reduce<Comido>((acc, m) => ({
          kcal: acc.kcal + (Number(m.calories) || 0),
          prot: acc.prot + (Number(m.protein_g) || 0),
          carbs: acc.carbs + (Number(m.carbs_g) || 0),
          fat: acc.fat + (Number(m.fat_g) || 0),
          n: acc.n + 1,
        }), { kcal: 0, prot: 0, carbs: 0, fat: 0, n: 0 }));
      }

      // Mismo criterio que "pendiente" en todayTraining: ni el recibo de algo
      // ya hecho (`logged`), ni lo opcional, que se puede hacer pero no toca.
      const filas = ((plan || []) as { plan_date: string; kind: string; payload: Record<string, unknown> | null; completed: boolean; source: string | null }[])
        .filter((r) => r.source !== 'logged' && !r.completed && !(r.payload as { optional?: boolean } | null)?.optional);
      const primera = filas[0];
      if (primera) {
        const mismoDia = filas.filter((r) => r.plan_date === primera.plan_date);
        if (primera.kind === 'strength') {
          const p = (primera.payload || {}) as unknown as StrengthPayload;
          setProximo({
            date: primera.plan_date,
            icon: KIND_META.strength.icon,
            title: strengthTitle(p, t),
            extra: mismoDia.length - 1,
          });
        } else {
          const p = (primera.payload || {}) as unknown as ActivityPayload;
          const cfg = activityKindCfg(p.kind);
          setProximo({
            date: primera.plan_date,
            icon: cfg.icon,
            hex: cfg.hex,
            title: p.protocol_name || t(cfg.labelKey),
            extra: mismoDia.length - 1,
          });
        }
      }
    })();
    return () => { alive = false; };
  }, [profile.id, t]);

  const Card = ({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className="w-full text-left cursor-pointer rk-press rk-lift flex flex-col"
      style={{ background: 'var(--s-2)', border: '1px solid var(--s-3)', borderRadius: 'var(--r-cta)', padding: 16, minHeight: 104 }}
    >
      {children}
    </button>
  );

  const toGo = targetWeight != null && weightCurrent != null ? +(weightCurrent - targetWeight).toFixed(1) : null;

  // Reparto de lo comido en calorías de cada macro (4 · 4 · 9). Es la única
  // forma de que tres barras de cosas distintas se puedan poner en fila.
  const reparto = comido && comido.kcal > 0
    ? (() => {
      const p = comido.prot * 4, c = comido.carbs * 4, g = comido.fat * 9;
      const tot = p + c + g;
      return tot > 0 ? [
        { w: p / tot, color: 'var(--accent)' },
        { w: c / tot, color: 'var(--gold)' },
        { w: g / tot, color: 'var(--t-3)' },
      ] : null;
    })()
    : null;

  const cuando = (iso: string) => {
    const d = diasHasta(iso);
    if (d === 1) return t('mc_metric_next_tomorrow');
    const s = new Date(iso + 'T12:00:00').toLocaleDateString(locale, d < 7 ? { weekday: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* ── PESO ── */}
      <Card onClick={onOpenWeight}>
        <p className="rk-label">{t('mc_metric_weight')}</p>
        {weightCurrent !== null ? (
          <>
            <CountUp value={weightCurrent} decimals={1} suffix="kg" className="rk-num mt-1.5" style={{ display: 'block' }} />
            {weightDelta !== null && weightDelta !== 0 && (
              <p className="mt-0.5 text-xs font-semibold" style={{ color: weightDelta < 0 ? '#4ade80' : '#fb923c' }}>
                {weightDelta < 0 ? '▼' : '▲'} {Math.abs(weightDelta)} kg
              </p>
            )}
            {weightHistory.length >= 2 && (
              <div style={{ width: '100%', height: 24, marginTop: 'auto', paddingTop: 4 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weightHistory} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                    {/* Sin eje, Recharts escala desde 0: entre 76 y 78 kg la línea
                        salía plana pegada arriba y parecía un punto. Del mínimo al
                        máximo, que es lo que se quiere ver: hacia dónde va. */}
                    <YAxis hide domain={['dataMin', 'dataMax']} />
                    <Line type="monotone" dataKey="value" stroke="var(--t-2)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        ) : (
          <p className="rk-num mt-1.5" style={{ color: 'var(--t-3)' }}>—</p>
        )}
      </Card>

      {/* ── OBJETIVO DE PESO ── */}
      <Card onClick={onOpenWeight}>
        <p className="rk-label">{t('mc_metric_goal')}</p>
        {targetWeight != null ? (
          <>
            <CountUp value={targetWeight} decimals={1} suffix="kg" delay={80} className="rk-num mt-1.5" style={{ display: 'block' }} />
            {toGo !== null && toGo !== 0 && (
              <p className="mt-0.5 text-xs" style={{ color: 'var(--t-3)' }}>
                {t('mc_metric_goal_togo', { n: Math.abs(toGo) })}
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-xs" style={{ color: 'var(--t-3)' }}>{t('mc_metric_goal_empty')}</p>
        )}
      </Card>

      {/* ── COMIDA DE HOY ── */}
      <Card onClick={onOpenNutrition}>
        <p className="rk-label">{t('mc_metric_food')}</p>
        {comido ? (
          <>
            <p className="rk-num mt-1.5">
              <CountUp value={Math.round(comido.kcal)} delay={160} />
              <span style={{ fontSize: 14, color: 'var(--t-3)', marginLeft: 4 }}>kcal</span>
            </p>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--t-2)' }}>
              {t('mc_metric_food_prot', { n: Math.round(comido.prot) })}
            </p>
            {reparto && (
              <div className="flex overflow-hidden" style={{ height: 6, borderRadius: 999, marginTop: 'auto', gap: 2, background: 'var(--s-3)' }}
                aria-hidden>
                {reparto.map((r, i) => r.w > 0 && (
                  <span key={i} style={{ flex: `${r.w} 0 0`, background: r.color }} />
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="mt-2 text-xs" style={{ color: 'var(--t-3)' }}>{t('mc_metric_food_empty')}</p>
        )}
      </Card>

      {/* ── PRÓXIMO ENTRENO ── */}
      <Card onClick={onOpenAgenda}>
        <p className="rk-label">{t('mc_metric_next')}</p>
        {proximo ? (
          <>
            <p className="mt-1.5 text-xs font-semibold" style={{ color: 'var(--t-2)' }}>
              {cuando(proximo.date)}
              {proximo.extra > 0 && <span style={{ color: 'var(--t-3)' }}> · +{proximo.extra}</span>}
            </p>
            <p className="mt-1 flex items-start gap-1.5 text-sm font-bold text-white leading-snug">
              <i className={`${proximo.icon} flex-shrink-0`} style={{ color: proximo.hex || 'var(--accent)', marginTop: 2 }} />
              <span className="line-clamp-2 min-w-0">{proximo.title}</span>
            </p>
          </>
        ) : (
          <p className="mt-2 text-xs" style={{ color: 'var(--t-3)' }}>{t('mc_metric_next_empty')}</p>
        )}
      </Card>
    </div>
  );
}
