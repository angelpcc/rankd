import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import NotFound from '../pages/NotFound';
import PublicGate from '../components/feature/PublicGate';
import PreviewEntry from '../pages/preview-entry/page';
import RouteLoading from './RouteLoading';


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
const PromotorasPage = lazy(() => import('../pages/promotoras/page'));
const EventoDetailPage = lazy(() => import('../pages/evento/page'));
const TermsPage = lazy(() => import('../pages/terms/page'));
const AvisoLegalPage = lazy(() => import('../pages/aviso-legal/page'));
const EsquinaPage = lazy(() => import('../pages/esquina/page'));
const MiEsquinaPage = lazy(() => import('../pages/mi-esquina/page'));
const TimerPage = lazy(() => import('../pages/timer/page'));
const PlanPrintPage = lazy(() => import('../pages/plan-print/page'));
const ReportPrintPage = lazy(() => import('../pages/informe-print/page'));
const StorePage = lazy(() => import('../pages/tienda/page'));
const NewsPage = lazy(() => import('../pages/noticias/page'));
const AdminPage = lazy(() => import('../pages/admin/page'));
const CreatorStudioPage = lazy(() => import('../pages/creator-studio/page'));
const ClubPage = lazy(() => import('../pages/club/page'));
const ClubInvitePage = lazy(() => import('../pages/club/invite/page'));
const PromotoraPublicPage = lazy(() => import('../pages/promotora/page'));
const MarcaPublicPage = lazy(() => import('../pages/marca/page'));
const PrivacyPage = lazy(() => import('../pages/privacy/page'));

// RANKD aún no está lanzada: las rutas de CONTENIDO van envueltas en
// <PublicGate> (muestran "Próximamente" salvo acceso interno / sesión).
// Ver src/components/feature/PublicGate.tsx y ACCESO_DEMO.md.
const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <PublicGate><Home /></PublicGate>
      </Suspense>
    ),
  },
  // /beta mantiene el mismo componente que / mientras existan enlaces internos
  // apuntando ahí (top bar de Mi Esquina, botones "volver a home").
  {
    path: '/beta',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <PublicGate><Home /></PublicGate>
      </Suspense>
    ),
  },
  // ── Acceso interno: no enlazado, cubierto por robots.txt "Disallow: /" ──
  {
    path: '/vista-previa-rk28',
    element: <PreviewEntry />,
  },
  {
    path: '/auth',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <AuthPage />
      </Suspense>
    ),
  },
  {
    path: '/registro',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <RegistroPage />
      </Suspense>
    ),
  },
  {
    path: '/onboarding/fighter',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <FighterOnboardingPage />
      </Suspense>
    ),
  },
  {
    path: '/onboarding/org',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <OrgOnboardingPage />
      </Suspense>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <DashboardPage />
      </Suspense>
    ),
  },
  {
    path: '/dashboard/fighter',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <DashboardPage />
      </Suspense>
    ),
  },
  {
    path: '/dashboard/org',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <DashboardPage />
      </Suspense>
    ),
  },
  {
    path: '/dashboard/brand',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <DashboardPage />
      </Suspense>
    ),
  },
  {
    path: '/fighter/:id',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <PublicGate><FighterPublicPage /></PublicGate>
      </Suspense>
    ),
  },
  {
    path: '/fighters',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <PublicGate><FightersDirectoryPage /></PublicGate>
      </Suspense>
    ),
  },
  {
    path: '/opportunities',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <PublicGate><OpportunitiesPage /></PublicGate>
      </Suspense>
    ),
  },
  {
    path: '/brands',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <PublicGate><BrandsPage /></PublicGate>
      </Suspense>
    ),
  },
  {
    path: '/eventos',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <PublicGate><EventosPage /></PublicGate>
      </Suspense>
    ),
  },
  {
    path: '/como-funciona',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <PublicGate><ComoFuncionaPage /></PublicGate>
      </Suspense>
    ),
  },
  {
    path: '/promotoras',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <PublicGate><PromotorasPage /></PublicGate>
      </Suspense>
    ),
  },
  {
    path: '/promotora/:id',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <PublicGate><PromotoraPublicPage /></PublicGate>
      </Suspense>
    ),
  },
  {
    path: '/marca/:id',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <PublicGate><MarcaPublicPage /></PublicGate>
      </Suspense>
    ),
  },
  {
    path: '/evento/:id',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <PublicGate><EventoDetailPage /></PublicGate>
      </Suspense>
    ),
  },
  {
    path: '/esquina',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <PublicGate><EsquinaPage /></PublicGate>
      </Suspense>
    ),
  },
  {
    path: '/mi-esquina',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <MiEsquinaPage />
      </Suspense>
    ),
  },
  {
    path: '/mi-esquina/timer',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <TimerPage />
      </Suspense>
    ),
  },
  {
    path: '/mi-esquina/plan/imprimir',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <PlanPrintPage />
      </Suspense>
    ),
  },
  {
    path: '/mi-esquina/informe/imprimir',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <ReportPrintPage />
      </Suspense>
    ),
  },
  {
    path: '/club',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <ClubPage />
      </Suspense>
    ),
  },
  {
    path: '/unirse',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <ClubInvitePage />
      </Suspense>
    ),
  },
  {
    path: '/noticias',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <PublicGate><NewsPage /></PublicGate>
      </Suspense>
    ),
  },
  {
    path: '/admin',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <AdminPage />
      </Suspense>
    ),
  },
  {
    path: '/creator-studio',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <CreatorStudioPage />
      </Suspense>
    ),
  },
  {
    path: '/tienda',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <PublicGate><StorePage /></PublicGate>
      </Suspense>
    ),
  },
  {
    path: '/terms',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <TermsPage />
      </Suspense>
    ),
  },
  {
    path: '/privacy',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <PrivacyPage />
      </Suspense>
    ),
  },
  // Alias legales (LEGAL_RANKD): /aviso-legal es nuevo; /privacidad es alias
  // en español de /privacy para poder enlazarla con URL localizada.
  {
    path: '/privacidad',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <PrivacyPage />
      </Suspense>
    ),
  },
  {
    path: '/aviso-legal',
    element: (
      <Suspense fallback={<RouteLoading />}>
        <AvisoLegalPage />
      </Suspense>
    ),
  },
  {
    path: '*',
    element: <NotFound />,
  },
];

export default routes;
