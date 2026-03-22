/**
 * ProxNest Agent — Command Handler
 * Handles remote commands from the cloud portal.
 * Supports system operations, guest management, app installs, storage, network, and more.
 */

import { execSync, exec } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import type { Logger } from './logger.js';
import { MetricsCollector } from './collector.js';
import { getAppConfig, APP_CATALOG, APP_STACKS, ensureSharedDirs, type AppConfig } from './app-catalog.js';
import type { MetricsStore } from './metrics-store.js';
import { PveApi } from './pve-api.js';

interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export class CommandExecutor {
  private log: Logger;
  private collector: MetricsCollector;
  private metricsStore: MetricsStore | null;
  private pve: PveApi;

  constructor(logger: Logger, collector: MetricsCollector, metricsStore?: MetricsStore) {
    this.log = logger;
    this.collector = collector;
    this.metricsStore = metricsStore ?? null;
    this.pve = new PveApi();
  }

  async execute(action: string, params: Record<string, unknown>): Promise<CommandResult> {
    this.log.info({ action }, 'Executing command');

    switch (action) {
      // ─── System ─────────────────────────────
      case 'system.info':
        return this.systemInfo();

      case 'system.metrics':
        return { success: true, data: await this.collector.collectFull() };

      case 'metrics.history':
        return this.metricsHistory(params);

      case 'system.reboot':
        return this.reboot(params);

      case 'system.shutdown':
        return this.shutdown(params);

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
        return this.guestsList();

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
        return this.storageDisks();

      case 'storage.zfs':
        return this.storageZfs();

      case 'storage.zfs.scrub':
        return this.storageZfsScrub(params);

      case 'storage.zfs.snapshot':
        return this.zfsSnapshot(params);

      case 'storage.smart':
        return this.storageSmart(params);

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

      case 'apps.catalog':
        return this.appsCatalog();

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

      case 'stacks.list':
        return { success: true, data: { stacks: APP_STACKS } };

      case 'stacks.install':
        return await this.stacksInstall(params);

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

  private async systemInfo(): Promise<CommandResult> {
    try {
      const local = this.collector.getSystemInfo();
      if (this.pve.available) {
        const status = await this.pve.getNodeStatus();
        if (status) {
          return {
            success: true,
            data: {
              ...local,
              hostname: status.hostname || local.hostname,
              cpuModel: status.cpuinfo?.model || local.cpuModel,
              cpuCores: status.cpuinfo?.cores || local.cpuCores,
              cpuSockets: status.cpuinfo?.sockets || 1,
              cpuThreads: (status.cpuinfo?.cores || 1) * (status.cpuinfo?.sockets || 1),
              totalMemoryMB: Math.round((status.memory?.total || 0) / 1048576),
              usedMemoryMB: Math.round((status.memory?.used || 0) / 1048576),
              swapTotalMB: Math.round((status.swap?.total || 0) / 1048576),
              swapUsedMB: Math.round((status.swap?.used || 0) / 1048576),
              pveVersion: status.pveversion || local.pveVersion,
              pveKernel: status.kversion || local.pveKernel,
              uptimeSeconds: status.uptime || 0,
              loadAvg: status.loadavg || [],
              cpuUsage: status.cpu ? Math.round(status.cpu * 100 * 10) / 10 : 0,
              bootMode: status['boot-info']?.mode || 'unknown',
            },
          };
        }
      }
      return { success: true, data: local };
    } catch (err) {
      return { success: true, data: this.collector.getSystemInfo() };
    }
  }

  private async reboot(params: Record<string, unknown>): Promise<CommandResult> {
    if (!params.confirm) {
      return { success: false, error: 'DANGEROUS: Reboot requires {confirm: true}. This will restart the entire server and all VMs/CTs.' };
    }
    try {
      if (this.pve.available) {
        await this.pve.rebootNode();
        return { success: true, data: { message: 'Reboot initiated via PVE API' } };
      }
      execSync('reboot', { encoding: 'utf-8' });
      return { success: true, data: { message: 'Reboot initiated' } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }


  private async shutdown(params: Record<string, unknown>): Promise<CommandResult> {
    if (!params.confirm) {
      return { success: false, error: 'DANGEROUS: Shutdown requires {confirm: true}. This will power off the entire server.' };
    }
    try {
      if (this.pve.available) {
        await this.pve.shutdownNode();
        return { success: true, data: { message: 'Shutdown initiated via PVE API' } };
      }
      execSync('shutdown now', { encoding: 'utf-8' });
      return { success: true, data: { message: 'Shutdown initiated' } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }


  private async systemUpdateCheck(): Promise<CommandResult> {
    try {
      if (this.pve.available) {
        const updates = await this.pve.listUpdates();
        const packages = (updates || []).map((u: any) => ({
          name: u.Package || u.Title || 'unknown',
          currentVersion: u.OldVersion || '',
          newVersion: u.Version || '',
          section: u.Section || '',
          priority: u.Priority || '',
          description: u.Description || '',
        }));
        const securityCount = packages.filter((p: any) => 
          p.section?.includes('security') || p.priority === 'important'
        ).length;
        return {
          success: true,
          data: {
            packages,
            total: packages.length,
            security_count: securityCount,
            reboot_required: false,
          },
        };
      }
      // Fallback to local apt
      execSync('apt-get update 2>&1', { encoding: 'utf-8', timeout: 120_000 });
      const output = execSync('apt list --upgradable 2>/dev/null', { encoding: 'utf-8', timeout: 30_000 });
      const lines = output.trim().split('\n').filter(l => l.includes('/'));
      return { success: true, data: { packages: lines, total: lines.length, security_count: 0, reboot_required: false } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }


  private async systemUpdateApply(params: Record<string, unknown>): Promise<CommandResult> {
    try {
      if (this.pve.available) {
        // PVE API doesn't have a direct "upgrade all" — trigger apt update refresh
        await this.pve.post(`/api2/json/nodes/${this.pve.nodeName}/apt/update`, {}, 300000);
        return { success: true, data: { message: 'Update check triggered via PVE API. Use host shell for apt upgrade.' } };
      }
      const cmd = params.distUpgrade ? 'apt-get dist-upgrade -y' : 'apt-get upgrade -y';
      const output = execSync(`DEBIAN_FRONTEND=noninteractive ${cmd} 2>&1`, { encoding: 'utf-8', timeout: 600_000 });
      return { success: true, data: { output: output.slice(-2000) } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }


  private async getSystemLogs(params: Record<string, unknown>): Promise<CommandResult> {
    const limit = (params.limit as number) || 50;
    const since = params.since as string | undefined;
    try {
      if (this.pve.available) {
        const logs = await this.pve.getNodeSyslog(limit, since);
        const lines = (logs || []).map((l: any) => `${l.t || ''} ${l.n || ''}`);
        return { success: true, data: { logs: lines, total: lines.length } };
      }
      const cmd = `journalctl --no-pager -n ${limit} ${since ? '--since="' + since + '"' : ''} 2>/dev/null`;
      const output = execSync(cmd, { encoding: 'utf-8', timeout: 10_000 });
      return { success: true, data: { logs: output.trim().split('\n'), total: 0 } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }


  private async guestsList(): Promise<CommandResult> {
    try {
      // Use PVE API (works from inside CT) — falls back to shell commands
      const guests = await this.collector.getGuestsFromApi();

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

  private async guestsAction(action: string, params: Record<string, unknown>): Promise<CommandResult> {
    const vmid = params.vmid as number;
    const type = (params.type as string) || 'lxc';
    if (!vmid) return { success: false, error: 'vmid required' };

    const node = process.env.PROXMOX_NODE || 'pve';
    const host = process.env.PROXMOX_HOST;
    const tokenId = process.env.PROXMOX_TOKEN_ID;
    const tokenSecret = process.env.PROXMOX_TOKEN_SECRET;

    // Use PVE API if available
    if (host && tokenId && tokenSecret) {
      try {
        const endpoint = type === 'qemu' ? 'qemu' : 'lxc';
        const authHeader = `PVEAPIToken=${tokenId}=${tokenSecret}`;

        // Check current status first for restart
        if (action === 'restart') {
          const statusRes = await fetch(
            `${host}/api2/json/nodes/${node}/${endpoint}/${vmid}/status/current`,
            { headers: { Authorization: authHeader }, signal: AbortSignal.timeout(5000) }
          );
          const statusData = statusRes.ok ? (await statusRes.json() as any).data : null;
          if (statusData?.status === 'stopped') {
            const res = await fetch(
              `${host}/api2/json/nodes/${node}/${endpoint}/${vmid}/status/start`,
              { method: 'POST', headers: { Authorization: authHeader }, signal: AbortSignal.timeout(30000) }
            );
            return { success: res.ok, data: { vmid, action: 'start (was stopped)' } };
          }
        }

        const pveAction = action === 'restart' ? 'reboot' : action;
        const res = await fetch(
          `${host}/api2/json/nodes/${node}/${endpoint}/${vmid}/status/${pveAction}`,
          { method: 'POST', headers: { Authorization: authHeader }, signal: AbortSignal.timeout(30000) }
        );
        if (!res.ok) {
          const errData = await res.json().catch(() => ({})) as any;
          return { success: false, error: errData.errors || `PVE API returned ${res.status}` };
        }
        return { success: true, data: { vmid, action } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    // Fallback to shell commands
    const cmd = type === 'qemu' ? 'qm' : 'pct';
    const pveAction = action === 'restart' ? 'reboot' : action;
    try {
      const output = execSync(`${cmd} ${pveAction} ${vmid} 2>&1`, { encoding: 'utf-8', timeout: 60_000 });
      return { success: true, data: { vmid, action, output: output.trim() } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async storageList(): Promise<CommandResult> {
    try {
      if (this.pve.available) {
        const storages = await this.pve.listStorages();
        const data = (storages || []).map((s: any) => ({
          id: s.storage,
          type: s.type,
          content: s.content || '',
          path: s.path || '',
          totalBytes: s.total || 0,
          usedBytes: s.used || 0,
          freeBytes: s.avail || 0,
          usagePercent: s.total ? Math.round((s.used || 0) / s.total * 100) : 0,
          active: s.active === 1,
        }));
        return { success: true, data: { storages: data } };
      }
      return { success: true, data: { storages: [] } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }


  private async networkList(): Promise<CommandResult> {
    try {
      if (this.pve.available) {
        const networks = await this.pve.listNetworks();
        const interfaces = (networks || []).map((n: any) => ({
          name: n.iface,
          type: n.type,
          method: n.method || 'manual',
          address: n.address || '',
          netmask: n.netmask || '',
          gateway: n.gateway || '',
          bridge_ports: n.bridge_ports || '',
          active: n.active === 1,
          autostart: n.autostart === 1,
          cidr: n.cidr || '',
        }));
        return { success: true, data: { interfaces } };
      }
      return { success: true, data: { interfaces: [] } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }


  private getHostIp(): string {
    // Always prefer the real network IP, not PROXMOX_HOST (which may be 127.0.0.1)
    try {
      const out = execSync(
        "ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}'",
        { encoding: 'utf-8', timeout: 5_000 },
      );
      const ip = out.trim();
      if (ip && ip !== '127.0.0.1') return ip;
    } catch { /* ignore */ }
    try {
      const out = execSync(
        "ip -4 addr show scope global | grep -oP '(?<=inet )\\S+' | head -1 | cut -d/ -f1",
        { encoding: 'utf-8', timeout: 5_000 },
      );
      const ip = out.trim();
      if (ip && ip !== '127.0.0.1') return ip;
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

  private appsCatalog(): CommandResult {
    return {
      success: true,
      data: {
        catalog: APP_CATALOG.map(app => ({
          id: app.id,
          name: app.name,
          description: app.description,
          category: app.category,
          icon: app.icon,
          image: app.image,
          ports: app.ports,
          stack: app.stack,
          connectsTo: app.connectsTo,
          defaultLogin: app.defaultLogin,
        })),
        stacks: APP_STACKS,
        total: APP_CATALOG.length,
      },
    };
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
      // 0. Ensure shared media/download directories exist
      ensureSharedDirs();

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
          name: appConfig.name,
          containerId,
          status,
          url,
          ports: resolvedPorts,
          defaultLogin: appConfig.defaultLogin,
          connectsTo: appConfig.connectsTo,
          mediaDirs: {
            movies: '/data/media/movies',
            tv: '/data/media/tv',
            music: '/data/media/music',
            downloads: '/data/downloads',
          },
          message: appConfig.defaultLogin
            ? `${appConfig.name} installed! Login: ${appConfig.defaultLogin.user} / ${appConfig.defaultLogin.pass}`
            : `${appConfig.name} installed!`,
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
  private async backupsList(params: Record<string, unknown>): Promise<CommandResult> {
    const storageFilter = params.storage as string | undefined;
    const vmidFilter = params.vmid as number | undefined;

    try {
      const backups = await this.collector.getBackupsFromApi(storageFilter, vmidFilter);
      return { success: true, data: { backups, total: backups.length } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async backupsCreate(params: Record<string, unknown>): Promise<CommandResult> {
    const vmid = params.vmid as number;
    const storage = (params.storage as string) || 'local';
    const mode = (params.mode as string) || 'snapshot';
    const compress = (params.compress as string) || 'zstd';
    const notes = params.notes as string | undefined;
    if (!vmid) return { success: false, error: 'vmid required' };

    try {
      if (this.pve.available) {
        const taskId = await this.pve.createBackup(vmid, { storage, mode, compress, notes });
        return { success: true, data: { vmid, storage, taskId, message: 'Backup started' } };
      }
      return { success: false, error: 'PVE API not available' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }


  private async backupsRestore(params: Record<string, unknown>): Promise<CommandResult> {
    const volid = params.volid as string;
    const vmid = params.vmid as number | undefined;
    if (!volid) return { success: false, error: 'volid required' };

    try {
      if (this.pve.available) {
        const taskId = await this.pve.restoreBackup(volid, vmid);
        return { success: true, data: { volid, taskId, message: 'Restore started' } };
      }
      return { success: false, error: 'PVE API not available' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }


  private async backupsDelete(params: Record<string, unknown>): Promise<CommandResult> {
    const volid = params.volid as string;
    if (!volid) return { success: false, error: 'volid required' };

    try {
      if (this.pve.available) {
        await this.pve.deleteBackup(volid);
        return { success: true, data: { volid, message: 'Backup deleted' } };
      }
      return { success: false, error: 'PVE API not available' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }


  private async backupsStorages(): Promise<CommandResult> {
    const node = process.env.PROXMOX_NODE || 'pve';
    try {
      const data = await this.collector.pveApiPublic(`/api2/json/nodes/${node}/storage`);
      const storages = (data || [])
        .filter((s: any) => s.content?.includes('backup') && s.active)
        .map((s: any) => ({
          id: s.storage,
          type: s.type,
          path: s.path || '',
          availableGB: Math.round((s.avail || 0) / 1073741824 * 10) / 10,
        }));
      return { success: true, data: { storages } };
    } catch (err) {
      // Fallback
      return { success: true, data: { storages: [{ id: 'local', type: 'dir', path: '/var/lib/vz', availableGB: 0 }] } };
    }
  }

  private async settingsGet(): Promise<CommandResult> {
    try {
      if (this.pve.available) {
        const [status, time, dns] = await Promise.all([
          this.pve.getNodeStatus(),
          this.pve.getNodeTime(),
          this.pve.getNodeDns(),
        ]);

        // PVE time API returns null timezone if /etc/timezone missing
        // Calculate from localtime vs UTC time offset
        let timezone = time?.timezone || null;
        if (!timezone) {
          // PVE returns null if /etc/timezone missing — detect from UTC vs localtime offset
          const utc = time?.time || 0;
          const local = time?.localtime || 0;
          const offsetHours = Math.round((local - utc) / 3600);
          const tzMap: Record<number, string> = {
            '-5': 'America/New_York', '-4': 'America/New_York',
            '-6': 'America/Chicago', '-5.5': 'America/Chicago',
            '-7': 'America/Denver', '-8': 'America/Los_Angeles',
            '0': 'UTC', '1': 'Europe/London',
          };
          timezone = tzMap[String(offsetHours)] || `Etc/GMT${offsetHours <= 0 ? '+' : ''}${-offsetHours}`;
        }

        return {
          success: true,
          data: {
            hostname: this.pve.nodeName || status?.hostname || 'unknown',
            fqdn: this.pve.nodeName || '',
            timezone,
            localTime: time?.localtime ? new Date(time.localtime * 1000).toISOString() : '',
            ntpSync: true,
            dns_servers: [dns?.dns1, dns?.dns2, dns?.dns3].filter(Boolean),
            search_domains: dns?.search ? dns.search.split(' ') : [],
            timezones: [],
            pveVersion: status?.pveversion || '',
            kernel: status?.kversion || '',
          },
        };
      }
      // Fallback to local
      const hostname = execSync('hostname', { encoding: 'utf-8', timeout: 5_000 }).trim();
      const timezone = execSync('cat /etc/timezone 2>/dev/null || echo UTC', { encoding: 'utf-8', timeout: 5_000 }).trim();
      return { success: true, data: { hostname, timezone, dns_servers: [], search_domains: [] } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }


  private async settingsHostname(params: Record<string, unknown>): Promise<CommandResult> {
    const hostname = params.hostname as string;
    if (!hostname) return { success: false, error: 'hostname required' };
    try {
      // PVE API doesn't have a direct hostname set — use local hostnamectl if available
      execSync(`hostnamectl set-hostname ${hostname} 2>/dev/null || hostname ${hostname}`, { encoding: 'utf-8', timeout: 5_000 });
      return { success: true, data: { hostname, message: 'Hostname updated' } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }


  private async settingsTimezone(params: Record<string, unknown>): Promise<CommandResult> {
    const timezone = params.timezone as string;
    if (!timezone) return { success: false, error: 'timezone required' };
    try {
      if (this.pve.available) {
        await this.pve.setNodeTimezone(timezone);
        return { success: true, data: { timezone, message: 'Timezone updated via PVE API' } };
      }
      execSync(`timedatectl set-timezone ${timezone}`, { encoding: 'utf-8', timeout: 5_000 });
      return { success: true, data: { timezone, message: 'Timezone updated' } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }


  private async settingsDns(params: Record<string, unknown>): Promise<CommandResult> {
    const servers = params.servers as string[] | undefined;
    const search = params.search as string | undefined;
    if (!servers?.length) return { success: false, error: 'dns servers required' };
    try {
      if (this.pve.available) {
        await this.pve.setNodeDns(servers[0], servers[1], search);
        return { success: true, data: { servers, search, message: 'DNS updated via PVE API' } };
      }
      const content = servers.map(s => `nameserver ${s}`).join('\n') + (search ? `\nsearch ${search}` : '');
      writeFileSync('/etc/resolv.conf', content + '\n');
      return { success: true, data: { servers, search, message: 'DNS updated' } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }


  private async firewallList(): Promise<CommandResult> {
    try {
      if (this.pve.available) {
        const [rules, options] = await Promise.all([
          this.pve.listFirewallRules(),
          this.pve.getFirewallOptions(),
        ]);
        // Also get listening ports from local ss (works in CT)
        let listeningPorts: any[] = [];
        try {
          const ssOut = execSync('ss -tlnp 2>/dev/null', { encoding: 'utf-8', timeout: 5_000 });
          listeningPorts = ssOut.trim().split('\n').slice(1).map(line => {
            const parts = line.split(/\s+/);
            const local = parts[3] || '';
            const portMatch = local.match(/:([\d]+)$/);
            const proc = parts[5] || '';
            const procMatch = proc.match(/\("([^"]+)"/);
            return { port: portMatch?.[1] || '', address: local, process: procMatch?.[1] || '' };
          }).filter(p => p.port);
        } catch { /* no ss */ }

        return {
          success: true,
          data: {
            rules: (rules || []).map((r: any, i: number) => ({
              pos: r.pos ?? i,
              type: r.type || 'in',
              action: r.action || 'ACCEPT',
              proto: r.proto || '',
              dport: r.dport || '',
              source: r.source || '',
              comment: r.comment || '',
              enabled: r.enable !== 0,
            })),
            firewall_enabled: options?.enable === 1,
            listening_ports: listeningPorts,
          },
        };
      }
      return { success: true, data: { rules: [], firewall_enabled: false, listening_ports: [] } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }


  private async firewallAddRule(params: Record<string, unknown>): Promise<CommandResult> {
    if (!params.proto && !params.dport && !params.source) {
      return { success: false, error: 'At least one of proto, dport, or source required to create a firewall rule' };
    }
    const action = (params.action as string) || 'ACCEPT';
    const proto = params.proto as string | undefined;
    const dport = params.dport as string | undefined;
    const source = params.source as string | undefined;
    const comment = params.comment as string | undefined;

    try {
      if (this.pve.available) {
        await this.pve.addFirewallRule({
          type: 'in',
          action: action.toUpperCase(),
          proto,
          dport,
          source,
          comment,
        });
        return { success: true, data: { message: 'Firewall rule added via PVE API' } };
      }
      return { success: false, error: 'PVE API not available' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }


  private async firewallDeleteRule(params: Record<string, unknown>): Promise<CommandResult> {
    const pos = params.pos as number;
    if (pos === undefined || pos === null) return { success: false, error: 'pos (rule position) required' };

    try {
      if (this.pve.available) {
        await this.pve.deleteFirewallRule(pos);
        return { success: true, data: { pos, message: 'Firewall rule deleted via PVE API' } };
      }
      return { success: false, error: 'PVE API not available' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }


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

  private async snapshotsList(params: Record<string, unknown>): Promise<CommandResult> {
    const vmid = params.vmid as number | undefined;
    try {
      const snapshots = await this.collector.getSnapshotsFromApi(vmid);
      return { success: true, data: { snapshots, total: snapshots.length } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async snapshotsCreate(params: Record<string, unknown>): Promise<CommandResult> {
    const vmid = params.vmid as number;
    const name = params.name as string;
    const description = params.description as string | undefined;
    const vmstate = params.vmstate as boolean | undefined;
    if (!vmid || !name) return { success: false, error: 'vmid and name required' };

    try {
      if (this.pve.available) {
        // Determine type
        const guests = await this.pve.listGuests();
        const guest = guests.find(g => g.vmid === vmid);
        if (!guest) return { success: false, error: `Guest ${vmid} not found` };
        const taskId = await this.pve.createSnapshot(vmid, guest.type, name, description, vmstate);
        return { success: true, data: { vmid, name, taskId, message: 'Snapshot created' } };
      }
      return { success: false, error: 'PVE API not available' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }


  private async snapshotsDelete(params: Record<string, unknown>): Promise<CommandResult> {
    const vmid = params.vmid as number;
    const name = params.name as string;
    if (!vmid || !name) return { success: false, error: 'vmid and name required' };

    try {
      if (this.pve.available) {
        const guests = await this.pve.listGuests();
        const guest = guests.find(g => g.vmid === vmid);
        if (!guest) return { success: false, error: `Guest ${vmid} not found` };
        const taskId = await this.pve.deleteSnapshot(vmid, guest.type, name);
        return { success: true, data: { vmid, name, taskId, message: 'Snapshot deleted' } };
      }
      return { success: false, error: 'PVE API not available' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }


  private async snapshotsRollback(params: Record<string, unknown>): Promise<CommandResult> {
    const vmid = params.vmid as number;
    const name = params.name as string;
    if (!vmid || !name) return { success: false, error: 'vmid and name required' };

    try {
      if (this.pve.available) {
        const guests = await this.pve.listGuests();
        const guest = guests.find(g => g.vmid === vmid);
        if (!guest) return { success: false, error: `Guest ${vmid} not found` };

        // Stop guest if running before rollback
        if (guest.status === 'running') {
          await this.pve.guestAction(vmid, guest.type, 'stop');
          await new Promise(r => setTimeout(r, 5000)); // wait for stop
        }

        const taskId = await this.pve.rollbackSnapshot(vmid, guest.type, name);
        return { success: true, data: { vmid, name, taskId, message: 'Snapshot rollback initiated' } };
      }
      return { success: false, error: 'PVE API not available' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }


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

  // ─── Stack Install ────────────────────────────

  private async stacksInstall(params: Record<string, unknown>): Promise<CommandResult> {
    const stackId = params.stackId as string;
    if (!stackId) return { success: false, error: 'stackId required' };

    const stack = APP_STACKS[stackId];
    if (!stack) return { success: false, error: `Unknown stack: ${stackId}. Available: ${Object.keys(APP_STACKS).join(', ')}` };

    this.log.info({ stackId, apps: stack.apps }, `Installing stack: ${stack.name}`);

    const results: Array<{ appId: string; success: boolean; url?: string; error?: string }> = [];

    for (const appId of stack.apps) {
      try {
        const result = await this.appsInstall({ appId });
        const data = result.data as any;
        results.push({
          appId,
          success: result.success,
          url: data?.url,
          error: result.error,
        });
      } catch (err) {
        results.push({ appId, success: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      success: failed === 0,
      data: {
        stackId,
        name: stack.name,
        results,
        summary: `${succeeded}/${stack.apps.length} apps installed${failed > 0 ? ` (${failed} failed)` : ''}`,
      },
    };
  }

  // ─── PVE API Storage Methods ──────────────────

  private async storageDisks(): Promise<CommandResult> {
    try {
      if (this.pve.available) {
        const disks = await this.pve.listDisks();
        return { success: true, data: { disks: disks || [] } };
      }
      return { success: true, data: { disks: this.collector.getDiskMetrics() } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async storageZfs(): Promise<CommandResult> {
    try {
      if (this.pve.available) {
        const pools = await this.pve.listZfsPools();
        return { success: true, data: { pools: pools || [] } };
      }
      return { success: true, data: { pools: this.collector.getZfsPools() } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async storageZfsScrub(params: Record<string, unknown>): Promise<CommandResult> {
    const pool = params.pool as string;
    if (!pool) return { success: false, error: 'pool name required' };
    try {
      if (this.pve.available) {
        await this.pve.zfsScrub(pool);
        return { success: true, data: { pool, message: 'Scrub started' } };
      }
      return { success: false, error: 'PVE API not available' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async storageSmart(params: Record<string, unknown>): Promise<CommandResult> {
    const disk = params.disk as string;
    if (!disk) return { success: false, error: 'disk path required' };
    try {
      if (this.pve.available) {
        const data = await this.pve.getSmartData(disk);
        return { success: true, data };
      }
      return { success: false, error: 'PVE API not available' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
