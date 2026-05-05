import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

function RankdLogo() {
  return (
    <div className="flex items-center gap-0">
      <span
        className="font-unbounded font-black tracking-tighter leading-none"
        style={{ fontSize: '26px', color: '#FFFFFF', letterSpacing: '-0.04em' }}
      >
        RAN
      </span>
      <span
        className="font-unbounded font-black tracking-tighter leading-none"
        style={{ fontSize: '26px', color: '#E10600', letterSpacing: '-0.04em' }}
      >
        KD
      </span>
    </div>
  );
}

export default function RegistroPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const valuePropKeys = [
    { icon: 'ri-trophy-line', titleKey: 'registro_prop1_title', descKey: 'registro_prop1_desc' },
    { icon: 'ri-user-search-line', titleKey: 'registro_prop2_title', descKey: 'registro_prop2_desc' },
    { icon: 'ri-flashlight-line', titleKey: 'registro_prop3_title', descKey: 'registro_prop3_desc' },
  ];

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          user_type: 'fighter',
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
          user_type: 'fighter',
          full_name: fullName,
        }, { onConflict: 'id', ignoreDuplicates: true });
        navigate('/onboarding/fighter');
      } else {
        setSuccess(t('success_account_created'));
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] flex flex-col lg:flex-row overflow-hidden">
      {/* LEFT PANEL — value props (hidden on small mobile, shown from sm up) */}
      <div className="relative flex-col justify-between lg:w-[52%] px-5 sm:px-8 md:px-16 pt-8 sm:pt-10 pb-8 sm:pb-12 lg:pt-14 lg:pb-16 overflow-hidden hidden sm:flex">
        {/* Background texture */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div
          className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(225,6,0,0.1) 0%, transparent 65%)' }}
        />
        <div
          className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(225,6,0,0.05) 0%, transparent 70%)' }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <a href="/" className="inline-block">
            <RankdLogo />
          </a>
        </div>

        {/* Main content */}
        <div className="relative z-10 mt-8 sm:mt-12 lg:mt-0">
          {/* Urgency badge */}
          <div className="inline-flex items-center gap-2 bg-[#E10600]/10 border border-[#E10600]/25 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-6 sm:mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-[#E10600] animate-pulse flex-shrink-0" />
            <span className="text-[#E10600] text-[10px] sm:text-xs font-semibold tracking-wide font-inter uppercase">
              {t('registro_badge')}
            </span>
          </div>

          {/* Headline */}
          <h1
            className="font-unbounded font-black text-white leading-[1.06] mb-5 sm:mb-6"
            style={{ fontSize: 'clamp(1.7rem, 4vw, 3.6rem)' }}
          >
            {t('registro_headline_1')}<br />
            {t('registro_headline_2')}<br />
            <span style={{ color: '#E10600' }}>{t('registro_headline_3')}</span>
          </h1>

          <p className="text-white/45 text-sm sm:text-base md:text-lg font-light leading-relaxed mb-8 sm:mb-12 max-w-md font-inter">
            {t('registro_subtext')}
          </p>

          {/* Value props */}
          <div className="space-y-6">
            {valuePropKeys.map((prop, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#E10600]/10 border border-[#E10600]/20 flex-shrink-0">
                  <i className={`${prop.icon} text-[#E10600] text-lg`} />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm mb-0.5 font-inter">{t(prop.titleKey)}</p>
                  <p className="text-white/35 text-sm font-inter leading-relaxed">{t(prop.descKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom note */}
        <div className="relative z-10 mt-12 lg:mt-0">
          <p className="text-white/20 text-xs font-inter">
            {t('registro_first_profiles')}
          </p>
        </div>
      </div>

      {/* RIGHT PANEL — form (full width on mobile) */}
      <div className="relative flex flex-col items-center justify-center w-full lg:w-[48%] px-5 sm:px-6 md:px-12 py-8 sm:py-12 lg:py-0">
        {/* Subtle separator */}
        <div className="hidden lg:block absolute left-0 top-12 bottom-12 w-px bg-white/[0.05]" />

        {/* Logo visible only on mobile (left panel is hidden) */}
        <div className="sm:hidden mb-8">
          <a href="/" className="inline-block">
            <RankdLogo />
          </a>
        </div>

        <div className="w-full max-w-[400px]">
          {/* Form header */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-2xl font-bold text-white font-unbounded mb-2">
              {t('registro_form_title')}
            </h2>
            <p className="text-white/35 text-sm font-inter">
              {t('registro_form_subtitle')}
            </p>
          </div>

          {success ? (
            <div className="bg-green-500/10 border border-green-500/25 rounded-2xl p-8 text-center">
              <div className="w-12 h-12 flex items-center justify-center rounded-full bg-green-500/15 mx-auto mb-4">
                <i className="ri-check-line text-green-400 text-2xl" />
              </div>
              <h3 className="text-white font-bold font-unbounded text-lg mb-2">{t('registro_success_title')}</h3>
              <p className="text-white/50 text-sm font-inter leading-relaxed">{success}</p>
              <button
                onClick={() => navigate('/auth')}
                className="mt-6 w-full bg-[#E10600] hover:bg-red-700 text-white font-semibold py-3.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap font-inter"
              >
                {t('registro_success_btn')}
              </button>
            </div>
          ) : (
            <>
              {step === 1 ? (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs text-white/40 mb-2 font-inter uppercase tracking-wide font-semibold">
                      {t('registro_label_name')}
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder={t('registro_placeholder_name')}
                      className="w-full bg-white/[0.04] border border-white/[0.08] text-white text-sm rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#E10600] placeholder-white/20 font-inter transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-2 font-inter uppercase tracking-wide font-semibold">
                      {t('registro_label_email')}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      className="w-full bg-white/[0.04] border border-white/[0.08] text-white text-sm rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#E10600] placeholder-white/20 font-inter transition-colors"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!fullName.trim() || !email.trim()) {
                        setError(t('error_fill_name_email'));
                        return;
                      }
                      setError('');
                      setStep(2);
                    }}
                    className="w-full bg-[#E10600] hover:bg-red-700 text-white font-semibold py-4 rounded-xl transition-colors cursor-pointer whitespace-nowrap font-inter text-base flex items-center justify-center gap-2"
                  >
                    {t('registro_btn_continue')}
                    <i className="ri-arrow-right-line" />
                  </button>
                  {error && (
                    <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 font-inter">
                      {error}
                    </p>
                  )}
                  <p className="text-center text-white/25 text-sm font-inter">
                    {t('registro_already_account')}{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/auth')}
                      className="text-[#E10600] hover:text-red-400 cursor-pointer font-inter transition-colors"
                    >
                      {t('registro_sign_in_link')}
                    </button>
                  </p>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-5">
                  <button
                    type="button"
                    onClick={() => { setStep(1); setError(''); }}
                    className="flex items-center gap-2 text-white/35 hover:text-white text-sm font-inter cursor-pointer transition-colors mb-2"
                  >
                    <i className="ri-arrow-left-line" />
                    {t('registro_back')}
                  </button>
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 mb-2">
                    <p className="text-white/30 text-xs font-inter mb-0.5">{t('registro_registering_as')}</p>
                    <p className="text-white text-sm font-semibold font-inter">{fullName} · {email}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-2 font-inter uppercase tracking-wide font-semibold">
                      {t('registro_label_password')}
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder={t('registro_placeholder_password')}
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
                    className="w-full bg-[#E10600] hover:bg-red-700 text-white font-semibold py-4 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 font-inter text-base"
                  >
                    {loading ? t('registro_btn_creating') : t('registro_btn_create')}
                  </button>
                  <p className="text-center text-white/20 text-xs font-inter">
                    {t('registro_terms')}{' '}
                    <a href="#" rel="nofollow" className="text-white/50 hover:text-white transition-colors">{t('registro_terms_link')}</a>
                    {' '}{t('registro_terms_and')}{' '}
                    <a href="#" rel="nofollow" className="text-white/50 hover:text-white transition-colors">{t('registro_privacy_link')}</a>
                  </p>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
