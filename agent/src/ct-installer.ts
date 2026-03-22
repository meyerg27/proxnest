/**
 * ProxNest Agent — LXC Container App Installer
 * Each app gets its own dedicated LXC container with Docker inside.
 * Shows as individual CTs in Proxmox with proper resource isolation.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import type { AppConfig } from './app-catalog.js';

// VMID range for ProxNest apps: 200-299
const VMID_START = 200;
const VMID_END = 299;
const STATE_FILE = '/opt/proxnest-apps/.ct-state.json';
// Template name is auto-detected — see ensureTemplate()
let CT_TEMPLATE = 'local:vztmpl/debian-12-standard_12.12-1_amd64.tar.zst';

interface CtState {
  apps: Record<string, {
    vmid: number;
    ip: string;
    appId: string;
    image: string;
    status: string;
    webPort: number;
    installedAt: string;
  }>;
  nextVmid: number;
}

// Resource profiles per app category
const RESOURCE_PROFILES: Record<string, { memory: number; cores: number; disk: number; swap: number }> = {
  // Media players (need more RAM for transcoding)
  jellyfin:   { memory: 2048, cores: 2, disk: 8, swap: 512 },
  plex:       { memory: 2048, cores: 2, disk: 8, swap: 512 },
  emby:       { memory: 2048, cores: 2, disk: 8, swap: 512 },

  // Download managers
  radarr:     { memory: 1024, cores: 1, disk: 4, swap: 256 },
  sonarr:     { memory: 1024, cores: 1, disk: 4, swap: 256 },
  prowlarr:   { memory: 512,  cores: 1, disk: 2, swap: 256 },
  bazarr:     { memory: 512,  cores: 1, disk: 2, swap: 256 },
  qbittorrent:{ memory: 1024, cores: 1, disk: 4, swap: 256 },
  sabnzbd:    { memory: 1024, cores: 1, disk: 4, swap: 256 },

  // Cloud
  nextcloud:  { memory: 2048, cores: 2, disk: 10, swap: 512 },
  immich:     { memory: 2048, cores: 2, disk: 8, swap: 512 },
  vaultwarden:{ memory: 256,  cores: 1, disk: 2, swap: 128 },
  syncthing:  { memory: 512,  cores: 1, disk: 4, swap: 256 },

  // Network
  pihole:     { memory: 256,  cores: 1, disk: 2, swap: 128 },
  adguard:    { memory: 256,  cores: 1, disk: 2, swap: 128 },
  'nginx-proxy-manager': { memory: 512, cores: 1, disk: 2, swap: 256 },
  wireguard:  { memory: 256,  cores: 1, disk: 2, swap: 128 },

  // Monitoring
  grafana:    { memory: 512,  cores: 1, disk: 4, swap: 256 },
  portainer:  { memory: 512,  cores: 1, disk: 4, swap: 256 },
  'uptime-kuma': { memory: 256, cores: 1, disk: 2, swap: 128 },
  dozzle:     { memory: 256,  cores: 1, disk: 2, swap: 128 },

  // Productivity
  mealie:     { memory: 512,  cores: 1, disk: 4, swap: 256 },
  paperless:  { memory: 1024, cores: 1, disk: 4, swap: 256 },
  homepage:   { memory: 256,  cores: 1, disk: 2, swap: 128 },

  // Default for unknown apps
  _default:   { memory: 512,  cores: 1, disk: 4, swap: 256 },
};

function run(cmd: string, timeout = 30000): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout }).trim();
  } catch (e: any) {
    throw new Error(e.stderr || e.message || String(e));
  }
}

function runSafe(cmd: string, timeout = 30000): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout }).trim();
  } catch { return ''; }
}

function loadState(): CtState {
  try {
    if (existsSync(STATE_FILE)) {
      return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { apps: {}, nextVmid: VMID_START };
}

function saveState(state: CtState): void {
  mkdirSync('/opt/proxnest-apps', { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Find next available VMID in the 200-299 range.
 */
function findNextVmid(state: CtState): number {
  const usedVmids = new Set(Object.values(state.apps).map(a => a.vmid));
  // Also check PVE for any existing CTs/VMs in range
  const pveList = runSafe('pvesh get /cluster/resources --type vm --output-format json 2>/dev/null');
  if (pveList) {
    try {
      const resources = JSON.parse(pveList);
      for (const r of resources) {
        if (r.vmid >= VMID_START && r.vmid <= VMID_END) {
          usedVmids.add(r.vmid);
        }
      }
    } catch { /* ignore */ }
  }

  for (let vmid = VMID_START; vmid <= VMID_END; vmid++) {
    if (!usedVmids.has(vmid)) return vmid;
  }
  throw new Error('No available VMIDs (200-299 all in use)');
}

/**
 * Get the subnet gateway and next available IP.
 */
function getNetworkInfo(): { gateway: string; bridge: string; cidr: string } {
  // Detect from host's network config
  const gateway = runSafe("ip -4 route show default | awk '{print $3}' | head -1") || '192.168.1.1';
  const bridge = runSafe("ip -4 route show default | awk '{print $5}' | head -1") || 'vmbr0';

  // Determine subnet CIDR from gateway
  const parts = gateway.split('.');
  const cidr = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;

  return { gateway, bridge, cidr };
}

/**
 * Find an available IP via DHCP or sequential assignment.
 */
function findAvailableIp(state: CtState): string {
  const netInfo = getNetworkInfo();
  const parts = netInfo.gateway.split('.');
  const base = `${parts[0]}.${parts[1]}.${parts[2]}`;

  // Get used IPs
  const usedIps = new Set(Object.values(state.apps).map(a => a.ip));

  // Also check ARP table for active IPs
  const arpOutput = runSafe('arp -n 2>/dev/null');
  if (arpOutput) {
    for (const line of arpOutput.split('\n')) {
      const match = line.match(/^(\d+\.\d+\.\d+\.\d+)/);
      if (match) usedIps.add(match[1]);
    }
  }

  // Assign IPs starting from .200 (matching VMID range concept)
  for (let i = 200; i <= 254; i++) {
    const ip = `${base}.${i}`;
    if (!usedIps.has(ip)) return ip;
  }

  // Fallback to DHCP
  return 'dhcp';
}

/**
 * Ensure CT template is available. Auto-detects latest Debian 12 version.
 */
function ensureTemplate(): void {
  // Check if already downloaded — pveam list returns "local:vztmpl/filename"
  const existing = runSafe(`pveam list local 2>/dev/null | grep debian-12-standard | awk '{print $1}'`);
  if (existing) {
    // pveam list already returns "local:vztmpl/..." format
    CT_TEMPLATE = existing.split('\n')[0].trim();
    return;
  }

  // Find latest available Debian 12 template
  const available = runSafe(`pveam available --section system 2>/dev/null | grep debian-12-standard | awk '{print $2}'`);
  if (!available) throw new Error('No Debian 12 CT template available. Check internet connection.');

  const templateName = available.split('\n')[0].trim();
  run(`pveam download local ${templateName} 2>&1`, 180000);
  CT_TEMPLATE = `local:vztmpl/${templateName}`;
}

/**
 * Install an app in its own LXC container.
 */
export async function installAppCt(
  appId: string,
  appConfig: AppConfig,
  log: { info: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void },
): Promise<{
  success: boolean;
  vmid?: number;
  ip?: string;
  url?: string;
  containerName?: string;
  webPort?: number;
  error?: string;
}> {
  const state = loadState();

  // Check if already installed
  if (state.apps[appId]) {
    return {
      success: false,
      error: `${appId} is already installed (CT ${state.apps[appId].vmid}). Uninstall first.`,
    };
  }

  const profile = RESOURCE_PROFILES[appId] || RESOURCE_PROFILES._default;
  const netInfo = getNetworkInfo();

  try {
    // 1. Ensure template
    log.info({ appId }, 'Ensuring CT template...');
    ensureTemplate();

    // 2. Find VMID and IP
    const vmid = findNextVmid(state);
    const ip = findAvailableIp(state);
    const hostname = `proxnest-${appId}`;

    log.info({ appId, vmid, ip, hostname }, 'Creating LXC container');

    // 3. Find storage for CT rootfs
    const storage = runSafe("pvesm status --content rootdir 2>/dev/null | awk 'NR>1{print $1}' | head -1") || 'local-lvm';

    // 4. Create CT
    const ipConfig = ip === 'dhcp' ? 'ip=dhcp' : `ip=${ip}/24,gw=${netInfo.gateway}`;
    const createCmd = [
      `pct create ${vmid} ${CT_TEMPLATE}`,
      `--hostname ${hostname}`,
      `--memory ${profile.memory}`,
      `--swap ${profile.swap}`,
      `--cores ${profile.cores}`,
      `--rootfs ${storage}:${profile.disk}`,
      `--net0 name=eth0,bridge=vmbr0,${ipConfig}`,
      `--onboot 1`,
      `--start 0`,
      `--unprivileged 0`,
      `--features nesting=1,keyctl=1`,
      `--description "ProxNest App: ${appConfig.name}"`,
      `--nameserver 8.8.8.8`,
    ].join(' ');

    run(createCmd, 60000);
    log.info({ vmid }, 'CT created, starting...');

    // 5. Start CT
    run(`pct start ${vmid}`, 30000);
    // Wait for network
    await sleep(5000);

    // 6. Install Docker inside CT
    log.info({ vmid }, 'Installing Docker in CT...');
    pctExec(vmid, 'apt-get update -qq 2>&1 | tail -1', 120000);
    pctExec(vmid, 'apt-get install -y -qq curl ca-certificates gnupg 2>&1 | tail -1', 60000);
    pctExec(vmid, 'curl -fsSL https://get.docker.com | sh 2>&1 | tail -3', 180000);
    pctExec(vmid, 'systemctl enable --now docker 2>&1', 15000);

    // 7. Create shared directories inside CT and mount host media dirs
    // Bind mount host /data into CT if it exists
    const hasData = existsSync('/data');
    if (hasData) {
      // Add mount point to CT config
      try {
        run(`pct set ${vmid} --mp0 /data,mp=/data`, 10000);
        // Need to restart CT for mount to take effect
        run(`pct stop ${vmid}`, 15000);
        await sleep(2000);
        run(`pct start ${vmid}`, 15000);
        await sleep(5000);
      } catch {
        log.warn({ vmid }, 'Failed to bind mount /data — app will use local storage');
      }
    }

    // 8. Run the app's Docker container inside the CT
    log.info({ vmid, image: appConfig.image }, 'Pulling and running app...');
    pctExec(vmid, `docker pull ${appConfig.image} 2>&1 | tail -1`, 300000);

    let dockerCmd = `docker run -d --name ${appId} --restart unless-stopped --privileged`;

    // Port mapping — expose on CT's port (direct, since CT has its own IP)
    const webPort = Object.values(appConfig.ports)[0] || 8080;
    for (const [, containerPort] of Object.entries(appConfig.ports)) {
      dockerCmd += ` -p ${containerPort}:${containerPort}`;
    }

    // Volume mounts
    for (const [hostPath, containerPath] of Object.entries(appConfig.volumes)) {
      // Adjust host paths for inside-CT context
      const ctPath = hostPath.startsWith('/opt/proxnest-apps/')
        ? hostPath // Config dirs stay local to CT
        : hostPath; // Media dirs are bind-mounted from host
      pctExec(vmid, `mkdir -p "${ctPath}" 2>/dev/null || true`, 5000);
      dockerCmd += ` -v ${ctPath}:${containerPath}`;
    }

    // Environment variables
    if (appConfig.env) {
      for (const [k, v] of Object.entries(appConfig.env)) {
        dockerCmd += ` -e ${k}=${v}`;
      }
    }

    dockerCmd += ` ${appConfig.image}`;
    pctExec(vmid, dockerCmd + ' 2>&1', 60000);

    // 9. Wait for app to start
    await sleep(5000);
    const containerStatus = pctExec(vmid, `docker inspect --format '{{.State.Status}}' ${appId} 2>/dev/null || echo unknown`, 5000);

    // 10. Update state
    const actualIp = ip === 'dhcp'
      ? (runSafe(`pct exec ${vmid} -- hostname -I 2>/dev/null`) || '').trim().split(' ')[0] || ip
      : ip;

    state.apps[appId] = {
      vmid,
      ip: actualIp,
      appId,
      image: appConfig.image,
      status: containerStatus.includes('running') ? 'running' : containerStatus,
      webPort,
      installedAt: new Date().toISOString(),
    };
    state.nextVmid = vmid + 1;
    saveState(state);

    const url = `http://${actualIp}:${webPort}`;
    log.info({ appId, vmid, ip: actualIp, url }, 'App installed successfully in CT');

    return {
      success: true,
      vmid,
      ip: actualIp,
      url,
      containerName: hostname,
      webPort,
    };
  } catch (err) {
    log.error({ appId, error: err }, 'CT install failed');
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Uninstall an app by destroying its CT.
 */
export function uninstallAppCt(appId: string): { success: boolean; error?: string } {
  const state = loadState();
  const app = state.apps[appId];
  if (!app) return { success: false, error: `${appId} not installed` };

  try {
    // Stop and destroy CT
    runSafe(`pct stop ${app.vmid} 2>/dev/null`);
    run(`pct destroy ${app.vmid} --purge 2>&1`, 30000);

    delete state.apps[appId];
    saveState(state);

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * List all installed app CTs with status.
 */
export function listAppCts(): Array<{
  appId: string;
  vmid: number;
  ip: string;
  status: string;
  url: string;
  memory: { used: number; total: number };
  cpu: number;
}> {
  const state = loadState();
  const results: Array<any> = [];

  for (const [appId, app] of Object.entries(state.apps)) {
    // Get live status from PVE
    const statusJson = runSafe(`pvesh get /nodes/$(hostname)/lxc/${app.vmid}/status/current --output-format json 2>/dev/null`);
    let status = 'unknown';
    let memUsed = 0, memTotal = 0, cpu = 0;

    if (statusJson) {
      try {
        const s = JSON.parse(statusJson);
        status = s.status || 'unknown';
        memUsed = s.mem || 0;
        memTotal = s.maxmem || 0;
        cpu = s.cpu || 0;
      } catch { /* ignore */ }
    }

    results.push({
      appId,
      vmid: app.vmid,
      ip: app.ip,
      status,
      url: `http://${app.ip}:${app.webPort}`,
      memory: { used: memUsed, total: memTotal },
      cpu: Math.round(cpu * 100),
    });
  }

  return results;
}

/**
 * Get status of a specific app CT.
 */
export function getAppCtStatus(appId: string): any {
  const state = loadState();
  const app = state.apps[appId];
  if (!app) return null;

  const statusJson = runSafe(`pvesh get /nodes/$(hostname)/lxc/${app.vmid}/status/current --output-format json 2>/dev/null`);
  if (!statusJson) return { ...app, status: 'unknown' };

  try {
    const s = JSON.parse(statusJson);
    return {
      ...app,
      status: s.status,
      cpu: Math.round((s.cpu || 0) * 100),
      memUsed: s.mem || 0,
      memTotal: s.maxmem || 0,
      diskUsed: s.disk || 0,
      diskTotal: s.maxdisk || 0,
      uptime: s.uptime || 0,
      netin: s.netin || 0,
      netout: s.netout || 0,
    };
  } catch {
    return { ...app, status: 'unknown' };
  }
}

// Helpers

function pctExec(vmid: number, cmd: string, timeout = 30000): string {
  return run(`pct exec ${vmid} -- bash -c '${cmd.replace(/'/g, "'\\''")}'`, timeout);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
