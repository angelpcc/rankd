import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Card · superficie base del sistema.
 *
 * Variantes (por qué existe cada una):
 *   default  La mayoría de contenido. Superficie sólida #101010 con
 *            borde tenue. Sin blur ni glow.
 *   feature  Máximo UNA por pantalla — el elemento dominante (última
 *            sesión, próximo combate, plan activo). Superficie
 *            ligeramente más clara + borde reforzado + acento rojo
 *            en el filo superior. Sin glow ambiental (principio 3).
 *   quiet    Auxiliares (nota informativa, disclaimer, "ver también").
 *            Fondo más rebajado, borde apenas visible.
 *
 * Padding:
 *   sm ~ 12  para stacks compactos (item de lista, chip agrupado)
 *   md ~ 20  default
 *   lg ~ 28  feature card, empty state, contenido con imagen
 *
 * interactive: si es true, aplica hover + focus ring (usar cuando la
 * card completa es clickable — evita `.rk-card:hover` legacy que sube
 * translate y añade glow, patrón agresivo que va contra el principio 3).
 */

type CardVariant = 'default' | 'feature' | 'quiet';
type CardPadding = 'sm' | 'md' | 'lg' | 'none';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  interactive?: boolean;
  as?: 'div' | 'section' | 'article' | 'button';
  children?: ReactNode;
}

const PADDING: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
};

const VARIANT: Record<CardVariant, string> = {
  default:
    'bg-[var(--rk-surface-raised)] border border-[var(--rk-border-default)]',
  feature:
    'bg-[var(--rk-surface-feature)] border border-[var(--rk-border-strong)] relative overflow-hidden',
  quiet:
    'bg-[var(--rk-surface-canvas)] border border-[var(--rk-border-quiet)]',
};

const INTERACTIVE =
  'cursor-pointer transition-[border-color,background-color] duration-[var(--rk-dur-fast)] ease-[var(--rk-ease-out)] hover:border-[var(--rk-border-strong)] rk-ds-focus-ring';

const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', padding = 'md', interactive, as, children, className = '', ...rest },
  ref,
) {
  const Component = (as || 'div') as 'div';
  const cls = [
    'rounded-[var(--rk-radius-lg)]',
    VARIANT[variant],
    PADDING[padding],
    interactive ? INTERACTIVE : '',
    className,
  ].join(' ').trim();
  return (
    <Component ref={ref} className={cls} {...rest}>
      {variant === 'feature' && (
        // Filo rojo del borde superior — signature sutil sin invadir contenido.
        <span
          aria-hidden
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, var(--rk-color-red) 0%, transparent 80%)' }}
        />
      )}
      {children}
    </Component>
  );
});

export default Card;
