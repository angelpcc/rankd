import { useTranslation } from 'react-i18next';

// Estados de pantalla (carga · vacío · error · sin conexión) con un solo
// aspecto. Antes cada sección se pintaba su propio bloque a mano y salían
// spinners de colores distintos y vacíos sin salida. El color de marca es
// rojo; el icono nunca es la única señal — siempre hay texto.

type Variant = 'loading' | 'empty' | 'error' | 'offline';

interface Props {
  variant: Variant;
  /** Título. Si falta, se usa el genérico de la variante. */
  title?: string;
  description?: string;
  icon?: string;
  /** Acción de salida (reintentar, registrar el primero…). */
  action?: { label: string; onClick: () => void };
  className?: string;
}

const FALLBACK_ICON: Record<Variant, string> = {
  loading: 'ri-loader-4-line',
  empty: 'ri-inbox-line',
  error: 'ri-error-warning-line',
  offline: 'ri-wifi-off-line',
};

export default function StateBlock({ variant, title, description, icon, action, className = '' }: Props) {
  const { t } = useTranslation();

  if (variant === 'loading') {
    return (
      <div className={`flex flex-col items-center justify-center py-20 ${className}`} role="status" aria-live="polite">
        <div className="w-8 h-8 border-2 border-[#E10600] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs mt-3" style={{ color: 'var(--t-3)' }}>{title || t('mc_state_loading')}</p>
      </div>
    );
  }

  const isError = variant === 'error' || variant === 'offline';
  const heading = title || (variant === 'empty' ? t('mc_state_empty') : variant === 'offline' ? t('mc_state_offline') : t('mc_state_error'));
  const body = description ?? (variant === 'offline' ? t('mc_state_offline_desc') : variant === 'error' ? t('mc_state_error_desc') : undefined);

  return (
    <div className={`rk-card text-center max-w-lg mx-auto ${className}`} style={{ padding: '40px 26px' }} role={isError ? 'alert' : undefined}>
      <div
        className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-2xl"
        style={{
          background: isError ? 'var(--accent-dim)' : 'var(--s-2)',
          border: `1px solid ${isError ? 'rgba(225,6,0,0.28)' : 'var(--s-3)'}`,
          color: isError ? 'var(--accent)' : 'var(--t-3)',
        }}
      >
        <i className={`${icon || FALLBACK_ICON[variant]} text-2xl`} />
      </div>
      <p className="text-white font-bold">{heading}</p>
      {body && <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--t-2)' }}>{body}</p>}
      {action && (
        <button onClick={action.onClick} style={{ minHeight: 44 }} className="rk-cta mt-5 px-6">
          {action.label}
        </button>
      )}
    </div>
  );
}
