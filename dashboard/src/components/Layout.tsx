import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Server,
  HardDrive,
  Package,
  PackageCheck,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
} from 'lucide-react';
import { clsx } from 'clsx';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/nodes', icon: Server, label: 'Nodes' },
  { path: '/storage', icon: HardDrive, label: 'Storage' },
  { path: '/apps', icon: Package, label: 'App Store' },
  { path: '/apps/installed', icon: PackageCheck, label: 'Installed' },
  { path: '/users', icon: Users, label: 'Users' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

function Sidebar({ mobile, onClose }: { mobile?: boolean; onClose?: () => void }) {
  const { user, logout } = useAuth();

  return (
    <aside
      className={clsx(
        'flex flex-col bg-nest-900/80 backdrop-blur-xl border-r border-nest-400/10',
        mobile ? 'fixed inset-y-0 left-0 z-50 w-64' : 'hidden lg:flex w-64 shrink-0',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-nest-400/10">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-nest-500 to-nest-700 text-lg font-bold">
          🏠
        </div>
        <div>
          <span className="text-lg font-bold bg-gradient-to-r from-white to-nest-300 bg-clip-text text-transparent">
            ProxNest
          </span>
          <span className="block text-[10px] text-nest-400 -mt-0.5">v0.1.0</span>
        </div>
        {mobile && (
          <button onClick={onClose} className="ml-auto text-nest-400 hover:text-white">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-nest-500/15 text-nest-300 glow-border-active'
                  : 'text-nest-400 hover:text-white hover:bg-nest-800/50',
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-nest-400/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-nest-700 text-sm font-bold uppercase">
            {user?.display_name?.[0] || user?.username?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.display_name || user?.username}</p>
            <p className="text-xs text-nest-400 truncate">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="text-nest-400 hover:text-red-400 transition-colors"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const location = useLocation();
  const { user } = useAuth();

  const currentPage = navItems.find((item) => {
    if (item.path === '/') return location.pathname === '/';
    return location.pathname.startsWith(item.path);
  });

  return (
    <header className="flex items-center gap-4 h-16 px-6 border-b border-nest-400/10 bg-nest-900/50 backdrop-blur-md shrink-0">
      <button
        onClick={onMenuClick}
        className="lg:hidden text-nest-400 hover:text-white"
      >
        <Menu size={22} />
      </button>

      <div className="flex-1">
        <h1 className="text-lg font-semibold text-white">{currentPage?.label || 'ProxNest'}</h1>
      </div>

      {/* Quick actions */}
      <button className="relative text-nest-400 hover:text-white transition-colors">
        <Bell size={20} />
        <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-nest-500 border-2 border-nest-900 text-[8px] font-bold flex items-center justify-center">
          3
        </span>
      </button>

      <div className="hidden sm:flex items-center gap-2 text-sm text-nest-300">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-nest-700 text-xs font-bold uppercase">
          {user?.username?.[0] || '?'}
        </div>
        <span>{user?.username}</span>
        <ChevronDown size={14} className="text-nest-400" />
      </div>
    </header>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-nest-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar />
      {sidebarOpen && <Sidebar mobile onClose={() => setSidebarOpen(false)} />}

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
