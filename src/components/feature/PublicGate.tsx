import { type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { isPreviewUnlocked } from '@/lib/previewGate';
import ComingSoonPage from '@/pages/coming-soon/page';

// ── Puerta pública ──
//
// RANKD todavía no está lanzada. Las rutas de contenido (Home y directorios)
// van envueltas en <PublicGate>: un visitante cualquiera ve "Próximamente".
// Se abre de dos formas, sin contraseña:
//   1. Visitando una vez la ruta no enlazada de PreviewEntry (/vista-previa-rk28),
//      que deja una marca en localStorage — el punto de entrada para revisar/
//      grabar la app (ver ACCESO_DEMO.md).
//   2. Teniendo sesión iniciada (las cuentas demo entran por el punto 1 y
//      luego hacen login con normalidad).
//
// Rutas que NO se cierran aquí: /auth, /registro, /onboarding, /dashboard,
// /mi-esquina, /club, legales e imprimibles — o requieren login de por sí, o
// hacen falta para que el flujo demo funcione.
export default function PublicGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // localStorage es síncrono → sin parpadeo para quien ya entró por PreviewEntry.
  if (isPreviewUnlocked() || user) return <>{children}</>;
  return <ComingSoonPage />;
}
