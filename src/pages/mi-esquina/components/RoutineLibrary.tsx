import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Profile } from '@/lib/supabase';
import Reveal from '@/components/base/Reveal';
import RoutineEditor from '@/pages/mi-esquina/components/RoutineEditor';
import RoutineRunner from '@/pages/mi-esquina/components/RoutineRunner';
import { reconcileDayTicks } from '@/pages/mi-esquina/lib/planTicks';
import { fmtSetCount } from '@/pages/mi-esquina/lib/dayPlan';
import {
  deleteRoutine, emptyRoutine, loadRoutines, parseRoutineText, routineTotals,
  saveRoutine, saveRoutineSession, touchRoutine,
  type LoggedSet, type Routine, type RoutineDay,
} from '@/pages/mi-esquina/lib/routines';
import { checkRoutineTextImportAvailable, importRoutine } from '@/services/routineTextImport';

// Biblioteca de rutinas preescritas (punto 17).
//
// Vive dentro de Fuerza, como pestaña propia. Guarda varias rutinas, deja
// elegir el día que toca y abre el checklist en vivo (RoutineRunner).
//
// Importar tiene los mismos DOS caminos que los protocolos:
//   · Con el Asesor — se pega el texto del PDF (o se sube la foto) y la IA lo
//     estructura en días y ejercicios.
//   · Sin el Asesor — el mismo texto lo lee el navegador (`parseRoutineText`).
// Con la IA en pausa la función sigue existiendo, que es el punto.

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** Avisa a Fuerza de que hay una sesión nueva en el historial. */
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

export default function RoutineLibrary({ profile, showToast, onSessionSaved }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [localOnly, setLocalOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [openRoutine, setOpenRoutine] = useState<string | null>(null);

  const [editing, setEditing] = useState<Routine | null>(null);
  const [running, setRunning] = useState<{ routine: Routine; day: RoutineDay } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    const { routines: list, storedLocally } = await loadRoutines(profile.id);
    setRoutines(list);
    setLocalOnly(storedLocally);
    setOpenRoutine((cur) => cur ?? (list[0]?.id ?? null));
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let alive = true;
    checkRoutineTextImportAvailable().then((ok) => { if (alive) setAiAvailable(ok); });
    return () => { alive = false; };
  }, []);

  const persist = async (r: Routine) => {
    setSaving(true);
    const { routine, storedLocally } = await saveRoutine(profile.id, r);
    setRoutines((list) => [routine, ...list.filter((x) => x.id !== r.id && x.id !== routine.id)]);
    if (storedLocally) setLocalOnly(true);
    setOpenRoutine(routine.id);
    setSaving(false);
    setEditing(null);
    showToast(t('mc_rp_saved'));
  };

  const remove = async (id: string) => {
    setConfirmDel(null);
    setRoutines((l) => l.filter((r) => r.id !== id));
    await deleteRoutine(profile.id, id);
    showToast(t('mc_rp_deleted'));
  };

  const finish = async (date: string, slot: string | null, sets: LoggedSet[]) => {
    if (!running) return;
    setSaving(true);
    const res = await saveRoutineSession(profile.id, date, slot, sets);
    setSaving(false);
    if (!res.ok) { showToast(t('error_save'), 'error'); return; }

    setRunning(null);
    showToast(t('mc_rp_session_saved'));
    void touchRoutine(profile.id, running.routine);
    // La Agenda se entera sola: mismo criterio que el registro manual.
    void reconcileDayTicks(profile.id, date);
    onSessionSaved?.();
    void load();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-5 mt-6 max-w-3xl">
      <header>
        <p className="rk-eyebrow">{t('mc_rp_eyebrow')}</p>
        <h2 className="rk-h3" style={{ fontSize: '1.25rem', color: '#fff', margin: '4px 0 0' }}>
          {t('mc_rp_title')} <span className="rk-red-glow">{t('mc_rp_title_2')}</span>
        </h2>
        <p className="rk-body-14 mt-1">{t('mc_rp_sub')}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setEditing(emptyRoutine(''))}
          className="rk-btn rk-btn-primary rk-press flex items-center justify-center gap-2 flex-1 sm:flex-none"
          style={{ fontSize: '0.85rem', minHeight: 46 }}>
          <i className="ri-add-line" />{t('mc_rp_new')}
        </button>
        <button onClick={() => setImportOpen(true)}
          className="rk-nav-btn flex items-center justify-center gap-2 flex-1 sm:flex-none text-xs"
          style={{ padding: '0.6rem 1.1rem', minHeight: 46 }}>
          <i className="ri-file-text-line" />{t('mc_rp_import')}
        </button>
      </div>

      {localOnly && (
        <p className="text-[11px] text-[#C9A84C] flex items-start gap-1.5 leading-relaxed">
          <i className="ri-information-line mt-0.5 flex-shrink-0" />{t('mc_rp_local_only')}
        </p>
      )}

      {routines.length === 0 ? (
        <Reveal>
          <div className="rk-card text-center" style={{ padding: '48px 24px' }}>
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-orange-500/10 border border-orange-500/25 anim-float">
              <i className="ri-list-check-2 text-3xl text-orange-400" />
            </div>
            <h3 className="rk-h3" style={{ fontSize: '1.2rem', color: '#fff' }}>{t('mc_rp_empty_title')}</h3>
            <p className="text-sm text-zinc-400 mt-2 max-w-sm mx-auto leading-relaxed">{t('mc_rp_empty_desc')}</p>
          </div>
        </Reveal>
      ) : (
        <div className="space-y-2.5">
          {routines.map((r, i) => {
            const open = openRoutine === r.id;
            const totals = routineTotals(r);
            return (
              <Reveal key={r.id} delay={Math.min(i, 6) * 40}>
                <div className="rk-card overflow-hidden" style={{ padding: 0 }}>
                  <button onClick={() => setOpenRoutine(open ? null : r.id)}
                    className="w-full flex items-center gap-3 text-left cursor-pointer"
                    style={{ padding: '14px 16px', minHeight: 60 }}>
                    <div className="w-11 h-11 flex items-center justify-center rounded-xl border flex-shrink-0"
                      style={{ background: 'rgba(251,146,60,0.12)', borderColor: 'rgba(251,146,60,0.3)', color: '#fb923c' }}>
                      <i className="ri-list-check-2 text-xl" />
                    </div>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-white truncate">{r.name}</span>
                      <span className="block text-[11px] text-zinc-500">
                        {t('mc_rp_totals', { days: totals.days, ex: totals.exercises, sets: totals.sets })}
                        {r.lastUsedAt && ` · ${t('mc_rp_last_used', {
                          date: new Date(r.lastUsedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
                        })}`}
                      </span>
                    </span>
                    <i className={`ri-arrow-down-s-line text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>

                  {open && (
                    <div className="border-t border-white/[0.06]">
                      {r.note && (
                        <p className="text-xs text-zinc-400 leading-relaxed px-4 pt-3">{r.note}</p>
                      )}

                      <div className="p-3 space-y-2">
                        {r.days.map((d, di) => (
                          <div key={d.id} className="rounded-xl p-3"
                            style={{ background: 'var(--s-2)', border: '1px solid var(--s-3)' }}>
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white">
                                  {d.name || t('mc_rp_day_n', { n: di + 1 })}
                                </p>
                                <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                                  {d.exercises.slice(0, 4).map((e) => `${e.name} ${fmtSetCount(e.sets, {
                                    repsMin: e.reps_min, repsMax: e.reps_max, value: e.value, trackingMode: e.tracking_mode,
                                  }, t)}`).join(' · ')}
                                  {d.exercises.length > 4 ? ' …' : ''}
                                </p>
                              </div>
                              <button onClick={() => setRunning({ routine: r, day: d })}
                                className="rk-btn rk-btn-primary rk-press flex items-center gap-1.5 flex-shrink-0"
                                style={{ fontSize: '0.75rem', minHeight: 42, padding: '0.4rem 0.9rem' }}>
                                <i className="ri-play-fill" />{t('mc_rp_start_day')}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 px-4 pb-3">
                        <button onClick={() => setEditing(r)}
                          className="rk-nav-btn text-[11px] flex items-center gap-1.5"
                          style={{ padding: '0.5rem 0.9rem', minHeight: 42 }}>
                          <i className="ri-pencil-line" />{t('mc_edit')}
                        </button>
                        {confirmDel === r.id ? (
                          <div className="flex items-center gap-1.5 ml-auto">
                            <button onClick={() => remove(r.id)}
                              className="text-[11px] font-bold text-red-300 bg-red-600/12 border border-red-500/35 rounded-lg px-2.5 cursor-pointer"
                              style={{ minHeight: 42 }}>{t('mc_delete')}</button>
                            <button onClick={() => setConfirmDel(null)} className="text-[11px] text-zinc-400 px-1.5 cursor-pointer"
                              style={{ minHeight: 42 }}>{t('mc_cancel')}</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDel(r.id)}
                            className="ml-auto text-[11px] text-zinc-500 hover:text-red-400 cursor-pointer px-2"
                            style={{ minHeight: 42 }}>
                            <i className="ri-delete-bin-line" /> {t('mc_delete')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
      )}

      {editing && (
        <RoutineEditor initial={editing} saving={saving} onSave={persist} onCancel={() => setEditing(null)} />
      )}

      {running && (
        <RoutineRunner profile={profile} routine={running.routine} day={running.day} saving={saving}
          onExit={() => setRunning(null)} onFinish={finish} />
      )}

      {importOpen && (
        <ImportPanel aiAvailable={aiAvailable} showToast={showToast}
          onClose={() => setImportOpen(false)}
          onImported={(r) => { setImportOpen(false); setEditing(r); }} />
      )}
    </div>
  );
}

// ── Importar ───────────────────────────────────────────────────

function ImportPanel({ aiAvailable, showToast, onClose, onImported }: {
  aiAvailable: boolean | null;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onClose: () => void;
  onImported: (r: Routine) => void;
}) {
  const { t } = useTranslation();
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

  const buildDraft = (name: string, days: RoutineDay[], note?: string): Routine => ({
    ...emptyRoutine(name),
    days,
    note,
    source: 'import',
  });

  const readHere = () => {
    const { days } = parseRoutineText(text);
    if (days.length === 0) { showToast(t('mc_rp_import_nothing'), 'error'); return; }
    onImported(buildDraft(t('mc_rp_imported_name'), days));
  };

  const readWithAi = async () => {
    setBusy(true);
    try {
      let imageBase64: string | undefined;
      if (file) imageBase64 = await fileToBase64(file);
      const res = await importRoutine({ text: text.trim() || undefined, imageBase64, mediaType: file?.type });
      if (res.routine) {
        onImported(buildDraft(res.routine.name, res.routine.days, res.routine.note));
        return;
      }
      // Segunda oportunidad en local antes de devolver al usuario a la casilla
      // de salida.
      if (text.trim()) {
        const { days } = parseRoutineText(text);
        if (days.length > 0) {
          showToast(t('mc_rp_import_fallback'));
          onImported(buildDraft(t('mc_rp_imported_name'), days));
          return;
        }
      }
      showToast(res.error || t('mc_rp_import_nothing'), 'error');
    } catch {
      showToast(t('mc_rp_import_nothing'), 'error');
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
          <h3 className="rk-h3" style={{ fontSize: '1.05rem', color: '#fff', margin: 0 }}>{t('mc_rp_import_title')}</h3>
          <button onClick={onClose} aria-label={t('mc_close')}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer">
            <i className="ri-close-line" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <p className="text-xs text-zinc-400 leading-relaxed">{t('mc_rp_import_desc')}</p>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_rp_import_text')}</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8}
              placeholder={t('mc_rp_import_text_ph')}
              className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 resize-y font-mono"
              style={{ fontSize: 13 }} />
          </div>

          <div>
            <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] || null)} />
            <button onClick={() => fileRef.current?.click()} disabled={soon || busy}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] text-xs font-semibold text-zinc-200 hover:border-white/25 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              style={{ minHeight: 46 }}>
              <i className="ri-image-add-line" />{file ? file.name.slice(0, 28) : t('mc_rp_import_photo')}
            </button>
            {soon && <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">{t('mc_rp_import_ai_paused')}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-2 px-5 py-4 border-t border-white/[0.07] flex-shrink-0"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          <button onClick={readWithAi} disabled={busy || soon || (!text.trim() && !file)}
            className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ minHeight: 48 }}>
            {busy
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('mc_rp_import_reading')}</>
              : <><i className="ri-sparkling-2-line" />{t('mc_rp_import_with_ai')}</>}
          </button>
          <button onClick={readHere} disabled={busy || !text.trim()}
            className="rk-nav-btn w-full text-xs flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ padding: '0.7rem 1rem', minHeight: 46 }}>
            <i className="ri-scan-line" />{t('mc_rp_import_here')}
          </button>
          <p className="text-[10px] text-zinc-600 leading-relaxed text-center">{t('mc_rp_import_here_hint')}</p>
        </div>
      </div>
    </div>
  );
}
