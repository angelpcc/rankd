import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, Profile, UserType } from '@/lib/supabase';
import { setViewAs, clearViewAs, getViewAs, VIEW_AS_PRESETS, landingFor } from '@/lib/viewAs';

const TYPE_LABEL: Record<string, string> = {
  fighter: 'Peleador', promoter: 'Promotora', manager: 'Manager', brand: 'Marca', gym: 'Gimnasio',
};
const TYPE_COLOR: Record<string, string> = {
  fighter: '#E10600', promoter: '#fb923c', manager: '#38bdf8', brand: '#C9A84C', gym: '#34d399',
};

/**
 * Selector del modo "Ver como".
 *
 * Dos caminos: un perfil de prueba (para revisar la interfaz de cada tipo) o
 * un usuario real ya registrado (para verlo tal cual lo ve él). En ambos casos
 * la sesión sigue siendo la del administrador.
 */
export default function ViewAsPanel() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tab, setTab] = useState<'presets' | 'users'>('presets');
  const [users, setUsers] = useState<Profile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const current = getViewAs();

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setUsers((data || []) as Profile[]);
    setLoadingUsers(false);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (tab === 'users' && !loaded && !loadingUsers) loadUsers();
  }, [tab, loaded, loadingUsers, loadUsers]);

  const enterPreset = (id: string) => {
    const p = VIEW_AS_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setViewAs({
      kind: 'type',
      userType: p.userType,
      athleteMode: p.athleteMode,
      label: t(p.labelKey),
    });
    navigate(p.landing);
  };

  const enterUser = (u: Profile) => {
    setViewAs({
      kind: 'user',
      userType: u.user_type,
      athleteMode: (u.athlete_mode as 'competitor' | 'hobby' | null) ?? null,
      profileId: u.id,
      label: u.full_name || TYPE_LABEL[u.user_type] || 'Usuario',
      avatarUrl: u.avatar_url,
    });
    navigate(landingFor(u.user_type, u.athlete_mode ?? null));
  };

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (u.full_name || '').toLowerCase().includes(q) || (u.location || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <p className="rk-eyebrow">{t('va_eyebrow')}</p>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(30px,5vw,44px)', letterSpacing: 1, lineHeight: 1, marginTop: 4 }}>
          {t('va_title')} <span className="rk-red-glow">{t('va_title_2')}</span>
        </h1>
        <p className="text-zinc-400 text-sm mt-2 max-w-xl leading-relaxed">{t('va_sub')}</p>
      </div>

      {/* Ya estás dentro del modo */}
      {current && (
        <div className="rk-card flex items-start gap-4 flex-wrap sm:flex-nowrap" style={{ padding: '18px 20px', borderColor: 'rgba(201,168,76,0.4)', transform: 'none' }}>
          <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-2xl bg-[#C9A84C]/12 border border-[#C9A84C]/35 text-[#C9A84C]">
            <i className="ri-eye-line text-xl"></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#C9A84C]">{t('va_current_title')}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{t('va_current_desc', { name: current.label })}</p>
          </div>
          <button onClick={() => clearViewAs()} className="rk-btn rk-btn-primary w-full sm:w-auto flex-shrink-0" style={{ fontSize: '0.78rem', padding: '0.6rem 1.2rem' }}>
            {t('va_exit_now')}
          </button>
        </div>
      )}

      {/* Qué se puede y qué no */}
      <div className="rk-card" style={{ padding: '18px 20px', transform: 'none' }}>
        <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-500 mb-3">{t('va_safety_title')}</p>
        <ul className="space-y-2">
          {[
            { icon: 'ri-eye-line', color: '#22c55e', text: t('va_safety_read') },
            { icon: 'ri-lock-2-line', color: '#E10600', text: t('va_safety_write') },
            { icon: 'ri-shield-check-line', color: '#C9A84C', text: t('va_safety_session') },
          ].map((r) => (
            <li key={r.icon} className="flex items-start gap-2.5 text-xs text-zinc-300 leading-relaxed">
              <i className={r.icon} style={{ color: r.color, marginTop: 2 }}></i>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Pestañas */}
      <div className="flex gap-2">
        {([['presets', 'va_tab_presets', 'ri-shapes-line'], ['users', 'va_tab_users', 'ri-user-search-line']] as const).map(([id, key, icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer border ${tab === id ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/25'}`}>
            <i className={icon}></i>{t(key)}
          </button>
        ))}
      </div>

      {/* ── Perfiles de prueba ── */}
      {tab === 'presets' && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">{t('va_presets_hint')}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {VIEW_AS_PRESETS.map((p) => (
              <button key={p.id} onClick={() => enterPreset(p.id)} className="rk-card text-left group flex items-start gap-3.5" style={{ padding: 18, cursor: 'pointer' }}>
                <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl border"
                  style={{ background: `${p.color}14`, borderColor: `${p.color}40`, color: p.color }}>
                  <i className={`${p.icon} text-xl`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{t(p.labelKey)}</p>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{t(p.descKey)}</p>
                  <p className="text-xs font-bold mt-2.5 flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: p.color }}>
                    {t('va_start')} <i className="ri-arrow-right-line"></i>
                  </p>
                </div>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5">
            <i className="ri-information-line mt-0.5 flex-shrink-0"></i>{t('va_data_note')}
          </p>
        </div>
      )}

      {/* ── Usuario real ── */}
      {tab === 'users' && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">{t('va_users_hint')}</p>
          <div className="relative">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"></i>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('va_search_user')}
              className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-red-500 transition-colors" />
          </div>

          {loadingUsers ? (
            <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>
          ) : filtered.length === 0 ? (
            <div className="rk-card text-center" style={{ padding: '36px 24px' }}>
              <i className="ri-user-search-line text-3xl text-zinc-700"></i>
              <p className="text-sm text-zinc-400 mt-3">{t('va_no_users')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((u) => {
                const color = TYPE_COLOR[u.user_type] || '#a1a1aa';
                return (
                  <button key={u.id} onClick={() => enterUser(u)} className="rk-card w-full flex items-center gap-4 text-left group" style={{ padding: 14, cursor: 'pointer' }}>
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover object-top border border-zinc-700 flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-black text-zinc-600">{(u.full_name || 'U')[0].toUpperCase()}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white truncate">{u.full_name || '—'}</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>
                          {TYPE_LABEL[u.user_type] || u.user_type}
                        </span>
                        {u.user_type === 'fighter' && u.athlete_mode === 'hobby' && (
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-full">
                            {t('va_preset_fighter_hobby')}
                          </span>
                        )}
                      </div>
                      {u.location && <p className="text-xs text-zinc-500 mt-0.5 truncate">{u.location}</p>}
                    </div>
                    <span className="text-xs font-bold text-zinc-500 group-hover:text-white flex items-center gap-1 flex-shrink-0 transition-colors">
                      {t('va_start')} <i className="ri-arrow-right-line"></i>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5">
            <i className="ri-information-line mt-0.5 flex-shrink-0"></i>{t('va_data_note_user')}
          </p>
        </div>
      )}
    </div>
  );
}
