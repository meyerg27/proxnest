/**
 * ProxNest Cloud — Register Page
 */

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Cloud, Eye, EyeOff, ArrowRight, Loader2, Check } from 'lucide-react';
import { clsx } from 'clsx';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordChecks = [
    { label: 'At least 8 characters', valid: password.length >= 8 },
    { label: 'Contains a number', valid: /\d/.test(password) },
    { label: 'Contains uppercase', valid: /[A-Z]/.test(password) },
  ];
  const passwordValid = passwordChecks.every((c) => c.valid);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await register(email, password, displayName || undefined);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
            Create your account
          </h1>
          <p className="text-sm text-nest-400 mt-1">
            Access your servers from anywhere
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
            <label htmlFor="displayName" className="block text-xs font-medium text-nest-300 mb-1.5">
              Display name <span className="text-nest-600">(optional)</span>
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              autoFocus
              className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-2.5
                text-sm text-white placeholder-nest-500
                focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20
                transition-colors"
              placeholder="John"
            />
          </div>

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
                autoComplete="new-password"
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

            {/* Password strength indicators */}
            {password.length > 0 && (
              <div className="mt-2 space-y-1">
                {passwordChecks.map((check) => (
                  <div key={check.label} className="flex items-center gap-2">
                    <div className={clsx(
                      'h-3.5 w-3.5 rounded-full flex items-center justify-center transition-colors',
                      check.valid ? 'bg-emerald-500/20' : 'bg-nest-800',
                    )}>
                      {check.valid && <Check size={8} className="text-emerald-400" />}
                    </div>
                    <span className={clsx(
                      'text-[11px] transition-colors',
                      check.valid ? 'text-emerald-400' : 'text-nest-500',
                    )}>
                      {check.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !email || !passwordValid}
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
                Create Account
                <ArrowRight size={16} />
              </>
            )}
          </button>

          {/* Free tier info */}
          <div className="rounded-lg bg-nest-800/30 px-4 py-3 text-center">
            <p className="text-xs text-nest-400">
              Free plan includes <span className="text-nest-300 font-medium">1 server</span>.
              Upgrade to Pro for unlimited servers.
            </p>
          </div>
        </form>

        {/* Login link */}
        <p className="text-center text-sm text-nest-400 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-nest-300 hover:text-white font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
