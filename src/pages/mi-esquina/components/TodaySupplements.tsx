import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';

interface Props { profile: Profile }

interface CommonSupplement { id: string; name: string }
interface UserSupplement { id: string; supplement_id: string | null; custom_name: string | null; time_of_day: string | null; slot: string | null }

const SLOT_LABEL: Record<string, string> = {
  manana: 'mc_sup_slot_manana', con_comidas: 'mc_sup_slot_meals',
  post_entreno: 'mc_sup_slot_post', antes_dormir: 'mc_sup_slot_sleep', otro: 'mc_sup_slot_other',
};

/**
 * Referencia de "a qué hora toca qué" en Agenda › Plan (punto de la
 * suplementación: "que se añadan a tu agenda para ver cuándo los tomas").
 * Solo lectura — añadir/editar vive en Nutrición › Suplementos. No
 * renderiza nada si no hay suplementos con hora asignada.
 */
export default function TodaySupplements({ profile }: Props) {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<CommonSupplement[]>([]);
  const [items, setItems] = useState<UserSupplement[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: cat }, { data: rows }] = await Promise.all([
        supabase.from('common_supplements').select('id, name'),
        supabase.from('user_supplements').select('*').eq('fighter_profile_id', profile.id),
      ]);
      if (!alive) return;
      setCatalog((cat || []) as CommonSupplement[]);
      setItems((rows || []).map((r) => ({ ...r, slot: (r as { slot?: string | null }).slot ?? null })) as UserSupplement[]);
    })();
    return () => { alive = false; };
  }, [profile.id]);

  const catalogById = useMemo(() => {
    const m = new Map<string, string>();
    catalog.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [catalog]);

  const sorted = useMemo(() => {
    return items
      .filter((i) => i.time_of_day)
      .sort((a, b) => (a.time_of_day || '').localeCompare(b.time_of_day || ''));
  }, [items]);

  if (sorted.length === 0) return null;

  const fmtTime = (t24: string) => {
    const [h, m] = t24.split(':');
    const d = new Date(); d.setHours(parseInt(h, 10), parseInt(m, 10));
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="rk-card" style={{ padding: '14px 18px' }}>
      <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-[#C9A84C] mb-2.5 flex items-center gap-1.5">
        <i className="ri-capsule-line"></i>{t('mc_sup_today_title')}
      </p>
      <div className="flex flex-wrap gap-2">
        {sorted.map((item) => (
          <span key={item.id} className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-300 bg-white/[0.03] border border-white/10 px-2.5 py-1.5 rounded-lg">
            <span className="text-[#C9A84C]">
              {item.slot && SLOT_LABEL[item.slot] && item.slot !== 'otro' ? t(SLOT_LABEL[item.slot]) : fmtTime(item.time_of_day!)}
            </span>
            {item.custom_name || catalogById.get(item.supplement_id || '') || '—'}
          </span>
        ))}
      </div>
    </div>
  );
}
