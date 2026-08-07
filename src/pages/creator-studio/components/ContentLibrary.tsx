import { useState, useEffect, useCallback } from 'react';
import { listContent, deleteContent, PAGE_SIZE, type ContentRow, type ContentStatus, type ContentType } from '../lib/contentStore';

interface Props<T> {
  type: ContentType;
  refreshKey: number;
  onOpen: (row: ContentRow<T>) => void;
  subtypeLabel?: (subtype: string | null) => string;
  accent: string;
}

const STATUS_CFG: Record<ContentStatus, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: '#a1a1aa' },
  ready: { label: 'Listo', color: '#38bdf8' },
  published: { label: 'Publicado', color: '#4ade80' },
  archived: { label: 'Archivado', color: '#71717a' },
};

const STATUS_TABS: (ContentStatus | 'all')[] = ['all', 'draft', 'ready', 'published', 'archived'];

/**
 * Librería genérica de contenido generado: búsqueda, filtro por estado y
 * paginación (10/página). Compartida por las 3 secciones de Creator Studio —
 * solo cambia `type` y cómo se etiqueta el subtipo (plataforma/canal/formato).
 */
export default function ContentLibrary<T>({ type, refreshKey, onOpen, subtypeLabel, accent }: Props<T>) {
  const [rows, setRows] = useState<ContentRow<T>[]>([]);
  const [total, setTotal] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ContentStatus | 'all'>('all');
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listContent<T>(type, { search, status, page });
    setRows(res.rows);
    setTotal(res.total);
    setUnavailable(res.unavailable);
    setLoading(false);
  }, [type, search, status, page]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { setPage(0); }, [search, status]);

  const remove = async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    await deleteContent(id);
    load();
  };

  if (unavailable) {
    return (
      <div className="rk-card text-center" style={{ padding: '32px 24px' }}>
        <p className="text-sm text-zinc-400">La biblioteca todavía no está disponible: falta aplicar la migración 0028.</p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm"></i>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título..."
            style={{ fontSize: 16, minHeight: 44 }}
            className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {STATUS_TABS.map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors cursor-pointer ${status === s ? 'text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'}`}
              style={status === s ? { background: accent, borderColor: accent, minHeight: 44 } : { minHeight: 44 }}>
              {s === 'all' ? 'Todos' : STATUS_CFG[s].label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-2 border-white/20 border-t-white rounded-full animate-spin"></div></div>
      ) : rows.length === 0 ? (
        <div className="rk-card text-center" style={{ padding: '32px 24px' }}>
          <p className="text-sm text-zinc-500">Sin contenido guardado todavía.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const cfg = STATUS_CFG[r.status];
            return (
              <button key={r.id} onClick={() => onOpen(r)}
                className="w-full text-left rk-card flex items-center gap-3 cursor-pointer" style={{ padding: '14px 16px' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-white truncate">{r.title || '(sin título)'}</p>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border flex-shrink-0" style={{ color: cfg.color, borderColor: `${cfg.color}55`, background: `${cfg.color}18` }}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {r.subtype ? `${subtypeLabel ? subtypeLabel(r.subtype) : r.subtype} · ` : ''}
                    {new Date(r.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {r.version > 1 ? ` · v${r.version}` : ''}
                  </p>
                </div>
                <span onClick={(e) => { e.stopPropagation(); remove(r.id); }}
                  role="button" aria-label="Eliminar"
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 cursor-pointer">
                  <i className="ri-delete-bin-line"></i>
                </span>
                <i className="ri-arrow-right-s-line text-zinc-600 flex-shrink-0"></i>
              </button>
            );
          })}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} style={{ minHeight: 44 }}
            className="px-4 rounded-xl text-xs font-bold bg-white/[0.04] border border-white/10 text-zinc-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
            Anterior
          </button>
          <span className="text-xs text-zinc-500">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ minHeight: 44 }}
            className="px-4 rounded-xl text-xs font-bold bg-white/[0.04] border border-white/10 text-zinc-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
