import { useEffect, useRef, useState } from 'react';

// Mantiene la pantalla encendida mientras el temporizador corre, usando la
// Screen Wake Lock API. El móvil suele soltar el bloqueo al cambiar de pestaña
// o apagar la pantalla manualmente, así que lo volvemos a pedir cuando la
// página recupera la visibilidad.
//
// `supported` permite avisar con honestidad al usuario cuando el navegador no
// ofrece esta garantía (algunos iOS antiguos), en vez de prometer algo que no
// se cumple.

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener: (type: 'release', cb: () => void) => void;
}
interface WakeLockNavigator {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
}

export function useWakeLock(active: boolean) {
  const [supported] = useState(() =>
    typeof navigator !== 'undefined' && 'wakeLock' in navigator);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!supported) return;
    const nav = navigator as unknown as WakeLockNavigator;
    let cancelled = false;

    const acquire = async () => {
      if (!active || cancelled || sentinelRef.current) return;
      try {
        const s = await nav.wakeLock!.request('screen');
        sentinelRef.current = s;
        s.addEventListener('release', () => { sentinelRef.current = null; });
      } catch { /* el navegador puede denegarlo (batería baja, etc.) */ }
    };

    const release = async () => {
      try { await sentinelRef.current?.release(); } catch { /* noop */ }
      sentinelRef.current = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && active) acquire();
    };

    if (active) acquire();
    else release();

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      release();
    };
  }, [active, supported]);

  return { supported };
}
