import { useState, useEffect, useRef, useCallback } from 'react';

type Phase = 'idle' | 'prep' | 'round' | 'rest' | 'done';

interface Preset {
  label: string;
  rounds: number;
  roundSec: number;
  restSec: number;
  desc: string;
}

const PRESETS: Preset[] = [
  { label: 'Boxeo amateur', rounds: 3, roundSec: 180, restSec: 60, desc: '3 × 3 min · 1 min descanso' },
  { label: 'Boxeo pro', rounds: 12, roundSec: 180, restSec: 60, desc: '12 × 3 min · 1 min descanso' },
  { label: 'MMA', rounds: 3, roundSec: 300, restSec: 60, desc: '3 × 5 min · 1 min descanso' },
  { label: 'Muay Thai', rounds: 5, roundSec: 180, restSec: 120, desc: '5 × 3 min · 2 min descanso' },
  { label: 'Saco / Cardio', rounds: 6, roundSec: 120, restSec: 30, desc: '6 × 2 min · 30 s descanso' },
];

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function RoundTimer() {
  const [rounds, setRounds] = useState(3);
  const [roundSec, setRoundSec] = useState(180);
  const [restSec, setRestSec] = useState(60);
  const [prepSec] = useState(10);

  const [phase, setPhase] = useState<Phase>('idle');
  const [currentRound, setCurrentRound] = useState(1);
  const [remaining, setRemaining] = useState(180);
  const [running, setRunning] = useState(false);
  const [muted, setMuted] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Campana de boxeo generada por código (sin archivos de audio)
  const bell = useCallback((times = 1) => {
    if (muted) return;
    try {
      if (!audioCtxRef.current) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new Ctor();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      for (let i = 0; i < times; i++) {
        const start = ctx.currentTime + i * 0.45;
        [880, 1320, 1760].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.28 / (idx + 1), start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 1.1);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 1.2);
        });
      }
    } catch {
      // Silencio si el navegador no lo permite
    }
  }, [muted]);

  const beep = useCallback(() => {
    if (muted) return;
    try {
      if (!audioCtxRef.current) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new Ctor();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch { /* noop */ }
  }, [muted]);

  const applyPreset = (p: Preset) => {
    setRounds(p.rounds);
    setRoundSec(p.roundSec);
    setRestSec(p.restSec);
    reset(p.roundSec);
  };

  const reset = (rs = roundSec) => {
    setRunning(false);
    setPhase('idle');
    setCurrentRound(1);
    setRemaining(rs);
  };

  const start = () => {
    if (phase === 'idle' || phase === 'done') {
      setPhase('prep');
      setCurrentRound(1);
      setRemaining(prepSec);
    }
    setRunning(true);
  };

  // Motor del cronómetro
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev > 1) {
          if (prev <= 4) beep();
          return prev - 1;
        }
        // Cambio de fase
        setPhase((ph) => {
          if (ph === 'prep') { bell(1); setRemaining(roundSec); return 'round'; }
          if (ph === 'round') {
            if (currentRound >= rounds) { bell(3); setRunning(false); setRemaining(0); return 'done'; }
            bell(1); setRemaining(restSec); return 'rest';
          }
          if (ph === 'rest') { bell(1); setCurrentRound((r) => r + 1); setRemaining(roundSec); return 'round'; }
          return ph;
        });
        return prev;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, currentRound, rounds, roundSec, restSec, bell, beep]);

  const phaseCfg = {
    idle: { label: 'Listo', color: '#ffffff', ring: 'rgba(255,255,255,0.15)', bg: 'rgba(255,255,255,0.03)' },
    prep: { label: 'Preparados', color: '#C9A84C', ring: '#C9A84C', bg: 'rgba(201,168,76,0.08)' },
    round: { label: `Asalto ${currentRound}`, color: '#E10600', ring: '#E10600', bg: 'rgba(225,6,0,0.08)' },
    rest: { label: 'Descanso', color: '#22c55e', ring: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
    done: { label: '¡Terminado!', color: '#C9A84C', ring: '#C9A84C', bg: 'rgba(201,168,76,0.1)' },
  }[phase];

  const totalPhase = phase === 'round' ? roundSec : phase === 'rest' ? restSec : phase === 'prep' ? prepSec : roundSec;
  const progress = totalPhase > 0 ? ((totalPhase - remaining) / totalPhase) * 100 : 0;
  const circumference = 2 * Math.PI * 130;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(28px,5vw,40px)', letterSpacing: 1 }}>
          TEMPORIZADOR DE <span className="text-[#E10600]">ASALTOS</span>
        </h1>
        <p className="text-zinc-400 text-sm mt-1">Entrena con el ritmo real del combate. Campana incluida.</p>
      </div>

      {/* Cronómetro */}
      <div className="rounded-3xl border p-6 sm:p-10 flex flex-col items-center transition-colors"
        style={{ background: phaseCfg.bg, borderColor: phaseCfg.ring + '55' }}>

        <span className="text-xs font-bold tracking-[0.3em] uppercase mb-5" style={{ color: phaseCfg.color, fontFamily: "'Barlow Condensed', sans-serif" }}>
          {phaseCfg.label}
        </span>

        <div className="relative w-[280px] h-[280px] flex items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" width="280" height="280" viewBox="0 0 280 280">
            <circle cx="140" cy="140" r="130" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
            <circle cx="140" cy="140" r="130" fill="none" stroke={phaseCfg.color} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (progress / 100) * circumference}
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }} />
          </svg>
          <div className="text-center">
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 74, lineHeight: 1, color: phaseCfg.color, letterSpacing: 2 }}>
              {fmt(remaining)}
            </p>
            <p className="text-zinc-500 text-sm mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {phase === 'done' ? 'Sesión completada' : `Asalto ${currentRound} de ${rounds}`}
            </p>
          </div>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-3 mt-8 flex-wrap justify-center">
          {!running ? (
            <button onClick={start}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3.5 rounded-xl transition-colors cursor-pointer">
              <i className="ri-play-fill text-lg"></i>
              {phase === 'idle' || phase === 'done' ? 'Empezar' : 'Reanudar'}
            </button>
          ) : (
            <button onClick={() => setRunning(false)}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white font-bold px-8 py-3.5 rounded-xl transition-colors cursor-pointer">
              <i className="ri-pause-fill text-lg"></i>
              Pausar
            </button>
          )}
          <button onClick={() => reset()} title="Reiniciar"
            className="w-12 h-12 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-xl transition-colors cursor-pointer">
            <i className="ri-restart-line text-lg"></i>
          </button>
          <button onClick={() => setMuted(!muted)} title={muted ? 'Activar sonido' : 'Silenciar'}
            className={`w-12 h-12 flex items-center justify-center border rounded-xl transition-colors cursor-pointer ${muted ? 'bg-zinc-800 border-zinc-700 text-zinc-500' : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'}`}>
            <i className={muted ? 'ri-volume-mute-line text-lg' : 'ri-volume-up-line text-lg'}></i>
          </button>
        </div>
      </div>

      {/* Presets */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Formatos rápidos</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {PRESETS.map((p) => {
            const active = p.rounds === rounds && p.roundSec === roundSec && p.restSec === restSec;
            return (
              <button key={p.label} onClick={() => applyPreset(p)} disabled={running}
                className={`text-left rounded-2xl border p-4 transition-all cursor-pointer disabled:opacity-40 ${active ? 'bg-red-600/10 border-red-500/45' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'}`}>
                <p className={`text-sm font-bold ${active ? 'text-red-400' : 'text-white'}`}>{p.label}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{p.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Personalizado */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Personalizar</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Asaltos</label>
            <input type="number" min={1} max={20} value={rounds} disabled={running}
              onChange={(e) => { const v = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)); setRounds(v); }}
              className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500 disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Duración (min)</label>
            <input type="number" min={0.5} max={15} step={0.5} value={roundSec / 60} disabled={running}
              onChange={(e) => { const v = Math.round((parseFloat(e.target.value) || 1) * 60); setRoundSec(v); if (phase === 'idle') setRemaining(v); }}
              className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500 disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Descanso (seg)</label>
            <input type="number" min={5} max={300} step={5} value={restSec} disabled={running}
              onChange={(e) => setRestSec(Math.max(5, parseInt(e.target.value, 10) || 30))}
              className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500 disabled:opacity-50" />
          </div>
        </div>
        <p className="text-[11px] text-zinc-600 flex items-center gap-1.5">
          <i className="ri-information-line"></i>
          Mantén esta pestaña abierta mientras entrenas para que suene la campana.
        </p>
      </div>
    </div>
  );
}