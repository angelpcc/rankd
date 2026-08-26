import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable, isMissingColumn } from '@/lib/dbState';
import { MUSCLE_GROUPS } from '../lib/exercises';
import BottomSheet from '@/components/base/BottomSheet';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** true = versión reducida para el resumen (solo las más usadas, sin gestión) */
  compact?: boolean;
  /** Se llama al registrar, para que el resumen refresque sus cifras */
  onLogged?: () => void;
}

interface Template {
  id: string;
  name: string;
  session_type: string;
  duration_min: number | null;
  intensity: number;
  notes: string | null;
  use_count: number;
  days_of_week: number[] | null;
  muscle_group: string | null;
}

// 0=domingo..6=sábado (Date.getDay()), mostrados en orden L-D.
const WEEKDAYS = [
  { n: 1, key: 'mc_wd_mon' }, { n: 2, key: 'mc_wd_tue' }, { n: 3, key: 'mc_wd_wed' },
  { n: 4, key: 'mc_wd_thu' }, { n: 5, key: 'mc_wd_fri' }, { n: 6, key: 'mc_wd_sat' }, { n: 0, key: 'mc_wd_sun' },
];
function todayWeekday(): number { return new Date().getDay(); }

// Mismos tipos que el diario de entrenos, para que lo registrado encaje.
const TYPES = [
  { value: 'sparring', key: 'mc_st_sparring', icon: 'ri-boxing-line', color: '#E10600' },
  { value: 'tecnica', key: 'mc_st_tecnica', icon: 'ri-focus-3-line', color: '#38bdf8' },
  { value: 'fuerza', key: 'mc_st_fuerza', icon: 'ri-hammer-line', color: '#fb923c' },
  { value: 'cardio', key: 'mc_st_cardio', icon: 'ri-run-line', color: '#4ade80' },
  { value: 'flexibilidad', key: 'mc_st_flexibilidad', icon: 'ri-yoga-line', color: '#a78bfa' },
  { value: 'recuperacion', key: 'mc_st_recuperacion', icon: 'ri-heart-pulse-line', color: '#facc15' },
];

const typeCfg = (v: string) => TYPES.find((x) => x.value === v) || TYPES[1];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Rutinas guardadas: plantillas del entreno de siempre que se registran de un
 * toque. Quita la fricción de rellenar el formulario entero cada vez, que es
 * justo lo que hace que la gente deje de apuntar sus sesiones.
 */
export default function QuickRoutines({ profile, showToast, compact, onLogged }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logging, setLogging] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState('tecnica');
  const [duration, setDuration] = useState('60');
  const [intensity, setIntensity] = useState(3);
  const [notes, setNotes] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [muscleGroup, setMuscleGroup] = useState<string>('');
  // Si days_of_week/muscle_group aún no existen (migración 0040 sin aplicar).
  const [scheduleReady, setScheduleReady] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('workout_templates')
      .select('*')
      .eq('fighter_profile_id', profile.id)
      .order('use_count', { ascending: false })
      .order('created_at', { ascending: false });
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    setItems((data || []) as Template[]);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!name.trim()) { showToast(t('mc_rt_name'), 'error'); return; }
    setSaving(true);
    const full = {
      fighter_profile_id: profile.id,
      name: name.trim(),
      session_type: type,
      duration_min: duration ? parseInt(duration, 10) : null,
      intensity,
      notes: notes.trim() || null,
      days_of_week: days.length > 0 ? days : null,
      muscle_group: type === 'fuerza' && muscleGroup ? muscleGroup : null,
    };
    let { data, error } = await supabase.from('workout_templates').insert(full).select().maybeSingle();
    if (error && isMissingColumn(error)) {
      setScheduleReady(false);
      const { days_of_week: _d, muscle_group: _m, ...base } = full;
      void _d; void _m;
      ({ data, error } = await supabase.from('workout_templates').insert(base).select().maybeSingle());
    }
    setSaving(false);
    if (error || !data) { showToast(t('error_save'), 'error'); return; }
    setItems((prev) => [data as Template, ...prev]);
    setShowForm(false);
    setName(''); setNotes(''); setDuration('60'); setIntensity(3); setType('tecnica'); setDays([]); setMuscleGroup('');
    showToast(t('mc_rt_created'));
  };

  /** Registra la plantilla como sesión de hoy en el diario y suma un uso. */
  const logIt = async (tpl: Template) => {
    setLogging(tpl.id);
    const { error } = await supabase.from('training_sessions').insert({
      fighter_profile_id: profile.id,
      session_date: todayISO(),
      session_type: tpl.session_type,
      duration_min: tpl.duration_min,
      intensity: tpl.intensity,
      notes: tpl.notes,
    });
    if (error) { setLogging(null); showToast(t('error_save'), 'error'); return; }
    // El contador de usos es informativo: si falla, la sesión ya está guardada.
    await supabase.from('workout_templates').update({ use_count: tpl.use_count + 1 }).eq('id', tpl.id);
    setItems((prev) => [...prev.map((x) => x.id === tpl.id ? { ...x, use_count: x.use_count + 1 } : x)]
      .sort((a, b) => b.use_count - a.use_count));
    setLogging(null);
    showToast(t('mc_rt_logged'));
    onLogged?.();
  };

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    const { error } = await supabase.from('workout_templates').delete().eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); load(); }
  };

  if (unavailable) {
    if (compact) return null;
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
          <i className="ri-repeat-line text-3xl text-red-400"></i>
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.2rem', color: '#fff' }}>{t('mc_coming_soon_title')}</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{t('mc_coming_soon_desc')}</p>
      </div>
    );
  }

  if (loading) {
    if (compact) return null;
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  // ── Versión compacta para el resumen: solo las 3 más usadas ──
  if (compact) {
    if (items.length === 0) return null;
    return (
      <div className="rk-card" style={{ padding: '16px 20px', transform: 'none' }}>
        <div className="flex items-center gap-2 mb-3">
          <i className="ri-flashlight-fill text-[#C9A84C]"></i>
          <p className="text-sm font-bold text-white">{t('mc_rt_quick_title')}</p>
          <span className="text-[11px] text-zinc-500">· {t('mc_rt_quick_desc')}</span>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          {items.slice(0, 3).map((tpl) => {
            const cfg = typeCfg(tpl.session_type);
            return (
              <button key={tpl.id} onClick={() => logIt(tpl)} disabled={logging === tpl.id}
                className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left cursor-pointer transition-colors disabled:opacity-60"
                style={{ background: `${cfg.color}0f`, borderColor: `${cfg.color}33` }}>
                {logging === tpl.id
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  : <i className={cfg.icon} style={{ color: cfg.color, fontSize: 16 }} />}
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-bold text-white truncate">{tpl.name}</span>
                  {tpl.duration_min && <span className="block text-[10px] text-zinc-500">{tpl.duration_min} min</span>}
                </span>
                <i className="ri-add-circle-line text-zinc-500 flex-shrink-0"></i>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Sección completa ──
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="rk-eyebrow">{t('mc_rt_quick_desc')}</p>
          <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
            {t('mc_rt_title')}
          </h2>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-md">{t('mc_rt_subtitle')}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="rk-btn rk-btn-primary flex items-center gap-2" style={{ fontSize: '0.85rem', padding: '0.7rem 1.4rem' }}>
          <i className="ri-add-line"></i> {t('mc_rt_new')}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rk-card text-center" style={{ padding: '48px 28px' }}>
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-white/[0.04] border border-white/10">
            <i className="ri-repeat-line text-3xl text-zinc-600"></i>
          </div>
          <p className="text-white font-bold">{t('mc_rt_empty')}</p>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-sm mx-auto leading-relaxed">{t('mc_rt_empty_desc')}</p>
          <button onClick={() => setShowForm(true)} className="rk-btn rk-btn-primary mt-6" style={{ fontSize: '0.85rem', padding: '0.7rem 1.6rem' }}>
            {t('mc_rt_new')}
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {(showAll ? items : items.slice(0, 3)).map((tpl) => {
            const cfg = typeCfg(tpl.session_type);
            return (
              <div key={tpl.id} className="rk-card group flex flex-col" style={{ padding: '18px 20px' }}>
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl border"
                    style={{ background: `${cfg.color}14`, borderColor: `${cfg.color}40`, color: cfg.color }}>
                    <i className={`${cfg.icon} text-xl`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-white leading-snug">{tpl.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {t(cfg.key)}
                      {tpl.muscle_group ? ` · ${t(`mc_str_mg_${tpl.muscle_group}`, tpl.muscle_group)}` : ''}
                      {tpl.duration_min ? ` · ${tpl.duration_min} min` : ''}
                      {` · ${'🔥'.repeat(Math.max(1, Math.min(5, tpl.intensity)))}`}
                    </p>
                  </div>
                  <button onClick={() => remove(tpl.id)} aria-label={t('mc_delete')}
                    className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 transition-colors cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>

                {tpl.days_of_week && tpl.days_of_week.length > 0 && (
                  <div className="flex gap-1 mt-3">
                    {WEEKDAYS.map((wd) => (
                      <span key={wd.n} className={`w-6 h-6 flex items-center justify-center rounded-md text-[10px] font-bold ${tpl.days_of_week!.includes(wd.n) ? 'bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/30' : 'text-zinc-700'}`}>
                        {t(wd.key)}
                      </span>
                    ))}
                  </div>
                )}

                {tpl.notes && <p className="text-xs text-zinc-400 mt-3 leading-relaxed">{tpl.notes}</p>}

                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/[0.06]">
                  <span className="text-[11px] text-zinc-600 flex-1">
                    {tpl.use_count === 0 ? t('mc_rt_used_never') : tpl.use_count === 1 ? t('mc_rt_used_once') : t('mc_rt_used_times', { n: tpl.use_count })}
                  </span>
                  <button onClick={() => logIt(tpl)} disabled={logging === tpl.id}
                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors disabled:opacity-60">
                    {logging === tpl.id
                      ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <i className="ri-add-line"></i>}
                    {t('mc_rt_log')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {items.length > 3 && (
        <button onClick={() => setShowAll((v) => !v)}
          className="w-full text-center text-sm font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer py-2">
          {showAll ? t('mc_rt_view_less') : t('mc_rt_view_all', { n: items.length })}
        </button>
      )}

      {/* Modal nueva rutina */}
      <BottomSheet
        open={showForm}
        onClose={() => setShowForm(false)}
        title={t('mc_rt_new')}
        footer={
          <button onClick={create} disabled={saving} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.95rem', minHeight: 44 }}>
            {saving
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('mc_saving')}</>
              : <><i className="ri-add-line"></i> {t('mc_rt_create')}</>}
          </button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">{t('mc_rt_name')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={60} placeholder={t('mc_rt_name_ph')}
              style={{ fontSize: 16, minHeight: 44 }}
              className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">{t('mc_rt_type')}</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((tp) => (
                <button key={tp.value} onClick={() => setType(tp.value)}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border transition-all cursor-pointer ${type === tp.value ? 'border-white/30' : 'border-white/10 hover:border-white/20'}`}
                  style={{ background: type === tp.value ? `${tp.color}18` : 'rgba(255,255,255,0.02)', minHeight: 44 }}>
                  <i className={tp.icon} style={{ color: tp.color, fontSize: 15 }}></i>
                  <span className="text-[11px] font-semibold text-white text-center leading-tight">{t(tp.key)}</span>
                </button>
              ))}
            </div>
          </div>

          {type === 'fuerza' && (
            <div>
              <label className="block text-sm text-zinc-400 mb-2">{t('mc_rt_muscle_group')} <span className="text-zinc-600">({t('mc_optional')})</span></label>
              <div className="flex flex-wrap gap-1.5">
                {MUSCLE_GROUPS.map((g) => (
                  <button key={g} onClick={() => setMuscleGroup(muscleGroup === g ? '' : g)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer transition-colors ${muscleGroup === g ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:border-white/25'}`}
                    style={{ minHeight: 34 }}>
                    {t(`mc_str_mg_${g}`, g)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {scheduleReady && (
            <div>
              <label className="block text-sm text-zinc-400 mb-2">{t('mc_rt_days')} <span className="text-zinc-600">({t('mc_optional')})</span></label>
              <div className="flex gap-1.5">
                {WEEKDAYS.map((wd) => (
                  <button key={wd.n} onClick={() => setDays((prev) => prev.includes(wd.n) ? prev.filter((d) => d !== wd.n) : [...prev, wd.n])}
                    className={`flex-1 py-2.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${days.includes(wd.n) ? 'bg-[#C9A84C] border-[#C9A84C] text-zinc-900' : 'bg-white/[0.02] border-white/10 text-zinc-500 hover:border-white/25'}`}
                    style={{ minHeight: 40 }}>
                    {t(wd.key)}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-zinc-600 mt-1.5">{t('mc_rt_days_hint')}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">{t('mc_rt_duration')}</label>
              <input value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="numeric" type="number"
                style={{ fontSize: 16, minHeight: 44 }}
                className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">{t('mc_rt_intensity')}</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button key={v} onClick={() => setIntensity(v)} style={{ minHeight: 44 }}
                    className={`flex-1 py-2.5 rounded-lg border text-xs transition-all cursor-pointer ${intensity >= v ? 'bg-red-600/20 border-red-500/50 text-red-300' : 'bg-white/[0.02] border-white/10 text-zinc-600'}`}>
                    🔥
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">
              {t('mc_rt_notes')} <span className="text-zinc-600">({t('mc_optional')})</span>
            </label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={300} placeholder={t('mc_rt_notes_ph')}
              style={{ fontSize: 16 }}
              className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-y" />
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
