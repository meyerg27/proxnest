/**
 * ProxNest Cloud — Server List Page
 * Shows all user's ProxNest servers with online/offline status, claim flow.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api, type CloudServer, type ServerMetrics, normalizeMetrics } from '../lib/api';
import {
  Server, Plus, Wifi, WifiOff, Cpu, MemoryStick, HardDrive,
  ExternalLink, Trash2, Edit3, Check, X, Loader2, Copy,
  MonitorSmartphone, Clock, ArrowRight,
} from 'lucide-react';
import { clsx } from 'clsx';

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function MetricBar({ label, value, max, unit, color }: {
  label: string; value: number; max: number; unit: string; color: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-nest-400">{label}</span>
        <span className="text-nest-300">{value.toFixed(1)} / {max.toFixed(0)} {unit}</span>
      </div>
      <div className="h-1.5 rounded-full bg-nest-800">
        <div
          className={clsx('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ServerCard({ server, onRemove, onRename }: {
  server: CloudServer & { metrics?: ServerMetrics };
  onRemove: (id: number) => void;
  onRename: (id: number, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(server.name);

  const handleSaveName = () => {
    if (newName.trim() && newName !== server.name) {
      onRename(server.id, newName.trim());
    }
    setEditing(false);
  };

  return (
    <div className={clsx(
      'glass rounded-xl p-5 glow-border glass-hover transition-all relative group',
      server.is_online && 'ring-1 ring-emerald-500/20',
    )}>
      {/* Status indicator */}
      <div className={clsx(
        'absolute top-4 right-4 flex items-center gap-1.5',
      )}>
        <div className={clsx(
          'h-2 w-2 rounded-full',
          server.is_online ? 'bg-emerald-400 animate-pulse' : 'bg-nest-600',
        )} />
        <span className={clsx(
          'text-xs font-medium',
          server.is_online ? 'text-emerald-400' : 'text-nest-500',
        )}>
          {server.is_online ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Server info */}
      <div className="flex items-start gap-3 mb-4">
        <div className={clsx(
          'flex h-10 w-10 items-center justify-center rounded-lg',
          server.is_online
            ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/5'
            : 'bg-nest-800/50',
        )}>
          <Server size={20} className={server.is_online ? 'text-emerald-400' : 'text-nest-500'} />
        </div>
        <div className="flex-1 min-w-0 pr-16">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditing(false); }}
                autoFocus
                className="flex-1 rounded border border-nest-400/20 bg-nest-900/50 px-2 py-1
                  text-sm text-white focus:outline-none focus:border-nest-400/40"
              />
              <button onClick={handleSaveName} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded">
                <Check size={14} />
              </button>
              <button onClick={() => setEditing(false)} className="p-1 text-nest-400 hover:bg-nest-800 rounded">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-white truncate">{server.name}</h3>
              <button
                onClick={() => { setNewName(server.name); setEditing(true); }}
                className="p-0.5 text-nest-600 hover:text-nest-300 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Edit3 size={12} />
              </button>
            </div>
          )}
          <p className="text-xs text-nest-400 truncate mt-0.5">
            {server.hostname || server.agent_id.slice(0, 12)}
          </p>
        </div>
      </div>

      {/* System specs */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-[11px] text-nest-400">
        {server.os && (
          <span className="flex items-center gap-1">
            <MonitorSmartphone size={10} />
            {server.os}
          </span>
        )}
        {server.cpu_model && (
          <span className="flex items-center gap-1">
            <Cpu size={10} />
            {server.cpu_cores || '?'} cores
          </span>
        )}
        {server.ram_total_mb && (
          <span className="flex items-center gap-1">
            <MemoryStick size={10} />
            {(server.ram_total_mb / 1024).toFixed(0)} GB
          </span>
        )}
        {server.proxmox_version && (
          <span>PVE {server.proxmox_version}</span>
        )}
      </div>

      {/* Live metrics (if online) */}
      {server.is_online && server.metrics && (
        <div className="space-y-2 mb-4">
          <MetricBar
            label="CPU"
            value={server.metrics.cpu_usage}
            max={100}
            unit="%"
            color="bg-indigo-500"
          />
          <MetricBar
            label="RAM"
            value={server.metrics.ram_used_mb / 1024}
            max={server.metrics.ram_total_mb / 1024}
            unit="GB"
            color="bg-emerald-500"
          />
          <MetricBar
            label="Disk"
            value={server.metrics.disk_used_gb}
            max={server.metrics.disk_total_gb}
            unit="GB"
            color="bg-amber-500"
          />
          <div className="flex items-center gap-3 text-[10px] text-nest-500 mt-1">
            <span className="flex items-center gap-1">
              <Clock size={9} />
              Up {formatUptime(server.metrics.uptime_seconds)}
            </span>
            <span>{server.metrics.containers_running}/{server.metrics.containers_total} containers</span>
          </div>
        </div>
      )}

      {/* Last seen (if offline) */}
      {!server.is_online && server.last_seen && (
        <div className="flex items-center gap-1.5 mb-4 text-xs text-nest-500">
          <Clock size={11} />
          Last seen {formatLastSeen(server.last_seen)}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {server.is_online ? (
          <Link
            to={`/servers/${server.id}`}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
              bg-nest-500/15 text-nest-300 hover:bg-nest-500/25 transition-colors"
          >
            <ExternalLink size={12} />
            Open Dashboard
            <ArrowRight size={12} />
          </Link>
        ) : (
          <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs
            bg-nest-800/30 text-nest-600 cursor-not-allowed">
            <WifiOff size={12} />
            Server Offline
          </div>
        )}
        <button
          onClick={() => onRemove(server.id)}
          className="flex items-center justify-center h-8 w-8 rounded-lg
            bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
          title="Remove server"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Claim Server Modal ──────────────────────────

function ClaimModal({ onClose, onClaim }: {
  onClose: () => void;
  onClaim: (token: string, name: string) => Promise<void>;
}) {
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onClaim(token.trim(), name.trim() || 'My Server');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative glass rounded-2xl p-8 glow-border w-full max-w-md space-y-5">
        <div>
          <h2 className="text-lg font-bold text-white">Add Server</h2>
          <p className="text-sm text-nest-400 mt-1">
            Enter the claim code shown when your ProxNest agent first connected.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-nest-300 mb-1.5">Claim Code</label>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value.toUpperCase())}
            required
            placeholder="e.g. AB12CD34"
            className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-2.5
              text-sm text-white font-mono tracking-wider text-center uppercase
              placeholder-nest-500
              focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-nest-300 mb-1.5">
            Server Name <span className="text-nest-600">(optional)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Home Server"
            className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-2.5
              text-sm text-white placeholder-nest-500
              focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium
              text-nest-400 hover:text-white hover:bg-nest-800/50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || token.trim().length < 6}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg
              bg-gradient-to-r from-nest-500 to-nest-600 px-4 py-2.5
              text-sm font-semibold text-white shadow-lg shadow-nest-500/20
              hover:from-nest-400 hover:to-nest-500 transition-all
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Claim Server'}
          </button>
        </div>
      </form>
    </div>
  );
}

// Need FormEvent type
import type { FormEvent } from 'react';

// ─── Main Page ───────────────────────────────────

export function ServerListPage() {
  const { user } = useAuth();
  const [servers, setServers] = useState<(CloudServer & { metrics?: ServerMetrics })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClaim, setShowClaim] = useState(false);

  const fetchServers = useCallback(async () => {
    try {
      const { servers: list } = await api.getServers();
      // Fetch metrics for online servers
      const enriched = await Promise.all(
        list.map(async (s) => {
          if (s.is_online) {
            try {
              const { server } = await api.getServer(s.id);
              return { ...server, metrics: normalizeMetrics(server.metrics) };
            } catch {
              return s;
            }
          }
          return s;
        }),
      );
      setServers(enriched);
    } catch (err) {
      console.error('Failed to fetch servers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
    const interval = setInterval(fetchServers, 30_000);
    return () => clearInterval(interval);
  }, [fetchServers]);

  const handleClaim = async (token: string, name: string) => {
    await api.claimServer(token, name);
    await fetchServers();
  };

  const handleRemove = async (id: number) => {
    const server = servers.find((s) => s.id === id);
    if (!server) return;
    if (!confirm(`Remove "${server.name}"? The agent will become unclaimed and you can re-add it later.`)) return;
    await api.removeServer(id);
    setServers((prev) => prev.filter((s) => s.id !== id));
  };

  const handleRename = async (id: number, name: string) => {
    await api.updateServer(id, { name });
    setServers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name } : s)),
    );
  };

  const onlineCount = servers.filter((s) => s.is_online).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Your Servers</h1>
          <p className="text-sm text-nest-400 mt-0.5">
            {servers.length === 0
              ? 'No servers connected yet'
              : `${onlineCount} of ${servers.length} online`}
          </p>
        </div>
        <button
          onClick={() => setShowClaim(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg
            bg-gradient-to-r from-nest-500 to-nest-600 text-sm font-semibold text-white
            shadow-lg shadow-nest-500/20 hover:from-nest-400 hover:to-nest-500 transition-all"
        >
          <Plus size={16} />
          Add Server
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-nest-400 border-t-transparent" />
        </div>
      )}

      {/* Empty state */}
      {!loading && servers.length === 0 && (
        <div className="glass rounded-2xl p-12 text-center glow-border">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-nest-800/50 flex items-center justify-center">
              <Server size={32} className="text-nest-600" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No servers yet</h2>
          <p className="text-sm text-nest-400 max-w-md mx-auto mb-6">
            Install the ProxNest agent on your Proxmox server. It'll display a claim code
            that you can enter here to link it to your account.
          </p>
          <div className="glass rounded-xl p-4 max-w-sm mx-auto text-left space-y-2">
            <p className="text-xs text-nest-300 font-medium">Quick Start:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-nest-400 bg-nest-900/50 rounded px-3 py-2 font-mono">
                curl -fsSL https://proxnest.com/install.sh | bash
              </code>
              <button
                onClick={() => navigator.clipboard.writeText('curl -fsSL https://proxnest.com/install.sh | bash')}
                className="p-2 text-nest-400 hover:text-white hover:bg-nest-800 rounded transition-colors"
                title="Copy"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowClaim(true)}
            className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-lg
              bg-gradient-to-r from-nest-500 to-nest-600 text-sm font-semibold text-white
              shadow-lg shadow-nest-500/20 hover:from-nest-400 hover:to-nest-500 transition-all"
          >
            <Plus size={16} />
            I have a claim code
          </button>
        </div>
      )}

      {/* Server grid */}
      {!loading && servers.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {servers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              onRemove={handleRemove}
              onRename={handleRename}
            />
          ))}
        </div>
      )}

      {/* Plan info */}
      {!loading && user && (
        <div className="glass rounded-xl p-4 flex items-center justify-between">
          <div className="text-xs text-nest-400">
            <span className="text-nest-300 font-medium">{servers.length}</span> of{' '}
            <span className="text-nest-300 font-medium">
              {user.plan === 'pro' ? '∞' : user.max_servers}
            </span>{' '}
            servers used
            <span className={clsx(
              'ml-2 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase',
              user.plan === 'pro' ? 'bg-amber-500/15 text-amber-400' : 'bg-nest-800 text-nest-500',
            )}>
              {user.plan}
            </span>
          </div>
          {user.plan === 'free' && servers.length >= user.max_servers && (
            <button className="text-xs text-nest-300 hover:text-white font-medium transition-colors">
              Upgrade to Pro →
            </button>
          )}
        </div>
      )}

      {/* Claim modal */}
      {showClaim && (
        <ClaimModal
          onClose={() => setShowClaim(false)}
          onClaim={handleClaim}
        />
      )}
    </div>
  );
}
