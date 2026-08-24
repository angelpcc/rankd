import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, UserType } from '@/lib/supabase';
import { sendWelcomeEmail } from '@/lib/email';

type AuthMode = 'login' | 'register';

// Logo de Google en sus colores, para el botón de acceso.
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" className="flex-shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

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

// ── Las 3 puertas de entrada ── (etiquetas por clave i18n, prefijo auth_)
const MAIN_TYPES = [
  {
    key: 'fighter',
    userType: 'fighter' as UserType,
    icon: 'ri-boxing-line',
    titleKey: 'auth_at_fighter_title',
    descKey: 'auth_at_fighter_desc',
    color: '#E10600',
    hasSubtypes: true,
  },
  {
    key: 'org',
    userType: null,
    icon: 'ri-trophy-line',
    titleKey: 'auth_at_org_title',
    descKey: 'auth_at_org_desc',
    color: '#C9A84C',
    hasSubtypes: true,
  },
  {
    key: 'brand',
    userType: 'brand' as UserType,
    icon: 'ri-store-2-line',
    titleKey: 'auth_at_brand_title',
    descKey: 'auth_at_brand_desc',
    color: '#ffffff',
    hasSubtypes: false,
  },
];

const ORG_SUBTYPES = [
  { userType: 'promoter' as UserType, icon: 'ri-trophy-line', labelKey: 'auth_sub_promoter_label', descKey: 'auth_sub_promoter_desc' },
  { userType: 'gym' as UserType, icon: 'ri-building-4-line', labelKey: 'auth_sub_gym_label', descKey: 'auth_sub_gym_desc' },
  { userType: 'manager' as UserType, icon: 'ri-user-star-line', labelKey: 'auth_sub_manager_label', descKey: 'auth_sub_manager_desc' },
];

const FIGHTER_MODES = [
  { mode: 'competitor' as const, icon: 'ri-trophy-line', labelKey: 'auth_mode_competitor_label', descKey: 'auth_mode_competitor_desc' },
  { mode: 'hobby' as const, icon: 'ri-heart-pulse-line', labelKey: 'auth_mode_hobby_label', descKey: 'auth_mode_hobby_desc' },
];

// TYPE_LABELS reutiliza las claves de tipo ya definidas arriba.
const TYPE_LABEL_KEYS: Record<string, string> = {
  fighter: 'auth_at_fighter_title', promoter: 'auth_sub_promoter_label', gym: 'auth_sub_gym_label', manager: 'auth_sub_manager_label', brand: 'auth_at_brand_title',
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
  // Aceptación obligatoria de privacidad + términos (LEGAL_RANKD). Se guarda
  // como accepted_terms_at en profiles (mig 0032). Sin marcar, no se registra.
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // Usuario recién entrado con Google que aún no tiene tipo de cuenta: le
  // pedimos que lo elija antes de mandarlo a su onboarding.
  const [oauthUser, setOauthUser] = useState<User | null>(null);
  const oauthChoose = !!oauthUser;

  // Abrir directamente en registro (p. ej. desde una invitación de entrenador).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('register') === '1') { setMode('register'); setStep(1); }
  }, []);

  // Si el usuario venía de aceptar una invitación de entrenador, esa intención
  // manda sobre el enrutado normal por rol.
  const pendingInvite = () => { try { return localStorage.getItem('rankd_pending_invite'); } catch { return null; } };

  const redirectByRole = (ut: string, isNewUser = false) => {
    if (pendingInvite()) { navigate('/unirse'); return; }
    if (ut === 'coach') { navigate('/club'); return; }
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

  const routeByProfile = (ut: string, aMode: string | null, isNew = false) => {
    if (pendingInvite()) { navigate('/unirse'); return; }
    if (ut === 'fighter' && aMode === 'hobby') { navigate('/mi-esquina'); return; }
    redirectByRole(ut, isNew);
  };

  // Al volver del redirect de Google, Supabase deja la sesión lista. Si el
  // usuario ya tiene tipo de cuenta, lo llevamos a su espacio; si es nuevo
  // (Google no trae tipo), le pedimos que lo elija. Solo actuamos sobre
  // proveedores externos: el email/contraseña lo enrutan sus propios handlers.
  useEffect(() => {
    let alive = true;
    const handle = async (u: User) => {
      if (!alive) return;
      if ((u.app_metadata?.provider || 'email') === 'email') return;
      const { data: prof } = await supabase
        .from('profiles').select('user_type, athlete_mode').eq('id', u.id).maybeSingle();
      if (!alive) return;
      if (prof?.user_type) routeByProfile(prof.user_type, prof.athlete_mode ?? null);
      else { setOauthUser(u); setMode('register'); setStep(1); setExpanded(null); setError(''); }
    };
    supabase.auth.getSession().then(({ data: { session } }) => { if (session?.user) handle(session.user); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) handle(session.user);
    });
    return () => { alive = false; subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    // Si sale bien, el navegador se va a Google y no seguimos por aquí.
    if (err) { setError(t('auth_google_error')); setLoading(false); }
  };

  // El usuario de Google elige su tipo → creamos su perfil y a onboarding.
  const completeOauthProfile = async (ut: UserType, aMode: 'competitor' | 'hobby' = 'competitor') => {
    if (!oauthUser) return;
    setLoading(true);
    setError('');
    const meta = (oauthUser.user_metadata || {}) as Record<string, string>;
    const fullName = meta.full_name || meta.name || (oauthUser.email?.split('@')[0]) || '';
    const country = await detectCountryByIP();
    const { error: upErr } = await supabase.from('profiles').upsert({
      id: oauthUser.id,
      user_type: ut,
      full_name: fullName,
      country: country || null,
      athlete_mode: ut === 'fighter' ? aMode : null,
    }, { onConflict: 'id' });
    if (upErr) { setError(t('auth_oauth_error')); setLoading(false); return; }
    sendWelcomeEmail(oauthUser.email || '', fullName, ut);
    routeByProfile(ut, ut === 'fighter' ? aMode : null, true);
  };

  const cancelOauth = async () => {
    await supabase.auth.signOut();
    setOauthUser(null);
    setMode('login');
    setStep(1);
    setError('');
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
      if (pendingInvite()) {
        navigate('/unirse');
      } else if (prof?.user_type === 'fighter' && prof?.athlete_mode === 'hobby') {
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
    if (!acceptedTerms) { setError(t('auth_accept_terms_required')); return; }
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
      // Correo de bienvenida. Va sin await a propósito: si el servicio de
      // correo tarda o no está configurado, el registro no se queda esperando.
      sendWelcomeEmail(email, fullName, userType);

      if (data.session) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          user_type: userType,
          full_name: fullName,
          country: country || null,
          athlete_mode: userType === 'fighter' ? athleteMode : null,
          // Trazabilidad legal (mig 0032). Si la columna aún no existe,
          // el upsert se reintenta abajo sin el campo — nada bloquea.
          accepted_terms_at: new Date().toISOString(),
        }, { onConflict: 'id', ignoreDuplicates: true }).then(async ({ error: upsertErr }) => {
          // Si la columna accepted_terms_at no existe, reintentar sin ella.
          if (upsertErr && (upsertErr.code === '42703' || /accepted_terms_at/.test(upsertErr.message || ''))) {
            await supabase.from('profiles').upsert({
              id: data.user!.id,
              user_type: userType,
              full_name: fullName,
              country: country || null,
              athlete_mode: userType === 'fighter' ? athleteMode : null,
            }, { onConflict: 'id', ignoreDuplicates: true });
          }
        });
        if (pendingInvite()) {
          navigate('/unirse');
        } else if (userType === 'fighter' && athleteMode === 'hobby') {
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
    // Si viene de Google, ya tiene sesión: solo falta crear su perfil.
    if (oauthChoose) { completeOauthProfile(ut, mode); return; }
    setUserType(ut);
    setAthleteMode(mode);
    setError('');
    setStep(2);
  };

  // Botón de Google + separador "o", reutilizado en login y registro.
  const googleBlock = (
    <div className="space-y-4">
      <button type="button" onClick={handleGoogle} disabled={loading}
        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-white/90 text-[#1f1f1f] font-semibold py-3.5 rounded-xl transition-colors cursor-pointer disabled:opacity-60 font-inter">
        <GoogleIcon />
        {t('auth_google_btn')}
      </button>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/[0.08]"></div>
        <span className="text-white/40 text-xs font-inter uppercase tracking-widest">{t('auth_or')}</span>
        <div className="flex-1 h-px bg-white/[0.08]"></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0B0B0B] flex flex-col items-center justify-center relative overflow-hidden px-4 py-8 sm:py-12" style={{ paddingTop: 'calc(2rem + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '52px 52px' }} />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(225,6,0,0.08) 0%, transparent 70%)' }} />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 70%)' }} />

      <div className="relative z-10 mb-7 sm:mb-10">
        <a href="/beta" className="inline-block"><RankdLogo /></a>
      </div>

      <div className="relative z-10 w-full max-w-[440px]">
        {/* Tabs (ocultas cuando un usuario de Google elige su tipo de cuenta) */}
        {!oauthChoose && (
        <div className="flex bg-[#141414] rounded-2xl p-1 mb-6 sm:mb-8 border border-white/[0.06]">
          <button onClick={() => { setMode('login'); setStep(1); setExpanded(null); setError(''); }} className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap font-inter ${mode === 'login' ? 'bg-[#E10600] text-white' : 'text-white/55 hover:text-white/85'}`}>
            {t('auth_tab_login')}
          </button>
          <button onClick={() => { setMode('register'); setStep(1); setError(''); }} className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap font-inter ${mode === 'register' ? 'bg-[#E10600] text-white' : 'text-white/55 hover:text-white/85'}`}>
            {t('auth_tab_register')}
          </button>
        </div>
        )}

        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 sm:p-8">
          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="mb-6">
                <h1 className="text-xl font-bold text-white mb-1 font-unbounded">{t('auth_login_title')}</h1>
                <p className="text-white/55 text-sm font-inter">{t('auth_login_subtitle')}</p>
              </div>
              {googleBlock}
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
                      <span className="text-[10px] font-bold text-[#E10600] bg-[#E10600]/10 border border-[#E10600]/25 px-2.5 py-1 rounded-full uppercase tracking-widest font-inter">
                        {oauthChoose ? t('auth_oauth_badge') : t('auth_step_1_of_2')}
                      </span>
                    </div>
                    <h1 className="text-xl font-bold text-white mb-1 font-unbounded">{oauthChoose ? t('auth_oauth_choose_title') : t('auth_who_title')}</h1>
                    <p className="text-white/55 text-sm font-inter">{oauthChoose ? t('auth_oauth_choose_subtitle') : t('auth_who_subtitle')}</p>
                  </div>

                  {!oauthChoose && googleBlock}

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
                          <p className="text-white font-bold text-[15px] font-inter">{t(tp.titleKey)}</p>
                          <p className="text-white/55 text-xs font-inter leading-relaxed mt-0.5">{t(tp.descKey)}</p>
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
                                <p className="text-white font-semibold text-sm font-inter">{t(fm.labelKey)}</p>
                                <p className="text-white/50 text-xs font-inter">{t(fm.descKey)}</p>
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
                                <p className="text-white font-semibold text-sm font-inter">{t(sub.labelKey)}</p>
                                <p className="text-white/50 text-xs font-inter">{t(sub.descKey)}</p>
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

                  {oauthChoose && (
                    <button type="button" onClick={cancelOauth} className="w-full text-center text-white/45 hover:text-white/75 text-xs font-inter cursor-pointer transition-colors pt-1">
                      {t('auth_oauth_cancel')}
                    </button>
                  )}
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
                        <h1 className="text-xl font-bold text-white font-unbounded">{t('auth_register_step2_title')}</h1>
                        <button type="button" onClick={() => { setStep(1); setError(''); }} className="flex items-center gap-1.5 text-xs text-white/55 hover:text-white/85 font-inter cursor-pointer transition-colors mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E10600]"></span>
                          {userType === 'fighter' && athleteMode === 'hobby' ? t('auth_mode_hobby_label') : (TYPE_LABEL_KEYS[userType || ''] ? t(TYPE_LABEL_KEYS[userType || '']) : '')} · {t('auth_change')}
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
                  {/* Aceptación obligatoria (LEGAL_RANKD). Sin marcar, submit bloqueado. */}
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 w-5 h-5 rounded border-white/25 bg-white/[0.04] accent-[#E10600] cursor-pointer flex-shrink-0"
                    />
                    <span className="text-xs text-white/70 leading-relaxed font-inter">
                      <TermsAcceptText />
                    </span>
                  </label>
                  {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 font-inter">{error}</p>}
                  {success && <p className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 font-inter">{success}</p>}
                  <button type="submit" disabled={loading || !acceptedTerms} className="w-full bg-[#E10600] hover:bg-red-700 text-white font-semibold py-3.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed font-inter">
                    {loading ? t('auth_register_loading') : t('auth_register_btn')}
                  </button>
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

// Texto del checkbox de aceptación con enlaces a Privacidad y Términos.
// La clave i18n usa marcadores <p>...</p> (privacidad) y <t>...</t> (términos)
// que se sustituyen por <a> reales. Así el enlazado se localiza en el idioma
// que el usuario tenga activo, sin hardcodear posiciones ni orden.
function TermsAcceptText() {
  const { t } = useTranslation();
  const raw = t('auth_accept_terms');
  const regex = /<(p|t)>([^<]+)<\/\1>/g;
  const parts: React.ReactNode[] = [];
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = regex.exec(raw)) !== null) {
    if (m.index > last) parts.push(raw.slice(last, m.index));
    const href = m[1] === 'p' ? '/privacidad' : '/terms';
    parts.push(
      <a key={i++} href={href} target="_blank" rel="noopener noreferrer"
        className="text-white hover:text-white underline underline-offset-2">
        {m[2]}
      </a>
    );
    last = m.index + m[0].length;
  }
  if (last < raw.length) parts.push(raw.slice(last));
  return <>{parts}</>;
}
