import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import FighterDashboard from './components/FighterDashboard';
import OrgDashboard from './components/OrgDashboard';
import BrandDashboard from './components/BrandDashboard';

function getDashboardRoute(userType: string): string {
  switch (userType) {
    case 'fighter': return '/dashboard/fighter';
    case 'coach': return '/club';
    case 'brand': return '/dashboard/brand';
    case 'promoter':
    case 'gym':
    case 'manager':
    case 'organizer': return '/dashboard/org';
    default: return '/dashboard/org';
  }
}

export default function DashboardPage() {
  const { user, profile, loading, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [profileTimeout, setProfileTimeout] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }
    // If user lands on /dashboard (no subroute), redirect to the correct one
    if (!loading && profile && location.pathname === '/dashboard') {
      navigate(getDashboardRoute(profile.user_type), { replace: true });
    }
    // Un entrenador no tiene panel de organización: su sitio es el espacio de club.
    if (!loading && profile && profile.user_type === 'coach' && location.pathname.startsWith('/dashboard')) {
      navigate('/club', { replace: true });
    }
  }, [user, profile, loading, navigate, location.pathname]);

  // If profile is still null after loading, show timeout message after 8s
  useEffect(() => {
    if (!loading && user && !profile) {
      const t = setTimeout(() => setProfileTimeout(true), 8000);
      return () => clearTimeout(t);
    }
  }, [loading, user, profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-400 text-sm">{t('dash_loading')}</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          {!profileTimeout ? (
            <>
              <div className="w-8 h-8 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-zinc-400 text-sm">{t('dash_setting_up')}</p>
              <p className="text-zinc-600 text-xs mt-2">{t('dash_setting_up_desc')}</p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 flex items-center justify-center rounded-full bg-zinc-800 mx-auto mb-4">
                <i className="ri-user-settings-line text-2xl text-zinc-400"></i>
              </div>
              <h2 className="text-white font-bold text-lg mb-2">{t('dash_profile_not_found')}</h2>
              <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                {t('dash_profile_not_found_desc')}
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { setProfileTimeout(false); if (refetchProfile) refetchProfile(); }}
                  className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-3 rounded-xl cursor-pointer whitespace-nowrap transition-colors"
                >
                  {t('dash_retry')}
                </button>
                <button
                  onClick={() => navigate('/auth')}
                  className="text-zinc-500 hover:text-zinc-300 text-sm cursor-pointer transition-colors"
                >
                  {t('dash_back_login')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const userType = profile.user_type;

  if (userType === 'fighter') return <FighterDashboard profile={profile} />;
  if (userType === 'brand') return <BrandDashboard profile={profile} />;
  return <OrgDashboard profile={profile} />;
}
