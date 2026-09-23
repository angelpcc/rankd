import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';

// Línea "plan activo" del Resumen. Card oscura estándar con icono a la
// izquierda (acento rojo RANKD), label y título del plan. Si no hay plan, no
// renderiza.
//
// ── EN QUÉ SEMANA VAS ──
//
// Con solo el título, la tarjeta decía que había un plan y nada más. Los
// planes del chat guardan cuándo empiezan y cuántas semanas duran
// (`week_start`, `weeks`), así que se puede decir "semana 2 de 4" y pintar los
// segmentos, que es lo que de verdad se viene a mirar. Los planes antiguos no
// lo guardaban: esos siguen enseñando solo el título.
//
// El título es el resumen del plan recortado a 120 letras; en una sola línea
// se quedaba en tres palabras, así que ahora tiene dos.

interface Props { profile: Profile; onOpen: () => void }

interface PlanJson { plan_title?: string; week_start?: string; weeks?: number }

export default function SummaryAiLine({ profile, onOpen }: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState<string | null>(null);
  const [semana, setSemana] = useState<{ n: number; total: number } | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.from('objective_plans').select('plan_json')
      .eq('fighter_profile_id', profile.id).eq('status', 'active').limit(1).maybeSingle()
      .then(({ data }) => {
        if (!alive || !data) return;
        const pj = (data as { plan_json?: PlanJson }).plan_json;
        if (pj?.plan_title) setTitle(pj.plan_title);
        const total = Number(pj?.weeks);
        if (pj?.week_start && Number.isFinite(total) && total > 0) {
          const ini = new Date(`${pj.week_start}T00:00:00`);
          const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
          // En días redondeados antes de dividir, por el cambio de hora: ver
          // la nota de `loadAgendaSnapshot`.
          const n = Math.floor(Math.round((hoy.getTime() - ini.getTime()) / 86400000) / 7) + 1;
          // Antes de empezar o ya terminado no hay "semana X de N" que valga.
          if (n >= 1 && n <= total) setSemana({ n, total });
        }
      });
    return () => { alive = false; };
  }, [profile.id]);

  if (!title) return null;

  return (
    <button onClick={onOpen} className="rk-card rk-press w-full text-left cursor-pointer group" style={{ padding: '16px 18px' }}>
      <span className="flex items-center gap-3">
        <span className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl" style={{ background: 'var(--accent-dim)', border: '1px solid rgba(225,6,0,0.28)', color: 'var(--accent)' }}>
          <i className="ri-sparkling-2-line text-lg"></i>
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center justify-between gap-2">
            <span className="rk-label">{t('mc_ai_line_label')}</span>
            {semana && (
              <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: 'var(--t-2)' }}>
                {t('mc_ai_line_week', { n: semana.n, total: semana.total })}
              </span>
            )}
          </span>
          <span className="block text-sm mt-0.5 line-clamp-2 text-white font-semibold leading-snug group-hover:underline">{title}</span>
        </span>
        <i className="ri-arrow-right-line flex-shrink-0 text-zinc-500 transition-transform group-hover:translate-x-0.5"></i>
      </span>
      {semana && (
        <span className="flex gap-1 mt-3" aria-hidden>
          {Array.from({ length: semana.total }, (_, i) => (
            <span key={i} className="flex-1" style={{
              height: 4, borderRadius: 999,
              background: i < semana.n - 1 ? 'var(--accent)' : i === semana.n - 1 ? 'rgba(225,6,0,0.45)' : 'var(--s-3)',
            }} />
          ))}
        </span>
      )}
    </button>
  );
}
