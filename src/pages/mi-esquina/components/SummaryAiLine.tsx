import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';

// Línea de recomendación del resumen (bloque C.1, 3er elemento). Una sola línea
// clicable. Con la IA en pausa no hay consejos en vivo, así que apunta al PLAN
// activo (el que la IA generó): "Sigue tu plan: {título}". Si no hay plan, no
// renderiza nada (el hero "HOY" ya invita a crearlo).

interface Props { profile: Profile; onOpen: () => void; }

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
    <button onClick={onOpen}
      className="w-full flex items-center gap-3 rk-card text-left cursor-pointer group" style={{ padding: '12px 16px' }}>
      <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-[#C9A84C]/12 border border-[#C9A84C]/30 text-[#C9A84C]">
        <i className="ri-sparkling-2-line"></i>
      </span>
      <span className="flex-1 min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#C9A84C]">{t('mc_ai_line_label')}</span>
        <span className="block text-sm text-zinc-200 truncate group-hover:text-white">{title}</span>
      </span>
      <i className="ri-arrow-right-line text-zinc-600 group-hover:text-[#C9A84C] transition-colors flex-shrink-0"></i>
    </button>
  );
}
