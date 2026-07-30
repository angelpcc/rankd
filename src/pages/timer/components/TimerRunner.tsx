import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTimerEngine } from '../hooks/useTimerEngine';
import { useWakeLock } from '../hooks/useWakeLock';
import { fmt, fmtLong, totalWorkSeconds, type TimerConfig } from '../lib/session';
import { roundComboParts } from '../lib/combos';
import SessionTimeline from './SessionTimeline';

interface Props {
  config: TimerConfig;
  muted: boolean;
  onToggleMute: () => void;
  onExit: () => void;
  onSaveToDiary: () => Promise<boolean>;
}

// Colores por fase para reconocer el estado de un vistazo, sin leer.
const PHASE = {
  prep: { key: 'tm_phase_prep', color: '#C9A84C', tint: 'rgba(201,168,76,0.14)' },
  round: { key: 'tm_phase_round', color: '#E10600', tint: 'rgba(225,6,0,0.16)' },
  rest: { key: 'tm_phase_rest', color: '#22c55e', tint: 'rgba(34,197,94,0.16)' },
  burst: { key: 'tm_phase_burst', color: '#fb923c', tint: 'rgba(251,146,60,0.28)' },
  done: { key: 'tm_phase_done', color: '#C9A84C', tint: 'rgba(201,168,76,0.14)' },
};

export default function TimerRunner({ config, muted, onToggleMute, onExit, onSaveToDiary }: Props) {
  const { t } = useTranslation();
  const { state, schedule, start, pause, resume, reset } = useTimerEngine(config, muted);
  const running = state.status === 'running';
  const { supported: wakeSupported } = useWakeLock(running);

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Arranca al montar (venimos de pulsar "Empezar" en la configuración).
  useEffect(() => {
    start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isBurst = state.inBurst && state.segType === 'round';
  const phase = state.status === 'done' ? PHASE.done
    : isBurst ? PHASE.burst
    : PHASE[state.segType];

  // Combinación a mostrar: durante el asalto la suya; en descanso/preparación,
  // la del asalto que viene.
  const displayRound = state.segType === 'round' ? state.round
    : state.segType === 'rest' ? state.round + 1
    : 1;
  const rc = config.combos[displayRound - 1] ?? null;
  const parts = roundComboParts(rc);
  const comboLabel = parts.text || parts.moves.map((m) => t(`tm_move_${m}`, m)).join(' · ');
  const showCombo = state.status !== 'done' && !!rc && comboLabel;

  const segProgress = state.segDuration > 0 ? (state.segDuration - state.segRemaining) / state.segDuration : 0;
  const R = 130;
  const circ = 2 * Math.PI * R;

  const totalBursts = useMemo(
    () => schedule.reduce((a, s) => a + s.bursts.length, 0),
    [schedule],
  );

  const doSave = async () => {
    if (saveState !== 'idle') return;
    setSaveState('saving');
    const ok = await onSaveToDiary();
    setSaveState(ok ? 'saved' : 'idle');
  };

  const restart = () => { reset(); setSaveState('idle'); setTimeout(start, 40); };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden select-none rk-safe-top"
      style={{
        background: `radial-gradient(ellipse at 50% 30%, ${phase.tint} 0%, transparent 62%), #060606`,
        transition: 'background 0.4s ease',
      }}>
      {/* Marco que parpadea en explosión */}
      {isBurst && (
        <div className="absolute inset-0 pointer-events-none anim-pulse-glow" style={{ boxShadow: `inset 0 0 0 4px ${PHASE.burst.color}`, borderRadius: 2 }} />
      )}

      {/* Barra superior */}
      <div className="relative flex items-center justify-between px-4 sm:px-6 h-14 flex-shrink-0">
        <button onClick={onExit} className="w-11 h-11 flex items-center justify-center rounded-full bg-white/8 border border-white/12 text-zinc-300 hover:text-white cursor-pointer" aria-label={t('tm_exit')}>
          <i className="ri-arrow-left-line text-xl"></i>
        </button>
        <div className="flex items-center gap-2">
          {!wakeSupported && running && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-orange-300/80"><i className="ri-error-warning-line"></i></span>
          )}
          <button onClick={onToggleMute} className="w-11 h-11 flex items-center justify-center rounded-full bg-white/8 border border-white/12 text-zinc-300 hover:text-white cursor-pointer" aria-label={muted ? t('tm_unmute') : t('tm_mute')}>
            <i className={muted ? 'ri-volume-mute-line text-xl' : 'ri-volume-up-line text-xl'}></i>
          </button>
        </div>
      </div>

      {/* Aviso de bloqueo de pantalla no soportado */}
      {!wakeSupported && running && (
        <p className="relative text-center text-[11px] text-orange-300/80 px-6 -mt-1 mb-1 flex items-center justify-center gap-1.5">
          <i className="ri-error-warning-line"></i>{t('tm_wake_unsupported')}
        </p>
      )}

      {state.status === 'done' ? (
        <DoneScreen
          config={config} totalBursts={totalBursts} saveState={saveState}
          onSave={doSave} onAgain={restart} onExit={onExit}
        />
      ) : (
        <div className="relative flex-1 flex flex-col items-center justify-center px-4 min-h-0">
          {/* Fase */}
          <div className="text-center mb-2">
            <p className="font-bold uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.28em', fontSize: 'clamp(15px,4vw,22px)', color: phase.color }}>
              {isBurst ? t('tm_phase_burst') : state.segType === 'round' ? `${t('tm_phase_round')} ${state.round}` : t(phase.key)}
            </p>
          </div>

          {/* Reloj */}
          <div className="relative flex items-center justify-center" style={{ width: 'min(78vw, 340px)', height: 'min(78vw, 340px)' }}>
            <svg className="absolute inset-0 -rotate-90 w-full h-full" viewBox="0 0 300 300">
              <circle cx="150" cy="150" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="12" />
              <circle cx="150" cy="150" r={R} fill="none" stroke={phase.color} strokeWidth="12" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={circ - segProgress * circ}
                style={{ transition: 'stroke-dashoffset 0.25s linear, stroke 0.3s' }} />
            </svg>
            <div className="text-center">
              <p className="tabular-nums" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(72px,20vw,120px)', lineHeight: 1, color: '#fff', letterSpacing: 2 }}>
                {fmt(state.segRemaining)}
              </p>
              <p className="text-zinc-500 text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                {state.segType === 'prep' ? t('tm_get_ready') : t('tm_round_of', { n: displayRound, total: config.rounds })}
              </p>
            </div>
          </div>

          {/* Señal de explosión */}
          {isBurst && (
            <div className="mt-4 anim-scale-in">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white font-bold uppercase tracking-wider" style={{ background: PHASE.burst.color, fontSize: 'clamp(13px,3.5vw,16px)' }}>
                <i className="ri-flashlight-fill"></i>{t('tm_phase_burst')}
              </span>
            </div>
          )}

          {/* Combinación del asalto */}
          {showCombo && !isBurst && (
            <div className="mt-5 max-w-lg text-center px-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
                {state.segType === 'round' ? t('tm_combo_this_round') : t('tm_next_up')}
              </p>
              <p className="text-white font-semibold leading-snug" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 'clamp(18px,5vw,26px)' }}>
                {comboLabel}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Línea de tiempo + controles */}
      {state.status !== 'done' && (
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
              <div className="w-14 h-14" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DoneScreen({ config, totalBursts, saveState, onSave, onAgain, onExit }: {
  config: TimerConfig; totalBursts: number; saveState: 'idle' | 'saving' | 'saved';
  onSave: () => void; onAgain: () => void; onExit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative flex-1 flex flex-col items-center justify-center px-6 text-center min-h-0 overflow-y-auto py-6">
      <div className="w-20 h-20 flex items-center justify-center rounded-3xl bg-[#C9A84C]/12 border border-[#C9A84C]/35 anim-float mb-5">
        <i className="ri-checkbox-circle-line text-5xl text-[#C9A84C]"></i>
      </div>
      <h1 className="rk-h1" style={{ color: '#fff', margin: 0 }}>{t('tm_done_title')}</h1>
      <p className="text-zinc-400 text-sm mt-2 max-w-xs">{t('tm_done_sub')}</p>

      <div className="grid grid-cols-3 gap-3 mt-6 w-full max-w-sm">
        <Stat value={String(config.rounds)} label={t('tm_done_rounds')} color="#E10600" />
        <Stat value={fmtLong(totalWorkSeconds(config))} label={t('tm_done_worked')} />
        <Stat value={String(totalBursts)} label={t('tm_done_bursts')} color="#fb923c" />
      </div>

      <div className="w-full max-w-sm mt-7 space-y-2.5">
        {saveState === 'saved' ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-green-500/12 border border-green-500/30 text-green-300 py-3.5 text-sm font-semibold">
            <i className="ri-check-double-line text-lg"></i>{t('tm_saved_diary')}
          </div>
        ) : (
          <button onClick={onSave} disabled={saveState === 'saving'}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-2xl py-3.5 cursor-pointer transition-colors disabled:opacity-60"
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 19, letterSpacing: 1.5 }}>
            {saveState === 'saving'
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('tm_saving')}</>
              : <><i className="ri-save-line text-xl"></i>{t('tm_save_diary')}</>}
          </button>
        )}
        <div className="flex gap-2.5">
          <button onClick={onAgain} className="flex-1 flex items-center justify-center gap-2 bg-white/6 border border-white/14 text-white rounded-2xl py-3 cursor-pointer hover:bg-white/10 transition-colors text-sm font-semibold">
            <i className="ri-refresh-line"></i>{t('tm_again')}
          </button>
          <button onClick={onExit} className="flex-1 flex items-center justify-center gap-2 bg-white/6 border border-white/14 text-white rounded-2xl py-3 cursor-pointer hover:bg-white/10 transition-colors text-sm font-semibold">
            <i className="ri-logout-box-line"></i>{t('tm_exit')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, color = '#fff' }: { value: string; label: string; color?: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 px-2 py-4">
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(22px,6vw,30px)', lineHeight: 1, color }}>{value}</p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
