import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useSEO } from '@/hooks/useSEO';

const PENDING_KEY = 'rankd_pending_invite';

// Aceptación de invitación de entrenador. Si no hay sesión, guarda el código y
// manda a /auth; al volver con sesión, se acepta y entra al espacio de club.
export default function ClubInvitePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const { user, loading: authLoading, refetchProfile } = useAuth();

  const code = params.get('code') || (typeof localStorage !== 'undefined' ? localStorage.getItem(PENDING_KEY) : null) || '';

  const [info, setInfo] = useState<{ found: boolean; status?: string; gym?: string } | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useSEO({ title: 'Invitación de entrenador | RANKD', description: 'Únete a tu club en RANKD como entrenador.' });

  useEffect(() => {
    if (!code) { setInfo({ found: false }); return; }
    supabase.rpc('rk_gym_invite_info', { p_code: code }).then(({ data }) => {
      setInfo((data as { found: boolean; status?: string; gym?: string }) || { found: false });
    });
  }, [code]);

  const accept = useCallback(async () => {
    if (!code || !user) return;
    setAccepting(true);
    setError('');
    const { data, error: err } = await supabase.rpc('rk_accept_gym_invite', { p_code: code });
    const res = data as { ok?: boolean; error?: string } | null;
    if (err || !res?.ok) {
      setError(res?.error === 'invalid' ? t('cl_join_error_invalid') : t('cl_join_error_generic'));
      setAccepting(false);
      return;
    }
    try { localStorage.removeItem(PENDING_KEY); } catch { /* noop */ }
    if (refetchProfile) refetchProfile();
    setDone(true);
    setAccepting(false);
    setTimeout(() => navigate('/club'), 1200);
  }, [code, user, refetchProfile, navigate, t]);

  const goAuth = (mode: 'login' | 'register') => {
    try { if (code) localStorage.setItem(PENDING_KEY, code); } catch { /* noop */ }
    navigate(`/auth${mode === 'register' ? '?register=1' : ''}`);
  };

  const gym = info?.gym || '';
  const invalid = info && (!info.found || (info.status && info.status !== 'pending'));

  return (
    <div className="min-h-screen bg-[#070707] text-white flex items-center justify-center px-5">
      <div className="rk-card w-full max-w-md text-center" style={{ padding: '44px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
          <i className="ri-whistle-line text-3xl text-red-400" />
        </div>

        {!info ? (
          <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
        ) : done ? (
          <>
            <h1 className="rk-h3" style={{ fontSize: '1.5rem', color: '#fff' }}>{t('cl_join_success')}</h1>
            <p className="text-sm text-zinc-400 mt-2">{gym}</p>
          </>
        ) : invalid ? (
          <>
            <h1 className="rk-h3" style={{ fontSize: '1.4rem', color: '#fff' }}>{info.found ? t('cl_join_already') : t('cl_join_not_found')}</h1>
            <button onClick={() => navigate('/beta')} className="rk-btn rk-btn-ghost mt-5" style={{ fontSize: '0.85rem' }}>{t('cl_back_home')}</button>
          </>
        ) : (
          <>
            <p className="rk-eyebrow">{t('cl_join_eyebrow')}</p>
            <h1 className="rk-h3" style={{ fontSize: '1.5rem', color: '#fff', marginTop: 4 }}>{t('cl_join_title')}</h1>
            {gym && (
              <p className="text-sm text-zinc-400 mt-2">{t('cl_join_to')} <span className="text-white font-bold">{gym}</span></p>
            )}
            <p className="text-xs text-zinc-500 mt-3 leading-relaxed">{t('cl_join_desc')}</p>

            {error && <p className="text-sm text-red-400 mt-4">{error}</p>}

            {authLoading ? (
              <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mt-6" />
            ) : user ? (
              <button onClick={accept} disabled={accepting} className="rk-btn rk-btn-primary w-full mt-6 flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.95rem' }}>
                {accepting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('cl_join_accepting')}</> : <><i className="ri-check-line" /> {t('cl_join_accept')}</>}
              </button>
            ) : (
              <div className="mt-6 space-y-2.5">
                <p className="text-xs text-zinc-400">{t('cl_join_need_account')}</p>
                <button onClick={() => goAuth('register')} className="rk-btn rk-btn-primary w-full" style={{ fontSize: '0.9rem' }}>{t('cl_join_register')}</button>
                <button onClick={() => goAuth('login')} className="rk-btn rk-btn-ghost w-full" style={{ fontSize: '0.9rem' }}>{t('cl_join_login')}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
