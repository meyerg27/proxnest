/**
 * ProxNest Dashboard — Storage Page
 * ZFS pool status, disk list, create ZFS pool wizard, storage overview.
 */

import { useApi, useAutoRefresh } from '@/hooks/useApi';
import { storage as storageApi, nodes as nodesApi } from '@/lib/api';
import {
  HardDrive, Database, CheckCircle, AlertTriangle, AlertCircle, Plus,
  X, ChevronRight, ChevronLeft, Loader2, Info, Shield, Zap, Trash2,
  RefreshCw, Server, Disc,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useEffect, useMemo } from 'react';
import type { StorageInfo, DiskInfo, NodeInfo, ZFSPool, CreateZFSParams } from '@/types/api';

// ─── Health Config ───────────────────────────────

const healthConfig: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  healthy: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500', label: 'Healthy' },
  ONLINE: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500', label: 'Online' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500', label: 'Warning' },
  DEGRADED: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500', label: 'Degraded' },
  critical: { icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-500', label: 'Critical' },
  FAULTED: { icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-500', label: 'Faulted' },
  unknown: { icon: HardDrive, color: 'text-nest-400', bg: 'bg-nest-500', label: 'Unknown' },
};

function getHealthConfig(health: string) {
  return healthConfig[health] || healthConfig.unknown;
}

// ─── Storage Card ────────────────────────────────

function StorageCard({ store }: { store: StorageInfo }) {
  const h = getHealthConfig(store.health);
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
            className={clsx('h-full rounded-full transition-all', h.bg, {
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

// ─── ZFS Pool Card ───────────────────────────────

function ZFSPoolCard({ pool }: { pool: ZFSPool }) {
  const h = getHealthConfig(pool.health);
  const HealthIcon = h.icon;
  const sizeLabel = pool.sizeTB >= 1 ? `${pool.sizeTB.toFixed(1)} TB` : `${pool.sizeGB.toFixed(0)} GB`;
  const allocLabel = pool.allocGB >= 1024 ? `${(pool.allocGB / 1024).toFixed(1)} TB` : `${pool.allocGB.toFixed(0)} GB`;
  const freeLabel = pool.freeGB >= 1024 ? `${(pool.freeGB / 1024).toFixed(1)} TB` : `${pool.freeGB.toFixed(0)} GB`;

  return (
    <div className="glass rounded-xl p-5 glow-border glass-hover transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-indigo-600/5">
            <Disc size={18} className="text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{pool.name}</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-nest-800 text-nest-400 uppercase font-mono">
              ZFS Pool
            </span>
          </div>
        </div>
        <div className={clsx('flex items-center gap-1 text-xs', h.color)}>
          <HealthIcon size={12} />
          {pool.health}
        </div>
      </div>

      {/* Usage bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-nest-400">{allocLabel} used</span>
          <span className="text-nest-400">{sizeLabel} total</span>
        </div>
        <div className="h-2 rounded-full bg-nest-800">
          <div
            className={clsx('h-full rounded-full transition-all', h.bg)}
            style={{ width: `${pool.percentUsed}%` }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-nest-500">{pool.percentUsed}% used</span>
          <span className="text-nest-500">{freeLabel} free</span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mt-3 text-[10px] text-nest-500">
        <span>Frag: {pool.frag}%</span>
        <span>Dedup: {pool.dedup.toFixed(2)}x</span>
      </div>
    </div>
  );
}

// ─── Disk Row ────────────────────────────────────

function DiskRow({ disk, selected, onToggle }: {
  disk: DiskInfo;
  selected?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      className={clsx(
        'glass rounded-lg p-4 flex items-center gap-4 glass-hover transition-all',
        onToggle && 'cursor-pointer',
        selected && 'ring-1 ring-indigo-500/40 bg-indigo-500/5',
      )}
      onClick={onToggle}
    >
      {onToggle !== undefined && (
        <div className={clsx(
          'flex h-5 w-5 items-center justify-center rounded border transition-colors flex-shrink-0',
          selected ? 'border-indigo-500 bg-indigo-500' : 'border-nest-600 bg-nest-900/50',
        )}>
          {selected && <CheckCircle size={12} className="text-white" />}
        </div>
      )}

      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-nest-800 flex-shrink-0">
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
          <span className="font-mono">{disk.path}</span>
          <span>{disk.sizeTB >= 1 ? `${disk.sizeTB} TB` : `${disk.sizeGB} GB`}</span>
          <span className={clsx(
            disk.used === 'unused' ? 'text-emerald-400' : 'text-nest-500',
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

// ─── RAID Level Info ─────────────────────────────

interface RaidLevel {
  value: CreateZFSParams['raidlevel'];
  name: string;
  description: string;
  minDisks: number;
  icon: React.ElementType;
  color: string;
  redundancy: string;
  capacity: string;
}

const raidLevels: RaidLevel[] = [
  {
    value: 'single',
    name: 'Single',
    description: 'No redundancy. Maximum capacity.',
    minDisks: 1,
    icon: Zap,
    color: 'text-amber-400',
    redundancy: 'None',
    capacity: '100%',
  },
  {
    value: 'mirror',
    name: 'Mirror',
    description: 'Data mirrored across all disks. Best for 2 disks.',
    minDisks: 2,
    icon: Shield,
    color: 'text-emerald-400',
    redundancy: 'N-1 disks',
    capacity: '50%',
  },
  {
    value: 'raidz',
    name: 'RAIDZ-1',
    description: 'Single parity. Can survive 1 disk failure.',
    minDisks: 3,
    icon: Shield,
    color: 'text-indigo-400',
    redundancy: '1 disk',
    capacity: `${((1 - 1/3) * 100).toFixed(0)}%+`,
  },
  {
    value: 'raidz2',
    name: 'RAIDZ-2',
    description: 'Double parity. Can survive 2 disk failures.',
    minDisks: 4,
    icon: Shield,
    color: 'text-cyan-400',
    redundancy: '2 disks',
    capacity: `${((1 - 2/4) * 100).toFixed(0)}%+`,
  },
  {
    value: 'raidz3',
    name: 'RAIDZ-3',
    description: 'Triple parity. Maximum protection.',
    minDisks: 5,
    icon: Shield,
    color: 'text-violet-400',
    redundancy: '3 disks',
    capacity: `${((1 - 3/5) * 100).toFixed(0)}%+`,
  },
];

// ─── Create ZFS Pool Wizard ──────────────────────

type WizardStep = 'disks' | 'config' | 'confirm';

function CreateZFSWizard({
  node,
  disks,
  onClose,
  onCreated,
}: {
  node: string;
  disks: DiskInfo[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<WizardStep>('disks');
  const [selectedDisks, setSelectedDisks] = useState<Set<string>>(new Set());
  const [poolName, setPoolName] = useState('');
  const [raidLevel, setRaidLevel] = useState<CreateZFSParams['raidlevel']>('mirror');
  const [compression, setCompression] = useState<CreateZFSParams['compression']>('lz4');
  const [ashift, setAshift] = useState(12);
  const [addStorage, setAddStorage] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unusedDisks = disks.filter((d) => d.used === 'unused');
  const selectedCount = selectedDisks.size;

  // Determine valid raid levels based on selected disks
  const validRaidLevels = raidLevels.filter((r) => selectedCount >= r.minDisks);

  // Estimated capacity
  const estimatedCapacity = useMemo(() => {
    if (selectedCount === 0) return 0;
    const selectedDiskList = unusedDisks.filter((d) => selectedDisks.has(d.path));
    const minSize = Math.min(...selectedDiskList.map((d) => d.sizeGB));
    switch (raidLevel) {
      case 'single': return minSize * selectedCount;
      case 'mirror': return minSize;
      case 'raidz': return minSize * (selectedCount - 1);
      case 'raidz2': return minSize * (selectedCount - 2);
      case 'raidz3': return minSize * (selectedCount - 3);
      default: return 0;
    }
  }, [selectedDisks, raidLevel, unusedDisks, selectedCount]);

  const toggleDisk = (path: string) => {
    setSelectedDisks((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleCreate = async () => {
    setError(null);
    setCreating(true);
    try {
      await storageApi.createZFS(node, {
        name: poolName,
        raidlevel: raidLevel,
        devices: Array.from(selectedDisks),
        ashift,
        compression,
        add_storage: addStorage,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ZFS pool');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative glass rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col glow-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-nest-400/10 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Disc size={20} className="text-indigo-400" />
              Create ZFS Pool
            </h2>
            <p className="text-xs text-nest-400 mt-0.5">Node: {node}</p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-nest-800/50 text-nest-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-nest-400/5 flex-shrink-0">
          {(['disks', 'config', 'confirm'] as WizardStep[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <ChevronRight size={12} className="text-nest-600" />}
              <button
                onClick={() => {
                  if (s === 'disks') setStep('disks');
                  else if (s === 'config' && selectedCount > 0) setStep('config');
                  else if (s === 'confirm' && poolName) setStep('confirm');
                }}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  step === s ? 'bg-indigo-500/15 text-indigo-300' : 'text-nest-500',
                )}
              >
                <span className={clsx(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                  step === s ? 'bg-indigo-500 text-white' : 'bg-nest-800 text-nest-400',
                )}>
                  {i + 1}
                </span>
                {s === 'disks' ? 'Select Disks' : s === 'config' ? 'Configure' : 'Confirm'}
              </button>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400 mb-4 flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Step 1: Select Disks */}
          {step === 'disks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-nest-300">
                  Select disks for the new ZFS pool. Only unused disks are shown.
                </p>
                <span className="text-xs text-nest-400">{selectedCount} selected</span>
              </div>

              {unusedDisks.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center glow-border">
                  <HardDrive size={32} className="text-nest-600 mx-auto mb-3" />
                  <p className="text-sm text-nest-400">No unused disks available.</p>
                  <p className="text-xs text-nest-500 mt-1">
                    All disks are currently in use. Add new disks or remove existing pools first.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {unusedDisks.map((disk) => (
                    <DiskRow
                      key={disk.path}
                      disk={disk}
                      selected={selectedDisks.has(disk.path)}
                      onToggle={() => toggleDisk(disk.path)}
                    />
                  ))}
                </div>
              )}

              {/* Warning for single disk */}
              {selectedCount === 1 && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-xs text-amber-400 flex items-start gap-2">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>With only 1 disk, no redundancy is possible. Data loss risk if the disk fails.</span>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 'config' && (
            <div className="space-y-6">
              {/* Pool Name */}
              <div>
                <label className="block text-xs font-medium text-nest-300 mb-1.5">Pool Name</label>
                <input
                  type="text"
                  value={poolName}
                  onChange={(e) => setPoolName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  placeholder="e.g. tank, data, media"
                  className="w-full max-w-sm rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-2.5
                    text-sm text-white font-mono placeholder-nest-500
                    focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20
                    transition-colors"
                />
                <p className="text-[10px] text-nest-600 mt-1">Only letters, numbers, dashes, and underscores.</p>
              </div>

              {/* RAID Level */}
              <div>
                <label className="block text-xs font-medium text-nest-300 mb-2">RAID Level</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {raidLevels.map((raid) => {
                    const isValid = selectedCount >= raid.minDisks;
                    const RaidIcon = raid.icon;
                    return (
                      <button
                        key={raid.value}
                        onClick={() => isValid && setRaidLevel(raid.value)}
                        disabled={!isValid}
                        className={clsx(
                          'glass rounded-xl p-4 text-left transition-all',
                          raidLevel === raid.value && isValid
                            ? 'ring-1 ring-indigo-500/40 bg-indigo-500/5'
                            : isValid
                              ? 'hover:bg-nest-800/30'
                              : 'opacity-40 cursor-not-allowed',
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <RaidIcon size={14} className={raid.color} />
                          <span className="text-sm font-semibold text-white">{raid.name}</span>
                          {!isValid && (
                            <span className="text-[10px] text-nest-500 ml-auto">Need {raid.minDisks}+ disks</span>
                          )}
                        </div>
                        <p className="text-xs text-nest-400">{raid.description}</p>
                        <div className="flex gap-3 mt-2 text-[10px] text-nest-500">
                          <span>Redundancy: {raid.redundancy}</span>
                          <span>Usable: ~{raid.capacity}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Advanced options */}
              <div className="space-y-4">
                <h3 className="text-xs font-medium text-nest-300">Advanced Options</h3>

                {/* Compression */}
                <div className="flex items-center gap-4">
                  <label className="text-xs text-nest-400 w-24">Compression</label>
                  <div className="flex gap-1.5">
                    {(['lz4', 'zstd', 'gzip', 'on', 'off'] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => setCompression(c)}
                        className={clsx(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                          compression === c
                            ? 'bg-indigo-500/15 text-indigo-300'
                            : 'text-nest-500 hover:text-nest-300',
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ashift */}
                <div className="flex items-center gap-4">
                  <label className="text-xs text-nest-400 w-24">Ashift</label>
                  <div className="flex gap-1.5">
                    {[9, 12, 13].map((a) => (
                      <button
                        key={a}
                        onClick={() => setAshift(a)}
                        className={clsx(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                          ashift === a
                            ? 'bg-indigo-500/15 text-indigo-300'
                            : 'text-nest-500 hover:text-nest-300',
                        )}
                      >
                        {a} <span className="text-nest-600">({Math.pow(2, a)} B)</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add as Proxmox storage */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setAddStorage(!addStorage)}
                    className={clsx(
                      'flex h-5 w-5 items-center justify-center rounded border transition-colors',
                      addStorage ? 'border-indigo-500 bg-indigo-500' : 'border-nest-600 bg-nest-900/50',
                    )}
                  >
                    {addStorage && <CheckCircle size={12} className="text-white" />}
                  </button>
                  <div>
                    <label className="text-xs text-nest-300">Add as Proxmox storage</label>
                    <p className="text-[10px] text-nest-600">Register the pool in Proxmox for VM/CT use</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && (
            <div className="space-y-6">
              <div className="glass rounded-xl p-6 glow-border">
                <h3 className="text-sm font-semibold text-white mb-4">Review Configuration</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-nest-400">Pool Name</span>
                    <span className="text-white font-mono">{poolName}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-nest-400">RAID Level</span>
                    <span className="text-white">{raidLevels.find((r) => r.value === raidLevel)?.name}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-nest-400">Disks</span>
                    <span className="text-white">{selectedCount} disk{selectedCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-nest-400">Estimated Capacity</span>
                    <span className="text-white font-semibold">
                      {estimatedCapacity >= 1024
                        ? `${(estimatedCapacity / 1024).toFixed(1)} TB`
                        : `${estimatedCapacity.toFixed(0)} GB`}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-nest-400">Compression</span>
                    <span className="text-white">{compression}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-nest-400">Ashift</span>
                    <span className="text-white">{ashift}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-nest-400">Add as Proxmox Storage</span>
                    <span className={addStorage ? 'text-emerald-400' : 'text-nest-500'}>{addStorage ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>

              {/* Selected disks detail */}
              <div>
                <h3 className="text-xs font-medium text-nest-300 mb-2">Selected Disks</h3>
                <div className="space-y-1.5">
                  {unusedDisks.filter((d) => selectedDisks.has(d.path)).map((disk) => (
                    <div key={disk.path} className="flex items-center gap-3 text-xs p-2 rounded-lg bg-nest-800/30">
                      <HardDrive size={12} className={disk.isSSD ? 'text-cyan-400' : 'text-amber-400'} />
                      <span className="text-white font-mono">{disk.path}</span>
                      <span className="text-nest-400">{disk.model}</span>
                      <span className="text-nest-400 ml-auto">
                        {disk.sizeTB >= 1 ? `${disk.sizeTB} TB` : `${disk.sizeGB} GB`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning */}
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-xs text-rose-400 flex items-start gap-2">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Warning:</strong> This will erase all data on the selected disks.
                  This action cannot be undone.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-nest-400/10 flex-shrink-0">
          <button
            onClick={() => {
              if (step === 'disks') onClose();
              else if (step === 'config') setStep('disks');
              else setStep('config');
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium
              text-nest-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={14} />
            {step === 'disks' ? 'Cancel' : 'Back'}
          </button>

          {step === 'disks' && (
            <button
              onClick={() => setStep('config')}
              disabled={selectedCount === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold
                bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/20
                hover:from-indigo-400 hover:to-indigo-500 transition-all
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next: Configure
              <ChevronRight size={14} />
            </button>
          )}

          {step === 'config' && (
            <button
              onClick={() => setStep('confirm')}
              disabled={!poolName || !validRaidLevels.find((r) => r.value === raidLevel)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold
                bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/20
                hover:from-indigo-400 hover:to-indigo-500 transition-all
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next: Review
              <ChevronRight size={14} />
            </button>
          )}

          {step === 'confirm' && (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-xs font-semibold
                bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20
                hover:from-emerald-400 hover:to-emerald-500 transition-all
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Creating Pool...
                </>
              ) : (
                <>
                  <Disc size={14} />
                  Create ZFS Pool
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Storage Page ───────────────────────────

export function StoragePage() {
  const [selectedNode, setSelectedNode] = useState('pve');
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const { data: nodeData } = useApi(() => nodesApi.list());
  const { data: storageData, loading: storageLoading, refetch: refetchStorage } = useApi(
    () => storageApi.list(selectedNode),
    [selectedNode],
  );
  const { data: diskData, loading: diskLoading, refetch: refetchDisks } = useApi(
    () => storageApi.disks(selectedNode),
    [selectedNode],
  );
  const { data: zfsData, loading: zfsLoading, refetch: refetchZfs } = useApi(
    () => storageApi.zfsPools(selectedNode),
    [selectedNode],
  );

  useAutoRefresh(() => {
    refetchStorage();
    refetchDisks();
    refetchZfs();
  }, 30000);

  const nodesList = (nodeData as { nodes: NodeInfo[] } | null)?.nodes || [];
  const storages = (storageData as { storages: StorageInfo[] } | null)?.storages || [];
  const disks = (diskData as { disks: DiskInfo[] } | null)?.disks || [];
  const zfsPools = (zfsData as { pools: ZFSPool[] } | null)?.pools || [];

  // Auto-select first node
  useEffect(() => {
    if (nodesList.length > 0 && !nodesList.find((n) => n.name === selectedNode)) {
      setSelectedNode(nodesList[0].name);
    }
  }, [nodesList, selectedNode]);

  // Summary stats
  const totalCapacity = storages.reduce((sum, s) => sum + s.totalGB, 0);
  const totalUsed = storages.reduce((sum, s) => sum + s.usedGB, 0);
  const unusedDisks = disks.filter((d) => d.used === 'unused');

  const handleWizardCreated = () => {
    refetchStorage();
    refetchZfs();
    refetchDisks();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <HardDrive size={20} />
            Storage Management
          </h1>
          <p className="text-sm text-nest-400 mt-0.5">
            {storages.length} pool{storages.length !== 1 ? 's' : ''} •{' '}
            {totalUsed.toFixed(0)} / {totalCapacity.toFixed(0)} GB used •{' '}
            {disks.length} disk{disks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { refetchStorage(); refetchDisks(); refetchZfs(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
              glass text-nest-400 hover:text-white transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          {unusedDisks.length > 0 && (
            <button
              onClick={() => setShowCreateWizard(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                bg-gradient-to-r from-indigo-500 to-indigo-600 text-white
                shadow-lg shadow-indigo-500/20 hover:from-indigo-400 hover:to-indigo-500 transition-all"
            >
              <Plus size={16} />
              Create ZFS Pool
            </button>
          )}
        </div>
      </div>

      {/* Node selector */}
      {nodesList.length > 1 && (
        <div className="flex gap-2">
          {nodesList.map((n) => (
            <button
              key={n.name}
              onClick={() => setSelectedNode(n.name)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                selectedNode === n.name
                  ? 'bg-nest-500/15 text-nest-300 ring-1 ring-nest-400/20'
                  : 'glass text-nest-400 hover:text-white',
              )}
            >
              <Server size={14} />
              {n.name}
            </button>
          ))}
        </div>
      )}

      {/* ZFS Pools */}
      {zfsPools.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Disc size={16} className="text-indigo-400" />
            ZFS Pools
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {zfsPools.map((pool) => (
              <ZFSPoolCard key={pool.name} pool={pool} />
            ))}
          </div>
        </div>
      )}

      {/* Storage pools */}
      <div>
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Database size={16} className="text-amber-400" />
          Storage Pools
        </h2>
        {storageLoading && storages.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-nest-400 text-sm">Loading storage...</div>
        ) : storages.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-nest-400 text-sm">No storage pools configured</div>
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
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <HardDrive size={16} className="text-cyan-400" />
          Physical Disks
          {unusedDisks.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium">
              {unusedDisks.length} unused
            </span>
          )}
        </h2>
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

      {/* Create ZFS Pool Wizard */}
      {showCreateWizard && (
        <CreateZFSWizard
          node={selectedNode}
          disks={disks}
          onClose={() => setShowCreateWizard(false)}
          onCreated={handleWizardCreated}
        />
      )}
    </div>
  );
}
