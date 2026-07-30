import { useState, useRef, useCallback, useEffect } from 'react';

// La Web Speech API no está tipada en TS por defecto y el prefijo webkit varía
// por navegador. Declaramos lo mínimo que usamos.
interface RecognitionResult { readonly isFinal: boolean; readonly length: number; [index: number]: { transcript: string } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface RecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => RecognitionLike;

function getCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/**
 * Dictado por voz con la Web Speech API del navegador (gratuito, en el
 * dispositivo). Si el navegador no lo soporta, `supported` es false y quien
 * lo use debe seguir permitiendo escribir a mano.
 */
export function useSpeechRecognition(lang: string) {
  const [supported] = useState(() => !!getCtor());
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const recRef = useRef<RecognitionLike | null>(null);
  const finalRef = useRef('');

  const stop = useCallback(() => { try { recRef.current?.stop(); } catch { /* ya parado */ } }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    finalRef.current = '';
    setTranscript(''); setInterim('');
    rec.onresult = (e) => {
      let interimStr = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const txt = res[0]?.transcript || '';
        if (res.isFinal) finalRef.current += txt + ' ';
        else interimStr += txt;
      }
      setTranscript(finalRef.current.trim());
      setInterim(interimStr);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => { setListening(false); setInterim(''); };
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  }, [lang]);

  const reset = useCallback(() => { finalRef.current = ''; setTranscript(''); setInterim(''); }, []);

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* noop */ } }, []);

  return { supported, listening, transcript, interim, start, stop, reset };
}
