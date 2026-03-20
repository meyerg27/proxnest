import { useApi, useAutoRefresh } from '@/hooks/useApi';
import { apps } from '@/lib/api';
import { ExternalLink, Trash2, Package } from 'lucide-react';
import { clsx } from 'clsx';
import { useState } from 'react';
import type { InstalledApp } from '@/types/api';

const statusColors: Record<string, string> = {
  running: 'text-emerald-400 bg-emerald-500/10',
  stopped: 'text-nest-400 bg-nest-800/50',
  installing: 'text-amber-400 bg-amber-500/10',
  error: 'text-rose-400 bg-rose-500/10',
  removing: 'text-rose-400 bg-rose-500/10',
};

export function InstalledAppsPage() {
  const { data, loading, refetch } = useApi(() => apps.installed());
  const [removing, setRemoving] = useState<number | null>(null);
  useAutoRefresh(refetch, 10000);

  const appList = (data as { apps: InstalledApp[] } | null)?.apps || [];

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
      <p className="text-sm text-nest-400">{appList.length} app{appList.length !== 1 ? 's' : ''} installed</p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {appList.map((app) => (
          <div key={app.id} className="glass rounded-xl p-5 glow-border glass-hover transition-all">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{app.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white truncate">{app.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={clsx(
                    'text-[10px] px-2 py-0.5 rounded-full font-medium',
                    statusColors[app.status] || statusColors.stopped,
                  )}>
                    {app.status === 'installing' && (
                      <span className="inline-block h-2 w-2 mr-1 animate-spin rounded-full border border-current border-t-transparent" />
                    )}
                    {app.status}
                  </span>
                  <span className="text-[10px] text-nest-500">{app.type} • {app.node}</span>
                </div>
              </div>
            </div>

            {/* Connection info */}
            {(app.webUrl || app.ipAddress) && (
              <div className="mt-3 rounded-lg bg-nest-800/50 px-3 py-2 text-xs text-nest-300 font-mono truncate">
                {app.webUrl || `${app.ipAddress}:${app.port}`}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-4">
              {app.webUrl && (
                <a
                  href={app.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                    bg-nest-500/15 text-nest-300 hover:bg-nest-500/25 transition-colors"
                >
                  <ExternalLink size={12} />
                  Open
                </a>
              )}
              <button
                onClick={() => handleUninstall(app.id, app.name)}
                disabled={removing === app.id || app.status === 'removing'}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                  bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors
                  disabled:opacity-50"
              >
                <Trash2 size={12} />
                {removing === app.id ? 'Removing...' : 'Remove'}
              </button>
            </div>

            <p className="text-[10px] text-nest-600 mt-3">
              Installed {new Date(app.createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
