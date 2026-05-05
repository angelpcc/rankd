import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, UserType } from '@/lib/supabase';
import UserTypeSelector from './components/UserTypeSelector';

type AuthMode = 'login' | 'register';

function RankdLogo() {
  return (
    <div className="flex items-center gap-0">
      <span
        className="font-unbounded font-black tracking-tighter leading-none"
        style={{ fontSize: '28px', color: '#FFFFFF', letterSpacing: '-0.04em' }}
      >
        RAN
      </span>
      <span
        className="font-unbounded font-black tracking-tighter leading-none"
        style={{ fontSize: '28px', color: '#E10600', letterSpacing: '-0.04em' }}
      >
        KD
      </span>
    </div>
  );
}

export default function AuthPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mode, setMode] = useState<AuthMode>('login');
  const [userType, setUserType] = useState<UserType | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const redirectByRole = (userType: string, isNewUser = false) => {
    if (isNewUser) {
      switch (userType) {
        case 'fighter': navigate('/onboarding/fighter'); return;
        case 'brand':
        case 'promoter':
        case 'gym':
        case 'manager': navigate('/onboarding/org'); return;
        default: navigate('/dashboard'); return;
      }
    }
    switch (userType) {
      case 'fighter': navigate('/dashboard/fighter'); break;
      case 'brand': navigate('/dashboard/brand'); break;
      case 'promoter':
      case 'gym':
      case 'manager': navigate('/dashboard/org'); break;
      default: navigate('/dashboard');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      let msg = t('error_wrong_credentials');
      if (err.message.toLowerCase().includes('rate limit') || err.message.toLowerCase().includes('email rate')) {
        msg = t('error_rate_limit');
      } else if (err.message.toLowerCase().includes('email not confirmed')) {
        msg = t('error_email_not_confirmed');
      }
      setError(msg);
      setLoading(false);
      return;
    }
    if (data.user) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', data.user.id)
        .maybeSingle();
      redirectByRole(prof?.user_type ?? '');
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userType) { setError(t('error_select_account_type')); return; }
    setLoading(true);
    setError('');

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          user_type: userType,
        },
      },
    });

    if (signUpErr) {
      let msg = signUpErr.message;
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('email rate')) {
        msg = t('error_rate_limit');
      } else if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already been registered')) {
        msg = t('error_already_registered');
      } else if (msg.toLowerCase().includes('invalid email')) {
        msg = t('error_invalid_email');
      } else if (msg.toLowerCase().includes('password')) {
        msg = t('error_password_short');
      }
      setError(msg);
      setLoading(false);
      return;
    }

    if (data.user) {
      if (data.session) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          user_type: userType,
          full_name: fullName,
        }, { onConflict: 'id', ignoreDuplicates: true });
        redirectByRole(userType, true);
      } else {
        setSuccess(t('success_account_created'));
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] flex flex-col items-center justify-center relative overflow-hidden px-4 py-8 sm:py-12">
      {/* Background texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(225,6,0,0.07) 0%, transparent 70%)' }}
      />
      <div
        className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(225,6,0,0.04) 0%, transparent 70%)' }}
      />

      {/* Logo */}
      <div className="relative z-10 mb-7 sm:mb-10">
        <a href="/" className="inline-block">
          <RankdLogo />
        </a>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-[420px]">
        {/* Tabs */}
        <div className="flex bg-[#141414] rounded-2xl p-1 mb-6 sm:mb-8 border border-white/[0.06]">
          <button
            onClick={() => { setMode('login'); setStep(1); setError(''); }}
            className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap font-inter ${
              mode === 'login' ? 'bg-[#E10600] text-white' : 'text-white/35 hover:text-white/70'
            }`}
          >
            {t('auth_tab_login')}
          </button>
          <button
            onClick={() => { setMode('register'); setStep(1); setError(''); }}
            className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap font-inter ${
              mode === 'register' ? 'bg-[#E10600] text-white' : 'text-white/35 hover:text-white/70'
            }`}
          >
            {t('auth_tab_register')}
          </button>
        </div>

        {/* Form area */}
        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 sm:p-8">
          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="mb-6">
                <h1 className="text-xl font-bold text-white mb-1 font-unbounded">{t('auth_login_title')}</h1>
                <p className="text-white/30 text-sm font-inter">{t('auth_login_subtitle')}</p>
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-2 font-inter uppercase tracking-wide font-semibold">{t('label_email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="tu@email.com"
                  className="w-full bg-white/[0.04] border border-white/[0.08] text-white text-sm rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#E10600] placeholder-white/20 font-inter transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-2 font-inter uppercase tracking-wide font-semibold">{t('label_password')}</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-white/[0.04] border border-white/[0.08] text-white text-sm rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#E10600] placeholder-white/20 font-inter transition-colors"
                />
              </div>
              {error && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 font-inter">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#E10600] hover:bg-red-700 text-white font-semibold py-3.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 font-inter mt-2"
              >
                {loading ? t('auth_login_loading') : t('auth_login_btn')}
              </button>
              <p className="text-center text-white/25 text-sm font-inter pt-1">
                {t('auth_login_no_account')}{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-[#E10600] hover:text-red-400 cursor-pointer font-inter transition-colors"
                >
                  {t('auth_login_register_link')}
                </button>
              </p>
            </form>
          ) : (
            <>
              {step === 1 ? (
                <div className="space-y-5">
                  <div className="mb-6">
                    <h1 className="text-xl font-bold text-white mb-1 font-unbounded">{t('auth_register_step1_title')}</h1>
                    <p className="text-white/30 text-sm font-inter">{t('auth_register_step1_subtitle')}</p>
                  </div>
                  <UserTypeSelector selected={userType} onChange={setUserType} />
                  {error && (
                    <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 font-inter">
                      {error}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!userType) { setError(t('error_select_account_type')); return; }
                      setError('');
                      setStep(2);
                    }}
                    className="w-full bg-[#E10600] hover:bg-red-700 text-white font-semibold py-3.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap font-inter"
                  >
                    {t('auth_continue_btn')} <i className="ri-arrow-right-line ml-1"></i>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-5">
                  <div className="flex items-center gap-3 mb-6">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] text-white/40 hover:text-white cursor-pointer border border-white/[0.08] transition-colors"
                    >
                      <i className="ri-arrow-left-line text-sm"></i>
                    </button>
                    <div>
                      <h1 className="text-xl font-bold text-white font-unbounded">{t('auth_register_step2_title')}</h1>
                      <p className="text-white/30 text-sm font-inter">{t('auth_register_step2_subtitle')}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-2 font-inter uppercase tracking-wide font-semibold">{t('label_full_name')}</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      required
                      placeholder="Tu nombre"
                      className="w-full bg-white/[0.04] border border-white/[0.08] text-white text-sm rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#E10600] placeholder-white/20 font-inter transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-2 font-inter uppercase tracking-wide font-semibold">{t('label_email')}</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="tu@email.com"
                      className="w-full bg-white/[0.04] border border-white/[0.08] text-white text-sm rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#E10600] placeholder-white/20 font-inter transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-2 font-inter uppercase tracking-wide font-semibold">{t('label_password')}</label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full bg-white/[0.04] border border-white/[0.08] text-white text-sm rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#E10600] placeholder-white/20 font-inter transition-colors"
                    />
                  </div>
                  {error && (
                    <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 font-inter">
                      {error}
                    </p>
                  )}
                  {success && (
                    <p className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 font-inter">
                      {success}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#E10600] hover:bg-red-700 text-white font-semibold py-3.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 font-inter"
                  >
                    {loading ? t('auth_register_loading') : t('auth_register_btn')}
                  </button>
                  <p className="text-center text-white/20 text-xs font-inter pt-1">
                    {t('auth_register_terms')}{' '}
                    <a href="#" rel="nofollow" className="text-white/50 hover:text-white transition-colors">{t('auth_register_terms_link')}</a>
                    {' '}{t('auth_register_terms_and')}{' '}
                    <a href="#" rel="nofollow" className="text-white/50 hover:text-white transition-colors">{t('auth_register_privacy_link')}</a>
                  </p>
                </form>
              )}
            </>
          )}
        </div>

        {/* Bottom indicator */}
        <div className="flex items-center justify-center gap-2.5 mt-8">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0"></div>
          <p className="text-white/20 text-xs font-inter">{t('auth_platform_launch')}</p>
        </div>
      </div>
    </div>
  );
}
