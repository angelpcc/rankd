import { useTranslation } from 'react-i18next';

// Anillos de macros para el resumen (nivel 1) de Nutrición. Presentacional.
// Estructura inspirada en apps de nutrición (referencia visual), colores RANKD:
// proteína = acento rojo, carbohidratos = oro, grasas = neutro.
//
// Sin objetivo por macro (aún no hay esquema) → se muestra lo CONSUMIDO en el
// centro y el aro se llena contra una referencia suave. Con objetivo → se
// muestra lo que RESTA y el aro se llena contra el objetivo.

interface Ring {
  key: 'protein' | 'carbs' | 'fat';
  value: number;
  goal?: number;
  color: string;
  ref: number; // referencia suave para el llenado visual sin objetivo
}

interface Props {
  protein: number;
  carbs: number;
  fat: number;
}

function RingSvg({ ring, label, unit }: { ring: Ring; label: string; unit: string }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const denom = ring.goal && ring.goal > 0 ? ring.goal : ring.ref;
  const frac = Math.max(0, Math.min(1, ring.value / denom));
  const center = ring.goal && ring.goal > 0 ? Math.max(0, Math.round(ring.goal - ring.value)) : Math.round(ring.value);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: 84, height: 84 }}>
        <svg viewBox="0 0 84 84" className="absolute inset-0 -rotate-90 w-full h-full">
          <circle cx="42" cy="42" r={R} fill="none" stroke="var(--s-3)" strokeWidth="8" />
          <circle cx="42" cy="42" r={R} fill="none" stroke={ring.color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C - frac * C} style={{ transition: 'stroke-dashoffset 0.4s' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, lineHeight: 1, color: 'var(--t-1)' }}>{center}</span>
          <span className="text-[9px] text-zinc-500">{unit}</span>
        </div>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</span>
    </div>
  );
}

export default function MacroRings({ protein, carbs, fat }: Props) {
  const { t } = useTranslation();
  const rings: Ring[] = [
    { key: 'protein', value: protein, color: 'var(--accent)', ref: 150 },
    { key: 'carbs', value: carbs, color: 'var(--gold)', ref: 250 },
    { key: 'fat', value: fat, color: 'var(--t-3)', ref: 70 },
  ];
  return (
    <div className="flex items-center justify-around gap-2">
      <RingSvg ring={rings[0]} label={t('mc_food_photo_protein')} unit="g" />
      <RingSvg ring={rings[1]} label={t('mc_food_photo_carbs')} unit="g" />
      <RingSvg ring={rings[2]} label={t('mc_food_photo_fat')} unit="g" />
    </div>
  );
}
