import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  showToast: (msg: string, ok?: boolean) => void;
}

interface PendingBrand {
  id: string;
  name: string;
  email: string;
  website: string | null;
  category: string | null;
  description: string;
  logo_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  is_public: boolean;
  created_at: string;
}

interface PublicItem {
  id: string;
  label: string;
  sub: string;
  image: string | null;
  table: 'organization_events' | 'opportunities';
  href: string;
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ModerationPanel({ showToast }: Props) {
  const [brands, setBrands] = useState<PendingBrand[]>([]);
  const [live, setLive] = useState<PublicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [b, ev, op] = await Promise.all([
      supabase.from('brands').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('organization_events').select('id, title, location, event_date, image_url, created_at').order('created_at', { ascending: false }).limit(12),
      supabase.from('opportunities').select('id, title, type, location, created_at').eq('status', 'open').order('created_at', { ascending: false }).limit(12),
    ]);
    setBrands((b.data || []) as PendingBrand[]);
    setLive([
      ...(ev.data || []).map((e) => ({
        id: e.id, label: e.title, image: e.image_url, table: 'organization_events' as const,
        sub: [e.location, e.event_date && new Date(e.event_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })].filter(Boolean).join(' · '),
        href: `/evento/${e.id}`,
      })),
      ...(op.data || []).map((o) => ({
        id: o.id, label: o.title, image: null, table: 'opportunities' as const,
        sub: [o.type, o.location].filter(Boolean).join(' · '),
        href: '/opportunities',
      })),
    ]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const decideBrand = async (id: string, approve: boolean) => {
    setActing(id);
    const { error } = await supabase.from('brands').update({
      status: approve ? 'approved' : 'rejected',
      is_public: approve,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    setActing(null);
    if (error) { showToast('No se pudo guardar la decisión', false); return; }
    setBrands((prev) => prev.filter((x) => x.id !== id));
    showToast(approve ? 'Marca aprobada y publicada ✓' : 'Marca rechazada');
  };

  // Retirar de la vista pública sin borrar nada: reversible desde la propia tabla.
  const unpublish = async (item: PublicItem) => {
    setActing(item.id);
    const patch = item.table === 'opportunities' ? { status: 'closed' } : { status: 'draft' };
    const { error } = await supabase.from(item.table).update(patch).eq('id', item.id);
    setActing(null);
    if (error) { showToast('No se pudo retirar el contenido', false); return; }
    setLive((prev) => prev.filter((x) => x.id !== item.id));
    showToast('Retirado de la vista pública ✓');
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(30px,5vw,44px)', letterSpacing: 1, lineHeight: 1 }}>
            MODERACIÓN DE <span className="rk-red-glow">CONTENIDO</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-2">Aprueba lo que entra y retira lo que no debería estar publicado.</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 text-xs font-bold text-zinc-300 bg-white/[0.04] border border-white/10 hover:border-white/25 px-4 py-2.5 rounded-xl cursor-pointer transition-colors disabled:opacity-50">
          <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`}></i> Actualizar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <>
          {/* ── Marcas pendientes ── */}
          <section>
            <div className="flex items-center gap-2.5 mb-4">
              <h2 className="rk-h3" style={{ fontSize: '1.05rem', color: '#fff' }}>MARCAS PENDIENTES</h2>
              {brands.length > 0 && (
                <span className="text-[11px] font-black text-red-400 bg-red-600/15 border border-red-500/30 px-2 py-0.5 rounded-full">{brands.length}</span>
              )}
            </div>

            {brands.length === 0 ? (
              <div className="rk-card p-8 text-center" style={{ transform: 'none' }}>
                <div className="w-14 h-14 mx-auto mb-3 flex items-center justify-center rounded-2xl bg-green-500/10 border border-green-500/25">
                  <i className="ri-check-double-line text-2xl text-green-400"></i>
                </div>
                <p className="text-zinc-300 text-sm font-medium">Ninguna marca esperando</p>
                <p className="text-zinc-600 text-xs mt-1">Cuando una marca solicite publicarse, la revisas aquí antes de que salga.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {brands.map((b) => (
                  <div key={b.id} className="rk-card overflow-hidden" style={{ transform: 'none' }}>
                    <div className="p-5 flex items-start gap-4">
                      {b.logo_url ? (
                        <img src={b.logo_url} alt="" className="w-14 h-14 rounded-xl object-cover border border-zinc-700 flex-shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                          <span className="text-lg font-black text-zinc-600">{(b.name || 'M')[0].toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-white">{b.name}</h3>
                          {b.category && <span className="text-[10px] font-bold text-[#C9A84C] bg-[#C9A84C]/10 border border-[#C9A84C]/30 px-2 py-0.5 rounded-full uppercase">{b.category}</span>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1 flex-wrap">
                          <span>{b.email}</span>
                          {b.website && (
                            <a href={b.website} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white underline underline-offset-2">
                              {b.website.replace(/^https?:\/\//, '')}
                            </a>
                          )}
                          <span>· {fmt(b.created_at)}</span>
                        </div>
                        <p className="text-sm text-zinc-400 mt-3 leading-relaxed">{b.description}</p>
                      </div>
                    </div>
                    <div className="border-t border-white/[0.07] p-4 flex gap-2.5">
                      <button onClick={() => decideBrand(b.id, true)} disabled={acting === b.id}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold py-3 rounded-xl transition-colors cursor-pointer disabled:opacity-60">
                        <i className="ri-check-line"></i> Aprobar y publicar
                      </button>
                      <button onClick={() => decideBrand(b.id, false)} disabled={acting === b.id}
                        className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-red-600/20 border border-zinc-700 hover:border-red-500/40 text-zinc-300 hover:text-red-400 text-sm font-bold py-3 rounded-xl transition-colors cursor-pointer disabled:opacity-60">
                        <i className="ri-close-circle-line"></i> Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Contenido público ── */}
          <section>
            <h2 className="rk-h3 mb-1.5" style={{ fontSize: '1.05rem', color: '#fff' }}>CONTENIDO PUBLICADO</h2>
            <p className="text-xs text-zinc-500 mb-4">Lo último que se ve desde fuera. Retirar no borra nada: solo lo saca de la vista pública.</p>

            {live.length === 0 ? (
              <div className="rk-card p-8 text-center" style={{ transform: 'none' }}>
                <i className="ri-inbox-line text-3xl text-zinc-700"></i>
                <p className="text-zinc-400 text-sm mt-3">Todavía no hay eventos ni oportunidades publicados.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {live.map((it) => (
                  <div key={`${it.table}-${it.id}`} className="rk-card p-3.5 flex items-center gap-3.5" style={{ transform: 'none' }}>
                    {it.image ? (
                      <img src={it.image} alt="" className="w-11 h-11 rounded-xl object-cover border border-zinc-700 flex-shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center flex-shrink-0 text-zinc-500">
                        <i className={it.table === 'opportunities' ? 'ri-megaphone-line' : 'ri-calendar-event-line'}></i>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{it.label}</p>
                      <p className="text-xs text-zinc-500 truncate">
                        {it.table === 'opportunities' ? 'Oportunidad' : 'Evento'}{it.sub && ` · ${it.sub}`}
                      </p>
                    </div>
                    <a href={it.href} target="_blank" rel="noopener noreferrer" title="Ver publicado"
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-white hover:border-white/25 transition-colors flex-shrink-0">
                      <i className="ri-external-link-line text-sm"></i>
                    </a>
                    <button onClick={() => unpublish(it)} disabled={acting === it.id} title="Retirar de la vista pública"
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-red-400 hover:border-red-500/40 transition-colors cursor-pointer flex-shrink-0 disabled:opacity-50">
                      <i className="ri-eye-off-line text-sm"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
