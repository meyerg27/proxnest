/**
 * System Metrics Collector
 * Gathers hardware stats, Proxmox data, and system info
 * from the local server without requiring Proxmox API access
 * (falls back to /proc and sysfs when PVE API unavailable).
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { hostname, platform, arch, release, cpus, totalmem, freemem, uptime, networkInterfaces } from 'node:os';
import type { Logger } from './logger.js';

// ─── Types ────────────────────────────────────────

export interface SystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  kernel: string;
  cpuModel: string;
  cpuCores: number;
  cpuThreads: number;
  totalMemoryMB: number;
  pveVersion: string | null;
  pveKernel: string | null;
}

export interface CpuMetrics {
  usagePercent: number;
  loadAvg: [number, number, number];
  coreCount: number;
  frequency: number; // MHz
  temperatures: number[]; // per-core temps if available
}

export interface MemoryMetrics {
  totalMB: number;
  usedMB: number;
  freeMB: number;
  availableMB: number;
  usagePercent: number;
  swapTotalMB: number;
  swapUsedMB: number;
}

export interface DiskInfo {
  device: string;
  mountpoint: string;
  fstype: string;
  totalGB: number;
  usedGB: number;
  availGB: number;
  usagePercent: number;
}

export interface NetworkMetrics {
  interface: string;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  ipv4: string[];
  ipv6: string[];
  speed: number | null; // Mbps
  state: 'up' | 'down' | 'unknown';
}

export interface ZfsPoolInfo {
  name: string;
  state: string;
  totalGB: number;
  usedGB: number;
  freeGB: number;
  fragmentation: number;
  capacity: number;
  dedup: number;
}

export interface GuestInfo {
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

export interface FullMetrics {
  timestamp: string;
  system: SystemInfo;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disks: DiskInfo[];
  networks: NetworkMetrics[];
  zfsPools: ZfsPoolInfo[];
  guests: GuestInfo[];
  uptimeSeconds: number;
}

export interface HeartbeatMetrics {
  timestamp: string;
  uptimeSeconds: number;
  cpu: { usagePercent: number; loadAvg: number };
  memory: { usagePercent: number; usedMB: number; totalMB: number };
  disk: { usedGB: number; totalGB: number };
  guestCount: { running: number; stopped: number };
}

// ─── Collector Class ──────────────────────────────

export class MetricsCollector {
  private prevCpuTimes: { idle: number; total: number } | null = null;
  private log: Logger;

  constructor(logger: Logger) {
    this.log = logger;
  }

  // ─── System Info ──────────────────────────────
  getSystemInfo(): SystemInfo {
    const cpuInfo = cpus();
    let pveVersion: string | null = null;

    try {
      pveVersion = execSync('pveversion --verbose 2>/dev/null', { encoding: 'utf-8' })
        .split('\n')[0]
        ?.replace('proxmox-ve: ', '')
        ?.trim() || null;
    } catch {
      // Not a PVE host or pveversion not available
    }

    let pveKernel: string | null = null;
    const kernelRelease = release();
    if (kernelRelease.includes('pve')) {
      pveKernel = kernelRelease;
    }

    return {
      hostname: hostname(),
      platform: platform(),
      arch: arch(),
      kernel: kernelRelease,
      cpuModel: cpuInfo[0]?.model || 'Unknown',
      cpuCores: new Set(cpuInfo.map(c => c.model)).size > 1 ? cpuInfo.length : cpuInfo.length,
      cpuThreads: cpuInfo.length,
      totalMemoryMB: Math.round(totalmem() / 1048576),
      pveVersion,
      pveKernel,
    };
  }

  // ─── CPU Metrics ──────────────────────────────
  getCpuMetrics(): CpuMetrics {
    const loadAvg = (() => {
      try {
        const raw = readFileSync('/proc/loadavg', 'utf-8').trim().split(' ');
        return [parseFloat(raw[0]), parseFloat(raw[1]), parseFloat(raw[2])] as [number, number, number];
      } catch {
        return [0, 0, 0] as [number, number, number];
      }
    })();

    // Calculate CPU usage from /proc/stat
    let usagePercent = loadAvg[0] / cpus().length * 100;
    try {
      const stat = readFileSync('/proc/stat', 'utf-8');
      const cpuLine = stat.split('\n')[0]; // "cpu  user nice system idle iowait irq softirq steal"
      const parts = cpuLine.split(/\s+/).slice(1).map(Number);
      const idle = parts[3] + (parts[4] || 0); // idle + iowait
      const total = parts.reduce((a, b) => a + b, 0);

      if (this.prevCpuTimes) {
        const idleDelta = idle - this.prevCpuTimes.idle;
        const totalDelta = total - this.prevCpuTimes.total;
        if (totalDelta > 0) {
          usagePercent = Math.round(((totalDelta - idleDelta) / totalDelta) * 100 * 10) / 10;
        }
      }
      this.prevCpuTimes = { idle, total };
    } catch {
      // Fall back to load average
    }

    // CPU frequency
    let frequency = cpus()[0]?.speed || 0;

    // CPU temperatures
    const temperatures: number[] = [];
    try {
      const hwmonDirs = readdirSync('/sys/class/hwmon');
      for (const dir of hwmonDirs) {
        const basePath = `/sys/class/hwmon/${dir}`;
        const nameFile = `${basePath}/name`;
        if (!existsSync(nameFile)) continue;
        const name = readFileSync(nameFile, 'utf-8').trim();
        if (name === 'coretemp' || name === 'k10temp' || name === 'zenpower') {
          // Read all temp inputs
          for (let i = 1; i <= 32; i++) {
            const tempFile = `${basePath}/temp${i}_input`;
            if (!existsSync(tempFile)) break;
            const temp = parseInt(readFileSync(tempFile, 'utf-8').trim(), 10);
            if (!isNaN(temp)) temperatures.push(temp / 1000);
          }
          break;
        }
      }
    } catch {
      // No temperature data
    }

    return {
      usagePercent: Math.min(100, Math.max(0, usagePercent)),
      loadAvg,
      coreCount: cpus().length,
      frequency,
      temperatures,
    };
  }

  // ─── Memory Metrics ───────────────────────────
  getMemoryMetrics(): MemoryMetrics {
    let memTotal = 0, memFree = 0, memAvailable = 0, memBuffers = 0, memCached = 0;
    let swapTotal = 0, swapFree = 0;

    try {
      const meminfo = readFileSync('/proc/meminfo', 'utf-8');
      for (const line of meminfo.split('\n')) {
        const [key, val] = line.split(':');
        if (!key || !val) continue;
        const kb = parseInt(val.trim(), 10);
        switch (key.trim()) {
          case 'MemTotal': memTotal = kb; break;
          case 'MemFree': memFree = kb; break;
          case 'MemAvailable': memAvailable = kb; break;
          case 'Buffers': memBuffers = kb; break;
          case 'Cached': memCached = kb; break;
          case 'SwapTotal': swapTotal = kb; break;
          case 'SwapFree': swapFree = kb; break;
        }
      }
    } catch {
      // Fallback to os module
      const total = totalmem();
      const free = freemem();
      return {
        totalMB: Math.round(total / 1048576),
        usedMB: Math.round((total - free) / 1048576),
        freeMB: Math.round(free / 1048576),
        availableMB: Math.round(free / 1048576),
        usagePercent: Math.round(((total - free) / total) * 100),
        swapTotalMB: 0,
        swapUsedMB: 0,
      };
    }

    const totalMB = Math.round(memTotal / 1024);
    const usedMB = Math.round((memTotal - memAvailable) / 1024);
    const freeMB = Math.round(memFree / 1024);
    const availableMB = Math.round(memAvailable / 1024);

    return {
      totalMB,
      usedMB,
      freeMB,
      availableMB,
      usagePercent: totalMB > 0 ? Math.round((usedMB / totalMB) * 100) : 0,
      swapTotalMB: Math.round(swapTotal / 1024),
      swapUsedMB: Math.round((swapTotal - swapFree) / 1024),
    };
  }

  // ─── Disk Metrics ─────────────────────────────
  getDiskMetrics(): DiskInfo[] {
    const disks: DiskInfo[] = [];
    try {
      const df = execSync('df -BG -T --exclude-type=tmpfs --exclude-type=devtmpfs --exclude-type=squashfs --exclude-type=overlay 2>/dev/null', { encoding: 'utf-8' });
      const lines = df.trim().split('\n').slice(1); // skip header
      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length < 7) continue;
        const [device, fstype, totalStr, usedStr, availStr, useStr, mountpoint] = parts;
        if (device.startsWith('/dev/') || mountpoint === '/') {
          disks.push({
            device,
            mountpoint,
            fstype,
            totalGB: parseInt(totalStr, 10),
            usedGB: parseInt(usedStr, 10),
            availGB: parseInt(availStr, 10),
            usagePercent: parseInt(useStr, 10),
          });
        }
      }
    } catch {
      this.log.debug('Failed to read disk metrics');
    }
    return disks;
  }

  // ─── Network Metrics ──────────────────────────
  getNetworkMetrics(): NetworkMetrics[] {
    const metrics: NetworkMetrics[] = [];
    const interfaces = networkInterfaces();

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs || name === 'lo') continue;

      const ipv4 = addrs.filter(a => a.family === 'IPv4').map(a => a.address);
      const ipv6 = addrs.filter(a => a.family === 'IPv6' && !a.address.startsWith('fe80')).map(a => a.address);

      let rxBytes = 0, txBytes = 0, rxPackets = 0, txPackets = 0;
      try {
        rxBytes = parseInt(readFileSync(`/sys/class/net/${name}/statistics/rx_bytes`, 'utf-8').trim(), 10);
        txBytes = parseInt(readFileSync(`/sys/class/net/${name}/statistics/tx_bytes`, 'utf-8').trim(), 10);
        rxPackets = parseInt(readFileSync(`/sys/class/net/${name}/statistics/rx_packets`, 'utf-8').trim(), 10);
        txPackets = parseInt(readFileSync(`/sys/class/net/${name}/statistics/tx_packets`, 'utf-8').trim(), 10);
      } catch {
        // Virtual interfaces may not have stats
      }

      let speed: number | null = null;
      try {
        speed = parseInt(readFileSync(`/sys/class/net/${name}/speed`, 'utf-8').trim(), 10);
        if (isNaN(speed) || speed < 0) speed = null;
      } catch {
        speed = null;
      }

      let state: 'up' | 'down' | 'unknown' = 'unknown';
      try {
        const operstate = readFileSync(`/sys/class/net/${name}/operstate`, 'utf-8').trim();
        state = operstate === 'up' ? 'up' : operstate === 'down' ? 'down' : 'unknown';
      } catch {
        // use unknown
      }

      metrics.push({ interface: name, rxBytes, txBytes, rxPackets, txPackets, ipv4, ipv6, speed, state });
    }

    return metrics;
  }

  // ─── ZFS Pool Metrics ─────────────────────────
  getZfsPools(): ZfsPoolInfo[] {
    const pools: ZfsPoolInfo[] = [];
    try {
      const output = execSync(
        'zpool list -Hp -o name,health,size,alloc,free,frag,cap,dedup 2>/dev/null',
        { encoding: 'utf-8' },
      );
      for (const line of output.trim().split('\n')) {
        if (!line.trim()) continue;
        const [name, state, size, alloc, free, frag, cap, dedup] = line.split('\t');
        pools.push({
          name,
          state: state.toLowerCase(),
          totalGB: Math.round(parseInt(size, 10) / 1073741824 * 10) / 10,
          usedGB: Math.round(parseInt(alloc, 10) / 1073741824 * 10) / 10,
          freeGB: Math.round(parseInt(free, 10) / 1073741824 * 10) / 10,
          fragmentation: parseInt(frag, 10) || 0,
          capacity: parseInt(cap, 10) || 0,
          dedup: parseFloat(dedup) || 1,
        });
      }
    } catch {
      // ZFS not installed or no pools
    }
    return pools;
  }

  // ─── Guest Info (from qm/pct) ─────────────────
  getGuests(): GuestInfo[] {
    const guests: GuestInfo[] = [];

    // LXC containers
    try {
      const output = execSync('pct list 2>/dev/null', { encoding: 'utf-8' });
      const lines = output.trim().split('\n').slice(1); // skip header
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 3) continue;
        const vmid = parseInt(parts[0], 10);
        const status = parts[1].toLowerCase() as GuestInfo['status'];
        const name = parts.slice(2).join(' ');

        let cpuCount = 1, memMB = 512, diskGB = 8, uptimeSec = 0;
        try {
          const conf = execSync(`pct config ${vmid} 2>/dev/null`, { encoding: 'utf-8' });
          for (const confLine of conf.split('\n')) {
            if (confLine.startsWith('cores:')) cpuCount = parseInt(confLine.split(':')[1].trim(), 10);
            if (confLine.startsWith('memory:')) memMB = parseInt(confLine.split(':')[1].trim(), 10);
          }
        } catch { /* skip */ }

        guests.push({
          vmid, name, type: 'lxc', status,
          cpus: cpuCount, memoryMB: memMB, diskGB: diskGB,
          uptime: uptimeSec, netin: 0, netout: 0,
        });
      }
    } catch {
      // pct not available
    }

    // QEMU VMs
    try {
      const output = execSync('qm list 2>/dev/null', { encoding: 'utf-8' });
      const lines = output.trim().split('\n').slice(1); // skip header
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 3) continue;
        const vmid = parseInt(parts[0], 10);
        const name = parts[1];
        const status = parts[2].toLowerCase() as GuestInfo['status'];

        let cpuCount = 1, memMB = 1024;
        try {
          const conf = execSync(`qm config ${vmid} 2>/dev/null`, { encoding: 'utf-8' });
          for (const confLine of conf.split('\n')) {
            if (confLine.startsWith('cores:')) cpuCount = parseInt(confLine.split(':')[1].trim(), 10);
            if (confLine.startsWith('memory:')) memMB = parseInt(confLine.split(':')[1].trim(), 10);
          }
        } catch { /* skip */ }

        guests.push({
          vmid, name, type: 'qemu', status,
          cpus: cpuCount, memoryMB: memMB, diskGB: 0,
          uptime: 0, netin: 0, netout: 0,
        });
      }
    } catch {
      // qm not available
    }

    return guests;
  }

  // ─── Full Collection ──────────────────────────
  collectFull(): FullMetrics {
    return {
      timestamp: new Date().toISOString(),
      system: this.getSystemInfo(),
      cpu: this.getCpuMetrics(),
      memory: this.getMemoryMetrics(),
      disks: this.getDiskMetrics(),
      networks: this.getNetworkMetrics(),
      zfsPools: this.getZfsPools(),
      guests: this.getGuests(),
      uptimeSeconds: Math.round(uptime()),
    };
  }

  // ─── Proxmox API Guest Count ───────────────────
  async getGuestCountFromApi(): Promise<{ running: number; stopped: number }> {
    const host = process.env.PROXMOX_HOST;
    const tokenId = process.env.PROXMOX_TOKEN_ID;
    const tokenSecret = process.env.PROXMOX_TOKEN_SECRET;
    const node = process.env.PROXMOX_NODE || 'pve';

    if (!host || !tokenId || !tokenSecret) {
      // Fall back to local pct/qm if no API config
      const guests = this.getGuests();
      return {
        running: guests.filter(g => g.status === 'running').length,
        stopped: guests.filter(g => g.status !== 'running').length,
      };
    }

    try {
      const res = await fetch(`${host}/api2/json/nodes/${node}/status`, {
        headers: { Authorization: `PVEAPIToken=${tokenId}=${tokenSecret}` },
        signal: AbortSignal.timeout(5000),
        // @ts-ignore - Node.js fetch rejectUnauthorized
      });
      if (!res.ok) throw new Error(`PVE API ${res.status}`);
      // PVE status doesn't directly give guest counts, use /nodes/{node}/qemu + /nodes/{node}/lxc
      const [qemuRes, lxcRes] = await Promise.all([
        fetch(`${host}/api2/json/nodes/${node}/qemu`, {
          headers: { Authorization: `PVEAPIToken=${tokenId}=${tokenSecret}` },
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`${host}/api2/json/nodes/${node}/lxc`, {
          headers: { Authorization: `PVEAPIToken=${tokenId}=${tokenSecret}` },
          signal: AbortSignal.timeout(5000),
        }),
      ]);
      const qemu = qemuRes.ok ? (await qemuRes.json() as any).data || [] : [];
      const lxc = lxcRes.ok ? (await lxcRes.json() as any).data || [] : [];
      const all = [...qemu, ...lxc];
      return {
        running: all.filter((g: any) => g.status === 'running').length,
        stopped: all.filter((g: any) => g.status !== 'running').length,
      };
    } catch (err) {
      this.log.debug({ err }, 'Failed to get guest count from PVE API');
      return { running: 0, stopped: 0 };
    }
  }

  // ─── Disk Total from Proxmox API ──────────────
  async getDiskFromApi(): Promise<{ usedGB: number; totalGB: number }> {
    const host = process.env.PROXMOX_HOST;
    const tokenId = process.env.PROXMOX_TOKEN_ID;
    const tokenSecret = process.env.PROXMOX_TOKEN_SECRET;
    const node = process.env.PROXMOX_NODE || 'pve';

    // Try local first
    const disks = this.getDiskMetrics();
    if (disks.length > 0) {
      const totalGB = disks.reduce((s, d) => s + d.totalGB, 0);
      const usedGB = disks.reduce((s, d) => s + d.usedGB, 0);
      if (totalGB > 0) return { usedGB, totalGB };
    }

    if (!host || !tokenId || !tokenSecret) return { usedGB: 0, totalGB: 0 };

    try {
      const res = await fetch(`${host}/api2/json/nodes/${node}/storage`, {
        headers: { Authorization: `PVEAPIToken=${tokenId}=${tokenSecret}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`PVE API ${res.status}`);
      const data = (await res.json() as any).data || [];
      let totalGB = 0, usedGB = 0;
      for (const store of data) {
        if (store.total && store.used) {
          totalGB += store.total / 1073741824;
          usedGB += store.used / 1073741824;
        }
      }
      return { usedGB: Math.round(usedGB * 10) / 10, totalGB: Math.round(totalGB * 10) / 10 };
    } catch (err) {
      this.log.debug({ err }, 'Failed to get disk from PVE API');
      return { usedGB: 0, totalGB: 0 };
    }
  }

  // ─── Lightweight Heartbeat ────────────────────
  async collectHeartbeat(): Promise<HeartbeatMetrics> {
    const cpu = this.getCpuMetrics();
    const memory = this.getMemoryMetrics();
    const [guestCount, disk] = await Promise.all([
      this.getGuestCountFromApi(),
      this.getDiskFromApi(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(uptime()),
      cpu: { usagePercent: cpu.usagePercent, loadAvg: cpu.loadAvg[0] },
      memory: { usagePercent: memory.usagePercent, usedMB: memory.usedMB, totalMB: memory.totalMB },
      disk,
      guestCount,
    };
  }
}
