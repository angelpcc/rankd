import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { isViewingAs } from '@/lib/viewAs';
import { isMissingTable } from '@/lib/dbState';

// Vista IMPRIMIBLE del plan activo del usuario (Bloque B.7).
//
// Ruta dedicada `/mi-esquina/plan/imprimir`. Se abre en una pestaña nueva desde
// ObjectiveWizard con `?print=1` y auto-lanza `window.print()`. El navegador
// se encarga del PDF (Guardar como PDF). Sin dependencias nuevas.
//
// Diseño: A4 vertical, fondo BLANCO para no gastar tinta, acentos rojo/oro
// solo en títulos y franjas. Cabecera con marca RANKD, bloque por semana con
// tarjetas por día, y disclaimer + fecha de generación en el pie.

interface PlanDay {
  day: 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo';
  training: string | null;
  cardio: string | null;
  nutrition: string | null;
  notes: string | null;
}
interface PlanWeek { week: number; days: PlanDay[] }
interface Plan {
  plan_name: string;
  summary: string;
  disclaimer: string;
  weeks: PlanWeek[];
}
interface DBPlan {
  id: string;
  objective_text: string;
  plan_json: Plan;
  created_at: string;
}

const DAY_ORDER: PlanDay['day'][] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function PlanPrintPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const { user, profile, loading: authLoading } = useAuth();
  const [plan, setPlan] = useState<DBPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    // Mismo guard consciente de "ver como" que el resto de páginas privadas.
    if (!authLoading && !user && !isViewingAs()) navigate('/esquina');
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      const { data, error } = await supabase
        .from('objective_plans').select('*')
        .eq('fighter_profile_id', profile.id).eq('status', 'active')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (isMissingTable(error) || !data) { setNotFound(true); setLoading(false); return; }
      setPlan(data as DBPlan);
      setLoading(false);
    })();
  }, [profile?.id]);

  // Auto-lanzar el diálogo de impresión cuando el plan se renderiza y el URL
  // trae ?print=1 (así el botón "Descargar PDF" del wizard abre-y-imprime).
  useEffect(() => {
    if (!plan) return;
    const q = new URLSearchParams(window.location.search);
    if (q.get('print') !== '1') return;
    const id = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(id);
  }, [plan]);

  if (loading || authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#fff' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #E10600', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (notFound || !plan) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#fff', color: '#222', padding: 24, textAlign: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontFamily: "'Bebas Neue', sans-serif" }}>{t('op_print_no_plan_title')}</h1>
          <p style={{ marginTop: 8, color: '#666' }}>{t('op_print_no_plan_desc')}</p>
          <button onClick={() => navigate('/mi-esquina')} style={{ marginTop: 16, padding: '10px 20px', background: '#E10600', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
            {t('op_print_back')}
          </button>
        </div>
      </div>
    );
  }

  const p = plan.plan_json;
  const generatedOn = new Date(plan.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="rk-plan-print">
      {/* Barra superior (SOLO pantalla, no imprime) */}
      <div className="rk-print-toolbar">
        <button onClick={() => navigate(-1)} className="rk-print-back">← {t('op_print_back')}</button>
        <button onClick={() => window.print()} className="rk-print-btn">
          <span style={{ marginRight: 6 }}>⇩</span>{t('op_print_download')}
        </button>
      </div>

      <article className="rk-print-page">
        {/* Cabecera */}
        <header className="rk-print-header">
          <div className="rk-print-brand">
            <span className="rk-print-brand-w">RAN</span><span className="rk-print-brand-r">KD</span>
          </div>
          <div className="rk-print-title-block">
            <h1 className="rk-print-title">{p.plan_name}</h1>
            <p className="rk-print-summary">{p.summary}</p>
          </div>
        </header>

        <div className="rk-print-meta">
          <div><span className="rk-print-meta-label">{t('op_print_objective')}</span><span>{plan.objective_text || '—'}</span></div>
          <div><span className="rk-print-meta-label">{t('op_print_duration')}</span><span>{t('op_print_weeks_n', { n: p.weeks.length })}</span></div>
          <div><span className="rk-print-meta-label">{t('op_print_generated')}</span><span>{generatedOn}</span></div>
        </div>

        {/* Semanas */}
        {p.weeks.map((w) => (
          <section key={w.week} className="rk-print-week">
            <h2 className="rk-print-week-title">{t('op_week')} {w.week}</h2>
            <div className="rk-print-days">
              {DAY_ORDER.map((dayName) => {
                const d = w.days.find((x) => x.day === dayName);
                const kind = !d ? 'rest' : d.training ? 'training' : d.cardio ? 'cardio' : d.nutrition ? 'nutrition' : 'rest';
                const stripe = kind === 'training' ? '#E10600'
                  : kind === 'cardio' ? '#c26518'
                  : kind === 'nutrition' ? '#2f8a3d'
                  : '#ddd';
                const empty = kind === 'rest';
                return (
                  <div key={dayName} className={`rk-print-day ${empty ? 'is-rest' : ''}`} style={{ borderLeftColor: stripe }}>
                    <div className="rk-print-day-name">{dayName}</div>
                    {empty ? (
                      <div className="rk-print-day-rest">{t('op_day_rest')}</div>
                    ) : (
                      <>
                        {d?.training && <PrintField label={t('op_field_training')} value={d.training} color="#E10600" />}
                        {d?.cardio && <PrintField label={t('op_field_cardio')} value={d.cardio} color="#c26518" />}
                        {d?.nutrition && <PrintField label={t('op_field_nutrition')} value={d.nutrition} color="#2f8a3d" />}
                        {d?.notes && <PrintField label={t('op_field_notes')} value={d.notes} color="#a1852c" />}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <footer className="rk-print-footer">
          <p className="rk-print-disclaimer">
            <strong>{t('op_disclaimer_prefix')}</strong> {p.disclaimer}
          </p>
          <p className="rk-print-generated">{t('op_print_generated_by')} · {generatedOn}</p>
        </footer>
      </article>

      <style>{`
        /* Contenedor blanco, tipografías del sistema para máxima nitidez impresa. */
        .rk-plan-print {
          background: #f2f2f2;
          min-height: 100vh;
          color: #111;
          font-family: 'Barlow Condensed', system-ui, -apple-system, sans-serif;
          padding: 24px 12px 60px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        /* Toolbar */
        .rk-print-toolbar {
          max-width: 210mm; margin: 0 auto 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px;
        }
        .rk-print-back {
          background: transparent; border: none; color: #333; cursor: pointer; font-size: 14px; font-weight: 600;
        }
        .rk-print-btn {
          background: #E10600; color: #fff; border: none; border-radius: 8px; padding: 10px 18px;
          font-weight: 700; letter-spacing: 0.5px; cursor: pointer; box-shadow: 0 4px 14px rgba(225,6,0,0.3);
        }
        /* Hoja A4 */
        .rk-print-page {
          background: #fff; color: #111; max-width: 210mm; min-height: 297mm; margin: 0 auto;
          padding: 20mm 18mm; box-shadow: 0 4px 24px rgba(0,0,0,0.12); border-radius: 4px;
        }
        .rk-print-header {
          border-bottom: 3px solid #E10600; padding-bottom: 16px; margin-bottom: 20px;
          display: flex; align-items: flex-start; gap: 18px;
        }
        .rk-print-brand {
          font-family: 'Bebas Neue', sans-serif; font-size: 42px; line-height: 1; letter-spacing: 2px; flex-shrink: 0;
        }
        .rk-print-brand-w { color: #111; }
        .rk-print-brand-r { color: #E10600; }
        .rk-print-title-block { flex: 1; min-width: 0; }
        .rk-print-title {
          font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 1px; color: #111; margin: 0;
        }
        .rk-print-summary { color: #555; margin: 4px 0 0; font-size: 14px; line-height: 1.4; }

        .rk-print-meta {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;
          border: 1px solid #e8e8e8; border-left: 4px solid #C9A84C; padding: 12px 14px; border-radius: 4px;
        }
        .rk-print-meta > div { font-size: 13px; color: #222; display: flex; flex-direction: column; gap: 2px; }
        .rk-print-meta-label { font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: #888; font-weight: 700; }

        .rk-print-week { margin-bottom: 22px; break-inside: avoid; }
        .rk-print-week-title {
          font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; color: #E10600;
          margin: 0 0 10px; padding-bottom: 4px; border-bottom: 1px solid #eee;
        }
        .rk-print-days { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .rk-print-day {
          border: 1px solid #e8e8e8; border-radius: 4px; padding: 10px 12px; break-inside: avoid;
          border-left: 4px solid #E10600;
        }
        .rk-print-day.is-rest { border-left-color: #ddd; opacity: 0.75; }
        .rk-print-day-name {
          font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 1.5px; color: #111; margin-bottom: 6px;
        }
        .rk-print-day-rest { font-size: 12px; color: #999; font-style: italic; }

        .rk-print-field { margin-top: 6px; font-size: 12px; line-height: 1.35; }
        .rk-print-field-label {
          font-size: 9px; letter-spacing: 1.2px; text-transform: uppercase; font-weight: 700;
          margin-right: 6px;
        }
        .rk-print-field-value { color: #222; }

        .rk-print-footer {
          margin-top: 32px; padding-top: 14px; border-top: 1px solid #eee;
        }
        .rk-print-disclaimer { font-size: 11px; color: #555; line-height: 1.5; margin: 0; }
        .rk-print-generated { font-size: 10px; color: #999; letter-spacing: 1px; text-transform: uppercase; margin: 8px 0 0; }

        /* ── IMPRESIÓN ── */
        @media print {
          .rk-plan-print { background: #fff; padding: 0; }
          .rk-print-toolbar { display: none !important; }
          .rk-print-page { box-shadow: none; border-radius: 0; margin: 0; padding: 12mm 12mm; min-height: 0; max-width: none; }
          .rk-print-day { break-inside: avoid; }
          .rk-print-week { break-inside: avoid; }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  );
}

function PrintField({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rk-print-field">
      <span className="rk-print-field-label" style={{ color }}>{label}:</span>
      <span className="rk-print-field-value">{value}</span>
    </div>
  );
}
