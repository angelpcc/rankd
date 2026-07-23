import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, Profile, Fighter } from '@/lib/supabase';
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

const disciplineLabels: Record<string, string> = {
  boxing: 'Boxeo', mma: 'MMA', kickboxing: 'Kickboxing',
  muay_thai: 'Muay Thai', wrestling: 'Wrestling', bjj: 'BJJ', other: 'Otro',
};

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, VerifyResult>>({});
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

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

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/auth'); return; }
    if (!isAdmin) { setLoading(false); return; }
    load();
  }, [authLoading, user, isAdmin, navigate, load]);

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

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      {/* Barra */}
      <div className="fixed top-0 left-0 w-full z-40 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 rk-safe-top">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/beta')} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white cursor-pointer transition-colors">
            <i className="ri-arrow-left-line"></i> Inicio
          </button>
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 19, letterSpacing: 3 }}>PANEL</span>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 19, letterSpacing: 3 }} className="text-[#E10600]">ADMIN</span>
          </div>
          <button onClick={load} title="Actualizar" className="w-9 h-9 flex items-center justify-center rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white cursor-pointer transition-colors">
            <i className="ri-refresh-line"></i>
          </button>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 text-white text-sm px-5 py-3 rounded-xl flex items-center gap-2 ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          <i className={toast.ok ? 'ri-check-line' : 'ri-error-warning-line'}></i>{toast.msg}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-5 pb-16" style={{ paddingTop: 'calc(6rem + env(safe-area-inset-top, 0px))' }}>
        <div className="mb-7">
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(30px,5vw,44px)', letterSpacing: 1, lineHeight: 1 }}>
            SOLICITUDES DE <span className="text-[#E10600]">VERIFICACIÓN</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-2">
            {requests.length === 0 ? 'No hay solicitudes pendientes.' : `${requests.length} ${requests.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'} de revisión.`}
          </p>
        </div>

        {requests.length === 0 ? (
          <div className="text-center py-20 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
            <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4 rounded-2xl bg-green-500/10 border border-green-500/25">
              <i className="ri-check-double-line text-3xl text-green-400"></i>
            </div>
            <p className="text-zinc-300 font-medium">Todo al día</p>
            <p className="text-zinc-600 text-sm mt-1">Cuando alguien solicite verificación, aparecerá aquí.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => {
              const p = req.profile;
              const f = req.fighter;
              const r = results[p.id];
              const total = f ? f.wins + f.losses + f.draws : 0;
              return (
                <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
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
                          {p.user_type === 'fighter' ? 'Peleador' : p.user_type === 'brand' ? 'Marca' : p.user_type === 'promoter' ? 'Promotora' : p.user_type === 'gym' ? 'Gimnasio' : 'Manager'}
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
                    <div className="border-t border-zinc-800 p-5 bg-zinc-950/50 space-y-4">
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
                  <div className="border-t border-zinc-800 p-4 flex gap-2.5">
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
      </main>
    </div>
  );
}