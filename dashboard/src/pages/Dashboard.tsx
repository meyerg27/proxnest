import { Cpu, MemoryStick, HardDrive, Server, Monitor, Container, Package, Users } from 'lucide-react';
import { useApi, useAutoRefresh } from '@/hooks/useApi';
import { dashboard, nodes as nodesApi } from '@/lib/api';
import { StatCard } from '@/components/StatCard';
import { ResourceRow } from '@/components/ResourceRow';
import { useState } from 'react';
import type { DashboardData, Resource } from '@/types/api';

export function DashboardPage() {
  const { data: summaryData, loading: summaryLoading, refetch: refetchSummary } = useApi(
    () => dashboard.summary(),
  );
  const { data: resourceData, loading: resLoading, refetch: refetchResources } = useApi(
    () => nodesApi.resources(),
  );
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useAutoRefresh(() => {
    refetchSummary();
    refetchResources();
  }, 15000);

  const summary = summaryData as DashboardData | null;
  const resources = (resourceData as { resources: Resource[] } | null)?.resources || [];

  const handleAction = async (vmid: number, type: string, action: string) => {
    const node = resources.find((r) => r.vmid === vmid)?.node || 'pve';
    setActionLoading(vmid);
    try {
      await nodesApi.action(node, type, vmid, action);
      setTimeout(refetchResources, 2000);
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-nest-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="CPU Usage"
          value={`${summary?.cluster.cpu.percent || 0}%`}
          subtitle={`${summary?.cluster.cpu.used || 0} / ${summary?.cluster.cpu.total || 0} cores`}
          icon={Cpu}
          color="indigo"
          progress={summary?.cluster.cpu.percent}
        />
        <StatCard
          label="Memory"
          value={`${summary?.cluster.memory.usedGB || 0} GB`}
          subtitle={`of ${summary?.cluster.memory.totalGB || 0} GB`}
          icon={MemoryStick}
          color="emerald"
          progress={summary?.cluster.memory.percent}
        />
        <StatCard
          label="Storage"
          value={`${summary?.cluster.disk.usedGB || 0} GB`}
          subtitle={`of ${summary?.cluster.disk.totalGB || 0} GB`}
          icon={HardDrive}
          color="amber"
          progress={summary?.cluster.disk.percent}
        />
        <StatCard
          label="Nodes"
          value={summary?.cluster.nodes || 0}
          subtitle={`${summary?.guests.running || 0} running, ${summary?.guests.stopped || 0} stopped`}
          icon={Server}
          color="cyan"
        />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4 glow-border flex items-center gap-3">
          <Monitor size={18} className="text-nest-400" />
          <div>
            <p className="text-lg font-bold text-white">{summary?.guests.vms || 0}</p>
            <p className="text-xs text-nest-400">Virtual Machines</p>
          </div>
        </div>
        <div className="glass rounded-xl p-4 glow-border flex items-center gap-3">
          <Container size={18} className="text-nest-400" />
          <div>
            <p className="text-lg font-bold text-white">{summary?.guests.containers || 0}</p>
            <p className="text-xs text-nest-400">Containers</p>
          </div>
        </div>
        <div className="glass rounded-xl p-4 glow-border flex items-center gap-3">
          <Package size={18} className="text-nest-400" />
          <div>
            <p className="text-lg font-bold text-white">{summary?.apps || 0}</p>
            <p className="text-xs text-nest-400">Installed Apps</p>
          </div>
        </div>
        <div className="glass rounded-xl p-4 glow-border flex items-center gap-3">
          <Users size={18} className="text-nest-400" />
          <div>
            <p className="text-lg font-bold text-white">{summary?.users || 0}</p>
            <p className="text-xs text-nest-400">Users</p>
          </div>
        </div>
      </div>

      {/* Resources List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">VMs & Containers</h2>
          <span className="text-xs text-nest-400">{resources.length} total</span>
        </div>
        {resLoading && resources.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-nest-400 text-sm">Loading resources...</div>
        ) : resources.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-nest-400 text-sm">
            No VMs or containers found. Install an app to get started!
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
    </div>
  );
}
