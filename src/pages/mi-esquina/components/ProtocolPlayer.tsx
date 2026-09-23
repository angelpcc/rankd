import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWakeLock } from '@/pages/timer/hooks/useWakeLock';
import {
  changedVars, clock, formatVarValue, protocolColumnOrder, protocolTotals, protocolVarsFor, segmentStarts,
  type Protocol, type ProtocolRun, type ProtocolSegment, type ProtocolVarDef, type RunDone,
} from '@/pages/mi-esquina/lib/protocols';
import { activityKindCfg, paceLabel, paceToSec, todayISO } from '@/pages/mi-esquina/lib/dayPlan';
import { tinte } from '@/pages/mi-esquina/lib/sectionTheme';

// Reproductor en vivo de un protocolo (punto 16).
//
// Lo que hace falta mientras se entrena, por orden de importancia:
//   1. QUÉ toca AHORA — el ejercicio en grande ("Wall balls") y sus números.
//   2. CUÁNTO queda — un anillo que se vacía, legible de reojo y de lejos.
//   3. QUÉ viene DESPUÉS — para llegar al cambio sabiendo qué tocar.
// Y la sesión entera al lado (en el móvil, debajo), con cada tramo tocable
// para saltar a él.
//
// Los tramos por TIEMPO avanzan solos, con tres pitidos cortos antes del
// cambio. Los que van por DISTANCIA o por REPETICIONES no se pueden
// cronometrar sin sensores: cuentan hacia arriba y esperan a "Hecho". Se dice
// cuál es cuál en vez de fingir una precisión que no existe.
//
// Antes lo grande del centro eran las variables de máquina: en una cinta
// valía, pero en un Hyrox el centro de la pantalla era un "esfuerzo 7/10" y el
// ejercicio —lo que hay que hacer— iba en letra pequeña encima.

interface Props {
  protocol: Protocol;
  saving: boolean;
  /**
   * La última vez que se hizo ESTE protocolo, si hay constancia. Contesta
   * "¿la semana pasada aguanté esto entero?" justo cuando sirve de algo, que
   * es con el dedo encima del play y no después.
   */
  ultima?: ProtocolRun | null;
  /** Cerrar sin guardar nada. */
  onExit: () => void;
  /** Terminar: guarda la sesión en el historial y marca el protocolo. */
  onFinish: (done: RunDone) => void;
}

type Pitido = 'cambio' | 'fin' | 'cuenta';

/** Pitidos sin librería: un oscilador y fuera. */
function useBeep() {
  const ctxRef = useRef<AudioContext | null>(null);
  return useCallback((tipo: Pitido) => {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      if (!ctxRef.current) ctxRef.current = new Ctor();
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = tipo === 'fin' ? 880 : tipo === 'cambio' ? 660 : 440;
      const dur = tipo === 'cuenta' ? 0.12 : 0.3;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(tipo === 'cuenta' ? 0.16 : 0.26, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch { /* el navegador puede bloquear el audio; el guion se ve igual */ }
  }, []);
}

const DESCANSO_HEX = '#38bdf8';
const R = 54;
const CIRC = 2 * Math.PI * R;

export default function ProtocolPlayer({ protocol, saving, ultima, onExit, onFinish }: Props) {
  const { t } = useTranslation();
  const n = protocol.segments.length;
  const vars = protocolVarsFor(protocol.kind);
  // Las columnas de la tabla, en el orden en que se leen en una tabla impresa
  // (en una cinta, la inclinación antes que la velocidad), y solo las que
  // algún tramo usa: una columna de "Esfuerzo" llena de guiones es ruido.
  const cols = useMemo(
    () => protocolColumnOrder(protocol.kind).filter((v) => protocol.segments.some((s) => s.values[v.id] !== undefined)),
    [protocol],
  );
  const totals = useMemo(() => protocolTotals(protocol), [protocol]);
  const starts = useMemo(() => segmentStarts(protocol), [protocol]);
  const cfg = activityKindCfg(protocol.kind);
  const color = cfg.hex;
  const beep = useBeep();

  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [segElapsed, setSegElapsed] = useState(0);
  const [doneSeconds, setDoneSeconds] = useState(0);
  const [doneMeters, setDoneMeters] = useState(0);
  /** Tramos terminados (no los saltados tocando la tabla). */
  const [hechos, setHechos] = useState<Set<number>>(() => new Set());
  /**
   * La pantalla de cierre, cuando está abierta. `completed`: se llegó al final
   * (o se registra entera). `vuelta`: se puede volver a la sesión — no si ya se
   * acabó el último tramo.
   */
  const [cierre, setCierre] = useState<{ completed: boolean; vuelta: boolean } | null>(null);
  const finished = cierre !== null;
  /** Lo que se puede corregir o añadir al cerrar. Todo texto, como se teclea. */
  const [form, setForm] = useState({ min: '', dist: '', ritmo: '', pulso: '', nota: '' });
  const [confirmExit, setConfirmExit] = useState(false);
  const usaKm = cfg.fields.includes('distance_km');
  const usaMetros = cfg.fields.includes('meters');
  const usaRitmo = cfg.fields.includes('pace');

  // El cronómetro no cuenta ticks: ancla un instante y mide contra el reloj.
  // Sumar 1 por intervalo se desfasa en cuanto el móvil apaga la pantalla o el
  // navegador estrangula el temporizador en segundo plano.
  const anchorRef = useRef(0);
  const baseRef = useRef(0);
  /** Último segundo de la cuenta atrás que ya pitó (3, 2, 1). */
  const cuentaRef = useRef<number | null>(null);
  const filaRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const segment: ProtocolSegment | undefined = protocol.segments[index];
  const next: ProtocolSegment | undefined = protocol.segments[index + 1];
  const byDistance = !!segment?.meters && segment.meters > 0;
  const byReps = !!segment?.reps && segment.reps > 0;
  /**
   * Tramo LIBRE: sin tiempo, sin distancia y sin repeticiones. Es lo que sale
   * de un bloque de la agenda que no trae guion ("Tirada larga 10-15 km" con
   * su nota): cronómetro hacia arriba y "Hecho" cuando se acabe.
   */
  const abierto = !!segment && !byDistance && !byReps && !((segment.seconds || 0) > 0);
  /** Se termina a mano: distancia, repeticiones o libre. */
  const manual = byDistance || byReps || abierto;
  const segSeconds = segment?.seconds || 0;
  const remaining = Math.max(0, segSeconds - segElapsed);

  useWakeLock(running && !finished);

  /** Tiempo real pasado en el tramo actual, sin pasarse de su duración si va por tiempo. */
  const gastado = useCallback((seg: ProtocolSegment | undefined, elapsed: number) => {
    if (!seg) return 0;
    const esManual = (!!seg.meters && seg.meters > 0) || (!!seg.reps && seg.reps > 0) || !((seg.seconds || 0) > 0);
    return esManual ? elapsed : Math.min(elapsed, seg.seconds || elapsed);
  }, []);

  /** Abre la pantalla de cierre con lo hecho ya escrito, para corregirlo si hace falta. */
  const abrirCierre = useCallback((segundos: number, metros: number, completed: boolean, vuelta: boolean) => {
    setForm({
      min: segundos > 0 ? String(Math.max(1, Math.round(segundos / 60))) : '',
      dist: metros > 0 ? (usaKm ? String(+(metros / 1000).toFixed(2)).replace('.', ',') : String(Math.round(metros))) : '',
      ritmo: '', pulso: '', nota: '',
    });
    setCierre({ completed, vuelta });
  }, [usaKm]);

  const reanclar = () => {
    baseRef.current = 0;
    anchorRef.current = Date.now();
    cuentaRef.current = null;
    setSegElapsed(0);
  };

  const advance = useCallback((auto: boolean) => {
    const seg = protocol.segments[index];
    if (!seg) return;
    const spent = auto ? (seg.seconds || 0) : gastado(seg, segElapsed);
    setDoneSeconds((s) => s + Math.max(0, Math.round(spent)));
    if (seg.meters) setDoneMeters((m) => m + seg.meters!);
    setHechos((h) => new Set(h).add(index));
    try { navigator.vibrate?.(index >= n - 1 ? [120, 80, 120] : 150); } catch { /* sin vibración */ }

    if (index >= n - 1) {
      // El tiempo del último tramo ya está sumado arriba: se pone el reloj del
      // tramo a cero para que la pantalla de cierre no lo cuente dos veces.
      baseRef.current = 0;
      setSegElapsed(0);
      setRunning(false);
      beep('fin');
      // Terminada sin cronómetro (saltando tramos mientras manda la máquina):
      // cuenta lo que dura la sesión, no un minuto que no se corresponde con nada.
      const total = doneSeconds + Math.max(0, Math.round(spent));
      abrirCierre(total < 30 ? totals.seconds : total, doneMeters + (seg.meters || 0), true, false);
      return;
    }
    reanclar();
    setIndex((i) => i + 1);
    beep('cambio');
  }, [protocol.segments, index, n, segElapsed, beep, gastado, doneSeconds, doneMeters, totals.seconds, abrirCierre]);

  /** Ir a un tramo concreto (tabla, línea de tramos o "anterior"). */
  const irA = useCallback((i: number) => {
    if (i < 0 || i >= n || i === index) return;
    setDoneSeconds((s) => s + Math.max(0, Math.round(gastado(protocol.segments[index], segElapsed))));
    reanclar();
    setIndex(i);
  }, [n, index, segElapsed, protocol.segments, gastado]);

  /** Como en un reproductor de música: al principio del tramo va al anterior; si no, reinicia este. */
  const anterior = () => {
    if (segElapsed > 3 || index === 0) {
      setDoneSeconds((s) => s + Math.max(0, Math.round(gastado(segment, segElapsed))));
      reanclar();
      return;
    }
    irA(index - 1);
  };

  // Reloj del tramo actual, y la cuenta atrás de los tres últimos segundos.
  useEffect(() => {
    if (!running || finished) return;
    const id = window.setInterval(() => {
      const elapsed = baseRef.current + (Date.now() - anchorRef.current) / 1000;
      setSegElapsed(elapsed);
      if (!manual && segSeconds > 0) {
        const quedan = Math.ceil(segSeconds - elapsed);
        if (quedan >= 1 && quedan <= 3 && cuentaRef.current !== quedan) {
          cuentaRef.current = quedan;
          beep('cuenta');
        }
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [running, finished, index, manual, segSeconds, beep]);

  // Fin de tramo por tiempo → siguiente. Los manuales esperan al usuario.
  useEffect(() => {
    if (!running || finished || manual) return;
    if (segSeconds > 0 && segElapsed >= segSeconds) advance(true);
  }, [segElapsed, segSeconds, running, finished, manual, advance]);

  // En escritorio la tabla tiene scroll propio: se lleva la fila actual a la vista.
  useEffect(() => {
    if (!window.matchMedia?.('(min-width: 1024px)').matches) return;
    filaRefs.current[index]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [index]);

  const start = () => {
    baseRef.current = segElapsed;
    anchorRef.current = Date.now();
    setRunning(true);
    // El primer toque es también lo que desbloquea el audio del navegador.
    beep('cambio');
  };

  const pause = () => {
    baseRef.current = baseRef.current + (Date.now() - anchorRef.current) / 1000;
    setRunning(false);
  };

  // Teclado en escritorio: espacio para pausar, flechas para cambiar de tramo.
  const teclas = useRef({ start, pause, anterior, advance, running, confirmExit, finished });
  teclas.current = { start, pause, anterior, advance, running, confirmExit, finished };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = teclas.current;
      if (k.confirmExit || k.finished) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      // Con un botón enfocado, el espacio ya lo pulsa: no se hace dos veces.
      if (tag === 'BUTTON' && e.code === 'Space') return;
      if (e.code === 'Space') { e.preventDefault(); if (k.running) k.pause(); else k.start(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); k.advance(false); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); k.anterior(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const spentHere = gastado(segment, segElapsed);
  const totalDone = doneSeconds + spentHere;

  /**
   * A la pantalla de cierre desde "Registrar" o desde "Terminar antes".
   *
   * `aMano` es el caso de quien ha seguido la TABLA sin darle al play — que es
   * perfectamente normal: la máquina ya lleva su propio reloj y aquí solo se
   * viene a mirar qué toca. Para ése el cronómetro marca cero; se propone lo
   * que DURA el protocolo, que es lo que ha hecho, y lo puede corregir.
   */
  const aCierre = (completed: boolean, aMano: boolean) => {
    if (running) pause();
    const hechosSeg = Math.max(0, Math.round(doneSeconds + spentHere));
    const segundos = aMano && hechosSeg < 30 ? totals.seconds : hechosSeg;
    const metros = doneMeters || (aMano ? totals.meters : 0);
    setConfirmExit(false);
    abrirCierre(segundos, metros, completed || aMano, true);
  };

  /** Guarda con lo que diga la pantalla de cierre. */
  const guardar = () => {
    if (!cierre) return;
    const num = (x: string) => parseFloat(x.replace(',', '.'));
    const min = num(form.min);
    const d = num(form.dist);
    const hechosSeg = Math.max(0, Math.round(doneSeconds + spentHere));
    const ritmo = paceToSec(form.ritmo);
    const pulso = parseInt(form.pulso, 10);
    onFinish({
      secondsDone: Number.isFinite(min) && min > 0 ? Math.round(min * 60) : (hechosSeg >= 30 ? hechosSeg : totals.seconds),
      segmentsDone: cierre.completed ? n : hechos.size,
      completed: cierre.completed,
      distanceMeters: Number.isFinite(d) && d > 0 ? Math.round(usaKm ? d * 1000 : d) : 0,
      ...(form.nota.trim() ? { note: form.nota.trim().slice(0, 300) } : {}),
      ...(ritmo > 0 ? { paceSecPerKm: ritmo } : {}),
      ...(Number.isFinite(pulso) && pulso > 30 && pulso < 240 ? { avgHr: pulso } : {}),
    });
  };

  // ── Pantalla de cierre ──
  //
  // Antes era un "¡terminado!" y un botón. Lo que faltaba es lo que se pidió:
  // "una vez terminada, guardar sesión, y si quieres meter especificaciones,
  // las metes" — el ritmo de la tirada, el pulso, los kilómetros de verdad.
  // Viene rellena con lo que ha medido el cronómetro: sin tocar nada, se
  // guarda igual que antes.
  if (cierre) {
    const minN = parseFloat(form.min.replace(',', '.'));
    const distN = parseFloat(form.dist.replace(',', '.'));
    const ritmoAuto = usaRitmo && usaKm && minN > 0 && distN > 0 ? paceLabel(Math.round((minN * 60) / distN)) : '';
    const hechosSeg = Math.max(0, Math.round(doneSeconds + spentHere));
    // Sin minutos escritos, sin cronómetro y sin duración prevista (una tirada
    // "de 10-15 km" registrada después) no se sabe qué guardar: se piden.
    const puede = (Number.isFinite(minN) && minN > 0) || hechosSeg >= 30 || (cierre.completed && totals.seconds > 0);
    // La fila de lo medido solo si se ha medido algo: "0:00 · —" no dice nada.
    const medido = hechosSeg >= 30 || doneMeters > 0;
    const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((x) => ({ ...x, [k]: e.target.value }));
    return (
      <Shell onClose={onExit} title={protocol.name} icon={cfg.icon} color={color}>
        <div className="flex-1 overflow-y-auto px-5 py-7">
          <div className="max-w-md mx-auto flex flex-col items-center text-center">
            <div className="w-16 h-16 mb-4 flex items-center justify-center rounded-full anim-scale-in"
              style={cierre.completed
                ? { background: tinte('#22c55e', 0.12), border: `2px solid ${tinte('#22c55e', 0.45)}`, color: '#4ade80' }
                : { background: tinte(color, 0.12), border: `2px solid ${tinte(color, 0.45)}`, color }}>
              <i className={`${cierre.completed ? 'ri-check-line' : 'ri-flag-line'} text-3xl`} />
            </div>
            <h3 className="text-2xl font-bold text-white tracking-tight">{cierre.completed ? t('mc_pt_done_title') : t('mc_pt_exit_save')}</h3>
            <p className="text-sm mt-2 leading-relaxed max-w-xs" style={{ color: 'var(--t-2)' }}>{t('mc_pt_done_sub')}</p>

            {medido && <div className="grid grid-cols-3 gap-2 w-full mt-6">
              <Stat value={clock(hechosSeg)} label={t('mc_pt_stat_time')} />
              <Stat value={`${cierre.completed && cierre.vuelta ? n : hechos.size}/${n}`} label={t('mc_pt_stat_segments')} />
              <Stat value={doneMeters > 0 ? (doneMeters >= 1000 ? `${+(doneMeters / 1000).toFixed(2)} km` : `${doneMeters} m`) : '—'} label={t('mc_pt_stat_distance')} />
            </div>}
          </div>

          {/* Detalles, todos opcionales */}
          <div className="max-w-md mx-auto mt-6 rk-card" style={{ padding: 16 }}>
            <p className="rk-label mb-3">{t('mc_pt_rv_details')}</p>
            <div className="grid grid-cols-2 gap-3">
              <Campo label={t('mc_pt_rv_minutes')} value={form.min} onChange={set('min')} inputMode="decimal" sufijo="min" />
              {(usaKm || usaMetros) && (
                <Campo label={usaKm ? t('mc_av_field_km') : t('mc_av_field_meters')} value={form.dist} onChange={set('dist')}
                  inputMode="decimal" sufijo={usaKm ? 'km' : 'm'} />
              )}
              {usaRitmo && (
                <Campo label={t('mc_av_field_pace')} value={form.ritmo} onChange={set('ritmo')} inputMode="text"
                  placeholder={ritmoAuto || '5:30'} sufijo="/km" />
              )}
              <Campo label={t('mc_av_field_hr')} value={form.pulso} onChange={set('pulso')} inputMode="numeric" placeholder="135" sufijo="ppm" />
            </div>
            {usaRitmo && ritmoAuto && !form.ritmo && (
              <p className="text-[11px] mt-2" style={{ color: 'var(--t-3)' }}>{t('mc_av_pace_auto', { pace: ritmoAuto })}</p>
            )}
            <label className="block mt-3">
              <span className="block text-xs mb-1.5 text-left" style={{ color: 'var(--t-2)' }}>{t('mc_pt_rv_note')}</span>
              <textarea value={form.nota} onChange={set('nota')} rows={2} maxLength={300}
                placeholder={t('mc_pt_rv_note_ph')}
                className="w-full rounded-xl px-3 py-2.5 text-white resize-none focus:outline-none"
                style={{ fontSize: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line-2)' }} />
            </label>
          </div>

          <div className="max-w-md mx-auto mt-5 flex flex-col items-stretch">
            <button onClick={guardar} disabled={saving || !puede}
              className="rk-cta rk-press w-full flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ minHeight: 52 }}>
              {saving
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('mc_saving')}</>
                : <><i className="ri-check-line text-lg" />{t('mc_pt_save_session')}</>}
            </button>
            {!puede && <p className="text-[11px] mt-1.5 text-center" style={{ color: 'var(--t-3)' }}>{t('mc_pt_rv_need_min')}</p>}
            {cierre.vuelta && (
              <button onClick={() => setCierre(null)} disabled={saving}
                className="rk-nav-btn rk-press w-full mt-2 inline-flex items-center justify-center gap-1.5 text-sm" style={{ minHeight: 46 }}>
                <i className="ri-arrow-left-line" />{t('mc_pt_rv_back')}
              </button>
            )}
            <button onClick={onExit} disabled={saving}
              className="text-xs hover:text-white cursor-pointer mt-2" style={{ minHeight: 44, color: 'var(--t-3)' }}>
              {t('mc_pt_discard_run')}
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  if (!segment) {
    return (
      <Shell onClose={onExit} title={protocol.name} icon={cfg.icon} color={color}>
        <div className="flex-1 flex items-center justify-center px-6 text-center">
          <p className="text-sm" style={{ color: 'var(--t-2)' }}>{t('mc_pt_empty_protocol')}</p>
        </div>
      </Shell>
    );
  }

  const highlight = new Set(changedVars(protocol.segments[index - 1], segment));
  const esDescanso = !!segment.rest;
  const tono = esDescanso ? DESCANSO_HEX : color;
  const final = !manual && running && remaining <= 5 && segSeconds > 0;
  const empezado = running || segElapsed > 0 || index > 0 || doneSeconds > 0;
  const valoresAhora = vars.filter((v) => segment.values[v.id] !== undefined);

  // Lo que dibuja el anillo: por tiempo, lo que queda; a mano, la estimación
  // (más apagada, porque es una guía y no una cuenta).
  const frac = abierto
    ? (segElapsed % 60) / 60
    : manual
    ? (segSeconds > 0 ? Math.min(1, segElapsed / segSeconds) : 0)
    : (segSeconds > 0 ? Math.max(0, 1 - segElapsed / segSeconds) : 0);

  const titulo = esDescanso ? t('mc_pt_rest_title') : (segment.label || t(cfg.labelKey));
  const antetitulo = esDescanso
    ? t('mc_pt_rest_eyebrow')
    : (segment.stage || (n > 1 ? t('mc_pt_segment_of', { n: index + 1, total: n }) : t(cfg.labelKey)));

  // "hace 3 d · lo dejaste en 28:14 de 40:00" / "ayer · lo terminaste entero".
  let ultimaTexto = '';
  if (ultima) {
    const dias = Math.round((Date.parse(todayISO() + 'T12:00:00') - Date.parse(ultima.runDate + 'T12:00:00')) / 86400000);
    const cuando = dias <= 0 ? t('mc_str_today') : dias === 1 ? t('mc_str_yesterday') : t('mc_str_days_ago', { n: dias });
    const resultado = ultima.completed
      ? t('mc_pt_last_full')
      : t('mc_pt_last_cut', { done: clock(ultima.secondsDone), total: clock(totals.seconds) });
    ultimaTexto = cuando + ' · ' + resultado;
  }

  // Registrar, sin condiciones: quien sigue la tabla mirando la máquina, sin
  // darle al play, también ha hecho la sesión.
  const registrar = (
    <button onClick={() => aCierre(false, true)} disabled={saving}
      className="rk-nav-btn rk-press inline-flex items-center gap-1.5 text-xs whitespace-nowrap disabled:opacity-60"
      style={{ minHeight: 40, padding: '0 0.9rem' }}>
      {saving
        ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        : <i className="ri-check-double-line" style={{ color: '#4ade80' }} />}
      {t('mc_pt_register')}
    </button>
  );
  const salir = (
    <button onClick={() => setConfirmExit(true)} className="text-xs hover:text-white cursor-pointer whitespace-nowrap"
      style={{ minHeight: 40, color: 'var(--t-3)' }}>
      {t('mc_pt_finish_early')}
    </button>
  );

  const objetivo = (s: ProtocolSegment) => (s.reps
    ? `${s.reps} ${t('mc_pt_reps')}`
    : s.meters
      ? (s.meters >= 1000 ? `${+(s.meters / 1000).toFixed(2)} km` : `${s.meters} m`)
      : (s.seconds || 0) > 0 ? clock(s.seconds) : t('mc_pt_free'));

  return (
    <Shell onClose={() => (empezado ? setConfirmExit(true) : onExit())} title={protocol.name} icon={cfg.icon} color={color}>
      {/* ── La sesión en una línea: cada tramo, del ancho de lo que dura ── */}
      <div className="px-4 sm:px-6 pt-3 flex-shrink-0">
        <div className="flex gap-[3px] h-2 max-w-6xl mx-auto">
          {protocol.segments.map((s, i) => {
            const hecho = hechos.has(i);
            // El tramo libre no tiene final: su barra no se llena (el anillo da vueltas).
            const relleno = i === index ? (abierto ? 0 : 1 - (manual ? 1 - frac : frac)) : hecho ? 1 : 0;
            return (
              <button key={s.id} onClick={() => irA(i)} aria-label={`${i + 1}. ${s.label || ''}`}
                className="relative h-full rounded-full overflow-hidden cursor-pointer"
                style={{
                  flexGrow: Math.max(s.seconds || 60, 20), flexBasis: 0, minWidth: 4,
                  background: s.rest ? tinte(DESCANSO_HEX, 0.16) : 'rgba(255,255,255,0.09)',
                  outline: i === index ? `1px solid ${tinte(s.rest ? DESCANSO_HEX : color, 0.7)}` : undefined,
                  outlineOffset: 1,
                }}>
                <span className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${Math.round(relleno * 100)}%`, background: s.rest ? DESCANSO_HEX : color, opacity: i < index && !hecho ? 0.35 : 1 }} />
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-2 max-w-6xl mx-auto text-[11px] tabular-nums" style={{ color: 'var(--t-3)' }}>
          <span>{t('mc_pt_segment_of', { n: index + 1, total: n })}</span>
          <span>{clock(totalDone)}{totals.seconds > 0 ? ` / ≈ ${clock(totals.seconds)}` : ''}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
        <div className="max-w-6xl mx-auto lg:h-full lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">

          {/* ── LO QUE TOCA AHORA ── */}
          <section className="px-5 sm:px-8 pt-5 pb-6 flex flex-col lg:overflow-y-auto">
            <div className="my-auto w-full flex flex-col items-center text-center">
            <p className="rk-label" style={{ color: tono, fontSize: 12 }}>{antetitulo}</p>
            <h2 key={index} className="mt-1.5 font-extrabold text-white tracking-tight leading-[1.05] anim-scale-in"
              style={{ fontSize: 'clamp(26px, 7.5vw, 44px)', maxWidth: 560 }}>
              {titulo}
            </h2>
            {esDescanso && next && (
              <p className="text-sm mt-2" style={{ color: 'var(--t-2)' }}>
                {t('mc_pt_get_ready')}: <strong className="text-white font-semibold">{next.label}</strong> · {objetivo(next)}
              </p>
            )}

            {/* El anillo. Sin transición CSS a propósito: se redibuja cada 200 ms
                y, con el móvil en ahorro de energía, una transición que se
                reinicia cada 200 ms se queda atrás y el anillo miente. */}
            <div className="relative mt-5" style={{ width: 'min(64vw, 250px)', aspectRatio: '1 / 1' }}>
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
                <circle cx="60" cy="60" r={R} fill="none" stroke={final ? '#ff4d47' : tono} strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - frac)}
                  style={{ transition: 'stroke 0.3s', opacity: manual ? 0.45 : 1 }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {abierto ? (
                  <>
                    <p className="leading-none tabular-nums" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(56px, 17vw, 84px)', color: '#fff' }}>
                      {clock(segElapsed)}
                    </p>
                    <p className="rk-label mt-1" style={{ fontSize: 11 }}>{t('mc_pt_free')}</p>
                  </>
                ) : manual ? (
                  <>
                    <p className="rk-num leading-none" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(48px, 15vw, 72px)', color: '#fff' }}>
                      {byReps ? segment.reps : (segment.meters! >= 1000 ? +(segment.meters! / 1000).toFixed(2) : segment.meters)}
                    </p>
                    <p className="rk-label mt-1" style={{ fontSize: 11 }}>
                      {byReps ? t('mc_pt_reps') : (segment.meters! >= 1000 ? 'km' : 'm')}
                    </p>
                    <p className="text-xs mt-2 tabular-nums" style={{ color: 'var(--t-2)' }}>
                      {t('mc_pt_elapsed', { time: clock(segElapsed) })}
                    </p>
                  </>
                ) : (
                  <>
                    <p className={`leading-none tabular-nums ${final ? 'animate-pulse' : ''}`}
                      style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(56px, 17vw, 84px)', color: final ? '#ff6b66' : '#fff' }}>
                      {clock(remaining)}
                    </p>
                    <p className="text-xs mt-1 tabular-nums" style={{ color: 'var(--t-3)' }}>
                      {t('mc_pt_of_total', { time: clock(segSeconds) })}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Números de máquina (cinta, bici, remo…) */}
            {valoresAhora.length > 0 && (
              <div className="grid gap-2 mt-5 w-full" style={{ maxWidth: Math.min(420, 150 * valoresAhora.length), gridTemplateColumns: `repeat(${valoresAhora.length}, minmax(0, 1fr))` }}>
                {valoresAhora.map((v) => {
                  const on = highlight.has(v.id);
                  return (
                    <div key={v.id} className="rounded-2xl px-2 py-2.5 transition-colors"
                      style={{ background: on ? tinte(tono, 0.14) : 'rgba(255,255,255,0.04)', border: `1px solid ${on ? tinte(tono, 0.5) : 'var(--line)'}` }}>
                      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(30px, 9vw, 42px)', lineHeight: 0.95, color: '#fff', margin: 0 }}>
                        {formatVarValue(v, segment.values[v.id] as number)}
                        {v.unit && <span className="text-sm ml-1" style={{ color: 'var(--t-3)' }}>{v.unit}</span>}
                      </p>
                      <p className="rk-label mt-1" style={{ fontSize: 10 }}>{t(v.labelKey)}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* El detalle: carga, ritmo, escalado */}
            {segment.note && !esDescanso && (
              <p className="text-sm mt-4 leading-relaxed rounded-xl px-3.5 py-2.5 max-w-md"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)', color: 'var(--t-1)' }}>
                {segment.note}
              </p>
            )}
            {manual && (
              <p className="text-xs mt-3 max-w-xs leading-relaxed" style={{ color: 'var(--t-3)' }}>
                {abierto ? t('mc_pt_free_hint') : byReps ? t('mc_pt_reps_manual') : t('mc_pt_distance_manual')}
              </p>
            )}

            {/* Solo ANTES de empezar: una vez en marcha, lo de la otra vez estorba. */}
            {ultima && !empezado && (
              <p className="text-xs mt-4 flex items-center gap-1.5 leading-snug" style={{ color: 'var(--t-3)' }}>
                <i className="ri-history-line" style={{ color: 'var(--t-2)' }} />
                <span><strong style={{ color: 'var(--t-2)', fontWeight: 600 }}>{t('mc_lp_last')}</strong>{' · '}{ultimaTexto}</span>
              </p>
            )}

            {/* ── LO QUE VIENE ── */}
            {!esDescanso && (
              <div className="w-full max-w-md mt-5 flex items-center gap-3 rounded-2xl px-4 py-3 text-left"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)' }}>
                <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--t-2)' }}>
                  <i className="ri-skip-forward-line" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="rk-label" style={{ fontSize: 10 }}>{t('mc_pt_next')}</p>
                  {next ? (
                    <p className="text-sm font-semibold text-white truncate">
                      {next.rest ? t('mc_pt_rest_eyebrow') : (next.label || t(cfg.labelKey))}
                      <span className="font-normal" style={{ color: 'var(--t-2)' }}> · {valuesLine(next, vars) || objetivo(next)}</span>
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-white">{t('mc_pt_last_segment')}</p>
                  )}
                </div>
                {next && !manual && (
                  <span className="text-xs tabular-nums flex-shrink-0" style={{ color: 'var(--t-3)' }}>{t('mc_pt_in_time', { time: clock(remaining) })}</span>
                )}
              </div>
            )}
            </div>
          </section>

          {/* ── La sesión entera ── */}
          <section className="px-4 sm:px-6 pb-6 lg:py-6 lg:overflow-y-auto lg:border-l" style={{ borderColor: 'var(--line)' }}>
            <div className="flex items-baseline justify-between gap-3 mb-2 px-1">
              <p className="text-sm font-semibold text-white">{t('mc_pt_whole')}</p>
              <p className="text-[11px]" style={{ color: 'var(--t-3)' }}>{t('mc_pt_tap_to_jump')}</p>
            </div>
            <div className="rk-card overflow-hidden" style={{ padding: 0 }}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <th className="rk-label text-left px-3 py-2.5 w-10" style={{ fontSize: 10 }}>#</th>
                      <th className="rk-label text-left px-2 py-2.5" style={{ fontSize: 10 }}>{t('mc_pt_col_what')}</th>
                      {cols.map((v) => (
                        <th key={v.id} className="rk-label text-left px-2 py-2.5 whitespace-nowrap" style={{ fontSize: 10 }}>{t(v.labelKey)}</th>
                      ))}
                      <th className="rk-label text-right px-3 py-2.5" style={{ fontSize: 10 }}>{t('mc_pt_col_time')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {protocol.segments.map((s, i) => {
                      const actual = i === index;
                      const hecho = hechos.has(i);
                      const hex = s.rest ? DESCANSO_HEX : color;
                      // "min 5-10" solo si todo lo anterior va por tiempo: con un
                      // tramo por distancia antes, el minuto de arranque es inventado.
                      const exacto = protocol.segments.slice(0, i).every((x) => !x.meters && !x.reps);
                      return (
                        <tr key={s.id} ref={(el) => { filaRefs.current[i] = el; }} onClick={() => irA(i)}
                          className="cursor-pointer transition-colors hover:bg-white/[0.03]"
                          style={{
                            background: actual ? tinte(hex, 0.12) : undefined,
                            borderTop: '1px solid var(--line)',
                            boxShadow: actual ? `inset 3px 0 0 ${hex}` : undefined,
                          }}>
                          <td className="px-3 py-2.5 align-top">
                            {hecho && !actual
                              ? <i className="ri-check-line" style={{ color: hex }} />
                              : actual
                                ? <i className={running ? 'ri-play-fill' : 'ri-pause-fill'} style={{ color: hex }} />
                                : <span className="tabular-nums" style={{ color: 'var(--t-3)' }}>{i + 1}</span>}
                          </td>
                          <td className="px-2 py-2.5 align-top" style={{ minWidth: 150, opacity: hecho && !actual ? 0.55 : 1 }}>
                            {s.stage && <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--t-3)' }}>{s.stage}</p>}
                            <p className={`leading-snug ${actual ? 'text-white font-semibold' : ''}`}
                              style={{ color: actual ? undefined : s.rest ? tinte(DESCANSO_HEX, 0.9) : 'var(--t-1)' }}>
                              {s.label || (s.rest ? t('mc_pt_rest_eyebrow') : '—')}
                            </p>
                            {s.note && <p className="text-[11px] leading-snug mt-0.5" style={{ color: 'var(--t-3)' }}>{s.note}</p>}
                          </td>
                          {cols.map((v) => {
                            const val = s.values[v.id];
                            return (
                              <td key={v.id} className={`px-2 py-2.5 align-top tabular-nums whitespace-nowrap ${actual ? 'text-white font-semibold' : ''}`}
                                style={{ color: actual ? undefined : 'var(--t-2)', opacity: hecho && !actual ? 0.55 : 1 }}>
                                {typeof val === 'number' ? `${formatVarValue(v, val)}${v.unit ? ` ${v.unit}` : ''}` : '—'}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2.5 align-top text-right whitespace-nowrap" style={{ opacity: hecho && !actual ? 0.55 : 1 }}>
                            <p className={`tabular-nums ${actual ? 'text-white font-semibold' : ''}`} style={{ color: actual ? undefined : 'var(--t-2)' }}>
                              {objetivo(s)}
                            </p>
                            {!s.meters && !s.reps && exacto && (
                              <p className="text-[10px] tabular-nums" style={{ color: 'var(--t-3)' }}>
                                {Math.round(starts[i] / 60)}–{Math.round((starts[i] + s.seconds) / 60)}′
                              </p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ── Controles ──
          En escritorio, una sola fila: salir a la izquierda, los mandos en el
          centro y registrar a la derecha. En el móvil, los mandos arriba (donde
          cae el pulgar) y las dos salidas debajo. */}
      <div className="px-5 pt-3 flex-shrink-0" style={{ borderTop: '1px solid var(--line)', paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-x-6 gap-y-2">
          <div className="hidden lg:flex items-center gap-4 min-w-0">
            {salir}
            <p className="text-[11px] truncate" style={{ color: 'var(--t-3)' }}>{t('mc_pt_keys_hint')}</p>
          </div>

          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <RoundBtn onClick={anterior} icon="ri-skip-back-fill" label={t('mc_pt_prev')} />

            {!empezado ? (
              <button onClick={start}
                className="rk-press inline-flex items-center justify-center gap-2 rounded-full text-white font-bold cursor-pointer whitespace-nowrap"
                style={{ minHeight: 64, padding: '0 2rem', fontSize: '1.05rem', background: '#E10600', boxShadow: '0 10px 30px -10px rgba(225,6,0,0.7)' }}>
                <i className="ri-play-fill text-2xl" />{t('mc_pt_start')}
              </button>
            ) : (
              <button onClick={running ? pause : start} aria-label={running ? t('mc_pt_pause') : t('mc_pt_resume')}
                className="rk-press flex items-center justify-center rounded-full text-white cursor-pointer flex-shrink-0"
                style={{ width: 72, height: 72, background: running ? 'rgba(255,255,255,0.1)' : '#E10600', border: running ? '1px solid var(--line-2)' : 'none', boxShadow: running ? 'none' : '0 10px 30px -10px rgba(225,6,0,0.7)' }}>
                <i className={`${running ? 'ri-pause-fill' : 'ri-play-fill'} text-3xl`} />
              </button>
            )}

            {manual ? (
              <button onClick={() => advance(false)}
                className="rk-press inline-flex flex-col items-center justify-center gap-0.5 cursor-pointer" style={{ minWidth: 56 }}>
                <span className="w-[52px] h-[52px] rounded-full flex items-center justify-center" style={{ background: tinte('#22c55e', 0.16), border: `1px solid ${tinte('#22c55e', 0.5)}`, color: '#4ade80' }}>
                  <i className="ri-check-line text-2xl" />
                </span>
                <span className="text-[10px] font-semibold" style={{ color: '#4ade80' }}>{t('mc_pt_done_segment')}</span>
              </button>
            ) : (
              <RoundBtn onClick={() => advance(false)} icon="ri-skip-forward-fill" label={t('mc_pt_skip')} />
            )}
          </div>

          <div className="hidden lg:flex justify-end">{registrar}</div>

          {/* Móvil */}
          <div className="flex lg:hidden items-center justify-between gap-3">
            {salir}
            {registrar}
          </div>
        </div>
      </div>

      {/* Salir a medias: se ofrece guardar lo hecho en vez de tirarlo. */}
      {confirmExit && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-5" style={{ background: 'rgba(3,3,3,0.85)' }}>
          <div className="rk-card w-full max-w-xs text-center" style={{ padding: 24 }}>
            <h4 className="text-lg font-bold text-white tracking-tight">{t('mc_pt_exit_title')}</h4>
            <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--t-2)' }}>
              {t('mc_pt_exit_desc', { time: clock(totalDone), n: hechos.size, total: n })}
            </p>
            <button onClick={() => aCierre(false, false)} disabled={saving}
              className="rk-cta rk-press w-full mt-4 disabled:opacity-50" style={{ minHeight: 46 }}>
              {t('mc_pt_exit_save')}
            </button>
            <button onClick={onExit} className="w-full text-xs hover:text-red-400 cursor-pointer mt-3"
              style={{ minHeight: 42, color: 'var(--t-2)' }}>
              {t('mc_pt_exit_discard')}
            </button>
            <button onClick={() => setConfirmExit(false)} className="w-full text-xs hover:text-white cursor-pointer mt-1"
              style={{ minHeight: 42, color: 'var(--t-3)' }}>
              {t('mc_cancel')}
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

/** Valores de un tramo en una línea: "8 km/h · 4 %". */
function valuesLine(s: ProtocolSegment, vars: ProtocolVarDef[]): string {
  return vars
    .filter((v) => s.values[v.id] !== undefined)
    .map((v) => `${formatVarValue(v, s.values[v.id] as number)}${v.unit ? ` ${v.unit}` : ''}`)
    .join(' · ');
}

function RoundBtn({ onClick, icon, label }: { onClick: () => void; icon: string; label: string }) {
  return (
    <button onClick={onClick} aria-label={label}
      className="rk-press inline-flex flex-col items-center justify-center gap-0.5 cursor-pointer" style={{ minWidth: 56 }}>
      <span className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-white"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--line-2)' }}>
        <i className={`${icon} text-xl`} />
      </span>
      <span className="text-[10px] font-semibold" style={{ color: 'var(--t-3)' }}>{label}</span>
    </button>
  );
}

/** Un campo corto del cierre. A 16px para que el iPhone no amplíe la pantalla. */
function Campo({ label, value, onChange, inputMode, placeholder, sufijo }: {
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inputMode: 'decimal' | 'numeric' | 'text'; placeholder?: string; sufijo?: string;
}) {
  return (
    <label className="block text-left min-w-0">
      <span className="block text-xs mb-1.5 truncate" style={{ color: 'var(--t-2)' }}>{label}</span>
      <span className="flex items-center rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line-2)' }}>
        <input value={value} onChange={onChange} inputMode={inputMode} placeholder={placeholder}
          className="w-full min-w-0 bg-transparent text-white px-3 py-2.5 focus:outline-none tabular-nums" style={{ fontSize: 16 }} />
        {sufijo && <span className="pr-3 text-xs flex-shrink-0" style={{ color: 'var(--t-3)' }}>{sufijo}</span>}
      </span>
    </label>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl px-2 py-3.5 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)' }}>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(22px,6vw,28px)', lineHeight: 1, color: '#fff', margin: 0 }}>{value}</p>
      <p className="rk-label" style={{ fontSize: 10, marginTop: 6 }}>{label}</p>
    </div>
  );
}

/** Marco a pantalla completa: mientras se entrena no compite nada más. */
function Shell({ title, icon, color, onClose, children }: { title: string; icon: string; color: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex flex-col rk-screen-bg"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--line)' }}>
        <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tinte(color, 0.14), color }}>
          <i className={icon} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="rk-label" style={{ fontSize: 10 }}>{t('mc_pt_player_eyebrow')}</p>
          <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
        </div>
        <button onClick={onClose} aria-label={t('mc_close')}
          className="w-10 h-10 flex items-center justify-center rounded-full cursor-pointer flex-shrink-0 hover:text-white"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--t-2)' }}>
          <i className="ri-close-line text-lg" />
        </button>
      </div>
      {children}
    </div>
  );
}
