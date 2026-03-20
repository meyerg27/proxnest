import { useApi, useAutoRefresh } from '@/hooks/useApi';
import { apps } from '@/lib/api';
import {
  ExternalLink, Trash2, Package, Play, Square, RotateCcw,
  ScrollText, X, ChevronDown, ChevronUp, Search,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useEffect, useRef } from 'react';
import type { InstalledApp } from '@/types/api';

const statusColors: Record<string, string> = {
  running: 'text-emerald-400 bg-emerald-500/10',
  stopped: 'text-nest-400 bg-nest-800/50',
  installing: 'text-amber-400 bg-amber-500/10',
  restarting: 'text-amber-400 bg-amber-500/10',
  error: 'text-rose-400 bg-rose-500/10',
  removing: 'text-rose-400 bg-rose-500/10',
};

function LogViewer({ appId, appName, onClose }: { appId: number; appName: string; onClose: () => void }) {
  const { data, loading, refetch } = useApi(() => apps.logs(appId, 200));
  const logEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useAutoRefresh(refetch, 5000);

  const logs = (data as { logs: Array<{ t: number; n: number; d: string }> } | null)?.logs || [];

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col glow-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-nest-400/10">
          <div className="flex items-center gap-3">
            <ScrollText size={18} className="text-nest-400" />
            <h3 className="text-sm font-semibold text-white">Logs — {appName}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                autoScroll ? 'bg-nest-500/15 text-nest-300' : 'text-nest-500 hover:text-white',
              )}
            >
              {autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-nest-800/50 text-nest-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Log content */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-nest-400 border-t-transparent" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-nest-500 text-center py-8">No logs available</p>
          ) : (
            <>
              {logs.map((entry, i) => (
                <div key={`${entry.n}-${i}`} className="flex gap-3 py-0.5 hover:bg-nest-800/30 rounded px-2">
                  <span className="text-nest-600 select-none shrink-0 w-16 text-right">
                    {new Date(entry.t * 1000).toLocaleTimeString()}
                  </span>
                  <span className={clsx(
                    'text-nest-300 break-all whitespace-pre-wrap',
                    entry.d.toLowerCase().includes('error') && 'text-rose-400',
                    entry.d.toLowerCase().includes('warn') && 'text-amber-400',
                  )}>
                    {entry.d}
                  </span>
                </div>
              ))}
              <div ref={logEndRef} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AppCard({
  app,
  onAction,
  onUninstall,
  onViewLogs,
  actionLoading,
  removing,
}: {
  app: InstalledApp;
  onAction: (id: number, action: 'start' | 'stop' | 'restart') => void;
  onUninstall: (id: number, name: string) => void;
  onViewLogs: (id: number, name: string) => void;
  actionLoading: number | null;
  removing: number | null;
}) {
  const isRunning = app.status === 'running';
  const isBusy = actionLoading === app.id || app.status === 'installing' || app.status === 'restarting' || app.status === 'removing';
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass rounded-xl glow-border glass-hover transition-all">
      {/* Main row */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{app.icon}</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{app.name}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={clsx(
                'text-[10px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1',
                statusColors[app.status] || statusColors.stopped,
              )}>
                {(app.status === 'installing' || app.status === 'restarting') && (
                  <span className="inline-block h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
                )}
                {isRunning && <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                {app.status}
              </span>
              <span className="text-[10px] text-nest-500">{app.type} • {app.node}</span>
              {app.vmid && <span className="text-[10px] text-nest-600 font-mono">ID {app.vmid}</span>}
            </div>
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-nest-500 hover:text-white transition-colors"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Connection info */}
        {(app.webUrl || app.ipAddress) && (
          <div className="mt-3 rounded-lg bg-nest-800/50 px-3 py-2 text-xs text-nest-300 font-mono truncate">
            {app.webUrl || `${app.ipAddress}:${app.port}`}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {/* Start/Stop */}
          {isRunning ? (
            <button
              onClick={() => onAction(app.id, 'stop')}
              disabled={isBusy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
            >
              <Square size={12} />
              Stop
            </button>
          ) : app.status === 'stopped' || app.status === 'error' ? (
            <button
              onClick={() => onAction(app.id, 'start')}
              disabled={isBusy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              <Play size={12} />
              Start
            </button>
          ) : null}

          {/* Restart */}
          {(isRunning || app.status === 'error') && (
            <button
              onClick={() => onAction(app.id, 'restart')}
              disabled={isBusy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
            >
              <RotateCcw size={12} />
              Restart
            </button>
          )}

          {/* Open Web UI */}
          {app.webUrl && (
            <a
              href={app.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                bg-nest-500/15 text-nest-300 hover:bg-nest-500/25 transition-colors"
            >
              <ExternalLink size={12} />
              Open
            </a>
          )}

          {/* Logs */}
          <button
            onClick={() => onViewLogs(app.id, app.name)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
              bg-nest-800/50 text-nest-400 hover:text-white transition-colors"
          >
            <ScrollText size={12} />
            Logs
          </button>

          {/* Remove */}
          <button
            onClick={() => onUninstall(app.id, app.name)}
            disabled={removing === app.id || app.status === 'removing'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
              bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50 ml-auto"
          >
            <Trash2 size={12} />
            {removing === app.id ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-nest-400/10 p-5 space-y-2">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-nest-500">Template</span>
              <p className="text-nest-300 font-mono">{app.templateId}</p>
            </div>
            <div>
              <span className="text-nest-500">Category</span>
              <p className="text-nest-300">{app.category}</p>
            </div>
            <div>
              <span className="text-nest-500">IP Address</span>
              <p className="text-nest-300 font-mono">{app.ipAddress || '—'}</p>
            </div>
            <div>
              <span className="text-nest-500">Port</span>
              <p className="text-nest-300 font-mono">{app.port || '—'}</p>
            </div>
          </div>
          <p className="text-[10px] text-nest-600">
            Installed {new Date(app.createdAt).toLocaleDateString()} at {new Date(app.createdAt).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}

export function InstalledAppsPage() {
  const { data, loading, refetch } = useApi(() => apps.installed());
  const [removing, setRemoving] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [logTarget, setLogTarget] = useState<{ id: number; name: string } | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  useAutoRefresh(refetch, 8000);

  const appList = (data as { apps: InstalledApp[] } | null)?.apps || [];

  const filteredApps = appList.filter((app) => {
    if (search && !app.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && app.status !== statusFilter) return false;
    return true;
  });

  const statusCounts = appList.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleAction = async (id: number, action: 'start' | 'stop' | 'restart') => {
    setActionLoading(id);
    try {
      await apps.action(id, action);
      setTimeout(refetch, 2000);
    } catch (err) {
      console.error(`Action ${action} failed:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUninstall = async (id: number, name: string) => {
    if (!confirm(`Remove ${name}? This will delete the container/volume.`)) return;
    setRemoving(id);
    try {
      await apps.uninstall(id);
      setTimeout(refetch, 2000);
    } catch (err) {
      console.error('Uninstall failed:', err);
    } finally {
      setRemoving(null);
    }
  };

  if (loading && appList.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-nest-400 border-t-transparent" />
      </div>
    );
  }

  if (appList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Package size={48} className="text-nest-600" />
        <div className="text-center">
          <p className="text-white font-medium">No apps installed yet</p>
          <p className="text-sm text-nest-400 mt-1">
            Head to the <a href="/apps" className="text-nest-300 underline">App Store</a> to install your first app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-nest-400">{appList.length} app{appList.length !== 1 ? 's' : ''} installed</p>
          {/* Status pills */}
          <div className="flex gap-1.5 flex-wrap">
            {statusCounts.running > 0 && (
              <button
                onClick={() => setStatusFilter(statusFilter === 'running' ? null : 'running')}
                className={clsx(
                  'text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors',
                  statusFilter === 'running' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20',
                )}
              >
                {statusCounts.running} running
              </button>
            )}
            {statusCounts.stopped > 0 && (
              <button
                onClick={() => setStatusFilter(statusFilter === 'stopped' ? null : 'stopped')}
                className={clsx(
                  'text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors',
                  statusFilter === 'stopped' ? 'bg-nest-500/20 text-nest-300' : 'bg-nest-800/50 text-nest-400 hover:bg-nest-500/20',
                )}
              >
                {statusCounts.stopped} stopped
              </button>
            )}
            {statusCounts.error > 0 && (
              <button
                onClick={() => setStatusFilter(statusFilter === 'error' ? null : 'error')}
                className={clsx(
                  'text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors',
                  statusFilter === 'error' ? 'bg-rose-500/20 text-rose-300' : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20',
                )}
              >
                {statusCounts.error} error
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nest-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 pl-9 pr-4 py-2 text-xs text-white
              placeholder-nest-500 focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20"
            placeholder="Search installed apps..."
          />
        </div>
      </div>

      {/* App cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
        {filteredApps.map((app) => (
          <AppCard
            key={app.id}
            app={app}
            onAction={handleAction}
            onUninstall={handleUninstall}
            onViewLogs={(id, name) => setLogTarget({ id, name })}
            actionLoading={actionLoading}
            removing={removing}
          />
        ))}
      </div>

      {filteredApps.length === 0 && appList.length > 0 && (
        <div className="glass rounded-xl p-8 text-center text-nest-400 text-sm">
          No apps match your filter. <button onClick={() => { setSearch(''); setStatusFilter(null); }} className="text-nest-300 underline">Clear filters</button>
        </div>
      )}

      {/* Log viewer modal */}
      {logTarget && (
        <LogViewer
          appId={logTarget.id}
          appName={logTarget.name}
          onClose={() => setLogTarget(null)}
        />
      )}
    </div>
  );
}
