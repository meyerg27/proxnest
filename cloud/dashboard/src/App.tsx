/**
 * ProxNest Cloud — App Router
 * Login/Register, Server List, Proxied Dashboard, Account Settings
 * Lazy-loaded pages for optimized bundle splitting
 */

import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { CloudLayout } from './components/CloudLayout';

/* Lazy-loaded pages — each becomes its own chunk */
const LoginPage = lazy(() => import('./pages/Login').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/Register').then(m => ({ default: m.RegisterPage })));
const ServerListPage = lazy(() => import('./pages/ServerList').then(m => ({ default: m.ServerListPage })));
const ServerDashboardPage = lazy(() => import('./pages/ServerDashboard').then(m => ({ default: m.ServerDashboardPage })));
const AccountPage = lazy(() => import('./pages/Account').then(m => ({ default: m.AccountPage })));
const OnboardingPage = lazy(() => import('./pages/Onboarding').then(m => ({ default: m.OnboardingPage })));
const InstallPage = lazy(() => import('./pages/Install').then(m => ({ default: m.InstallPage })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-nest-400 border-t-transparent" />
        <p className="text-xs text-nest-400">Loading…</p>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-nest-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-nest-400 border-t-transparent" />
          <p className="text-sm text-nest-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function RedirectIfAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/install" element={<InstallPage />} />
        <Route path="/login" element={<RedirectIfAuth><LoginPage /></RedirectIfAuth>} />
        <Route path="/register" element={<RedirectIfAuth><RegisterPage /></RedirectIfAuth>} />

        {/* Onboarding — protected but outside CloudLayout */}
        <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />

        {/* Protected routes */}
        <Route element={<RequireAuth><CloudLayout /></RequireAuth>}>
          <Route index element={<ServerListPage />} />
          <Route path="/servers" element={<ServerListPage />} />
          <Route path="/servers/:id" element={<ServerDashboardPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
