import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Shield, ArrowRight } from 'lucide-react';

export function SetupPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await register(form.username, form.email, form.password);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-nest-950 px-4">
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-nest-500/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-2xl mb-4 shadow-lg shadow-emerald-500/20">
            <Shield className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white">Set Up ProxNest</h1>
          <p className="text-sm text-nest-400 mt-1">Create your admin account to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 glow-border space-y-5">
          {error && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-nest-300 mb-1.5">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-2.5 text-sm text-white placeholder-nest-500 focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20"
              placeholder="admin"
              required
              minLength={3}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-nest-300 mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-2.5 text-sm text-white placeholder-nest-500 focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20"
              placeholder="admin@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-nest-300 mb-1.5">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-2.5 text-sm text-white placeholder-nest-500 focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20"
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-nest-300 mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-2.5 text-sm text-white placeholder-nest-500 focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20"
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600
              px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25
              hover:from-emerald-400 hover:to-emerald-500 transition-all
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                Create Admin Account
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
