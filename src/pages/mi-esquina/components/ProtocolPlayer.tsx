import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWakeLock } from '@/pages/timer/hooks/useWakeLock';
import {
  changedVars, clock, formatVarValue, protocolTotals, protocolVarsFor, segmentStarts,
  type Protocol, type ProtocolSegment, type ProtocolVarDef,
} from '@/pages/mi-esquina/lib/protocols';

// Reproductor en vivo de un protocolo (punto 16).
//
// Lo que hace falta mientras se entrena, por orden de importancia:
//   1. QUÉ toca AHORA — los números, grandes, legibles de reojo y de lejos.
//   2. CUÁNTO queda de este tramo — para no tener que calcular nada.
//   3. QUÉ viene DESPUÉS — para llegar al cambio sabiendo qué tocar.
// El resto (la tabla entera, el progreso global) está, pero debajo.
//
// Los tramos por TIEMPO avanzan solos; los tramos por DISTANCIA no se pueden
// cronometrar sin sensores, así que esperan a que el usuario dé al botón. Se
// dice cuál es cuál en vez de fingir una precisión que no existe.

interface Props {
  protocol: Protocol;
  saving: boolean;
  /** Cerrar sin guardar nada. */
  onExit: () => void;
  /** Terminar: guarda la sesión en el historial y marca el protocolo. */
  onFinish: (done: { secondsDone: number; segmentsDone: number; completed: boolean; distanceMeters: number }) => void;
}

/** Pitido corto al cambiar de tramo. Sin librería: un oscilador y fuera. */
function useBeep() {
  const ctxRef = useRef<AudioContext | null>(null);
  return useCallback((high: boolean) => {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      if (!ctxRef.current) ctxRef.current = new Ctor();
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = high ? 880 : 520;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch { /* el navegador puede bloquear el audio; el guion se ve igual */ }
  }, []);
}

export default function ProtocolPlayer({ protocol, saving, onExit, onFinish }: Props) {
  const { t } = useTranslation();
  const vars = protocolVarsFor(protocol.kind);
  const totals = useMemo(() => protocolTotals(protocol), [protocol]);
  const starts = useMemo(() => segmentStarts(protocol), [protocol]);
  const beep = useBeep();

  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [segElapsed, setSegElapsed] = useState(0);
  const [doneSeconds, setDoneSeconds] = useState(0);
  const [doneMeters, setDoneMeters] = useState(0);
  const [finished, setFinished] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  // El cronómetro no cuenta ticks: ancla un instante y mide contra el reloj.
  // Sumar 1 por intervalo se desfasa en cuanto el móvil apaga la pantalla o el
  // navegador estrangula el temporizador en segundo plano.
  const anchorRef = useRef(0);
  const baseRef = useRef(0);

  const segment: ProtocolSegment | undefined = protocol.segments[index];
  const next: ProtocolSegment | undefined = protocol.segments[index + 1];
  const byDistance = !!segment?.meters && segment.meters > 0;
  const segSeconds = segment?.seconds || 0;
  const remaining = Math.max(0, segSeconds - segElapsed);

  useWakeLock(running && !finished);

  const advance = useCallback((auto: boolean) => {
    const seg = protocol.segments[index];
    if (!seg) return;
    const spent = auto ? (seg.seconds || 0) : Math.min(segElapsed, seg.seconds || segElapsed);
    setDoneSeconds((s) => s + Math.max(0, Math.round(spent)));
    if (seg.meters) setDoneMeters((m) => m + seg.meters!);

    const isLast = index >= protocol.segments.length - 1;
    if (isLast) {
      // El tiempo del último tramo ya está sumado arriba: se pone el reloj del
      // tramo a cero para que la pantalla de cierre no lo cuente dos veces.
      baseRef.current = 0;
      setSegElapsed(0);
      setRunning(false);
      setFinished(true);
      beep(true);
      return;
    }
    baseRef.current = 0;
    anchorRef.current = Date.now();
    setSegElapsed(0);
    setIndex((i) => i + 1);
    beep(false);
  }, [protocol.segments, index, segElapsed, beep]);

  // Reloj del tramo actual.
  useEffect(() => {
    if (!running || finished) return;
    const id = window.setInterval(() => {
      const elapsed = baseRef.current + (Date.now() - anchorRef.current) / 1000;
      setSegElapsed(elapsed);
    }, 200);
    return () => window.clearInterval(id);
  }, [running, finished, index]);

  // Fin de tramo por tiempo → siguiente. Los de distancia esperan al usuario.
  useEffect(() => {
    if (!running || finished || byDistance) return;
    if (segSeconds > 0 && segElapsed >= segSeconds) advance(true);
  }, [segElapsed, segSeconds, running, finished, byDistance, advance]);

  const start = () => {
    baseRef.current = segElapsed;
    anchorRef.current = Date.now();
    setRunning(true);
    // El primer toque es también lo que desbloquea el audio del navegador.
    beep(false);
  };

  const pause = () => {
    baseRef.current = baseRef.current + (Date.now() - anchorRef.current) / 1000;
    setRunning(false);
  };

  // Lo que se lleva hecho. En un tramo por tiempo no puede pasar de su
  // duración (el reloj sigue corriendo un instante antes de saltar); en uno por
  // distancia cuenta lo que marque el cronómetro, que es el único dato real.
  const spentHere = byDistance ? segElapsed : Math.min(segElapsed, segSeconds || segElapsed);
  const totalDone = doneSeconds + spentHere;
  const pct = totals.seconds > 0 ? Math.min(100, (totalDone / totals.seconds) * 100) : 0;

  const finishNow = (completed: boolean) => {
    onFinish({
      secondsDone: Math.max(0, Math.round(doneSeconds + spentHere)),
      segmentsDone: completed ? protocol.segments.length : index,
      completed,
      distanceMeters: doneMeters,
    });
  };

  // ── Pantalla de cierre ──
  if (finished) {
    return (
      <Shell onClose={onExit} title={protocol.name}>
        <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 mb-4 flex items-center justify-center rounded-2xl bg-green-500/12 border border-green-500/30 text-green-400">
            <i className="ri-flag-line text-3xl" />
          </div>
          <h3 className="rk-h3" style={{ fontSize: '1.3rem', color: '#fff' }}>{t('mc_pt_done_title')}</h3>
          <p className="text-sm text-zinc-400 mt-2 leading-relaxed max-w-xs">{t('mc_pt_done_sub')}</p>

          <div className="grid grid-cols-3 gap-2 w-full max-w-xs mt-6">
            <Stat value={clock(doneSeconds)} label={t('mc_pt_stat_time')} />
            <Stat value={`${index + 1}/${protocol.segments.length}`} label={t('mc_pt_stat_segments')} />
            <Stat value={doneMeters > 0 ? `${doneMeters} m` : '—'} label={t('mc_pt_stat_distance')} />
          </div>

          <button onClick={() => finishNow(true)} disabled={saving}
            className="rk-btn rk-btn-primary w-full max-w-xs mt-7 flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ minHeight: 50 }}>
            {saving
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('mc_saving')}</>
              : <><i className="ri-check-line" />{t('mc_pt_save_session')}</>}
          </button>
          <button onClick={onExit} disabled={saving}
            className="text-xs text-zinc-500 hover:text-white cursor-pointer mt-3" style={{ minHeight: 44 }}>
            {t('mc_pt_discard_run')}
          </button>
        </div>
      </Shell>
    );
  }

  if (!segment) {
    return (
      <Shell onClose={onExit} title={protocol.name}>
        <div className="flex-1 flex items-center justify-center px-6 text-center">
          <p className="text-sm text-zinc-400">{t('mc_pt_empty_protocol')}</p>
        </div>
      </Shell>
    );
  }

  const highlight = new Set(changedVars(protocol.segments[index - 1], segment));

  return (
    <Shell onClose={() => (running || segElapsed > 0 ? setConfirmExit(true) : onExit())} title={protocol.name}>
      {/* Progreso global */}
      <div className="px-5 pt-3 flex-shrink-0">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--s-3)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] text-zinc-500">
            {t('mc_pt_segment_of', { n: index + 1, total: protocol.segments.length })}
          </span>
          <span className="text-[11px] text-zinc-500">{clock(totalDone)} / {clock(totals.seconds)}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* ── LO QUE TOCA AHORA ── */}
        <div className="rk-card text-center" style={{ padding: '22px 16px', borderColor: 'rgba(225,6,0,0.3)' }}>
          {segment.label && (
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-3">{segment.label}</p>
          )}

          <div className={`grid gap-3 ${vars.length > 2 ? 'grid-cols-3' : vars.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {vars.map((v) => {
              const val = segment.values[v.id];
              const on = highlight.has(v.id);
              return (
                <div key={v.id} className="rounded-xl px-2 py-3"
                  style={{
                    background: on ? 'rgba(225,6,0,0.12)' : 'var(--s-2)',
                    border: `1px solid ${on ? 'rgba(225,6,0,0.4)' : 'var(--s-3)'}`,
                  }}>
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(34px,11vw,56px)', lineHeight: 0.95, color: '#fff', margin: 0 }}>
                    {val === undefined ? '—' : formatVarValue(v, val)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1.5 leading-tight">
                    {t(v.labelKey)}{v.unit ? ` · ${v.unit}` : ''}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Cuánto queda */}
          <div className="mt-5">
            {byDistance ? (
              <>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, lineHeight: 1, color: 'var(--t-1)' }}>
                  {segment.meters} m
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">{t('mc_pt_distance_manual')}</p>
              </>
            ) : (
              <>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, lineHeight: 1, color: remaining <= 10 ? '#ff6b66' : 'var(--t-1)' }}>
                  {clock(remaining)}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">{t('mc_pt_remaining')}</p>
              </>
            )}
          </div>

          {segment.note && (
            <p className="text-xs text-zinc-400 mt-3 leading-relaxed">{segment.note}</p>
          )}
        </div>

        {/* ── LO QUE VIENE ── */}
        <div className="rk-card mt-3 flex items-center gap-3" style={{ padding: '14px 16px' }}>
          <i className="ri-skip-forward-line text-zinc-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">{t('mc_pt_next')}</p>
            {next ? (
              <>
                <p className="text-sm font-semibold text-white truncate">
                  {next.label ? `${next.label} · ` : ''}{valuesLine(next, vars) || (next.meters ? `${next.meters} m` : clock(next.seconds))}
                </p>
                {!byDistance && (
                  <p className="text-[11px] text-zinc-500">{t('mc_pt_in_time', { time: clock(remaining) })}</p>
                )}
              </>
            ) : (
              <p className="text-sm font-semibold text-white">{t('mc_pt_last_segment')}</p>
            )}
          </div>
        </div>

        {/* ── El protocolo entero, plegado ── */}
        <button onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}
          className="w-full mt-3 flex items-center justify-between gap-2 rounded-xl px-3.5 text-xs font-semibold text-zinc-300 bg-white/[0.03] border border-white/10 hover:border-white/25 cursor-pointer transition-colors"
          style={{ minHeight: 44 }}>
          <span className="flex items-center gap-1.5"><i className="ri-list-check-2 text-zinc-500" />{t('mc_pt_show_all')}</span>
          <i className={`ri-arrow-down-s-line transition-transform ${showAll ? 'rotate-180' : ''}`} />
        </button>

        {showAll && (
          <div className="mt-2 rk-card overflow-hidden" style={{ padding: 0 }}>
            {protocol.segments.map((s, i) => (
              <div key={s.id}
                className={`flex items-center gap-3 px-3 py-2.5 ${i > 0 ? 'border-t border-white/[0.05]' : ''}`}
                style={{ background: i === index ? 'rgba(225,6,0,0.08)' : undefined }}>
                <span className="text-[11px] text-zinc-500 flex-shrink-0 tabular-nums" style={{ width: 44 }}>
                  {clock(starts[i])}
                </span>
                <span className={`flex-1 min-w-0 text-xs truncate ${i === index ? 'text-white font-semibold' : 'text-zinc-400'}`}>
                  {s.label ? `${s.label} · ` : ''}{valuesLine(s, vars) || '—'}
                </span>
                <span className="text-[11px] text-zinc-600 flex-shrink-0">
                  {s.meters ? `${s.meters} m` : clock(s.seconds)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Controles ── */}
      <div className="px-5 py-4 border-t border-white/[0.07] flex-shrink-0 space-y-2"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex gap-2">
          {running ? (
            <button onClick={pause} className="rk-nav-btn flex-1 flex items-center justify-center gap-2 text-sm"
              style={{ minHeight: 52 }}>
              <i className="ri-pause-line" />{t('mc_pt_pause')}
            </button>
          ) : (
            <button onClick={start} className="rk-btn rk-btn-primary flex-1 flex items-center justify-center gap-2"
              style={{ minHeight: 52, fontSize: '1rem' }}>
              <i className="ri-play-fill" />{segElapsed > 0 || index > 0 ? t('mc_pt_resume') : t('mc_pt_start')}
            </button>
          )}
          <button onClick={() => advance(false)}
            className="rk-nav-btn flex items-center justify-center gap-2 text-sm px-4"
            style={{ minHeight: 52 }}>
            <i className="ri-skip-forward-line" />
            <span className="hidden sm:inline">{byDistance ? t('mc_pt_done_segment') : t('mc_pt_skip')}</span>
          </button>
        </div>
        <button onClick={() => setConfirmExit(true)}
          className="w-full text-xs text-zinc-500 hover:text-white cursor-pointer" style={{ minHeight: 40 }}>
          {t('mc_pt_finish_early')}
        </button>
      </div>

      {/* Salir a medias: se ofrece guardar lo hecho en vez de tirarlo. */}
      {confirmExit && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-5" style={{ background: 'rgba(3,3,3,0.85)' }}>
          <div className="card-primary w-full max-w-xs text-center" style={{ padding: 24 }}>
            <h4 className="rk-h3" style={{ fontSize: '1.05rem', color: '#fff' }}>{t('mc_pt_exit_title')}</h4>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              {t('mc_pt_exit_desc', { time: clock(totalDone), n: index, total: protocol.segments.length })}
            </p>
            <button onClick={() => finishNow(false)} disabled={saving || totalDone < 30}
              className="rk-btn rk-btn-primary w-full mt-4 disabled:opacity-50" style={{ minHeight: 46, fontSize: '0.9rem' }}>
              {t('mc_pt_exit_save')}
            </button>
            {totalDone < 30 && (
              <p className="text-[10px] text-zinc-600 mt-1.5 leading-relaxed">{t('mc_pt_exit_too_short')}</p>
            )}
            <button onClick={onExit} className="w-full text-xs text-zinc-400 hover:text-red-400 cursor-pointer mt-3"
              style={{ minHeight: 42 }}>
              {t('mc_pt_exit_discard')}
            </button>
            <button onClick={() => setConfirmExit(false)} className="w-full text-xs text-zinc-500 hover:text-white cursor-pointer mt-1"
              style={{ minHeight: 42 }}>
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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl px-2 py-3 text-center" style={{ background: 'var(--s-2)', border: '1px solid var(--s-3)' }}>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(18px,5vw,24px)', lineHeight: 1, color: 'var(--t-1)', margin: 0 }}>{value}</p>
      <p className="rk-label" style={{ fontSize: 9, marginTop: 5 }}>{label}</p>
    </div>
  );
}

/** Marco a pantalla completa: mientras se entrena no compite nada más. */
function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex flex-col rk-screen-bg"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07] flex-shrink-0">
        <div className="min-w-0">
          <p className="rk-label" style={{ fontSize: 10 }}>{t('mc_pt_player_eyebrow')}</p>
          <h3 className="text-sm font-bold text-white truncate">{title}</h3>
        </div>
        <button onClick={onClose} aria-label={t('mc_close')}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer flex-shrink-0">
          <i className="ri-close-line" />
        </button>
      </div>
      {children}
    </div>
  );
}
