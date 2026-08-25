import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Badge · etiqueta compacta semántica.
 *
 * Variantes (por qué existe cada una):
 *   default  Neutra. Categoría, tag, "boxeo", "amateur".
 *   success  Estado positivo confirmado: "Disponible", "Verificado".
 *   warning  Requiere atención: "Perfil incompleto", "Renovar".
 *   danger   Bloqueante o crítico: "Rechazado", "Vencido".
 *   gold     Distinción de marca / premium: "PRO", "Destacado".
 *   red      Firma de marca puntual, no semántica: "IA", categoría
 *            principal en tarjetas. Úsalo con moderación.
 *
 * Tamaño:
 *   sm  · caption dentro de card
 *   md  · fila destacada
 *
 * dot: pequeño círculo del color del badge — útil para "estado en vivo"
 * (activo, en línea…).
 */

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'gold' | 'red';
type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  children?: ReactNode;
}

const SIZE: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-2 h-5',
  md: 'text-[11px] px-2.5 h-6',
};

const VARIANT: Record<BadgeVariant, { bg: string; border: string; color: string; dot: string }> = {
  default: {
    bg: 'bg-white/[0.04]', border: 'border-[var(--rk-border-default)]',
    color: 'text-[var(--rk-text-default)]', dot: 'bg-[var(--rk-text-quiet)]',
  },
  success: {
    bg: 'bg-[color:color-mix(in_srgb,var(--rk-color-success)_10%,transparent)]',
    border: 'border-[color:color-mix(in_srgb,var(--rk-color-success)_35%,transparent)]',
    color: 'text-[var(--rk-color-success)]', dot: 'bg-[var(--rk-color-success)]',
  },
  warning: {
    bg: 'bg-[color:color-mix(in_srgb,var(--rk-color-warning)_10%,transparent)]',
    border: 'border-[color:color-mix(in_srgb,var(--rk-color-warning)_35%,transparent)]',
    color: 'text-[var(--rk-color-warning)]', dot: 'bg-[var(--rk-color-warning)]',
  },
  danger: {
    bg: 'bg-[color:color-mix(in_srgb,var(--rk-color-danger)_10%,transparent)]',
    border: 'border-[color:color-mix(in_srgb,var(--rk-color-danger)_35%,transparent)]',
    color: 'text-[var(--rk-color-danger)]', dot: 'bg-[var(--rk-color-danger)]',
  },
  gold: {
    bg: 'bg-[color:color-mix(in_srgb,var(--rk-color-gold)_10%,transparent)]',
    border: 'border-[color:color-mix(in_srgb,var(--rk-color-gold)_35%,transparent)]',
    color: 'text-[var(--rk-color-gold)]', dot: 'bg-[var(--rk-color-gold)]',
  },
  red: {
    bg: 'bg-[color:color-mix(in_srgb,var(--rk-color-red)_12%,transparent)]',
    border: 'border-[color:color-mix(in_srgb,var(--rk-color-red)_40%,transparent)]',
    color: 'text-[color:color-mix(in_srgb,var(--rk-color-red)_80%,white)]', dot: 'bg-[var(--rk-color-red)]',
  },
};

export default function Badge({ variant = 'default', size = 'sm', dot, children, className = '', ...rest }: BadgeProps) {
  const v = VARIANT[variant];
  const cls = [
    'inline-flex items-center gap-1.5 rounded-[var(--rk-radius-pill)] border font-semibold uppercase tracking-[0.08em] whitespace-nowrap',
    SIZE[size], v.bg, v.border, v.color, className,
  ].join(' ').trim();
  return (
    <span className={cls} {...rest}>
      {dot && <span aria-hidden className={`inline-block w-1.5 h-1.5 rounded-full ${v.dot}`} />}
      {children}
    </span>
  );
}
