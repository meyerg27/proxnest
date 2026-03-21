/**
 * ProxNest Cloud — App Router
 * Login/Register, Server List, Proxied Dashboard, Account Settings
 */

import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { ServerListPage } from './pages/ServerList';
import { ServerDashboardPage } from './pages/ServerDashboard';
import { AccountPage } from './pages/Account';
import { OnboardingPage } from './pages/Onboarding';
import { CloudLayout } from './components/CloudLayout';

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
    <Routes>
      {/* Public routes */}
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
  );
}
