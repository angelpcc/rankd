import { useTranslation } from 'react-i18next';
import Skeleton from './Skeleton';
import EmptyArt, { type EmptyArtKind } from './EmptyArt';

// Estados de pantalla (carga · vacío · error · sin conexión) con un solo
// aspecto. El color de marca es rojo; el icono nunca es la única señal —
// siempre hay texto.
//
// Carga = esqueleto con la forma del contenido final, no un spinner: así la
// pantalla no salta cuando llegan los datos.
// Vacío = ilustración SVG propia + una frase que empuja a la acción, nunca un
// "no hay datos" gris.

type Variant = 'loading' | 'empty' | 'error' | 'offline';

interface Props {
  variant: Variant;
  /** Título. Si falta, se usa el genérico de la variante. */
  title?: string;
  description?: string;
  /** Ilustración del estado vacío. Si falta, se usa el icono de Remix. */
  art?: EmptyArtKind;
  /** Icono de Remix, como respaldo cuando no hay ilustración propia. */
  icon?: string;
  /** Acción de salida (reintentar, registrar el primero…). */
  action?: { label: string; onClick: () => void };
  /** Esqueleto a medida para esta pantalla, en vez del genérico. */
  skeleton?: React.ReactNode;
  className?: string;
}

const FALLBACK_ICON: Record<Variant, string> = {
  loading: 'ri-loader-4-line',
  empty: 'ri-inbox-line',
  error: 'ri-error-warning-line',
  offline: 'ri-wifi-off-line',
};

export default function StateBlock({
  variant, title, description, art, icon, action, skeleton, className = '',
}: Props) {
  const { t } = useTranslation();

  if (variant === 'loading') {
    return (
      <div className={className} role="status" aria-busy="true" aria-label={title || t('mc_state_loading')}>
        {skeleton ?? <Skeleton />}
      </div>
    );
  }

  const isError = variant === 'error' || variant === 'offline';
  const heading = title || (variant === 'empty' ? t('mc_state_empty') : variant === 'offline' ? t('mc_state_offline') : t('mc_state_error'));
  const body = description ?? (variant === 'offline' ? t('mc_state_offline_desc') : variant === 'error' ? t('mc_state_error_desc') : undefined);
  // El error tiene su propia ilustración: una diana fallada no pega, pero una
  // lupa vacía tampoco — para error/offline se mantiene el icono.
  const showArt = variant === 'empty' && !!art;

  return (
    <div className={`rk-card rk-enter text-center max-w-lg mx-auto ${className}`} style={{ padding: '40px 26px' }} role={isError ? 'alert' : undefined}>
      {showArt ? (
        <div className="flex justify-center mb-4">
          <EmptyArt kind={art} size={104} />
        </div>
      ) : (
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
      )}
      <p className="text-white font-bold">{heading}</p>
      {body && <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--t-2)' }}>{body}</p>}
      {action && (
        <button onClick={action.onClick} style={{ minHeight: 44 }} className="rk-cta rk-press mt-5 px-6">
          {action.label}
        </button>
      )}
    </div>
  );
}
