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
const TermsPage = lazy(() => import('../pages/terms/page'));
const EsquinaPage = lazy(() => import('../pages/esquina/page'));
const StorePage = lazy(() => import('../pages/tienda/page'));
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
    path: '/esquina',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <EsquinaPage />
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