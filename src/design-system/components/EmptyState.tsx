import type { ReactNode } from 'react';
import Card from './Card';

/**
 * EmptyState · vista "aún no hay datos" / "aún no está disponible".
 *
 * Usar cuando la sección carga pero no hay contenido, o cuando una
 * feature está gated (migración pendiente, IA sin key, plan no creado).
 * NO usar como pantalla de error de red — para eso hay toast + botón
 * "reintentar" en el propio contexto.
 *
 * Variantes:
 *   default  Neutra. Icono en gris.
 *   feature  Icono con tinte de marca (rojo). Para invitar a crear el
 *            primer objetivo, la primera sesión, etc.
 *   soon     "Muy pronto" — feature gated. Icono con acento oro y badge.
 *
 * Estructura pensada como card ligera; se puede omitir el card wrap con
 * `bare={true}` cuando ya está dentro de otra card (evitar tarjetas
 * dentro de tarjetas, principio 1).
 */

type EmptyVariant = 'default' | 'feature' | 'soon';

interface Props {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: EmptyVariant;
  bare?: boolean;
  /** Texto del badge cuando variant="soon". El DS no importa i18n: el
   *  consumidor pasa la traducción, igual que dismissLabel/closeLabel. */
  soonLabel?: string;
}

const ICON_STYLE: Record<EmptyVariant, string> = {
  default: 'bg-white/[0.04] border-[var(--rk-border-default)] text-[var(--rk-text-quiet)]',
  feature: 'bg-[color:color-mix(in_srgb,var(--rk-color-red)_12%,transparent)] border-[var(--rk-border-red)] text-[var(--rk-text-red)]',
  soon: 'bg-[color:color-mix(in_srgb,var(--rk-color-gold)_10%,transparent)] border-[var(--rk-border-gold)] text-[var(--rk-color-gold)]',
};

export default function EmptyState({ icon, title, description, action, variant = 'default', bare, soonLabel = 'Soon' }: Props) {
  const content = (
    <div className="flex flex-col items-center text-center py-8 px-4">
      <div
        className={`w-16 h-16 mb-4 flex items-center justify-center rounded-[var(--rk-radius-xl)] border ${ICON_STYLE[variant]}`}
      >
        <i className={`${icon} text-3xl`} aria-hidden />
      </div>
      {variant === 'soon' && (
        <span className="inline-block text-[10px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-[var(--rk-radius-pill)] bg-[color:color-mix(in_srgb,var(--rk-color-gold)_10%,transparent)] text-[var(--rk-color-gold)] mb-3">
          {soonLabel}
        </span>
      )}
      <h3 className="text-[18px] font-bold text-[var(--rk-text-primary)] leading-tight">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-[var(--rk-text-quiet)]">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
  if (bare) return content;
  return <Card variant="quiet" padding="none">{content}</Card>;
}
