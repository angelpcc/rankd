import type { ReactNode } from 'react';

/**
 * StateBanner · aviso contextual COMPACTO.
 *
 * Reemplaza los banners XL de "perfil incompleto", "publica tu marca",
 * "aplica la migración" que hoy dominan el primer viewport de los
 * dashboards. Un banner de sistema NO debe robar la atención al hero.
 *
 * Variantes semánticas:
 *   info      Informativo neutro (cielo).
 *   success   Todo bien (verde).
 *   warning   Requiere atención pero no bloquea (ámbar).
 *   danger    Bloqueante (rojo de marca).
 *
 * dense: reduce padding y tamaño de tipografía para embeber dentro de
 * otras cards (p.ej. dentro del hero). Sin `dense`, el banner es un
 * bloque autónomo entre secciones.
 *
 * onDismiss: si se pasa, el banner es descartable. El estado de descarte
 * lo maneja el consumidor (localStorage/DB); el componente sólo emite el
 * evento.
 */

type BannerVariant = 'info' | 'success' | 'warning' | 'danger';

interface Props {
  variant?: BannerVariant;
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  dense?: boolean;
}

const VARIANT: Record<BannerVariant, { bg: string; border: string; iconColor: string; titleColor: string }> = {
  info: {
    bg: 'bg-[color:color-mix(in_srgb,var(--rk-color-info)_8%,transparent)]',
    border: 'border-[color:color-mix(in_srgb,var(--rk-color-info)_30%,transparent)]',
    iconColor: 'text-[var(--rk-color-info)]',
    titleColor: 'text-[var(--rk-text-primary)]',
  },
  success: {
    bg: 'bg-[color:color-mix(in_srgb,var(--rk-color-success)_8%,transparent)]',
    border: 'border-[color:color-mix(in_srgb,var(--rk-color-success)_30%,transparent)]',
    iconColor: 'text-[var(--rk-color-success)]',
    titleColor: 'text-[var(--rk-color-success)]',
  },
  warning: {
    bg: 'bg-[color:color-mix(in_srgb,var(--rk-color-warning)_8%,transparent)]',
    border: 'border-[color:color-mix(in_srgb,var(--rk-color-warning)_35%,transparent)]',
    iconColor: 'text-[var(--rk-color-warning)]',
    titleColor: 'text-[var(--rk-color-warning)]',
  },
  danger: {
    bg: 'bg-[color:color-mix(in_srgb,var(--rk-color-danger)_8%,transparent)]',
    border: 'border-[color:color-mix(in_srgb,var(--rk-color-danger)_35%,transparent)]',
    iconColor: 'text-[var(--rk-color-danger)]',
    titleColor: 'text-[var(--rk-color-danger)]',
  },
};

const DEFAULT_ICON: Record<BannerVariant, string> = {
  info: 'ri-information-line',
  success: 'ri-check-line',
  warning: 'ri-error-warning-line',
  danger: 'ri-alert-line',
};

export default function StateBanner({
  variant = 'info', icon, title, description, action, onDismiss, dismissLabel, dense,
}: Props) {
  const v = VARIANT[variant];
  const iconCls = icon || DEFAULT_ICON[variant];
  const padCls = dense ? 'px-3.5 py-2.5' : 'px-4 py-3.5';
  const gapCls = dense ? 'gap-2.5' : 'gap-3';
  const iconSize = dense ? 'text-[16px]' : 'text-[18px]';
  const titleSize = dense ? 'text-[12px]' : 'text-[13px]';
  const descSize = dense ? 'text-[11px]' : 'text-[12px]';
  return (
    <div
      role={variant === 'danger' ? 'alert' : 'status'}
      className={[
        'flex items-start rounded-[var(--rk-radius-md)] border',
        gapCls, padCls, v.bg, v.border,
      ].join(' ')}
    >
      <i className={`${iconCls} ${v.iconColor} ${iconSize} mt-0.5 flex-shrink-0`} aria-hidden />
      <div className="flex-1 min-w-0">
        <p className={`${titleSize} font-bold ${v.titleColor} leading-snug`}>{title}</p>
        {description && (
          <p className={`${descSize} text-[var(--rk-text-quiet)] mt-0.5 leading-relaxed`}>{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0 self-center">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel || 'Dismiss'}
          className="flex-shrink-0 self-start w-6 h-6 flex items-center justify-center rounded-md text-[var(--rk-text-quiet)] hover:text-[var(--rk-text-primary)] cursor-pointer transition-colors rk-ds-focus-ring"
        >
          <i className="ri-close-line" aria-hidden />
        </button>
      )}
    </div>
  );
}
