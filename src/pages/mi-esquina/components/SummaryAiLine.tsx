import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';

// Línea "plan activo" del Resumen. PILOTO DE TEMA CLARO: card blanca con
// icono a la izquierda, label en el color de acento, título del plan grande.
// Con la IA en pausa no hay consejos en vivo; si no hay plan, no renderiza.

interface Props { profile: Profile; onOpen: () => void }

export default function SummaryAiLine({ profile, onOpen }: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.from('objective_plans').select('plan_json')
      .eq('fighter_profile_id', profile.id).eq('status', 'active').limit(1).maybeSingle()
      .then(({ data }) => {
        if (!alive || !data) return;
        const pj = (data as { plan_json?: { plan_title?: string } }).plan_json;
        if (pj?.plan_title) setTitle(pj.plan_title);
      });
    return () => { alive = false; };
  }, [profile.id]);

  if (!title) return null;

  return (
    <button onClick={onOpen} className="rk-lc w-full text-left cursor-pointer group flex items-center gap-3">
      <span style={{ width: 40, height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: 'rgba(138,109,31,0.10)', border: '1px solid rgba(138,109,31,0.28)', color: 'var(--rkl-data-highlight)' }}>
        <i className="ri-sparkling-2-line text-lg"></i>
      </span>
      <span className="flex-1 min-w-0">
        <span className="rk-lc-label" style={{ color: 'var(--rkl-data-highlight)' }}>{t('mc_ai_line_label')}</span>
        <span className="block text-sm mt-0.5 truncate group-hover:underline" style={{ color: 'var(--rkl-text-primary)', fontWeight: 600 }}>{title}</span>
      </span>
      <i className="ri-arrow-right-line flex-shrink-0" style={{ color: 'var(--rkl-text-muted)' }}></i>
    </button>
  );
}
