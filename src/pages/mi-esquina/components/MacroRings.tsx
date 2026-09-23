import { useTranslation } from 'react-i18next';
import CountUp from '@/components/base/CountUp';

// Anillos de macros para el resumen (nivel 1) de Nutrición. Presentacional.
// Estructura inspirada en apps de nutrición (referencia visual), colores RANKD:
// proteína = acento rojo, carbohidratos = oro, grasas = neutro.
//
// En el centro, siempre lo CONSUMIDO. Sin objetivo, el aro se llena contra
// una referencia suave; con objetivo (ver lib/objetivoDiario.ts), contra el
// objetivo, y debajo del número se lee "de 152 g".
//
// Antes, con objetivo, el centro pasaba a enseñar lo que RESTABA con la misma
// "g" debajo: un 45 se leía como "llevo 45 g" cuando era "me faltan 45 g".

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
  /** Objetivo del día por macro, en gramos. */
  goals?: { protein: number; carbs: number; fat: number } | null;
}

function RingSvg({ ring, label, unit, delay }: { ring: Ring; label: string; unit: string; delay: number }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const denom = ring.goal && ring.goal > 0 ? ring.goal : ring.ref;
  const frac = Math.max(0, Math.min(1, ring.value / denom));
  const center = Math.round(ring.value);
  const target = C - frac * C;

  // `key` con el valor: al registrar una comida el anillo se re-monta y la
  // animación de llenado vuelve a correr desde el carril vacío, que es el
  // "crece en el momento" que pedía el brief.
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: 84, height: 84 }}>
        <svg viewBox="0 0 84 84" className="absolute inset-0 -rotate-90 w-full h-full">
          <circle cx="42" cy="42" r={R} fill="none" stroke="var(--s-3)" strokeWidth="8" />
          <circle
            key={ring.value}
            cx="42" cy="42" r={R} fill="none" stroke={ring.color} strokeWidth="8" strokeLinecap="round"
            className="rk-ring-fill"
            strokeDasharray={C}
            strokeDashoffset={C}
            style={{ ['--rk-ring-to' as string]: `${target}`, animationDelay: `${delay}ms` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <CountUp
            value={center} delay={delay}
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, lineHeight: 1, color: 'var(--t-1)' }}
          />
          <span className="text-[9px] text-zinc-500">{unit}</span>
        </div>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</span>
    </div>
  );
}

export default function MacroRings({ protein, carbs, fat, goals }: Props) {
  const { t } = useTranslation();
  const rings: Ring[] = [
    { key: 'protein', value: protein, goal: goals?.protein, color: 'var(--accent)', ref: 150 },
    { key: 'carbs', value: carbs, goal: goals?.carbs, color: 'var(--gold)', ref: 250 },
    { key: 'fat', value: fat, goal: goals?.fat, color: 'var(--t-3)', ref: 70 },
  ];
  return (
    <div className="flex items-center justify-around gap-2">
      <RingSvg ring={rings[0]} label={t('mc_food_photo_protein')} unit={goals ? t('mc_obj_of_g', { n: goals.protein }) : 'g'} delay={0} />
      <RingSvg ring={rings[1]} label={t('mc_food_photo_carbs')} unit={goals ? t('mc_obj_of_g', { n: goals.carbs }) : 'g'} delay={90} />
      <RingSvg ring={rings[2]} label={t('mc_food_photo_fat')} unit={goals ? t('mc_obj_of_g', { n: goals.fat }) : 'g'} delay={180} />
    </div>
  );
}
