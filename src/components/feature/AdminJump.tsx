import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { isAdminEmail } from '@/lib/admin';
import { isViewingAs } from '@/lib/viewAs';

/**
 * Botón de vuelta al panel de administración.
 *
 * El enlace a /admin vivía SOLO en la barra de navegación pública (Navbar), y
 * ni los dashboards ni Mi Esquina la pintan: una vez dentro de su propio
 * espacio, el administrador se quedaba sin ninguna forma de llegar al panel
 * salvo escribiendo la URL a mano.
 *
 * No se pinta para nadie más que el administrador, ni durante el modo "Ver
 * como" (ahí manda la barra dorada, que ya tiene su propia salida).
 */
export default function AdminJump({ className = '' }: { className?: string }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!isAdminEmail(user?.email) || isViewingAs()) return null;

  return (
    <button
      onClick={() => navigate('/admin')}
      title={t('nav_admin')}
      aria-label={t('nav_admin')}
      className={`flex items-center justify-center rounded-xl cursor-pointer transition-colors flex-shrink-0 ${className}`}
      style={{
        width: 40, height: 40,
        background: 'rgba(201,168,76,0.12)',
        border: '1px solid rgba(201,168,76,0.35)',
        color: '#C9A84C',
      }}
    >
      <i className="ri-shield-star-line text-lg" />
    </button>
  );
}
