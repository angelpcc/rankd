import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getViewAs, clearViewAs, VIEW_AS_EVENT, VIEW_AS_BLOCKED_EVENT, type ViewAsState,
} from '@/lib/viewAs';

/**
 * Barra fija del modo "Ver como".
 *
 * Va montada a nivel de App, así que aparece en TODA la plataforma mientras el
 * modo está activo: nunca puedes olvidarte de que no estás viendo tu cuenta.
 * También es el único sitio desde el que se sale, para que salir esté siempre
 * a un clic sin depender de la navegación del perfil que estés revisando.
 */
export default function ViewAsBar() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [view, setView] = useState<ViewAsState | null>(() => getViewAs());
  const [blocked, setBlocked] = useState(false);

  // Sincronización con el estado global
  useEffect(() => {
    const sync = () => setView(getViewAs());
    window.addEventListener(VIEW_AS_EVENT, sync);
    return () => window.removeEventListener(VIEW_AS_EVENT, sync);
  }, []);

  // Aviso cuando el guardián bloquea una escritura
  useEffect(() => {
    const onBlocked = () => {
      setBlocked(true);
      window.setTimeout(() => setBlocked(false), 3200);
    };
    window.addEventListener(VIEW_AS_BLOCKED_EVENT, onBlocked);
    return () => window.removeEventListener(VIEW_AS_BLOCKED_EVENT, onBlocked);
  }, []);

  // Empuja el contenido y las barras fijas hacia abajo mientras el modo está
  // activo, para que la barra no tape la navegación de cada pantalla.
  useEffect(() => {
    const cls = 'rk-viewas-on';
    document.body.classList.toggle(cls, !!view);
    return () => document.body.classList.remove(cls);
  }, [view]);

  const exit = useCallback(() => {
    clearViewAs();
    navigate('/admin');
  }, [navigate]);

  if (!view) return null;

  return (
    <>
      <div
        role="status"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          zIndex: 10050,
          boxSizing: 'border-box',
          // La barra reserva el hueco del notch/barra de estado: su contenido
          // (38px) se centra POR DEBAJO del safe-area, no encima. Sin esto, en
          // móviles con notch la barra quedaba metida bajo la barra de estado y
          // todo el contenido se solapaba hacia arriba.
          height: 'calc(var(--rk-viewas-h) + env(safe-area-inset-top, 0px))',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          background: blocked
            ? 'linear-gradient(90deg, #7f1d1d 0%, #991b1b 100%)'
            : 'linear-gradient(90deg, #C9A84C 0%, #a8894a 100%)',
          color: '#0a0a0a',
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 12px',
          boxShadow: '0 2px 14px rgba(0,0,0,0.45)',
          transition: 'background 0.3s ease',
        }}
      >
        {blocked ? (
          <>
            <i className="ri-lock-2-fill" style={{ fontSize: 16, color: '#fff', flexShrink: 0 }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, color: '#fff', flex: 1, minWidth: 0, lineHeight: 1.2 }}>
              {t('va_blocked')}
              <span className="va-hide-sm" style={{ fontWeight: 400, opacity: 0.9 }}> · {t('va_blocked_desc')}</span>
            </span>
          </>
        ) : (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
              <i className="ri-eye-line" style={{ fontSize: 15 }} />
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 2 }}>{t('va_bar_mode')}</span>
            </span>

            <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
              <span className="va-hide-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, opacity: 0.75 }}>
                {t('va_bar_viewing')}:
              </span>
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13.5, fontWeight: 700,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {view.label}
              </span>
              <span className="va-hide-sm" style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
                background: 'rgba(0,0,0,0.22)', padding: '2px 7px', borderRadius: 99, flexShrink: 0,
              }}>
                {t('va_bar_readonly')}
              </span>
            </span>
          </>
        )}

        <button
          onClick={exit}
          style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 8,
            padding: '6px 12px', cursor: 'pointer',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, fontWeight: 700,
            letterSpacing: 0.5, whiteSpace: 'nowrap',
          }}
        >
          <i className="ri-logout-box-line" style={{ fontSize: 13 }} />
          <span className="va-hide-sm">{t('va_bar_exit')}</span>
          <span className="va-only-sm">{t('va_bar_exit_short')}</span>
        </button>
      </div>

      <style>{`
        :root { --rk-viewas-h: 38px; }
        /* Altura total ocupada por la barra = su contenido + el notch. */
        :root { --rk-viewas-total: calc(var(--rk-viewas-h) + env(safe-area-inset-top, 0px)); }

        /* Empuja el contenido normal y baja las barras fijas de cada pantalla,
           que están pegadas a top:0 (algunas con estilo en línea: por eso el
           !important, que sí gana a un estilo en línea sin !important).
           La barra de modo vista YA cubre el notch, así que las barras que
           empujamos no deben volver a reservar el safe-area (padding-top:0),
           o el hueco se contaría dos veces. */
        body.rk-viewas-on { padding-top: var(--rk-viewas-total); }
        body.rk-viewas-on nav,
        body.rk-viewas-on .rk-safe-top,
        body.rk-viewas-on .sticky.top-\\[60px\\] {
          top: var(--rk-viewas-total) !important;
          padding-top: 0 !important;
        }
        /* La franja negra tras la barra de estado ya la tapa la barra de modo
           vista (que va por encima); la ocultamos para no duplicarla. */
        body.rk-viewas-on::before { display: none; }

        .va-only-sm { display: none; }
        @media (max-width: 640px) {
          .va-hide-sm { display: none !important; }
          .va-only-sm { display: inline !important; }
        }
      `}</style>
    </>
  );
}
