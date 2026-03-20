import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/api';
import { Eye, EyeOff, LogIn } from 'lucide-react';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  useEffect(() => {
    auth.setupRequired().then(({ setupRequired }) => {
      if (setupRequired) navigate('/setup');
    }).catch(() => {});
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-nest-950 px-4">
      {/* Background glow */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-nest-500/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-nest-500 to-nest-700 text-2xl mb-4 shadow-lg shadow-nest-500/20">
            🏠
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to ProxNest</h1>
          <p className="text-sm text-nest-400 mt-1">Sign in to your server</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 glow-border space-y-5">
          {error && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-nest-300 mb-1.5">Username or Email</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-2.5 text-sm text-white
                placeholder-nest-500 focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20
                transition-colors"
              placeholder="admin"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-nest-300 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-2.5 text-sm text-white
                  placeholder-nest-500 focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20
                  transition-colors pr-10"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-nest-400 hover:text-nest-300"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-nest-500 to-nest-600
              px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-nest-500/25
              hover:from-nest-400 hover:to-nest-500 transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <LogIn size={16} />
                Sign In
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
