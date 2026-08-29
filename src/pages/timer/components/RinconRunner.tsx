import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTimerEngine } from '../hooks/useTimerEngine';
import { useWakeLock } from '../hooks/useWakeLock';
import { useSpeech } from '../hooks/useSpeech';
import { DEFAULT_BURST, fmt, fmtLong, type TimerConfig } from '../lib/session';
import {
  activeCombos, comboSpeech, pickNext,
  type RinconCombo, type RinconConfig,
} from '../lib/rincon';
import SessionTimeline from './SessionTimeline';

export interface RinconSummary {
  rounds: number;
  workSec: number;
  roundSec: number;
  combos: string[];
}

interface Props {
  config: RinconConfig;
  combos: RinconCombo[];
  muted: boolean;
  onToggleMute: () => void;
  onExit: () => void;
  onSaveActivity: (s: RinconSummary) => Promise<boolean>;
}

const PHASE = {
  prep: { color: '#C9A84C', tint: 'rgba(201,168,76,0.14)' },
  round: { color: '#E10600', tint: 'rgba(225,6,0,0.16)' },
  rest: { color: '#22c55e', tint: 'rgba(34,197,94,0.16)' },
  done: { color: '#C9A84C', tint: 'rgba(201,168,76,0.14)' },
};

export default function RinconRunner({ config, combos, muted, onToggleMute, onExit, onSaveActivity }: Props) {
  const { t } = useTranslation();

  const engineCfg: TimerConfig = useMemo(() => ({
    rounds: config.rounds,
    roundSec: config.roundSec,
    restSec: config.restSec,
    prepSec: 10,
    warnSec: 10,
    burst: { ...DEFAULT_BURST, enabled: false },
    combos: [],
  }), [config]);

  const { state, schedule, start, pause, resume, reset } = useTimerEngine(engineCfg, muted);
  const running = state.status === 'running';
  const { supported: wakeSupported } = useWakeLock(running);
  const speech = useSpeech(muted);

  const pool = useMemo(() => activeCombos(combos, config), [combos, config]);
  const poolRef = useRef(pool);
  useEffect(() => { poolRef.current = pool; }, [pool]);

  const [current, setCurrent] = useState<RinconCombo | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const prevIdRef = useRef<string | null>(null);
  const roundRef = useRef(0);
  const lastFireRef = useRef(-999);
  const announcedRef = useRef<RinconCombo[]>([]);

  // Arranca al montar (venimos de "Empezar asalto").
  useEffect(() => {
    start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fire = useCallback((round: number, elapsed: number) => {
    const combo = pickNext(poolRef.current, prevIdRef.current);
    if (!combo) return;
    prevIdRef.current = combo.id;
    lastFireRef.current = elapsed;
    announcedRef.current.push(combo);
    setCurrent(combo);
    speech.speak(comboSpeech(combo, t));
    void round;
  }, [speech, t]);

  // Motor de anuncios: al empezar cada asalto y cada freqSec dentro de él.
  useEffect(() => {
    if (state.status === 'done') { speech.stop(); return; }
    if (state.status !== 'running') return;
    if (state.segType !== 'round') return;
    const elapsed = state.segDuration - state.segRemaining;
    if (state.round !== roundRef.current) {
      roundRef.current = state.round;
      lastFireRef.current = -999;
      fire(state.round, 0);
      return;
    }
    if (elapsed - lastFireRef.current >= config.freqSec && state.segRemaining > 3) {
      fire(state.round, elapsed);
    }
  }, [state, config.freqSec, fire, speech]);

  const skipNext = () => {
    if (state.segType !== 'round' || !running) return;
    fire(state.round, state.segDuration - state.segRemaining);
  };

  const phase = state.status === 'done' ? PHASE.done : PHASE[state.segType as keyof typeof PHASE] ?? PHASE.round;
  const segProgress = state.segDuration > 0 ? (state.segDuration - state.segRemaining) / state.segDuration : 0;
  const R = 130;
  const circ = 2 * Math.PI * R;
  const finalCountdown = state.segType === 'round' && state.segRemaining <= 10 && state.segRemaining > 0;
  const phaseKey = `${state.status}-${state.segType}-${state.round}`;

  const restart = () => {
    reset(); setSaveState('idle'); setCurrent(null);
    prevIdRef.current = null; roundRef.current = 0; lastFireRef.current = -999; announcedRef.current = [];
    setTimeout(start, 40);
  };

  const doSave = async () => {
    if (saveState !== 'idle') return;
    setSaveState('saving');
    const names = [...new Set(announcedRef.current.map((c) => comboSpeech(c, t)))];
    const ok = await onSaveActivity({
      rounds: config.rounds,
      workSec: config.rounds * config.roundSec,
      roundSec: config.roundSec,
      combos: names,
    });
    setSaveState(ok ? 'saved' : 'idle');
  };

  if (state.status === 'done') {
    // Resumen de combos cantados con recuento (se calcula al pintar la pantalla
    // final; announcedRef ya no cambia una vez terminada la sesión).
    const tally = new Map<string, { combo: RinconCombo; n: number }>();
    announcedRef.current.forEach((c) => {
      const e = tally.get(c.id);
      if (e) e.n += 1; else tally.set(c.id, { combo: c, n: 1 });
    });
    const announcedList = [...tally.values()].sort((a, b) => b.n - a.n);
    return (
      <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto rk-safe-top"
        style={{ background: `radial-gradient(ellipse at 50% 20%, ${PHASE.done.tint} 0%, transparent 60%), #060606` }}>
        <div className="flex-1 flex flex-col items-center px-5 py-8 text-center max-w-md mx-auto w-full">
          <div className="w-20 h-20 flex items-center justify-center rounded-3xl bg-[#C9A84C]/12 border border-[#C9A84C]/35 anim-float mb-5">
            <i className="ri-checkbox-circle-line text-5xl text-[#C9A84C]"></i>
          </div>
          <h1 className="rk-h1" style={{ color: '#fff', margin: 0 }}>{t('tm_rc_done_title')}</h1>
          <p className="text-zinc-400 text-sm mt-2">{t('tm_rc_done_sub')}</p>

          <div className="grid grid-cols-3 gap-3 mt-6 w-full">
            <Stat value={String(config.rounds)} label={t('tm_done_rounds')} color="#E10600" />
            <Stat value={String(announcedRef.current.length)} label={t('tm_rc_done_calls')} />
            <Stat value={fmtLong(config.rounds * config.roundSec)} label={t('tm_done_worked')} />
          </div>

          {announcedList.length > 0 && (
            <div className="w-full mt-6 text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-2">{t('tm_rc_done_combos')}</p>
              <div className="space-y-1.5">
                {announcedList.map(({ combo, n }) => (
                  <div key={combo.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/10 px-3.5 py-2.5">
                    <span className="text-white flex-shrink-0" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1 }}>{combo.notation}</span>
                    <span className="text-xs text-zinc-400 flex-1 min-w-0 truncate">{comboSpeech(combo, t)}</span>
                    {n > 1 && <span className="text-[11px] font-bold text-zinc-500 flex-shrink-0">×{n}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="w-full mt-7 space-y-2.5">
            {saveState === 'saved' ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-green-500/12 border border-green-500/30 text-green-300 py-3.5 text-sm font-semibold">
                <i className="ri-check-double-line text-lg"></i>{t('tm_rc_saved_activity')}
              </div>
            ) : (
              <button onClick={doSave} disabled={saveState === 'saving'}
                className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-2xl py-3.5 cursor-pointer transition-colors disabled:opacity-60"
                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 19, letterSpacing: 1.5 }}>
                {saveState === 'saving'
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('tm_saving')}</>
                  : <><i className="ri-save-line text-xl"></i>{t('tm_rc_save_activity')}</>}
              </button>
            )}
            <div className="flex gap-2.5">
              <button onClick={restart} className="flex-1 flex items-center justify-center gap-2 bg-white/6 border border-white/14 text-white rounded-2xl py-3 cursor-pointer hover:bg-white/10 transition-colors text-sm font-semibold">
                <i className="ri-refresh-line"></i>{t('tm_again')}
              </button>
              <button onClick={onExit} className="flex-1 flex items-center justify-center gap-2 bg-white/6 border border-white/14 text-white rounded-2xl py-3 cursor-pointer hover:bg-white/10 transition-colors text-sm font-semibold">
                <i className="ri-logout-box-line"></i>{t('tm_exit')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const roundLabel = state.segType === 'round'
    ? `${t('tm_phase_round')} ${state.round}`
    : state.segType === 'rest' ? t('tm_phase_rest') : t('tm_phase_prep');

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden select-none rk-safe-top"
      style={{ background: `radial-gradient(ellipse at 50% 30%, ${phase.tint} 0%, transparent 62%), #060606`, transition: 'background 0.4s ease' }}>
      <div key={phaseKey} className="tm-flash absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 42%, ${phase.color}55 0%, transparent 62%)` }} />

      {/* Barra superior */}
      <div className="relative flex items-center justify-between px-4 sm:px-6 h-14 flex-shrink-0">
        <button onClick={onExit} className="w-11 h-11 flex items-center justify-center rounded-full bg-white/8 border border-white/12 text-zinc-300 hover:text-white cursor-pointer" aria-label={t('tm_exit')}>
          <i className="ri-arrow-left-line text-xl"></i>
        </button>
        <div className="flex items-center gap-2">
          {!speech.supported && (
            <span className="text-[10px] text-orange-300/80 flex items-center gap-1"><i className="ri-volume-mute-line"></i>{t('tm_rc_voice_off')}</span>
          )}
          <button onClick={onToggleMute} className="w-11 h-11 flex items-center justify-center rounded-full bg-white/8 border border-white/12 text-zinc-300 hover:text-white cursor-pointer" aria-label={muted ? t('tm_unmute') : t('tm_mute')}>
            <i className={muted ? 'ri-volume-mute-line text-xl' : 'ri-volume-up-line text-xl'}></i>
          </button>
        </div>
      </div>

      {!wakeSupported && running && (
        <p className="relative text-center text-[11px] text-orange-300/80 px-6 -mt-1 mb-1 flex items-center justify-center gap-1.5">
          <i className="ri-error-warning-line"></i>{t('tm_wake_unsupported')}
        </p>
      )}
      {speech.supported && !speech.hasEsVoice && running && (
        <p className="relative text-center text-[11px] text-orange-300/80 px-6 flex items-center justify-center gap-1.5">
          <i className="ri-information-line"></i>{t('tm_rc_no_es_voice')}
        </p>
      )}

      <div className="relative flex-1 flex flex-col items-center justify-center px-4 min-h-0">
        <div key={`lbl-${phaseKey}`} className="text-center mb-2 tm-phase-in">
          <p className="font-bold uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.28em', fontSize: 'clamp(15px,4vw,22px)', color: phase.color, textShadow: `0 0 24px ${phase.color}88` }}>
            {roundLabel}
          </p>
        </div>

        <div className="relative flex items-center justify-center" style={{ width: 'min(74vw, 320px)', height: 'min(74vw, 320px)' }}>
          <svg className="absolute inset-0 -rotate-90 w-full h-full" viewBox="0 0 300 300" style={{ filter: `drop-shadow(0 0 10px ${phase.color}66)` }}>
            <circle cx="150" cy="150" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="12" />
            <circle cx="150" cy="150" r={R} fill="none" stroke={phase.color} strokeWidth="12" strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={circ - segProgress * circ}
              style={{ transition: 'stroke-dashoffset 0.25s linear, stroke 0.3s' }} />
          </svg>
          <div className="text-center">
            <p className={`tabular-nums ${finalCountdown ? 'tm-tick' : ''}`}
              style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(64px,18vw,110px)', lineHeight: 1, color: finalCountdown ? phase.color : '#fff', letterSpacing: 2 }}>
              {fmt(state.segRemaining)}
            </p>
            <p className="text-zinc-500 text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {state.segType === 'prep' ? t('tm_get_ready') : t('tm_round_of', { n: Math.max(1, state.round), total: config.rounds })}
            </p>
          </div>
        </div>

        {/* Combo cantado */}
        <div className="mt-5 w-full max-w-lg px-2 min-h-[92px]">
          {current && state.segType === 'round' ? (
            <div key={current.id + '-' + announcedRef.current.length} className="anim-scale-in rounded-2xl border px-4 py-3.5 text-center"
              style={{ borderColor: 'rgba(225,6,0,0.4)', background: 'rgba(225,6,0,0.09)' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] mb-1" style={{ color: '#ff6b66' }}>{t('tm_rc_call_out')}</p>
              <p className="text-white font-bold leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 'clamp(24px,7vw,40px)', letterSpacing: 0.3 }}>
                {comboSpeech(current, t)}
              </p>
              <p className="text-zinc-500 mt-1" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 2 }}>{current.notation}</p>
            </div>
          ) : (
            <p className="text-center text-zinc-600 text-sm pt-6">
              {state.segType === 'rest' ? t('tm_rc_rest_hint') : t('tm_rc_waiting')}
            </p>
          )}
        </div>
      </div>

      {/* Controles */}
      <div className="relative flex-shrink-0 px-4 sm:px-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        <div className="max-w-3xl mx-auto">
          <SessionTimeline schedule={schedule} elapsedTotal={state.elapsedTotal} live />
          <div className="flex items-center justify-center gap-4 mt-5">
            <button onClick={restart} className="w-14 h-14 flex items-center justify-center rounded-full bg-white/8 border border-white/14 text-zinc-300 hover:text-white cursor-pointer active:scale-95 transition-transform" aria-label={t('tm_reset')}>
              <i className="ri-restart-line text-2xl"></i>
            </button>
            {running ? (
              <button onClick={pause} className="w-20 h-20 flex items-center justify-center rounded-full bg-white text-black cursor-pointer active:scale-95 transition-transform shadow-xl" aria-label={t('tm_pause')}>
                <i className="ri-pause-fill text-4xl"></i>
              </button>
            ) : (
              <button onClick={resume} className="w-20 h-20 flex items-center justify-center rounded-full bg-red-600 text-white cursor-pointer active:scale-95 transition-transform shadow-xl shadow-red-600/40" aria-label={t('tm_resume')}>
                <i className="ri-play-fill text-4xl ml-1"></i>
              </button>
            )}
            <button onClick={skipNext} disabled={state.segType !== 'round' || !running}
              className="w-14 h-14 flex items-center justify-center rounded-full bg-white/8 border border-white/14 text-zinc-300 hover:text-white cursor-pointer active:scale-95 transition-transform disabled:opacity-30"
              aria-label={t('tm_rc_skip_combo')}>
              <i className="ri-skip-forward-line text-2xl"></i>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tm-flash { 0% { opacity: 0.85; transform: scale(1.06); } 100% { opacity: 0; transform: scale(1); } }
        .tm-flash { animation: tm-flash 0.6s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes tm-phase-in { 0% { opacity: 0; transform: translateY(8px) scale(0.94); letter-spacing: 0.4em; } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        .tm-phase-in { animation: tm-phase-in 0.5s cubic-bezier(0.22,1,0.36,1); }
        @keyframes tm-tick { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        .tm-tick { animation: tm-tick 1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .tm-flash, .tm-phase-in, .tm-tick { animation: none !important; } }
      `}</style>
    </div>
  );
}

function Stat({ value, label, color = '#fff' }: { value: string; label: string; color?: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 px-2 py-4">
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(20px,5.5vw,28px)', lineHeight: 1, color }}>{value}</p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
