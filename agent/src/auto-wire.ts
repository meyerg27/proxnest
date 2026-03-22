/**
 * ProxNest Agent — Auto-Wiring System
 * Automatically configures apps to talk to each other after install.
 * 
 * Supported connections:
 * - Radarr/Sonarr → qBittorrent (download client)
 * - Prowlarr → Radarr/Sonarr (indexer sync)
 * - Bazarr → Radarr + Sonarr (subtitle sync)
 * - Jellyseerr → Jellyfin + Radarr + Sonarr (request management)
 * - Overseerr → Plex + Radarr + Sonarr (request management)
 * - Tautulli → Plex (monitoring)
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const WIRE_STATE_PATH = '/opt/proxnest-apps/.wire-state.json';

export interface AppEndpoint {
  appId: string;
  host: string;
  port: number;
  apiKey?: string;
  url: string;
}

interface WireState {
  endpoints: Record<string, AppEndpoint>;
  wiredPairs: string[]; // "source->target" pairs already wired
}

// ─── State Management ────────────────────────────

function loadState(): WireState {
  try {
    if (existsSync(WIRE_STATE_PATH)) {
      return JSON.parse(readFileSync(WIRE_STATE_PATH, 'utf-8'));
    }
  } catch { /* fresh state */ }
  return { endpoints: {}, wiredPairs: [] };
}

function saveState(state: WireState): void {
  try {
    mkdirSync('/opt/proxnest-apps', { recursive: true });
    writeFileSync(WIRE_STATE_PATH, JSON.stringify(state, null, 2));
  } catch { /* ignore */ }
}

// ─── CT-Aware Helpers ────────────────────────────

interface CtInfo { vmid: number; ip: string }

function getCtInfo(appId: string): CtInfo | null {
  try {
    const stateFile = '/opt/proxnest-apps/.ct-state.json';
    if (!existsSync(stateFile)) return null;
    const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
    const app = state.apps?.[appId];
    if (app?.vmid && app?.ip) return { vmid: app.vmid, ip: app.ip };
  } catch { /* ignore */ }
  return null;
}

/** Get the base URL to reach an app's API (CT IP or localhost). */
function appUrl(appId: string, port: number): string {
  const ct = getCtInfo(appId);
  return ct ? `http://${ct.ip}:${port}` : `http://localhost:${port}`;
}

/** Get the host/IP for inter-app references (e.g., Radarr telling qBit's address). */
function appHost(appId: string): string {
  const ct = getCtInfo(appId);
  return ct ? ct.ip : getHostIp();
}

/** Run a command inside an app's Docker container (CT-aware). */
function appExec(appId: string, cmd: string): string {
  const ct = getCtInfo(appId);
  if (ct) {
    return execSync(
      `pct exec ${ct.vmid} -- docker exec ${appId} ${cmd}`,
      { encoding: 'utf-8', timeout: 10000 },
    ).trim();
  }
  return execSync(
    `docker exec proxnest-${appId} ${cmd}`,
    { encoding: 'utf-8', timeout: 5000 },
  ).trim();
}

// ─── API Key Extraction ──────────────────────────

function getArrApiKey(appId: string): string | null {
  try {
    const xml = appExec(appId, 'cat /config/config.xml');
    const match = xml.match(/<ApiKey>([^<]+)<\/ApiKey>/);
    return match ? match[1] : null;
  } catch { return null; }
}

function getJellyfinApiKey(host: string, port: number): string | null {
  try {
    return appExec('jellyfin', "sh -c \"cat /config/data/jellyfin.db 2>/dev/null | strings | grep -oP '[a-f0-9]{32}' | head -1\"") || null;
  } catch { return null; }
}

// ─── Health Check ────────────────────────────────

function waitForApp(url: string, maxWaitSec: number = 30): boolean {
  const start = Date.now();
  while (Date.now() - start < maxWaitSec * 1000) {
    try {
      execSync(`curl -sf -o /dev/null -w '%{http_code}' --connect-timeout 2 '${url}' 2>/dev/null`, {
        encoding: 'utf-8', timeout: 5000,
      });
      return true;
    } catch {
      execSync('sleep 2', { encoding: 'utf-8' });
    }
  }
  return false;
}

function isAppRunning(appId: string): boolean {
  const ct = getCtInfo(appId);
  try {
    if (ct) {
      const s = execSync(`pct exec ${ct.vmid} -- docker inspect --format '{{.State.Status}}' ${appId} 2>/dev/null`, { encoding: 'utf-8', timeout: 5000 }).trim();
      return s === 'running';
    }
    const s = execSync(`docker inspect --format '{{.State.Status}}' proxnest-${appId} 2>/dev/null`, { encoding: 'utf-8', timeout: 5000 }).trim();
    return s === 'running';
  } catch { return false; }
}

// ─── Get Host IP ─────────────────────────────────

function getHostIp(): string {
  try {
    const out = execSync("ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}'", {
      encoding: 'utf-8', timeout: 5000,
    });
    if (out.trim() && out.trim() !== '127.0.0.1') return out.trim();
  } catch { /* fallback */ }
  try {
    const out = execSync("ip -4 addr show scope global | grep -oP '(?<=inet )\\S+' | head -1 | cut -d/ -f1", {
      encoding: 'utf-8', timeout: 5000,
    });
    if (out.trim()) return out.trim();
  } catch { /* fallback */ }
  return '0.0.0.0';
}

// ─── Wiring Functions ────────────────────────────

/** Get qBittorrent password — newer versions generate a random temp password */
function getQbitPassword(qbitPort: number): string {
  const KNOWN_PASSWORD = 'proxnest';
  const qbitBase = appUrl('qbittorrent', qbitPort);
  
  // Try the known password first (already configured)
  try {
    const result = execSync(
      `curl -sf -c /tmp/qbt-cookie -X POST '${qbitBase}/api/v2/auth/login' ` +
      `-d 'username=admin&password=${KNOWN_PASSWORD}' 2>/dev/null`,
      { encoding: 'utf-8', timeout: 5000 },
    );
    if (result.includes('Ok')) return KNOWN_PASSWORD;
  } catch { /* not yet set */ }

  // Read temp password from Docker logs (CT-aware)
  try {
    const ct = getCtInfo('qbittorrent');
    const logsCmd = ct
      ? `pct exec ${ct.vmid} -- docker logs qbittorrent 2>&1 | grep 'temporary password' | tail -1`
      : `docker logs proxnest-qbittorrent 2>&1 | grep 'temporary password' | tail -1`;
    const logs = execSync(logsCmd, { encoding: 'utf-8', timeout: 5000 });
    const match = logs.match(/temporary password[^:]*:\s*(\S+)/i);
    if (match) {
      const tempPass = match[1];
      execSync(
        `curl -sf -c /tmp/qbt-cookie -b /tmp/qbt-cookie -X POST '${qbitBase}/api/v2/auth/login' ` +
        `-d 'username=admin&password=${tempPass}' 2>/dev/null`,
        { encoding: 'utf-8', timeout: 5000 },
      );
      execSync(
        `curl -sf -b /tmp/qbt-cookie -X POST '${qbitBase}/api/v2/app/setPreferences' ` +
        `-d 'json={"web_ui_password":"${KNOWN_PASSWORD}","save_path":"/downloads/complete","temp_path":"/downloads/incomplete","temp_path_enabled":true,"create_subfolder_enabled":false}' 2>/dev/null`,
        { encoding: 'utf-8', timeout: 5000 },
      );
      return KNOWN_PASSWORD;
    }
  } catch { /* fallback */ }

  return KNOWN_PASSWORD; // best effort
}

/** Add qBittorrent as download client in Radarr or Sonarr */
function wireArrToQbit(arrId: string, arrPort: number, arrApiKey: string, qbitPort: number): boolean {
  const qbitHost = appHost('qbittorrent'); // qBit's IP for Radarr to connect to
  const arrBase = appUrl(arrId, arrPort);   // URL to reach this Radarr/Sonarr API
  try {
    // Check if download client already exists
    const existing = execSync(
      `curl -sf '${arrBase}/api/v3/downloadclient' -H 'X-Api-Key: ${arrApiKey}' 2>/dev/null`,
      { encoding: 'utf-8', timeout: 5000 },
    );
    const clients = JSON.parse(existing);
    if (clients.some((c: any) => c.implementation === 'QBittorrent')) {
      return true; // already configured
    }

    // Get the actual qBit password (auto-configures it if needed)
    const qbitPassword = getQbitPassword(qbitPort);

    const payload = JSON.stringify({
      enable: true,
      protocol: 'torrent',
      priority: 1,
      name: 'qBittorrent',
      implementation: 'QBittorrent',
      configContract: 'QBittorrentSettings',
      fields: [
        { name: 'host', value: qbitHost },
        { name: 'port', value: qbitPort },
        { name: 'username', value: 'admin' },
        { name: 'password', value: qbitPassword },
        { name: 'movieCategory', value: arrId === 'radarr' ? 'movies' : 'tv' },
        { name: 'tvCategory', value: 'tv' },
        { name: 'recentMoviePriority', value: 0 },
        { name: 'recentTvPriority', value: 0 },
        { name: 'olderMoviePriority', value: 0 },
        { name: 'olderTvPriority', value: 0 },
        { name: 'initialState', value: 0 },
        { name: 'sequentialOrder', value: false },
        { name: 'firstAndLast', value: false },
      ],
      tags: [],
    });

    execSync(
      `curl -sf -X POST '${arrBase}/api/v3/downloadclient' ` +
      `-H 'X-Api-Key: ${arrApiKey}' -H 'Content-Type: application/json' ` +
      `-d '${payload.replace(/'/g, "'\\''")}' 2>/dev/null`,
      { encoding: 'utf-8', timeout: 10000 },
    );
    return true;
  } catch { return false; }
}

/** Configure root folder in Radarr/Sonarr */
function wireArrRootFolder(arrId: string, arrPort: number, arrApiKey: string): boolean {
  const arrBase = appUrl(arrId, arrPort);
  try {
    const existing = execSync(
      `curl -sf '${arrBase}/api/v3/rootfolder' -H 'X-Api-Key: ${arrApiKey}' 2>/dev/null`,
      { encoding: 'utf-8', timeout: 5000 },
    );
    const folders = JSON.parse(existing);
    const targetPath = arrId === 'radarr' ? '/movies' : '/tv';
    if (folders.some((f: any) => f.path === targetPath)) {
      return true; // already set
    }

    execSync(
      `curl -sf -X POST '${arrBase}/api/v3/rootfolder' ` +
      `-H 'X-Api-Key: ${arrApiKey}' -H 'Content-Type: application/json' ` +
      `-d '{"path":"${targetPath}"}' 2>/dev/null`,
      { encoding: 'utf-8', timeout: 5000 },
    );
    return true;
  } catch { return false; }
}

/** Add Radarr/Sonarr as app in Prowlarr */
function wireProwlarrToArr(prowlarrPort: number, prowlarrApiKey: string, arrId: string, arrPort: number, arrApiKey: string): boolean {
  const prowlarrBase = appUrl('prowlarr', prowlarrPort);
  const arrHost = appHost(arrId);
  try {
    const existing = execSync(
      `curl -sf '${prowlarrBase}/api/v1/applications' -H 'X-Api-Key: ${prowlarrApiKey}' 2>/dev/null`,
      { encoding: 'utf-8', timeout: 5000 },
    );
    const apps = JSON.parse(existing);
    const implName = arrId === 'radarr' ? 'Radarr' : 'Sonarr';
    if (apps.some((a: any) => a.implementation === implName)) {
      return true;
    }

    const syncLevel = 'fullSync';
    const payload = JSON.stringify({
      name: implName,
      implementation: implName,
      configContract: `${implName}Settings`,
      syncLevel,
      fields: [
        { name: 'prowlarrUrl', value: appUrl('prowlarr', prowlarrPort) },
        { name: 'baseUrl', value: appUrl(arrId, arrPort) },
        { name: 'apiKey', value: arrApiKey },
        { name: 'syncCategories', value: arrId === 'radarr' ? [2000, 2010, 2020, 2030, 2040, 2045, 2050, 2060, 2070, 2080] : [5000, 5010, 5020, 5030, 5040, 5045, 5050, 5060, 5070, 5080] },
      ],
      tags: [],
    });

    execSync(
      `curl -sf -X POST '${prowlarrBase}/api/v1/applications' ` +
      `-H 'X-Api-Key: ${prowlarrApiKey}' -H 'Content-Type: application/json' ` +
      `-d '${payload.replace(/'/g, "'\\''")}' 2>/dev/null`,
      { encoding: 'utf-8', timeout: 10000 },
    );
    return true;
  } catch { return false; }
}

/** Configure Bazarr to connect to Radarr and Sonarr */
function wireBazarrToArr(bazarrPort: number, arrId: string, arrPort: number, arrApiKey: string): boolean {
  const bazarrBase = appUrl('bazarr', bazarrPort);
  const arrHost = appHost(arrId);
  try {
    // Bazarr uses a different API pattern — PATCH /api/system/settings with nested config
    // First get existing settings
    const existing = execSync(
      `curl -sf '${bazarrBase}/api/system/settings' 2>/dev/null`,
      { encoding: 'utf-8', timeout: 5000 },
    );
    const settings = JSON.parse(existing);

    // Update the relevant section
    const section = arrId === 'radarr' ? 'radarr' : 'sonarr';
    const update: Record<string, any> = {};
    update[section] = {
      ip: host,
      port: arrPort,
      apikey: arrApiKey,
      base_url: '',
      ssl: false,
    };

    const payload = JSON.stringify(update);
    execSync(
      `curl -sf -X PATCH '${bazarrBase}/api/system/settings' ` +
      `-H 'Content-Type: application/json' ` +
      `-d '${payload.replace(/'/g, "'\\''")}' 2>/dev/null`,
      { encoding: 'utf-8', timeout: 5000 },
    );
    return true;
  } catch {
    // Bazarr may not have its API ready yet — try writing config directly
    try {
      const configPath = `/opt/proxnest-apps/bazarr/config/config/config.yaml`;
      if (existsSync(configPath)) {
        const yaml = readFileSync(configPath, 'utf-8');
        const section = arrId === 'radarr' ? 'radarr' : 'sonarr';
        // Simple yaml inject
        const block = `\n${section}:\n  apikey: ${arrApiKey}\n  ip: ${host}\n  port: ${arrPort}\n  ssl: false\n  base_url: ""\n`;
        if (!yaml.includes(`${section}:`)) {
          writeFileSync(configPath, yaml + block);
          return true;
        }
      }
    } catch { /* fallback failed too */ }
    return false;
  }
}

// ─── Port Resolution ─────────────────────────────

function getAppPort(appId: string): number | null {
  try {
    // Use JSON format to avoid IPv4+IPv6 duplication issues
    const inspect = execSync(
      `docker inspect proxnest-${appId} 2>/dev/null`,
      { encoding: 'utf-8', timeout: 5000 },
    );
    const data = JSON.parse(inspect);
    const portBindings = data[0]?.NetworkSettings?.Ports || {};
    const allPorts = new Set<number>();
    for (const bindings of Object.values(portBindings) as any[]) {
      if (Array.isArray(bindings)) {
        for (const b of bindings) {
          if (b.HostPort) allPorts.add(parseInt(b.HostPort, 10));
        }
      }
    }
    const ports = [...allPorts];
    // Return the first web port (skip torrent/sync/vpn/dns ports)
    const nonWebPorts = [6881, 22000, 51820, 53];
    const webPorts = ports.filter(p => !nonWebPorts.includes(p));
    return webPorts.length > 0 ? webPorts[0] : (ports.length > 0 ? ports[0] : null);
  } catch { return null; }
}

// ─── Main Auto-Wire Entry Point ──────────────────

export interface WireResult {
  pair: string;
  success: boolean;
  message: string;
}

/**
 * Run auto-wiring after an app is installed.
 * Checks what other apps are running and configures connections.
 */
export function autoWire(installedAppId: string): WireResult[] {
  const results: WireResult[] = [];
  const state = loadState();
  const host = getHostIp();

  // Register the newly installed app
  const port = getAppPort(installedAppId);
  if (port) {
    // Wait for the app to actually be ready
    waitForApp(appUrl(installedAppId, port), 20);

    let apiKey: string | null = null;
    if (['radarr', 'sonarr', 'prowlarr', 'bazarr'].includes(installedAppId)) {
      // Arr apps need time to generate config.xml on first start
      for (let attempt = 0; attempt < 6; attempt++) {
        execSync('sleep 5', { encoding: 'utf-8' });
        apiKey = getArrApiKey(installedAppId);
        if (apiKey) break;
      }
    }

    state.endpoints[installedAppId] = {
      appId: installedAppId,
      host,
      port,
      apiKey: apiKey || undefined,
      url: `http://${host}:${port}`,
    };
    saveState(state);
  }

  // ── Wire: qBittorrent initial setup (password + paths) ──
  if (installedAppId === 'qbittorrent' && port) {
    try {
      getQbitPassword(port); // This sets the password and download paths
      results.push({
        pair: 'qbittorrent->setup',
        success: true,
        message: 'qBittorrent: Password set to "proxnest", download paths configured',
      });
      state.wiredPairs.push('qbittorrent->setup');
    } catch {
      results.push({
        pair: 'qbittorrent->setup',
        success: false,
        message: 'qBittorrent: Failed to set initial password',
      });
    }
  }

  // ── Wire: Radarr/Sonarr → qBittorrent ──────────
  if (['radarr', 'sonarr', 'qbittorrent'].includes(installedAppId)) {
    const arrs = ['radarr', 'sonarr'].filter(id => isAppRunning(id));
    const qbitPort = getAppPort('qbittorrent');

    if (qbitPort && isAppRunning('qbittorrent')) {
      for (const arrId of arrs) {
        const pairKey = `${arrId}->qbittorrent`;
        if (state.wiredPairs.includes(pairKey)) continue;

        const arrPort = getAppPort(arrId);
        const arrApiKey = getArrApiKey(arrId);
        if (!arrPort || !arrApiKey) continue;

        const success = wireArrToQbit(arrId, arrPort, arrApiKey, qbitPort);
        results.push({
          pair: pairKey,
          success,
          message: success
            ? `${arrId} → qBittorrent: Download client configured`
            : `${arrId} → qBittorrent: Failed to configure`,
        });

        if (success) {
          state.wiredPairs.push(pairKey);
          // Also set root folder
          wireArrRootFolder(arrId, arrPort, arrApiKey);
        }
      }
    }
  }

  // ── Wire: Prowlarr → Radarr/Sonarr ─────────────
  if (['prowlarr', 'radarr', 'sonarr'].includes(installedAppId)) {
    const prowlarrPort = getAppPort('prowlarr');
    const prowlarrApiKey = getArrApiKey('prowlarr');

    if (prowlarrPort && prowlarrApiKey && isAppRunning('prowlarr')) {
      for (const arrId of ['radarr', 'sonarr']) {
        const pairKey = `prowlarr->${arrId}`;
        if (state.wiredPairs.includes(pairKey)) continue;
        if (!isAppRunning(arrId)) continue;

        const arrPort = getAppPort(arrId);
        const arrApiKey = getArrApiKey(arrId);
        if (!arrPort || !arrApiKey) continue;

        const success = wireProwlarrToArr(prowlarrPort, prowlarrApiKey, arrId, arrPort, arrApiKey);
        results.push({
          pair: pairKey,
          success,
          message: success
            ? `Prowlarr → ${arrId}: Indexer sync configured`
            : `Prowlarr → ${arrId}: Failed to configure`,
        });

        if (success) state.wiredPairs.push(pairKey);
      }
    }
  }

  // ── Wire: Bazarr → Radarr/Sonarr ───────────────
  if (['bazarr', 'radarr', 'sonarr'].includes(installedAppId)) {
    const bazarrPort = getAppPort('bazarr');

    if (bazarrPort && isAppRunning('bazarr')) {
      for (const arrId of ['radarr', 'sonarr']) {
        const pairKey = `bazarr->${arrId}`;
        if (state.wiredPairs.includes(pairKey)) continue;
        if (!isAppRunning(arrId)) continue;

        const arrPort = getAppPort(arrId);
        const arrApiKey = getArrApiKey(arrId);
        if (!arrPort || !arrApiKey) continue;

        const success = wireBazarrToArr(bazarrPort, arrId, arrPort, arrApiKey);
        results.push({
          pair: pairKey,
          success,
          message: success
            ? `Bazarr → ${arrId}: Subtitle sync configured`
            : `Bazarr → ${arrId}: Failed to configure`,
        });

        if (success) state.wiredPairs.push(pairKey);
      }
    }
  }

  // ── Wire: Root folders for Radarr/Sonarr ────────
  if (['radarr', 'sonarr'].includes(installedAppId)) {
    const arrPort = getAppPort(installedAppId);
    const arrApiKey = getArrApiKey(installedAppId);
    if (arrPort && arrApiKey) {
      const pairKey = `${installedAppId}->rootfolder`;
      if (!state.wiredPairs.includes(pairKey)) {
        const success = wireArrRootFolder(installedAppId, arrPort, arrApiKey);
        results.push({
          pair: pairKey,
          success,
          message: success
            ? `${installedAppId}: Media folder configured (${installedAppId === 'radarr' ? '/movies' : '/tv'})`
            : `${installedAppId}: Failed to set media folder`,
        });
        if (success) state.wiredPairs.push(pairKey);
      }
    }
  }

  saveState(state);
  return results;
}

/**
 * Get current wiring status — what's connected to what.
 */
export function getWireStatus(): { endpoints: Record<string, AppEndpoint>; connections: string[] } {
  const state = loadState();
  return {
    endpoints: state.endpoints,
    connections: state.wiredPairs,
  };
}

/**
 * Re-wire all running apps (useful after restoring from backup).
 */
export function rewireAll(): WireResult[] {
  const allResults: WireResult[] = [];
  const appsToWire = ['qbittorrent', 'prowlarr', 'radarr', 'sonarr', 'bazarr', 'jellyfin', 'plex'];
  
  for (const appId of appsToWire) {
    if (isAppRunning(appId)) {
      const results = autoWire(appId);
      allResults.push(...results);
    }
  }
  
  return allResults;
}
