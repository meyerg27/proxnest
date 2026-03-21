/**
 * ProxNest Agent — Command Handler
 * Handles remote commands from the cloud portal.
 * Supports system operations, guest management, app installs, storage, network, and more.
 */

import { execSync, exec } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import type { Logger } from './logger.js';
import { MetricsCollector } from './collector.js';
import { getAppConfig, type AppConfig } from './app-catalog.js';

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
        return await this.appsInstall(params);

      case 'apps.uninstall':
        return this.appsUninstall(params);

      case 'apps.start':
        return this.appsStart(params);

      case 'apps.stop':
        return this.appsStop(params);

      case 'apps.logs':
        return this.appsLogs(params);

      // ─── Backups ────────────────────────────
      case 'backups.list':
        return this.backupsList(params);

      case 'backups.create':
        return await this.backupsCreate(params);

      case 'backups.restore':
        return await this.backupsRestore(params);

      case 'backups.delete':
        return this.backupsDelete(params);

      case 'backups.storages':
        return this.backupsStorages();

      // ─── Docker ─────────────────────────────
      case 'docker.containers':
        return this.dockerContainers();

      case 'docker.compose.up':
        return this.dockerComposeUp(params);

      case 'docker.compose.down':
        return this.dockerComposeDown(params);

      // ─── Legacy App Install ─────────────────
      case 'app.install':
        return await this.installApp(params);

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

  /**
   * Detect host IP for building URLs.
   * Reads PROXMOX_HOST env or falls back to first non-loopback IPv4.
   */
  private getHostIp(): string {
    if (process.env.PROXMOX_HOST) {
      // Strip protocol/port if present
      return process.env.PROXMOX_HOST.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
    }
    try {
      const out = execSync(
        "ip -4 addr show scope global | grep -oP '(?<=inet )\\S+' | head -1 | cut -d/ -f1",
        { encoding: 'utf-8', timeout: 5_000 },
      );
      const ip = out.trim();
      if (ip) return ip;
    } catch { /* ignore */ }
    return '0.0.0.0';
  }

  /**
   * Check if a TCP port is in use.
   */
  private isPortInUse(port: number): boolean {
    try {
      const out = execSync(`ss -tlnp 2>/dev/null | grep -q ':${port} '`, { encoding: 'utf-8', timeout: 3_000 });
      return true; // grep succeeded → port in use
    } catch {
      return false; // grep failed → port free
    }
  }

  /**
   * Find a free port starting from the desired port.
   */
  private findFreePort(desired: number): number {
    let port = desired;
    while (this.isPortInUse(port) && port < desired + 100) {
      port++;
    }
    return port;
  }

  private appsList(): CommandResult {
    try {
      const installed: Array<{
        id: string;
        name: string;
        image: string;
        status: string;
        ports: string;
        url: string;
      }> = [];

      try {
        const output = execSync(
          'docker ps -a --filter "name=proxnest-" --format "{{json .}}" 2>/dev/null',
          { encoding: 'utf-8', timeout: 10_000 },
        );
        const hostIp = this.getHostIp();
        const lines = output.trim().split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const c = JSON.parse(line);
            const containerName: string = c.Names || '';
            if (!containerName.startsWith('proxnest-')) continue;
            const appId = containerName.replace('proxnest-', '');

            // Extract first host port from Ports string (e.g., "0.0.0.0:8096->8096/tcp")
            let webPort = '';
            const portsStr: string = c.Ports || '';
            const portMatch = portsStr.match(/0\.0\.0\.0:(\d+)/);
            if (portMatch) webPort = portMatch[1];

            installed.push({
              id: appId,
              name: containerName,
              image: c.Image || '',
              status: c.State || c.Status || 'unknown',
              ports: portsStr,
              url: webPort ? `http://${hostIp}:${webPort}` : '',
            });
          } catch { /* skip malformed JSON line */ }
        }
      } catch {
        // docker not available or no proxnest containers
      }

      return { success: true, data: { installed } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async appsInstall(params: Record<string, unknown>): Promise<CommandResult> {
    const appId = params.appId as string;
    if (!appId) return { success: false, error: 'appId required' };

    // Look up from embedded catalog
    const appConfig = getAppConfig(appId);
    if (!appConfig) {
      // Fall back to legacy behavior if not in catalog
      return this.appsInstallLegacy(params);
    }

    this.log.info({ appId, image: appConfig.image }, 'Installing app from catalog');

    try {
      // 1. Pull image
      this.log.info({ image: appConfig.image }, 'Pulling Docker image');
      execSync(`docker pull ${appConfig.image} 2>&1`, { encoding: 'utf-8', timeout: 300_000 });

      // 2. Resolve ports (handle conflicts)
      const resolvedPorts: Record<number, number> = {};
      for (const [hostPortStr, containerPort] of Object.entries(appConfig.ports)) {
        const desiredHost = parseInt(hostPortStr, 10);
        const actualHost = params.port && Object.keys(appConfig.ports).length === 1
          ? (params.port as number)
          : this.findFreePort(desiredHost);
        resolvedPorts[actualHost] = containerPort;
      }

      // 3. Create data directories
      for (const hostPath of Object.keys(appConfig.volumes)) {
        if (!hostPath.startsWith('/var/run/')) {
          try { mkdirSync(hostPath, { recursive: true }); } catch { /* ok */ }
        }
      }

      // 4. Build docker run command
      const containerName = `proxnest-${appId}`;

      // Remove existing container if any
      try {
        execSync(`docker rm -f ${containerName} 2>/dev/null`, { encoding: 'utf-8', timeout: 10_000 });
      } catch { /* ok, didn't exist */ }

      let cmd = `docker run -d --name ${containerName} --restart unless-stopped`;

      for (const [hostPort, containerPort] of Object.entries(resolvedPorts)) {
        cmd += ` -p ${hostPort}:${containerPort}`;
      }

      for (const [hostPath, containerPath] of Object.entries(appConfig.volumes)) {
        cmd += ` -v ${hostPath}:${containerPath}`;
      }

      if (appConfig.env) {
        for (const [k, v] of Object.entries(appConfig.env)) {
          cmd += ` -e ${k}=${v}`;
        }
      }

      cmd += ` ${appConfig.image}`;

      const containerId = execSync(`${cmd} 2>&1`, { encoding: 'utf-8', timeout: 60_000 }).trim();

      // 5. Wait and check
      execSync('sleep 3', { encoding: 'utf-8' });

      let status = 'unknown';
      try {
        status = execSync(
          `docker inspect --format '{{.State.Status}}' ${containerName} 2>/dev/null`,
          { encoding: 'utf-8', timeout: 5_000 },
        ).trim();
      } catch { /* ignore */ }

      // 6. Build URL
      const hostIp = this.getHostIp();
      const firstHostPort = Object.keys(resolvedPorts)[0];
      const url = firstHostPort ? `http://${hostIp}:${firstHostPort}` : '';

      return {
        success: true,
        data: {
          appId,
          containerId,
          status,
          url,
          ports: resolvedPorts,
        },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Legacy install path for apps not in the catalog (uses params directly).
   */
  private appsInstallLegacy(params: Record<string, unknown>): CommandResult {
    const appId = params.appId as string;
    const method = (params.method as string) || 'docker';

    if (method === 'docker') {
      const image = params.image as string;
      const ports = params.ports as Record<string, number> | undefined;
      const volumes = params.volumes as Record<string, string> | undefined;
      const envVars = params.environment as Record<string, string> | undefined;
      const compose = params.compose as string | undefined;

      if (compose) {
        try {
          const composeDir = `/opt/proxnest/apps/${appId}`;
          mkdirSync(composeDir, { recursive: true });
          writeFileSync(`${composeDir}/docker-compose.yml`, compose);
          const output = execSync(`cd ${composeDir} && docker compose up -d 2>&1`, {
            encoding: 'utf-8', timeout: 180_000,
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
        ostemplate: string; cores: number; memory: number; swap: number; rootfs: number;
        unprivileged?: boolean; features?: string; startup_script?: string;
      } | undefined;

      if (!lxcConfig) return { success: false, error: 'LXC config required' };

      try {
        const vmidOut = execSync('pvesh get /cluster/nextid 2>/dev/null', { encoding: 'utf-8', timeout: 5_000 });
        const vmid = parseInt(vmidOut.trim(), 10);
        const storage = params.storage as string || 'local-lvm';
        const hostname = `proxnest-${appId}`;

        let cmd = `pct create ${vmid} ${lxcConfig.ostemplate}`;
        cmd += ` --hostname ${hostname} --cores ${lxcConfig.cores} --memory ${lxcConfig.memory}`;
        cmd += ` --swap ${lxcConfig.swap || 0} --rootfs ${storage}:${lxcConfig.rootfs}`;
        cmd += ` --net0 name=eth0,bridge=vmbr0,ip=dhcp`;
        if (lxcConfig.unprivileged) cmd += ` --unprivileged 1`;
        if (lxcConfig.features) cmd += ` --features ${lxcConfig.features}`;

        const createOutput = execSync(`${cmd} 2>&1`, { encoding: 'utf-8', timeout: 120_000 });
        execSync(`pct start ${vmid} 2>&1`, { encoding: 'utf-8', timeout: 60_000 });

        if (lxcConfig.startup_script) {
          execSync('sleep 5', { encoding: 'utf-8' });
          try {
            execSync(`pct exec ${vmid} -- bash -c '${lxcConfig.startup_script.replace(/'/g, "'\\''")}'`, {
              encoding: 'utf-8', timeout: 300_000,
            });
          } catch (scriptErr) {
            this.log.warn({ err: scriptErr, vmid }, 'Startup script had errors but container was created');
          }
        }

        return { success: true, data: { appId, vmid, hostname, method: 'lxc', output: createOutput.trim() } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    return { success: false, error: `Unknown install method: ${method}` };
  }

  private appsUninstall(params: Record<string, unknown>): CommandResult {
    const appId = params.appId as string;
    if (!appId) return { success: false, error: 'appId required' };

    const containerName = `proxnest-${appId}`;
    try {
      try { execSync(`docker stop ${containerName} 2>&1`, { encoding: 'utf-8', timeout: 30_000 }); } catch { /* may already be stopped */ }
      execSync(`docker rm ${containerName} 2>&1`, { encoding: 'utf-8', timeout: 15_000 });
      return { success: true, data: { appId, removed: true } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private appsStart(params: Record<string, unknown>): CommandResult {
    const appId = params.appId as string;
    if (!appId) return { success: false, error: 'appId required' };

    try {
      execSync(`docker start proxnest-${appId} 2>&1`, { encoding: 'utf-8', timeout: 30_000 });
      return { success: true, data: { appId, status: 'running' } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private appsStop(params: Record<string, unknown>): CommandResult {
    const appId = params.appId as string;
    if (!appId) return { success: false, error: 'appId required' };

    try {
      execSync(`docker stop proxnest-${appId} 2>&1`, { encoding: 'utf-8', timeout: 30_000 });
      return { success: true, data: { appId, status: 'stopped' } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private appsLogs(params: Record<string, unknown>): CommandResult {
    const appId = params.appId as string;
    if (!appId) return { success: false, error: 'appId required' };

    const tail = Math.min(Math.max((params.tail as number) || 200, 10), 2000);
    const since = params.since as string | undefined; // e.g. "1h", "30m", "2024-01-01T00:00:00"
    const containerName = `proxnest-${appId}`;

    try {
      let cmd = `docker logs --tail ${tail} --timestamps`;
      if (since) {
        // Sanitize since param
        if (/^[0-9a-zA-Z.:T_-]+$/.test(since)) {
          cmd += ` --since ${since}`;
        }
      }
      cmd += ` ${containerName} 2>&1`;

      const output = execSync(cmd, { encoding: 'utf-8', timeout: 15_000 });
      const lines = output.split('\n').filter(Boolean);

      return {
        success: true,
        data: {
          appId,
          lines,
          count: lines.length,
          tail,
        },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ─── Backup Commands ─────────────────────────

  /**
   * List Proxmox backups across all storages or a specific storage.
   * Uses `pvesm list <storage> --content backup` for each backup-capable storage.
   */
  private backupsList(params: Record<string, unknown>): CommandResult {
    const storageFilter = params.storage as string | undefined;
    const vmidFilter = params.vmid as number | undefined;

    try {
      const backups: Array<{
        volid: string;
        storage: string;
        vmid: number;
        size: number;
        format: string;
        timestamp: string;
        notes: string;
        filename: string;
      }> = [];

      // Get all backup-capable storages
      let storageIds: string[] = [];
      if (storageFilter) {
        storageIds = [storageFilter];
      } else {
        try {
          const storageOutput = execSync(
            "pvesm status 2>/dev/null | awk 'NR>1 {print $1}'",
            { encoding: 'utf-8', timeout: 10_000 },
          );
          storageIds = storageOutput.trim().split('\n').filter(Boolean);
        } catch {
          // Fallback: try 'local'
          storageIds = ['local'];
        }
      }

      for (const sid of storageIds) {
        try {
          const output = execSync(
            `pvesm list ${sid} --content backup 2>/dev/null`,
            { encoding: 'utf-8', timeout: 15_000 },
          );
          const lines = output.trim().split('\n').slice(1); // skip header

          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 4) continue;
            // Format: volid format size vmid
            const [volid, format, sizeStr, vmidStr] = parts;

            // Parse filename from volid (e.g., local:backup/vzdump-lxc-100-2024_01_15-03_00_00.tar.zst)
            const filename = volid.includes('/') ? volid.split('/').pop() || volid : volid;

            // Extract timestamp from filename (vzdump-{type}-{vmid}-{YYYY_MM_DD-HH_MM_SS})
            let timestamp = '';
            const tsMatch = filename.match(/(\d{4}_\d{2}_\d{2}-\d{2}_\d{2}_\d{2})/);
            if (tsMatch) {
              const ts = tsMatch[1];
              timestamp = ts.replace(
                /(\d{4})_(\d{2})_(\d{2})-(\d{2})_(\d{2})_(\d{2})/,
                '$1-$2-$3T$4:$5:$6',
              );
            }

            // Get notes if available
            let notes = '';
            try {
              const notesOutput = execSync(
                `pvesm extractconfig ${volid} 2>/dev/null | head -5 | grep -i 'description\\|notes' || true`,
                { encoding: 'utf-8', timeout: 5_000 },
              );
              notes = notesOutput.trim();
            } catch { /* ignore */ }

            const vmid = parseInt(vmidStr, 10) || 0;
            if (vmidFilter && vmid !== vmidFilter) continue;

            backups.push({
              volid,
              storage: sid,
              vmid,
              size: parseInt(sizeStr, 10) || 0,
              format,
              timestamp,
              notes,
              filename,
            });
          }
        } catch {
          // Storage might not support backup content, skip
        }
      }

      // Sort by timestamp descending (newest first)
      backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      return { success: true, data: { backups, total: backups.length } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Create a new Proxmox backup using vzdump.
   */
  private async backupsCreate(params: Record<string, unknown>): Promise<CommandResult> {
    const vmid = params.vmid as number;
    const storage = (params.storage as string) || 'local';
    const mode = (params.mode as string) || 'snapshot';
    const compress = (params.compress as string) || 'zstd';
    const notes = params.notes as string | undefined;

    if (!vmid) return { success: false, error: 'vmid required' };
    if (!['snapshot', 'suspend', 'stop'].includes(mode)) {
      return { success: false, error: 'mode must be snapshot, suspend, or stop' };
    }
    if (!['zstd', 'lzo', 'gzip', 'none'].includes(compress)) {
      return { success: false, error: 'compress must be zstd, lzo, gzip, or none' };
    }

    // Validate storage name
    if (!/^[a-zA-Z0-9_-]+$/.test(storage)) {
      return { success: false, error: 'Invalid storage name' };
    }

    try {
      let cmd = `vzdump ${vmid} --storage ${storage} --mode ${mode} --compress ${compress}`;
      if (notes) {
        // Sanitize notes
        const safeNotes = notes.replace(/['"\\]/g, '').substring(0, 200);
        cmd += ` --notes-template '${safeNotes}'`;
      }

      this.log.info({ vmid, storage, mode, compress }, 'Creating backup');

      const output = execSync(`${cmd} 2>&1`, {
        encoding: 'utf-8',
        timeout: 600_000, // 10 minutes
      });

      // Parse the output to get the created backup file
      let createdFile = '';
      const fileMatch = output.match(/creating (?:vzdump )?archive '([^']+)'/i)
        || output.match(/backup file: (.+\.(?:tar|vma)[^\s]*)/i);
      if (fileMatch) {
        createdFile = fileMatch[1];
      }

      return {
        success: true,
        data: {
          vmid,
          storage,
          mode,
          compress,
          file: createdFile,
          output: output.trim().split('\n').slice(-10).join('\n'), // last 10 lines
        },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Restore a Proxmox backup.
   */
  private async backupsRestore(params: Record<string, unknown>): Promise<CommandResult> {
    const volid = params.volid as string;
    const targetVmid = params.targetVmid as number | undefined;
    const storage = (params.targetStorage as string) || 'local-lvm';

    if (!volid) return { success: false, error: 'volid required (e.g., local:backup/vzdump-lxc-100-...)' };

    // Determine type from volid (lxc or qemu)
    const isLxc = volid.includes('vzdump-lxc');
    const isQemu = volid.includes('vzdump-qemu');

    if (!isLxc && !isQemu) {
      return { success: false, error: 'Cannot determine backup type from volid' };
    }

    try {
      // Get next available VMID if not specified
      let vmid = targetVmid;
      if (!vmid) {
        const vmidOut = execSync('pvesh get /cluster/nextid 2>/dev/null', {
          encoding: 'utf-8',
          timeout: 5_000,
        });
        vmid = parseInt(vmidOut.trim(), 10);
      }

      let cmd: string;
      if (isLxc) {
        cmd = `pct restore ${vmid} ${volid} --storage ${storage}`;
      } else {
        cmd = `qmrestore ${volid} ${vmid} --storage ${storage}`;
      }

      this.log.info({ volid, vmid, storage, type: isLxc ? 'lxc' : 'qemu' }, 'Restoring backup');

      const output = execSync(`${cmd} 2>&1`, {
        encoding: 'utf-8',
        timeout: 600_000, // 10 minutes
      });

      return {
        success: true,
        data: {
          volid,
          vmid,
          storage,
          type: isLxc ? 'lxc' : 'qemu',
          output: output.trim().split('\n').slice(-10).join('\n'),
        },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Delete a Proxmox backup.
   */
  private backupsDelete(params: Record<string, unknown>): CommandResult {
    const volid = params.volid as string;
    if (!volid) return { success: false, error: 'volid required' };

    // Validate volid format (storage:backup/filename)
    if (!volid.includes(':') || !volid.includes('backup')) {
      return { success: false, error: 'Invalid backup volid format' };
    }

    try {
      this.log.warn({ volid }, 'Deleting backup');
      const output = execSync(`pvesm free ${volid} 2>&1`, {
        encoding: 'utf-8',
        timeout: 60_000,
      });

      return {
        success: true,
        data: { volid, deleted: true, output: output.trim() },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * List storages that can hold backups.
   */
  private backupsStorages(): CommandResult {
    try {
      const storages: Array<{ id: string; type: string; path: string; availableGB: number }> = [];

      try {
        const output = execSync(
          'pvesm status 2>/dev/null',
          { encoding: 'utf-8', timeout: 10_000 },
        );
        const lines = output.trim().split('\n').slice(1);
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length < 7) continue;
          const [name, type, status, total, used, available] = parts;
          if (status !== 'active') continue;

          // Check if storage accepts backup content
          try {
            const cfgOut = execSync(
              `pvesm show ${name} 2>/dev/null | grep content`,
              { encoding: 'utf-8', timeout: 5_000 },
            );
            if (!cfgOut.includes('backup')) continue;
          } catch {
            // If we can't check, include it anyway for 'local' and 'dir' types
            if (!['dir', 'nfs', 'cifs', 'pbs'].includes(type) && name !== 'local') continue;
          }

          const availBytes = parseInt(available, 10) || 0;
          storages.push({
            id: name,
            type,
            path: '',
            availableGB: Math.round(availBytes / 1073741824 * 10) / 10,
          });
        }
      } catch {
        storages.push({ id: 'local', type: 'dir', path: '/var/lib/vz', availableGB: 0 });
      }

      return { success: true, data: { storages } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
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

  private async installApp(params: Record<string, unknown>): Promise<CommandResult> {
    const appId = params.appId as string;
    const method = (params.method as string) || 'docker';
    if (!appId) return { success: false, error: 'appId required' };
    // Delegate to the new appsInstall
    return await this.appsInstall(params);
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
