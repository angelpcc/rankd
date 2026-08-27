import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable, isMissingColumn } from '@/lib/dbState';
import { parseWeekPlanFromSpeech, type WeekPlanLine, type WeekPlanKind } from '@/lib/dictation';
import VoiceButton from '@/components/feature/VoiceButton';
import BottomSheet from '@/components/base/BottomSheet';
import { MUSCLE_GROUPS } from '../lib/exercises';
import {
  type DayPlanKind, type MealSlot, KIND_ORDER, KIND_META, ACTIVITY_KINDS, MEAL_SLOTS, isoOf,
} from '../lib/dayPlan';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** Se llama al añadir algo, para que la Agenda refresque. */
  onLogged?: () => void;
}

// 0=domingo..6=sábado (Date.getDay()), en orden L-D para la UI.
const WEEKDAYS = [
  { n: 1, key: 'mc_wd_mon' }, { n: 2, key: 'mc_wd_tue' }, { n: 3, key: 'mc_wd_wed' },
  { n: 4, key: 'mc_wd_thu' }, { n: 5, key: 'mc_wd_fri' }, { n: 6, key: 'mc_wd_sat' }, { n: 0, key: 'mc_wd_sun' },
];

function mondayOf(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const day = x.getDay() === 0 ? 6 : x.getDay() - 1;
  x.setDate(x.getDate() - day);
  return x;
}
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
/** Fecha ISO del día `dow` (Date.getDay) dentro de la semana que empieza el lunes `ws`. */
function dateOfDow(ws: Date, dow: number): string {
  return isoOf(addDays(ws, dow === 0 ? 6 : dow - 1));
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

interface ReviewRow {
  key: string;
  day: number;
  kind: WeekPlanKind;
  text: string;
  groups: string[];
  actKind: string;
  duration?: number;
  slot: MealSlot;
}

function lineToRow(l: WeekPlanLine, i: number): ReviewRow {
  const p = l.payload as Record<string, unknown>;
  return {
    key: `${i}-${Math.random().toString(36).slice(2, 7)}`,
    day: l.day,
    kind: l.kind,
    text: String(p.note || p.text || p.name || p.exercises || ''),
    groups: Array.isArray(p.groups) ? (p.groups as string[]) : [],
    actKind: typeof p.kind === 'string' ? p.kind : ACTIVITY_KINDS[0].value,
    duration: typeof p.duration_min === 'number' ? p.duration_min : undefined,
    slot: (p.slot as MealSlot) || 'comida',
  };
}

function rowToPayload(r: ReviewRow): Record<string, unknown> | null {
  const text = r.text.trim();
  switch (r.kind) {
    case 'strength':
      if (r.groups.length === 0) return null;
      return { groups: r.groups, ...(text ? { exercises: text } : {}) };
    case 'activity':
      return { kind: r.actKind, ...(r.duration ? { duration_min: r.duration } : {}), ...(text ? { note: text } : {}) };
    case 'meal':
      if (!text) return null;
      return { slot: r.slot, text };
    case 'supplement':
      if (!text) return null;
      return { name: text };
    default:
      if (!text) return null;
      return { text };
  }
}

export default function PlanificarPanel({ profile, showToast, onLogged }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const weekStart = mondayOf(new Date());
  const weekLabel = weekStart.toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  const [text, setText] = useState('');
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Interpretar ──
  const interpret = () => {
    const lines = parseWeekPlanFromSpeech(text);
    setRows(lines.map(lineToRow));
  };

  const updateRow = (key: string, patch: Partial<ReviewRow>) =>
    setRows((rs) => (rs ? rs.map((r) => (r.key === key ? { ...r, ...patch } : r)) : rs));
  const removeRow = (key: string) => setRows((rs) => (rs ? rs.filter((r) => r.key !== key) : rs));

  const confirm = async () => {
    if (!rows || rows.length === 0) return;
    setSaving(true);
    const payloadRows = rows
      .map((r) => ({ r, payload: rowToPayload(r) }))
      .filter((x): x is { r: ReviewRow; payload: Record<string, unknown> } => x.payload !== null)
      .map(({ r, payload }) => ({
        fighter_profile_id: profile.id,
        plan_date: dateOfDow(weekStart, r.day),
        kind: r.kind,
        payload,
        source: 'manual',
      }));
    if (payloadRows.length === 0) { setSaving(false); return; }
    const { error } = await supabase.from('day_plan_items').insert(payloadRows);
    setSaving(false);
    if (error) { showToast(t('error_save'), 'error'); return; }
    showToast(t('mc_pl_added', { n: payloadRows.length }));
    setRows(null);
    setText('');
    onLogged?.();
  };

  // ══════════ PANTALLA DE REVISIÓN ══════════
  if (rows) {
    const byDay = WEEKDAYS.map((wd) => ({ wd, list: rows.filter((r) => r.day === wd.n) }));
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <p className="rk-eyebrow">{t('mc_pl_eyebrow')}</p>
          <h2 className="rk-h2" style={{ fontSize: 'clamp(1.6rem,4vw,2.1rem)', color: '#fff', margin: '4px 0 0' }}>{t('mc_pl_review_title')}</h2>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-md">{t('mc_pl_review_sub')}</p>
          <p className="text-[11px] text-zinc-600 mt-1">{t('mc_pl_week_of', { date: weekLabel })}</p>
        </div>

        {rows.length === 0 ? (
          <div className="rk-card text-center" style={{ padding: '36px 24px' }}>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-sm mx-auto">{t('mc_pl_review_none')}</p>
            <button onClick={() => setRows(null)} className="rk-btn rk-btn-ghost mt-5" style={{ fontSize: '0.8rem', padding: '0.6rem 1.4rem' }}>
              <i className="ri-arrow-left-line mr-1"></i>{t('mc_pl_back')}
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {byDay.filter((d) => d.list.length > 0).map(({ wd, list }) => (
                <div key={wd.n} className="rk-card" style={{ padding: '14px 16px' }}>
                  <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-red-400 mb-2.5 capitalize">
                    {addDays(weekStart, wd.n === 0 ? 6 : wd.n - 1).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' })}
                  </p>
                  <div className="space-y-2">
                    {list.map((r) => (
                      <ReviewRowEditor key={r.key} row={r} onChange={(patch) => updateRow(r.key, patch)} onRemove={() => removeRow(r.key)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <button onClick={() => setRows(null)} className="rk-btn rk-btn-ghost" style={{ fontSize: '0.82rem', padding: '0.7rem 1.4rem' }}>
                <i className="ri-arrow-left-line mr-1"></i>{t('mc_pl_back')}
              </button>
              <button onClick={confirm} disabled={saving} className="rk-btn rk-btn-primary flex items-center gap-2 disabled:opacity-60" style={{ fontSize: '0.82rem', padding: '0.7rem 1.4rem' }}>
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <i className="ri-calendar-check-line"></i>}
                {t('mc_pl_confirm')}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ══════════ ENTRADA + PLANTILLAS ══════════
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <p className="rk-eyebrow">{t('mc_pl_eyebrow')}</p>
        <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
          {t('mc_pl_title')} <span className="rk-red-glow">{t('mc_pl_title_2')}</span>
        </h2>
        <p className="text-zinc-400 text-sm mt-1.5 max-w-md">{t('mc_pl_sub')}</p>
      </div>

      <div className="rk-card space-y-3" style={{ padding: '18px 20px' }}>
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-bold text-white">{t('mc_pl_input_label')}</label>
          <VoiceButton onResult={(dictated) => setText((prev) => (prev.trim() ? `${prev} ${dictated}` : dictated))} />
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={1200}
          placeholder={t('mc_pl_input_ph')} style={{ fontSize: 16 }}
          className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 resize-y leading-relaxed" />
        <button onClick={interpret} disabled={!text.trim()}
          className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50" style={{ fontSize: '0.9rem', padding: '0.85rem' }}>
          <i className="ri-magic-line"></i> {t('mc_pl_btn')}
        </button>
      </div>

      <SavedTemplates profile={profile} showToast={showToast} weekStart={weekStart} onApplied={onLogged} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
function ReviewRowEditor({ row, onChange, onRemove }: {
  row: ReviewRow; onChange: (patch: Partial<ReviewRow>) => void; onRemove: () => void;
}) {
  const { t } = useTranslation();
  const meta = KIND_META[row.kind as DayPlanKind];
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={row.kind} onChange={(e) => onChange({ kind: e.target.value as WeekPlanKind })}
          className="bg-white/[0.05] border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-red-500 cursor-pointer" style={{ fontSize: 14 }}>
          {KIND_ORDER.map((k) => <option key={k} value={k}>{t(KIND_META[k].labelKey)}</option>)}
        </select>
        <select value={row.day} onChange={(e) => onChange({ day: parseInt(e.target.value, 10) })}
          className="bg-white/[0.05] border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-red-500 cursor-pointer" style={{ fontSize: 14 }}>
          {WEEKDAYS.map((wd) => <option key={wd.n} value={wd.n}>{t(wd.key)}</option>)}
        </select>
        <i className={meta.icon} style={{ color: meta.hex, marginLeft: 'auto' }}></i>
        <button onClick={onRemove} aria-label={t('mc_pl_line_remove')} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer">
          <i className="ri-delete-bin-line text-sm"></i>
        </button>
      </div>

      {row.kind === 'strength' && (
        <div className="flex flex-wrap gap-1">
          {MUSCLE_GROUPS.map((g) => (
            <button key={g} onClick={() => onChange({ groups: row.groups.includes(g) ? row.groups.filter((x) => x !== g) : [...row.groups, g] })}
              className={`px-2 py-1 rounded-md border text-[11px] font-semibold cursor-pointer transition-colors ${row.groups.includes(g) ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.02] border-white/10 text-zinc-500 hover:border-white/25'}`}>
              {t(`mc_str_mg_${g}`, { defaultValue: g })}
            </button>
          ))}
        </div>
      )}

      {row.kind === 'activity' && (
        <div className="flex flex-wrap items-center gap-1.5">
          <select value={row.actKind} onChange={(e) => onChange({ actKind: e.target.value })}
            className="bg-white/[0.05] border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-red-500 cursor-pointer" style={{ fontSize: 14 }}>
            {ACTIVITY_KINDS.map((a) => <option key={a.value} value={a.value}>{t(a.labelKey)}</option>)}
          </select>
          <input type="number" min="5" max="600" value={row.duration ?? ''} placeholder="min"
            onChange={(e) => onChange({ duration: e.target.value ? parseInt(e.target.value, 10) : undefined })}
            className="w-20 bg-white/[0.05] border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-red-500" style={{ fontSize: 14 }} />
        </div>
      )}

      {row.kind === 'meal' && (
        <div className="flex gap-1">
          {MEAL_SLOTS.map((s) => (
            <button key={s.value} onClick={() => onChange({ slot: s.value })}
              className={`flex-1 py-1.5 rounded-md border text-[11px] font-bold cursor-pointer transition-all ${row.slot === s.value ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.02] border-white/10 text-zinc-500 hover:border-white/25'}`}>
              {t(s.labelKey)}
            </button>
          ))}
        </div>
      )}

      {row.kind !== 'strength' || row.text ? (
        <input value={row.text} onChange={(e) => onChange({ text: e.target.value })} maxLength={200}
          placeholder={row.kind === 'supplement' ? t('mc_dp_form_supp_ph') : row.kind === 'meal' ? t('mc_dp_form_meal_ph') : t('mc_dp_form_note_ph')}
          style={{ fontSize: 16 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-red-500" />
      ) : (
        <input value={row.text} onChange={(e) => onChange({ text: e.target.value })} maxLength={200}
          placeholder={t('mc_dp_form_exercises_ph')}
          style={{ fontSize: 16 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-red-500" />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
function SavedTemplates({ profile, showToast, weekStart, onApplied }: {
  profile: Profile; showToast: (m: string, t?: 'success' | 'error') => void; weekStart: Date; onApplied?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);

  // form
  const [name, setName] = useState('');
  const [type, setType] = useState('tecnica');
  const [duration, setDuration] = useState('60');
  const [days, setDays] = useState<number[]>([]);
  const [muscleGroup, setMuscleGroup] = useState('');
  const [saving, setSaving] = useState(false);
  const [scheduleReady, setScheduleReady] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('workout_templates').select('*')
      .eq('fighter_profile_id', profile.id).order('use_count', { ascending: false }).order('created_at', { ascending: false });
    if (isMissingTable(error)) { setItems([]); setLoading(false); return; }
    setItems((data || []) as Template[]);
    setLoading(false);
  }, [profile.id]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!name.trim()) { showToast(t('mc_rt_name'), 'error'); return; }
    setSaving(true);
    const full = {
      fighter_profile_id: profile.id, name: name.trim(), session_type: type,
      duration_min: duration ? parseInt(duration, 10) : null, intensity: 3, notes: null,
      days_of_week: days.length ? days : null,
      muscle_group: type === 'fuerza' && muscleGroup ? muscleGroup : null,
    };
    let { data, error } = await supabase.from('workout_templates').insert(full).select().maybeSingle();
    if (error && isMissingColumn(error)) {
      setScheduleReady(false);
      const { days_of_week: _d, muscle_group: _m, ...base } = full; void _d; void _m;
      ({ data, error } = await supabase.from('workout_templates').insert(base).select().maybeSingle());
    }
    setSaving(false);
    if (error || !data) { showToast(t('error_save'), 'error'); return; }
    setItems((p) => [data as Template, ...p]);
    setShowForm(false);
    setName(''); setDuration('60'); setType('tecnica'); setDays([]); setMuscleGroup('');
    showToast(t('mc_rt_created'));
  };

  // Vuelca la plantilla a day_plan_items en los días asignados de esta semana.
  const apply = async (tpl: Template) => {
    if (!tpl.days_of_week || tpl.days_of_week.length === 0) { showToast(t('mc_pl_tpl_apply_none'), 'error'); return; }
    setApplying(tpl.id);
    const isStrength = tpl.session_type === 'fuerza';
    const rows = tpl.days_of_week.map((dow) => ({
      fighter_profile_id: profile.id,
      plan_date: isoOf(addDays(weekStart, dow === 0 ? 6 : dow - 1)),
      kind: isStrength ? 'strength' : 'activity',
      payload: isStrength
        ? { groups: tpl.muscle_group ? [tpl.muscle_group] : [], exercises: tpl.name }
        : { kind: mapTypeToActivity(tpl.session_type), duration_min: tpl.duration_min || undefined, note: tpl.name },
      source: 'template',
    }));
    const { error } = await supabase.from('day_plan_items').insert(rows);
    setApplying(null);
    if (error) { showToast(t('error_save'), 'error'); return; }
    await supabase.from('workout_templates').update({ use_count: tpl.use_count + 1 }).eq('id', tpl.id);
    setItems((p) => [...p.map((x) => x.id === tpl.id ? { ...x, use_count: x.use_count + 1 } : x)].sort((a, b) => b.use_count - a.use_count));
    showToast(t('mc_pl_tpl_applied', { n: rows.length }));
    onApplied?.();
  };

  const remove = async (id: string) => {
    setItems((p) => p.filter((x) => x.id !== id));
    const { error } = await supabase.from('workout_templates').delete().eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); load(); }
  };

  if (loading) return null;

  const TYPES = [
    { value: 'tecnica', key: 'mc_st_tecnica' }, { value: 'fuerza', key: 'mc_st_fuerza' },
    { value: 'cardio', key: 'mc_st_cardio' }, { value: 'sparring', key: 'mc_st_sparring' },
    { value: 'flexibilidad', key: 'mc_st_flexibilidad' }, { value: 'recuperacion', key: 'mc_st_recuperacion' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold text-white">{t('mc_pl_tpl_title')}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{t('mc_pl_tpl_sub')}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="rk-btn rk-btn-ghost flex items-center gap-1.5" style={{ fontSize: '0.78rem', padding: '0.55rem 1.1rem' }}>
          <i className="ri-add-line"></i> {t('mc_pl_tpl_new')}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rk-card text-center" style={{ padding: '32px 22px' }}>
          <i className="ri-repeat-line text-3xl text-zinc-600"></i>
          <p className="text-white font-bold mt-3">{t('mc_pl_tpl_empty')}</p>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-sm mx-auto leading-relaxed">{t('mc_pl_tpl_empty_desc')}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((tpl) => (
            <div key={tpl.id} className="rk-card group flex flex-col" style={{ padding: '16px 18px' }}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-white leading-snug">{tpl.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {t(`mc_st_${tpl.session_type}`, { defaultValue: tpl.session_type })}
                    {tpl.muscle_group ? ` · ${t(`mc_str_mg_${tpl.muscle_group}`, { defaultValue: tpl.muscle_group })}` : ''}
                    {tpl.duration_min ? ` · ${tpl.duration_min} min` : ''}
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

              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/[0.06]">
                <span className="text-[11px] text-zinc-600 flex-1">
                  {tpl.use_count === 0
                    ? t('mc_pl_tpl_never')
                    : tpl.use_count === 1 ? t('mc_rt_used_once') : t('mc_rt_used_times', { n: tpl.use_count })}
                </span>
                <button onClick={() => apply(tpl)} disabled={applying === tpl.id}
                  className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg cursor-pointer transition-colors disabled:opacity-60">
                  {applying === tpl.id ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <i className="ri-calendar-check-line"></i>}
                  {t('mc_pl_tpl_apply')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <BottomSheet open={showForm} onClose={() => setShowForm(false)} title={t('mc_pl_tpl_new')}
        footer={
          <button onClick={create} disabled={saving} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.95rem', minHeight: 44 }}>
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><i className="ri-add-line"></i> {t('mc_rt_create')}</>}
          </button>
        }>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">{t('mc_rt_name')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={60} placeholder={t('mc_rt_name_ph')}
              style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">{t('mc_rt_type')}</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((tp) => (
                <button key={tp.value} onClick={() => setType(tp.value)}
                  className={`py-2.5 rounded-xl border text-[11px] font-semibold text-white transition-all cursor-pointer ${type === tp.value ? 'border-white/30 bg-white/[0.08]' : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}
                  style={{ minHeight: 44 }}>{t(tp.key)}</button>
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
                    style={{ minHeight: 34 }}>{t(`mc_str_mg_${g}`, { defaultValue: g })}</button>
                ))}
              </div>
            </div>
          )}
          {scheduleReady && (
            <div>
              <label className="block text-sm text-zinc-400 mb-2">{t('mc_rt_days')} <span className="text-zinc-600">({t('mc_optional')})</span></label>
              <div className="flex gap-1.5">
                {WEEKDAYS.map((wd) => (
                  <button key={wd.n} onClick={() => setDays((p) => p.includes(wd.n) ? p.filter((d) => d !== wd.n) : [...p, wd.n])}
                    className={`flex-1 py-2.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${days.includes(wd.n) ? 'bg-[#C9A84C] border-[#C9A84C] text-zinc-900' : 'bg-white/[0.02] border-white/10 text-zinc-500 hover:border-white/25'}`}
                    style={{ minHeight: 40 }}>{t(wd.key)}</button>
                ))}
              </div>
              <p className="text-[11px] text-zinc-600 mt-1.5">{t('mc_rt_days_hint')}</p>
            </div>
          )}
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">{t('mc_rt_duration')}</label>
            <input value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="numeric" type="number"
              style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

// Mapea el session_type de una plantilla al tipo de actividad no-fuerza más cercano.
function mapTypeToActivity(sessionType: string): string {
  switch (sessionType) {
    case 'sparring': return 'boxeo';
    case 'cardio': return 'correr';
    default: return 'otro';
  }
}
