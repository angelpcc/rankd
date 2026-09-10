import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Profile } from '@/lib/supabase';
import Reveal from '@/components/base/Reveal';
import RoutineEditor from '@/pages/mi-esquina/components/RoutineEditor';
import RoutineRunner from '@/pages/mi-esquina/components/RoutineRunner';
import { reconcileDayTicks } from '@/pages/mi-esquina/lib/planTicks';
import { fmtSetCount } from '@/pages/mi-esquina/lib/dayPlan';
import {
  deleteRoutine, emptyRoutine, loadRoutines, routineTotals,
  saveRoutine, saveRoutineSession, touchRoutine,
  type LoggedSet, type Routine, type RoutineDay,
} from '@/pages/mi-esquina/lib/routines';

// Biblioteca de rutinas preescritas (punto 17).
//
// Vive dentro de Fuerza, como pestaña propia. Guarda varias rutinas, deja
// elegir el día que toca y abre el checklist en vivo (RoutineRunner).
//
// ── IMPORTAR YA NO ESTÁ AQUÍ ──
//
// Meter un documento se hace en Planificar, en un solo sitio, y allí se detecta
// solo si es fuerza, cardio, la semana entera o comidas. Tenerlo también aquí
// obligaba a saber de qué era el documento ANTES de elegir la puerta, y un plan
// con fuerza y cardio dentro no tenía puerta buena.
//
// Esta pantalla se queda con su tarea: USAR las rutinas que ya tienes. Meter y
// usar son cosas distintas y cada una va donde tiene sentido — usar, aquí, que
// es donde estás cuando vas a entrenar.

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** Avisa a Fuerza de que hay una sesión nueva en el historial. */
  onSessionSaved?: () => void;
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

  const load = useCallback(async () => {
    const { routines: list, storedLocally } = await loadRoutines(profile.id);
    setRoutines(list);
    setLocalOnly(storedLocally);
    setOpenRoutine((cur) => cur ?? (list[0]?.id ?? null));
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { void load(); }, [load]);

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
      </div>

      {/* ── Importar ya no vive aquí ──
          Meter un documento se hace en un solo sitio, Planificar, y allí se
          detecta solo si es fuerza, cardio, la semana entera o comidas. Tenerlo
          también aquí obligaba a saber de qué era el documento ANTES de elegir
          la puerta, y un plan con fuerza y cardio dentro no tenía puerta buena.
          Esta pantalla se queda con lo suyo: USAR las rutinas que ya tienes. */}
      <p className="text-[11px] text-zinc-500 leading-relaxed">
        <i className="ri-information-line mr-1" />{t('mc_rp_import_moved')}
      </p>

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

    </div>
  );
}

// ── Importar ───────────────────────────────────────────────────
