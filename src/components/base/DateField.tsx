import { useTranslation } from 'react-i18next';

// Campo de fecha con la caja dibujada por NOSOTROS.
//
// El `<input type="date">` nativo pinta su valor con pseudo-elementos internos
// que no heredan padding ni centrado y que cada navegador coloca a su manera.
// Por mucho CSS que se le eche, el texto acaba descuadrado dentro de la caja y
// el icono del calendario aparece donde le da la gana.
//
// Aquí la caja, el texto y el icono son elementos normales, así que se alinean
// como cualquier otro campo de la app. El input nativo sigue existiendo encima,
// transparente y a tamaño completo: tocar en cualquier punto abre el selector
// nativo del sistema, que es el que de verdad funciona bien en el móvil.
//
// De paso muestra la fecha en formato legible ("jueves, 10 de septiembre") en
// vez de "10/09/2026", que es lo que la gente lee de un vistazo.

interface Props {
  /** Valor en formato YYYY-MM-DD. */
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  /** Texto accesible del campo. */
  ariaLabel: string;
  /** Formato largo con día de la semana. Por defecto, corto. */
  long?: boolean;
  className?: string;
}

export default function DateField({ value, onChange, min, max, ariaLabel, long = true, className = '' }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  // Solo la primera letra en mayúscula. Con `text-transform: capitalize` en el
  // CSS salía "Miércoles, 9 De Septiembre": en español los meses y las
  // preposiciones van en minúscula.
  const raw = value
    ? new Date(`${value}T12:00:00`).toLocaleDateString(
      locale,
      long
        ? { weekday: 'long', day: 'numeric', month: 'long' }
        : { day: 'numeric', month: 'long', year: 'numeric' },
    )
    : t('mc_df_pick');
  const label = raw.charAt(0).toUpperCase() + raw.slice(1);

  return (
    <div
      className={`relative w-full flex items-center gap-3 bg-white/[0.04] border border-white/10 rounded-xl px-4 ${className}`}
      style={{ minHeight: 44 }}
    >
      <span className="flex-1 min-w-0 text-white text-sm truncate">
        {label}
      </span>
      <i className="ri-calendar-line flex-shrink-0" style={{ color: 'var(--t-3)' }} aria-hidden />

      {/* El nativo, invisible y encima de todo: se lleva el toque y abre el
          selector del sistema. `fontSize: 16` evita el zoom automático de iOS. */}
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full cursor-pointer"
        style={{ opacity: 0, fontSize: 16, padding: 0, border: 0, background: 'transparent' }}
      />
    </div>
  );
}
