// Motor de sonido del temporizador — SOLO señales (campanas, alarmas, timbres).
// Nunca voz: las combinaciones se leen en pantalla, no se escuchan.
//
// Cada señal tiene un timbre deliberadamente distinto para que sea
// inconfundible aunque estés reventado en el saco:
//   · bell          → campana de boxeo (inicio/fin de asalto). Resonante y larga.
//   · accelerate    → alarma ascendente rápida (¡acelera!). Aguda y urgente.
//   · easeOff       → dos tonos graves descendentes (vuelve al ritmo). Calmada.
//   · warn          → tic corto y seco (últimos segundos). Mínimo, no se confunde.
//   · restStart     → doble campana suave (empieza el descanso).
//   · finish        → triple campana (fin de la sesión).
//
// Todo se genera por código con Web Audio: cero archivos, cero red.

type Ctor = typeof AudioContext;
type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle';

export class TimerSounds {
  private ctx: AudioContext | null = null;
  muted = false;

  constructor(muted = false) {
    this.muted = muted;
  }

  /** Crea/reanuda el AudioContext. Debe llamarse tras un gesto del usuario. */
  unlock() {
    try {
      if (!this.ctx) {
        const C = window.AudioContext
          || (window as unknown as { webkitAudioContext: Ctor }).webkitAudioContext;
        this.ctx = new C();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { /* el navegador puede no permitirlo aún */ }
  }

  private ready(): AudioContext | null {
    if (this.muted) return null;
    this.unlock();
    return this.ctx;
  }

  // Un oscilador con envolvente exponencial. Base de todas las señales.
  private tone(freq: number, start: number, dur: number, gain: number, type: Wave = 'sine') {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  // Barrido de frecuencia (para la alarma de acelerar / calmar).
  private sweep(from: number, to: number, start: number, dur: number, gain: number, type: Wave = 'square') {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  /** Campana de boxeo. `times` toques encadenados. */
  bell(times = 1) {
    const ctx = this.ready();
    if (!ctx) return;
    for (let i = 0; i < times; i++) {
      const t = ctx.currentTime + i * 0.42;
      // Armónicos de una campana metálica.
      [880, 1320, 1760, 2400].forEach((f, idx) => {
        this.tone(f, t, 1.3, 0.32 / (idx + 1), 'sine');
      });
    }
  }

  /** Fin de sesión: triple campana. */
  finish() {
    this.bell(3);
  }

  /** Empieza el descanso: doble campana algo más suave. */
  restStart() {
    const ctx = this.ready();
    if (!ctx) return;
    for (let i = 0; i < 2; i++) {
      const t = ctx.currentTime + i * 0.34;
      [660, 990, 1320].forEach((f, idx) => this.tone(f, t, 1.0, 0.22 / (idx + 1), 'sine'));
    }
  }

  /** ¡ACELERA! Alarma ascendente rápida, tres blips agudos en subida. */
  accelerate() {
    const ctx = this.ready();
    if (!ctx) return;
    const base = ctx.currentTime;
    [1180, 1560, 2000].forEach((f, i) => {
      this.tone(f, base + i * 0.1, 0.12, 0.3, 'square');
    });
    // Cola de sirena corta para que sea inequívoca.
    this.sweep(1500, 2200, base + 0.32, 0.16, 0.26, 'sawtooth');
  }

  /** Vuelve al ritmo normal: dos tonos graves descendentes. */
  easeOff() {
    const ctx = this.ready();
    if (!ctx) return;
    const base = ctx.currentTime;
    this.tone(560, base, 0.16, 0.26, 'triangle');
    this.tone(360, base + 0.16, 0.24, 0.26, 'triangle');
  }

  /** Últimos segundos: tic corto y seco. */
  warn() {
    const ctx = this.ready();
    if (!ctx) return;
    this.tone(680, ctx.currentTime, 0.09, 0.14, 'square');
  }
}
