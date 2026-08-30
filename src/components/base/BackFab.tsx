import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Botón flotante para volver atrás.
 * Solo se muestra cuando RANKD se ha instalado como app en el móvil,
 * porque en ese modo no existe la flecha del navegador.
 * En la web normal permanece oculto (lo controla el CSS).
 */
export default function BackFab() {
  const navigate = useNavigate();
  const location = useLocation();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    // history.length > 1 significa que hay algo a lo que volver
    setCanGoBack(window.history.length > 1);
  }, [location.pathname]);

  // En la portada no tiene sentido volver atrás
  const isHome = location.pathname === '/' || location.pathname === '/beta';
  // Mi Esquina y el temporizador ya llevan su propia flecha de volver en la
  // cabecera: no duplicamos con una flotante encima (una por pantalla).
  const hasHeaderBack = location.pathname.startsWith('/mi-esquina');
  if (isHome || hasHeaderBack || !canGoBack) return null;

  return (
    <button
      className="rk-back-fab"
      aria-label="Volver atrás"
      onClick={() => {
        if (window.history.length > 1) navigate(-1);
        else navigate('/beta');
      }}
    >
      <i className="ri-arrow-left-line" />
    </button>
  );
}