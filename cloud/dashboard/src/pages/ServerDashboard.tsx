/**
 * ProxNest Cloud — Server Dashboard (Full Management Interface)
 * Tabs: Overview, VMs & Containers, App Store, Storage, Network, Logs
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type CloudServer, type ServerMetrics, normalizeMetrics } from '../lib/api';
import {
  ArrowLeft, Server, Wifi, WifiOff, Cpu, MemoryStick, HardDrive,
  Container, RefreshCw, Terminal, Activity, Clock, Loader2,
  Box, Play, Square, RotateCw, Plus, Search, Download,
  Network, Database, ScrollText, ExternalLink, Monitor,
  ChevronDown, ChevronRight, X, Package, Layers, Globe, Shield,
  Gauge, Zap, Home, Eye, Gamepad2, MessageSquare, FolderOpen,
} from 'lucide-react';
import { clsx } from 'clsx';

// ─── Types ───────────────────────────────────────

type Tab = 'overview' | 'guests' | 'apps' | 'storage' | 'network' | 'logs';

interface GuestInfo {
  vmid: number;
  name: string;
  type: 'qemu' | 'lxc';
  status: 'running' | 'stopped' | 'paused';
  cpus: number;
  memoryMB: number;
  diskGB: number;
  uptime: number;
  netin: number;
  netout: number;
}

interface StorageInfo {
  id: string;
  type: string;
  content: string;
  path: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usagePercent: number;
  active: boolean;
}

interface NetworkInterface {
  name: string;
  state: 'up' | 'down' | 'unknown';
  ipv4: string[];
  ipv6: string[];
  speed: number | null;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
}

interface NetworkInfo {
  interfaces: NetworkInterface[];
  bridges: Array<{ name: string; ports: string[]; stp: boolean }>;
  gateway: string;
  dns: string[];
}

interface AppTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  type: 'lxc' | 'docker';
  tags: string[];
  featured?: boolean;
  webPort: number;
  minResources?: { cores: number; memoryMB: number; diskGB: number };
  docker?: {
    image: string;
    ports: Record<string, number>;
    volumes: Record<string, string>;
    environment?: Record<string, string>;
    compose?: string;
  };
  lxc?: {
    ostemplate: string;
    cores: number;
    memory: number;
    swap: number;
    rootfs: number;
    unprivileged?: boolean;
    features?: string;
    startup_script?: string;
  };
}

// ─── App Templates (embedded from API) ──────────

const CATEGORY_ICONS: Record<string, string> = {
  media: '🎬', downloads: '⬇️', cloud: '☁️', network: '🌐',
  monitoring: '📊', development: '💻', home: '🏠', security: '🔐',
  productivity: '📋', gaming: '🎮', communication: '💬',
};

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All Apps', media: 'Media', downloads: 'Downloads', cloud: 'Cloud & Storage',
  network: 'Network', monitoring: 'Monitoring', development: 'Development',
  home: 'Home', security: 'Security', productivity: 'Productivity',
  gaming: 'Gaming', communication: 'Communication',
};

// ─── Stat Card ───────────────────────────────────

function StatCard({ label, value, subtitle, percent, color, icon: Icon }: {
  label: string; value: string; subtitle: string; percent?: number; color: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="glass rounded-xl p-4 glow-border group hover:border-nest-400/20 transition-all">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-nest-400 font-medium uppercase tracking-wider">{label}</p>
        {Icon && <Icon size={14} className="text-nest-500" />}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-nest-500 mt-0.5">{subtitle}</p>
      {percent !== undefined && (
        <div className="mt-3 h-1.5 rounded-full bg-nest-800/80">
          <div
            className={clsx('h-full rounded-full transition-all duration-500', color)}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Tab Button ──────────────────────────────────

function TabButton({ active, onClick, icon: Icon, label, badge }: {
  active: boolean; onClick: () => void;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
        active
          ? 'bg-nest-600/30 text-white border border-nest-400/20 shadow-lg shadow-nest-500/10'
          : 'text-nest-400 hover:text-white hover:bg-nest-800/50',
      )}
    >
      <Icon size={15} />
      <span className="hidden sm:inline">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={clsx(
          'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
          active ? 'bg-nest-400/20 text-nest-200' : 'bg-nest-800 text-nest-500',
        )}>{badge}</span>
      )}
    </button>
  );
}

// ─── Guest Row ───────────────────────────────────

function GuestRow({ guest, onAction, loading }: {
  guest: GuestInfo;
  onAction: (vmid: number, type: string, action: string) => void;
  loading: boolean;
}) {
  const isRunning = guest.status === 'running';
  const memGB = (guest.memoryMB / 1024).toFixed(1);

  return (
    <div className="glass rounded-xl p-4 glass-hover transition-all group">
      <div className="flex items-center gap-4">
        {/* Status + Icon */}
        <div className="relative flex-shrink-0">
          <div className={clsx(
            'flex h-10 w-10 items-center justify-center rounded-xl',
            guest.type === 'qemu'
              ? 'bg-indigo-500/10 border border-indigo-500/20'
              : 'bg-cyan-500/10 border border-cyan-500/20',
          )}>
            {guest.type === 'qemu'
              ? <Monitor size={18} className="text-indigo-400" />
              : <Container size={18} className="text-cyan-400" />}
          </div>
          <div className={clsx(
            'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-nest-950',
            isRunning ? 'bg-emerald-400' : 'bg-nest-600',
          )} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">{guest.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-nest-800 text-nest-400 font-mono">
              {guest.vmid}
            </span>
            <span className={clsx(
              'text-[10px] px-1.5 py-0.5 rounded-md font-medium uppercase',
              guest.type === 'qemu'
                ? 'bg-indigo-500/10 text-indigo-400'
                : 'bg-cyan-500/10 text-cyan-400',
            )}>
              {guest.type === 'qemu' ? 'VM' : 'CT'}
            </span>
            <span className={clsx(
              'text-[10px] px-1.5 py-0.5 rounded-md font-medium',
              isRunning ? 'bg-emerald-500/10 text-emerald-400' : 'bg-nest-800 text-nest-500',
            )}>
              {guest.status}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-xs text-nest-500">
            <span className="flex items-center gap-1">
              <Cpu size={10} /> {guest.cpus} {guest.cpus === 1 ? 'core' : 'cores'}
            </span>
            <span className="flex items-center gap-1">
              <MemoryStick size={10} /> {memGB} GB
            </span>
            {guest.diskGB > 0 && (
              <span className="flex items-center gap-1">
                <HardDrive size={10} /> {guest.diskGB} GB
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {loading ? (
            <Loader2 size={16} className="animate-spin text-nest-400" />
          ) : isRunning ? (
            <>
              <button
                onClick={() => onAction(guest.vmid, guest.type, 'restart')}
                className="p-2 rounded-lg text-nest-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                title="Restart"
              >
                <RotateCw size={14} />
              </button>
              <button
                onClick={() => onAction(guest.vmid, guest.type, 'stop')}
                className="p-2 rounded-lg text-nest-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                title="Stop"
              >
                <Square size={14} />
              </button>
            </>
          ) : (
            <button
              onClick={() => onAction(guest.vmid, guest.type, 'start')}
              className="p-2 rounded-lg text-nest-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
              title="Start"
            >
              <Play size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Storage Bar ─────────────────────────────────

function StorageBar({ storage }: { storage: StorageInfo }) {
  const totalGB = (storage.totalBytes / 1073741824).toFixed(1);
  const usedGB = (storage.usedBytes / 1073741824).toFixed(1);
  const freeGB = (storage.freeBytes / 1073741824).toFixed(1);
  const pct = storage.usagePercent;

  const barColor = pct > 90 ? 'bg-rose-500' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-500';
  const typeLabel: Record<string, string> = {
    dir: 'Directory', lvmthin: 'LVM-Thin', lvm: 'LVM', zfspool: 'ZFS',
    nfs: 'NFS', cifs: 'CIFS/SMB', ext4: 'ext4', xfs: 'XFS', btrfs: 'Btrfs',
  };

  return (
    <div className="glass rounded-xl p-4 glow-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database size={16} className={clsx(
            storage.active ? 'text-emerald-400' : 'text-nest-600',
          )} />
          <span className="text-sm font-semibold text-white">{storage.id}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-nest-800 text-nest-400">
            {typeLabel[storage.type] || storage.type}
          </span>
        </div>
        <span className={clsx(
          'text-xs font-medium',
          pct > 90 ? 'text-rose-400' : pct > 75 ? 'text-amber-400' : 'text-nest-400',
        )}>
          {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-nest-800/80 overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-xs text-nest-500">
        <span>{usedGB} GB used</span>
        <span>{freeGB} GB free</span>
        <span>{totalGB} GB total</span>
      </div>
    </div>
  );
}

// ─── App Card ────────────────────────────────────

function AppCard({ app, installed, onInstall, installing }: {
  app: AppTemplate;
  installed: boolean;
  onInstall: (app: AppTemplate) => void;
  installing: boolean;
}) {
  return (
    <div className="glass rounded-xl p-4 glow-border glass-hover transition-all group flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl flex-shrink-0" role="img">{app.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">{app.name}</h3>
            {app.featured && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold uppercase">
                ★
              </span>
            )}
          </div>
          <p className="text-xs text-nest-500 mt-0.5 line-clamp-2">{app.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-auto flex-wrap">
        <span className={clsx(
          'text-[10px] px-1.5 py-0.5 rounded font-medium',
          app.type === 'docker' ? 'bg-sky-500/10 text-sky-400' : 'bg-orange-500/10 text-orange-400',
        )}>
          {app.type === 'docker' ? '🐳 Docker' : '📦 LXC'}
        </span>
        {app.minResources && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-nest-800 text-nest-500">
            {app.minResources.cores}c / {app.minResources.memoryMB < 1024 ? `${app.minResources.memoryMB}MB` : `${(app.minResources.memoryMB / 1024).toFixed(0)}GB`}
          </span>
        )}
        <div className="flex-1" />
        {installed ? (
          <span className="text-[10px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-medium">
            ✓ Installed
          </span>
        ) : (
          <button
            onClick={() => onInstall(app)}
            disabled={installing}
            className="text-[11px] px-3 py-1.5 rounded-lg bg-nest-500/20 text-nest-200 hover:bg-nest-500/30 hover:text-white transition-all font-medium disabled:opacity-50"
          >
            {installing ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={10} className="animate-spin" /> Installing...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Download size={10} /> Install
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Network Interface Card ─────────────────────

function NetworkCard({ iface }: { iface: NetworkInterface }) {
  const formatBytes = (bytes: number) => {
    if (bytes > 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  return (
    <div className="glass rounded-xl p-4 glow-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe size={16} className={clsx(
            iface.state === 'up' ? 'text-emerald-400' : 'text-nest-600',
          )} />
          <span className="text-sm font-semibold text-white font-mono">{iface.name}</span>
          <span className={clsx(
            'text-[10px] px-1.5 py-0.5 rounded font-medium',
            iface.state === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-nest-800 text-nest-500',
          )}>
            {iface.state}
          </span>
        </div>
        {iface.speed && iface.speed > 0 && (
          <span className="text-xs text-nest-400">{iface.speed} Mbps</span>
        )}
      </div>

      {iface.ipv4.length > 0 && (
        <div className="mb-2">
          {iface.ipv4.map(ip => (
            <div key={ip} className="text-xs text-nest-300 font-mono bg-nest-800/50 rounded px-2 py-1 mb-1">
              IPv4: {ip}
            </div>
          ))}
        </div>
      )}
      {iface.ipv6.length > 0 && (
        <div className="mb-2">
          {iface.ipv6.map(ip => (
            <div key={ip} className="text-[10px] text-nest-500 font-mono truncate">
              IPv6: {ip}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-4 mt-2 text-xs text-nest-500">
        <span>↓ {formatBytes(iface.rxBytes)}</span>
        <span>↑ {formatBytes(iface.txBytes)}</span>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────

export function ServerDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const serverId = parseInt(id || '0', 10);

  // Core state
  const [server, setServer] = useState<(CloudServer & { metrics?: ServerMetrics }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Data state
  const [guests, setGuests] = useState<GuestInfo[]>([]);
  const [storages, setStorages] = useState<StorageInfo[]>([]);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [installedApps, setInstalledApps] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [appTemplates, setAppTemplates] = useState<AppTemplate[]>([]);

  // UI state
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [installingApp, setInstallingApp] = useState<string | null>(null);
  const [appSearch, setAppSearch] = useState('');
  const [appCategory, setAppCategory] = useState('all');
  const [installMessage, setInstallMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ─── Fetch core server data ────────────────

  const fetchServer = useCallback(async () => {
    try {
      const { server: srv } = await api.getServer(serverId);
      setServer({ ...srv, metrics: normalizeMetrics(srv.metrics) });
      if (!srv.is_online) setError('Server is offline');
      else setError(null);
      return srv.is_online;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      return false;
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  // ─── Fetch tab-specific data ───────────────

  const fetchGuests = useCallback(async () => {
    try {
      const result = await api.sendCommand(serverId, 'guests.list');
      if (result.success && result.data) {
        setGuests((result.data as any).guests || []);
      }
    } catch { /* ignore */ }
  }, [serverId]);

  const fetchStorage = useCallback(async () => {
    try {
      const result = await api.sendCommand(serverId, 'storage.list');
      if (result.success && result.data) {
        setStorages((result.data as any).storages || []);
      }
    } catch { /* ignore */ }
  }, [serverId]);

  const fetchNetwork = useCallback(async () => {
    try {
      const result = await api.sendCommand(serverId, 'network.list');
      if (result.success && result.data) {
        setNetworkInfo(result.data as NetworkInfo);
      }
    } catch { /* ignore */ }
  }, [serverId]);

  const fetchApps = useCallback(async () => {
    try {
      const result = await api.sendCommand(serverId, 'apps.list');
      if (result.success && result.data) {
        setInstalledApps((result.data as any).installed || []);
      }
    } catch { /* ignore */ }
    // Fetch templates from cloud API (or use embedded)
    try {
      const res = await api.proxyGet<{ templates: AppTemplate[] }>(serverId, '/api/v1/apps/templates');
      if (res.templates) setAppTemplates(res.templates);
    } catch {
      // Templates will be loaded from the local import below
    }
  }, [serverId]);

  const fetchLogs = useCallback(async () => {
    try {
      const result = await api.sendCommand(serverId, 'system.logs', { lines: 200 });
      if (result.success && result.data) {
        setLogs((result.data as any).logs || []);
      }
    } catch { /* ignore */ }
  }, [serverId]);

  // ─── Initial + periodic fetch ──────────────

  useEffect(() => {
    if (!serverId) return;
    const init = async () => {
      const online = await fetchServer();
      if (online) {
        fetchGuests();
      }
    };
    init();
    const interval = setInterval(fetchServer, 15_000);
    return () => clearInterval(interval);
  }, [serverId, fetchServer, fetchGuests]);

  // ─── Fetch data on tab change ──────────────

  useEffect(() => {
    if (!server?.is_online) return;
    switch (activeTab) {
      case 'overview':
      case 'guests': fetchGuests(); break;
      case 'storage': fetchStorage(); break;
      case 'network': fetchNetwork(); break;
      case 'apps': fetchApps(); break;
      case 'logs': fetchLogs(); break;
    }
  }, [activeTab, server?.is_online, fetchGuests, fetchStorage, fetchNetwork, fetchApps, fetchLogs]);

  // ─── Actions ───────────────────────────────

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchServer();
    if (server?.is_online) {
      switch (activeTab) {
        case 'overview':
        case 'guests': await fetchGuests(); break;
        case 'storage': await fetchStorage(); break;
        case 'network': await fetchNetwork(); break;
        case 'apps': await fetchApps(); break;
        case 'logs': await fetchLogs(); break;
      }
    }
    setRefreshing(false);
  };

  const handleGuestAction = async (vmid: number, type: string, action: string) => {
    setActionLoading(vmid);
    try {
      await api.sendCommand(serverId, `guests.${action}`, { vmid, type });
      setTimeout(() => {
        fetchGuests();
        fetchServer();
      }, 2500);
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setTimeout(() => setActionLoading(null), 2500);
    }
  };

  const handleAppInstall = async (app: AppTemplate) => {
    setInstallingApp(app.id);
    setInstallMessage(null);
    try {
      const params: Record<string, unknown> = {
        appId: app.id,
        method: app.type,
      };
      if (app.type === 'docker' && app.docker) {
        params.image = app.docker.image;
        params.ports = app.docker.ports;
        params.volumes = app.docker.volumes;
        params.environment = app.docker.environment;
        if (app.docker.compose) params.compose = app.docker.compose;
      } else if (app.type === 'lxc' && app.lxc) {
        params.lxc = app.lxc;
      }

      const result = await api.sendCommand(serverId, 'apps.install', params);
      if (result.success) {
        setInstallMessage({ type: 'success', text: `${app.name} installed successfully!` });
        setInstalledApps(prev => [...prev, app.id]);
      } else {
        setInstallMessage({ type: 'error', text: result.error || 'Installation failed' });
      }
    } catch (err) {
      setInstallMessage({ type: 'error', text: err instanceof Error ? err.message : 'Installation failed' });
    } finally {
      setInstallingApp(null);
      setTimeout(() => setInstallMessage(null), 5000);
    }
  };

  // ─── App filtering ─────────────────────────

  const filteredApps = useMemo(() => {
    // Use embedded templates if none loaded from API
    const templates = appTemplates.length > 0 ? appTemplates : [];
    let filtered = templates;
    if (appCategory !== 'all') {
      filtered = filtered.filter(a => a.category === appCategory);
    }
    if (appSearch) {
      const q = appSearch.toLowerCase();
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.tags.some(t => t.includes(q))
      );
    }
    return filtered;
  }, [appTemplates, appCategory, appSearch]);

  const categories = useMemo(() => {
    const templates = appTemplates.length > 0 ? appTemplates : [];
    const cats = [...new Set(templates.map(t => t.category))];
    return [
      { id: 'all', count: templates.length },
      ...cats.map(c => ({ id: c, count: templates.filter(t => t.category === c).length })),
    ];
  }, [appTemplates]);

  // ─── Computed stats ────────────────────────

  const guestsRunning = guests.filter(g => g.status === 'running').length;
  const guestsStopped = guests.filter(g => g.status !== 'running').length;

  // ─── Loading state ─────────────────────────

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

  if (!server) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-nest-400">Server not found.</p>
        <Link to="/" className="text-nest-300 hover:text-white text-sm mt-2 inline-block">← Back to servers</Link>
      </div>
    );
  }

  const m = server.metrics;

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 rounded-lg text-nest-400 hover:text-white hover:bg-nest-800/50 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white">{server.name}</h1>
              <div className={clsx(
                'flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
                server.is_online ? 'bg-emerald-500/10 text-emerald-400' : 'bg-nest-800 text-nest-500',
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
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium glass text-nest-300 hover:text-white transition-colors"
        >
          <RefreshCw size={14} className={clsx(refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* ─── Error ──────────────────────────────── */}
      {error && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
          {error}
        </div>
      )}

      {/* ─── Install message ────────────────────── */}
      {installMessage && (
        <div className={clsx(
          'rounded-lg px-4 py-3 text-sm flex items-center justify-between',
          installMessage.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
            : 'bg-rose-500/10 border border-rose-500/20 text-rose-400',
        )}>
          <span>{installMessage.text}</span>
          <button onClick={() => setInstallMessage(null)} className="ml-2 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ─── Offline State ──────────────────────── */}
      {!server.is_online && (
        <div className="glass rounded-2xl p-12 text-center glow-border">
          <WifiOff size={48} className="text-nest-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Server is Offline</h2>
          <p className="text-sm text-nest-400 max-w-md mx-auto">
            This server's agent is not connected. Make sure the ProxNest agent service is running on your server.
          </p>
          {server.last_seen && (
            <p className="text-xs text-nest-500 mt-4 flex items-center justify-center gap-1">
              <Clock size={11} />
              Last seen: {new Date(server.last_seen).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* ─── Online Content ─────────────────────── */}
      {server.is_online && m && (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={Activity} label="Overview" />
            <TabButton active={activeTab === 'guests'} onClick={() => setActiveTab('guests')} icon={Layers} label="Guests" badge={guests.length} />
            <TabButton active={activeTab === 'apps'} onClick={() => setActiveTab('apps')} icon={Package} label="App Store" />
            <TabButton active={activeTab === 'storage'} onClick={() => setActiveTab('storage')} icon={Database} label="Storage" />
            <TabButton active={activeTab === 'network'} onClick={() => setActiveTab('network')} icon={Network} label="Network" />
            <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={ScrollText} label="Logs" />
          </div>

          {/* ═══ Overview Tab ═════════════════════ */}
          {activeTab === 'overview' && (() => {
            const cpuPct = m.cpu_usage ?? 0;
            const ramUsedGB = (m.ram_used_mb / 1024).toFixed(1);
            const ramTotalGB = (m.ram_total_mb / 1024).toFixed(0);
            const ramPct = m.ram_total_mb > 0 ? Math.round(m.ram_used_mb / m.ram_total_mb * 100) : 0;
            const diskUsedGB = m.disk_used_gb ?? 0;
            const diskTotalGB = m.disk_total_gb ?? 0;
            const diskPct = diskTotalGB > 0 ? Math.round(diskUsedGB / diskTotalGB * 100) : 0;
            const uptimeSec = m.uptime_seconds ?? 0;
            const uptimeStr = uptimeSec > 86400
              ? `${Math.floor(uptimeSec / 86400)}d ${Math.floor((uptimeSec % 86400) / 3600)}h`
              : uptimeSec > 3600
              ? `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m`
              : `${Math.floor(uptimeSec / 60)}m`;

            return (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <StatCard label="CPU Usage" value={`${cpuPct}%`} subtitle={`${server.cpu_cores || 0} cores`} percent={cpuPct} color="bg-indigo-500" icon={Cpu} />
                  <StatCard label="Memory" value={`${ramUsedGB} GB`} subtitle={`of ${ramTotalGB} GB`} percent={ramPct} color="bg-emerald-500" icon={MemoryStick} />
                  <StatCard label="Storage" value={`${diskUsedGB} GB`} subtitle={`of ${diskTotalGB} GB`} percent={diskPct} color="bg-amber-500" icon={HardDrive} />
                  <StatCard label="Guests" value={`${guestsRunning} running`} subtitle={`${guestsStopped} stopped • Up ${uptimeStr}`} color="bg-cyan-500" icon={Layers} />
                </div>

                {/* Quick Guest List */}
                {guests.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base font-semibold text-white flex items-center gap-2">
                        <Layers size={16} className="text-nest-400" />
                        VMs & Containers
                      </h2>
                      <button
                        onClick={() => setActiveTab('guests')}
                        className="text-xs text-nest-400 hover:text-white flex items-center gap-1 transition-colors"
                      >
                        View all <ChevronRight size={12} />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {guests.slice(0, 5).map(g => (
                        <GuestRow
                          key={`${g.type}-${g.vmid}`}
                          guest={g}
                          onAction={handleGuestAction}
                          loading={actionLoading === g.vmid}
                        />
                      ))}
                      {guests.length > 5 && (
                        <button
                          onClick={() => setActiveTab('guests')}
                          className="w-full py-2 rounded-lg text-xs text-nest-400 hover:text-white glass glass-hover transition-all"
                        >
                          +{guests.length - 5} more guests →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ Guests Tab ═══════════════════════ */}
          {activeTab === 'guests' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Layers size={16} className="text-nest-400" />
                  VMs & Containers
                  <span className="text-xs text-nest-500 font-normal ml-1">
                    {guestsRunning} running / {guests.length} total
                  </span>
                </h2>
              </div>

              {guests.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center glow-border">
                  <Layers size={36} className="text-nest-600 mx-auto mb-3" />
                  <p className="text-sm text-nest-400">No VMs or containers found</p>
                  <p className="text-xs text-nest-500 mt-1">Create one from the App Store or your Proxmox host</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Running first, then stopped */}
                  {[...guests].sort((a, b) => {
                    if (a.status === 'running' && b.status !== 'running') return -1;
                    if (a.status !== 'running' && b.status === 'running') return 1;
                    return a.vmid - b.vmid;
                  }).map(g => (
                    <GuestRow
                      key={`${g.type}-${g.vmid}`}
                      guest={g}
                      onAction={handleGuestAction}
                      loading={actionLoading === g.vmid}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ App Store Tab ════════════════════ */}
          {activeTab === 'apps' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Package size={16} className="text-nest-400" />
                  App Store
                  <span className="text-xs text-nest-500 font-normal ml-1">
                    {appTemplates.length} apps
                  </span>
                </h2>
              </div>

              {/* Search & Filter */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nest-500" />
                  <input
                    type="text"
                    placeholder="Search apps..."
                    value={appSearch}
                    onChange={e => setAppSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white placeholder-nest-500 focus:outline-none focus:border-nest-400/40 transition-colors"
                  />
                </div>
              </div>

              {/* Category pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setAppCategory(cat.id)}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                      appCategory === cat.id
                        ? 'bg-nest-600/30 text-white border border-nest-400/20'
                        : 'text-nest-400 hover:text-white bg-nest-800/30 hover:bg-nest-800/60',
                    )}
                  >
                    {cat.id !== 'all' && <span>{CATEGORY_ICONS[cat.id] || '📁'}</span>}
                    {CATEGORY_LABELS[cat.id] || cat.id}
                    <span className="text-nest-500">({cat.count})</span>
                  </button>
                ))}
              </div>

              {/* App Grid */}
              {filteredApps.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center glow-border">
                  {appTemplates.length === 0 ? (
                    <>
                      <Package size={36} className="text-nest-600 mx-auto mb-3" />
                      <p className="text-sm text-nest-400">Loading app catalog...</p>
                      <p className="text-xs text-nest-500 mt-1">App templates are loaded from your server</p>
                    </>
                  ) : (
                    <>
                      <Search size={36} className="text-nest-600 mx-auto mb-3" />
                      <p className="text-sm text-nest-400">No apps match your search</p>
                      <button
                        onClick={() => { setAppSearch(''); setAppCategory('all'); }}
                        className="text-xs text-nest-300 hover:text-white mt-2 underline"
                      >
                        Clear filters
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredApps.map(app => (
                    <AppCard
                      key={app.id}
                      app={app}
                      installed={installedApps.includes(app.id)}
                      onInstall={handleAppInstall}
                      installing={installingApp === app.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ Storage Tab ══════════════════════ */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Database size={16} className="text-nest-400" />
                Storage Pools
                <span className="text-xs text-nest-500 font-normal ml-1">
                  {storages.length} pools
                </span>
              </h2>

              {storages.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center glow-border">
                  <Database size={36} className="text-nest-600 mx-auto mb-3" />
                  <p className="text-sm text-nest-400">Loading storage info...</p>
                  <button onClick={fetchStorage} className="text-xs text-nest-300 hover:text-white mt-2 underline">
                    Retry
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {storages.map(s => (
                    <StorageBar key={s.id} storage={s} />
                  ))}
                </div>
              )}

              {/* Total summary */}
              {storages.length > 0 && (
                <div className="glass rounded-xl p-4 glow-border">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-nest-400">Total Storage</span>
                    <span className="text-white font-semibold">
                      {(storages.reduce((s, st) => s + st.usedBytes, 0) / 1073741824).toFixed(1)} GB used
                      {' / '}
                      {(storages.reduce((s, st) => s + st.totalBytes, 0) / 1073741824).toFixed(1)} GB total
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ Network Tab ═════════════════════ */}
          {activeTab === 'network' && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Network size={16} className="text-nest-400" />
                Network
              </h2>

              {!networkInfo ? (
                <div className="glass rounded-xl p-8 text-center glow-border">
                  <Network size={36} className="text-nest-600 mx-auto mb-3" />
                  <p className="text-sm text-nest-400">Loading network info...</p>
                  <button onClick={fetchNetwork} className="text-xs text-nest-300 hover:text-white mt-2 underline">
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  {/* Gateway + DNS Summary */}
                  <div className="glass rounded-xl p-4 glow-border">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-nest-400 font-medium uppercase tracking-wider mb-1">Default Gateway</p>
                        <p className="text-sm text-white font-mono">{networkInfo.gateway || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-nest-400 font-medium uppercase tracking-wider mb-1">DNS Servers</p>
                        <p className="text-sm text-white font-mono">
                          {networkInfo.dns.length > 0 ? networkInfo.dns.join(', ') : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Interfaces */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {networkInfo.interfaces.map(iface => (
                      <NetworkCard key={iface.name} iface={iface} />
                    ))}
                  </div>

                  {/* Bridges */}
                  {networkInfo.bridges.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <Layers size={14} className="text-nest-400" />
                        Bridges
                      </h3>
                      <div className="space-y-2">
                        {networkInfo.bridges.map(br => (
                          <div key={br.name} className="glass rounded-lg p-3 flex items-center gap-3">
                            <span className="text-sm font-mono text-white">{br.name}</span>
                            <span className="text-xs text-nest-500">
                              STP: {br.stp ? 'yes' : 'no'}
                            </span>
                            {br.ports.length > 0 && (
                              <span className="text-xs text-nest-400">
                                Ports: {br.ports.join(', ')}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ═══ Logs Tab ════════════════════════ */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <ScrollText size={16} className="text-nest-400" />
                  System Logs
                  <span className="text-xs text-nest-500 font-normal ml-1">
                    Last {logs.length} entries
                  </span>
                </h2>
                <button
                  onClick={fetchLogs}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium glass text-nest-300 hover:text-white transition-colors"
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center glow-border">
                  <ScrollText size={36} className="text-nest-600 mx-auto mb-3" />
                  <p className="text-sm text-nest-400">Loading logs...</p>
                  <button onClick={fetchLogs} className="text-xs text-nest-300 hover:text-white mt-2 underline">
                    Retry
                  </button>
                </div>
              ) : (
                <div className="glass rounded-xl glow-border overflow-hidden">
                  <div className="max-h-[500px] overflow-y-auto p-4 font-mono text-xs leading-relaxed">
                    {logs.map((line, i) => (
                      <div
                        key={i}
                        className={clsx(
                          'py-0.5 border-b border-nest-800/30',
                          line.includes('error') || line.includes('ERROR') || line.includes('failed')
                            ? 'text-rose-400'
                            : line.includes('warning') || line.includes('WARN')
                            ? 'text-amber-400'
                            : 'text-nest-400',
                        )}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Terminal link */}
              <div className="glass rounded-xl p-4 glow-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Terminal size={18} className="text-nest-400" />
                    <div>
                      <p className="text-sm font-medium text-white">Web Terminal</p>
                      <p className="text-xs text-nest-500">Open a shell session via SSH or ttyd</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      // Open ttyd or SSH in new window
                      const host = server.hostname || 'server';
                      window.open(`https://${host}:7681`, '_blank');
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-nest-600/20 text-nest-200 hover:bg-nest-600/30 hover:text-white transition-all"
                  >
                    <ExternalLink size={12} /> Open Terminal
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
