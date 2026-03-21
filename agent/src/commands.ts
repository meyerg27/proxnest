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
import type { MetricsStore } from './metrics-store.js';

interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export class CommandExecutor {
  private log: Logger;
  private collector: MetricsCollector;
  private metricsStore: MetricsStore | null;

  constructor(logger: Logger, collector: MetricsCollector, metricsStore?: MetricsStore) {
    this.log = logger;
    this.collector = collector;
    this.metricsStore = metricsStore ?? null;
  }

  async execute(action: string, params: Record<string, unknown>): Promise<CommandResult> {
    this.log.info({ action }, 'Executing command');

    switch (action) {
      // ─── System ─────────────────────────────
      case 'system.info':
        return { success: true, data: this.collector.getSystemInfo() };

      case 'system.metrics':
        return { success: true, data: this.collector.collectFull() };

      case 'metrics.history':
        return this.metricsHistory(params);

      case 'system.reboot':
        return this.reboot();

      case 'system.shutdown':
        return this.shutdown();

      case 'system.update':
        return this.systemUpdateCheck();

      case 'system.update.apply':
        return await this.systemUpdateApply(params);

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

      // ─── Settings ─────────────────────────────
      case 'settings.get':
        return this.settingsGet();

      case 'settings.hostname':
        return this.settingsHostname(params);

      case 'settings.timezone':
        return this.settingsTimezone(params);

      case 'settings.dns':
        return this.settingsDns(params);

      // ─── Firewall ──────────────────────────────
      case 'firewall.list':
        return this.firewallList();

      case 'firewall.addRule':
        return this.firewallAddRule(params);

      case 'firewall.deleteRule':
        return this.firewallDeleteRule(params);

      // ─── Snapshots ─────────────────────────────
      case 'snapshots.list':
        return this.snapshotsList(params);

      case 'snapshots.create':
        return this.snapshotsCreate(params);

      case 'snapshots.delete':
        return this.snapshotsDelete(params);

      case 'snapshots.rollback':
        return this.snapshotsRollback(params);

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

  // ─── Metrics History ─────────────────────────

  private metricsHistory(params: Record<string, unknown>): CommandResult {
    if (!this.metricsStore) {
      return { success: false, error: 'Metrics store not available' };
    }
    const range = (params.range as string) || '24h';
    const maxPoints = Math.min(Math.max((params.maxPoints as number) || 300, 10), 1000);

    // Validate range format
    if (!/^\d+[hmd]$/.test(range)) {
      return { success: false, error: 'Invalid range format. Use e.g. 1h, 6h, 24h, 7d' };
    }

    try {
      const result = this.metricsStore.query(range, maxPoints);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
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

  /**
   * Check for available system updates.
   * Runs `apt update` then parses upgradable packages with version info.
   */
  private systemUpdateCheck(): CommandResult {
    try {
      // Run apt update first to refresh package lists
      execSync('apt-get update 2>&1', { encoding: 'utf-8', timeout: 120_000 });

      // Get upgradable packages with version details
      const output = execSync('apt list --upgradable 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 30_000,
      });

      const packages: Array<{
        name: string;
        currentVersion: string;
        newVersion: string;
        arch: string;
        repo: string;
      }> = [];

      const lines = output.split('\n').filter(l => l.includes('upgradable'));
      for (const line of lines) {
        // Format: package/repo version arch [upgradable from: old-version]
        const match = line.match(/^([^/]+)\/(\S+)\s+(\S+)\s+(\S+)\s+\[upgradable from:\s+([^\]]+)\]/);
        if (match) {
          packages.push({
            name: match[1],
            repo: match[2],
            newVersion: match[3],
            arch: match[4],
            currentVersion: match[5],
          });
        } else {
          // Simpler fallback
          const name = line.split('/')[0];
          if (name) packages.push({ name, repo: '', newVersion: '', arch: '', currentVersion: '' });
        }
      }

      // Get security updates count
      let securityCount = 0;
      try {
        const secOutput = execSync(
          'apt list --upgradable 2>/dev/null | grep -i security | wc -l',
          { encoding: 'utf-8', timeout: 10_000 },
        );
        securityCount = parseInt(secOutput.trim(), 10) || 0;
      } catch { /* ignore */ }

      // Get last update timestamp
      let lastUpdate = '';
      try {
        const stampOutput = execSync(
          'stat -c %Y /var/lib/apt/lists/partial 2>/dev/null || stat -c %Y /var/cache/apt/pkgcache.bin 2>/dev/null || echo 0',
          { encoding: 'utf-8', timeout: 5_000 },
        );
        const ts = parseInt(stampOutput.trim(), 10);
        if (ts > 0) lastUpdate = new Date(ts * 1000).toISOString();
      } catch { /* ignore */ }

      // Check if reboot is required
      let rebootRequired = false;
      try {
        rebootRequired = existsSync('/var/run/reboot-required');
      } catch { /* ignore */ }

      return {
        success: true,
        data: {
          packages,
          count: packages.length,
          securityCount,
          lastUpdate,
          rebootRequired,
        },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Apply system updates via apt-get upgrade.
   * Runs the upgrade and returns the full output.
   * Supports 'dist-upgrade' mode via params.mode.
   */
  private async systemUpdateApply(params: Record<string, unknown>): Promise<CommandResult> {
    const mode = (params.mode as string) || 'upgrade';
    const packagesOnly = params.packages as string[] | undefined;

    // Validate mode
    if (!['upgrade', 'dist-upgrade', 'full-upgrade'].includes(mode)) {
      return { success: false, error: 'mode must be upgrade, dist-upgrade, or full-upgrade' };
    }

    try {
      this.log.info({ mode, packagesOnly }, 'Applying system updates');

      let cmd: string;
      if (packagesOnly && packagesOnly.length > 0) {
        // Install specific packages only — validate names
        const safeNames = packagesOnly.filter(p => /^[a-zA-Z0-9._:+-]+$/.test(p));
        if (safeNames.length === 0) {
          return { success: false, error: 'No valid package names provided' };
        }
        cmd = `DEBIAN_FRONTEND=noninteractive apt-get install -y ${safeNames.join(' ')} 2>&1`;
      } else {
        cmd = `DEBIAN_FRONTEND=noninteractive apt-get ${mode} -y 2>&1`;
      }

      const output = execSync(cmd, {
        encoding: 'utf-8',
        timeout: 600_000, // 10 minutes
      });

      // Parse results from output
      let upgraded = 0;
      let newlyInstalled = 0;
      let removed = 0;
      const summaryMatch = output.match(/(\d+)\s+upgraded,\s*(\d+)\s+newly installed,\s*(\d+)\s+to remove/);
      if (summaryMatch) {
        upgraded = parseInt(summaryMatch[1], 10);
        newlyInstalled = parseInt(summaryMatch[2], 10);
        removed = parseInt(summaryMatch[3], 10);
      }

      // Check if reboot is now required
      let rebootRequired = false;
      try {
        rebootRequired = existsSync('/var/run/reboot-required');
      } catch { /* ignore */ }

      // Get last 30 lines of output for the log
      const outputLines = output.split('\n');
      const tail = outputLines.slice(-30);

      return {
        success: true,
        data: {
          mode,
          upgraded,
          newlyInstalled,
          removed,
          rebootRequired,
          log: tail,
          fullLogLength: outputLines.length,
        },
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // Even on error, try to extract partial output
      let partialLog: string[] = [];
      if (err && typeof err === 'object' && 'stdout' in err) {
        const stdout = (err as any).stdout as string;
        if (stdout) partialLog = stdout.split('\n').slice(-30);
      }

      return {
        success: false,
        error: errMsg,
        data: { log: partialLog },
      };
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

  // ─── Settings Commands ─────────────────────────

  /**
   * Get current server settings: hostname, timezone, DNS, network config.
   */
  private settingsGet(): CommandResult {
    try {
      // Hostname
      let hostname = '';
      try {
        hostname = execSync('hostname', { encoding: 'utf-8', timeout: 5_000 }).trim();
      } catch { hostname = 'unknown'; }

      // FQDN
      let fqdn = '';
      try {
        fqdn = execSync('hostname -f 2>/dev/null || echo ""', { encoding: 'utf-8', timeout: 5_000 }).trim();
      } catch { /* ignore */ }

      // Timezone
      let timezone = '';
      try {
        timezone = execSync('timedatectl show --property=Timezone --value 2>/dev/null || cat /etc/timezone 2>/dev/null || echo "UTC"', {
          encoding: 'utf-8', timeout: 5_000,
        }).trim();
      } catch { timezone = 'UTC'; }

      // NTP status
      let ntpEnabled = false;
      let ntpSynced = false;
      try {
        const timedateOut = execSync('timedatectl status 2>/dev/null', { encoding: 'utf-8', timeout: 5_000 });
        ntpEnabled = /NTP service:\s*active/i.test(timedateOut) || /NTP enabled:\s*yes/i.test(timedateOut) || /systemd-timesyncd.*active/i.test(timedateOut);
        ntpSynced = /System clock synchronized:\s*yes/i.test(timedateOut) || /NTP synchronized:\s*yes/i.test(timedateOut);
      } catch { /* ignore */ }

      // Current time
      let localTime = '';
      try {
        localTime = execSync('date "+%Y-%m-%d %H:%M:%S %Z"', { encoding: 'utf-8', timeout: 3_000 }).trim();
      } catch { /* ignore */ }

      // DNS servers from /etc/resolv.conf
      let dnsServers: string[] = [];
      let dnsSearch: string[] = [];
      try {
        const resolv = readFileSync('/etc/resolv.conf', 'utf-8');
        dnsServers = resolv.split('\n')
          .filter(l => l.trim().startsWith('nameserver'))
          .map(l => l.trim().split(/\s+/)[1])
          .filter(Boolean);
        dnsSearch = resolv.split('\n')
          .filter(l => l.trim().startsWith('search'))
          .flatMap(l => l.trim().split(/\s+/).slice(1))
          .filter(Boolean);
      } catch { /* ignore */ }

      // Available timezones (abbreviated list of common ones)
      let timezones: string[] = [];
      try {
        const tzOut = execSync('timedatectl list-timezones 2>/dev/null', { encoding: 'utf-8', timeout: 10_000 });
        timezones = tzOut.trim().split('\n').filter(Boolean);
      } catch { /* ignore */ }

      // Network interfaces config from /etc/network/interfaces (Debian/PVE style)
      let networkConfig = '';
      try {
        networkConfig = readFileSync('/etc/network/interfaces', 'utf-8');
      } catch { /* ignore */ }

      // /etc/hosts
      let hostsFile = '';
      try {
        hostsFile = readFileSync('/etc/hosts', 'utf-8');
      } catch { /* ignore */ }

      return {
        success: true,
        data: {
          hostname,
          fqdn,
          timezone,
          localTime,
          ntpEnabled,
          ntpSynced,
          dnsServers,
          dnsSearch,
          timezones,
          networkConfig,
          hostsFile,
        },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Change the system hostname.
   */
  private settingsHostname(params: Record<string, unknown>): CommandResult {
    const hostname = params.hostname as string;
    if (!hostname) return { success: false, error: 'hostname required' };

    // Validate hostname (RFC 1123)
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(hostname)) {
      return { success: false, error: 'Invalid hostname. Use alphanumeric characters and hyphens (max 63 chars).' };
    }

    try {
      this.log.info({ hostname }, 'Changing hostname');

      // Set hostname via hostnamectl
      execSync(`hostnamectl set-hostname ${hostname} 2>&1`, { encoding: 'utf-8', timeout: 10_000 });

      // Update /etc/hosts — replace old hostname references
      try {
        const oldHostname = execSync('hostname', { encoding: 'utf-8', timeout: 3_000 }).trim();
        if (existsSync('/etc/hosts')) {
          let hosts = readFileSync('/etc/hosts', 'utf-8');
          // Update the 127.0.1.1 line or add one
          const lines = hosts.split('\n');
          let found = false;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].match(/^\s*127\.0\.1\.1\s/)) {
              lines[i] = `127.0.1.1\t${hostname}`;
              found = true;
              break;
            }
          }
          if (!found) {
            // Add after the 127.0.0.1 line
            const idx = lines.findIndex(l => l.match(/^\s*127\.0\.0\.1\s/));
            if (idx >= 0) {
              lines.splice(idx + 1, 0, `127.0.1.1\t${hostname}`);
            }
          }
          writeFileSync('/etc/hosts', lines.join('\n'));
        }
      } catch { /* ignore hosts update errors */ }

      return {
        success: true,
        data: { hostname, message: `Hostname changed to ${hostname}` },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Change the system timezone.
   */
  private settingsTimezone(params: Record<string, unknown>): CommandResult {
    const timezone = params.timezone as string;
    if (!timezone) return { success: false, error: 'timezone required (e.g., America/New_York)' };

    // Validate timezone format
    if (!/^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/.test(timezone) && timezone !== 'UTC') {
      return { success: false, error: 'Invalid timezone format. Use format like America/New_York or UTC.' };
    }

    try {
      this.log.info({ timezone }, 'Changing timezone');
      execSync(`timedatectl set-timezone ${timezone} 2>&1`, { encoding: 'utf-8', timeout: 10_000 });

      // Verify
      const newTz = execSync('timedatectl show --property=Timezone --value 2>/dev/null || cat /etc/timezone 2>/dev/null', {
        encoding: 'utf-8', timeout: 5_000,
      }).trim();

      return {
        success: true,
        data: { timezone: newTz, message: `Timezone changed to ${newTz}` },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Update DNS servers in /etc/resolv.conf.
   */
  private settingsDns(params: Record<string, unknown>): CommandResult {
    const servers = params.servers as string[];
    const search = params.search as string[] | undefined;

    if (!servers || !Array.isArray(servers) || servers.length === 0) {
      return { success: false, error: 'servers array required (e.g., ["1.1.1.1", "8.8.8.8"])' };
    }

    // Validate IP addresses
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    for (const s of servers) {
      if (!ipRegex.test(s)) {
        return { success: false, error: `Invalid DNS server IP: ${s}` };
      }
    }

    try {
      this.log.info({ servers, search }, 'Updating DNS configuration');

      // Build new resolv.conf
      let content = '# Generated by ProxNest\n';
      if (search && search.length > 0) {
        content += `search ${search.join(' ')}\n`;
      }
      for (const s of servers) {
        content += `nameserver ${s}\n`;
      }

      writeFileSync('/etc/resolv.conf', content);

      return {
        success: true,
        data: {
          servers,
          search: search || [],
          message: `DNS updated: ${servers.join(', ')}`,
        },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ─── Firewall Commands ────────────────────────

  /**
   * List iptables rules for INPUT chain + Proxmox firewall status.
   * Returns parsed rules with chain, protocol, port, source, target, and action.
   */
  private firewallList(): CommandResult {
    try {
      const rules: Array<{
        num: number;
        chain: string;
        target: string;
        protocol: string;
        source: string;
        destination: string;
        port: string;
        extra: string;
      }> = [];

      // Parse iptables rules with line numbers
      try {
        const output = execSync(
          'iptables -L INPUT -n -v --line-numbers 2>/dev/null',
          { encoding: 'utf-8', timeout: 10_000 },
        );
        const lines = output.trim().split('\n').slice(2); // skip header lines
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length < 9) continue;
          const num = parseInt(parts[0], 10);
          if (isNaN(num)) continue;
          // Format: num pkts bytes target prot opt in out source destination [extra...]
          const target = parts[3];
          const protocol = parts[4];
          const source = parts[8];
          const destination = parts[9];
          const extra = parts.slice(10).join(' ');

          // Extract port from extra (e.g., "tcp dpt:22" or "multiport dports 80,443")
          let port = '';
          const dptMatch = extra.match(/dpt:(\d+)/);
          const dptsMatch = extra.match(/dports\s+([\d,]+)/);
          if (dptMatch) port = dptMatch[1];
          else if (dptsMatch) port = dptsMatch[1];

          rules.push({ num, chain: 'INPUT', target, protocol, source, destination, port, extra });
        }
      } catch { /* iptables may not be available */ }

      // Also check Proxmox firewall if available
      let pveFirewallEnabled = false;
      let pveRules: Array<{
        pos: number;
        type: string;
        action: string;
        macro?: string;
        iface?: string;
        source?: string;
        dest?: string;
        proto?: string;
        dport?: string;
        enable: boolean;
        comment?: string;
      }> = [];

      try {
        const pveOutput = execSync(
          'cat /etc/pve/firewall/cluster.fw 2>/dev/null || echo ""',
          { encoding: 'utf-8', timeout: 5_000 },
        );
        if (pveOutput.includes('enable:') && pveOutput.includes('1')) {
          pveFirewallEnabled = true;
        }
      } catch { /* ignore */ }

      // Check host-level PVE firewall
      try {
        const node = process.env.PROXMOX_NODE || 'pve';
        const hostFw = execSync(
          `cat /etc/pve/nodes/${node}/host.fw 2>/dev/null || echo ""`,
          { encoding: 'utf-8', timeout: 5_000 },
        );
        if (hostFw.trim()) {
          const ruleLines = hostFw.split('\n');
          let pos = 0;
          let inRules = false;
          for (const rl of ruleLines) {
            const trimmed = rl.trim();
            if (trimmed === '[RULES]') { inRules = true; continue; }
            if (trimmed.startsWith('[')) { inRules = false; continue; }
            if (!inRules || !trimmed || trimmed.startsWith('#')) continue;

            pos++;
            // Format: |IN/OUT ACCEPT/DROP [-p proto] [-dport port] [-source addr] [-i iface] # comment
            const actionMatch = trimmed.match(/^(IN|OUT|GROUP)\s+(ACCEPT|DROP|REJECT)/i);
            if (actionMatch) {
              const type = actionMatch[1];
              const action = actionMatch[2];
              const protoMatch = trimmed.match(/-p\s+(\S+)/);
              const dportMatch = trimmed.match(/-dport\s+(\S+)/);
              const sourceMatch = trimmed.match(/-source\s+(\S+)/);
              const ifaceMatch = trimmed.match(/-i\s+(\S+)/);
              const commentMatch = trimmed.match(/#\s*(.+)$/);
              const enableMatch = trimmed.match(/-enable\s+(\d)/);

              pveRules.push({
                pos,
                type,
                action,
                proto: protoMatch?.[1],
                dport: dportMatch?.[1],
                source: sourceMatch?.[1],
                iface: ifaceMatch?.[1],
                enable: enableMatch ? enableMatch[1] === '1' : true,
                comment: commentMatch?.[1]?.trim(),
              });
            }
          }
        }
      } catch { /* ignore */ }

      // Get listening ports for context
      let listeningPorts: Array<{ port: number; protocol: string; process: string }> = [];
      try {
        const ssOutput = execSync(
          "ss -tlnp 2>/dev/null | awk 'NR>1 {print $1,$4,$7}'",
          { encoding: 'utf-8', timeout: 5_000 },
        );
        const ssLines = ssOutput.trim().split('\n').filter(Boolean);
        for (const sl of ssLines) {
          const [proto, addr, proc] = sl.split(/\s+/);
          const portMatch = addr?.match(/:(\d+)$/);
          if (portMatch) {
            const port = parseInt(portMatch[1], 10);
            // Extract process name from "users:(("sshd",pid=123,fd=4))"
            const procMatch = proc?.match(/\("([^"]+)"/);
            listeningPorts.push({
              port,
              protocol: proto || 'tcp',
              process: procMatch?.[1] || '',
            });
          }
        }
        // Deduplicate by port
        const seen = new Set<number>();
        listeningPorts = listeningPorts.filter(p => {
          if (seen.has(p.port)) return false;
          seen.add(p.port);
          return true;
        });
        listeningPorts.sort((a, b) => a.port - b.port);
      } catch { /* ignore */ }

      return {
        success: true,
        data: {
          iptablesRules: rules,
          pveFirewall: { enabled: pveFirewallEnabled, rules: pveRules },
          listeningPorts,
        },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Add an iptables rule.
   */
  private firewallAddRule(params: Record<string, unknown>): CommandResult {
    const action = (params.action as string) || 'ACCEPT';
    const protocol = (params.protocol as string) || 'tcp';
    const port = params.port as number | string;
    const source = params.source as string | undefined;
    const position = params.position as number | undefined;

    if (!port) return { success: false, error: 'port required' };

    // Validate
    if (!['ACCEPT', 'DROP', 'REJECT'].includes(action.toUpperCase())) {
      return { success: false, error: 'action must be ACCEPT, DROP, or REJECT' };
    }
    if (!['tcp', 'udp', 'all'].includes(protocol.toLowerCase())) {
      return { success: false, error: 'protocol must be tcp, udp, or all' };
    }
    // Validate port (number or range like 8000:8100)
    const portStr = String(port);
    if (!/^\d+(?::\d+)?$/.test(portStr)) {
      return { success: false, error: 'Invalid port format (use number or range like 8000:8100)' };
    }
    if (source && !/^[0-9./]+$/.test(source)) {
      return { success: false, error: 'Invalid source address' };
    }

    try {
      let cmd = 'iptables';
      if (position) {
        cmd += ` -I INPUT ${position}`;
      } else {
        // Insert before the last rule (usually a DROP/REJECT catch-all)
        cmd += ' -I INPUT';
      }

      if (protocol.toLowerCase() !== 'all') {
        cmd += ` -p ${protocol.toLowerCase()}`;
      }
      if (source) {
        cmd += ` -s ${source}`;
      }
      cmd += ` --dport ${portStr} -j ${action.toUpperCase()}`;

      this.log.info({ cmd }, 'Adding firewall rule');
      execSync(`${cmd} 2>&1`, { encoding: 'utf-8', timeout: 10_000 });

      // Persist rules
      this.persistIptables();

      return {
        success: true,
        data: { message: `Rule added: ${action} ${protocol}/${portStr}${source ? ` from ${source}` : ''}` },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Delete an iptables rule by line number.
   */
  private firewallDeleteRule(params: Record<string, unknown>): CommandResult {
    const ruleNum = params.ruleNum as number;
    if (!ruleNum || ruleNum < 1) return { success: false, error: 'Valid ruleNum required (positive integer)' };

    try {
      this.log.warn({ ruleNum }, 'Deleting firewall rule');
      execSync(`iptables -D INPUT ${ruleNum} 2>&1`, { encoding: 'utf-8', timeout: 10_000 });

      // Persist rules
      this.persistIptables();

      return { success: true, data: { message: `Rule #${ruleNum} deleted from INPUT chain` } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Persist iptables rules using iptables-save.
   */
  private persistIptables(): void {
    try {
      // Try iptables-persistent first (Debian/Ubuntu)
      if (existsSync('/etc/iptables/rules.v4')) {
        execSync('iptables-save > /etc/iptables/rules.v4 2>/dev/null', { encoding: 'utf-8', timeout: 5_000 });
      } else {
        // Fallback: save to a known location
        try { mkdirSync('/etc/iptables', { recursive: true }); } catch { /* ok */ }
        execSync('iptables-save > /etc/iptables/rules.v4 2>/dev/null', { encoding: 'utf-8', timeout: 5_000 });
      }
    } catch {
      this.log.warn('Could not persist iptables rules');
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

  // ─── Snapshot Management (VM/CT Snapshots) ──

  private snapshotsList(params: Record<string, unknown>): CommandResult {
    const vmid = params.vmid as number | undefined;
    const node = process.env.PROXMOX_NODE || 'pve';

    try {
      interface SnapshotInfo {
        vmid: number;
        type: 'qemu' | 'lxc';
        name: string;
        guestName: string;
        description: string;
        snaptime: number;
        parent: string;
        running: boolean;
      }

      const allSnapshots: SnapshotInfo[] = [];
      const guests = this.collector.getGuests();
      const targetGuests = vmid
        ? guests.filter(g => g.vmid === vmid)
        : guests;

      for (const guest of targetGuests) {
        const cmd = guest.type === 'qemu' ? 'qm' : 'pct';
        try {
          const output = execSync(`${cmd} listsnapshot ${guest.vmid} 2>/dev/null`, {
            encoding: 'utf-8',
            timeout: 10_000,
          });

          // Parse snapshot list output
          // Format: "  `-> snapname       timestamp   description"
          // or:     "  `-> current        (current)"
          for (const line of output.trim().split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === '') continue;

            // Remove tree chars like `->
            const cleaned = trimmed.replace(/^[`|\\+->\s]+/, '').trim();
            if (!cleaned) continue;

            // Skip 'current' entry (not a real snapshot)
            const parts = cleaned.split(/\s+/);
            const snapName = parts[0];
            if (snapName === 'current') continue;

            // Try to get snapshot config for more details
            let description = '';
            let snaptime = 0;
            let parent = '';

            try {
              const configOut = execSync(
                `${cmd} config ${guest.vmid} --snapshot ${snapName} 2>/dev/null`,
                { encoding: 'utf-8', timeout: 5_000 },
              );
              for (const cfgLine of configOut.split('\n')) {
                if (cfgLine.startsWith('description:')) {
                  description = cfgLine.substring('description:'.length).trim()
                    .replace(/%0A/g, '\n').replace(/%25/g, '%');
                } else if (cfgLine.startsWith('snaptime:')) {
                  snaptime = parseInt(cfgLine.substring('snaptime:'.length).trim(), 10) || 0;
                } else if (cfgLine.startsWith('parent:')) {
                  parent = cfgLine.substring('parent:'.length).trim();
                }
              }
            } catch { /* ignore config read failure */ }

            allSnapshots.push({
              vmid: guest.vmid,
              type: guest.type as 'qemu' | 'lxc',
              name: snapName,
              guestName: guest.name,
              description,
              snaptime,
              parent,
              running: false,
            });
          }
        } catch {
          // Guest might not support snapshots or be inaccessible
        }
      }

      // Sort newest first
      allSnapshots.sort((a, b) => b.snaptime - a.snaptime);

      return {
        success: true,
        data: { snapshots: allSnapshots },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private snapshotsCreate(params: Record<string, unknown>): CommandResult {
    const vmid = params.vmid as number;
    const type = (params.type as string) || 'lxc';
    const snapname = (params.snapname as string) || `proxnest-${Date.now()}`;
    const description = (params.description as string) || `Created via ProxNest on ${new Date().toISOString()}`;
    const includeRAM = params.includeRAM as boolean || false;

    if (!vmid) return { success: false, error: 'vmid required' };
    if (!/^[a-zA-Z0-9_-]+$/.test(snapname)) {
      return { success: false, error: 'Snapshot name must only contain letters, numbers, hyphens, and underscores' };
    }

    const cmd = type === 'qemu' ? 'qm' : 'pct';
    const ramFlag = type === 'qemu' && includeRAM ? ' --vmstate 1' : '';
    const descSafe = description.replace(/'/g, "\\'");

    try {
      execSync(
        `${cmd} snapshot ${vmid} ${snapname} --description '${descSafe}'${ramFlag} 2>&1`,
        { encoding: 'utf-8', timeout: 300_000 }, // 5 min timeout for snapshots
      );
      return {
        success: true,
        data: { vmid, snapname, description, message: `Snapshot '${snapname}' created for ${type.toUpperCase()} ${vmid}` },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private snapshotsDelete(params: Record<string, unknown>): CommandResult {
    const vmid = params.vmid as number;
    const type = (params.type as string) || 'lxc';
    const snapname = params.snapname as string;

    if (!vmid) return { success: false, error: 'vmid required' };
    if (!snapname) return { success: false, error: 'snapname required' };

    const cmd = type === 'qemu' ? 'qm' : 'pct';

    try {
      execSync(`${cmd} delsnapshot ${vmid} ${snapname} 2>&1`, {
        encoding: 'utf-8',
        timeout: 300_000, // Can take time to merge disk data
      });
      return {
        success: true,
        data: { vmid, snapname, message: `Snapshot '${snapname}' deleted from ${type.toUpperCase()} ${vmid}` },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private snapshotsRollback(params: Record<string, unknown>): CommandResult {
    const vmid = params.vmid as number;
    const type = (params.type as string) || 'lxc';
    const snapname = params.snapname as string;

    if (!vmid) return { success: false, error: 'vmid required' };
    if (!snapname) return { success: false, error: 'snapname required' };

    const cmd = type === 'qemu' ? 'qm' : 'pct';

    try {
      // First stop the guest if it's running
      try {
        const statusOut = execSync(`${cmd} status ${vmid} 2>&1`, { encoding: 'utf-8', timeout: 5_000 });
        if (statusOut.includes('running')) {
          execSync(`${cmd} stop ${vmid} 2>&1`, { encoding: 'utf-8', timeout: 60_000 });
          // Wait for it to stop
          for (let i = 0; i < 10; i++) {
            const check = execSync(`${cmd} status ${vmid} 2>&1`, { encoding: 'utf-8', timeout: 5_000 });
            if (check.includes('stopped')) break;
            execSync('sleep 2', { encoding: 'utf-8' });
          }
        }
      } catch { /* proceed anyway */ }

      execSync(`${cmd} rollback ${vmid} ${snapname} 2>&1`, {
        encoding: 'utf-8',
        timeout: 300_000,
      });

      return {
        success: true,
        data: { vmid, snapname, message: `Rolled back ${type.toUpperCase()} ${vmid} to snapshot '${snapname}'` },
      };
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
