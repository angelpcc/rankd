import { Navigate } from 'react-router-dom';
import { unlockPreview } from '@/lib/previewGate';

// Punto de entrada NO enlazado (ver ACCESO_DEMO.md). Visitarlo una vez marca
// este navegador como "acceso interno" y redirige a la Home real. Desde ahí el
// login normal lleva a Mi Esquina / al dashboard según el tipo de cuenta.
//
// El único "candado" es que la URL no está enlazada ni indexada (robots.txt).
export default function PreviewEntry() {
  unlockPreview(); // síncrono: la Home a la que redirigimos ya lo ve
  return <Navigate to="/" replace />;
}
