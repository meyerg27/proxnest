/**
 * ProxNest Agent — Command Handler
 * Handles remote commands from the cloud portal.
 * Supports system operations, guest management, app installs, storage, network, and more.
 */

import { execSync, exec } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import type { Logger } from './logger.js';
import { MetricsCollector } from './collector.js';

interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export class CommandExecutor {
  private log: Logger;
  private collector: MetricsCollector;

  constructor(logger: Logger, collector: MetricsCollector) {
    this.log = logger;
    this.collector = collector;
  }

  async execute(action: string, params: Record<string, unknown>): Promise<CommandResult> {
    this.log.info({ action }, 'Executing command');

    switch (action) {
      // ─── System ─────────────────────────────
      case 'system.info':
        return { success: true, data: this.collector.getSystemInfo() };

      case 'system.metrics':
        return { success: true, data: this.collector.collectFull() };

      case 'system.reboot':
        return this.reboot();

      case 'system.shutdown':
        return this.shutdown();

      case 'system.update':
        return this.systemUpdate();

      case 'system.logs':
        return this.getSystemLogs(params);

      // ─── Guest Management (new cloud dashboard) ─
      case 'guests.list':
        return this.guestsList();

      case 'guests.start':
        return this.guestsAction('start', params);

      case 'guests.stop':
        return this.guestsAction('stop', params);

      case 'guests.restart':
        return this.guestsAction('restart', params);

      // ─── Legacy Guest Management ────────────
      case 'guest.list':
        return { success: true, data: this.collector.getGuests() };

      case 'guest.start':
        return this.guestAction('start', params);

      case 'guest.stop':
        return this.guestAction('stop', params);

      case 'guest.restart':
        return this.guestAction('restart', params);

      case 'guest.status':
        return this.guestStatus(params);

      // ─── Storage ────────────────────────────
      case 'storage.list':
        return this.storageList();

      case 'storage.disks':
        return { success: true, data: this.collector.getDiskMetrics() };

      case 'storage.zfs':
        return { success: true, data: this.collector.getZfsPools() };

      case 'storage.zfs.scrub':
        return this.zfsScrub(params);

      case 'storage.zfs.snapshot':
        return this.zfsSnapshot(params);

      case 'storage.smart':
        return this.smartStatus(params);

      // ─── Network ────────────────────────────
      case 'network.list':
        return this.networkList();

      case 'network.interfaces':
        return { success: true, data: this.collector.getNetworkMetrics() };

      case 'network.ping':
        return this.ping(params);

      // ─── Apps ───────────────────────────────
      case 'apps.list':
        return this.appsList();

      case 'apps.install':
        return this.appsInstall(params);

      // ─── Docker ─────────────────────────────
      case 'docker.containers':
        return this.dockerContainers();

      case 'docker.compose.up':
        return this.dockerComposeUp(params);

      case 'docker.compose.down':
        return this.dockerComposeDown(params);

      // ─── Legacy App Install ─────────────────
      case 'app.install':
        return this.installApp(params);

      case 'app.uninstall':
        return this.uninstallApp(params);

      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  // ─── System Commands ────────────────────────

  private reboot(): CommandResult {
    this.log.warn('System reboot requested');
    exec('shutdown -r +1 "ProxNest: Reboot requested from cloud portal"');
    return { success: true, data: { message: 'System will reboot in 1 minute' } };
  }

  private shutdown(): CommandResult {
    this.log.warn('System shutdown requested');
    exec('shutdown -h +1 "ProxNest: Shutdown requested from cloud portal"');
    return { success: true, data: { message: 'System will shut down in 1 minute' } };
  }

  private systemUpdate(): CommandResult {
    try {
      const output = execSync('apt update && apt list --upgradable 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 60_000,
      });
      const upgradable = output
        .split('\n')
        .filter(l => l.includes('upgradable'))
        .map(l => l.split('/')[0]);
      return { success: true, data: { upgradable, count: upgradable.length } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private getSystemLogs(params: Record<string, unknown>): CommandResult {
    const lines = (params.lines as number) || 100;
    const unit = params.unit as string;
    try {
      const cmd = unit
        ? `journalctl -u ${unit} --no-pager -n ${lines} --output=short-iso`
        : `journalctl --no-pager -n ${lines} --output=short-iso`;
      const output = execSync(cmd, { encoding: 'utf-8', timeout: 10_000 });
      return { success: true, data: { logs: output.trim().split('\n') } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ─── Guests List (enhanced for cloud dashboard) ─

  private guestsList(): CommandResult {
    try {
      const host = process.env.PROXMOX_HOST;
      const tokenId = process.env.PROXMOX_TOKEN_ID;
      const tokenSecret = process.env.PROXMOX_TOKEN_SECRET;
      const node = process.env.PROXMOX_NODE || 'pve';

      // If we have API access, use it for richer data
      // Otherwise fall back to local pct/qm commands
      const guests = this.collector.getGuests();

      return {
        success: true,
        data: {
          guests: guests.map(g => ({
            vmid: g.vmid,
            name: g.name,
            type: g.type,
            status: g.status,
            cpus: g.cpus,
            memoryMB: g.memoryMB,
            diskGB: g.diskGB,
            uptime: g.uptime,
            netin: g.netin,
            netout: g.netout,
          })),
        },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private guestsAction(action: string, params: Record<string, unknown>): CommandResult {
    const vmid = params.vmid as number;
    const type = (params.type as string) || 'lxc';
    if (!vmid) return { success: false, error: 'vmid required' };

    const cmd = type === 'qemu' ? 'qm' : 'pct';
    // Map 'restart' to the correct Proxmox command
    const pveAction = action === 'restart' ? 'reboot' : action;

    try {
      // For reboot on stopped containers, start instead
      if (action === 'restart') {
        try {
          const statusOut = execSync(`${cmd} status ${vmid} 2>&1`, { encoding: 'utf-8', timeout: 5_000 });
          if (statusOut.includes('stopped')) {
            const output = execSync(`${cmd} start ${vmid} 2>&1`, { encoding: 'utf-8', timeout: 60_000 });
            return { success: true, data: { vmid, action: 'start (was stopped)', output: output.trim() } };
          }
        } catch { /* proceed with reboot */ }
      }

      const output = execSync(`${cmd} ${pveAction} ${vmid} 2>&1`, {
        encoding: 'utf-8',
        timeout: 60_000,
      });
      return { success: true, data: { vmid, action, output: output.trim() } };
    } catch (err) {
      // If reboot fails, try stop + start
      if (action === 'restart') {
        try {
          execSync(`${cmd} stop ${vmid} 2>&1`, { encoding: 'utf-8', timeout: 30_000 });
          // Wait briefly
          execSync('sleep 2', { encoding: 'utf-8' });
          const output = execSync(`${cmd} start ${vmid} 2>&1`, { encoding: 'utf-8', timeout: 60_000 });
          return { success: true, data: { vmid, action: 'restart (stop+start)', output: output.trim() } };
        } catch (err2) {
          return { success: false, error: err2 instanceof Error ? err2.message : String(err2) };
        }
      }
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ─── Storage List (Proxmox storage pools) ────

  private storageList(): CommandResult {
    try {
      const storages: Array<{
        id: string;
        type: string;
        content: string;
        path: string;
        totalBytes: number;
        usedBytes: number;
        freeBytes: number;
        usagePercent: number;
        active: boolean;
      }> = [];

      // Try Proxmox API first
      const host = process.env.PROXMOX_HOST;
      const tokenId = process.env.PROXMOX_TOKEN_ID;
      const tokenSecret = process.env.PROXMOX_TOKEN_SECRET;
      const node = process.env.PROXMOX_NODE || 'pve';

      // Try pvesm status for Proxmox storage
      try {
        const output = execSync('pvesm status 2>/dev/null', { encoding: 'utf-8', timeout: 10_000 });
        const lines = output.trim().split('\n').slice(1);
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length < 7) continue;
          const [name, type, status, total, used, available, pctStr] = parts;
          const totalBytes = parseInt(total, 10) || 0;
          const usedBytes = parseInt(used, 10) || 0;
          const freeBytes = parseInt(available, 10) || 0;
          const pct = parseFloat(pctStr?.replace('%', '') || '0');

          storages.push({
            id: name,
            type: type,
            content: '',
            path: '',
            totalBytes,
            usedBytes,
            freeBytes,
            usagePercent: pct,
            active: status === 'active',
          });
        }
      } catch {
        // pvesm not available, fall back to df
      }

      // If no pvesm results, fall back to df + ZFS
      if (storages.length === 0) {
        const disks = this.collector.getDiskMetrics();
        for (const d of disks) {
          storages.push({
            id: d.mountpoint === '/' ? 'local' : d.mountpoint.split('/').pop() || d.device,
            type: d.fstype,
            content: 'rootdir,images',
            path: d.mountpoint,
            totalBytes: d.totalGB * 1073741824,
            usedBytes: d.usedGB * 1073741824,
            freeBytes: d.availGB * 1073741824,
            usagePercent: d.usagePercent,
            active: true,
          });
        }

        const zfsPools = this.collector.getZfsPools();
        for (const p of zfsPools) {
          // Don't duplicate if already in disks
          if (!storages.find(s => s.id === p.name)) {
            storages.push({
              id: p.name,
              type: 'zfspool',
              content: 'rootdir,images',
              path: `/${p.name}`,
              totalBytes: p.totalGB * 1073741824,
              usedBytes: p.usedGB * 1073741824,
              freeBytes: p.freeGB * 1073741824,
              usagePercent: p.capacity,
              active: p.state === 'online',
            });
          }
        }
      }

      return { success: true, data: { storages } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ─── Network List ───────────────────────────

  private networkList(): CommandResult {
    try {
      const interfaces = this.collector.getNetworkMetrics();

      // Also try to get bridge info
      const bridges: Array<{ name: string; ports: string[]; stp: boolean }> = [];
      try {
        const brOutput = execSync('brctl show 2>/dev/null', { encoding: 'utf-8', timeout: 5_000 });
        const lines = brOutput.trim().split('\n').slice(1);
        let currentBridge: { name: string; ports: string[]; stp: boolean } | null = null;
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 3 && !line.startsWith('\t') && !line.startsWith(' ')) {
            if (currentBridge) bridges.push(currentBridge);
            currentBridge = {
              name: parts[0],
              stp: parts[2] === 'yes',
              ports: parts[3] ? [parts[3]] : [],
            };
          } else if (currentBridge && parts.length >= 1) {
            currentBridge.ports.push(parts[parts.length - 1]);
          }
        }
        if (currentBridge) bridges.push(currentBridge);
      } catch {
        // brctl not available
      }

      // Get default gateway
      let gateway = '';
      try {
        const routeOut = execSync("ip route show default 2>/dev/null | awk '{print $3}'", { encoding: 'utf-8', timeout: 5_000 });
        gateway = routeOut.trim();
      } catch { /* ignore */ }

      // Get DNS
      let dns: string[] = [];
      try {
        const resolv = readFileSync('/etc/resolv.conf', 'utf-8');
        dns = resolv.split('\n')
          .filter(l => l.startsWith('nameserver'))
          .map(l => l.split(/\s+/)[1])
          .filter(Boolean);
      } catch { /* ignore */ }

      return {
        success: true,
        data: {
          interfaces: interfaces.map(iface => ({
            name: iface.interface,
            state: iface.state,
            ipv4: iface.ipv4,
            ipv6: iface.ipv6,
            speed: iface.speed,
            rxBytes: iface.rxBytes,
            txBytes: iface.txBytes,
            rxPackets: iface.rxPackets,
            txPackets: iface.txPackets,
          })),
          bridges,
          gateway,
          dns,
        },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ─── Apps List & Install ────────────────────

  private appsList(): CommandResult {
    // Return installed docker containers with proxnest prefix
    try {
      const installed: string[] = [];
      try {
        const output = execSync(
          'docker ps -a --format "{{.Names}}" 2>/dev/null | grep "^proxnest-"',
          { encoding: 'utf-8', timeout: 10_000 },
        );
        installed.push(...output.trim().split('\n').filter(Boolean).map(n => n.replace('proxnest-', '')));
      } catch {
        // docker not available or no proxnest containers
      }

      return { success: true, data: { installed } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private appsInstall(params: Record<string, unknown>): CommandResult {
    const appId = params.appId as string;
    const method = (params.method as string) || 'docker';

    if (!appId) return { success: false, error: 'appId required' };

    this.log.info({ appId, method }, 'Installing app from cloud dashboard');

    if (method === 'docker') {
      const image = params.image as string;
      const ports = params.ports as Record<string, number> | undefined;
      const volumes = params.volumes as Record<string, string> | undefined;
      const envVars = params.environment as Record<string, string> | undefined;
      const compose = params.compose as string | undefined;

      // If compose config is provided, use docker compose
      if (compose) {
        try {
          const composeDir = `/opt/proxnest/apps/${appId}`;
          mkdirSync(composeDir, { recursive: true });
          writeFileSync(`${composeDir}/docker-compose.yml`, compose);
          const output = execSync(`cd ${composeDir} && docker compose up -d 2>&1`, {
            encoding: 'utf-8',
            timeout: 180_000,
          });
          return { success: true, data: { appId, method: 'compose', output: output.trim() } };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
      }

      if (!image) return { success: false, error: 'Docker image required' };

      try {
        let cmd = `docker run -d --name proxnest-${appId} --restart unless-stopped`;
        if (ports) {
          Object.entries(ports).forEach(([container, host]) => {
            cmd += ` -p ${host}:${container}`;
          });
        }
        if (volumes) {
          Object.entries(volumes).forEach(([container, host]) => {
            // Ensure host directory exists
            try { mkdirSync(host, { recursive: true }); } catch { /* ok */ }
            cmd += ` -v ${host}:${container}`;
          });
        }
        if (envVars) {
          Object.entries(envVars).forEach(([k, v]) => {
            if (v) cmd += ` -e ${k}=${v}`;
          });
        }
        cmd += ` ${image}`;

        const output = execSync(`${cmd} 2>&1`, { encoding: 'utf-8', timeout: 180_000 });
        return { success: true, data: { appId, containerId: output.trim(), method: 'docker' } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    if (method === 'lxc') {
      const lxcConfig = params.lxc as {
        ostemplate: string;
        cores: number;
        memory: number;
        swap: number;
        rootfs: number;
        unprivileged?: boolean;
        features?: string;
        startup_script?: string;
      } | undefined;

      if (!lxcConfig) return { success: false, error: 'LXC config required' };

      try {
        // Find next available VMID
        const vmidOut = execSync('pvesh get /cluster/nextid 2>/dev/null', { encoding: 'utf-8', timeout: 5_000 });
        const vmid = parseInt(vmidOut.trim(), 10);

        // Storage for rootfs
        const storage = params.storage as string || 'local-lvm';
        const hostname = `proxnest-${appId}`;

        let cmd = `pct create ${vmid} ${lxcConfig.ostemplate}`;
        cmd += ` --hostname ${hostname}`;
        cmd += ` --cores ${lxcConfig.cores}`;
        cmd += ` --memory ${lxcConfig.memory}`;
        cmd += ` --swap ${lxcConfig.swap || 0}`;
        cmd += ` --rootfs ${storage}:${lxcConfig.rootfs}`;
        cmd += ` --net0 name=eth0,bridge=vmbr0,ip=dhcp`;
        if (lxcConfig.unprivileged) cmd += ` --unprivileged 1`;
        if (lxcConfig.features) cmd += ` --features ${lxcConfig.features}`;

        const createOutput = execSync(`${cmd} 2>&1`, { encoding: 'utf-8', timeout: 120_000 });

        // Start the container
        execSync(`pct start ${vmid} 2>&1`, { encoding: 'utf-8', timeout: 60_000 });

        // Run startup script if provided
        if (lxcConfig.startup_script) {
          // Wait for container to be fully up
          execSync('sleep 5', { encoding: 'utf-8' });
          try {
            execSync(`pct exec ${vmid} -- bash -c '${lxcConfig.startup_script.replace(/'/g, "'\\''")}'`, {
              encoding: 'utf-8',
              timeout: 300_000,
            });
          } catch (scriptErr) {
            this.log.warn({ err: scriptErr, vmid }, 'Startup script had errors but container was created');
          }
        }

        return {
          success: true,
          data: {
            appId,
            vmid,
            hostname,
            method: 'lxc',
            output: createOutput.trim(),
          },
        };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    return { success: false, error: `Unknown install method: ${method}` };
  }

  // ─── Legacy Guest Commands ──────────────────

  private guestAction(action: string, params: Record<string, unknown>): CommandResult {
    const vmid = params.vmid as number;
    const type = (params.type as string) || 'lxc';
    if (!vmid) return { success: false, error: 'vmid required' };

    const cmd = type === 'qemu' ? 'qm' : 'pct';
    try {
      const output = execSync(`${cmd} ${action} ${vmid} 2>&1`, {
        encoding: 'utf-8',
        timeout: 60_000,
      });
      return { success: true, data: { vmid, action, output: output.trim() } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private guestStatus(params: Record<string, unknown>): CommandResult {
    const vmid = params.vmid as number;
    const type = (params.type as string) || 'lxc';
    if (!vmid) return { success: false, error: 'vmid required' };

    const cmd = type === 'qemu' ? 'qm' : 'pct';
    try {
      const output = execSync(`${cmd} status ${vmid} 2>&1`, { encoding: 'utf-8', timeout: 10_000 });
      return { success: true, data: { vmid, status: output.trim() } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ─── Storage Commands ───────────────────────

  private zfsScrub(params: Record<string, unknown>): CommandResult {
    const pool = params.pool as string;
    if (!pool) return { success: false, error: 'pool name required' };
    if (!/^[a-zA-Z0-9_-]+$/.test(pool)) return { success: false, error: 'Invalid pool name' };

    try {
      execSync(`zpool scrub ${pool} 2>&1`, { encoding: 'utf-8', timeout: 10_000 });
      return { success: true, data: { pool, message: 'Scrub started' } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private zfsSnapshot(params: Record<string, unknown>): CommandResult {
    const dataset = params.dataset as string;
    if (!dataset) return { success: false, error: 'dataset required' };

    const name = params.name || `proxnest-${Date.now()}`;
    try {
      execSync(`zfs snapshot ${dataset}@${name} 2>&1`, { encoding: 'utf-8', timeout: 30_000 });
      return { success: true, data: { snapshot: `${dataset}@${name}` } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private smartStatus(params: Record<string, unknown>): CommandResult {
    const device = params.device as string;
    try {
      if (device) {
        if (!/^\/dev\/[a-zA-Z0-9]+$/.test(device)) return { success: false, error: 'Invalid device path' };
        const output = execSync(`smartctl -a ${device} 2>&1`, { encoding: 'utf-8', timeout: 30_000 });
        return { success: true, data: { device, output } };
      }
      const output = execSync('smartctl --scan 2>/dev/null', { encoding: 'utf-8', timeout: 10_000 });
      const devices = output.trim().split('\n').map(l => l.split(' ')[0]).filter(Boolean);
      const results: Record<string, string> = {};
      for (const dev of devices) {
        try {
          results[dev] = execSync(`smartctl -H ${dev} 2>&1`, { encoding: 'utf-8', timeout: 10_000 });
        } catch {
          results[dev] = 'Failed to read';
        }
      }
      return { success: true, data: results };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ─── Network Commands ───────────────────────

  private ping(params: Record<string, unknown>): CommandResult {
    const host = params.host as string;
    if (!host) return { success: false, error: 'host required' };
    if (!/^[a-zA-Z0-9._-]+$/.test(host)) return { success: false, error: 'Invalid hostname' };

    try {
      const output = execSync(`ping -c 4 -W 5 ${host} 2>&1`, { encoding: 'utf-8', timeout: 30_000 });
      return { success: true, data: { host, output: output.trim() } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ─── Docker Commands ────────────────────────

  private dockerContainers(): CommandResult {
    try {
      const output = execSync(
        'docker ps -a --format "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" 2>&1',
        { encoding: 'utf-8', timeout: 10_000 },
      );
      const containers = output.trim().split('\n').filter(Boolean).map(line => {
        const [id, name, image, status, ports] = line.split('\t');
        return { id, name, image, status, ports };
      });
      return { success: true, data: containers };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private dockerComposeUp(params: Record<string, unknown>): CommandResult {
    const path = params.path as string;
    if (!path) return { success: false, error: 'compose file path required' };
    if (!existsSync(path)) return { success: false, error: `File not found: ${path}` };

    try {
      const output = execSync(`docker compose -f ${path} up -d 2>&1`, {
        encoding: 'utf-8',
        timeout: 120_000,
      });
      return { success: true, data: { output: output.trim() } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private dockerComposeDown(params: Record<string, unknown>): CommandResult {
    const path = params.path as string;
    if (!path) return { success: false, error: 'compose file path required' };
    if (!existsSync(path)) return { success: false, error: `File not found: ${path}` };

    try {
      const output = execSync(`docker compose -f ${path} down 2>&1`, {
        encoding: 'utf-8',
        timeout: 60_000,
      });
      return { success: true, data: { output: output.trim() } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ─── Legacy App Install/Uninstall ───────────

  private installApp(params: Record<string, unknown>): CommandResult {
    const appId = params.appId as string;
    const method = (params.method as string) || 'docker';
    if (!appId) return { success: false, error: 'appId required' };
    // Delegate to the new appsInstall
    return this.appsInstall(params);
  }

  private uninstallApp(params: Record<string, unknown>): CommandResult {
    const appId = params.appId as string;
    const method = (params.method as string) || 'docker';

    if (!appId) return { success: false, error: 'appId required' };

    if (method === 'docker') {
      try {
        execSync(`docker stop proxnest-${appId} 2>&1 && docker rm proxnest-${appId} 2>&1`, {
          encoding: 'utf-8',
          timeout: 30_000,
        });
        return { success: true, data: { appId, removed: true } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    return { success: false, error: `Unknown uninstall method: ${method}` };
  }
}
