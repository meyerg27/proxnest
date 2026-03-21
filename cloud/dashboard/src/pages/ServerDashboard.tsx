/**
 * ProxNest Cloud — Server Dashboard (Proxied)
 * Renders the user's local ProxNest dashboard through the cloud WebSocket tunnel.
 * Fetches data via /api/v1/proxy/:serverId/* routes.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, type CloudServer, type ServerMetrics, normalizeMetrics } from '../lib/api';
import {
  ArrowLeft, Server, Wifi, WifiOff, Cpu, MemoryStick, HardDrive,
  Container, RefreshCw, Terminal, Activity, Clock, Loader2,
  Box, Play, Square, RotateCw, ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';

// ─── Types for proxied data ──────────────────────

interface ProxiedResource {
  id: string;
  vmid: number;
  name: string;
  type: 'qemu' | 'lxc';
  node: string;
  status: string;
  cpu: number;
  maxcpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime: number;
}

interface ProxiedSummary {
  cluster: {
    cpu: { used: number; total: number; percent: number };
    memory: { usedGB: number; totalGB: number; percent: number };
    disk: { usedGB: number; totalGB: number; percent: number };
    nodes: number;
  };
  guests: {
    running: number;
    stopped: number;
    vms: number;
    containers: number;
  };
  apps: number;
}

// ─── Stat Card ───────────────────────────────────

function StatCard({ label, value, subtitle, percent, color }: {
  label: string; value: string; subtitle: string; percent?: number; color: string;
}) {
  return (
    <div className="glass rounded-xl p-4 glow-border">
      <p className="text-xs text-nest-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-xs text-nest-500 mt-0.5">{subtitle}</p>
      {percent !== undefined && (
        <div className="mt-2 h-1.5 rounded-full bg-nest-800">
          <div
            className={clsx('h-full rounded-full transition-all', color)}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Resource Row ────────────────────────────────

function ResourceRow({ resource, onAction, loading }: {
  resource: ProxiedResource;
  onAction: (vmid: number, type: string, action: string) => void;
  loading: boolean;
}) {
  const cpuPct = resource.maxcpu > 0 ? (resource.cpu / resource.maxcpu) * 100 : 0;
  const memPct = resource.maxmem > 0 ? (resource.mem / resource.maxmem) * 100 : 0;
  const isRunning = resource.status === 'running';

  return (
    <div className="glass rounded-lg p-4 glass-hover transition-all">
      <div className="flex items-center gap-3">
        {/* Status dot */}
        <div className={clsx(
          'h-2 w-2 rounded-full flex-shrink-0',
          isRunning ? 'bg-emerald-400' : 'bg-nest-600',
        )} />

        {/* Icon */}
        <div className={clsx(
          'flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0',
          resource.type === 'qemu' ? 'bg-indigo-500/10' : 'bg-cyan-500/10',
        )}>
          {resource.type === 'qemu'
            ? <Box size={14} className="text-indigo-400" />
            : <Container size={14} className="text-cyan-400" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">{resource.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-nest-800 text-nest-400">
              {resource.vmid}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-nest-800/50 text-nest-500 uppercase">
              {resource.type}
            </span>
          </div>
          {isRunning && (
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1.5">
                <Cpu size={10} className="text-nest-500" />
                <div className="w-16 h-1 rounded-full bg-nest-800">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${cpuPct}%` }} />
                </div>
                <span className="text-[10px] text-nest-400">{cpuPct.toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MemoryStick size={10} className="text-nest-500" />
                <div className="w-16 h-1 rounded-full bg-nest-800">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${memPct}%` }} />
                </div>
                <span className="text-[10px] text-nest-400">{memPct.toFixed(0)}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {loading ? (
            <Loader2 size={14} className="animate-spin text-nest-400" />
          ) : isRunning ? (
            <>
              <button
                onClick={() => onAction(resource.vmid, resource.type, 'reboot')}
                className="p-1.5 rounded text-nest-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                title="Restart"
              >
                <RotateCw size={13} />
              </button>
              <button
                onClick={() => onAction(resource.vmid, resource.type, 'stop')}
                className="p-1.5 rounded text-nest-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Stop"
              >
                <Square size={13} />
              </button>
            </>
          ) : (
            <button
              onClick={() => onAction(resource.vmid, resource.type, 'start')}
              className="p-1.5 rounded text-nest-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              title="Start"
            >
              <Play size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────

export function ServerDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const serverId = parseInt(id || '0', 10);

  const [server, setServer] = useState<(CloudServer & { metrics?: ServerMetrics }) | null>(null);
  const [summary, setSummary] = useState<ProxiedSummary | null>(null);
  const [resources, setResources] = useState<ProxiedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      // Fetch server info
      const { server: srv } = await api.getServer(serverId);
      setServer({ ...srv, metrics: normalizeMetrics(srv.metrics) });

      if (!srv.is_online) {
        setError('Server is offline');
        return;
      }

      setError(null);
      // Set loading false early so we show server info immediately
      setLoading(false);

      // Try proxy requests (non-blocking — page shows server info while these load)
      try {
        const [summaryRes, resourcesRes] = await Promise.allSettled([
          api.proxyGet<ProxiedSummary>(serverId, '/api/v1/dashboard/summary'),
          api.proxyGet<{ resources: ProxiedResource[] }>(serverId, '/api/v1/nodes/resources'),
        ]);
        if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
        if (resourcesRes.status === 'fulfilled') setResources(resourcesRes.value.resources || []);
      } catch {
        // Proxy failed — that's OK, we still show agent metrics
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serverId]);

  useEffect(() => {
    if (serverId) {
      fetchData();
      const interval = setInterval(() => fetchData(), 15_000);
      return () => clearInterval(interval);
    }
  }, [serverId, fetchData]);

  const handleAction = async (vmid: number, type: string, action: string) => {
    setActionLoading(vmid);
    try {
      await api.sendCommand(serverId, `${type}.${action}`, { vmid, node: 'pve' });
      setTimeout(() => fetchData(), 2000);
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-nest-400 border-t-transparent" />
          <p className="text-sm text-nest-400">Connecting to server...</p>
        </div>
      </div>
    );
  }

  // Server not found
  if (!server) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-nest-400">Server not found.</p>
        <Link to="/" className="text-nest-300 hover:text-white text-sm mt-2 inline-block">
          ← Back to servers
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-lg text-nest-400 hover:text-white hover:bg-nest-800/50 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{server.name}</h1>
              <div className={clsx(
                'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
                server.is_online
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-nest-800 text-nest-500',
              )}>
                {server.is_online ? <Wifi size={10} /> : <WifiOff size={10} />}
                {server.is_online ? 'Online' : 'Offline'}
              </div>
            </div>
            <p className="text-xs text-nest-400 mt-0.5">
              {server.hostname} • {server.os} • PVE {server.proxmox_version}
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
            glass text-nest-300 hover:text-white transition-colors"
        >
          <RefreshCw size={14} className={clsx(refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
          {error}
        </div>
      )}

      {/* Stats */}
      {server.is_online && summary && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label="CPU Usage"
              value={`${summary.cluster.cpu.percent}%`}
              subtitle={`${summary.cluster.cpu.used} / ${summary.cluster.cpu.total} cores`}
              percent={summary.cluster.cpu.percent}
              color="bg-indigo-500"
            />
            <StatCard
              label="Memory"
              value={`${summary.cluster.memory.usedGB} GB`}
              subtitle={`of ${summary.cluster.memory.totalGB} GB`}
              percent={summary.cluster.memory.percent}
              color="bg-emerald-500"
            />
            <StatCard
              label="Storage"
              value={`${summary.cluster.disk.usedGB} GB`}
              subtitle={`of ${summary.cluster.disk.totalGB} GB`}
              percent={summary.cluster.disk.percent}
              color="bg-amber-500"
            />
            <StatCard
              label="Guests"
              value={`${summary.guests.running}`}
              subtitle={`of ${summary.guests.vms + summary.guests.containers} running`}
              color="bg-cyan-500"
            />
          </div>

          {/* Resources */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">VMs & Containers</h2>
              <span className="text-xs text-nest-400">{resources.length} total</span>
            </div>
            {resources.length === 0 ? (
              <div className="glass rounded-xl p-8 text-center text-nest-400 text-sm">
                No VMs or containers found on this server.
              </div>
            ) : (
              <div className="space-y-2">
                {resources.map((r) => (
                  <ResourceRow
                    key={r.id}
                    resource={r}
                    onAction={handleAction}
                    loading={actionLoading === r.vmid}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Offline state */}
      {!server.is_online && (
        <div className="glass rounded-2xl p-12 text-center glow-border">
          <WifiOff size={48} className="text-nest-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Server is Offline</h2>
          <p className="text-sm text-nest-400 max-w-md mx-auto">
            This server's agent is not connected. Make sure the ProxNest agent
            service is running on your server.
          </p>
          {server.last_seen && (
            <p className="text-xs text-nest-500 mt-4 flex items-center justify-center gap-1">
              <Clock size={11} />
              Last seen: {new Date(server.last_seen).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
