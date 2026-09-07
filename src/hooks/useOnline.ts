import { useEffect, useState } from 'react';

/**
 * ¿Hay conexión? Importa en Mi Esquina porque el entreno se registra en el
 * gimnasio, donde a menudo no hay cobertura: si no hay red, lo que se escribe
 * sigue vivo en el borrador local pero no se puede guardar en Supabase, y el
 * usuario tiene que saberlo antes de darle a guardar.
 *
 * `navigator.onLine` solo garantiza el negativo (false = seguro sin red), pero
 * es suficiente para avisar sin inventar comprobaciones de red propias.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  return online;
}
