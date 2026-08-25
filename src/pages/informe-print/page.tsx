import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { isViewingAs } from '@/lib/viewAs';

// Informe de progreso IMPRIMIBLE, por periodo (punto 6 del encargo).
//
// Ruta dedicada `/mi-esquina/informe/imprimir?period=week|month|2months|custom`.
// A diferencia de plan-print (que exporta el PLAN futuro generado), este
// informe resume lo que el peleador REALMENTE hizo: sesiones de fuerza,
// evolución del peso (gráfico SVG propio — nada de ResponsiveContainer, que
// no imprime bien), nutrición si hay datos, y progresión/PRs por ejercicio.
//
// Mismo lenguaje visual que plan-print: A4 blanco, acentos rojo/oro.

type Period = 'week' | 'month' | '2months' | 'custom';

interface StrengthRow {
  exercise: string;
  exercise_label: string;
  session_date: string;
  session_slot: string | null;
  reps: number;
  weight_kg: number;
  muscle_group: string | null;
}
interface WeightRow { entry_date: string; weight_kg: number }
interface MealRow { entry_date: string; calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null }

const MUSCLE_LABEL: Record<string, string> = {
  chest: 'Pecho', shoulders: 'Hombros', biceps: 'Bíceps', triceps: 'Tríceps',
  back: 'Espalda', core: 'Core', legs: 'Piernas', power: 'Potencia', full_body: 'Full Body',
};

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayISO(): string { return iso(new Date()); }

function periodBounds(period: Period, customStart: string, customEnd: string): { start: string; end: string } {
  if (period === 'custom' && customStart && customEnd) {
    return { start: customStart <= customEnd ? customStart : customEnd, end: customStart <= customEnd ? customEnd : customStart };
  }
  const end = new Date();
  const start = new Date();
  if (period === 'week') start.setDate(start.getDate() - 7);
  else if (period === 'month') start.setMonth(start.getMonth() - 1);
  else start.setMonth(start.getMonth() - 2); // '2months'
  return { start: iso(start), end: iso(end) };
}

export default function ReportPrintPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const { user, profile, loading: authLoading } = useAuth();

  const [period, setPeriod] = useState<Period>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [strengthRows, setStrengthRows] = useState<StrengthRow[]>([]);
  const [strengthBefore, setStrengthBefore] = useState<StrengthRow[]>([]);
  const [weightRows, setWeightRows] = useState<WeightRow[]>([]);
  const [mealRows, setMealRows] = useState<MealRow[]>([]);

  useEffect(() => {
    if (!authLoading && !user && !isViewingAs()) navigate('/esquina');
  }, [authLoading, user, navigate]);

  const { start, end } = useMemo(() => periodBounds(period, customStart, customEnd), [period, customStart, customEnd]);

  useEffect(() => {
    if (!profile?.id) return;
    let alive = true;
    setLoading(true);
    (async () => {
      const [strengthRes, weightRes, mealRes] = await Promise.all([
        // Trae también lo anterior al periodo (misma consulta, hasta 'end') para
        // poder comparar el mejor peso previo y detectar PRs conseguidos DENTRO
        // del periodo, no solo el máximo histórico.
        supabase.from('strength_sets')
          .select('exercise, exercise_label, session_date, session_slot, reps, weight_kg, muscle_group')
          .eq('fighter_profile_id', profile.id).lte('session_date', end)
          .order('session_date', { ascending: true }).limit(5000),
        supabase.from('weight_entries')
          .select('entry_date, weight_kg')
          .eq('fighter_profile_id', profile.id).gte('entry_date', start).lte('entry_date', end)
          .order('entry_date', { ascending: true }),
        supabase.from('meal_entries')
          .select('entry_date, calories, protein_g, carbs_g, fat_g')
          .eq('fighter_profile_id', profile.id).gte('entry_date', start).lte('entry_date', end),
      ]);
      if (!alive) return;
      const allStrength = (strengthRes.data || []) as StrengthRow[];
      setStrengthRows(allStrength.filter((r) => r.session_date >= start));
      setStrengthBefore(allStrength.filter((r) => r.session_date < start));
      setWeightRows((weightRes.data || []) as WeightRow[]);
      setMealRows((mealRes.data || []) as MealRow[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [profile?.id, start, end]);

  // ── Entrenamientos ──
  const training = useMemo(() => {
    const sessionKeys = new Set(strengthRows.map((r) => `${r.session_date}|${r.session_slot || ''}`));
    const groups = new Set(strengthRows.map((r) => r.muscle_group).filter(Boolean) as string[]);
    const volume = strengthRows.reduce((sum, r) => sum + r.reps * r.weight_kg, 0);
    return { sessions: sessionKeys.size, groups: [...groups], volume: Math.round(volume) };
  }, [strengthRows]);

  // ── Progresión / PRs: mejor marca antes del periodo vs. mejor marca dentro ──
  const progression = useMemo(() => {
    const bestBefore = new Map<string, { label: string; kg: number }>();
    strengthBefore.forEach((r) => {
      const cur = bestBefore.get(r.exercise);
      if (!cur || r.weight_kg > cur.kg) bestBefore.set(r.exercise, { label: r.exercise_label, kg: r.weight_kg });
    });
    const bestInRange = new Map<string, { label: string; kg: number }>();
    strengthRows.forEach((r) => {
      const cur = bestInRange.get(r.exercise);
      if (!cur || r.weight_kg > cur.kg) bestInRange.set(r.exercise, { label: r.exercise_label, kg: r.weight_kg });
    });
    const prs: { label: string; before: number; after: number; deltaPct: number }[] = [];
    bestInRange.forEach((after, exercise) => {
      const before = bestBefore.get(exercise);
      if (!before || after.kg <= before.kg) return;
      prs.push({ label: after.label, before: before.kg, after: after.kg, deltaPct: Math.round(((after.kg - before.kg) / before.kg) * 100) });
    });
    prs.sort((a, b) => b.deltaPct - a.deltaPct);
    return prs;
  }, [strengthRows, strengthBefore]);

  // ── Peso: puntos para el SVG + resumen ──
  const weightChart = useMemo(() => {
    if (weightRows.length < 2) return null;
    const values = weightRows.map((w) => w.weight_kg);
    const min = Math.min(...values), max = Math.max(...values);
    const pad = Math.max(0.5, (max - min) * 0.15);
    const lo = min - pad, hi = max + pad;
    const W = 600, H = 180;
    const pts = weightRows.map((w, i) => {
      const x = weightRows.length === 1 ? 0 : (i / (weightRows.length - 1)) * W;
      const y = hi === lo ? H / 2 : H - ((w.weight_kg - lo) / (hi - lo)) * H;
      return { x, y };
    });
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return { path, pts, first: weightRows[0], last: weightRows[weightRows.length - 1], min, max, W, H };
  }, [weightRows]);

  // ── Nutrición: solo cuenta lo que tiene macros (comidas manuales sin foto no) ──
  const nutrition = useMemo(() => {
    const withMacros = mealRows.filter((m) => m.calories !== null);
    if (withMacros.length === 0) return null;
    const days = new Set(mealRows.map((m) => m.entry_date)).size || 1;
    const total = withMacros.reduce((acc, m) => ({
      calories: acc.calories + (m.calories || 0), protein: acc.protein + (m.protein_g || 0),
      carbs: acc.carbs + (m.carbs_g || 0), fat: acc.fat + (m.fat_g || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    return {
      entries: mealRows.length, withMacros: withMacros.length,
      avgCalories: Math.round(total.calories / days), avgProtein: Math.round(total.protein / days),
      avgCarbs: Math.round(total.carbs / days), avgFat: Math.round(total.fat / days),
    };
  }, [mealRows]);

  useEffect(() => {
    if (loading) return;
    const q = new URLSearchParams(window.location.search);
    if (q.get('print') !== '1') return;
    const id = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(id);
  }, [loading]);

  if (loading || authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#fff' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #E10600', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const generatedOn = new Date().toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const startNice = new Date(start + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const endNice = new Date(end + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const hasAnyData = strengthRows.length > 0 || weightRows.length > 0 || mealRows.length > 0;

  return (
    <div className="rk-plan-print">
      <div className="rk-print-toolbar">
        <button onClick={() => navigate(-1)} className="rk-print-back">← {t('op_print_back')}</button>
        <div className="rk-print-period-selector">
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="rk-print-select">
            <option value="week">{t('rp_period_week')}</option>
            <option value="month">{t('rp_period_month')}</option>
            <option value="2months">{t('rp_period_2months')}</option>
            <option value="custom">{t('op_export_custom')}</option>
          </select>
          {period === 'custom' && (
            <div className="rk-print-custom-dates">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} max={todayISO()} className="rk-print-date-input" />
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} max={todayISO()} className="rk-print-date-input" />
            </div>
          )}
        </div>
        <button onClick={() => window.print()} className="rk-print-btn">
          <span style={{ marginRight: 6 }}>⇩</span>{t('op_print_download')}
        </button>
      </div>

      <article className="rk-print-page">
        <header className="rk-print-header">
          <div className="rk-print-brand">
            <span className="rk-print-brand-w">RAN</span><span className="rk-print-brand-r">KD</span>
          </div>
          <div className="rk-print-title-block">
            <h1 className="rk-print-title">{t('rp_title')}</h1>
            <p className="rk-print-summary">{profile?.full_name || '—'} · {startNice} – {endNice}</p>
          </div>
        </header>

        {!hasAnyData ? (
          <div style={{ textAlign: 'center', padding: '48px 12px', color: '#888' }}>
            <p style={{ fontSize: 14 }}>{t('rp_empty')}</p>
          </div>
        ) : (
          <>
            {/* ── Entrenamientos ── */}
            <section className="rk-print-week">
              <h2 className="rk-print-week-title">{t('rp_section_training')}</h2>
              <div className="rk-print-meta" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div><span className="rk-print-meta-label">{t('rp_sessions')}</span><span>{training.sessions}</span></div>
                <div><span className="rk-print-meta-label">{t('rp_volume')}</span><span>{training.volume.toLocaleString(locale)} kg</span></div>
                <div><span className="rk-print-meta-label">{t('rp_groups')}</span><span>{training.groups.length > 0 ? training.groups.map((g) => MUSCLE_LABEL[g] || g).join(', ') : '—'}</span></div>
              </div>
            </section>

            {/* ── Peso ── */}
            {weightRows.length > 0 && (
              <section className="rk-print-week">
                <h2 className="rk-print-week-title">{t('rp_section_weight')}</h2>
                {weightChart ? (
                  <>
                    <svg viewBox={`0 0 ${weightChart.W} ${weightChart.H}`} width="100%" height="140" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                      <path d={weightChart.path} fill="none" stroke="#C9A84C" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
                      {weightChart.pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill="#E10600" />)}
                    </svg>
                    <div className="rk-print-meta" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 12 }}>
                      <div><span className="rk-print-meta-label">{t('rp_weight_start')}</span><span>{weightChart.first.weight_kg} kg</span></div>
                      <div><span className="rk-print-meta-label">{t('rp_weight_end')}</span><span>{weightChart.last.weight_kg} kg</span></div>
                      <div><span className="rk-print-meta-label">{t('rp_weight_change')}</span><span>{(weightChart.last.weight_kg - weightChart.first.weight_kg).toFixed(1)} kg</span></div>
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize: 12, color: '#888' }}>{t('rp_weight_single', { kg: weightRows[0].weight_kg })}</p>
                )}
              </section>
            )}

            {/* ── Nutrición ── */}
            {nutrition && (
              <section className="rk-print-week">
                <h2 className="rk-print-week-title">{t('rp_section_nutrition')}</h2>
                <div className="rk-print-meta" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  <div><span className="rk-print-meta-label">{t('rp_avg_calories')}</span><span>{nutrition.avgCalories} kcal</span></div>
                  <div><span className="rk-print-meta-label">{t('rp_avg_protein')}</span><span>{nutrition.avgProtein} g</span></div>
                  <div><span className="rk-print-meta-label">{t('rp_avg_carbs')}</span><span>{nutrition.avgCarbs} g</span></div>
                  <div><span className="rk-print-meta-label">{t('rp_avg_fat')}</span><span>{nutrition.avgFat} g</span></div>
                </div>
                <p style={{ fontSize: 10, color: '#999', marginTop: 6 }}>{t('rp_nutrition_note', { n: nutrition.withMacros, total: nutrition.entries })}</p>
              </section>
            )}

            {/* ── Progresión / PRs ── */}
            {progression.length > 0 && (
              <section className="rk-print-week">
                <h2 className="rk-print-week-title">{t('rp_section_progress')}</h2>
                <div className="rk-print-days" style={{ gridTemplateColumns: '1fr' }}>
                  {progression.slice(0, 8).map((p) => (
                    <div key={p.label} className="rk-print-day" style={{ borderLeftColor: '#C9A84C', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="rk-print-day-name" style={{ marginBottom: 0 }}>{p.label}</span>
                      <span style={{ fontSize: 12, color: '#2f8a3d', fontWeight: 700 }}>{p.before}kg → {p.after}kg (+{p.deltaPct}%)</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <footer className="rk-print-footer">
          <p className="rk-print-generated">{t('op_print_generated_by')} · {generatedOn}</p>
        </footer>
      </article>

      <style>{`
        .rk-plan-print { background: #f2f2f2; min-height: 100vh; color: #111; font-family: 'Barlow Condensed', system-ui, -apple-system, sans-serif; padding: 24px 12px 60px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .rk-print-toolbar { max-width: 210mm; margin: 0 auto 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .rk-print-back { background: transparent; border: none; color: #333; cursor: pointer; font-size: 14px; font-weight: 600; }
        .rk-print-period-selector { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .rk-print-select { background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 8px 12px; font-size: 13px; font-weight: 600; color: #333; cursor: pointer; }
        .rk-print-custom-dates { display: flex; gap: 8px; align-items: center; }
        .rk-print-date-input { background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 6px 10px; font-size: 12px; color: #333; cursor: pointer; }
        .rk-print-btn { background: #E10600; color: #fff; border: none; border-radius: 8px; padding: 10px 18px; font-weight: 700; letter-spacing: 0.5px; cursor: pointer; box-shadow: 0 4px 14px rgba(225,6,0,0.3); }
        .rk-print-page { background: #fff; color: #111; max-width: 210mm; min-height: 297mm; margin: 0 auto; padding: 20mm 18mm; box-shadow: 0 4px 24px rgba(0,0,0,0.12); border-radius: 4px; }
        .rk-print-header { border-bottom: 3px solid #E10600; padding-bottom: 16px; margin-bottom: 20px; display: flex; align-items: flex-start; gap: 18px; }
        .rk-print-brand { font-family: 'Bebas Neue', sans-serif; font-size: 42px; line-height: 1; letter-spacing: 2px; flex-shrink: 0; }
        .rk-print-brand-w { color: #111; }
        .rk-print-brand-r { color: #E10600; }
        .rk-print-title-block { flex: 1; min-width: 0; }
        .rk-print-title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 1px; color: #111; margin: 0; }
        .rk-print-summary { color: #555; margin: 4px 0 0; font-size: 14px; line-height: 1.4; }
        .rk-print-meta { display: grid; gap: 12px; margin-bottom: 8px; border: 1px solid #e8e8e8; border-left: 4px solid #C9A84C; padding: 12px 14px; border-radius: 4px; }
        .rk-print-meta > div { font-size: 13px; color: #222; display: flex; flex-direction: column; gap: 2px; }
        .rk-print-meta-label { font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: #888; font-weight: 700; }
        .rk-print-week { margin-bottom: 22px; break-inside: avoid; }
        .rk-print-week-title { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; color: #E10600; margin: 0 0 10px; padding-bottom: 4px; border-bottom: 1px solid #eee; }
        .rk-print-days { display: grid; gap: 8px; }
        .rk-print-day { border: 1px solid #e8e8e8; border-radius: 4px; padding: 10px 12px; break-inside: avoid; border-left: 4px solid #E10600; }
        .rk-print-day-name { font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 1.5px; color: #111; margin-bottom: 6px; }
        .rk-print-footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #eee; }
        .rk-print-generated { font-size: 10px; color: #999; letter-spacing: 1px; text-transform: uppercase; margin: 8px 0 0; }
        @media print {
          .rk-plan-print { background: #fff; padding: 0; }
          .rk-print-toolbar { display: none !important; }
          .rk-print-page { box-shadow: none; border-radius: 0; margin: 0; padding: 12mm 12mm; min-height: 0; max-width: none; }
          .rk-print-day, .rk-print-week { break-inside: avoid; }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  );
}
