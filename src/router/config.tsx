import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import NotFound from '../pages/NotFound';

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#0B0B0B]">
    <div className="w-8 h-8 border-2 border-[#E10600] border-t-transparent rounded-full animate-spin" />
  </div>
);

const ComingSoonPage = lazy(() => import('../pages/coming-soon/page'));
const Home = lazy(() => import('../pages/home/page'));
const AuthPage = lazy(() => import('../pages/auth/page'));
const RegistroPage = lazy(() => import('../pages/registro/page'));
const DashboardPage = lazy(() => import('../pages/dashboard/page'));
const FighterPublicPage = lazy(() => import('../pages/fighter/page'));
const FightersDirectoryPage = lazy(() => import('../pages/fighters/page'));
const OpportunitiesPage = lazy(() => import('../pages/opportunities/page'));
const FighterOnboardingPage = lazy(() => import('../pages/onboarding/fighter/page'));
const OrgOnboardingPage = lazy(() => import('../pages/onboarding/org/page'));
const BrandsPage = lazy(() => import('../pages/brands/page'));
const EventosPage = lazy(() => import('../pages/eventos/page'));
const ComoFuncionaPage = lazy(() => import('../pages/como-funciona/page'));
const EventoDetailPage = lazy(() => import('../pages/evento/page'));
const TermsPage = lazy(() => import('../pages/terms/page'));
const EsquinaPage = lazy(() => import('../pages/esquina/page'));
const MiEsquinaPage = lazy(() => import('../pages/mi-esquina/page'));
const StorePage = lazy(() => import('../pages/tienda/page'));
const NewsPage = lazy(() => import('../pages/noticias/page'));
const AdminPage = lazy(() => import('../pages/admin/page'));
const PrivacyPage = lazy(() => import('../pages/privacy/page'));

const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <ComingSoonPage />
      </Suspense>
    ),
  },
  {
    path: '/beta',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <Home />
      </Suspense>
    ),
  },
  {
    path: '/auth',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <AuthPage />
      </Suspense>
    ),
  },
  {
    path: '/registro',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <RegistroPage />
      </Suspense>
    ),
  },
  {
    path: '/onboarding/fighter',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <FighterOnboardingPage />
      </Suspense>
    ),
  },
  {
    path: '/onboarding/org',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <OrgOnboardingPage />
      </Suspense>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <DashboardPage />
      </Suspense>
    ),
  },
  {
    path: '/dashboard/fighter',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <DashboardPage />
      </Suspense>
    ),
  },
  {
    path: '/dashboard/org',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <DashboardPage />
      </Suspense>
    ),
  },
  {
    path: '/dashboard/brand',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <DashboardPage />
      </Suspense>
    ),
  },
  {
    path: '/fighter/:id',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <FighterPublicPage />
      </Suspense>
    ),
  },
  {
    path: '/fighters',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <FightersDirectoryPage />
      </Suspense>
    ),
  },
  {
    path: '/opportunities',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <OpportunitiesPage />
      </Suspense>
    ),
  },
  {
    path: '/brands',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <BrandsPage />
      </Suspense>
    ),
  },
  {
    path: '/eventos',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <EventosPage />
      </Suspense>
    ),
  },
  {
    path: '/como-funciona',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <ComoFuncionaPage />
      </Suspense>
    ),
  },
  {
    path: '/evento/:id',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <EventoDetailPage />
      </Suspense>
    ),
  },
  {
    path: '/esquina',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <EsquinaPage />
      </Suspense>
    ),
  },
  {
    path: '/mi-esquina',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <MiEsquinaPage />
      </Suspense>
    ),
  },
  {
    path: '/noticias',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <NewsPage />
      </Suspense>
    ),
  },
  {
    path: '/admin',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <AdminPage />
      </Suspense>
    ),
  },
  {
    path: '/tienda',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <StorePage />
      </Suspense>
    ),
  },
  {
    path: '/terms',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <TermsPage />
      </Suspense>
    ),
  },
  {
    path: '/privacy',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <PrivacyPage />
      </Suspense>
    ),
  },
  {
    path: '*',
    element: <NotFound />,
  },
];

export default routes;