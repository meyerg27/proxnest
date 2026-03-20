/**
 * ProxNest Cloud — Account Settings Page
 * Change password, manage sessions, view account info.
 */

import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api, type CloudSession } from '../lib/api';
import {
  User, Shield, Key, Monitor, Trash2, Loader2, Check, AlertTriangle,
  Clock, Globe, Smartphone, LogOut, Crown, Settings,
} from 'lucide-react';
import { clsx } from 'clsx';

// ─── Section Wrapper ─────────────────────────────

function Section({ title, description, icon: Icon, children }: {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-xl glow-border overflow-hidden">
      <div className="px-6 py-5 border-b border-nest-400/10">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-nest-500/10">
            <Icon size={18} className="text-nest-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            <p className="text-xs text-nest-500 mt-0.5">{description}</p>
          </div>
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ─── Profile Section ─────────────────────────────

function ProfileSection() {
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateProfile({ display_name: displayName || undefined });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Profile" description="Your public display information" icon={User}>
      <form onSubmit={handleSave} className="space-y-4 max-w-md">
        <div>
          <label className="block text-xs font-medium text-nest-300 mb-1.5">Email</label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full rounded-lg border border-nest-400/10 bg-nest-900/30 px-4 py-2.5
              text-sm text-nest-500 cursor-not-allowed"
          />
          <p className="text-[10px] text-nest-600 mt-1">Email cannot be changed</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-nest-300 mb-1.5">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-2.5
              text-sm text-white placeholder-nest-500
              focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20
              transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium
            bg-nest-500/15 text-nest-300 hover:bg-nest-500/25 transition-colors
            disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : saved ? (
            <>
              <Check size={14} className="text-emerald-400" />
              <span className="text-emerald-400">Saved</span>
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </form>
    </Section>
  );
}

// ─── Password Section ────────────────────────────

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const passwordValid = newPassword.length >= 8 && /\d/.test(newPassword) && /[A-Z]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordValid || !passwordsMatch) return;

    setError(null);
    setSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Security" description="Change your password" icon={Shield}>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        {error && (
          <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400 flex items-center gap-2">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400 flex items-center gap-2">
            <Check size={14} />
            Password changed successfully. Other sessions have been revoked.
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-nest-300 mb-1.5">Current Password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-2.5
              text-sm text-white placeholder-nest-500
              focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20
              transition-colors"
            placeholder="••••••••"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-nest-300 mb-1.5">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-2.5
              text-sm text-white placeholder-nest-500
              focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20
              transition-colors"
            placeholder="••••••••"
          />
          {newPassword.length > 0 && !passwordValid && (
            <p className="text-[10px] text-amber-400 mt-1">
              Min 8 chars, one uppercase, one number
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-nest-300 mb-1.5">Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-2.5
              text-sm text-white placeholder-nest-500
              focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20
              transition-colors"
            placeholder="••••••••"
          />
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="text-[10px] text-rose-400 mt-1">Passwords don't match</p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving || !currentPassword || !passwordValid || !passwordsMatch}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium
            bg-nest-500/15 text-nest-300 hover:bg-nest-500/25 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
          Change Password
        </button>
      </form>
    </Section>
  );
}

// ─── Sessions Section ────────────────────────────

function SessionsSection() {
  const [sessions, setSessions] = useState<CloudSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<number | null>(null);

  useEffect(() => {
    api.getSessions()
      .then(({ sessions }) => setSessions(sessions))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleRevoke = async (id: number) => {
    setRevoking(id);
    try {
      await api.revokeSession(id);
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, revoked: 1 } : s)));
    } catch (err) {
      console.error('Failed to revoke session:', err);
    } finally {
      setRevoking(null);
    }
  };

  const activeSessions = sessions.filter((s) => !s.revoked);

  return (
    <Section title="Active Sessions" description="Manage your login sessions" icon={Monitor}>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-nest-400" />
        </div>
      ) : activeSessions.length === 0 ? (
        <p className="text-sm text-nest-500">No active sessions</p>
      ) : (
        <div className="space-y-2">
          {activeSessions.map((session) => {
            const isExpired = new Date(session.expires_at) < new Date();
            return (
              <div
                key={session.id}
                className={clsx(
                  'flex items-center justify-between p-3 rounded-lg',
                  isExpired ? 'bg-nest-900/30' : 'bg-nest-800/30',
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-nest-800/50 flex-shrink-0">
                    {session.user_agent?.toLowerCase().includes('mobile')
                      ? <Smartphone size={14} className="text-nest-400" />
                      : <Globe size={14} className="text-nest-400" />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-nest-300 truncate">
                      {session.ip_address || 'Unknown IP'}
                    </p>
                    <p className="text-[10px] text-nest-500 flex items-center gap-1 mt-0.5">
                      <Clock size={9} />
                      {new Date(session.created_at).toLocaleDateString()}
                      {isExpired && <span className="text-rose-400 ml-1">Expired</span>}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRevoke(session.id)}
                  disabled={revoking === session.id}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-medium
                    text-rose-400 hover:bg-rose-500/10 transition-colors
                    disabled:opacity-50"
                >
                  {revoking === session.id ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <LogOut size={11} />
                  )}
                  Revoke
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

// ─── Plan Section ────────────────────────────────

function PlanSection() {
  const { user } = useAuth();

  return (
    <Section title="Plan & Usage" description="Your current subscription" icon={Crown}>
      <div className="flex items-center gap-4">
        <div className={clsx(
          'flex h-12 w-12 items-center justify-center rounded-xl',
          user?.plan === 'pro'
            ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/5'
            : 'bg-nest-800/50',
        )}>
          <Crown
            size={24}
            className={user?.plan === 'pro' ? 'text-amber-400' : 'text-nest-500'}
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white capitalize">{user?.plan} Plan</h3>
            <span className={clsx(
              'text-[10px] px-2 py-0.5 rounded-full font-medium uppercase',
              user?.plan === 'pro' ? 'bg-amber-500/15 text-amber-400' : 'bg-nest-800 text-nest-400',
            )}>
              {user?.plan}
            </span>
          </div>
          <p className="text-xs text-nest-400 mt-0.5">
            {user?.plan === 'pro'
              ? 'Unlimited servers, priority support'
              : `${user?.max_servers} server${(user?.max_servers || 0) > 1 ? 's' : ''} included`
            }
          </p>
        </div>
      </div>

      {user?.plan === 'free' && (
        <div className="mt-4 rounded-lg bg-gradient-to-r from-amber-500/10 to-nest-500/10 border border-amber-500/20 p-4">
          <p className="text-xs text-nest-300">
            <span className="text-amber-400 font-medium">Upgrade to Pro</span> for unlimited servers,
            priority support, and advanced analytics.
          </p>
          <button className="mt-2 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors">
            View Plans →
          </button>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-nest-400/10">
        <p className="text-[10px] text-nest-600">
          Account created {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
        </p>
      </div>
    </Section>
  );
}

// ─── Main Page ───────────────────────────────────

export function AccountPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings size={20} />
          Account Settings
        </h1>
        <p className="text-sm text-nest-400 mt-0.5">
          Manage your profile, security, and subscription
        </p>
      </div>

      <ProfileSection />
      <PasswordSection />
      <SessionsSection />
      <PlanSection />

      {/* Danger Zone */}
      <div className="glass rounded-xl overflow-hidden border border-rose-500/20">
        <div className="px-6 py-5 border-b border-rose-500/10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10">
              <AlertTriangle size={18} className="text-rose-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-rose-400">Danger Zone</h2>
              <p className="text-xs text-nest-500 mt-0.5">Irreversible actions</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">Delete Account</p>
              <p className="text-xs text-nest-500 mt-0.5">
                Permanently delete your account and all associated data
              </p>
            </div>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium border border-rose-500/30
              text-rose-400 hover:bg-rose-500/10 transition-colors">
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
