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
  protocolTotals, protocolVarsFor, saveProtocol, formatVarValue,
  type Protocol, type ProtocolRun,
} from '@/pages/mi-esquina/lib/protocols';
// Biblioteca de protocolos de actividad (punto 16).
//
// Vive dentro de Actividad, como pestaña propia. Aquí se GUARDAN varios
// protocolos y se eligen; el guion en vivo lo pinta ProtocolPlayer y la
// edición, ProtocolEditor.
//
// ── IMPORTAR YA NO ESTÁ AQUÍ ──
//
// Meter un documento se hace en Planificar, en un solo sitio, y allí se detecta
// solo si es fuerza, cardio, la semana entera o comidas. Tenerlo también aquí
// obligaba a saber de qué era el documento ANTES de elegir la puerta, y un plan
// con fuerza y cardio dentro no tenía puerta buena.
//
// Esta pantalla se queda con su tarea: USAR los protocolos que ya tienes. Meter
// y usar son cosas distintas y cada una va donde tiene sentido — usar, aquí,
// que es donde estás cuando vas a entrenar.

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** Avisa a Actividad de que hay una sesión nueva en el historial. */
  onSessionSaved?: () => void;
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
      </div>

      {/* Importar un documento se hace en Planificar, en un solo sitio. Aquí se
          dice dónde para que nadie lo busque por la sección equivocada. */}
      <p className="text-[11px] text-zinc-500 leading-relaxed">
        <i className="ri-information-line mr-1" />{t('mc_pt_import_moved')}
      </p>

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

    </div>
  );
}
