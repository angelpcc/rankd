import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable, writeDroppingMissingColumns } from '@/lib/dbState';
import Reveal from '@/components/base/Reveal';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ACTIVITY_KINDS, activityKindCfg, computePace, paceLabel, paceToSec, todayISO } from '../lib/dayPlan';
import ActivityGlyph from './ActivityGlyph';
import StreakRow from './StreakRow';
import WeekBars, { last7Days } from '@/components/base/WeekBars';
import CountUp from '@/components/base/CountUp';
import { reconcileDayTicks } from '../lib/planTicks';
import SectionHero from './SectionHero';
import HubTabs, { type HubTab } from './HubTabs';
import ProtocolLibrary from './ProtocolLibrary';
import ActivityTodayCard from './ActivityTodayCard';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** Llega del "+" de Agenda o de un día del calendario: abre el formulario
   * ya con esa fecha puesta. undefined = flujo normal (hoy, formulario cerrado). */
  initialDate?: string;
  /**
   * Tipo de actividad ya elegido. Lo manda quien viene a resolver un bloque
   * planificado ("hoy toca correr"): el formulario se abre en el paso 2, con el
   * tipo puesto, en vez de pedir otra vez lo que ya se sabía.
   */
  initialKind?: string;
  /**
   * Se llama DESPUÉS de que la Agenda se haya sincronizado con lo registrado.
   *
   * El orden importa: `reconcileDayTicks` es quien marca (o crea) el bloque del
   * día. Avisar antes haría que las tarjetas de "hoy toca" releyeran datos
   * viejos y siguieran enseñando como pendiente lo que se acaba de hacer.
   */
  onLogged?: () => void;
  /** Sube desde fuera cuando algo cambia en otra pantalla (un tick en la Agenda). */
  refreshKey?: number;
  /** Abre la Agenda. Lo usa la tarjeta de "hoy toca" para ver el día entero. */
  onGoAgenda?: () => void;
}

interface ActSession {
  id: string;
  session_date: string;
  kind: string;
  duration_min: number;
  rounds: number | null;
  distance_km: number | null;
  pace_sec_per_km: number | null;
  meters: number | null;
  round_duration_sec: number | null;
  incline_percent: number | null;
  /** Frecuencia cardíaca media en ppm (migración 0047). */
  avg_hr?: number | null;
  note: string | null;
  created_at: string;
}

/**
 * Niveles de inclinación para la cinta.
 *
 * En una sesión la inclinación va cambiando, así que pedir la media exacta es
 * pedir un dato que el usuario no tiene. Cada nivel guarda el valor CENTRAL de
 * su tramo: es una aproximación, y se dice que lo es. `min`/`max` sirven para
 * saber qué pastilla marcar cuando el valor viene de un registro anterior o se
 * ha escrito a mano.
 *
 * Cuando la sesión SÍ tiene un guion exacto (los tramos van escritos de
 * antemano), esto se queda corto: para eso está la pestaña Protocolos.
 */
const INCLINE_LEVELS = [
  { id: 'flat', labelKey: 'mc_av_incl_flat', value: 0, min: 0, max: 0.9, hint: '0%' },
  { id: 'soft', labelKey: 'mc_av_incl_soft', value: 2, min: 1, max: 2.9, hint: '1-3%' },
  { id: 'mid', labelKey: 'mc_av_incl_mid', value: 4, min: 3, max: 5.9, hint: '3-6%' },
  { id: 'hard', labelKey: 'mc_av_incl_hard', value: 8, min: 6, max: 40, hint: '6%+' },
];

function startOfMonth(): Date { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; }

/** Lunes (ISO local) de esta semana, o `offsetWeeks` semanas atrás. */
function weekMondayISO(offsetWeeks = 0): string {
  const d = new Date();
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - day + offsetWeeks * 7);
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const TREND_WEEKS = 8;

// Dos pestañas. "Registro" es lo de siempre (apuntar lo hecho y ver el
// progreso). "Protocolos" es el guion detallado que se reproduce en vivo:
// misma sección, dos tareas distintas — apuntar lo que ya pasó frente a seguir
// lo que toca ahora.
const WORK_TABS: HubTab[] = [
  { id: 'registro', labelKey: 'mc_av_tab_log', icon: 'ri-add-circle-line' },
  { id: 'protocolos', labelKey: 'mc_av_tab_protocols', icon: 'ri-timer-line' },
];

// Qué mide el gráfico y las métricas para cada tipo.
type Metric = 'distance' | 'meters' | 'rounds' | 'minutes';
function metricOf(kind: string): Metric {
  const f = activityKindCfg(kind).fields;
  if (f.includes('distance_km')) return 'distance';
  if (f.includes('meters')) return 'meters';
  if (f.includes('rounds')) return 'rounds';
  return 'minutes';
}
function metricValue(s: ActSession, m: Metric): number {
  if (m === 'distance') return Number(s.distance_km) || 0;
  if (m === 'meters') return Number(s.meters) || 0;
  if (m === 'rounds') return Number(s.rounds) || 0;
  return s.duration_min || 0;
}

function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: any[]; label?: string; unit: string }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, padding: '8px 12px' }}>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
      <p style={{ fontSize: 14, color: '#fff', margin: 0, fontWeight: 700 }}>{payload[0].value} {unit}</p>
      {p?.mins ? <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0 }}>{p.mins} min</p> : null}
    </div>
  );
}

export default function FighterTraining({ profile, showToast, initialDate, initialKind, onLogged, refreshKey = 0, onGoAgenda }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const [tab, setTab] = useState<'registro' | 'protocolos'>('registro');
  const [sessions, setSessions] = useState<ActSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(!!initialDate || !!initialKind);
  // Con el tipo ya elegido se salta el paso 1 (el selector de tipo): repetir esa
  // elección es exactamente el clic que se venía a ahorrar.
  const [step, setStep] = useState<1 | 2>(initialKind ? 2 : 1);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  // id de la sesión que se está editando (null = alta nueva).
  const [editingId, setEditingId] = useState<string | null>(null);

  const [date, setDate] = useState(initialDate || todayISO());
  // Un tipo que esta versión no conoce (viene de un plan generado por la IA) no
  // sirve para preseleccionar nada: se cae al de siempre.
  const [kind, setKind] = useState(
    initialKind && ACTIVITY_KINDS.some((k) => k.value === initialKind) ? initialKind : 'correr',
  );
  const [duration, setDuration] = useState('30');
  const [distanceKm, setDistanceKm] = useState('');
  const [pace, setPace] = useState('');
  const [meters, setMeters] = useState('');
  const [rounds, setRounds] = useState('');
  const [roundDur, setRoundDur] = useState('');
  const [incline, setIncline] = useState('');
  // Frecuencia cardíaca media (migración 0047). Dato opcional de matiz.
  const [avgHr, setAvgHr] = useState('');
  // Detalles opcionales plegados. Se abren solos al editar una sesión que ya
  // los lleva: si no, parecería que se han perdido.
  const [moreOpen, setMoreOpen] = useState(false);
  const [note, setNote] = useState('');

  const [selectedType, setSelectedType] = useState<string>('');

  // Contador propio para la card de "hoy toca" de esta pantalla.
  //
  // El `refreshKey` que baja de `page.tsx` sube DESPUÉS de que el padre se
  // entere, y el padre solo se entera por `onLogged`. Con uno local, la card de
  // arriba se actualiza en el mismo instante en que se guarda, sin depender de
  // nadie: el usuario ve desaparecer el aviso al pulsar guardar, que es cuando
  // lo espera.
  const [localRefresh, setLocalRefresh] = useState(0);
  /** Algo ha cambiado aquí: relee la card y avisa al Resumen. */
  const bumpToday = () => setLocalRefresh((k) => k + 1);

  useEffect(() => {
    if (!initialDate && !initialKind) return;
    if (initialDate) setDate(initialDate);
    const known = !!initialKind && ACTIVITY_KINDS.some((k) => k.value === initialKind);
    if (known) setKind(initialKind as string);
    setShowForm(true);
    // Con el tipo ya sabido se entra directo a los datos; si no, al selector.
    setStep(known ? 2 : 1);
    // Llegar desde la Agenda o desde el "+" es siempre para APUNTAR algo: si el
    // usuario se había quedado en Protocolos, se vuelve al registro.
    setTab('registro');
  }, [initialDate, initialKind]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('activity_sessions').select('*')
      .eq('fighter_profile_id', profile.id)
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(120);
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    const list = (data || []) as ActSession[];
    setSessions(list);
    setSelectedType((cur) => cur || (list[0]?.kind ?? ''));
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const cfg = activityKindCfg(kind);
  const autoPace = computePace(parseFloat(duration) || undefined, parseFloat(distanceKm) || undefined);
  const shownPace = pace || (autoPace ? paceLabel(autoPace) : '');

  const resetForm = () => {
    setDuration('30'); setDistanceKm(''); setPace(''); setMeters(''); setRounds(''); setRoundDur('');
    setIncline(''); setNote(''); setAvgHr(''); setMoreOpen(false);
  };

  // Cierra el formulario y limpia el modo edición.
  const closeForm = () => { setShowForm(false); setStep(1); setEditingId(null); resetForm(); };

  // Abre el formulario con una sesión existente cargada (paso 2, pre-relleno).
  const openEdit = (s: ActSession) => {
    setConfirmDel(null);
    setKind(s.kind);
    setDate(s.session_date);
    setDuration(String(s.duration_min ?? ''));
    setDistanceKm(s.distance_km != null ? String(s.distance_km) : '');
    setPace(s.pace_sec_per_km ? paceLabel(Number(s.pace_sec_per_km)) : '');
    setMeters(s.meters != null ? String(s.meters) : '');
    setRounds(s.rounds != null ? String(s.rounds) : '');
    setRoundDur(s.round_duration_sec != null ? String(s.round_duration_sec) : '');
    setIncline(s.incline_percent != null ? String(s.incline_percent) : '');
    setAvgHr(s.avg_hr != null ? String(s.avg_hr) : '');
    setNote(s.note ?? '');
    // Si la sesión ya trae algún dato de los plegados, se abre el bloque: si
    // no, parecería que al editar se han perdido.
    setMoreOpen(!!(s.pace_sec_per_km || s.incline_percent != null || s.round_duration_sec != null || s.avg_hr != null || (s.note || '').trim()));
    setEditingId(s.id);
    setStep(2);
    setShowForm(true);
  };

  const addSession = async () => {
    if (saving) return;
    const mins = parseInt(duration, 10);
    if (!mins || mins < 1) { showToast(t('mc_av_need_duration'), 'error'); return; }
    setSaving(true);
    const full: Record<string, unknown> = {
      fighter_profile_id: profile.id,
      session_date: date,
      kind,
      duration_min: mins,
      rounds: cfg.fields.includes('rounds') && rounds ? parseInt(rounds, 10) : null,
      note: note.trim() || null,
      distance_km: cfg.fields.includes('distance_km') && distanceKm ? parseFloat(distanceKm.replace(',', '.')) : null,
      meters: cfg.fields.includes('meters') && meters ? parseInt(meters, 10) : null,
      round_duration_sec: cfg.fields.includes('round_duration') && roundDur ? parseInt(roundDur, 10) : null,
      incline_percent: cfg.fields.includes('incline') && incline ? parseFloat(incline.replace(',', '.')) : null,
      avg_hr: avgHr ? parseInt(avgHr, 10) : null,
      pace_sec_per_km: cfg.fields.includes('pace')
        ? (pace ? paceToSec(pace) : autoPace) || null
        : null,
    };

    // ── Edición: UPDATE de la fila existente (no crea una nueva) ──
    if (editingId) {
      const oldDate = sessions.find((x) => x.id === editingId)?.session_date;
      const { fighter_profile_id, ...patch } = full;
      void fighter_profile_id;
      // Igual que en el alta: se quita solo lo que falte, no todo.
      const { result: upd } = await writeDroppingMissingColumns(
        [patch],
        (rows) => supabase.from('activity_sessions').update(rows[0]).eq('id', editingId).select().maybeSingle(),
        ['session_date', 'kind', 'duration_min'],
      );
      const { data, error } = upd;
      if (error || !data) { showToast(t('error_save'), 'error'); setSaving(false); return; }
      setSessions((prev) => prev.map((x) => (x.id === editingId ? (data as ActSession) : x))
        .sort((a, b) => b.session_date.localeCompare(a.session_date)));
      setSelectedType(kind);
      closeForm();
      setSaving(false);
      showToast(t('mc_av_updated'));
      void Promise.all([
        oldDate && oldDate !== date ? reconcileDayTicks(profile.id, oldDate) : null,
        reconcileDayTicks(profile.id, date),
      ]).then(() => { bumpToday(); onLogged?.(); });
      return;
    }

    // Se quitan SOLO las columnas que esta base no tenga (avg_hr de la 0047,
    // incline_percent de la 0046...). Antes, faltar una sola tiraba también
    // distancia, ritmo y metros, que sí se estaban guardando bien.
    const { result } = await writeDroppingMissingColumns(
      [full],
      (rows) => supabase.from('activity_sessions').insert(rows).select().maybeSingle(),
      ['fighter_profile_id', 'session_date', 'kind', 'duration_min'],
    );
    const { data, error } = result;
    if (error || !data) { showToast(t('error_save'), 'error'); setSaving(false); return; }
    setSessions((prev) => [data as ActSession, ...prev].sort((a, b) => b.session_date.localeCompare(a.session_date)));
    setSelectedType(kind);
    resetForm();
    setShowForm(false);
    setStep(1);
    setSaving(false);
    showToast(t('mc_av_saved'));
    void reconcileDayTicks(profile.id, date).then(() => { bumpToday(); onLogged?.(); });
  };

  const deleteSession = async (id: string) => {
    setConfirmDel(null);
    const target = sessions.find((s) => s.id === id);
    const { error } = await supabase.from('activity_sessions').delete().eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); return; }
    setSessions((prev) => prev.filter((s) => s.id !== id));
    showToast(t('mc_av_deleted'));
    // Borrar también cambia lo que toca hoy: el bloque que se había creado solo
    // se retira y el día vuelve a estar pendiente.
    if (target) void reconcileDayTicks(profile.id, target.session_date).then(() => { bumpToday(); onLogged?.(); });
  };

  // Minutos por día de los últimos 7, para la tira de barras. Sin consulta
  // extra: se agrega sobre lo que ya está en memoria. Va aquí arriba, con el
  // resto de hooks: después de los `return` tempranos rompería el orden de
  // llamada entre renders.
  const weekBarDays = useMemo(() => {
    const m = new Map<string, number>();
    sessions.forEach((s) => {
      m.set(s.session_date, (m.get(s.session_date) || 0) + (s.duration_min || 0));
    });
    return last7Days(m);
  }, [sessions]);

  const registeredKinds = useMemo(() => {
    const set = new Set(sessions.map((s) => s.kind));
    return ACTIVITY_KINDS.filter((k) => set.has(k.value));
  }, [sessions]);

  // ── Resumen semanal: sesiones, desglose por tipo y minutos de esta semana ──
  const weekAgg = useMemo(() => {
    const start = weekMondayISO(0);
    const wk = sessions.filter((s) => s.session_date >= start);
    const byKind = new Map<string, number>();
    wk.forEach((s) => byKind.set(s.kind, (byKind.get(s.kind) || 0) + 1));
    return {
      count: wk.length,
      mins: wk.reduce((a, s) => a + (s.duration_min || 0), 0),
      breakdown: [...byKind.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [sessions]);

  // ── Tendencia: minutos totales por semana, últimas TREND_WEEKS ──
  const weeklyTrend = useMemo(() => {
    const weeks = Array.from({ length: TREND_WEEKS }, (_, i) => {
      const start = weekMondayISO(-(TREND_WEEKS - 1 - i));
      return { start, label: new Date(start + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' }), mins: 0 };
    });
    const first = weeks[0].start;
    sessions.forEach((s) => {
      if (s.session_date < first) return;
      for (let w = weeks.length - 1; w >= 0; w--) {
        if (s.session_date >= weeks[w].start) { weeks[w].mins += s.duration_min || 0; break; }
      }
    });
    return weeks;
  }, [sessions, locale]);

  const ofType = useMemo(
    () => sessions.filter((s) => s.kind === selectedType).slice().sort((a, b) => a.session_date.localeCompare(b.session_date)),
    [sessions, selectedType],
  );

  const metric = selectedType ? metricOf(selectedType) : 'minutes';
  const metricUnit = metric === 'distance' ? 'km' : metric === 'meters' ? 'm' : metric === 'rounds' ? t('mc_av_unit_rounds') : 'min';

  const chartData = useMemo(
    () => ofType.slice(-16).map((s) => ({
      label: new Date(s.session_date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
      value: metricValue(s, metric),
      mins: s.duration_min,
      key: s.id,
    })),
    [ofType, locale, metric],
  );

  const typeStats = useMemo(() => {
    const monthStart = startOfMonth();
    const inMonth = ofType.filter((s) => new Date(s.session_date + 'T12:00:00') >= monthStart);
    const sumMetric = inMonth.reduce((a, s) => a + metricValue(s, metric), 0);
    const longestMin = ofType.reduce((m, s) => Math.max(m, s.duration_min), 0);
    // Mejor ritmo = el menor pace_sec_per_km registrado.
    const paces = ofType.map((s) => Number(s.pace_sec_per_km) || 0).filter((p) => p > 0);
    const bestPace = paces.length ? Math.min(...paces) : 0;
    const bestMetric = ofType.reduce((m, s) => Math.max(m, metricValue(s, metric)), 0);
    return { sumMetric: +sumMetric.toFixed(1), longestMin, bestPace, bestMetric, count: ofType.length };
  }, [ofType, metric]);

  // Las 3 tarjetas de métricas, según el tipo.
  const statCards = useMemo(() => {
    const count = { v: String(typeStats.count), l: t('mc_av_stat_count') };
    if (metric === 'distance') {
      return [
        { v: `${typeStats.sumMetric} km`, l: t('mc_av_stat_month_km') },
        { v: typeStats.bestPace ? `${paceLabel(typeStats.bestPace)}` : '—', l: t('mc_av_stat_best_pace') },
        count,
      ];
    }
    if (metric === 'meters') {
      return [
        { v: `${typeStats.sumMetric} m`, l: t('mc_av_stat_month_m') },
        { v: typeStats.bestMetric ? `${typeStats.bestMetric} m` : '—', l: t('mc_av_stat_best_swim') },
        count,
      ];
    }
    if (metric === 'rounds') {
      return [
        { v: String(typeStats.sumMetric), l: t('mc_av_stat_month_rounds') },
        { v: `${typeStats.longestMin}m`, l: t('mc_av_stat_longest') },
        count,
      ];
    }
    return [
      { v: `${Math.round(typeStats.sumMetric)}m`, l: t('mc_av_stat_month_min') },
      { v: `${typeStats.longestMin}m`, l: t('mc_av_stat_longest') },
      count,
    ];
  }, [typeStats, metric, t]);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
          <i className="ri-run-line text-3xl text-red-400"></i>
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.3rem', color: '#fff' }}>{t('mc_coming_soon_title')}</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{t('mc_coming_soon_desc')}</p>
      </div>
    );
  }

  const selCfg = selectedType ? activityKindCfg(selectedType) : null;
  const numCls = 'w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500';
  const optText = t('mc_optional');

  // Días con actividad + racha viva, para la fila de marcas. Se derivan de las
  // sesiones ya cargadas; no hay consulta extra.
  const activeDates = new Set(sessions.map((s) => s.session_date));

  const streakDays = (() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const key = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    // Si hoy aún no hay nada, la racha se cuenta desde ayer (no se rompe hasta
    // que el día termina).
    if (!activeDates.has(key(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (activeDates.has(key(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  })();

  return (
    <div className="rk-blocks max-w-4xl">
      <SectionHero kind="activity" eyebrow={t('mc_av_eyebrow')}
        title={`${t('mc_av_title')} ${t('mc_av_title_2')}`}
        subtitle={sessions.length ? t('mc_av_hero_sub', { n: sessions.length }) : t('mc_av_sub')}
        action={tab === 'registro' ? {
          label: showForm ? t('mc_av_close') : t('mc_av_new'),
          icon: showForm ? 'ri-close-line' : 'ri-add-line',
          onClick: () => { if (showForm) closeForm(); else { setEditingId(null); resetForm(); setStep(1); setShowForm(true); } },
        } : undefined} />

      <HubTabs tabs={WORK_TABS} active={tab} onChange={(id) => setTab(id as typeof tab)} />

      {/* ── PROTOCOLOS ──
          El guion detallado por tramos, para cualquier tipo de actividad. */}
      {tab === 'protocolos' && (
        <ProtocolLibrary profile={profile} showToast={showToast}
          onSessionSaved={() => { void load(); bumpToday(); onLogged?.(); }} />
      )}

      {tab === 'registro' && (
        <>
          {/* ── "Hoy toca" de ACTIVIDAD ──
              Lo primero de la pantalla: si hay un cardio planificado para hoy y
              sin registrar, se dice AQUÍ, no solo en el Resumen. Misma regla que
              la card de Fuerza (lib/todayTraining → lib/planMatch), así que las
              dos no pueden discrepar. `localRefresh` la relee al guardar sin
              esperar a que el Resumen se entere. */}
          <ActivityTodayCard profile={profile} refreshKey={refreshKey + localRefresh}
            onLog={(k) => {
              // `resetForm` no toca ni el tipo ni la fecha, así que el orden da
              // igual; se llama para no arrastrar los datos de una edición
              // anterior (distancia, asaltos, nota) a este alta nueva.
              const known = !!k && ACTIVITY_KINDS.some((x) => x.value === k);
              setEditingId(null);
              resetForm();
              if (known) setKind(k as string);
              setDate(todayISO());
              setStep(known ? 2 : 1);
              setShowForm(true);
            }}
            onGoAgenda={onGoAgenda} />

          {/* ── Racha en marcas, no en número suelto ── */}
          {sessions.length > 0 && (
            <StreakRow activeDates={activeDates} streak={streakDays} />
          )}

          {/* ── La semana en barras ──
              El número de sesiones no dice CÓMO ha ido repartida la semana. Siete
              barras sí: se ve de un vistazo si has entrenado seguido o si llevas
              tres días parado. Minutos reales, y hueco gris el día sin registrar. */}
          {sessions.length > 0 && (
            <Reveal>
              <div className="rk-card" style={{ padding: 16 }}>
                <p className="rk-label mb-3">{t('mc_av_week_bars')}</p>
                <WeekBars days={weekBarDays} unit="min" />
              </div>
            </Reveal>
          )}

          {/* ── Resumen semanal (parte superior) ── */}
          {sessions.length > 0 && (
            <Reveal>
              <div className="card-primary" style={{ padding: 22 }}>
                <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-red-400 mb-2">{t('mc_av_week_eyebrow')}</p>
                {weekAgg.count === 0 ? (
                  <p className="text-sm text-zinc-400">{t('mc_av_week_none')}</p>
                ) : (
                  <>
                    <div className="flex items-end gap-5 flex-wrap">
                      <div>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, lineHeight: 0.85, color: '#fff' }}>{weekAgg.count}</span>
                        <span className="text-sm text-zinc-500 ml-1.5">{t('mc_av_week_sessions_u')}</span>
                      </div>
                      <div>
                        <CountUp value={weekAgg.mins} delay={80} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, lineHeight: 0.85, color: 'var(--t-1)' }} />
                        <span className="text-sm text-zinc-500 ml-1.5">min</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {weekAgg.breakdown.map(([k, n]) => {
                        const c = activityKindCfg(k);
                        return (
                          <span key={k} className="text-[11px] font-semibold px-2 py-1 rounded-full border" style={{ color: c.hex, borderColor: `${c.hex}40`, background: `${c.hex}14` }}>
                            {t(c.labelKey)} {n}
                          </span>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Tendencia: minutos por semana */}
                <p className="text-[11px] text-zinc-500 mt-5 mb-2">{t('mc_av_trend_title')} · {t('mc_av_trend_sub', { n: TREND_WEEKS })}</p>
                <div style={{ height: 170 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyTrend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} interval="preserveStartEnd" minTickGap={8} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} width={30} />
                      <Tooltip contentStyle={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, fontSize: 12 }}
                        labelStyle={{ color: 'rgba(255,255,255,0.5)' }} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        formatter={(v: number) => [`${v} min`, '']} />
                      <Bar dataKey="mins" radius={[5, 5, 0, 0]} maxBarSize={34}>
                        {weeklyTrend.map((w, i) => (
                          <Cell key={w.start} fill={i === weeklyTrend.length - 1 ? '#E10600' : 'rgba(225,6,0,0.35)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Reveal>
          )}

          {/* ── Formulario en 2 pasos ── */}
          {showForm && (
            <Reveal>
              <div className="rk-card space-y-4" style={{ padding: '22px 20px' }}>
                <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>
                  {editingId ? t('mc_av_edit_title') : step === 1 ? t('mc_av_step1_title') : t(cfg.labelKey)}
                </h3>

                {step === 1 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {ACTIVITY_KINDS.map((k) => (
                      <button key={k.value} type="button" onClick={() => { setKind(k.value); resetForm(); setStep(2); }}
                        className="flex flex-col items-center gap-1.5 py-3.5 px-1 rounded-xl border border-white/10 bg-white/[0.02] text-xs font-semibold text-white hover:border-white/25 transition-all cursor-pointer"
                        style={{ minHeight: 44 }}>
                        <ActivityGlyph kind={k.value} size={26} style={{ color: k.hex }} />
                        {t(k.labelKey)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <button onClick={() => setStep(1)} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 cursor-pointer -mt-1">
                      <i className="ri-arrow-left-line"></i> {t('mc_av_step_back')}
                    </button>
                    {/* Grid de 2 columnas: los pares relacionados van en la misma
                        fila; un campo suelto ocupa el ancho completo (wide).
                        ActField reserva la altura de 2 líneas en la zona del label,
                        así los inputs de una fila arrancan a la misma Y aunque un
                        label sea más largo que el otro. `items-start`: cada celda a
                        su alto de contenido (el texto de ayuda de una columna no
                        empuja el input de la de al lado). */}
                    {/* ── LO IMPRESCINDIBLE ──
                        Fecha, duración y la métrica propia de esta actividad
                        (km, metros o asaltos). Con esto la sesión ya se guarda.
                        Los campos de matiz van plegados más abajo: tenerlos todos
                        a la vez convertía "apuntar que he corrido" en rellenar un
                        formulario de ocho casillas. */}
                    <div className="grid grid-cols-2 gap-3 items-start">
                      <ActField label={t('mc_av_date')} wide>
                        <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)}
                          className={`${numCls} cursor-pointer [color-scheme:dark]`} style={{ fontSize: 16, minHeight: 44 }} />
                      </ActField>
                      <ActField label={t('mc_av_duration')} wide>
                        <StepperInput value={duration} onChange={setDuration} step={5} min={1} max={600}
                          placeholder="30" unit={t('mc_av_unit_min')} ariaLabel={t('mc_av_duration')} />
                      </ActField>
                      {cfg.fields.includes('distance_km') && (
                        <ActField label={t('mc_av_field_km')} wide>
                          <StepperInput value={distanceKm} onChange={setDistanceKm} step={0.5} min={0} max={500}
                            placeholder="5" unit="km" ariaLabel={t('mc_av_field_km')} />
                        </ActField>
                      )}
                      {cfg.fields.includes('meters') && (
                        <ActField label={t('mc_av_field_meters')} wide>
                          <StepperInput value={meters} onChange={setMeters} step={50} min={0} max={20000}
                            placeholder="1500" unit="m" ariaLabel={t('mc_av_field_meters')} />
                        </ActField>
                      )}
                      {cfg.fields.includes('rounds') && (
                        <ActField label={t('mc_av_field_rounds')} wide>
                          <StepperInput value={rounds} onChange={setRounds} step={1} min={1} max={30}
                            placeholder="6" ariaLabel={t('mc_av_field_rounds')} />
                        </ActField>
                      )}
                    </div>
                    {cfg.fields.includes('pace') && shownPace && (
                      <p className="text-[11px] text-zinc-500 -mt-1">{t('mc_av_pace_auto', { pace: shownPace })}</p>
                    )}

                    {/* ── DETALLES OPCIONALES ──
                        Plegados: si no los tocas, la sesión se guarda igual. Se
                        abren de golpe (no uno a uno) porque quien quiere afinar
                        suele querer más de uno. */}
                    <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}
                      style={{ minHeight: 40 }}
                      className="w-full flex items-center justify-between gap-2 rounded-xl px-3.5 text-xs font-semibold text-zinc-300 bg-white/[0.03] border border-white/10 hover:border-white/25 cursor-pointer transition-colors">
                      <span className="flex items-center gap-1.5">
                        <i className="ri-equalizer-line text-zinc-500" />{t('mc_av_more_details')}
                      </span>
                      <i className={`ri-arrow-down-s-line transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {moreOpen && (
                      <div className="grid grid-cols-2 gap-3 items-start">
                        {cfg.fields.includes('pace') && (
                          <ActField label={t('mc_av_field_pace')} hint={optText}>
                            <input inputMode="text" value={pace} onChange={(e) => setPace(e.target.value)}
                              className={numCls} style={{ fontSize: 16, minHeight: 44 }} placeholder={autoPace ? paceLabel(autoPace) : '5:30'} />
                          </ActField>
                        )}
                        {cfg.fields.includes('incline') && (
                          <ActField label={t('mc_av_field_incline')} wide
                            hint={t('mc_av_incline_hint')}>
                            {/* Nadie sabe la inclinación MEDIA exacta de una sesión
                                en cinta: sube y baja. Se elige un nivel y se guarda
                                el valor central de ese tramo, que es la mejor
                                aproximación honesta. El campo exacto sigue debajo
                                para quien sí lo sepa. */}
                            <div className="flex flex-wrap gap-2 mb-2">
                              {INCLINE_LEVELS.map((lv) => {
                                const cur = parseFloat((incline || '').replace(',', '.'));
                                const active = Number.isFinite(cur) && cur >= lv.min && cur <= lv.max;
                                return (
                                  <button key={lv.id} type="button" style={{ minHeight: 44 }}
                                    onClick={() => setIncline(active ? '' : String(lv.value))}
                                    className={`px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${active ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/12 text-zinc-300 hover:border-white/30'}`}>
                                    {t(lv.labelKey)}
                                    <span className="block text-[10px] font-normal opacity-70">{lv.hint}</span>
                                  </button>
                                );
                              })}
                            </div>
                            <StepperInput value={incline} onChange={setIncline} step={0.5} min={0} max={40}
                              placeholder="3" unit="%" ariaLabel={t('mc_av_field_incline')} />
                          </ActField>
                        )}
                        {/* Los campos con −/+ van a ancho completo: en media
                            columna (145 px) los dos botones dejaban 45 px de hueco
                            y el número se montaba sobre la unidad. */}
                        {cfg.fields.includes('round_duration') && (
                          <ActField label={t('mc_av_field_round_dur')} hint={optText} wide>
                            <StepperInput value={roundDur} onChange={setRoundDur} step={10} min={10} max={600}
                              placeholder="180" unit="s" ariaLabel={t('mc_av_field_round_dur')} />
                          </ActField>
                        )}
                        <ActField label={t('mc_av_field_hr')} hint={optText} wide>
                          <StepperInput value={avgHr} onChange={setAvgHr} step={5} min={30} max={230}
                            placeholder="145" unit="ppm" ariaLabel={t('mc_av_field_hr')} />
                        </ActField>
                        <ActField label={t('mc_av_note')} wide>
                          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                            className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-none" placeholder={t('mc_av_note_ph')} />
                        </ActField>
                      </div>
                    )}
                    <button onClick={addSession} disabled={saving} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '1rem', minHeight: 48 }}>
                      {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('mc_saving')}</> : <><i className="ri-check-line"></i> {editingId ? t('mc_av_save_changes') : t('mc_av_save')}</>}
                    </button>
                  </>
                )}
              </div>
            </Reveal>
          )}

          {/* ── Progreso por tipo ── */}
          {registeredKinds.length > 0 && (
            <Reveal delay={60}>
              <div className="rk-card" style={{ padding: '20px' }}>
                <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff', marginBottom: 12 }}>{t('mc_av_progress_title')}</h3>
                <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5">
                  {registeredKinds.map((k) => (
                    <button key={k.value} onClick={() => setSelectedType(k.value)}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${selectedType === k.value ? 'border-white/30' : 'border-white/10 hover:border-white/20'}`}
                      style={{ background: selectedType === k.value ? `${k.hex}1e` : 'rgba(255,255,255,0.02)', color: '#fff', minHeight: 40 }}>
                      <ActivityGlyph kind={k.value} size={18} style={{ color: k.hex }} />{t(k.labelKey)}
                    </button>
                  ))}
                </div>

                {selCfg && ofType.length >= 2 && (
                  <>
                    <p className="text-xs text-zinc-500 mt-4 mb-2">{t(`mc_av_chart_${metric}`)}</p>
                    <div style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                          <YAxis hide />
                          <Tooltip content={<ChartTooltip unit={metricUnit} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={38}>
                            {chartData.map((d, i) => <Cell key={d.key} fill={i === chartData.length - 1 ? selCfg.hex : `${selCfg.hex}88`} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4 items-stretch">
                      {statCards.map((s) => (
                        <div key={s.l} className="text-center h-full flex flex-col justify-center" style={{ background: 'var(--s-2)', border: '1px solid var(--s-3)', borderRadius: 'var(--r-cta)', padding: '14px 8px' }}>
                          <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(20px,4.5vw,26px)', lineHeight: 1, color: 'var(--t-1)', margin: 0 }}>{s.v}</p>
                          <p className="rk-label" style={{ fontSize: 10, marginTop: 5 }}>{s.l}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {selCfg && ofType.length === 1 && (
                  <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
                    {t('mc_av_one_session', { type: t(selCfg.labelKey).toLowerCase() })}
                    <span className="block text-white mt-1">
                      {sessionSummary(ofType[0], t, locale)}
                    </span>
                  </p>
                )}
              </div>
            </Reveal>
          )}

          {/* ── Historial ── */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">{t('mc_av_history')}</h3>
            {sessions.length === 0 ? (
              <Reveal>
                <div className="rk-card text-center" style={{ padding: '52px 24px' }}>
                  <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
                    <i className="ri-run-line text-3xl text-red-400"></i>
                  </div>
                  <h3 className="rk-h3" style={{ fontSize: '1.25rem', color: '#fff' }}>{t('mc_av_empty_title')}</h3>
                  <p className="text-sm text-zinc-400 mt-2 max-w-xs mx-auto leading-relaxed">{t('mc_av_empty_desc')}</p>
                  <button onClick={() => { setStep(1); setShowForm(true); }} className="rk-btn rk-btn-primary mt-6" style={{ fontSize: '0.9rem', padding: '0.85rem 1.8rem' }}>
                    {t('mc_av_empty_cta')}
                  </button>
                </div>
              </Reveal>
            ) : (
              <div className="space-y-2.5">
                {sessions.map((s, i) => {
                  const c = activityKindCfg(s.kind);
                  return (
                    <Reveal key={s.id} delay={Math.min(i, 6) * 40}>
                      <div className="rk-card flex items-center gap-4 group" style={{ padding: '14px 16px' }}>
                        <div className="w-11 h-11 flex items-center justify-center rounded-xl border flex-shrink-0" style={{ background: `${c.hex}1a`, borderColor: `${c.hex}40`, color: c.hex }}>
                          <ActivityGlyph kind={s.kind} size={22} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-white">{t(c.labelKey)}</p>
                            {sessionChips(s).map((chip, ci) => (
                              <span key={ci} className="text-[11px] text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full">{chip}</span>
                            ))}
                          </div>
                          <p className="text-xs text-zinc-500 mt-1 first-letter:uppercase">
                            {new Date(s.session_date + 'T12:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                          </p>
                          {s.note && <p className="text-xs text-zinc-400 mt-1.5 pl-2.5 border-l-2 border-white/10 leading-relaxed">{s.note}</p>}
                        </div>
                        {confirmDel === s.id ? (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button onClick={() => deleteSession(s.id)} className="text-[11px] font-bold text-red-300 bg-red-600/12 border border-red-500/35 rounded-lg px-2.5 py-1.5 cursor-pointer">{t('mc_delete')}</button>
                            <button onClick={() => setConfirmDel(null)} className="text-[11px] text-zinc-400 px-1.5 cursor-pointer">{t('mc_cancel')}</button>
                          </div>
                        ) : (
                          <div className="flex items-center flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(s)} aria-label={t('mc_edit')}
                              className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-white cursor-pointer">
                              <i className="ri-pencil-line"></i>
                            </button>
                            <button onClick={() => setConfirmDel(s.id)} aria-label={t('mc_delete')}
                              className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer">
                              <i className="ri-delete-bin-line"></i>
                            </button>
                          </div>
                        )}
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  // Chips de una sesión en el historial, según lo que tenga.
  function sessionChips(s: ActSession): string[] {
    const out = [`${s.duration_min} min`];
    if (s.distance_km) out.push(`${s.distance_km} km`);
    if (s.pace_sec_per_km) out.push(`${paceLabel(s.pace_sec_per_km)} /km`);
    if (s.meters) out.push(`${s.meters} m`);
    if (s.incline_percent) out.push(t('mc_av_incline_chip', { n: s.incline_percent }));
    if (s.rounds) out.push(t('mc_av_rounds_short', { n: s.rounds }));
    return out;
  }
}

function sessionSummary(s: ActSession, t: (k: string, o?: Record<string, unknown>) => string, locale: string): string {
  const bits = [`${s.duration_min} min`];
  if (s.distance_km) bits.push(`${s.distance_km} km`);
  if (s.meters) bits.push(`${s.meters} m`);
  if (s.incline_percent) bits.push(t('mc_av_incline_chip', { n: s.incline_percent }));
  if (s.rounds) bits.push(t('mc_av_rounds_short', { n: s.rounds }));
  bits.push(new Date(s.session_date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'long' }));
  return bits.join(' · ');
}

// Campo del formulario de actividad.
//
// El problema histórico: en una fila de 2 columnas, si un label ocupa 2 líneas
// (por ser más largo) y el de al lado solo 1, el input de esa columna baja y
// deja de arrancar a la misma altura que su vecino.
//
// Solución de raíz: la zona del label tiene SIEMPRE la altura de 2 líneas
// (`minHeight`), ocupe el texto 1 línea o 2. Así el input de cada columna
// arranca exactamente en el mismo desplazamiento vertical dentro de su celda,
// y como las celdas de una fila del grid empiezan a la misma Y, los inputs
// también. El "(opcional)" sale del label (que lo alargaba) y va como texto de
// ayuda DEBAJO del input, donde no afecta a la alineación.
// Módulo aparte para no remontar al re-renderizar el formulario.
const ACT_LABEL_MIN_H = '2rem'; // reserva 2 líneas de texto-xs (leading-tight ≈ 15px/línea)
function ActField({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 ${wide ? 'col-span-2' : ''}`}>
      <div className="flex items-end mb-1.5" style={{ minHeight: ACT_LABEL_MIN_H }}>
        <span className="text-xs text-zinc-400 leading-tight">{label}</span>
      </div>
      {children}
      {hint && <p className="text-[10px] text-zinc-600 mt-1 leading-tight">{hint}</p>}
    </div>
  );
}

/**
 * Campo numérico con botones de −/+ además del teclado.
 *
 * En el móvil, ajustar 30 → 45 minutos con el teclado numérico obliga a abrir
 * el teclado, borrar y teclear. Con los botones es un toque. El input sigue
 * ahí para escribir un valor cualquiera de golpe.
 *
 * `step` es el salto de los botones; puede no coincidir con el `step` del
 * input, que solo lo usan las flechas del teclado en escritorio.
 */
function StepperInput({ value, onChange, step, min, max, placeholder, unit, ariaLabel }: {
  value: string;
  onChange: (v: string) => void;
  step: number;
  min: number;
  max: number;
  placeholder?: string;
  /** Sufijo corto que se pinta dentro del input (min, km, %...). */
  unit?: string;
  ariaLabel: string;
}) {
  // Redondea al múltiplo del salto para que tocar +5 desde 32 lleve a 35, no a
  // 37: el usuario espera valores "redondos" al usar los botones.
  const bump = (dir: 1 | -1) => {
    const cur = parseFloat((value || '').replace(',', '.'));
    const base = Number.isFinite(cur) ? cur : (dir > 0 ? min - step : min);
    const next = Math.round((base + dir * step) / step) * step;
    const clamped = Math.min(max, Math.max(min, next));
    onChange(String(+clamped.toFixed(2)));
  };
  const btn = 'w-11 flex-shrink-0 flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/12 text-white hover:bg-white/[0.12] active:scale-95 transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed';
  const cur = parseFloat((value || '').replace(',', '.'));
  return (
    <div className="flex items-stretch gap-1.5">
      <button type="button" onClick={() => bump(-1)} className={btn} style={{ minHeight: 44 }}
        aria-label={`${ariaLabel} −${step}`} disabled={Number.isFinite(cur) && cur <= min}>
        <i className="ri-subtract-line" />
      </button>
      <div className="flex-1 min-w-0 relative">
        <input inputMode="decimal" type="number" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel} placeholder={placeholder}
          className="w-full bg-white/[0.04] border border-white/10 text-white text-center rounded-xl py-2.5 focus:outline-none focus:border-red-500"
          // Con la unidad en posición absoluta y el número centrado, en los
          // campos estrechos (pulso, en rejilla de dos columnas) el "145" se
          // montaba encima del "ppm". Se reserva el mismo hueco a los dos
          // lados: la unidad cabe a la derecha y el número sigue centrado.
          style={{ fontSize: 16, minHeight: 44, paddingLeft: unit ? 28 : 8, paddingRight: unit ? 28 : 8 }} />
        {unit && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 pointer-events-none">{unit}</span>}
      </div>
      <button type="button" onClick={() => bump(1)} className={btn} style={{ minHeight: 44 }}
        aria-label={`${ariaLabel} +${step}`} disabled={Number.isFinite(cur) && cur >= max}>
        <i className="ri-add-line" />
      </button>
    </div>
  );
}
