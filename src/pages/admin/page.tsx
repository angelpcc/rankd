import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, Profile, Fighter, UserType } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

// Correo con acceso al panel. Añade más si algún día tienes equipo.
const ADMIN_EMAILS = ['angelpc2005@gmail.com'];

interface Request {
  profile: Profile;
  fighter: Fighter | null;
}

interface VerifyResult {
  matches: { name: string; url: string; source: string }[];
  searchLinks: { source: string; url: string; note: string }[];
  needsManualReview: boolean;
}

interface PlatformStats {
  usersByType: Record<string, number>;
  totalUsers: number;
  publicFighters: number | null;
  activeOpps: number | null;
  conversations: number | null;
  waitlist: number | null;
}

const disciplineLabels: Record<string, string> = {
  boxing: 'Boxeo', mma: 'MMA', kickboxing: 'Kickboxing',
  muay_thai: 'Muay Thai', wrestling: 'Wrestling', bjj: 'BJJ', other: 'Otro',
};

const userTypeLabels: Record<string, string> = {
  fighter: 'Peleador', promoter: 'Promotora', manager: 'Manager', brand: 'Marca', gym: 'Gimnasio',
};
const userTypeColors: Record<string, string> = {
  fighter: 'bg-red-600/15 border-red-500/30 text-red-400',
  promoter: 'bg-orange-500/12 border-orange-500/30 text-orange-400',
  manager: 'bg-sky-500/12 border-sky-500/30 text-sky-400',
  brand: 'bg-[#C9A84C]/12 border-[#C9A84C]/35 text-[#C9A84C]',
  gym: 'bg-emerald-500/12 border-emerald-500/30 text-emerald-400',
};

type AdminTab = 'resumen' | 'verificaciones' | 'usuarios';

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<AdminTab>('resumen');
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, VerifyResult>>({});
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Resumen
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Usuarios
  const [users, setUsers] = useState<Profile[]>([]);
  const [fighterMap, setFighterMap] = useState<Map<string, { id: string; is_public: boolean }>>(new Map());
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | UserType>('all');

  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('verification_status', 'pending')
      .order('verification_requested_at', { ascending: true });

    if (!profiles || profiles.length === 0) { setRequests([]); setLoading(false); return; }

    const { data: fighters } = await supabase
      .from('fighters')
      .select('*')
      .in('profile_id', profiles.map((p) => p.id));

    const fmap = new Map((fighters || []).map((f) => [f.profile_id, f]));
    setRequests(profiles.map((p) => ({ profile: p, fighter: fmap.get(p.id) || null })));
    setLoading(false);
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    const [typesRes, publicRes, oppsRes, convosRes, waitRes] = await Promise.all([
      supabase.from('profiles').select('user_type'),
      supabase.from('fighters').select('id', { count: 'exact', head: true }).eq('is_public', true),
      supabase.from('opportunities').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('conversations').select('id', { count: 'exact', head: true }),
      supabase.from('waitlist').select('id', { count: 'exact', head: true }),
    ]);
    const byType: Record<string, number> = {};
    (typesRes.data || []).forEach((r) => { byType[r.user_type] = (byType[r.user_type] || 0) + 1; });
    setStats({
      usersByType: byType,
      totalUsers: (typesRes.data || []).length,
      publicFighters: publicRes.error ? null : (publicRes.count ?? 0),
      activeOpps: oppsRes.error ? null : (oppsRes.count ?? 0),
      conversations: convosRes.error ? null : (convosRes.count ?? 0),
      waitlist: waitRes.error ? null : (waitRes.count ?? 0),
    });
    setStatsLoading(false);
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    const [{ data: profiles }, { data: fighters }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('fighters').select('id, profile_id, is_public'),
    ]);
    setUsers(profiles || []);
    setFighterMap(new Map((fighters || []).map((f) => [f.profile_id, { id: f.id, is_public: f.is_public ?? false }])));
    setUsersLoading(false);
    setUsersLoaded(true);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/auth'); return; }
    if (!isAdmin) { setLoading(false); return; }
    load();
    loadStats();
  }, [authLoading, user, isAdmin, navigate, load, loadStats]);

  useEffect(() => {
    if (isAdmin && tab === 'usuarios' && !usersLoaded && !usersLoading) loadUsers();
  }, [isAdmin, tab, usersLoaded, usersLoading, loadUsers]);

  const refresh = () => {
    if (tab === 'resumen') loadStats();
    else if (tab === 'usuarios') loadUsers();
    else load();
  };

  const runCheck = async (req: Request) => {
    const id = req.profile.id;
    setChecking(id);
    try {
      const params = new URLSearchParams({
        name: req.profile.full_name || '',
        discipline: req.fighter?.discipline ? (disciplineLabels[req.fighter.discipline] || '') : '',
      });
      const res = await fetch(`/api/verify-fighter?${params}`);
      const data = await res.json();
      setResults((prev) => ({ ...prev, [id]: data }));
    } catch {
      showToast('No se pudo completar la búsqueda', false);
    }
    setChecking(null);
  };

  const decide = async (id: string, approve: boolean) => {
    setActing(id);
    const { error } = await supabase.from('profiles').update({
      verification_status: approve ? 'verified' : 'rejected',
      verified: approve,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    setActing(null);
    if (error) { showToast('Error al guardar', false); return; }
    setRequests((prev) => prev.filter((r) => r.profile.id !== id));
    showToast(approve ? 'Perfil verificado ✓' : 'Solicitud rechazada');
  };

  const filteredUsers = users.filter((u) => {
    if (typeFilter !== 'all' && u.user_type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const name = (u.full_name || '').toLowerCase();
      const loc = (u.location || '').toLowerCase();
      if (!name.includes(q) && !loc.includes(q)) return false;
    }
    return true;
  });

  if (authLoading || loading) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/30 mb-5">
          <i className="ri-lock-2-line text-2xl text-red-400"></i>
        </div>
        <h1 className="text-white text-xl font-bold">Acceso restringido</h1>
        <p className="text-zinc-500 text-sm mt-2">Esta zona es solo para administradores de RANKD.</p>
        <button onClick={() => navigate('/beta')} className="mt-6 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-6 py-3 rounded-xl cursor-pointer transition-colors">Volver al inicio</button>
      </div>
    );
  }

  const TABS: { id: AdminTab; label: string; icon: string; badge?: number }[] = [
    { id: 'resumen', label: 'Resumen', icon: 'ri-dashboard-line' },
    { id: 'verificaciones', label: 'Verificaciones', icon: 'ri-shield-check-line', badge: requests.length || undefined },
    { id: 'usuarios', label: 'Usuarios', icon: 'ri-group-line' },
  ];

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      {/* Barra */}
      <div className="fixed top-0 left-0 w-full z-40 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 rk-safe-top">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/beta')} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white cursor-pointer transition-colors">
            <i className="ri-arrow-left-line"></i> Inicio
          </button>
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 19, letterSpacing: 3 }}>PANEL</span>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 19, letterSpacing: 3 }} className="text-[#E10600]">ADMIN</span>
          </div>
          <button onClick={refresh} title="Actualizar" className="w-9 h-9 flex items-center justify-center rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white cursor-pointer transition-colors">
            <i className="ri-refresh-line"></i>
          </button>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 text-white text-sm px-5 py-3 rounded-xl flex items-center gap-2 ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          <i className={toast.ok ? 'ri-check-line' : 'ri-error-warning-line'}></i>{toast.msg}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-5 pb-16" style={{ paddingTop: 'calc(5.5rem + env(safe-area-inset-top, 0px))' }}>
        {/* Pestañas */}
        <div className="flex gap-2 mb-8 overflow-x-auto">
          {TABS.map((tb) => (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all cursor-pointer border ${tab === tb.id ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/25' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/25'}`}>
              <i className={tb.icon}></i>{tb.label}
              {tb.badge !== undefined && tb.badge > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === tb.id ? 'bg-white/20 text-white' : 'bg-red-600/20 text-red-400'}`}>{tb.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ══ RESUMEN ══ */}
        {tab === 'resumen' && (
          <div className="space-y-8">
            <div>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(30px,5vw,44px)', letterSpacing: 1, lineHeight: 1 }}>
                ESTADO DE LA <span className="rk-red-glow">PLATAFORMA</span>
              </h1>
              <p className="text-zinc-400 text-sm mt-2">Totales en tiempo real leídos de Supabase.</p>
            </div>

            {statsLoading || !stats ? (
              <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  {[
                    { l: 'Usuarios totales', v: stats.totalUsers, icon: 'ri-group-line', c: '#ffffff' },
                    { l: 'Peleadores públicos', v: stats.publicFighters, icon: 'ri-boxing-line', c: '#E10600' },
                    { l: 'Oportunidades activas', v: stats.activeOpps, icon: 'ri-megaphone-line', c: '#fb923c' },
                    { l: 'Conversaciones', v: stats.conversations, icon: 'ri-message-3-line', c: '#38bdf8' },
                    { l: 'Lista de espera', v: stats.waitlist, icon: 'ri-mail-line', c: '#C9A84C' },
                  ].map((s) => (
                    <div key={s.l} className="rk-card p-5">
                      <i className={`${s.icon} text-lg`} style={{ color: s.c }}></i>
                      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(30px,4vw,42px)', lineHeight: 1, color: s.c, marginTop: 10 }}>
                        {s.v === null ? '—' : s.v}
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-1.5 uppercase tracking-wider leading-tight">{s.l}</p>
                    </div>
                  ))}
                </div>

                <div className="rk-card p-6">
                  <h2 className="rk-h3" style={{ fontSize: '1.05rem', color: '#fff' }}>USUARIOS POR TIPO</h2>
                  <div className="mt-5 space-y-3.5">
                    {(['fighter', 'promoter', 'manager', 'brand', 'gym'] as const).map((tp) => {
                      const count = stats.usersByType[tp] || 0;
                      const pct = stats.totalUsers > 0 ? Math.round((count / stats.totalUsers) * 100) : 0;
                      return (
                        <div key={tp}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${userTypeColors[tp]}`}>{userTypeLabels[tp]}</span>
                            <span className="text-xs text-zinc-400"><span className="text-white font-bold">{count}</span> · {pct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: tp === 'fighter' ? '#E10600' : tp === 'brand' ? '#C9A84C' : tp === 'gym' ? '#34d399' : tp === 'promoter' ? '#fb923c' : '#38bdf8' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <button onClick={() => setTab('verificaciones')} className="rk-card p-5 text-left cursor-pointer flex items-center gap-4">
                    <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-red-600/12 border border-red-500/25 text-red-400 flex-shrink-0"><i className="ri-shield-check-line text-xl"></i></div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white">Verificaciones pendientes</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{requests.length === 0 ? 'Todo al día' : `${requests.length} ${requests.length === 1 ? 'solicitud espera' : 'solicitudes esperan'} revisión`}</p>
                    </div>
                    {requests.length > 0 && <span className="text-sm font-black text-red-400 bg-red-600/15 border border-red-500/30 px-2.5 py-1 rounded-full">{requests.length}</span>}
                  </button>
                  <button onClick={() => setTab('usuarios')} className="rk-card p-5 text-left cursor-pointer flex items-center gap-4">
                    <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/[0.05] border border-white/10 text-zinc-300 flex-shrink-0"><i className="ri-group-line text-xl"></i></div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white">Explorar usuarios</p>
                      <p className="text-xs text-zinc-400 mt-0.5">Busca y filtra los perfiles registrados</p>
                    </div>
                    <i className="ri-arrow-right-line text-zinc-500"></i>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ VERIFICACIONES ══ */}
        {tab === 'verificaciones' && (
          <div>
            <div className="mb-7">
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(30px,5vw,44px)', letterSpacing: 1, lineHeight: 1 }}>
                SOLICITUDES DE <span className="text-[#E10600]">VERIFICACIÓN</span>
              </h1>
              <p className="text-zinc-400 text-sm mt-2">
                {requests.length === 0 ? 'No hay solicitudes pendientes.' : `${requests.length} ${requests.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'} de revisión.`}
              </p>
            </div>

            {requests.length === 0 ? (
              <div className="text-center py-20 rk-card">
                <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4 rounded-2xl bg-green-500/10 border border-green-500/25">
                  <i className="ri-check-double-line text-3xl text-green-400"></i>
                </div>
                <p className="text-zinc-300 font-medium">Todo al día</p>
                <p className="text-zinc-600 text-sm mt-1">Cuando alguien solicite verificación, aparecerá aquí.</p>
              </div>
            ) : (
              <div className="space-y-4 max-w-5xl">
                {requests.map((req) => {
                  const p = req.profile;
                  const f = req.fighter;
                  const r = results[p.id];
                  const total = f ? f.wins + f.losses + f.draws : 0;
                  return (
                    <div key={p.id} className="rk-card overflow-hidden">
                      {/* Cabecera */}
                      <div className="p-5 flex items-start gap-4 flex-wrap sm:flex-nowrap">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="w-14 h-14 rounded-xl object-cover object-top border border-zinc-700 flex-shrink-0" />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                            <span className="text-lg font-black text-zinc-600">{(p.full_name || 'U')[0].toUpperCase()}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-base font-bold text-white">{p.full_name || 'Sin nombre'}</h2>
                            <span className="text-[10px] font-bold text-zinc-300 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full uppercase">
                              {userTypeLabels[p.user_type] || p.user_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1 flex-wrap">
                            {f?.discipline && <span>{disciplineLabels[f.discipline] || f.discipline}</span>}
                            {f?.weight_class && <span>· {f.weight_class}</span>}
                            {p.location && <span>· {p.location}</span>}
                            {p.verification_requested_at && (
                              <span>· Solicitado {new Date(p.verification_requested_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                            )}
                          </div>
                          {f && total > 0 && (
                            <div className="flex items-center gap-3 mt-2.5 text-sm">
                              <span className="text-green-400 font-bold">{f.wins}V</span>
                              <span className="text-red-400 font-bold">{f.losses}D</span>
                              <span className="text-yellow-400 font-bold">{f.draws}E</span>
                              <span className="text-orange-400 font-bold">{f.kos} KO</span>
                              <span className="text-zinc-600 text-xs">· {total} combates declarados</span>
                            </div>
                          )}
                        </div>
                        <button onClick={() => runCheck(req)} disabled={checking === p.id}
                          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap">
                          {checking === p.id ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Buscando...</> : <><i className="ri-search-eye-line"></i> Comprobar récord</>}
                        </button>
                      </div>

                      {/* Resultados de la búsqueda */}
                      {r && (
                        <div className="border-t border-white/[0.07] p-5 bg-black/30 space-y-4">
                          {r.matches.length > 0 ? (
                            <div>
                              <p className="text-xs font-bold text-green-400 flex items-center gap-1.5 mb-2">
                                <i className="ri-check-double-line"></i>{r.matches.length} coincidencia{r.matches.length > 1 ? 's' : ''} encontrada{r.matches.length > 1 ? 's' : ''}
                              </p>
                              <div className="space-y-1.5">
                                {r.matches.map((m) => (
                                  <a key={m.url} href={m.url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-white bg-green-500/[0.07] border border-green-500/25 rounded-xl px-3.5 py-2.5 hover:border-green-500/50 transition-colors">
                                    <i className="ri-external-link-line text-green-400"></i>
                                    <span className="flex-1">{m.name}</span>
                                    <span className="text-[10px] text-zinc-500 uppercase">{m.source}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2.5 bg-yellow-500/[0.07] border border-yellow-500/25 rounded-xl px-4 py-3">
                              <i className="ri-alert-line text-yellow-400 mt-0.5"></i>
                              <div>
                                <p className="text-xs font-bold text-yellow-400">Sin coincidencias automáticas</p>
                                <p className="text-[11px] text-zinc-400 mt-0.5">Revisa manualmente en los enlaces de abajo antes de decidir.</p>
                              </div>
                            </div>
                          )}

                          <div>
                            <p className="text-xs font-semibold text-zinc-400 mb-2">Comprobar en las fuentes oficiales</p>
                            <div className="grid sm:grid-cols-2 gap-2">
                              {r.searchLinks.map((l) => (
                                <a key={l.source} href={l.url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl px-3.5 py-2.5 transition-colors">
                                  <i className="ri-search-line text-zinc-500"></i>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-white">{l.source}</p>
                                    <p className="text-[10px] text-zinc-500 truncate">{l.note}</p>
                                  </div>
                                  <i className="ri-external-link-line text-zinc-600 text-xs"></i>
                                </a>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Decisión */}
                      <div className="border-t border-white/[0.07] p-4 flex gap-2.5">
                        <button onClick={() => decide(p.id, true)} disabled={acting === p.id}
                          className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold py-3 rounded-xl transition-colors cursor-pointer disabled:opacity-60">
                          <i className="ri-shield-check-line"></i> Verificar
                        </button>
                        <button onClick={() => decide(p.id, false)} disabled={acting === p.id}
                          className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-red-600/20 border border-zinc-700 hover:border-red-500/40 text-zinc-300 hover:text-red-400 text-sm font-bold py-3 rounded-xl transition-colors cursor-pointer disabled:opacity-60">
                          <i className="ri-close-circle-line"></i> Rechazar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ USUARIOS ══ */}
        {tab === 'usuarios' && (
          <div className="space-y-6">
            <div>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(30px,5vw,44px)', letterSpacing: 1, lineHeight: 1 }}>
                USUARIOS <span className="rk-red-glow">REGISTRADOS</span>
              </h1>
              <p className="text-zinc-400 text-sm mt-2">
                {usersLoading ? 'Cargando...' : `${filteredUsers.length} de ${users.length} ${users.length === 1 ? 'perfil' : 'perfiles'} (máx. 500 más recientes)`}
              </p>
            </div>

            {/* Buscador + filtro */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"></i>
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-red-500"
                  placeholder="Buscar por nombre o ubicación..." />
              </div>
              <div className="flex gap-1.5 overflow-x-auto">
                {([['all', 'Todos'], ['fighter', 'Peleadores'], ['promoter', 'Promotoras'], ['manager', 'Managers'], ['brand', 'Marcas'], ['gym', 'Gimnasios']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setTypeFilter(val as 'all' | UserType)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${typeFilter === val ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/25'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {usersLoading ? (
              <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-16 rk-card">
                <i className="ri-user-search-line text-4xl text-zinc-700"></i>
                <p className="text-zinc-400 text-sm mt-3 font-medium">Sin resultados</p>
                <p className="text-zinc-600 text-xs mt-1">Prueba con otro nombre u otro filtro.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map((u) => {
                  const f = u.user_type === 'fighter' ? fighterMap.get(u.id) : undefined;
                  return (
                    <div key={u.id} className="rk-card p-4 flex items-center gap-4">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-11 h-11 rounded-xl object-cover object-top border border-zinc-700 flex-shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-black text-zinc-600">{(u.full_name || 'U')[0].toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-white truncate">{u.full_name || 'Sin nombre'}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${userTypeColors[u.user_type] || 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                            {userTypeLabels[u.user_type] || u.user_type}
                          </span>
                          {u.verified && <i className="ri-shield-check-fill text-green-400 text-sm" title="Verificado"></i>}
                          {u.verification_status === 'pending' && <span className="text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/25 px-1.5 py-0.5 rounded-full">Pend. verificación</span>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1 flex-wrap">
                          {u.location && <span className="flex items-center gap-1"><i className="ri-map-pin-line"></i>{u.location}</span>}
                          <span>· Alta {new Date(u.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          {u.user_type === 'fighter' && f && (
                            <span className={f.is_public ? 'text-green-400' : 'text-zinc-500'}>· {f.is_public ? 'Perfil público' : 'Perfil oculto'}</span>
                          )}
                        </div>
                      </div>
                      {f && f.is_public && (
                        <a href={`/fighter/${f.id}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 bg-white/[0.04] border border-white/10 hover:border-white/30 hover:text-white px-3 py-2 rounded-xl transition-colors whitespace-nowrap flex-shrink-0">
                          <i className="ri-external-link-line"></i><span className="hidden sm:inline">Ver perfil</span>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
