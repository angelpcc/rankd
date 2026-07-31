import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, Profile, GymInvitation, GymStaff } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface StaffRow extends GymStaff { full_name: string | null; avatar_url: string | null; }

function makeCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function inviteLink(code: string): string {
  const base = __BASE_PATH__.replace(/\/$/, '');
  return `${window.location.origin}${base}/unirse?code=${code}`;
}

export default function GymCoaches({ profile, showToast }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [invites, setInvites] = useState<GymInvitation[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [creating, setCreating] = useState(false);
  const [freshLink, setFreshLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: inv, error } = await supabase.from('gym_invitations').select('*')
      .eq('org_profile_id', profile.id).order('created_at', { ascending: false });
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    setInvites((inv || []) as GymInvitation[]);

    const { data: st } = await supabase.from('gym_staff').select('*')
      .eq('org_profile_id', profile.id).eq('status', 'active').order('created_at', { ascending: true });
    const staffRows = (st || []) as GymStaff[];
    if (staffRows.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, avatar_url')
        .in('id', staffRows.map((s) => s.coach_profile_id));
      const map = new Map((profs || []).map((p) => [p.id, p]));
      setStaff(staffRows.map((s) => ({ ...s, full_name: map.get(s.coach_profile_id)?.full_name ?? null, avatar_url: map.get(s.coach_profile_id)?.avatar_url ?? null })));
    } else {
      setStaff([]);
    }
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const createInvite = async () => {
    setCreating(true);
    setFreshLink(null);
    const code = makeCode();
    const { data, error } = await supabase.from('gym_invitations').insert({
      org_profile_id: profile.id, code, invited_name: inviteName.trim() || null, role: 'coach', status: 'pending',
    }).select().maybeSingle();
    setCreating(false);
    if (error || !data) { showToast(t('error_save'), 'error'); return; }
    setInvites((list) => [data as GymInvitation, ...list]);
    setInviteName('');
    setFreshLink(inviteLink(code));
  };

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      showToast(t('cl_coaches_copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  const revoke = async (inv: GymInvitation) => {
    setInvites((list) => list.map((i) => i.id === inv.id ? { ...i, status: 'revoked' } : i));
    const { error } = await supabase.from('gym_invitations').update({ status: 'revoked' }).eq('id', inv.id);
    if (error) { showToast(t('error_save'), 'error'); load(); } else showToast(t('cl_coaches_revoked'));
  };

  const removeCoach = async (s: StaffRow) => {
    setStaff((list) => list.filter((x) => x.id !== s.id));
    const { error } = await supabase.from('gym_staff').update({ status: 'inactive' }).eq('id', s.id);
    if (error) { showToast(t('error_save'), 'error'); load(); } else showToast(t('cl_coaches_removed'));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '40px 24px' }}>
        <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25">
          <i className="ri-whistle-line text-2xl text-red-400" />
        </div>
        <p className="text-sm text-zinc-400 leading-relaxed">{t('cl_coaches_unavailable')}</p>
      </div>
    );
  }

  const pending = invites.filter((i) => i.status === 'pending');

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="rk-h3 text-white">{t('cl_coaches_title')}</h2>
          <p className="text-zinc-400 text-sm mt-1 max-w-md">{t('cl_coaches_sub')}</p>
        </div>
        <button onClick={() => navigate('/club')} className="rk-btn rk-btn-ghost flex items-center gap-2 flex-shrink-0" style={{ fontSize: '0.82rem', padding: '0.55rem 1rem' }}>
          <i className="ri-whistle-line" />{t('cl_coaches_open_space')}
        </button>
      </div>

      {/* Crear invitación */}
      <div className="rk-card" style={{ padding: 20 }}>
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><i className="ri-user-add-line text-red-400" />{t('cl_coaches_invite_title')}</h3>
        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{t('cl_coaches_invite_desc')}</p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('cl_coaches_name_label')}</label>
            <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} maxLength={60} className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder={t('cl_coaches_name_ph')} />
          </div>
          <button onClick={createInvite} disabled={creating} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.9rem' }}>
            {creating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><i className="ri-link" /> {t('cl_coaches_generate')}</>}
          </button>
        </div>

        {freshLink && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3.5">
            <p className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5"><i className="ri-checkbox-circle-line" />{t('cl_coaches_link_ready')}</p>
            <div className="flex items-center gap-2 mt-2">
              <input readOnly value={freshLink} className="flex-1 min-w-0 bg-black/30 border border-white/10 text-zinc-300 text-xs rounded-lg px-3 py-2 focus:outline-none" onFocus={(e) => e.currentTarget.select()} />
              <button onClick={() => copyLink(freshLink)} className="flex-shrink-0 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer transition-colors flex items-center gap-1">
                <i className={copied ? 'ri-check-line' : 'ri-file-copy-line'} />{copied ? t('cl_coaches_copied') : t('cl_coaches_copy')}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">{t('cl_coaches_share_hint')}</p>
          </div>
        )}
      </div>

      {/* Invitaciones pendientes */}
      {pending.length > 0 && (
        <div>
          <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-zinc-600 mb-3">{t('cl_coaches_pending_title')}</p>
          <div className="space-y-2">
            {pending.map((inv) => (
              <div key={inv.id} className="rk-card flex items-center gap-3" style={{ padding: '12px 14px' }}>
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center flex-shrink-0"><i className="ri-time-line" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{inv.invited_name || t('cl_coaches_status_pending')}</p>
                  <p className="text-[11px] text-zinc-500 font-mono truncate">{inv.code}</p>
                </div>
                <button onClick={() => copyLink(inviteLink(inv.code))} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-white cursor-pointer" title={t('cl_coaches_copy')}><i className="ri-file-copy-line text-sm" /></button>
                <button onClick={() => revoke(inv)} className="text-xs text-zinc-500 hover:text-red-400 cursor-pointer whitespace-nowrap px-1">{t('cl_coaches_revoke')}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Equipo activo */}
      <div>
        <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-zinc-600 mb-3">{t('cl_coaches_active_title')}</p>
        {staff.length === 0 ? (
          <div className="rk-card text-center" style={{ padding: '36px 20px' }}>
            <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25"><i className="ri-team-line text-xl text-red-400" /></div>
            <p className="text-sm font-bold text-white">{t('cl_coaches_empty_title')}</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">{t('cl_coaches_empty_desc')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {staff.map((s) => (
              <div key={s.id} className="rk-card flex items-center gap-3 group" style={{ padding: '12px 14px' }}>
                <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/25 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {s.avatar_url ? <img src={s.avatar_url} alt="" className="w-full h-full object-cover" /> : <i className="ri-user-line text-red-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{s.full_name || '—'}</p>
                  <p className="text-[11px] text-emerald-400 inline-flex items-center gap-1"><i className="ri-checkbox-circle-line" />{t('cl_coaches_status_accepted')}</p>
                </div>
                <button onClick={() => removeCoach(s)} className="text-xs text-zinc-500 hover:text-red-400 cursor-pointer whitespace-nowrap px-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">{t('cl_coaches_remove_coach')}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
