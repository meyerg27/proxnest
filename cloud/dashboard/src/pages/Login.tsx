/**
 * ProxNest Cloud — Login Page
 */

import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Cloud, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-nest-950 flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px]
          bg-nest-500/5 rounded-full blur-[128px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl
            bg-gradient-to-br from-nest-500 to-nest-600 shadow-lg shadow-nest-500/20 mb-4">
            <Cloud size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back
          </h1>
          <p className="text-sm text-nest-400 mt-1">
            Sign in to your ProxNest Cloud account
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 glow-border space-y-5">
          {error && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-nest-300 mb-1.5">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-2.5
                text-sm text-white placeholder-nest-500
                focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20
                transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-nest-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-2.5 pr-10
                  text-sm text-white placeholder-nest-500
                  focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20
                  transition-colors"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-nest-500 hover:text-nest-300"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full flex items-center justify-center gap-2 rounded-lg
              bg-gradient-to-r from-nest-500 to-nest-600 px-4 py-2.5
              text-sm font-semibold text-white shadow-lg shadow-nest-500/20
              hover:from-nest-400 hover:to-nest-500 transition-all
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                Sign In
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Register link */}
        <p className="text-center text-sm text-nest-400 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-nest-300 hover:text-white font-medium transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
