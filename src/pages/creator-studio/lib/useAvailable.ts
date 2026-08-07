import { useEffect, useState } from 'react';
import { checkContentGenerationAvailable } from '@/services/contentGeneration';

/** Sonda de disponibilidad de la IA, compartida por las 3 secciones. */
export function useContentGenerationAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    checkContentGenerationAvailable().then((ok) => { if (alive) setAvailable(ok); });
    return () => { alive = false; };
  }, []);
  return available;
}
