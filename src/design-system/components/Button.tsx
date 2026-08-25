import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Button · acción del sistema.
 *
 * Variantes (por qué existe cada una):
 *   primary   Acción principal de la pantalla. Solo UNA por vista si es
 *             posible. Fondo rojo sólido, sombra corta, look funcional.
 *   secondary Acción alternativa (guardar borrador, cancelar formal).
 *             Superficie sólida oscura con borde, sin glow.
 *   ghost     Acción terciaria (cancelar en un modal, "volver", filtros
 *             inactivos). Transparente con borde tenue.
 *   danger    Acción destructiva confirmada (borrar cuenta, archivar).
 *             NO se usa para "cancelar".
 *
 * Tamaños:
 *   sm  · toolbar, tabs. Altura ~36px.
 *   md  · default, formularios. Altura 44px = touch mínimo.
 *   lg  · CTA principal, hero, empty state action. Altura 52px.
 *
 * fullWidth: en móvil, un CTA a ancho total mejora legibilidad y toque.
 *
 * Nota: para los botones "cinematográficos" del Hero público (Bebas +
 * letter-spacing amplio) se mantiene el `.rk-btn` legacy — Button es el
 * botón funcional del producto, no de la portada.
 */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Icono a la izquierda del label. Pasar el className remix (ej. "ri-add-line"). */
  iconLeft?: string;
  /** Icono a la derecha (ej. flecha "ri-arrow-right-line"). */
  iconRight?: string;
  /** Estado cargando: deshabilita e inserta spinner reemplazando el icono izq. */
  loading?: boolean;
  children?: ReactNode;
}

const BASE = [
  'inline-flex items-center justify-center gap-2',
  'font-[var(--rk-font-body)] font-semibold',
  'transition-all duration-[var(--rk-dur-fast)] ease-[var(--rk-ease-out)]',
  'cursor-pointer select-none whitespace-nowrap',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
  'rk-ds-focus-ring',
].join(' ');

const SIZE: Record<ButtonSize, string> = {
  sm: 'text-[13px] px-3 h-9 rounded-[var(--rk-radius-sm)]',
  md: 'text-[14px] px-4 h-11 rounded-[var(--rk-radius-md)]',
  lg: 'text-[15px] px-6 h-[52px] rounded-[var(--rk-radius-md)]',
};

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'text-white bg-[var(--rk-color-red)] hover:bg-[var(--rk-color-red-deep)] active:translate-y-px',
  secondary:
    'text-[var(--rk-text-primary)] bg-[var(--rk-surface-raised)] border border-[var(--rk-border-default)] hover:border-[var(--rk-border-strong)] active:translate-y-px',
  ghost:
    'text-[var(--rk-text-default)] bg-transparent border border-[var(--rk-border-default)] hover:text-white hover:border-[var(--rk-border-strong)] hover:bg-white/[0.04] active:translate-y-px',
  danger:
    'text-white bg-[var(--rk-color-danger)] hover:brightness-110 active:translate-y-px',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', fullWidth, iconLeft, iconRight, loading, disabled, children, className = '', ...rest },
  ref,
) {
  const cls = [BASE, SIZE[size], VARIANT[variant], fullWidth ? 'w-full' : '', className].join(' ').trim();
  const isDisabled = disabled || loading;
  return (
    <button ref={ref} className={cls} disabled={isDisabled} aria-busy={loading || undefined} {...rest}>
      {loading ? (
        <span
          aria-hidden
          className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
        />
      ) : iconLeft ? (
        <i className={iconLeft} aria-hidden />
      ) : null}
      {children}
      {!loading && iconRight ? <i className={iconRight} aria-hidden /> : null}
    </button>
  );
});

export default Button;
