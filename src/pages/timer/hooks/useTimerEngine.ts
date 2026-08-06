import { useCallback, useEffect, useRef, useState } from 'react';
import { buildSchedule, type Segment, type SegmentType, type TimerConfig } from '../lib/session';
import { timerSounds } from '../lib/sounds';

export type Status = 'idle' | 'running' | 'paused' | 'done';

export interface EngineState {
  status: Status;
  segIndex: number;
  segType: SegmentType;
  round: number;          // asalto actual (1..N); 0 en preparación
  segRemaining: number;   // segundos restantes de la fase (entero, para mostrar)
  segDuration: number;
  elapsedTotal: number;   // segundos transcurridos de toda la sesión
  inBurst: boolean;
  burstRemaining: number; // segundos que quedan de la explosión en curso
}

const IDLE: EngineState = {
  status: 'idle', segIndex: 0, segType: 'prep', round: 0,
  segRemaining: 0, segDuration: 0, elapsedTotal: 0, inBurst: false, burstRemaining: 0,
};

// Motor del cronómetro. Trabaja con marcas de tiempo absolutas (Date.now) en
// lugar de ir restando 1 por tick: así, si el móvil ralentiza el temporizador
// en segundo plano, al volver recupera el tiempo real sin desfasarse.
export function useTimerEngine(config: TimerConfig, muted: boolean) {
  const [state, setState] = useState<EngineState>(IDLE);
  const [schedule, setSchedule] = useState<Segment[]>([]);

  // Instancia compartida: se desbloquea desde el gesto de "Empezar" (page.tsx),
  // no aquí, para que el audio funcione en iOS/Safari (ver lib/sounds.ts).
  const soundsRef = useRef(timerSounds);
  const scheduleRef = useRef<Segment[]>([]);
  const segIndexRef = useRef(0);
  const segEndAtRef = useRef(0);     // ms absolutos en que acaba la fase
  const remainingRef = useRef(0);    // segundos guardados al pausar
  const statusRef = useRef<Status>('idle');
  const prevSecRef = useRef(-1);
  const inBurstRef = useRef(false);
  const tenWarnedRef = useRef(false); // aviso de 10 s ya dado en este asalto

  useEffect(() => { soundsRef.current.muted = muted; }, [muted]);

  const enterSegment = useCallback((index: number) => {
    const sch = scheduleRef.current;
    const seg = sch[index];
    segIndexRef.current = index;
    segEndAtRef.current = Date.now() + seg.durationSec * 1000;
    prevSecRef.current = seg.durationSec;
    inBurstRef.current = false;
    tenWarnedRef.current = false;
    // Señal de entrada según la fase.
    const s = soundsRef.current;
    if (seg.type === 'round') s.roundStart();
    else if (seg.type === 'rest') s.restStart();
  }, []);

  const publish = useCallback((remaining: number) => {
    const sch = scheduleRef.current;
    const seg = sch[segIndexRef.current];
    if (!seg) return;
    const elapsedInSeg = seg.durationSec - remaining;
    // ¿Dentro de una ventana de explosión?
    const win = seg.type === 'round'
      ? seg.bursts.find((b) => elapsedInSeg >= b.startSec && elapsedInSeg < b.endSec)
      : undefined;
    setState({
      status: statusRef.current,
      segIndex: segIndexRef.current,
      segType: seg.type,
      round: seg.round,
      segRemaining: Math.max(0, Math.ceil(remaining - 0.0001)),
      segDuration: seg.durationSec,
      elapsedTotal: seg.startAt + elapsedInSeg,
      inBurst: !!win,
      burstRemaining: win ? Math.ceil(win.endSec - elapsedInSeg) : 0,
    });
  }, []);

  // Bucle principal
  useEffect(() => {
    const id = setInterval(() => {
      if (statusRef.current !== 'running') return;
      const now = Date.now();
      const sch = scheduleRef.current;
      const seg = sch[segIndexRef.current];
      if (!seg) return;
      let remaining = (segEndAtRef.current - now) / 1000;

      // Cambio de fase
      if (remaining <= 0) {
        const nextIndex = segIndexRef.current + 1;
        // Fin de la sesión: la campana triple final ya cierra el último asalto.
        if (nextIndex >= sch.length) {
          statusRef.current = 'done';
          soundsRef.current.finish();
          setState((st) => ({ ...st, status: 'done', segRemaining: 0, elapsedTotal: sch.reduce((a, s) => a + s.durationSec, 0), inBurst: false, burstRemaining: 0 }));
          return;
        }
        // Un asalto acaba de terminar → "ding-ding" de fin de asalto. Después,
        // enterSegment suena el inicio del descanso o del siguiente asalto.
        if (seg.type === 'round') soundsRef.current.roundEnd();
        enterSegment(nextIndex);
        remaining = sch[nextIndex].durationSec;
      }

      const cur = sch[segIndexRef.current];
      const secLeft = Math.ceil(remaining - 0.0001);
      const s = soundsRef.current;

      // Explosiones: señal al entrar (acelera) y al salir (vuelve al ritmo).
      const elapsedInSeg = cur.durationSec - remaining;
      const active = cur.type === 'round'
        && cur.bursts.some((b) => elapsedInSeg >= b.startSec && elapsedInSeg < b.endSec);
      if (active && !inBurstRef.current) s.accelerate();
      else if (!active && inBurstRef.current) s.easeOff();
      inBurstRef.current = active;

      if (cur.type === 'round' && secLeft !== prevSecRef.current) {
        // Aviso propio de "faltan 10 segundos": clacker distinto, una sola vez
        // por asalto e independiente del aviso configurable de cuenta atrás.
        if (!tenWarnedRef.current && secLeft === 10 && cur.durationSec > 10) {
          s.tenSeconds();
          tenWarnedRef.current = true;
        }
        // Cuenta atrás final (tic corto), fuera de explosión y sin pisar el
        // aviso de 10 s para que no se solapen.
        else if (!active && secLeft <= config.warnSec && secLeft >= 1) {
          s.warn();
        }
      }
      prevSecRef.current = secLeft;

      publish(remaining);
    }, 200);
    return () => clearInterval(id);
  }, [config.warnSec, enterSegment, publish]);

  const start = useCallback(() => {
    soundsRef.current.unlock();
    const sch = buildSchedule(config);
    scheduleRef.current = sch;
    setSchedule(sch);
    statusRef.current = 'running';
    enterSegment(0);
    publish(sch[0].durationSec);
  }, [config, enterSegment, publish]);

  const pause = useCallback(() => {
    if (statusRef.current !== 'running') return;
    remainingRef.current = Math.max(0, (segEndAtRef.current - Date.now()) / 1000);
    statusRef.current = 'paused';
    setState((st) => ({ ...st, status: 'paused' }));
  }, []);

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return;
    soundsRef.current.unlock();
    segEndAtRef.current = Date.now() + remainingRef.current * 1000;
    statusRef.current = 'running';
    setState((st) => ({ ...st, status: 'running' }));
  }, []);

  const reset = useCallback(() => {
    statusRef.current = 'idle';
    segIndexRef.current = 0;
    inBurstRef.current = false;
    prevSecRef.current = -1;
    scheduleRef.current = [];
    setSchedule([]);
    setState(IDLE);
  }, []);

  return { state, schedule, start, pause, resume, reset, sounds: soundsRef.current };
}
