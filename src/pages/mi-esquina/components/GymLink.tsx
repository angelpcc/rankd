import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface RosterRow { id: string; org_profile_id: string; shares_activity: boolean; gym_name: string; }

// Aviso al boxeador de que su gimnasio lo ha añadido a su club. Él decide qué
// compartir: nada de Mi Esquina sale sin que active el interruptor.
export default function GymLink({ profile, showToast }: Props) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('gym_roster')
      .select('id, org_profile_id, shares_activity')
      .eq('fighter_profile_id', profile.id).eq('status', 'active');
    if (isMissingTable(error) || !data || data.length === 0) { setReady(true); return; }
    const orgIds = [...new Set(data.map((r) => r.org_profile_id))];
    const { data: orgs } = await supabase.from('organizations').select('profile_id, org_name').in('profile_id', orgIds);
    const nameMap = new Map((orgs || []).map((o) => [o.profile_id, o.org_name]));
    setRows(data.map((r) => ({ id: r.id, org_profile_id: r.org_profile_id, shares_activity: r.shares_activity, gym_name: nameMap.get(r.org_profile_id) || '' })));
    setReady(true);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const toggleShare = async (row: RosterRow) => {
    const next = !row.shares_activity;
    setRows((list) => list.map((r) => r.id === row.id ? { ...r, shares_activity: next } : r));
    const { error } = await supabase.from('gym_roster').update({ shares_activity: next }).eq('id', row.id);
    if (error) { setRows((list) => list.map((r) => r.id === row.id ? { ...r, shares_activity: !next } : r)); showToast(t('error_save'), 'error'); }
    else showToast(next ? t('cl_gym_link_sharing') : t('cl_gym_link_not_sharing'));
  };

  const leave = async (row: RosterRow) => {
    setRows((list) => list.filter((r) => r.id !== row.id));
    const { error } = await supabase.from('gym_roster').update({ status: 'left' }).eq('id', row.id);
    if (error) { showToast(t('error_save'), 'error'); load(); } else showToast(t('cl_gym_link_left'));
  };

  if (!ready || rows.length === 0) return null;

  return (
    <div className="rk-card" style={{ padding: '18px 20px', borderColor: 'rgba(201,168,76,0.25)' }}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#C9A84C]/12 border border-[#C9A84C]/30 text-[#C9A84C] flex-shrink-0"><i className="ri-building-4-line text-lg" /></div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">{t('cl_gym_link_title')}</p>
          <p className="text-[11px] text-zinc-500 leading-snug">{t('cl_gym_link_desc')}</p>
        </div>
      </div>
      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white truncate">{row.gym_name || '—'}</p>
              <button onClick={() => leave(row)} className="text-[11px] text-zinc-600 hover:text-red-400 cursor-pointer whitespace-nowrap">{t('cl_gym_link_leave')}</button>
            </div>
            <button onClick={() => toggleShare(row)} className="mt-2.5 w-full flex items-center gap-3 text-left cursor-pointer">
              <span className={`relative w-10 h-6 rounded-full flex-shrink-0 transition-colors ${row.shares_activity ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${row.shares_activity ? 'left-[18px]' : 'left-0.5'}`} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="text-xs font-medium text-white block">{t('cl_gym_link_share')}</span>
                <span className="text-[11px] text-zinc-500 block leading-snug">{t('cl_gym_link_share_hint')}</span>
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
