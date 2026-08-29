import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Voz del navegador (Web Speech API) para cantar las combinaciones en "El
// Rincón". Sin coste ni dependencias. Si el dispositivo no trae síntesis de voz
// o no hay voz en español, `speak` no hace nada: el combo se sigue viendo en
// pantalla (fallback silencioso, nunca un error).

interface Speech {
  /** El navegador soporta speechSynthesis. */
  supported: boolean;
  /** Hay una voz en español disponible (si no, se canta con la que haya). */
  hasEsVoice: boolean;
  /** Lee un texto en alto. Cancela lo que estuviera sonando. */
  speak: (text: string) => void;
  /** Corta cualquier locución en curso. */
  stop: () => void;
}

export function useSpeech(muted: boolean): Speech {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
    && typeof window.SpeechSynthesisUtterance !== 'undefined';
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const [hasEsVoice, setHasEsVoice] = useState(false);

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const pick = () => {
      const voices = synth.getVoices();
      const es = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('es'));
      voiceRef.current = es ?? voices[0] ?? null;
      setHasEsVoice(!!es);
    };
    pick();
    // getVoices() puede venir vacío hasta que dispara voiceschanged.
    synth.addEventListener?.('voiceschanged', pick);
    return () => synth.removeEventListener?.('voiceschanged', pick);
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    try { window.speechSynthesis.cancel(); } catch { /* no-op */ }
  }, [supported]);

  const speak = useCallback((text: string) => {
    if (!supported || muted || !text) return;
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voiceRef.current) u.voice = voiceRef.current;
      u.lang = voiceRef.current?.lang || 'es-ES';
      u.rate = 1.02;
      u.pitch = 1;
      u.volume = 1;
      synth.speak(u);
    } catch { /* el navegador puede rechazarlo; da igual, hay fallback visual */ }
  }, [supported, muted]);

  // Al desmontar / silenciar, corta.
  useEffect(() => { if (muted) stop(); }, [muted, stop]);
  useEffect(() => () => stop(), [stop]);

  // Objeto estable: evita re-ejecutar efectos del runner en cada render.
  return useMemo(() => ({ supported, hasEsVoice, speak, stop }), [supported, hasEsVoice, speak, stop]);
}
