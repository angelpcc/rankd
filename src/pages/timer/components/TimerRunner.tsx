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

  // Clave que cambia en cada cambio de fase → re-monta elementos para relanzar
  // sus animaciones de entrada (flash a pantalla completa, título, reloj).
  const phaseKey = `${state.status}-${state.segType}-${state.round}-${isBurst}`;
  // Cuenta atrás final: el reloj late y se tiñe en los últimos segundos.
  const finalCountdown = state.segType === 'round' && !isBurst && state.segRemaining <= 10 && state.segRemaining > 0;

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
      {/* Destello a pantalla completa en cada cambio de fase (premium). */}
      {state.status !== 'done' && (
        <div key={phaseKey} className="tm-flash absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% 42%, ${phase.color}55 0%, transparent 62%)` }} />
      )}

      {/* Marco que parpadea en explosión */}
      {isBurst && (
        <div className="absolute inset-0 pointer-events-none anim-pulse-glow" style={{ boxShadow: `inset 0 0 0 5px ${PHASE.burst.color}`, borderRadius: 2 }} />
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
          {/* Fase (re-entra con animación en cada cambio) */}
          <div key={`lbl-${phaseKey}`} className="text-center mb-2 tm-phase-in">
            <p className="font-bold uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.28em', fontSize: 'clamp(15px,4vw,22px)', color: phase.color, textShadow: `0 0 24px ${phase.color}88` }}>
              {isBurst ? t('tm_phase_burst') : state.segType === 'round' ? `${t('tm_phase_round')} ${state.round}` : t(phase.key)}
            </p>
          </div>

          {/* Reloj */}
          <div className="relative flex items-center justify-center" style={{ width: 'min(78vw, 340px)', height: 'min(78vw, 340px)' }}>
            {/* Halo del reloj, del color de la fase; se intensifica en explosión. */}
            <div className="absolute rounded-full pointer-events-none" style={{ inset: '6%', background: `radial-gradient(circle, ${phase.color}22 0%, transparent 70%)`, filter: 'blur(8px)', opacity: isBurst ? 0.9 : 0.5, transition: 'opacity 0.4s, background 0.4s' }} />
            <svg className="absolute inset-0 -rotate-90 w-full h-full" viewBox="0 0 300 300" style={{ filter: `drop-shadow(0 0 10px ${phase.color}66)` }}>
              <circle cx="150" cy="150" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="12" />
              <circle cx="150" cy="150" r={R} fill="none" stroke={phase.color} strokeWidth="12" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={circ - segProgress * circ}
                style={{ transition: 'stroke-dashoffset 0.25s linear, stroke 0.3s' }} />
            </svg>
            <div className="text-center">
              <p className={`tabular-nums ${finalCountdown ? 'tm-tick' : ''}`}
                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(72px,20vw,120px)', lineHeight: 1, color: finalCountdown ? phase.color : '#fff', letterSpacing: 2, transition: 'color 0.3s', textShadow: finalCountdown ? `0 0 40px ${phase.color}` : 'none' }}>
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

          {/* Combinación del asalto: tamaño medio pero bien legible, junto al
              contador sin estorbarlo. Se resalta durante el asalto en curso. */}
          {showCombo && !isBurst && (
            <div className="mt-5 w-full max-w-xl px-2 anim-scale-in">
              <div className="mx-auto max-w-lg rounded-2xl border px-4 py-3.5 text-center"
                style={{
                  borderColor: state.segType === 'round' ? 'rgba(225,6,0,0.35)' : 'rgba(255,255,255,0.12)',
                  background: state.segType === 'round' ? 'rgba(225,6,0,0.08)' : 'rgba(255,255,255,0.03)',
                }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] mb-1.5"
                  style={{ color: state.segType === 'round' ? '#ff6b66' : '#a1a1aa' }}>
                  {state.segType === 'round' ? t('tm_combo_this_round') : t('tm_next_up')}
                </p>
                <p className="text-white font-bold leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 'clamp(22px,6vw,36px)', letterSpacing: 0.3 }}>
                  {comboLabel}
                </p>
              </div>
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

      <style>{`
        /* Destello a pantalla completa al cambiar de fase */
        @keyframes tm-flash { 0% { opacity: 0.85; transform: scale(1.06); } 100% { opacity: 0; transform: scale(1); } }
        .tm-flash { animation: tm-flash 0.6s cubic-bezier(0.22,1,0.36,1) forwards; }
        /* Entrada del título de fase */
        @keyframes tm-phase-in { 0% { opacity: 0; transform: translateY(8px) scale(0.94); letter-spacing: 0.4em; } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        .tm-phase-in { animation: tm-phase-in 0.5s cubic-bezier(0.22,1,0.36,1); }
        /* Latido del reloj en los últimos 10 s */
        @keyframes tm-tick { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        .tm-tick { animation: tm-tick 1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .tm-flash, .tm-phase-in, .tm-tick { animation: none !important; }
        }
      `}</style>
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
