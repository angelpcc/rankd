import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Profile } from '@/lib/supabase';
import LanguageSelector from '@/components/feature/LanguageSelector';

function RankdLogo() {
  return (
    <div className="flex items-center gap-0">
      <span
        className="font-unbounded font-black tracking-tighter leading-none"
        style={{ fontSize: '18px', color: '#FFFFFF', letterSpacing: '-0.04em' }}
      >
        RAN
      </span>
      <span
        className="font-unbounded font-black tracking-tighter leading-none"
        style={{ fontSize: '18px', color: '#E10600', letterSpacing: '-0.04em' }}
      >
        KD
      </span>
    </div>
  );
}

interface Props { profile: Profile; }

const roleConfig: Record<string, { label: string; icon: string; badge: string; dashRoute: string }> = {
  fighter:  { label: 'Peleador',          icon: 'ri-boxing-line',          badge: 'bg-red-600/20 text-red-400 border-red-500/30',           dashRoute: '/dashboard/fighter' },
  promoter: { label: 'Promotora',         icon: 'ri-trophy-line',          badge: 'bg-zinc-700 text-zinc-300 border-zinc-600',              dashRoute: '/dashboard/org' },
  gym:      { label: 'Gimnasio',          icon: 'ri-building-4-line',      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', dashRoute: '/dashboard/org' },
  manager:  { label: 'Manager',           icon: 'ri-user-star-line',       badge: 'bg-zinc-700 text-zinc-300 border-zinc-600',              dashRoute: '/dashboard/org' },
  brand:    { label: 'Marca',             icon: 'ri-store-2-line',         badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',  dashRoute: '/dashboard/brand' },
  organizer:{ label: 'Organizador',       icon: 'ri-calendar-event-line',  badge: 'bg-zinc-700 text-zinc-300 border-zinc-600',              dashRoute: '/dashboard/org' },
};

export default function DashboardNav({ profile }: Props) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const role = roleConfig[profile.user_type] ?? roleConfig.promoter;
  const initials = (profile.full_name || 'U').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-zinc-900 border-b border-zinc-800 rk-safe-top">
      <div className="mx-auto px-3 sm:px-4 md:px-6 flex items-center justify-between h-14 sm:h-16 min-w-0">

        {/* Left: Logo + Dashboard link */}
        <div className="flex items-center gap-4">
          <Link to={role.dashRoute} className="flex items-center cursor-pointer">
            <RankdLogo />
          </Link>

          {/* Role badge — desktop */}
          <span className={`hidden sm:inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${role.badge}`}>
            <i className={`${role.icon} text-xs`}></i>
            {role.label}
          </span>
        </div>

        {/* Center: Quick nav links */}
        <div className="hidden md:flex items-center gap-1">
          <Link
            to="/opportunities"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 px-3 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap"
          >
            <i className="ri-megaphone-line"></i>
            {t('dash_opportunities')}
          </Link>
          <Link
            to="/fighters"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 px-3 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap"
          >
            <i className="ri-group-line"></i>
            {t('dash_fighters')}
          </Link>
          <Link
            to={role.dashRoute}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 px-3 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap"
          >
            <i className="ri-dashboard-line"></i>
            {t('dash_my_dashboard')}
          </Link>
        </div>

        {/* Right: Language + User menu */}
        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <LanguageSelector dark />
          </div>
          {/* Avatar + name button */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl px-3 py-2 transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold flex-shrink-0">
                {initials}
              </div>
              <span className="text-zinc-300 text-sm hidden sm:block max-w-[100px] truncate">
                {profile.full_name?.split(' ')[0] || role.label}
              </span>
              {menuOpen
                ? <i className="ri-arrow-up-s-line text-zinc-500 text-xs hidden sm:block"></i>
                : <i className="ri-arrow-down-s-line text-zinc-500 text-xs hidden sm:block"></i>
              }
            </button>

            {/* Dropdown */}
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-52 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-zinc-800">
                    <p className="text-sm font-semibold text-white truncate">{profile.full_name || 'Usuario'}</p>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border mt-1 ${role.badge}`}>
                      <i className={`${role.icon} text-xs`}></i>
                      {role.label}
                    </span>
                  </div>

                  {/* Links */}
                  <div className="py-1">
                    <Link
                      to={role.dashRoute}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <i className="ri-dashboard-line text-zinc-500"></i>
                      {t('dash_my_dashboard')}
                    </Link>
                    <Link
                      to="/opportunities"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <i className="ri-megaphone-line text-zinc-500"></i>
                      {t('dash_opportunities')}
                    </Link>
                    <Link
                      to="/fighters"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <i className="ri-group-line text-zinc-500"></i>
                      {t('nav_directory')}
                    </Link>
                  </div>

                  <div className="border-t border-zinc-800 py-1">
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <i className="ri-logout-box-line"></i>
                      {t('dash_sign_out')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}