import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useApi } from '@/hooks/useApi';
import { system, users as usersApi } from '@/lib/api';
import { Settings as SettingsIcon, Shield, Activity, Lock, Save, Check, Server } from 'lucide-react';
import { clsx } from 'clsx';
import type { HealthStatus } from '@/types/api';

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl glow-border overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-nest-400/10">
        <Icon size={18} className="text-nest-400" />
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  const { data: healthData } = useApi(() => system.health());
  const health = healthData as HealthStatus | null;

  // Password change state
  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);

    if (passwords.newPass !== passwords.confirm) {
      setPwMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    setPwLoading(true);
    try {
      await usersApi.changePassword(passwords.current, passwords.newPass);
      setPwMessage({ type: 'success', text: 'Password updated successfully' });
      setPasswords({ current: '', newPass: '', confirm: '' });
    } catch (err: unknown) {
      setPwMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to change password' });
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* System Health */}
      <Section title="System Status" icon={Activity}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg bg-nest-800/50 p-4">
            <p className="text-xs text-nest-400 uppercase tracking-wider mb-1">API Version</p>
            <p className="text-sm font-medium text-white">{health?.version || '...'}</p>
          </div>
          <div className="rounded-lg bg-nest-800/50 p-4">
            <p className="text-xs text-nest-400 uppercase tracking-wider mb-1">Proxmox Connection</p>
            <p className={clsx(
              'text-sm font-medium flex items-center gap-2',
              health?.proxmox.connected ? 'text-emerald-400' : 'text-rose-400',
            )}>
              <span className={clsx('h-2 w-2 rounded-full', health?.proxmox.connected ? 'bg-emerald-400' : 'bg-rose-400')} />
              {health?.proxmox.connected ? 'Connected' : 'Disconnected'}
            </p>
            {health?.proxmox.error && (
              <p className="text-xs text-rose-400/70 mt-1 truncate">{health.proxmox.error}</p>
            )}
          </div>
          <div className="rounded-lg bg-nest-800/50 p-4">
            <p className="text-xs text-nest-400 uppercase tracking-wider mb-1">Database</p>
            <p className="text-sm font-medium text-white">{health?.database || '...'}</p>
          </div>
          <div className="rounded-lg bg-nest-800/50 p-4">
            <p className="text-xs text-nest-400 uppercase tracking-wider mb-1">App Templates</p>
            <p className="text-sm font-medium text-white">{health?.appTemplates || 0} available</p>
          </div>
          <div className="rounded-lg bg-nest-800/50 p-4 sm:col-span-2">
            <p className="text-xs text-nest-400 uppercase tracking-wider mb-1">API Uptime</p>
            <p className="text-sm font-medium text-white">
              {health ? formatUptime(health.uptime) : '...'}
            </p>
          </div>
        </div>
      </Section>

      {/* Change Password */}
      <Section title="Change Password" icon={Lock}>
        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-sm">
          {pwMessage && (
            <div className={clsx(
              'rounded-lg px-4 py-3 text-sm border',
              pwMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400',
            )}>
              {pwMessage.text}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-nest-300 mb-1.5">Current Password</label>
            <input
              type="password"
              value={passwords.current}
              onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
              className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-2.5 text-sm text-white
                placeholder-nest-500 focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-nest-300 mb-1.5">New Password</label>
            <input
              type="password"
              value={passwords.newPass}
              onChange={(e) => setPasswords({ ...passwords, newPass: e.target.value })}
              className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-2.5 text-sm text-white
                placeholder-nest-500 focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20"
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-nest-300 mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={passwords.confirm}
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
              className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-2.5 text-sm text-white
                placeholder-nest-500 focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20"
              required
              minLength={8}
            />
          </div>

          <button
            type="submit"
            disabled={pwLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-nest-500/15 text-nest-300
              hover:bg-nest-500/25 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {pwLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-nest-400 border-t-transparent" />
            ) : (
              <Save size={14} />
            )}
            Update Password
          </button>
        </form>
      </Section>

      {/* Account Info */}
      <Section title="Account" icon={Shield}>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-nest-400/5">
            <span className="text-sm text-nest-400">Username</span>
            <span className="text-sm text-white font-mono">@{user?.username}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-nest-400/5">
            <span className="text-sm text-nest-400">Email</span>
            <span className="text-sm text-white">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-nest-400/5">
            <span className="text-sm text-nest-400">Role</span>
            <span className={clsx(
              'text-xs px-2.5 py-1 rounded-full font-medium',
              user?.role === 'admin' ? 'text-amber-400 bg-amber-500/10' : 'text-nest-300 bg-nest-800/50',
            )}>
              {user?.role}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-nest-400">Member Since</span>
            <span className="text-sm text-white">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '...'}
            </span>
          </div>
        </div>
      </Section>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d} day${d !== 1 ? 's' : ''}`);
  if (h > 0) parts.push(`${h} hour${h !== 1 ? 's' : ''}`);
  parts.push(`${m} min${m !== 1 ? 's' : ''}`);
  return parts.join(', ');
}
