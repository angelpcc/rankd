import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import VoiceButton from '@/components/feature/VoiceButton';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export interface Checkin {
  entry_date: string;
  energy: number;
  soreness: number;
  sleep_hours: number | null;
  note: string | null;
}

const SCALE = [1, 2, 3, 4, 5];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Verde → rojo según el valor. Para energía se invierte (5 es bueno). */
function scaleColor(v: number, higherIsBetter: boolean): string {
  const good = ['#ef4444', '#fb923c', '#eab308', '#84cc16', '#22c55e'];
  const idx = higherIsBetter ? v - 1 : 5 - v;
  return good[Math.max(0, Math.min(4, idx))];
}

/**
 * Check-in diario: energía, cansancio y sueño en treinta segundos.
 * Es la pieza que da motivo para entrar aunque ese día no toque entrenar, y
 * alimenta el contexto del Coach de Entrenamiento para ajustar la carga.
 */
export default function DailyCheckin({ profile, showToast }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [today, setToday] = useState<Checkin | null>(null);
  const [week, setWeek] = useState<Checkin[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [energy, setEnergy] = useState(3);
  const [soreness, setSoreness] = useState(3);
  const [sleep, setSleep] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(); since.setDate(since.getDate() - 7);
    const sinceISO = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')}`;
    const { data, error } = await supabase
      .from('daily_checkins')
      .select('entry_date, energy, soreness, sleep_hours, note')
      .eq('fighter_profile_id', profile.id)
      .gte('entry_date', sinceISO)
      .order('entry_date', { ascending: false });
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    const rows = (data || []) as Checkin[];
    setWeek(rows);
    const t0 = rows.find((r) => r.entry_date === todayISO()) || null;
    setToday(t0);
    if (t0) {
      setEnergy(t0.energy);
      setSoreness(t0.soreness);
      setSleep(t0.sleep_hours !== null ? String(t0.sleep_hours) : '');
      setNote(t0.note || '');
    }
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    const hours = sleep ? parseFloat(sleep.replace(',', '.')) : null;
    const row = {
      fighter_profile_id: profile.id,
      entry_date: todayISO(),
      energy,
      soreness,
      sleep_hours: hours !== null && !Number.isNaN(hours) ? hours : null,
      note: note.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('daily_checkins').upsert(row, { onConflict: 'fighter_profile_id,entry_date' });
    setSaving(false);
    if (error) { showToast(t('error_save'), 'error'); return; }
    const saved: Checkin = { entry_date: row.entry_date, energy, soreness, sleep_hours: row.sleep_hours, note: row.note };
    setToday(saved);
    setWeek((prev) => [saved, ...prev.filter((r) => r.entry_date !== saved.entry_date)]);
    setEditing(false);
    showToast(t('mc_ci_saved'));
  };

  if (loading || unavailable) return null; // en el resumen, si no está listo simplemente no aparece

  // ── Ya hecho hoy: resumen compacto ──
  if (today && !editing) {
    const avgEnergy = week.length ? (week.reduce((a, r) => a + r.energy, 0) / week.length).toFixed(1) : null;
    const sleepRows = week.filter((r) => r.sleep_hours !== null);
    const avgSleep = sleepRows.length ? (sleepRows.reduce((a, r) => a + (r.sleep_hours || 0), 0) / sleepRows.length).toFixed(1) : null;
    const sleepTxt = today.sleep_hours !== null ? t('mc_ci_sleep_suffix', { h: today.sleep_hours }) : '';

    return (
      <div className="rk-card" style={{ padding: '16px 20px', transform: 'none' }}>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-2xl border"
            style={{ background: `${scaleColor(today.energy, true)}1a`, borderColor: `${scaleColor(today.energy, true)}44`, color: scaleColor(today.energy, true) }}>
            <i className="ri-heart-pulse-line text-xl"></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">{t('mc_ci_done_title')}</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {t('mc_ci_done_desc', {
                energy: t(`mc_ci_energy_${today.energy}`),
                soreness: t(`mc_ci_sore_${today.soreness}`).toLowerCase(),
                sleep: sleepTxt,
              })}
            </p>
          </div>
          <button onClick={() => setEditing(true)}
            className="text-xs font-bold text-zinc-400 hover:text-white bg-white/[0.04] border border-white/10 hover:border-white/25 px-3 py-2 rounded-lg cursor-pointer transition-colors flex-shrink-0">
            {t('mc_ci_edit')}
          </button>
        </div>

        {week.length > 1 && (
          <div className="flex items-center gap-x-5 gap-y-1 flex-wrap mt-3 pt-3 border-t border-white/[0.06] text-[11px] text-zinc-500">
            <span className="uppercase tracking-wider font-bold text-zinc-600">{t('mc_ci_week_avg')}</span>
            {avgEnergy && <span><span className="text-white font-bold">{avgEnergy}</span>/5 {t('mc_ci_avg_energy')}</span>}
            {avgSleep && <span><span className="text-white font-bold">{avgSleep}</span> h {t('mc_ci_avg_sleep')}</span>}
            <span>{t('mc_ci_streak_note', { n: week.length })}</span>
          </div>
        )}
      </div>
    );
  }

  // ── Formulario ──
  return (
    <div className="rk-card" style={{ padding: '20px', transform: 'none', borderColor: 'rgba(56,189,248,0.22)' }}>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-sky-500/12 border border-sky-500/30 text-sky-400">
          <i className="ri-heart-pulse-line text-lg"></i>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>{t('mc_ci_title')}</h3>
          <p className="text-xs text-zinc-400 mt-0.5">{t('mc_ci_subtitle')}</p>
        </div>
        {editing && (
          <button onClick={() => setEditing(false)} aria-label={t('mc_cancel')}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white cursor-pointer flex-shrink-0">
            <i className="ri-close-line"></i>
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Energía */}
        <div>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">{t('mc_ci_energy')}</label>
            {/* La etiqueta va aquí y no dentro de cada botón: en móvil cinco
                palabras en columnas de ~56px quedaban partidas e ilegibles. */}
            <span className="text-xs font-bold" style={{ color: scaleColor(energy, true) }}>{t(`mc_ci_energy_${energy}`)}</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {SCALE.map((v) => (
              <button key={v} onClick={() => setEnergy(v)}
                aria-label={t(`mc_ci_energy_${v}`)}
                aria-pressed={energy === v}
                className={`h-11 rounded-xl border text-sm font-black transition-all cursor-pointer ${energy === v ? 'text-white' : 'text-zinc-600 border-white/10 hover:border-white/25'}`}
                style={energy === v ? { background: `${scaleColor(v, true)}22`, borderColor: `${scaleColor(v, true)}77` } : { background: 'rgba(255,255,255,0.02)' }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Cansancio */}
        <div>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">{t('mc_ci_soreness')}</label>
            <span className="text-xs font-bold" style={{ color: scaleColor(soreness, false) }}>{t(`mc_ci_sore_${soreness}`)}</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {SCALE.map((v) => (
              <button key={v} onClick={() => setSoreness(v)}
                aria-label={t(`mc_ci_sore_${v}`)}
                aria-pressed={soreness === v}
                className={`h-11 rounded-xl border text-sm font-black transition-all cursor-pointer ${soreness === v ? 'text-white' : 'text-zinc-600 border-white/10 hover:border-white/25'}`}
                style={soreness === v ? { background: `${scaleColor(v, false)}22`, borderColor: `${scaleColor(v, false)}77` } : { background: 'rgba(255,255,255,0.02)' }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Sueño + nota */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">{t('mc_ci_sleep')}</label>
            <div className="relative">
              <input value={sleep} onChange={(e) => setSleep(e.target.value)} inputMode="decimal" placeholder="7.5"
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl pl-4 pr-8 py-2.5 focus:outline-none focus:border-sky-500 transition-colors" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">h</span>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
              {t('mc_ci_note')} <span className="text-zinc-600 font-normal normal-case tracking-normal">({t('mc_optional')})</span>
            </label>
            <div className="flex gap-2">
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder={t('mc_ci_note_ph')}
                className="flex-1 bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-sky-500 transition-colors" />
              <VoiceButton onResult={(txt) => setNote((prev) => (prev.trim() ? (prev + ' ' + txt).slice(0, 140) : txt.slice(0, 140)))} compact />
            </div>
          </div>
        </div>

        <button onClick={save} disabled={saving}
          className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.9rem' }}>
          {saving
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('mc_saving')}</>
            : <><i className="ri-check-line"></i> {t('mc_ci_save')}</>}
        </button>
      </div>
    </div>
  );
}
