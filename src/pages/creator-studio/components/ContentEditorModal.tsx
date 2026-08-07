import { useState, useEffect, type ReactNode } from 'react';
import { updateContent, type ContentRow, type ContentStatus } from '../lib/contentStore';

interface Props<T> {
  row: ContentRow<T>;
  accent: string;
  available: boolean;
  onClose: () => void;
  onSaved: (row: ContentRow<T>) => void;
  renderFields: (content: T, setContent: (c: T) => void) => ReactNode;
  renderPreview: (content: T) => ReactNode;
  onGenerateVariation: (content: T) => Promise<{ data: T | null; error: string | null }>;
}

const STATUS_OPTIONS: { value: ContentStatus; label: string }[] = [
  { value: 'draft', label: 'Borrador' },
  { value: 'ready', label: 'Listo' },
  { value: 'published', label: 'Publicado' },
  { value: 'archived', label: 'Archivado' },
];

/**
 * Editor de una pieza de contenido: guion/copy editable a la izquierda,
 * preview en vivo a la derecha (se apila en móvil). Guardar sube la versión
 * y deja constancia de la anterior en content_versions (contentStore).
 */
export default function ContentEditorModal<T>({ row, accent, available, onClose, onSaved, renderFields, renderPreview, onGenerateVariation }: Props<T>) {
  const [title, setTitle] = useState(row.title);
  const [status, setStatus] = useState<ContentStatus>(row.status);
  const [content, setContent] = useState<T>(row.generated_content);
  const [saving, setSaving] = useState(false);
  const [varying, setVarying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const save = async () => {
    setSaving(true);
    const updated = await updateContent(row, { title, status, generated_content: content });
    setSaving(false);
    if (!updated) { setError('No se pudo guardar.'); return; }
    onSaved(updated);
  };

  const variation = async () => {
    setVarying(true);
    setError(null);
    const res = await onGenerateVariation(content);
    setVarying(false);
    if (res.error || !res.data) { setError(res.error || 'No se pudo generar la variación.'); return; }
    setContent(res.data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
      <div className="relative w-full sm:max-w-4xl max-h-[92vh] flex flex-col bg-[#0c0c0c] border border-white/[0.1] rounded-t-3xl sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-4 flex-shrink-0 border-b border-white/[0.06]">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Título"
            style={{ fontSize: 16 }} className="flex-1 min-w-0 bg-transparent text-white font-bold text-lg focus:outline-none" />
          <select value={status} onChange={(e) => setStatus(e.target.value as ContentStatus)}
            style={{ fontSize: 16, minHeight: 44 }}
            className="bg-white/[0.05] border border-white/10 text-white text-xs font-bold rounded-lg px-2.5 cursor-pointer flex-shrink-0">
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={onClose} aria-label="Cerrar" style={{ minHeight: 44, minWidth: 44 }}
            className="flex-shrink-0 flex items-center justify-center rounded-xl bg-white/[0.05] border border-white/10 text-zinc-400 hover:text-white cursor-pointer">
            <i className="ri-close-line"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 grid lg:grid-cols-2 gap-6">
          <div className="space-y-3.5">
            <p className="text-[11px] font-bold tracking-widest uppercase text-zinc-500">Editar</p>
            {renderFields(content, setContent)}
          </div>
          <div className="space-y-3.5">
            <p className="text-[11px] font-bold tracking-widest uppercase text-zinc-500">Vista previa</p>
            {renderPreview(content)}
          </div>
        </div>

        {error && <p className="px-6 text-xs text-red-400">{error}</p>}

        <div className="flex-shrink-0 flex gap-2.5 px-6 py-4 border-t border-white/[0.08]" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          <button onClick={variation} disabled={varying || !available} title={!available ? 'IA disponible pronto' : undefined}
            style={{ minHeight: 44 }}
            className="flex items-center gap-1.5 px-4 rounded-xl border border-white/15 text-zinc-300 text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:border-white/30 transition-colors">
            {varying ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <i className="ri-refresh-line"></i>}
            Generar variación
          </button>
          <button onClick={save} disabled={saving} style={{ minHeight: 44, background: accent }}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl text-white text-sm font-bold cursor-pointer disabled:opacity-60 transition-colors">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <i className="ri-save-line"></i>}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
