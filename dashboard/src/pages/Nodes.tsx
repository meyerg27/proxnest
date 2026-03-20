import { useApi, useAutoRefresh } from '@/hooks/useApi';
import { nodes as nodesApi } from '@/lib/api';
import { Server, Cpu, MemoryStick, HardDrive, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import type { NodeInfo } from '@/types/api';

function ProgressRing({ percent, color, size = 64 }: { percent: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(129,140,248,0.1)" strokeWidth="5" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-700"
      />
    </svg>
  );
}

function NodeCard({ node }: { node: NodeInfo }) {
  const isOnline = node.status === 'online';

  return (
    <div className="glass rounded-2xl p-6 glow-border space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-nest-500/20 to-nest-600/5">
          <Server size={20} className="text-nest-300" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">{node.name}</h3>
          <div className="flex items-center gap-2 text-xs">
            <span className={clsx('flex items-center gap-1', isOnline ? 'text-emerald-400' : 'text-rose-400')}>
              <span className={clsx('h-1.5 w-1.5 rounded-full', isOnline ? 'bg-emerald-400' : 'bg-rose-400')} />
              {isOnline ? 'Online' : 'Offline'}
            </span>
            <span className="text-nest-500">•</span>
            <span className="text-nest-400 flex items-center gap-1">
              <Clock size={10} />
              {node.uptimeFormatted}
            </span>
          </div>
        </div>
      </div>

      {/* Resource Rings */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'CPU', percent: node.cpu.percent, color: '#6366f1', detail: `${node.cpu.total} cores` },
          { label: 'Memory', percent: node.memory.percent, color: '#10b981', detail: `${node.memory.usedGB}/${node.memory.totalGB} GB` },
          { label: 'Disk', percent: node.disk.percent, color: '#f59e0b', detail: `${node.disk.usedGB}/${node.disk.totalGB} GB` },
        ].map(({ label, percent, color, detail }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <div className="relative">
              <ProgressRing percent={percent} color={color} />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                {percent}%
              </span>
            </div>
            <span className="text-xs font-medium text-nest-300">{label}</span>
            <span className="text-[10px] text-nest-500">{detail}</span>
          </div>
        ))}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-nest-800/50 px-3 py-2 text-center">
          <Cpu size={14} className="mx-auto text-indigo-400 mb-1" />
          <span className="text-xs text-nest-300">{node.cpu.total} cores</span>
        </div>
        <div className="rounded-lg bg-nest-800/50 px-3 py-2 text-center">
          <MemoryStick size={14} className="mx-auto text-emerald-400 mb-1" />
          <span className="text-xs text-nest-300">{node.memory.totalGB} GB</span>
        </div>
        <div className="rounded-lg bg-nest-800/50 px-3 py-2 text-center">
          <HardDrive size={14} className="mx-auto text-amber-400 mb-1" />
          <span className="text-xs text-nest-300">{node.disk.totalGB} GB</span>
        </div>
      </div>
    </div>
  );
}

export function NodesPage() {
  const { data, loading, refetch } = useApi(() => nodesApi.list());
  useAutoRefresh(refetch, 15000);

  const nodeList = (data as { nodes: NodeInfo[] } | null)?.nodes || [];

  if (loading && nodeList.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-nest-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-nest-400">{nodeList.length} node{nodeList.length !== 1 ? 's' : ''} in cluster</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {nodeList.map((node) => (
          <NodeCard key={node.name} node={node} />
        ))}
      </div>
    </div>
  );
}
