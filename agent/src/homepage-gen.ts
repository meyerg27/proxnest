/**
 * ProxNest Agent — Homepage Auto-Generator
 * Creates a Homepage dashboard config from installed apps.
 * Uses gethomepage.dev docker container.
 */

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';

interface AppEntry {
  name: string;
  icon: string;
  href: string;
  description: string;
  category: string;
}

const APP_META: Record<string, { icon: string; description: string; category: string }> = {
  jellyfin: { icon: 'jellyfin.svg', description: 'Stream Movies & TV', category: 'Media' },
  plex: { icon: 'plex.svg', description: 'Stream Movies & TV', category: 'Media' },
  radarr: { icon: 'radarr.svg', description: 'Movie Manager', category: 'Downloads' },
  sonarr: { icon: 'sonarr.svg', description: 'TV Show Manager', category: 'Downloads' },
  prowlarr: { icon: 'prowlarr.svg', description: 'Indexer Manager', category: 'Downloads' },
  bazarr: { icon: 'bazarr.svg', description: 'Subtitle Manager', category: 'Downloads' },
  qbittorrent: { icon: 'qbittorrent.svg', description: 'Torrent Client', category: 'Downloads' },
  jellyseerr: { icon: 'jellyseerr.svg', description: 'Media Requests', category: 'Media' },
  overseerr: { icon: 'overseerr.svg', description: 'Media Requests', category: 'Media' },
  tautulli: { icon: 'tautulli.svg', description: 'Plex Analytics', category: 'Media' },
  nextcloud: { icon: 'nextcloud.svg', description: 'Cloud Storage', category: 'Cloud' },
  immich: { icon: 'immich.svg', description: 'Photo Management', category: 'Cloud' },
  vaultwarden: { icon: 'vaultwarden.svg', description: 'Password Manager', category: 'Cloud' },
  pihole: { icon: 'pi-hole.svg', description: 'Ad Blocker', category: 'Network' },
  adguard: { icon: 'adguard-home.svg', description: 'Ad Blocker', category: 'Network' },
  'nginx-proxy-manager': { icon: 'nginx-proxy-manager.svg', description: 'Reverse Proxy', category: 'Network' },
  wireguard: { icon: 'wireguard.svg', description: 'VPN Server', category: 'Network' },
  grafana: { icon: 'grafana.svg', description: 'Dashboards & Graphs', category: 'Monitoring' },
  portainer: { icon: 'portainer.svg', description: 'Container Management', category: 'Monitoring' },
  'uptime-kuma': { icon: 'uptime-kuma.svg', description: 'Uptime Monitor', category: 'Monitoring' },
  dozzle: { icon: 'dozzle.svg', description: 'Container Logs', category: 'Monitoring' },
  homepage: { icon: 'homepage.svg', description: 'Dashboard', category: 'System' },
  mealie: { icon: 'mealie.svg', description: 'Recipe Manager', category: 'Productivity' },
  paperless: { icon: 'paperless-ngx.svg', description: 'Document Manager', category: 'Productivity' },
  audiobookshelf: { icon: 'audiobookshelf.svg', description: 'Audiobooks & Podcasts', category: 'Media' },
  calibre: { icon: 'calibre-web.svg', description: 'eBook Library', category: 'Media' },
  tdarr: { icon: 'tdarr.svg', description: 'Media Transcoding', category: 'Media' },
  syncthing: { icon: 'syncthing.svg', description: 'File Sync', category: 'Cloud' },
};

function run(cmd: string): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout: 10000 }).trim(); } catch { return ''; }
}

function getHostIp(): string {
  const ip = run("ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}'");
  return ip || '127.0.0.1';
}

/**
 * Discover installed apps and their URLs.
 */
function discoverApps(): AppEntry[] {
  const containers = run("docker ps --filter 'name=proxnest-' --format '{{.Names}}|{{.Ports}}'");
  if (!containers) return [];

  const hostIp = getHostIp();
  const apps: AppEntry[] = [];

  for (const line of containers.split('\n')) {
    if (!line) continue;
    const [name, portsStr] = line.split('|');
    const appId = name.replace('proxnest-', '');
    if (appId === 'homepage' || appId === 'vpn') continue; // Skip self and VPN sidecar

    // Extract web port
    const portMatch = portsStr?.match(/0\.0\.0\.0:(\d+)/);
    const port = portMatch?.[1];
    if (!port) continue;

    const meta = APP_META[appId] || { icon: 'docker.svg', description: appId, category: 'Other' };

    apps.push({
      name: meta.description ? `${appId.charAt(0).toUpperCase() + appId.slice(1)}` : appId,
      icon: `https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/${meta.icon}`,
      href: `http://${hostIp}:${port}`,
      description: meta.description,
      category: meta.category,
    });
  }

  return apps;
}

/**
 * Generate Homepage YAML config files.
 */
function generateConfig(apps: AppEntry[]): { services: string; settings: string; bookmarks: string } {
  // Group by category
  const categories: Record<string, AppEntry[]> = {};
  for (const app of apps) {
    if (!categories[app.category]) categories[app.category] = [];
    categories[app.category].push(app);
  }

  // Build services.yaml
  const servicesLines: string[] = [];
  for (const [category, catApps] of Object.entries(categories)) {
    servicesLines.push(`- ${category}:`);
    for (const app of catApps) {
      servicesLines.push(`    - ${app.name}:`);
      servicesLines.push(`        icon: ${app.icon}`);
      servicesLines.push(`        href: "${app.href}"`);
      servicesLines.push(`        description: ${app.description}`);
    }
  }

  // Build settings.yaml
  const settings = `title: ProxNest Dashboard
favicon: https://proxnest.com/favicon.ico
theme: dark
color: emerald
headerStyle: clean
layout:
${Object.keys(categories).map(c => `  ${c}:\n    style: row\n    columns: 4`).join('\n')}
`;

  // Build bookmarks.yaml
  const bookmarks = `- Useful Links:
    - ProxNest Cloud:
        - abbr: PN
          href: https://cloud.proxnest.com
    - Proxmox Web UI:
        - abbr: PVE
          href: https://localhost:8006
`;

  return { services: servicesLines.join('\n'), settings, bookmarks };
}

/**
 * Install and configure Homepage with auto-discovered apps.
 */
export function setupHomepage(): { success: boolean; url?: string; appCount?: number; error?: string } {
  const apps = discoverApps();

  const configDir = '/opt/proxnest-apps/homepage/config';
  mkdirSync(configDir, { recursive: true });

  const config = generateConfig(apps);
  writeFileSync(`${configDir}/services.yaml`, config.services);
  writeFileSync(`${configDir}/settings.yaml`, config.settings);
  writeFileSync(`${configDir}/bookmarks.yaml`, config.bookmarks);
  writeFileSync(`${configDir}/widgets.yaml`, `- resources:\n    cpu: true\n    memory: true\n    disk: /\n`);
  writeFileSync(`${configDir}/docker.yaml`, '');

  // Run Homepage container
  run('docker rm -f proxnest-homepage 2>/dev/null');

  const hostIp = getHostIp();
  const port = 3000;
  const cmd = [
    'docker run -d',
    '--name proxnest-homepage',
    '--restart unless-stopped',
    `-p ${port}:3000`,
    `-v ${configDir}:/app/config`,
    '-v /var/run/docker.sock:/var/run/docker.sock:ro',
    'ghcr.io/gethomepage/homepage:latest',
  ].join(' ');

  const containerId = run(cmd);
  if (!containerId) {
    return { success: false, error: 'Failed to start Homepage container' };
  }

  return { success: true, url: `http://${hostIp}:${port}`, appCount: apps.length };
}

/**
 * Refresh Homepage config with current apps (without reinstalling).
 */
export function refreshHomepage(): { success: boolean; appCount: number } {
  const apps = discoverApps();
  const configDir = '/opt/proxnest-apps/homepage/config';

  if (!existsSync(configDir)) {
    return { success: false, appCount: 0 };
  }

  const config = generateConfig(apps);
  writeFileSync(`${configDir}/services.yaml`, config.services);
  writeFileSync(`${configDir}/settings.yaml`, config.settings);

  return { success: true, appCount: apps.length };
}
