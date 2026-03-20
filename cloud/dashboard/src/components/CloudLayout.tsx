/**
 * ProxNest Cloud — Layout Shell
 * Top nav bar, sidebar for mobile, content area.
 */

import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  Server, User, LogOut, Menu, X, Cloud, ChevronDown,
} from 'lucide-react';
import { clsx } from 'clsx';

const navItems = [
  { to: '/', label: 'Servers', icon: Server },
  { to: '/account', label: 'Account', icon: User },
];

export function CloudLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-nest-950">
      {/* ─── Top Navbar ────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-nest-400/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-nest-500 to-nest-600">
                <Cloud size={16} className="text-white" />
              </div>
              <span className="text-lg font-bold text-white">
                Prox<span className="text-nest-400">Nest</span>
                <span className="text-xs text-nest-500 ml-1.5 font-normal">Cloud</span>
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.to ||
                  (item.to === '/' && location.pathname.startsWith('/servers'));
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'bg-nest-500/15 text-nest-300'
                        : 'text-nest-400 hover:text-white hover:bg-nest-800/50',
                    )}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              {/* Desktop user dropdown */}
              <div className="relative hidden md:block">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-nest-300
                    hover:bg-nest-800/50 transition-colors"
                >
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-nest-500 to-nest-600
                    flex items-center justify-center text-xs font-bold text-white">
                    {(user?.display_name || user?.email || '?')[0].toUpperCase()}
                  </div>
                  <span className="max-w-[120px] truncate">
                    {user?.display_name || user?.email}
                  </span>
                  <ChevronDown size={14} className={clsx(
                    'transition-transform',
                    userMenuOpen && 'rotate-180',
                  )} />
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 glass rounded-xl border border-nest-400/10
                      shadow-xl z-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-nest-400/10">
                        <p className="text-sm font-medium text-white truncate">
                          {user?.display_name || 'No Name'}
                        </p>
                        <p className="text-xs text-nest-400 truncate">{user?.email}</p>
                        <span className={clsx(
                          'inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full font-medium uppercase',
                          user?.plan === 'pro'
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-nest-800 text-nest-400',
                        )}>
                          {user?.plan} plan
                        </span>
                      </div>
                      <Link
                        to="/account"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-nest-300
                          hover:bg-nest-800/50 transition-colors"
                      >
                        <User size={14} />
                        Account Settings
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-rose-400
                          hover:bg-rose-500/10 transition-colors"
                      >
                        <LogOut size={14} />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-lg text-nest-400 hover:text-white hover:bg-nest-800/50"
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* ─── Mobile Nav ──────────────────────── */}
        {mobileOpen && (
          <div className="md:hidden border-t border-nest-400/10 glass">
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'bg-nest-500/15 text-nest-300'
                        : 'text-nest-400 hover:text-white',
                    )}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ─── Content ───────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        <Outlet />
      </main>
    </div>
  );
}
