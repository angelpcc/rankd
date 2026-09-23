import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ── Después de publicar una versión nueva ──
//
// Todas las páginas se cargan bajo demanda (lazy). Quien tenía la app abierta
// —sobre todo instalada en el móvil, que no se cierra nunca— sigue con la
// versión vieja en memoria, y al tocar un botón que lleva a otra pantalla
// pide un archivo que ya no existe en el servidor: el botón "no hace nada".
// Vite avisa con `vite:preloadError`; se recarga UNA vez para coger la
// versión nueva. La marca evita un bucle si el fallo fuera otro (sin red).
const RECARGA = 'rankd_recarga_version';
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  try {
    if (sessionStorage.getItem(RECARGA) === '1') return;
    sessionStorage.setItem(RECARGA, '1');
  } catch { /* sin almacenamiento: se recarga igual */ }
  window.location.reload();
});
// Si la carga fue bien, se quita la marca para que la próxima versión nueva
// también pueda recargar.
window.addEventListener('load', () => {
  setTimeout(() => { try { sessionStorage.removeItem(RECARGA); } catch { /* nada */ } }, 10000);
});

// Registrar service worker (permite instalar RANKD como app en el móvil)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}