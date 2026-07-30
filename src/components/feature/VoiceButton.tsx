import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface Props {
  /** Se llama con el texto dictado al terminar. El que lo use decide qué hacer
   *  (rellenar un campo, interpretarlo…): nunca guarda por su cuenta. */
  onResult: (text: string) => void;
  /** Botón compacto (solo icono). */
  compact?: boolean;
  /** Texto del botón cuando no está escuchando (por defecto "Dictar"). */
  labelKey?: string;
  className?: string;
}

/**
 * Botón de dictado por voz. Si el navegador no soporta la Web Speech API,
 * NO se renderiza (el usuario sigue escribiendo a mano con normalidad).
 */
export default function VoiceButton({ onResult, compact, labelKey = 'mc_vo_dictate', className = '' }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const { supported, listening, transcript, interim, start, stop, reset } = useSpeechRecognition(lang);
  const wasListening = useRef(false);

  // Al pasar de escuchando → parado, entregamos el texto una sola vez.
  useEffect(() => {
    if (wasListening.current && !listening) {
      const text = transcript.trim();
      if (text) onResult(text);
      reset();
    }
    wasListening.current = listening;
  }, [listening, transcript, onResult, reset]);

  if (!supported) return null;

  if (listening) {
    return (
      <div className={`inline-flex flex-col items-start gap-1 ${className}`}>
        <button type="button" onClick={stop}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600 text-white text-sm font-bold cursor-pointer anim-pulse-glow">
          <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></span>
          {t('mc_vo_listening')} · {t('mc_vo_stop')}
        </button>
        {interim && <span className="text-[11px] text-zinc-500 max-w-xs truncate italic">“{interim}”</span>}
      </div>
    );
  }

  return (
    <button type="button" onClick={start} aria-label={t(labelKey)}
      className={`inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.03] text-zinc-300 hover:text-white hover:border-white/25 transition-colors cursor-pointer ${compact ? 'w-9 h-9 justify-center' : 'px-3 py-2 text-sm font-semibold'} ${className}`}>
      <i className="ri-mic-line text-base"></i>{!compact && t(labelKey)}
    </button>
  );
}
