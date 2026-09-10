import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Profile } from '@/lib/supabase';
import Reveal from '@/components/base/Reveal';
import ActivityGlyph from '@/pages/mi-esquina/components/ActivityGlyph';
import ProtocolEditor from '@/pages/mi-esquina/components/ProtocolEditor';
import ProtocolPlayer from '@/pages/mi-esquina/components/ProtocolPlayer';
import { ACTIVITY_KINDS, activityKindCfg } from '@/pages/mi-esquina/lib/dayPlan';
import {
  clock, deleteProtocol, emptyProtocol, finishRun, loadProtocols, loadRuns,
  parseProtocolText, protocolTotals, protocolVarsFor, saveProtocol, formatVarValue,
  type Protocol, type ProtocolRun,
} from '@/pages/mi-esquina/lib/protocols';
import { checkProtocolImportAvailable, importProtocol } from '@/services/protocolImport';

// Biblioteca de protocolos de actividad (punto 16).
//
// Vive dentro de Actividad, como pestaña propia. Aquí se GUARDAN varios
// protocolos y se eligen; el guion en vivo lo pinta ProtocolPlayer y la
// edición, ProtocolEditor.
//
// Importar tiene DOS caminos a propósito:
//   · Con el Asesor — pega el texto (o sube una foto) del PDF del entrenador y
//     la IA lo estructura. Es lo cómodo.
//   · Sin el Asesor — el mismo texto lo lee el propio navegador
//     (`parseProtocolText`). Es lo que hace que la función siga existiendo con
//     la IA en pausa, en vez de enseñar un "disponible pronto" y nada más.

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** Avisa a Actividad de que hay una sesión nueva en el historial. */
  onSessionSaved?: () => void;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });
}

export default function ProtocolLibrary({ profile, showToast, onSessionSaved }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [runs, setRuns] = useState<ProtocolRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [localOnly, setLocalOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const [editing, setEditing] = useState<Protocol | null>(null);
  const [playing, setPlaying] = useState<Protocol | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    const [{ protocols: list, storedLocally }, runList] = await Promise.all([
      loadProtocols(profile.id),
      loadRuns(profile.id),
    ]);
    setProtocols(list);
    setRuns(runList);
    setLocalOnly(storedLocally);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let alive = true;
    checkProtocolImportAvailable().then((ok) => { if (alive) setAiAvailable(ok); });
    return () => { alive = false; };
  }, []);

  /** Última vez que se reprodujo cada protocolo. */
  const lastRunOf = useMemo(() => {
    const m = new Map<string, ProtocolRun>();
    for (const r of runs) {
      const key = r.protocolId || r.protocolName;
      if (!m.has(key)) m.set(key, r);
    }
    return m;
  }, [runs]);

  const persist = async (p: Protocol) => {
    setSaving(true);
    const { protocol, storedLocally } = await saveProtocol(profile.id, p);
    setProtocols((list) => {
      const without = list.filter((x) => x.id !== p.id && x.id !== protocol.id);
      return [protocol, ...without];
    });
    if (storedLocally) setLocalOnly(true);
    setSaving(false);
    setEditing(null);
    showToast(t('mc_pt_saved'));
  };

  const remove = async (id: string) => {
    setConfirmDel(null);
    setProtocols((l) => l.filter((p) => p.id !== id));
    await deleteProtocol(profile.id, id);
    showToast(t('mc_pt_deleted'));
  };

  const finish = async (done: { secondsDone: number; segmentsDone: number; completed: boolean; distanceMeters: number }) => {
    if (!playing) return;
    setSaving(true);
    const res = await finishRun(profile.id, playing, done);
    setSaving(false);
    setPlaying(null);
    if (res.sessionFailed) {
      showToast(t('error_save'), 'error');
      return;
    }
    showToast(done.completed ? t('mc_pt_run_saved') : t('mc_pt_run_saved_partial'));
    onSessionSaved?.();
    void load();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-5 mt-6 max-w-3xl">
      <header>
        <p className="rk-eyebrow">{t('mc_pt_eyebrow')}</p>
        <h2 className="rk-h3" style={{ fontSize: '1.25rem', color: '#fff', margin: '4px 0 0' }}>
          {t('mc_pt_title')} <span className="rk-red-glow">{t('mc_pt_title_2')}</span>
        </h2>
        <p className="rk-body-14 mt-1">{t('mc_pt_sub')}</p>
      </header>

      {/* Acciones */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setEditing(emptyProtocol('cinta', ''))}
          className="rk-btn rk-btn-primary rk-press flex items-center justify-center gap-2 flex-1 sm:flex-none"
          style={{ fontSize: '0.85rem', minHeight: 46 }}>
          <i className="ri-add-line" />{t('mc_pt_new')}
        </button>
        <button onClick={() => setImportOpen(true)}
          className="rk-nav-btn flex items-center justify-center gap-2 flex-1 sm:flex-none text-xs"
          style={{ padding: '0.6rem 1.1rem', minHeight: 46 }}>
          <i className="ri-file-text-line" />{t('mc_pt_import')}
        </button>
      </div>

      {localOnly && (
        <p className="text-[11px] text-[#C9A84C] flex items-start gap-1.5 leading-relaxed">
          <i className="ri-information-line mt-0.5 flex-shrink-0" />{t('mc_pt_local_only')}
        </p>
      )}

      {/* Lista */}
      {protocols.length === 0 ? (
        <Reveal>
          <div className="rk-card text-center" style={{ padding: '48px 24px' }}>
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
              <i className="ri-timer-line text-3xl text-red-400" />
            </div>
            <h3 className="rk-h3" style={{ fontSize: '1.2rem', color: '#fff' }}>{t('mc_pt_empty_title')}</h3>
            <p className="text-sm text-zinc-400 mt-2 max-w-sm mx-auto leading-relaxed">{t('mc_pt_empty_desc')}</p>
          </div>
        </Reveal>
      ) : (
        <div className="space-y-2.5">
          {protocols.map((p, i) => {
            const cfg = activityKindCfg(p.kind);
            const totals = protocolTotals(p);
            const last = lastRunOf.get(p.id) || lastRunOf.get(p.name);
            const vars = protocolVarsFor(p.kind);
            const preview = p.segments.slice(0, 3).map((s) => vars
              .filter((v) => s.values[v.id] !== undefined)
              .map((v) => formatVarValue(v, s.values[v.id] as number))
              .join('/')).filter(Boolean).join(' → ');

            return (
              <Reveal key={p.id} delay={Math.min(i, 6) * 40}>
                <div className="rk-card" style={{ padding: '14px 16px' }}>
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 flex items-center justify-center rounded-xl border flex-shrink-0"
                      style={{ background: `${cfg.hex}1a`, borderColor: `${cfg.hex}40`, color: cfg.hex }}>
                      <ActivityGlyph kind={p.kind} size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{p.name}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        {t(cfg.labelKey)} · {t('mc_pt_totals', { n: totals.segments, time: clock(totals.seconds) })}
                        {totals.hasDistance && ` · ${totals.meters} m`}
                      </p>
                      {preview && (
                        <p className="text-[11px] text-zinc-600 mt-1 truncate">{preview}{p.segments.length > 3 ? ' …' : ''}</p>
                      )}
                      {last && (
                        <p className="text-[11px] mt-1 flex items-center gap-1"
                          style={{ color: last.completed ? '#4ade80' : 'var(--t-3)' }}>
                          <i className={last.completed ? 'ri-check-double-line' : 'ri-history-line'} />
                          {t(last.completed ? 'mc_pt_last_done' : 'mc_pt_last_partial', {
                            date: new Date(`${last.runDate}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
                          })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <button onClick={() => setPlaying(p)}
                      className="rk-btn rk-btn-primary rk-press flex items-center justify-center gap-1.5 flex-1"
                      style={{ fontSize: '0.8rem', minHeight: 44, padding: '0.5rem 1rem' }}>
                      <i className="ri-play-fill" />{t('mc_pt_play')}
                    </button>
                    <button onClick={() => setEditing(p)} aria-label={t('mc_edit')}
                      className="w-11 flex items-center justify-center rounded-xl bg-white/[0.05] border border-white/10 text-zinc-300 hover:border-white/30 cursor-pointer"
                      style={{ minHeight: 44 }}>
                      <i className="ri-pencil-line" />
                    </button>
                    {confirmDel === p.id ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => remove(p.id)}
                          className="text-[11px] font-bold text-red-300 bg-red-600/12 border border-red-500/35 rounded-lg px-2.5 cursor-pointer"
                          style={{ minHeight: 44 }}>{t('mc_delete')}</button>
                        <button onClick={() => setConfirmDel(null)} className="text-[11px] text-zinc-400 px-1.5 cursor-pointer"
                          style={{ minHeight: 44 }}>{t('mc_cancel')}</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDel(p.id)} aria-label={t('mc_delete')}
                        className="w-11 flex items-center justify-center rounded-xl bg-white/[0.05] border border-white/10 text-zinc-500 hover:text-red-400 hover:border-red-500/40 cursor-pointer"
                        style={{ minHeight: 44 }}>
                        <i className="ri-delete-bin-line" />
                      </button>
                    )}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      )}

      {editing && (
        <ProtocolEditor initial={editing} saving={saving}
          onSave={persist} onCancel={() => setEditing(null)} />
      )}

      {playing && (
        <ProtocolPlayer protocol={playing} saving={saving}
          onExit={() => setPlaying(null)} onFinish={finish} />
      )}

      {importOpen && (
        <ImportPanel
          aiAvailable={aiAvailable}
          showToast={showToast}
          onClose={() => setImportOpen(false)}
          onImported={(p) => { setImportOpen(false); setEditing(p); }}
        />
      )}
    </div>
  );
}

// ── Importar ───────────────────────────────────────────────────

function ImportPanel({ aiAvailable, showToast, onClose, onImported }: {
  aiAvailable: boolean | null;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onClose: () => void;
  onImported: (p: Protocol) => void;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState('cinta');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (!ACCEPT.split(',').includes(f.type)) { showToast(t('mc_food_photo_err_type'), 'error'); return; }
    if (f.size > MAX_BYTES) { showToast(t('mc_food_photo_err_size'), 'error'); return; }
    setFile(f);
  };

  const buildDraft = (name: string, segments: Protocol['segments'], note?: string): Protocol => ({
    ...emptyProtocol(kind, name),
    segments,
    note,
    source: 'import',
  });

  /** Camino sin IA: lo lee el propio navegador. */
  const readHere = () => {
    const { segments, warnings } = parseProtocolText(text, kind);
    if (segments.length === 0) {
      showToast(t('mc_pt_import_nothing'), 'error');
      return;
    }
    // El aviso va por toast: el panel se cierra al abrir el editor, así que
    // pintarlo aquí sería enseñárselo a nadie.
    if (warnings.length > 0) showToast(t('mc_pt_import_warn'), 'error');
    onImported(buildDraft(t('mc_pt_imported_name'), segments));
  };

  /** Camino con IA: se lo damos al Asesor. */
  const readWithAi = async () => {
    setBusy(true);
    try {
      let imageBase64: string | undefined;
      if (file) imageBase64 = await fileToBase64(file);
      const res = await importProtocol({
        kind,
        text: text.trim() || undefined,
        imageBase64,
        mediaType: file?.type,
      });
      if (res.protocol) {
        onImported(buildDraft(res.protocol.name, res.protocol.segments, res.protocol.note));
        return;
      }
      // Si la IA no ha podido, el texto todavía tiene una oportunidad aquí
      // mismo: es mejor eso que devolver al usuario a la casilla de salida.
      if (text.trim()) {
        const { segments } = parseProtocolText(text, kind);
        if (segments.length > 0) {
          showToast(t('mc_pt_import_fallback'));
          onImported(buildDraft(t('mc_pt_imported_name'), segments));
          return;
        }
      }
      showToast(res.error || t('mc_pt_import_nothing'), 'error');
    } catch {
      showToast(t('mc_pt_import_nothing'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const soon = aiAvailable === false;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative rk-card w-full sm:max-w-lg flex flex-col"
        style={{ padding: 0, transform: 'none', maxHeight: '92vh', borderRadius: '20px 20px 0 0' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
          <h3 className="rk-h3" style={{ fontSize: '1.05rem', color: '#fff', margin: 0 }}>{t('mc_pt_import_title')}</h3>
          <button onClick={onClose} aria-label={t('mc_close')}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer">
            <i className="ri-close-line" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <p className="text-xs text-zinc-400 leading-relaxed">{t('mc_pt_import_desc')}</p>

          {/* Tipo de actividad */}
          <div>
            <p className="text-xs text-zinc-400 mb-2">{t('mc_pt_import_kind')}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {ACTIVITY_KINDS.map((k) => (
                <button key={k.value} type="button" onClick={() => setKind(k.value)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${
                    kind === k.value ? 'border-red-500 bg-red-600/12 text-white' : 'border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/25'
                  }`} style={{ minHeight: 56 }}>
                  <ActivityGlyph kind={k.value} size={20} style={{ color: k.hex }} />
                  {t(k.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Texto */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_pt_import_text')}</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7}
              placeholder={t('mc_pt_import_text_ph')}
              className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 resize-y font-mono"
              style={{ fontSize: 13 }} />
          </div>

          {/* Foto (solo tiene sentido con el Asesor activo) */}
          <div>
            <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] || null)} />
            <button onClick={() => fileRef.current?.click()} disabled={soon || busy}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] text-xs font-semibold text-zinc-200 hover:border-white/25 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              style={{ minHeight: 46 }}>
              <i className="ri-image-add-line" />{file ? file.name.slice(0, 28) : t('mc_pt_import_photo')}
            </button>
            {soon && <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">{t('mc_pt_import_ai_paused')}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-2 px-5 py-4 border-t border-white/[0.07] flex-shrink-0"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          <button onClick={readWithAi} disabled={busy || soon || (!text.trim() && !file)}
            className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ minHeight: 48 }}>
            {busy
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('mc_pt_import_reading')}</>
              : <><i className="ri-sparkling-2-line" />{t('mc_pt_import_with_ai')}</>}
          </button>
          <button onClick={readHere} disabled={busy || !text.trim()}
            className="rk-nav-btn w-full text-xs flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ padding: '0.7rem 1rem', minHeight: 46 }}>
            <i className="ri-scan-line" />{t('mc_pt_import_here')}
          </button>
          <p className="text-[10px] text-zinc-600 leading-relaxed text-center">{t('mc_pt_import_here_hint')}</p>
        </div>
      </div>
    </div>
  );
}
