import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/Layout';
import { LoginPage } from '@/pages/Login';
import { SetupPage } from '@/pages/Setup';
import { DashboardPage } from '@/pages/Dashboard';
import { NodesPage } from '@/pages/Nodes';
import { StoragePage } from '@/pages/Storage';
import { AppsStorePage } from '@/pages/AppsStore';
import { InstalledAppsPage } from '@/pages/InstalledApps';
import { UsersPage } from '@/pages/Users';
import { SettingsPage } from '@/pages/Settings';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-nest-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-nest-400 border-t-transparent" />
          <span className="text-nest-300 text-sm">Loading ProxNest...</span>
        </div>
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/login" />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/nodes" element={<NodesPage />} />
                <Route path="/storage" element={<StoragePage />} />
                <Route path="/apps" element={<AppsStorePage />} />
                <Route path="/apps/installed" element={<InstalledAppsPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
