import { useApi, useAutoRefresh } from '@/hooks/useApi';
import { storage as storageApi, nodes as nodesApi } from '@/lib/api';
import { HardDrive, Database, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useEffect } from 'react';
import type { StorageInfo, DiskInfo, NodeInfo } from '@/types/api';

const healthConfig = {
  healthy: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500', label: 'Healthy' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500', label: 'Warning' },
  critical: { icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-500', label: 'Critical' },
  unknown: { icon: HardDrive, color: 'text-nest-400', bg: 'bg-nest-500', label: 'Unknown' },
};

function StorageCard({ store }: { store: StorageInfo }) {
  const h = healthConfig[store.health];
  const HealthIcon = h.icon;

  return (
    <div className="glass rounded-xl p-5 glow-border glass-hover transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/5">
            <Database size={18} className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{store.name}</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-nest-800 text-nest-400 uppercase font-mono">
              {store.type}
            </span>
          </div>
        </div>
        <div className={clsx('flex items-center gap-1 text-xs', h.color)}>
          <HealthIcon size={12} />
          {h.label}
        </div>
      </div>

      {/* Usage bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-nest-400">{store.usedGB} GB used</span>
          <span className="text-nest-400">{store.totalGB} GB total</span>
        </div>
        <div className="h-2 rounded-full bg-nest-800">
          <div
            className={clsx('h-full rounded-full progress-bar', h.bg, {
              'animate-pulse': store.health === 'critical',
            })}
            style={{ width: `${store.percentUsed}%` }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-nest-500">{store.percentUsed}% used</span>
          <span className="text-nest-500">{store.availableGB} GB free</span>
        </div>
      </div>

      {/* Content types */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {store.content.map((type) => (
          <span key={type} className="text-[10px] px-2 py-0.5 rounded-full bg-nest-800/80 text-nest-300">
            {type}
          </span>
        ))}
      </div>

      {/* Flags */}
      <div className="flex gap-3 mt-3 text-[10px] text-nest-500">
        {store.shared && <span>🌐 Shared</span>}
        {store.active && <span>✅ Active</span>}
        {!store.enabled && <span>⏸️ Disabled</span>}
      </div>
    </div>
  );
}

function DiskRow({ disk }: { disk: DiskInfo }) {
  return (
    <div className="glass rounded-lg p-4 flex items-center gap-4 glass-hover transition-all">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-nest-800">
        <HardDrive size={16} className={disk.isSSD ? 'text-cyan-400' : 'text-amber-400'} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">{disk.model}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-nest-800 text-nest-400">
            {disk.isSSD ? 'SSD' : 'HDD'}
          </span>
        </div>
        <div className="flex items-center gap-4 mt-0.5 text-xs text-nest-400">
          <span>{disk.path}</span>
          <span>{disk.sizeTB >= 1 ? `${disk.sizeTB} TB` : `${disk.sizeGB} GB`}</span>
          <span className={clsx(
            disk.used === 'unused' ? 'text-nest-500' : 'text-emerald-400',
          )}>
            {disk.used}
          </span>
          {disk.wearout !== undefined && disk.wearout > 0 && (
            <span>Wear: {disk.wearout}%</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function StoragePage() {
  const [selectedNode, setSelectedNode] = useState('pve');
  const { data: nodeData } = useApi(() => nodesApi.list());
  const { data: storageData, loading: storageLoading, refetch: refetchStorage } = useApi(
    () => storageApi.list(selectedNode),
    [selectedNode],
  );
  const { data: diskData, loading: diskLoading, refetch: refetchDisks } = useApi(
    () => storageApi.disks(selectedNode),
    [selectedNode],
  );

  useAutoRefresh(() => {
    refetchStorage();
    refetchDisks();
  }, 30000);

  const nodesList = (nodeData as { nodes: NodeInfo[] } | null)?.nodes || [];
  const storages = (storageData as { storages: StorageInfo[] } | null)?.storages || [];
  const disks = (diskData as { disks: DiskInfo[] } | null)?.disks || [];

  // Auto-select first node
  useEffect(() => {
    if (nodesList.length > 0 && !nodesList.find((n) => n.name === selectedNode)) {
      setSelectedNode(nodesList[0].name);
    }
  }, [nodesList, selectedNode]);

  return (
    <div className="space-y-6">
      {/* Node selector */}
      {nodesList.length > 1 && (
        <div className="flex gap-2">
          {nodesList.map((n) => (
            <button
              key={n.name}
              onClick={() => setSelectedNode(n.name)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                selectedNode === n.name
                  ? 'bg-nest-500/15 text-nest-300 glow-border-active'
                  : 'glass text-nest-400 hover:text-white',
              )}
            >
              {n.name}
            </button>
          ))}
        </div>
      )}

      {/* Storage pools */}
      <div>
        <h2 className="text-base font-semibold text-white mb-4">Storage Pools</h2>
        {storageLoading && storages.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-nest-400 text-sm">Loading storage...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {storages.map((s) => (
              <StorageCard key={s.name} store={s} />
            ))}
          </div>
        )}
      </div>

      {/* Physical disks */}
      <div>
        <h2 className="text-base font-semibold text-white mb-4">Physical Disks</h2>
        {diskLoading && disks.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-nest-400 text-sm">Loading disks...</div>
        ) : disks.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-nest-400 text-sm">No disk info available</div>
        ) : (
          <div className="space-y-2">
            {disks.map((d) => (
              <DiskRow key={d.path} disk={d} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
