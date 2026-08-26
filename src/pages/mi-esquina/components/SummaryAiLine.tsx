import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';

// Línea "plan activo" del Resumen. Card oscura estándar con icono a la
// izquierda, label en dorado, título del plan.
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
    <button onClick={onOpen} className="rk-card w-full text-left cursor-pointer group flex items-center gap-3" style={{ padding: '16px 18px' }}>
      <span className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/25 text-[#C9A84C]">
        <i className="ri-sparkling-2-line text-lg"></i>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[11px] font-bold tracking-[0.16em] uppercase text-[#C9A84C]">{t('mc_ai_line_label')}</span>
        <span className="block text-sm mt-0.5 truncate text-white font-semibold group-hover:underline">{title}</span>
      </span>
      <i className="ri-arrow-right-line flex-shrink-0 text-zinc-500"></i>
    </button>
  );
}
