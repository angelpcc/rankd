import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import Reveal from '@/components/base/Reveal';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface Doc {
  id: string;
  doc_type: string;
  title: string;
  issue_date: string | null;
  expiry_date: string | null;
  file_path: string | null;
  notes: string | null;
  created_at: string;
}

const BUCKET = 'fighter-docs';
// Con cuánta antelación se considera que un documento "caduca pronto".
const WARN_DAYS = 30;

const TYPES = [
  { value: 'licencia', labelKey: 'mc_docs_type_license', icon: 'ri-shield-star-line', color: '#E10600' },
  { value: 'medico', labelKey: 'mc_docs_type_medical', icon: 'ri-heart-pulse-line', color: '#4ade80' },
  { value: 'seguro', labelKey: 'mc_docs_type_insurance', icon: 'ri-file-shield-2-line', color: '#38bdf8' },
  { value: 'otro', labelKey: 'mc_docs_type_other', icon: 'ri-file-text-line', color: '#C9A84C' },
];

const typeCfg = (v: string) => TYPES.find((t) => t.value === v) || TYPES[3];

function daysUntil(date: string): number {
  const d = new Date(date + 'T12:00:00');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

type DocState = 'expired' | 'warning' | 'ok' | 'none';

function docState(doc: Pick<Doc, 'expiry_date'>): DocState {
  if (!doc.expiry_date) return 'none';
  const days = daysUntil(doc.expiry_date);
  if (days < 0) return 'expired';
  if (days <= WARN_DAYS) return 'warning';
  return 'ok';
}

/**
 * Aviso para el resumen: aparece SOLO si algún documento está caducado o
 * caduca en los próximos 30 días. Si la tabla no existe o no hay nada que
 * avisar, no renderiza nada — el resumen no se entera de que existe.
 */
export function DocumentExpiryAlert({ profile, onOpen }: { profile: Profile; onOpen: () => void }) {
  const { t } = useTranslation();
  const [alert, setAlert] = useState<{ expired: number; warning: number } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('fighter_documents')
        .select('expiry_date')
        .eq('fighter_profile_id', profile.id)
        .not('expiry_date', 'is', null);
      if (!alive || error || !data) return;
      let expired = 0, warning = 0;
      (data as { expiry_date: string }[]).forEach((d) => {
        const s = docState(d);
        if (s === 'expired') expired++;
        else if (s === 'warning') warning++;
      });
      if (expired + warning > 0) setAlert({ expired, warning });
    })();
    return () => { alive = false; };
  }, [profile.id]);

  if (!alert) return null;
  const isExpired = alert.expired > 0;
  const n = isExpired ? alert.expired : alert.warning;

  return (
    <button onClick={onOpen}
      className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors cursor-pointer ${isExpired ? 'bg-red-600/10 border-red-500/35 hover:bg-red-600/15' : 'bg-orange-500/10 border-orange-500/35 hover:bg-orange-500/15'}`}
      style={{ minHeight: 44 }}>
      <i className={`text-xl flex-shrink-0 ${isExpired ? 'ri-error-warning-fill text-red-400' : 'ri-time-line text-orange-400'}`}></i>
      <span className="flex-1 min-w-0">
        <span className={`block text-sm font-bold ${isExpired ? 'text-red-300' : 'text-orange-300'}`}>
          {isExpired ? t('mc_docs_alert_expired', { count: n }) : t('mc_docs_alert_warning', { count: n })}
        </span>
        <span className="block text-[11px] text-zinc-400 mt-0.5">{t('mc_docs_alert_cta')}</span>
      </span>
      <i className="ri-arrow-right-s-line text-zinc-500 flex-shrink-0"></i>
    </button>
  );
}

/**
 * Documentación del peleador que compite: licencia, reconocimiento médico y
 * seguro, con caducidad y archivo adjunto. La utilidad real es doble: saber
 * de un vistazo si puedes competir mañana, y tener el papel a mano cuando el
 * promotor te lo pida.
 */
export default function DocumentsPanel({ profile, showToast }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [openingFile, setOpeningFile] = useState<string | null>(null);

  const [docType, setDocType] = useState('licencia');
  const [title, setTitle] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fighter_documents')
      .select('*')
      .eq('fighter_profile_id', profile.id)
      .order('created_at', { ascending: false });
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    setDocs((data || []) as Doc[]);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setDocType('licencia'); setTitle(''); setIssueDate(''); setExpiryDate(''); setFile(null); setNotes('');
  };

  const create = async () => {
    const name = title.trim() || t(typeCfg(docType).labelKey);
    setSaving(true);

    // 1) Si hay archivo, se sube primero a la carpeta del usuario.
    let filePath: string | null = null;
    if (file) {
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
      filePath = `${profile.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(filePath, file);
      if (upErr) {
        setSaving(false);
        showToast(t('mc_docs_upload_fail'), 'error');
        return;
      }
    }

    // 2) La fila del documento.
    const { data, error } = await supabase.from('fighter_documents').insert({
      fighter_profile_id: profile.id,
      doc_type: docType,
      title: name,
      issue_date: issueDate || null,
      expiry_date: expiryDate || null,
      file_path: filePath,
      notes: notes.trim() || null,
    }).select().maybeSingle();
    setSaving(false);

    if (error || !data) {
      // No dejamos archivos huérfanos si la fila no se pudo crear.
      if (filePath) await supabase.storage.from(BUCKET).remove([filePath]);
      showToast(t('mc_docs_save_fail'), 'error');
      return;
    }
    setDocs((prev) => [data as Doc, ...prev]);
    setShowForm(false);
    resetForm();
    showToast(t('mc_docs_saved'));
  };

  const remove = async (doc: Doc) => {
    const { error } = await supabase.from('fighter_documents').delete().eq('id', doc.id);
    if (error) { showToast(t('mc_docs_delete_fail'), 'error'); return; }
    if (doc.file_path) await supabase.storage.from(BUCKET).remove([doc.file_path]);
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    setConfirmDelete(null);
    showToast(t('mc_docs_deleted'));
  };

  // El bucket es privado: se abre con una URL firmada de corta duración.
  const openFile = async (doc: Doc) => {
    if (!doc.file_path || openingFile) return;
    setOpeningFile(doc.id);
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 300);
    setOpeningFile(null);
    if (error || !data?.signedUrl) { showToast(t('mc_docs_open_fail'), 'error'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const onPickFile = (f: File | null) => {
    if (!f) { setFile(null); return; }
    if (f.size > 10 * 1024 * 1024) { showToast(t('mc_docs_file_too_big'), 'error'); return; }
    setFile(f);
  };

  // Orden útil: lo que necesita atención (caducado / caduca pronto) arriba.
  const sorted = [...docs].sort((a, b) => {
    const rank: Record<DocState, number> = { expired: 0, warning: 1, ok: 2, none: 3 };
    const ra = rank[docState(a)], rb = rank[docState(b)];
    if (ra !== rb) return ra - rb;
    if (a.expiry_date && b.expiry_date) return a.expiry_date.localeCompare(b.expiry_date);
    return 0;
  });

  if (loading) {
    return (
      <div className="rk-card flex items-center justify-center" style={{ height: 300 }}>
        <div className="w-7 h-7 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
          <i className="ri-folder-shield-2-line text-3xl text-red-400"></i>
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.3rem', color: '#fff' }}>{t('mc_docs_coming_title')}</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{t('mc_docs_coming_desc')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Reveal>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="rk-eyebrow">{t('mc_docs_eyebrow')}</p>
            <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
              {t('mc_docs_head')} <span className="rk-red-glow">{t('mc_docs_head_2')}</span>
            </h2>
            <p className="text-zinc-400 text-sm mt-1.5 max-w-md">{t('mc_docs_sub')}</p>
          </div>
          {!showForm && (
            <button onClick={() => { resetForm(); setShowForm(true); }}
              className="rk-btn rk-btn-primary flex items-center gap-2" style={{ fontSize: '0.85rem', padding: '0.7rem 1.4rem' }}>
              <i className="ri-add-line"></i>{t('mc_docs_add')}
            </button>
          )}
        </div>
      </Reveal>

      {/* Alta de documento */}
      {showForm && (
        <div className="rk-card" style={{ padding: 20, transform: 'none' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">{t('mc_docs_form_title')}</h3>
            <button onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-white cursor-pointer p-1.5" aria-label={t('mc_docs_cancel')}>
              <i className="ri-close-line text-lg"></i>
            </button>
          </div>

          {/* Tipo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {TYPES.map((ty) => (
              <button key={ty.value} onClick={() => setDocType(ty.value)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer px-2 ${docType === ty.value ? 'text-white border-transparent' : 'bg-white/[0.03] text-zinc-400 border-white/10 hover:border-white/25'}`}
                style={{ minHeight: 44, background: docType === ty.value ? ty.color : undefined }}>
                <i className={ty.icon}></i>{t(ty.labelKey)}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">{t('mc_docs_f_title')}</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder={t(typeCfg(docType).labelKey)}
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">{t('mc_docs_f_issue')}</label>
                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 [color-scheme:dark]" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">{t('mc_docs_f_expiry')}</label>
                <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 [color-scheme:dark]" />
              </div>
            </div>
            <p className="text-[11px] text-zinc-600 -mt-1">{t('mc_docs_f_expiry_hint')}</p>

            {/* Adjunto opcional */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">{t('mc_docs_f_file')}</label>
              <label className={`flex items-center gap-3 rounded-xl border border-dashed px-4 py-3 cursor-pointer transition-colors ${file ? 'border-green-500/40 bg-green-500/5' : 'border-white/15 bg-white/[0.02] hover:border-white/30'}`}
                style={{ minHeight: 44 }}>
                <i className={`text-lg flex-shrink-0 ${file ? 'ri-checkbox-circle-fill text-green-400' : 'ri-camera-line text-zinc-500'}`}></i>
                <span className="text-xs text-zinc-300 flex-1 min-w-0 truncate">
                  {file ? file.name : t('mc_docs_f_file_hint')}
                </span>
                {file && (
                  <button onClick={(e) => { e.preventDefault(); setFile(null); }} className="text-zinc-500 hover:text-red-400 cursor-pointer p-1" aria-label={t('mc_docs_f_file_remove')}>
                    <i className="ri-close-line"></i>
                  </button>
                )}
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] || null)} />
              </label>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">{t('mc_docs_f_notes')}</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder={t('mc_docs_f_notes_hint')}
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
            </div>

            <button onClick={create} disabled={saving}
              className="rk-btn rk-btn-primary w-full disabled:opacity-60" style={{ fontSize: '0.85rem', padding: '0.75rem' }}>
              {saving ? t('mc_docs_saving') : t('mc_docs_save')}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {sorted.length === 0 && !showForm ? (
        <div className="rk-card text-center" style={{ padding: '44px 26px', transform: 'none' }}>
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-white/[0.04] border border-white/10">
            <i className="ri-folder-shield-2-line text-3xl text-zinc-500"></i>
          </div>
          <h3 className="rk-h3" style={{ fontSize: '1.15rem', color: '#fff' }}>{t('mc_docs_empty_title')}</h3>
          <p className="text-sm text-zinc-400 mt-2 max-w-sm mx-auto leading-relaxed">{t('mc_docs_empty_desc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((doc) => {
            const cfg = typeCfg(doc.doc_type);
            const state = docState(doc);
            const days = doc.expiry_date ? daysUntil(doc.expiry_date) : null;
            const expiryNice = doc.expiry_date
              ? new Date(doc.expiry_date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
              : null;
            const stateChip = state === 'expired'
              ? { text: t('mc_docs_st_expired', { date: expiryNice }), cls: 'bg-red-600/12 border-red-500/35 text-red-300', icon: 'ri-error-warning-fill' }
              : state === 'warning'
                ? { text: days === 0 ? t('mc_docs_st_today') : t('mc_docs_st_warning', { count: days ?? 0 }), cls: 'bg-orange-500/12 border-orange-500/35 text-orange-300', icon: 'ri-time-line' }
                : state === 'ok'
                  ? { text: t('mc_docs_st_ok', { date: expiryNice }), cls: 'bg-green-500/10 border-green-500/30 text-green-300', icon: 'ri-checkbox-circle-line' }
                  : { text: t('mc_docs_st_none'), cls: 'bg-white/[0.04] border-white/10 text-zinc-400', icon: 'ri-infinity-line' };

            return (
              <div key={doc.id} className="rk-card" style={{ padding: '16px 18px', transform: 'none' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl border flex-shrink-0"
                    style={{ background: `${cfg.color}1f`, borderColor: `${cfg.color}59`, color: cfg.color }}>
                    <i className={`${cfg.icon} text-lg`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white truncate">{doc.title}</h4>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{t(cfg.labelKey)}</span>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 mt-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stateChip.cls}`}>
                      <i className={stateChip.icon}></i>{stateChip.text}
                    </span>
                    {doc.notes && <p className="text-xs text-zinc-500 mt-1.5">{doc.notes}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                  {doc.file_path && (
                    <button onClick={() => openFile(doc)} disabled={openingFile === doc.id}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/12 hover:border-white/30 text-xs text-zinc-200 px-3 transition-colors cursor-pointer disabled:opacity-60"
                      style={{ minHeight: 40 }}>
                      {openingFile === doc.id
                        ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        : <i className="ri-attachment-2"></i>}
                      {t('mc_docs_view_file')}
                    </button>
                  )}
                  <div className="flex-1" />
                  {confirmDelete === doc.id ? (
                    <>
                      <button onClick={() => remove(doc)}
                        className="text-xs font-bold text-red-300 bg-red-600/12 border border-red-500/35 rounded-lg px-3 cursor-pointer" style={{ minHeight: 40 }}>
                        {t('mc_docs_delete_confirm')}
                      </button>
                      <button onClick={() => setConfirmDelete(null)}
                        className="text-xs text-zinc-400 px-2 cursor-pointer" style={{ minHeight: 40 }}>
                        {t('mc_docs_cancel')}
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDelete(doc.id)}
                      className="text-zinc-600 hover:text-red-400 transition-colors cursor-pointer px-2" style={{ minHeight: 40 }}
                      aria-label={t('mc_docs_delete')}>
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5">
        <i className="ri-lock-line mt-0.5 flex-shrink-0"></i>
        {t('mc_docs_privacy')}
      </p>
    </div>
  );
}
