// ════════════════════════════════════════════════════════════════
// RANKD · Rutinas guardadas
//
// ── LAS QUE NADIE VEÍA ──
//
// Cada plan con fuerza guarda su rutina en `workout_routines`: es lo que hace
// que el bloque de fuerza de la Agenda se abra como checklist. Pero no había
// ni una pantalla que las listara. `loadRoutines` solo se usaba por dentro,
// para abrir un día desde la Agenda, y `deleteRoutine` estaba escrito entero
// y no lo llamaba nadie.
//
// Así que cada plan nuevo dejaba una rutina más, invisible y sin forma de
// quitarla. Aquí se ven, se puede entrenar cualquiera de sus días sin tenerlo
// en la Agenda, y se pueden borrar.
//
// ── BORRAR SIN ROMPER LA AGENDA ──
//
// Un bloque de la Agenda apunta a su rutina por id. Si se borra la rutina, el
// bloque sigue ahí (con su nombre y sus ejercicios, que van en él) pero ya no
// abre el checklist. Por eso, antes de borrar, se dice cuántos bloques
// pendientes la usan. Lo ya entrenado no depende de ella: está en el historial.
// ════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, type Profile } from '@/lib/supabase';
import RoutineRunner from './RoutineRunner';
import {
  deleteRoutine, loadRoutines, saveRoutineSession, touchRoutine,
  type LoggedSet, type Routine, type RoutineDay,
} from '../lib/routines';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** Para refrescar lo que dependa de las sesiones al terminar un día. */
  onChanged?: () => void;
}

export default function SavedRoutines({ profile, showToast, onChanged }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const [items, setItems] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [runner, setRunner] = useState<{ routine: Routine; day: RoutineDay } | null>(null);
  const [guardando, setGuardando] = useState(false);
  /** Rutina que se va a borrar, con cuántos bloques pendientes la usan. */
  const [borrar, setBorrar] = useState<{ r: Routine; usos: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { routines } = await loadRoutines(profile.id);
    setItems(routines);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const pedirBorrar = async (r: Routine) => {
    let usos = 0;
    if (!r.id.startsWith('rt_')) {
      const { count } = await supabase.from('day_plan_items')
        .select('id', { count: 'exact', head: true })
        .eq('fighter_profile_id', profile.id)
        .eq('kind', 'strength')
        .eq('completed', false)
        .eq('payload->>routine_id', r.id);
      usos = count || 0;
    }
    setBorrar({ r, usos });
  };

  const confirmarBorrar = async () => {
    if (!borrar) return;
    const { r } = borrar;
    setBorrar(null);
    setItems((prev) => prev.filter((x) => x.id !== r.id));
    try {
      await deleteRoutine(profile.id, r.id);
      showToast(t('mc_sr_deleted'));
    } catch {
      showToast(t('error_save'), 'error');
      load();
    }
  };

  const terminar = async (date: string, slot: string | null, sets: LoggedSet[]) => {
    if (!runner) return;
    setGuardando(true);
    const res = await saveRoutineSession(profile.id, date, slot, sets);
    setGuardando(false);
    if (!res.ok) { showToast(t('error_save'), 'error'); return; }
    void touchRoutine(profile.id, runner.routine);
    setRunner(null);
    showToast(t('mc_sr_logged'));
    onChanged?.();
    load();
  };

  if (loading || items.length === 0) return null;

  const fecha = (iso: string | null | undefined) => (iso
    ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
    : null);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-white">{t('mc_sr_title')}</p>
        <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{t('mc_sr_sub')}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-2.5 items-start">
        {items.map((r) => {
          const abiertaEsta = abierta === r.id;
          const usada = fecha(r.lastUsedAt);
          return (
            <div key={r.id} className="rk-card" style={{ padding: '14px 16px' }}>
              <div className="flex items-start gap-2.5">
                <i className="ri-hammer-line text-lg flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                <button onClick={() => setAbierta(abiertaEsta ? null : r.id)} aria-expanded={abiertaEsta}
                  className="min-w-0 flex-1 text-left cursor-pointer">
                  <p className="text-sm font-bold text-white leading-snug line-clamp-2">{r.name}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {t('mc_sr_days', { count: r.days.length })}
                    {' · '}
                    {usada ? t('mc_sr_used', { date: usada }) : t('mc_sr_created', { date: fecha(r.createdAt) })}
                  </p>
                </button>
                <button onClick={() => pedirBorrar(r)} aria-label={t('mc_delete')}
                  className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors">
                  <i className="ri-delete-bin-line text-sm" />
                </button>
              </div>

              {/* Los días, a la vista al abrirla. Cada uno se puede entrenar ya. */}
              {abiertaEsta && (
                <div className="mt-3 space-y-1.5 anim-scale-in">
                  {r.days.map((d) => (
                    <div key={d.id} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2" style={{ background: 'var(--s-2)' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{d.name}</p>
                        <p className="text-[11px] text-zinc-500 truncate">
                          {d.exercises.length > 0
                            ? d.exercises.slice(0, 4).map((e) => e.name).join(' · ')
                            : t('mc_sr_no_exercises')}
                        </p>
                      </div>
                      {d.exercises.length > 0 && (
                        <button onClick={() => setRunner({ routine: r, day: d })}
                          className="rk-nav-btn rk-press flex-shrink-0 inline-flex items-center gap-1 text-xs"
                          style={{ minHeight: 40, padding: '0 0.8rem' }}>
                          <i className="ri-play-fill" />{t('mc_sr_train')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmar el borrado, diciendo qué pasa con la Agenda. */}
      {borrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setBorrar(null); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative rk-card w-full max-w-sm" style={{ padding: 20 }}>
            <p className="text-sm font-bold text-white">{t('mc_sr_delete_title')}</p>
            <p className="text-xs text-zinc-500 mt-1 truncate">{borrar.r.name}</p>
            <p className="text-xs text-zinc-300 mt-3 leading-relaxed">
              {borrar.usos > 0 ? t('mc_sr_delete_used', { count: borrar.usos }) : t('mc_sr_delete_free')}
            </p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setBorrar(null)} className="rk-nav-btn rk-press flex-1" style={{ minHeight: 46 }}>
                {t('mc_cancel')}
              </button>
              <button onClick={confirmarBorrar} className="rk-cta rk-press flex-1" style={{ minHeight: 46 }}>
                {t('mc_delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {runner && (
        <RoutineRunner profile={profile} routine={runner.routine} day={runner.day} saving={guardando}
          onExit={() => setRunner(null)} onFinish={terminar} />
      )}
    </div>
  );
}
