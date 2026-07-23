import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, UserType } from '@/lib/supabase';

type AuthMode = 'login' | 'register';

const COUNTRY_MAP: Record<string, string> = {
  'Spain': 'España', 'Mexico': 'México', 'Argentina': 'Argentina',
  'Colombia': 'Colombia', 'Chile': 'Chile', 'Peru': 'Perú',
  'Venezuela': 'Venezuela', 'Ecuador': 'Ecuador', 'Bolivia': 'Bolivia',
  'Uruguay': 'Uruguay', 'Paraguay': 'Paraguay', 'Cuba': 'Cuba',
  'Dominican Republic': 'República Dominicana', 'Puerto Rico': 'Puerto Rico',
  'Guatemala': 'Guatemala', 'Honduras': 'Honduras', 'El Salvador': 'El Salvador',
  'Nicaragua': 'Nicaragua', 'Costa Rica': 'Costa Rica', 'Panama': 'Panamá',
  'Brazil': 'Brasil', 'United States': 'Estados Unidos', 'United Kingdom': 'Reino Unido',
  'France': 'Francia', 'Germany': 'Alemania', 'Italy': 'Italia',
  'Portugal': 'Portugal', 'Netherlands': 'Países Bajos', 'Belgium': 'Bélgica',
  'Switzerland': 'Suiza', 'Austria': 'Austria', 'Poland': 'Polonia',
  'Romania': 'Rumanía', 'Ukraine': 'Ucrania', 'Russia': 'Rusia',
  'Sweden': 'Suecia', 'Norway': 'Noruega', 'Denmark': 'Dinamarca',
  'Morocco': 'Marruecos', 'Algeria': 'Argelia', 'Senegal': 'Senegal',
  'Nigeria': 'Nigeria', 'Philippines': 'Filipinas', 'Japan': 'Japón',
  'South Korea': 'Corea del Sur', 'Thailand': 'Tailandia', 'Australia': 'Australia',
};

async function detectCountryByIP(): Promise<string> {
  try {
    const res = await fetch('https://ipapi.co/json/');
    const json = await res.json();
    const raw = json.country_name || '';
    return COUNTRY_MAP[raw] || raw;
  } catch {
    return '';
  }
}

function RankdLogo() {
  return (
    <div className="flex items-center gap-0">
      <span className="font-unbounded font-black tracking-tighter leading-none" style={{ fontSize: '28px', color: '#FFFFFF', letterSpacing: '-0.04em' }}>RAN</span>
      <span className="font-unbounded font-black tracking-tighter leading-none" style={{ fontSize: '28px', color: '#E10600', letterSpacing: '-0.04em' }}>KD</span>
    </div>
  );
}

// ── Las 3 puertas de entrada ──
const MAIN_TYPES = [
  {
    key: 'fighter',
    userType: 'fighter' as UserType,
    icon: 'ri-boxing-line',
    title: 'Peleador',
    desc: 'Compitas o entrenes por afición, este es tu sitio',
    color: '#E10600',
    hasSubtypes: true,
  },
  {
    key: 'org',
    userType: null,
    icon: 'ri-trophy-line',
    title: 'Organización',
    desc: 'Promotoras, gimnasios, clubes y managers. Encuentra talento y publica oportunidades',
    color: '#C9A84C',
    hasSubtypes: true,
  },
  {
    key: 'brand',
    userType: 'brand' as UserType,
    icon: 'ri-store-2-line',
    title: 'Marca',
    desc: 'Patrocina peleadores y eventos. Muestra tus productos y servicios',
    color: '#ffffff',
    hasSubtypes: false,
  },
];

const ORG_SUBTYPES = [
  { userType: 'promoter' as UserType, icon: 'ri-trophy-line', label: 'Promotora', desc: 'Organizo eventos y combates' },
  { userType: 'gym' as UserType, icon: 'ri-building-4-line', label: 'Gimnasio / Club', desc: 'Represento a un gimnasio o club' },
  { userType: 'manager' as UserType, icon: 'ri-user-star-line', label: 'Manager', desc: 'Gestiono carreras de peleadores' },
];

const FIGHTER_MODES = [
  { mode: 'competitor' as const, icon: 'ri-trophy-line', label: 'Compito', desc: 'Tengo récord y busco oportunidades' },
  { mode: 'hobby' as const, icon: 'ri-heart-pulse-line', label: 'Entreno por afición', desc: 'Entreno sin competir: quiero Mi Esquina' },
];

const TYPE_LABELS: Record<string, string> = {
  fighter: 'Peleador', promoter: 'Promotora', gym: 'Gimnasio / Club', manager: 'Manager', brand: 'Marca',
};

export default function AuthPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mode, setMode] = useState<AuthMode>('login');
  const [userType, setUserType] = useState<UserType | null>(null);
  const [athleteMode, setAthleteMode] = useState<'competitor' | 'hobby'>('competitor');
  const [expanded, setExpanded] = useState<'fighter' | 'org' | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const redirectByRole = (ut: string, isNewUser = false) => {
    if (isNewUser) {
      switch (ut) {
        case 'fighter': navigate('/onboarding/fighter'); return;
        case 'brand':
        case 'promoter':
        case 'gym':
        case 'manager': navigate('/onboarding/org'); return;
        default: navigate('/dashboard'); return;
      }
    }
    switch (ut) {
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
      const { data: prof } = await supabase.from('profiles').select('user_type, athlete_mode').eq('id', data.user.id).maybeSingle();
      if (prof?.user_type === 'fighter' && prof?.athlete_mode === 'hobby') {
        navigate('/mi-esquina');
      } else {
        redirectByRole(prof?.user_type ?? '');
      }
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userType) { setError(t('error_select_account_type')); return; }
    setLoading(true);
    setError('');

    const country = await detectCountryByIP();

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          user_type: userType,
          athlete_mode: userType === 'fighter' ? athleteMode : null,
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
          country: country || null,
          athlete_mode: userType === 'fighter' ? athleteMode : null,
        }, { onConflict: 'id', ignoreDuplicates: true });
        if (userType === 'fighter' && athleteMode === 'hobby') {
          navigate('/mi-esquina');
        } else {
          redirectByRole(userType, true);
        }
      } else {
        setSuccess(t('success_account_created'));
      }
    }
    setLoading(false);
  };

  const selectType = (ut: UserType, mode: 'competitor' | 'hobby' = 'competitor') => {
    setUserType(ut);
    setAthleteMode(mode);
    setError('');
    setStep(2);
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] flex flex-col items-center justify-center relative overflow-hidden px-4 py-8 sm:py-12" style={{ paddingTop: 'calc(2rem + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '52px 52px' }} />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(225,6,0,0.08) 0%, transparent 70%)' }} />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 70%)' }} />

      <div className="relative z-10 mb-7 sm:mb-10">
        <a href="/beta" className="inline-block"><RankdLogo /></a>
      </div>

      <div className="relative z-10 w-full max-w-[440px]">
        {/* Tabs */}
        <div className="flex bg-[#141414] rounded-2xl p-1 mb-6 sm:mb-8 border border-white/[0.06]">
          <button onClick={() => { setMode('login'); setStep(1); setExpanded(null); setError(''); }} className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap font-inter ${mode === 'login' ? 'bg-[#E10600] text-white' : 'text-white/55 hover:text-white/85'}`}>
            {t('auth_tab_login')}
          </button>
          <button onClick={() => { setMode('register'); setStep(1); setError(''); }} className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap font-inter ${mode === 'register' ? 'bg-[#E10600] text-white' : 'text-white/55 hover:text-white/85'}`}>
            {t('auth_tab_register')}
          </button>
        </div>

        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 sm:p-8">
          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="mb-6">
                <h1 className="text-xl font-bold text-white mb-1 font-unbounded">{t('auth_login_title')}</h1>
                <p className="text-white/55 text-sm font-inter">{t('auth_login_subtitle')}</p>
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-2 font-inter uppercase tracking-wide font-semibold">{t('label_email')}</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="tu@email.com" className="w-full bg-white/[0.04] border border-white/[0.08] text-white text-sm rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#E10600] placeholder-white/20 font-inter transition-colors" />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-2 font-inter uppercase tracking-wide font-semibold">{t('label_password')}</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className="w-full bg-white/[0.04] border border-white/[0.08] text-white text-sm rounded-xl px-4 py-3.5 pr-11 focus:outline-none focus:border-[#E10600] placeholder-white/20 font-inter transition-colors" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 cursor-pointer transition-colors">
                    <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                  </button>
                </div>
              </div>
              {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 font-inter">{error}</p>}
              <button type="submit" disabled={loading} className="w-full bg-[#E10600] hover:bg-red-700 text-white font-semibold py-3.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 font-inter mt-2">
                {loading ? t('auth_login_loading') : t('auth_login_btn')}
              </button>
              <p className="text-center text-white/50 text-sm font-inter pt-1">
                {t('auth_login_no_account')}{' '}
                <button type="button" onClick={() => setMode('register')} className="text-[#E10600] hover:text-red-400 cursor-pointer font-inter transition-colors">{t('auth_login_register_link')}</button>
              </p>
            </form>
          ) : (
            <>
              {step === 1 ? (
                <div className="space-y-4">
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-bold text-[#E10600] bg-[#E10600]/10 border border-[#E10600]/25 px-2.5 py-1 rounded-full uppercase tracking-widest font-inter">Paso 1 de 2</span>
                    </div>
                    <h1 className="text-xl font-bold text-white mb-1 font-unbounded">¿Quién eres?</h1>
                    <p className="text-white/55 text-sm font-inter">Elige tu tipo de cuenta para empezar</p>
                  </div>

                  {MAIN_TYPES.map((tp) => {
                    const isOpen = expanded === tp.key;
                    return (
                    <div key={tp.key}>
                      <button
                        type="button"
                        onClick={() => {
                          if (tp.hasSubtypes) { setExpanded(isOpen ? null : (tp.key as 'fighter' | 'org')); }
                          else { setExpanded(null); selectType(tp.userType!); }
                        }}
                        className="w-full text-left rounded-2xl border transition-all cursor-pointer p-4 flex items-center gap-4 group"
                        style={{
                          background: isOpen ? `${tp.color}0d` : 'rgba(255,255,255,0.03)',
                          borderColor: isOpen ? `${tp.color}50` : 'rgba(255,255,255,0.08)',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${tp.color}60`; (e.currentTarget as HTMLButtonElement).style.background = `${tp.color}0d`; }}
                        onMouseLeave={(e) => { if (!isOpen) { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)'; } }}
                      >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border" style={{ background: `${tp.color}12`, borderColor: `${tp.color}30` }}>
                          <i className={tp.icon} style={{ color: tp.color, fontSize: 20 }}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-[15px] font-inter">{tp.title}</p>
                          <p className="text-white/55 text-xs font-inter leading-relaxed mt-0.5">{tp.desc}</p>
                        </div>
                        <i className={tp.hasSubtypes ? (isOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line') : 'ri-arrow-right-line'} style={{ color: 'rgba(255,255,255,0.35)', fontSize: 18, flexShrink: 0 }}></i>
                      </button>

                      {/* Sub-opciones Peleador */}
                      {tp.key === 'fighter' && isOpen && (
                        <div className="mt-2 ml-4 pl-4 border-l-2 border-[#E10600]/30 space-y-2">
                          {FIGHTER_MODES.map((fm) => (
                            <button
                              key={fm.mode}
                              type="button"
                              onClick={() => selectType('fighter' as UserType, fm.mode)}
                              className="w-full text-left rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-[#E10600]/[0.07] hover:border-[#E10600]/40 transition-all cursor-pointer px-4 py-3 flex items-center gap-3"
                            >
                              <i className={fm.icon} style={{ color: '#E10600', fontSize: 16, flexShrink: 0 }}></i>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-semibold text-sm font-inter">{fm.label}</p>
                                <p className="text-white/50 text-xs font-inter">{fm.desc}</p>
                              </div>
                              <i className="ri-arrow-right-line" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}></i>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Sub-opciones de Organización */}
                      {tp.key === 'org' && isOpen && (
                        <div className="mt-2 ml-4 pl-4 border-l-2 border-[#C9A84C]/25 space-y-2">
                          {ORG_SUBTYPES.map((sub) => (
                            <button
                              key={sub.userType}
                              type="button"
                              onClick={() => selectType(sub.userType)}
                              className="w-full text-left rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-[#C9A84C]/[0.07] hover:border-[#C9A84C]/40 transition-all cursor-pointer px-4 py-3 flex items-center gap-3"
                            >
                              <i className={sub.icon} style={{ color: '#C9A84C', fontSize: 16, flexShrink: 0 }}></i>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-semibold text-sm font-inter">{sub.label}</p>
                                <p className="text-white/50 text-xs font-inter">{sub.desc}</p>
                              </div>
                              <i className="ri-arrow-right-line" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}></i>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    );
                  })}

                  {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 font-inter">{error}</p>}
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-5">
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-bold text-[#E10600] bg-[#E10600]/10 border border-[#E10600]/25 px-2.5 py-1 rounded-full uppercase tracking-widest font-inter">Paso 2 de 2</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => { setStep(1); setError(''); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] text-white/40 hover:text-white cursor-pointer border border-white/[0.08] transition-colors flex-shrink-0">
                        <i className="ri-arrow-left-line text-sm"></i>
                      </button>
                      <div className="min-w-0">
                        <h1 className="text-xl font-bold text-white font-unbounded">Crea tu cuenta</h1>
                        <button type="button" onClick={() => { setStep(1); setError(''); }} className="flex items-center gap-1.5 text-xs text-white/55 hover:text-white/85 font-inter cursor-pointer transition-colors mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E10600]"></span>
                          {userType === 'fighter' && athleteMode === 'hobby' ? 'Entreno por afición' : TYPE_LABELS[userType || ''] || ''} · cambiar
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-2 font-inter uppercase tracking-wide font-semibold">{t('label_full_name')}</label>
                    <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder={userType === 'fighter' ? 'Tu nombre completo' : 'Nombre de tu organización o el tuyo'} className="w-full bg-white/[0.04] border border-white/[0.08] text-white text-sm rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#E10600] placeholder-white/20 font-inter transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-2 font-inter uppercase tracking-wide font-semibold">{t('label_email')}</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="tu@email.com" className="w-full bg-white/[0.04] border border-white/[0.08] text-white text-sm rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#E10600] placeholder-white/20 font-inter transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-2 font-inter uppercase tracking-wide font-semibold">{t('label_password')}</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" className="w-full bg-white/[0.04] border border-white/[0.08] text-white text-sm rounded-xl px-4 py-3.5 pr-11 focus:outline-none focus:border-[#E10600] placeholder-white/20 font-inter transition-colors" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 cursor-pointer transition-colors">
                        <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                      </button>
                    </div>
                  </div>
                  {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 font-inter">{error}</p>}
                  {success && <p className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 font-inter">{success}</p>}
                  <button type="submit" disabled={loading} className="w-full bg-[#E10600] hover:bg-red-700 text-white font-semibold py-3.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 font-inter">
                    {loading ? t('auth_register_loading') : t('auth_register_btn')}
                  </button>
                  <p className="text-center text-white/40 text-xs font-inter pt-1">
                    {t('auth_register_terms')}{' '}
                    <a href="/terms" className="text-white/70 hover:text-white underline underline-offset-2 transition-colors">{t('auth_register_terms_link')}</a>
                    {' '}{t('auth_register_terms_and')}{' '}
                    <a href="/privacy" className="text-white/70 hover:text-white underline underline-offset-2 transition-colors">{t('auth_register_privacy_link')}</a>
                  </p>
                </form>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-2.5 mt-8">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0"></div>
          <p className="text-white/45 text-xs font-inter">{t('auth_platform_launch')}</p>
        </div>
      </div>
    </div>
  );
}