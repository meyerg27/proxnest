/**
 * ProxNest Cloud — Multi-Server Dashboard Homepage
 * Fleet-wide health overview, aggregate metrics, health alerts, server cards.
 */

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api, type CloudServer, type ServerMetrics, normalizeMetrics } from '../lib/api';
import {
  Server, Plus, WifiOff, Cpu, MemoryStick, HardDrive,
  ExternalLink, Trash2, Edit3, Check, X, Loader2, Copy,
  MonitorSmartphone, Clock, ArrowRight, AlertTriangle,
  Activity, Container, Wifi, LayoutGrid, List, TrendingUp,
  ShieldAlert, Heart, Zap, BarChart3,
} from 'lucide-react';
import { clsx } from 'clsx';

// ─── Helpers ─────────────────────────────────────

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

function getHealthColor(pct: number): string {
  if (pct >= 90) return 'text-rose-400';
  if (pct >= 75) return 'text-amber-400';
  return 'text-emerald-400';
}

function getHealthBg(pct: number): string {
  if (pct >= 90) return 'bg-rose-500';
  if (pct >= 75) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getHealthStatus(servers: EnrichedServer[]): { label: string; color: string; icon: typeof Heart } {
  const online = servers.filter(s => s.is_online);
  if (online.length === 0 && servers.length > 0) return { label: 'All Offline', color: 'text-rose-400', icon: ShieldAlert };
  const critical = online.filter(s => s.metrics && (
    s.metrics.cpu_usage >= 90 ||
    (s.metrics.ram_used_mb / s.metrics.ram_total_mb) * 100 >= 90 ||
    (s.metrics.disk_used_gb / s.metrics.disk_total_gb) * 100 >= 90
  ));
  if (critical.length > 0) return { label: 'Needs Attention', color: 'text-amber-400', icon: AlertTriangle };
  return { label: 'All Healthy', color: 'text-emerald-400', icon: Heart };
}

type EnrichedServer = CloudServer & { metrics?: ServerMetrics };

// ─── Fleet Overview Stats ────────────────────────

function FleetOverview({ servers }: { servers: EnrichedServer[] }) {
  const online = servers.filter(s => s.is_online);
  const offline = servers.filter(s => !s.is_online);
  const withMetrics = online.filter(s => s.metrics);

  const avgCpu = withMetrics.length > 0
    ? withMetrics.reduce((sum, s) => sum + (s.metrics?.cpu_usage ?? 0), 0) / withMetrics.length
    : 0;

  const totalRamUsed = withMetrics.reduce((sum, s) => sum + (s.metrics?.ram_used_mb ?? 0), 0);
  const totalRamTotal = withMetrics.reduce((sum, s) => sum + (s.metrics?.ram_total_mb ?? 0), 0);
  const ramPct = totalRamTotal > 0 ? (totalRamUsed / totalRamTotal) * 100 : 0;

  const totalDiskUsed = withMetrics.reduce((sum, s) => sum + (s.metrics?.disk_used_gb ?? 0), 0);
  const totalDiskTotal = withMetrics.reduce((sum, s) => sum + (s.metrics?.disk_total_gb ?? 0), 0);
  const diskPct = totalDiskTotal > 0 ? (totalDiskUsed / totalDiskTotal) * 100 : 0;

  const totalContainers = withMetrics.reduce((sum, s) => sum + (s.metrics?.containers_running ?? 0), 0);
  const totalContainersAll = withMetrics.reduce((sum, s) => sum + (s.metrics?.containers_total ?? 0), 0);

  const health = getHealthStatus(servers);
  const HealthIcon = health.icon;

  const stats = [
    {
      label: 'Servers Online',
      value: `${online.length}/${servers.length}`,
      sub: offline.length > 0 ? `${offline.length} offline` : 'All connected',
      icon: Wifi,
      color: offline.length > 0 ? 'text-amber-400' : 'text-emerald-400',
      bgColor: offline.length > 0 ? 'from-amber-500/20 to-amber-600/5' : 'from-emerald-500/20 to-emerald-600/5',
    },
    {
      label: 'Avg CPU',
      value: `${avgCpu.toFixed(1)}%`,
      sub: `${withMetrics.reduce((sum, s) => sum + (s.metrics?.cpu_usage ?? 0) > 80 ? sum + 1 : sum, 0)} servers > 80%`,
      icon: Cpu,
      color: getHealthColor(avgCpu),
      bgColor: avgCpu >= 75 ? 'from-amber-500/20 to-amber-600/5' : 'from-indigo-500/20 to-indigo-600/5',
    },
    {
      label: 'Total RAM',
      value: `${(totalRamUsed / 1024).toFixed(1)} GB`,
      sub: `of ${(totalRamTotal / 1024).toFixed(0)} GB (${ramPct.toFixed(0)}%)`,
      icon: MemoryStick,
      color: getHealthColor(ramPct),
      bgColor: ramPct >= 75 ? 'from-amber-500/20 to-amber-600/5' : 'from-emerald-500/20 to-emerald-600/5',
    },
    {
      label: 'Total Disk',
      value: `${totalDiskUsed.toFixed(0)} GB`,
      sub: `of ${totalDiskTotal.toFixed(0)} GB (${diskPct.toFixed(0)}%)`,
      icon: HardDrive,
      color: getHealthColor(diskPct),
      bgColor: diskPct >= 75 ? 'from-amber-500/20 to-amber-600/5' : 'from-amber-500/20 to-amber-600/5',
    },
    {
      label: 'Containers',
      value: `${totalContainers}`,
      sub: `${totalContainersAll} total across fleet`,
      icon: Container,
      color: 'text-violet-400',
      bgColor: 'from-violet-500/20 to-violet-600/5',
    },
    {
      label: 'Fleet Health',
      value: health.label,
      sub: `${withMetrics.length} reporting metrics`,
      icon: HealthIcon,
      color: health.color,
      bgColor: health.color.includes('emerald') ? 'from-emerald-500/20 to-emerald-600/5'
        : health.color.includes('amber') ? 'from-amber-500/20 to-amber-600/5'
        : 'from-rose-500/20 to-rose-600/5',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="glass rounded-xl p-4 glow-border">
            <div className="flex items-center gap-2 mb-2">
              <div className={clsx(
                'flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br',
                stat.bgColor,
              )}>
                <Icon size={16} className={stat.color} />
              </div>
            </div>
            <p className={clsx('text-lg font-bold', stat.color)}>{stat.value}</p>
            <p className="text-[10px] text-nest-400 mt-0.5 leading-tight">{stat.label}</p>
            <p className="text-[9px] text-nest-500 mt-0.5">{stat.sub}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Health Alerts ───────────────────────────────

interface HealthAlert {
  serverId: number;
  serverName: string;
  type: 'cpu' | 'ram' | 'disk' | 'offline';
  value: number;
  message: string;
  severity: 'warning' | 'critical';
}

function getHealthAlerts(servers: EnrichedServer[]): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  for (const s of servers) {
    if (!s.is_online) {
      alerts.push({
        serverId: s.id,
        serverName: s.name,
        type: 'offline',
        value: 0,
        message: `Server offline — last seen ${formatLastSeen(s.last_seen)}`,
        severity: 'critical',
      });
      continue;
    }
    if (!s.metrics) continue;

    if (s.metrics.cpu_usage >= 90) {
      alerts.push({
        serverId: s.id, serverName: s.name, type: 'cpu',
        value: s.metrics.cpu_usage,
        message: `CPU at ${s.metrics.cpu_usage.toFixed(1)}%`,
        severity: 'critical',
      });
    } else if (s.metrics.cpu_usage >= 75) {
      alerts.push({
        serverId: s.id, serverName: s.name, type: 'cpu',
        value: s.metrics.cpu_usage,
        message: `CPU at ${s.metrics.cpu_usage.toFixed(1)}%`,
        severity: 'warning',
      });
    }

    const ramPct = s.metrics.ram_total_mb > 0
      ? (s.metrics.ram_used_mb / s.metrics.ram_total_mb) * 100 : 0;
    if (ramPct >= 90) {
      alerts.push({
        serverId: s.id, serverName: s.name, type: 'ram', value: ramPct,
        message: `RAM at ${ramPct.toFixed(0)}%`,
        severity: 'critical',
      });
    } else if (ramPct >= 80) {
      alerts.push({
        serverId: s.id, serverName: s.name, type: 'ram', value: ramPct,
        message: `RAM at ${ramPct.toFixed(0)}%`,
        severity: 'warning',
      });
    }

    const diskPct = s.metrics.disk_total_gb > 0
      ? (s.metrics.disk_used_gb / s.metrics.disk_total_gb) * 100 : 0;
    if (diskPct >= 90) {
      alerts.push({
        serverId: s.id, serverName: s.name, type: 'disk', value: diskPct,
        message: `Disk at ${diskPct.toFixed(0)}%`,
        severity: 'critical',
      });
    } else if (diskPct >= 80) {
      alerts.push({
        serverId: s.id, serverName: s.name, type: 'disk', value: diskPct,
        message: `Disk at ${diskPct.toFixed(0)}%`,
        severity: 'warning',
      });
    }
  }

  // Sort: critical first
  return alerts.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (b.severity === 'critical' && a.severity !== 'critical') return 1;
    return b.value - a.value;
  });
}

function AlertsBanner({ alerts }: { alerts: HealthAlert[] }) {
  if (alerts.length === 0) return null;

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;

  return (
    <div className={clsx(
      'glass rounded-xl p-4 glow-border border',
      criticalCount > 0 ? 'border-rose-500/20' : 'border-amber-500/20',
    )}>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={16} className={criticalCount > 0 ? 'text-rose-400' : 'text-amber-400'} />
        <h3 className="text-sm font-semibold text-white">
          {alerts.length} Health Alert{alerts.length !== 1 ? 's' : ''}
        </h3>
        {criticalCount > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/15 text-rose-400">
            {criticalCount} critical
          </span>
        )}
      </div>
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {alerts.map((alert, i) => (
          <Link
            key={`${alert.serverId}-${alert.type}-${i}`}
            to={alert.type === 'offline' ? '#' : `/servers/${alert.serverId}`}
            className={clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors',
              alert.severity === 'critical'
                ? 'bg-rose-500/5 hover:bg-rose-500/10'
                : 'bg-amber-500/5 hover:bg-amber-500/10',
            )}
          >
            <div className={clsx(
              'h-1.5 w-1.5 rounded-full flex-shrink-0',
              alert.severity === 'critical' ? 'bg-rose-400' : 'bg-amber-400',
            )} />
            <span className="text-nest-300 font-medium flex-shrink-0">{alert.serverName}</span>
            <span className={clsx(
              alert.severity === 'critical' ? 'text-rose-400' : 'text-amber-400',
            )}>
              {alert.message}
            </span>
            {alert.type !== 'offline' && (
              <ArrowRight size={10} className="ml-auto text-nest-600" />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Metric Bar ──────────────────────────────────

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

// ─── Server Card (Grid View) ─────────────────────

function ServerCard({ server, onRemove, onRename }: {
  server: EnrichedServer;
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
      <div className="absolute top-4 right-4 flex items-center gap-1.5">
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

      {/* Live metrics */}
      {server.is_online && server.metrics && (
        <div className="space-y-2 mb-4">
          <MetricBar label="CPU" value={server.metrics.cpu_usage} max={100} unit="%" color="bg-indigo-500" />
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

      {/* Offline last seen */}
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

// ─── Server Row (Compact List View) ──────────────

function ServerRow({ server, onRemove }: {
  server: EnrichedServer;
  onRemove: (id: number) => void;
}) {
  const cpuPct = server.metrics?.cpu_usage ?? 0;
  const ramPct = server.metrics && server.metrics.ram_total_mb > 0
    ? (server.metrics.ram_used_mb / server.metrics.ram_total_mb) * 100 : 0;
  const diskPct = server.metrics && server.metrics.disk_total_gb > 0
    ? (server.metrics.disk_used_gb / server.metrics.disk_total_gb) * 100 : 0;

  return (
    <div className={clsx(
      'glass rounded-lg px-4 py-3 flex items-center gap-4 glass-hover transition-all group',
      server.is_online && 'ring-1 ring-emerald-500/10',
    )}>
      {/* Status dot */}
      <div className={clsx(
        'h-2.5 w-2.5 rounded-full flex-shrink-0',
        server.is_online ? 'bg-emerald-400 animate-pulse' : 'bg-nest-600',
      )} />

      {/* Name + hostname */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white truncate">{server.name}</h3>
          {server.proxmox_version && (
            <span className="text-[10px] text-nest-500 flex-shrink-0">PVE {server.proxmox_version}</span>
          )}
        </div>
        <p className="text-[11px] text-nest-500 truncate">
          {server.hostname || server.agent_id.slice(0, 12)}
          {server.cpu_cores && ` · ${server.cpu_cores} cores`}
          {server.ram_total_mb && ` · ${(server.ram_total_mb / 1024).toFixed(0)} GB`}
        </p>
      </div>

      {/* Inline metrics (desktop) */}
      {server.is_online && server.metrics ? (
        <div className="hidden md:flex items-center gap-6 flex-shrink-0">
          {/* CPU mini bar */}
          <div className="w-24">
            <div className="flex justify-between text-[9px] mb-0.5">
              <span className="text-nest-500">CPU</span>
              <span className={getHealthColor(cpuPct)}>{cpuPct.toFixed(0)}%</span>
            </div>
            <div className="h-1 rounded-full bg-nest-800">
              <div className={clsx('h-full rounded-full', getHealthBg(cpuPct))} style={{ width: `${cpuPct}%` }} />
            </div>
          </div>

          {/* RAM mini bar */}
          <div className="w-24">
            <div className="flex justify-between text-[9px] mb-0.5">
              <span className="text-nest-500">RAM</span>
              <span className={getHealthColor(ramPct)}>{ramPct.toFixed(0)}%</span>
            </div>
            <div className="h-1 rounded-full bg-nest-800">
              <div className={clsx('h-full rounded-full', getHealthBg(ramPct))} style={{ width: `${ramPct}%` }} />
            </div>
          </div>

          {/* Disk mini bar */}
          <div className="w-24">
            <div className="flex justify-between text-[9px] mb-0.5">
              <span className="text-nest-500">Disk</span>
              <span className={getHealthColor(diskPct)}>{diskPct.toFixed(0)}%</span>
            </div>
            <div className="h-1 rounded-full bg-nest-800">
              <div className={clsx('h-full rounded-full', getHealthBg(diskPct))} style={{ width: `${diskPct}%` }} />
            </div>
          </div>

          {/* Containers */}
          <div className="text-center w-16">
            <p className="text-xs font-medium text-white">{server.metrics.containers_running}</p>
            <p className="text-[9px] text-nest-500">running</p>
          </div>

          {/* Uptime */}
          <div className="text-center w-16">
            <p className="text-xs font-medium text-nest-300">{formatUptime(server.metrics.uptime_seconds)}</p>
            <p className="text-[9px] text-nest-500">uptime</p>
          </div>
        </div>
      ) : !server.is_online ? (
        <div className="hidden md:flex items-center gap-2 text-xs text-nest-500 flex-shrink-0">
          <WifiOff size={12} />
          {server.last_seen ? `Last seen ${formatLastSeen(server.last_seen)}` : 'Never connected'}
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {server.is_online ? (
          <Link
            to={`/servers/${server.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-nest-500/15 text-nest-300 hover:bg-nest-500/25 transition-colors"
          >
            <ExternalLink size={11} />
            <span className="hidden sm:inline">Open</span>
          </Link>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
            bg-nest-800/30 text-nest-600 cursor-not-allowed">
            <WifiOff size={11} />
            <span className="hidden sm:inline">Offline</span>
          </div>
        )}
        <button
          onClick={() => onRemove(server.id)}
          className="flex items-center justify-center h-7 w-7 rounded-lg
            bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors
            opacity-0 group-hover:opacity-100"
          title="Remove server"
        >
          <Trash2 size={11} />
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

// ─── Main Page ───────────────────────────────────

export function ServerListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [servers, setServers] = useState<EnrichedServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClaim, setShowClaim] = useState(false);
  const [checkedOnboarding, setCheckedOnboarding] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() =>
    (localStorage.getItem('proxnest_view_mode') as 'grid' | 'list') || 'grid',
  );

  const setAndSaveViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('proxnest_view_mode', mode);
  };

  const fetchServers = useCallback(async () => {
    try {
      const { servers: list } = await api.getServers();
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

  // Redirect to onboarding if user has no servers (first-time)
  useEffect(() => {
    if (!loading && !checkedOnboarding) {
      setCheckedOnboarding(true);
      if (servers.length === 0) {
        navigate('/onboarding', { replace: true });
      }
    }
  }, [loading, servers.length, checkedOnboarding, navigate]);

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
  const alerts = getHealthAlerts(servers);

  return (
    <div className="space-y-6">
      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-nest-400 border-t-transparent" />
            <p className="text-sm text-nest-400">Loading fleet status...</p>
          </div>
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

      {/* ─── Dashboard (has servers) ─────────── */}
      {!loading && servers.length > 0 && (
        <>
          {/* Fleet Overview Stats */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={16} className="text-nest-400" />
              <h2 className="text-sm font-semibold text-nest-300">Fleet Overview</h2>
              <span className="text-[10px] text-nest-600 ml-auto">Auto-refreshes every 30s</span>
            </div>
            <FleetOverview servers={servers} />
          </div>

          {/* Health Alerts */}
          <AlertsBanner alerts={alerts} />

          {/* Server List Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Your Servers</h1>
              <p className="text-sm text-nest-400 mt-0.5">
                {onlineCount} of {servers.length} online
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* View mode toggle */}
              <div className="flex items-center glass rounded-lg p-0.5">
                <button
                  onClick={() => setAndSaveViewMode('grid')}
                  className={clsx(
                    'flex items-center justify-center h-7 w-7 rounded-md transition-colors',
                    viewMode === 'grid'
                      ? 'bg-nest-500/20 text-nest-300'
                      : 'text-nest-500 hover:text-nest-300',
                  )}
                  title="Grid view"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => setAndSaveViewMode('list')}
                  className={clsx(
                    'flex items-center justify-center h-7 w-7 rounded-md transition-colors',
                    viewMode === 'list'
                      ? 'bg-nest-500/20 text-nest-300'
                      : 'text-nest-500 hover:text-nest-300',
                  )}
                  title="List view"
                >
                  <List size={14} />
                </button>
              </div>

              <button
                onClick={() => navigate('/onboarding')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg
                  bg-gradient-to-r from-nest-500 to-nest-600 text-sm font-semibold text-white
                  shadow-lg shadow-nest-500/20 hover:from-nest-400 hover:to-nest-500 transition-all"
              >
                <Plus size={16} />
                Add Server
              </button>
            </div>
          </div>

          {/* Server Grid */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {servers
                .sort((a, b) => {
                  // Online first, then by name
                  if (a.is_online !== b.is_online) return a.is_online ? -1 : 1;
                  return a.name.localeCompare(b.name);
                })
                .map((server) => (
                  <ServerCard
                    key={server.id}
                    server={server}
                    onRemove={handleRemove}
                    onRename={handleRename}
                  />
                ))}
            </div>
          ) : (
            <div className="space-y-2">
              {servers
                .sort((a, b) => {
                  if (a.is_online !== b.is_online) return a.is_online ? -1 : 1;
                  return a.name.localeCompare(b.name);
                })
                .map((server) => (
                  <ServerRow
                    key={server.id}
                    server={server}
                    onRemove={handleRemove}
                  />
                ))}
            </div>
          )}

          {/* Plan info */}
          {user && (
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
        </>
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
