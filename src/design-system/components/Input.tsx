import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

/**
 * Input · campo de entrada tipado.
 *
 * Cubre input y textarea con la misma API. La distinción va por prop
 * `multiline` porque el 90% de las veces solo cambia el `<tag>` — no
 * merece dos componentes distintos.
 *
 * label:   texto encima del input. Si se omite, se usa `aria-label`.
 * hint:    texto auxiliar debajo del input, tono quiet.
 * error:   texto de error debajo. Reemplaza al hint cuando aparece y
 *          fuerza aria-invalid + borde rojo. Nunca es un icono flotante:
 *          los errores en formularios se dicen con palabras.
 * iconLeft/iconRight: iconos remix opcionales dentro del input.
 *
 * Regla no negociable: SIEMPRE font-size 16px en mobile para que iOS
 * no haga zoom al enfocar. El sistema ya lo aplica en index.css con
 * `@media (max-width: 820px) { input, select, textarea { font-size:
 * 16px !important } }`; aquí sólo se respeta.
 */

type BaseProps = {
  label?: string;
  hint?: string;
  error?: string;
  iconLeft?: string;
  iconRight?: string;
  /** Requiere que el label lleve indicador visual '*'. */
  required?: boolean;
};

type SingleLineProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
    multiline?: false;
    className?: string;
    /** Solo aplica a textarea. */
    rows?: never;
  };

type MultiLineProps = BaseProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> & {
    multiline: true;
    className?: string;
    rows?: number;
  };

export type InputProps = SingleLineProps | MultiLineProps;

const FIELD_BASE = [
  'w-full bg-[var(--rk-surface-sunken)] text-[var(--rk-text-primary)]',
  'placeholder:text-[var(--rk-text-mute)]',
  'border rounded-[var(--rk-radius-sm)]',
  'transition-colors duration-[var(--rk-dur-fast)] ease-[var(--rk-ease-out)]',
  'focus:outline-none rk-ds-focus-ring',
  'disabled:opacity-60 disabled:cursor-not-allowed',
].join(' ');

const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(function Input(
  props,
  ref,
) {
  const { label, hint, error, iconLeft, iconRight, required, ...rest } = props;
  const reactId = useId();
  const id = (rest as { id?: string }).id || `rk-input-${reactId}`;
  const describedById = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  const borderCls = error
    ? 'border-[var(--rk-color-danger)]'
    : 'border-[var(--rk-border-default)] focus:border-[var(--rk-border-strong)]';

  const padCls = 'px-3.5 h-11 text-[15px]';

  let field: ReactNode;
  if ((rest as MultiLineProps).multiline) {
    const { multiline: _m, className: extraCls = '', rows = 3, ...taRest } = rest as MultiLineProps;
    void _m;
    field = (
      <textarea
        id={id}
        ref={ref as React.Ref<HTMLTextAreaElement>}
        rows={rows}
        aria-invalid={!!error || undefined}
        aria-describedby={describedById}
        aria-label={!label ? (taRest['aria-label'] as string | undefined) : undefined}
        className={[FIELD_BASE, borderCls, 'px-3.5 py-3 text-[15px] resize-none min-h-[88px]', extraCls].join(' ')}
        {...taRest}
      />
    );
  } else {
    const { multiline: _m, className: extraCls = '', ...inRest } = rest as SingleLineProps;
    void _m;
    field = (
      <div className="relative">
        {iconLeft && (
          <i
            className={`${iconLeft} pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--rk-text-quiet)]`}
            aria-hidden
          />
        )}
        <input
          id={id}
          ref={ref as React.Ref<HTMLInputElement>}
          aria-invalid={!!error || undefined}
          aria-describedby={describedById}
          aria-label={!label ? (inRest['aria-label'] as string | undefined) : undefined}
          className={[
            FIELD_BASE,
            borderCls,
            padCls,
            iconLeft ? 'pl-10' : '',
            iconRight ? 'pr-10' : '',
            extraCls,
          ].join(' ')}
          {...inRest}
        />
        {iconRight && (
          <i
            className={`${iconRight} pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--rk-text-quiet)]`}
            aria-hidden
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="block mb-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--rk-text-quiet)]"
        >
          {label}
          {required && <span className="text-[var(--rk-color-red)] ml-0.5" aria-hidden>*</span>}
        </label>
      )}
      {field}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[12px] text-[var(--rk-color-danger)]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12px] text-[var(--rk-text-quiet)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export default Input;
