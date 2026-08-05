// Motor de sonido del temporizador — SOLO señales (campanas, alarmas, timbres).
// Nunca voz: las combinaciones se leen en pantalla, no se escuchan.
//
// Cada señal tiene un timbre deliberadamente distinto para que sea
// inconfundible aunque estés reventado en el saco o con música de gimnasio:
//   · bell          → campana de boxeo (inicio/fin de asalto). Resonante y larga.
//   · tenSeconds    → "clacker" doble de madera (faltan 10 s). Seco, doble golpe.
//   · accelerate    → alarma ascendente rápida (¡acelera!). Aguda y urgente.
//   · easeOff       → dos tonos graves descendentes (vuelve al ritmo). Calmada.
//   · warn          → tic corto y seco (cuenta atrás final). Mínimo.
//   · restStart     → doble campana suave (empieza el descanso).
//   · finish        → triple campana (fin de la sesión).
//
// Todo se genera por código con Web Audio: cero archivos, cero red.
//
// FIABILIDAD DEL AUDIO (crítico en móvil): los navegadores bloquean el audio
// hasta que el usuario interactúa con la página, y iOS Safari exige que el
// AudioContext se cree/reanude DENTRO del gesto. Por eso:
//   1. Exportamos UNA instancia compartida (`timerSounds`) y la desbloqueamos
//      en el propio onClick de "Empezar" (ver page.tsx), no en un efecto.
//   2. `armTimerAudio()` engancha un listener global de un solo uso para
//      desbloquear en cuanto el usuario toque cualquier parte del temporizador.
//   3. `unlock()` reproduce un buffer silencioso para "cebar" iOS.
// Todo pasa por un GainNode maestro + compresor para sonar ALTO sin saturar.

type Ctor = typeof AudioContext;
type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle';

export class TimerSounds {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  constructor(muted = false) {
    this.muted = muted;
  }

  /** Crea/reanuda el AudioContext. DEBE llamarse dentro de un gesto del usuario. */
  unlock() {
    try {
      if (!this.ctx) {
        const C = window.AudioContext
          || (window as unknown as { webkitAudioContext: Ctor }).webkitAudioContext;
        if (!C) return;
        this.ctx = new C();
        // Cadena maestra: ganancia alta + compresor para sonar fuerte y claro
        // por encima de la música del gimnasio, sin distorsionar en los picos.
        const master = this.ctx.createGain();
        master.gain.value = 1.6;
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -10;
        comp.knee.value = 12;
        comp.ratio.value = 12;
        comp.attack.value = 0.002;
        comp.release.value = 0.18;
        master.connect(comp);
        comp.connect(this.ctx.destination);
        this.master = master;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      // Ceba iOS: un buffer de 1 muestra reproducido dentro del gesto "abre" el audio.
      const buf = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);
    } catch { /* el navegador puede no permitirlo aún */ }
  }

  /** ¿Está el audio listo (desbloqueado y no en silencio)? */
  get isReady(): boolean {
    return !this.muted && !!this.ctx && this.ctx.state === 'running';
  }

  private ready(): AudioContext | null {
    if (this.muted) return null;
    this.unlock();
    return this.ctx;
  }

  private out(): AudioNode {
    return this.master ?? this.ctx!.destination;
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
    g.connect(this.out());
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
    g.connect(this.out());
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
        this.tone(f, t, 1.3, 0.5 / (idx + 1), 'sine');
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
      [660, 990, 1320].forEach((f, idx) => this.tone(f, t, 1.0, 0.4 / (idx + 1), 'sine'));
    }
  }

  /** Faltan 10 segundos: "clacker" de madera, doble golpe seco e inconfundible.
   *  Es el aviso clásico de boxeo, distinto de la campana y del cambio de ritmo. */
  tenSeconds() {
    const ctx = this.ready();
    if (!ctx) return;
    const base = ctx.currentTime;
    // Dos golpes secos "tok-tok": onda triangular grave y muy corta, con un
    // armónico agudo que le da el chasquido de la madera.
    [0, 0.14].forEach((off) => {
      const t = base + off;
      this.tone(300, t, 0.09, 0.6, 'triangle');
      this.tone(1400, t, 0.05, 0.32, 'square');
    });
  }

  /** ¡ACELERA! Alarma ascendente rápida, tres blips agudos en subida. */
  accelerate() {
    const ctx = this.ready();
    if (!ctx) return;
    const base = ctx.currentTime;
    [1180, 1560, 2000].forEach((f, i) => {
      this.tone(f, base + i * 0.1, 0.12, 0.5, 'square');
    });
    // Cola de sirena corta para que sea inequívoca.
    this.sweep(1500, 2200, base + 0.32, 0.16, 0.44, 'sawtooth');
  }

  /** Vuelve al ritmo normal: dos tonos graves descendentes. */
  easeOff() {
    const ctx = this.ready();
    if (!ctx) return;
    const base = ctx.currentTime;
    this.tone(560, base, 0.16, 0.44, 'triangle');
    this.tone(360, base + 0.16, 0.24, 0.44, 'triangle');
  }

  /** Cuenta atrás final: tic corto y seco. */
  warn() {
    const ctx = this.ready();
    if (!ctx) return;
    this.tone(680, ctx.currentTime, 0.09, 0.3, 'square');
  }
}

// ── Instancia compartida ──
// Una sola para toda la app del temporizador, para poder desbloquearla en el
// gesto de "Empezar" (page.tsx) antes de que monte el runner.
export const timerSounds = new TimerSounds();

// Engancha un desbloqueo de un solo uso a la primera interacción del usuario en
// la página del temporizador. Devuelve una función de limpieza.
export function armTimerAudio(): () => void {
  const handler = () => { timerSounds.unlock(); };
  const opts = { passive: true } as AddEventListenerOptions;
  const events: (keyof DocumentEventMap)[] = ['pointerdown', 'touchstart', 'mousedown', 'keydown'];
  events.forEach((e) => document.addEventListener(e, handler, opts));
  return () => events.forEach((e) => document.removeEventListener(e, handler, opts));
}
