/**
 * ProxNest Dashboard — Main Dashboard Page
 * Real-time CPU/RAM/network/disk graphs, container status, quick stats.
 */

import {
  Cpu, MemoryStick, HardDrive, Server, Monitor, Container, Package,
  Users, Activity, ArrowUpRight, ArrowDownRight, Clock, Zap,
  Network, Disc, RefreshCw,
} from 'lucide-react';
import { useApi, useAutoRefresh } from '@/hooks/useApi';
import { dashboard, nodes as nodesApi } from '@/lib/api';
import { StatCard } from '@/components/StatCard';
import { ResourceRow } from '@/components/ResourceRow';
import { MiniChart, MultiLineChart, type ChartDataPoint, type MultiLineData } from '@/components/MiniChart';
import { useState, useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import type { DashboardData, Resource, RRDMetric } from '@/types/api';

// ─── Formatters ──────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Chart Panel Component ───────────────────────

function ChartPanel({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('glass rounded-xl glow-border p-4', className)}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-nest-400" />
        <span className="text-xs font-medium text-nest-300">{title}</span>
      </div>
      {children}
    </div>
  );
}

// ─── Timeframe Selector ──────────────────────────

type Timeframe = 'hour' | 'day' | 'week' | 'month' | 'year';

const timeframes: { value: Timeframe; label: string }[] = [
  { value: 'hour', label: '1H' },
  { value: 'day', label: '24H' },
  { value: 'week', label: '7D' },
  { value: 'month', label: '30D' },
];

function TimeframeSelector({
  value,
  onChange,
}: {
  value: Timeframe;
  onChange: (t: Timeframe) => void;
}) {
  return (
    <div className="flex gap-1 bg-nest-900/50 rounded-lg p-0.5">
      {timeframes.map((tf) => (
        <button
          key={tf.value}
          onClick={() => onChange(tf.value)}
          className={clsx(
            'px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors',
            value === tf.value
              ? 'bg-nest-700/50 text-white'
              : 'text-nest-500 hover:text-nest-300',
          )}
        >
          {tf.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────

export function DashboardPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>('hour');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Fetch summary & resources
  const { data: summaryData, loading: summaryLoading, refetch: refetchSummary } = useApi(
    () => dashboard.summary(),
  );
  const { data: resourceData, loading: resLoading, refetch: refetchResources } = useApi(
    () => nodesApi.resources(),
  );

  // Fetch RRD metrics for charts
  const { data: rrdData, loading: rrdLoading, refetch: refetchRrd } = useApi(
    () => nodesApi.rrd('pve', timeframe),
    [timeframe],
  );

  useAutoRefresh(() => {
    refetchSummary();
    refetchResources();
    refetchRrd();
  }, timeframe === 'hour' ? 15000 : 60000);

  const summary = summaryData as DashboardData | null;
  const resources = (resourceData as { resources: Resource[] } | null)?.resources || [];
  const rrdMetrics = (rrdData as { metrics: RRDMetric[] } | null)?.metrics || [];

  // ─── Transform RRD data for charts ─────────

  const cpuData: ChartDataPoint[] = rrdMetrics.map((m) => ({
    time: m.time,
    value: m.cpu !== null ? m.cpu * 100 : null,
  }));

  const memData: ChartDataPoint[] = rrdMetrics.map((m) => ({
    time: m.time,
    value: m.memUsed !== null && m.memTotal !== null
      ? (m.memUsed / m.memTotal) * 100
      : null,
  }));

  const loadData: ChartDataPoint[] = rrdMetrics.map((m) => ({
    time: m.time,
    value: m.loadAvg,
  }));

  const ioWaitData: ChartDataPoint[] = rrdMetrics.map((m) => ({
    time: m.time,
    value: m.iowait !== null ? m.iowait * 100 : null,
  }));

  const networkData: MultiLineData[] = rrdMetrics.map((m) => ({
    time: m.time,
    values: [m.netIn, m.netOut],
  }));

  const diskIOData: MultiLineData[] = rrdMetrics.map((m) => ({
    time: m.time,
    values: [m.diskRead, m.diskWrite],
  }));

  const rootDiskData: ChartDataPoint[] = rrdMetrics.map((m) => ({
    time: m.time,
    value: m.rootUsed !== null && m.rootTotal !== null && m.rootTotal > 0
      ? (m.rootUsed / m.rootTotal) * 100
      : null,
  }));

  const swapData: ChartDataPoint[] = rrdMetrics.map((m) => ({
    time: m.time,
    value: m.swapUsed !== null && m.swapTotal !== null && m.swapTotal > 0
      ? (m.swapUsed / m.swapTotal) * 100
      : null,
  }));

  // ─── Current values from last metric ──────

  const lastMetric = rrdMetrics.length > 0 ? rrdMetrics[rrdMetrics.length - 1] : null;
  const cpuPercent = lastMetric?.cpu !== null ? ((lastMetric?.cpu ?? 0) * 100).toFixed(1) : '—';
  const memPercent = lastMetric?.memUsed && lastMetric?.memTotal
    ? ((lastMetric.memUsed / lastMetric.memTotal) * 100).toFixed(1)
    : '—';
  const memUsedGB = lastMetric?.memUsed
    ? (lastMetric.memUsed / 1024 / 1024 / 1024).toFixed(1)
    : '—';
  const memTotalGB = lastMetric?.memTotal
    ? (lastMetric.memTotal / 1024 / 1024 / 1024).toFixed(0)
    : '—';

  // ─── Actions ──────────────────────────────

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

  // ─── Loading ──────────────────────────────

  if (summaryLoading && !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-nest-400 border-t-transparent" />
          <p className="text-sm text-nest-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Top Stats Row ──────────────────────── */}
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

      {/* ─── Quick Counts ───────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4 glow-border flex items-center gap-3">
          <Monitor size={18} className="text-indigo-400" />
          <div>
            <p className="text-lg font-bold text-white">{summary?.guests.vms || 0}</p>
            <p className="text-xs text-nest-400">Virtual Machines</p>
          </div>
        </div>
        <div className="glass rounded-xl p-4 glow-border flex items-center gap-3">
          <Container size={18} className="text-cyan-400" />
          <div>
            <p className="text-lg font-bold text-white">{summary?.guests.containers || 0}</p>
            <p className="text-xs text-nest-400">Containers</p>
          </div>
        </div>
        <div className="glass rounded-xl p-4 glow-border flex items-center gap-3">
          <Package size={18} className="text-amber-400" />
          <div>
            <p className="text-lg font-bold text-white">{summary?.apps || 0}</p>
            <p className="text-xs text-nest-400">Installed Apps</p>
          </div>
        </div>
        <div className="glass rounded-xl p-4 glow-border flex items-center gap-3">
          <Users size={18} className="text-emerald-400" />
          <div>
            <p className="text-lg font-bold text-white">{summary?.users || 0}</p>
            <p className="text-xs text-nest-400">Users</p>
          </div>
        </div>
      </div>

      {/* ─── Real-Time Charts ───────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-nest-400" />
            <h2 className="text-base font-semibold text-white">Performance Metrics</h2>
            {rrdLoading && (
              <div className="h-3 w-3 animate-spin rounded-full border border-nest-400 border-t-transparent" />
            )}
          </div>
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        </div>

        {rrdMetrics.length === 0 && !rrdLoading ? (
          <div className="glass rounded-xl p-8 text-center glow-border">
            <Activity size={32} className="text-nest-600 mx-auto mb-3" />
            <p className="text-sm text-nest-400">No metrics data available yet.</p>
            <p className="text-xs text-nest-500 mt-1">Metrics will appear after the agent starts collecting data.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* CPU Usage */}
            <ChartPanel title="CPU Usage" icon={Cpu}>
              <MiniChart
                data={cpuData}
                height={100}
                color="#6366f1"
                gradientId="cpu-grad"
                maxValue={100}
                minValue={0}
                label="CPU"
                valueLabel={`${cpuPercent}%`}
                unit="%"
                showGrid
              />
            </ChartPanel>

            {/* Memory Usage */}
            <ChartPanel title="Memory Usage" icon={MemoryStick}>
              <MiniChart
                data={memData}
                height={100}
                color="#10b981"
                gradientId="mem-grad"
                maxValue={100}
                minValue={0}
                label="RAM"
                valueLabel={`${memUsedGB} / ${memTotalGB} GB (${memPercent}%)`}
                unit="%"
                showGrid
              />
            </ChartPanel>

            {/* Network I/O */}
            <ChartPanel title="Network Traffic" icon={Network}>
              <MultiLineChart
                data={networkData}
                lines={[
                  { color: '#06b6d4', label: 'In' },
                  { color: '#f59e0b', label: 'Out' },
                ]}
                height={100}
                label="Network"
              />
            </ChartPanel>

            {/* Disk I/O */}
            <ChartPanel title="Disk I/O" icon={Disc}>
              <MultiLineChart
                data={diskIOData}
                lines={[
                  { color: '#8b5cf6', label: 'Read' },
                  { color: '#ec4899', label: 'Write' },
                ]}
                height={100}
                label="Disk"
              />
            </ChartPanel>

            {/* Load Average */}
            <ChartPanel title="Load Average" icon={Zap}>
              <MiniChart
                data={loadData}
                height={80}
                color="#f59e0b"
                gradientId="load-grad"
                minValue={0}
                label="Load"
                unit=""
                showGrid
              />
            </ChartPanel>

            {/* IO Wait */}
            <ChartPanel title="IO Wait" icon={Clock}>
              <MiniChart
                data={ioWaitData}
                height={80}
                color="#ef4444"
                gradientId="iowait-grad"
                maxValue={100}
                minValue={0}
                label="IOWait"
                unit="%"
                showGrid
              />
            </ChartPanel>

            {/* Swap Usage */}
            {swapData.some((d) => d.value !== null && d.value > 0) && (
              <ChartPanel title="Swap Usage" icon={MemoryStick}>
                <MiniChart
                  data={swapData}
                  height={80}
                  color="#f97316"
                  gradientId="swap-grad"
                  maxValue={100}
                  minValue={0}
                  label="Swap"
                  unit="%"
                  showGrid
                />
              </ChartPanel>
            )}

            {/* Root Disk Usage */}
            <ChartPanel title="Root Disk Usage" icon={HardDrive}>
              <MiniChart
                data={rootDiskData}
                height={80}
                color="#eab308"
                gradientId="root-grad"
                maxValue={100}
                minValue={0}
                label="Root FS"
                unit="%"
                showGrid
              />
            </ChartPanel>
          </div>
        )}
      </div>

      {/* ─── Resources List ─────────────────────── */}
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
