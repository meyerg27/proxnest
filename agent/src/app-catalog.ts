/**
 * ProxNest Agent — App Catalog
 * Docker configurations for one-click app installs.
 * Apps auto-configure with shared media/download directories.
 */

import { mkdirSync } from 'node:fs';

export interface AppConfig {
  id: string;
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  image: string;
  ports: Record<number, number>; // hostPort → containerPort
  volumes: Record<string, string>; // hostPath → containerPath
  env?: Record<string, string>;
  /** Shell commands to run AFTER container starts (auto-config) */
  postInstall?: string[];
  /** Other app IDs this app connects to */
  connectsTo?: string[];
  /** App stack this belongs to */
  stack?: string;
  /** Default login credentials */
  defaultLogin?: { user: string; pass: string };
}

/** Shared directories created on first app install */
export const SHARED_DIRS = {
  media: '/data/media',
  movies: '/data/media/movies',
  tv: '/data/media/tv',
  music: '/data/media/music',
  books: '/data/media/books',
  audiobooks: '/data/media/audiobooks',
  photos: '/data/media/photos',
  downloads: '/data/downloads',
  downloadsComplete: '/data/downloads/complete',
  downloadsIncomplete: '/data/downloads/incomplete',
};

/** App stacks — one-click bundles */
export const APP_STACKS: Record<string, { name: string; description: string; icon: string; apps: string[] }> = {
  'media-server': {
    name: 'Media Server',
    description: 'Complete media server: Jellyfin + Radarr + Sonarr + Prowlarr + qBittorrent + Bazarr',
    icon: '🎬',
    apps: ['jellyfin', 'radarr', 'sonarr', 'prowlarr', 'qbittorrent', 'bazarr'],
  },
  'download-stack': {
    name: 'Download Stack',
    description: 'Automated media downloading: qBittorrent + Radarr + Sonarr + Prowlarr',
    icon: '⬇️',
    apps: ['qbittorrent', 'radarr', 'sonarr', 'prowlarr'],
  },
  'cloud-suite': {
    name: 'Personal Cloud',
    description: 'File sync, photos, and documents: Nextcloud + Immich + Paperless',
    icon: '☁️',
    apps: ['nextcloud', 'immich', 'paperless'],
  },
  'monitoring': {
    name: 'Monitoring Stack',
    description: 'System monitoring: Grafana + Uptime Kuma + Portainer + Dozzle',
    icon: '📊',
    apps: ['grafana', 'uptime-kuma', 'portainer', 'dozzle'],
  },
  'home-automation': {
    name: 'Home Automation',
    description: 'Smart home control: Home Assistant + Mosquitto MQTT + Node-RED',
    icon: '🏠',
    apps: ['homeassistant', 'mosquitto', 'nodered'],
  },
  'privacy': {
    name: 'Privacy Stack',
    description: 'Protect your network: Pi-hole + WireGuard + Vaultwarden',
    icon: '🔒',
    apps: ['pihole', 'wireguard', 'vaultwarden'],
  },
  'productivity': {
    name: 'Productivity Suite',
    description: 'Recipes, documents, books: Mealie + Paperless + Audiobookshelf',
    icon: '📝',
    apps: ['mealie', 'paperless', 'audiobookshelf'],
  },
  'dev-tools': {
    name: 'Developer Tools',
    description: 'Self-hosted dev stack: Gitea + Portainer + Code Server',
    icon: '💻',
    apps: ['gitea', 'portainer', 'codeserver'],
  },
};

const BASE_DIR = '/opt/proxnest-apps';
const D = SHARED_DIRS;

export const APP_CATALOG: AppConfig[] = [
  // ── Media ──────────────────────────────────
  {
    id: 'jellyfin', name: 'Jellyfin',
    description: 'Free software media system — streams movies, TV, music',
    category: 'Media', icon: '🎬', stack: 'media-server',
    image: 'jellyfin/jellyfin:latest',
    ports: { 8096: 8096 },
    volumes: {
      [`${BASE_DIR}/jellyfin/config`]: '/config',
      [`${BASE_DIR}/jellyfin/cache`]: '/cache',
      [D.movies]: '/media/movies',
      [D.tv]: '/media/tv',
      [D.music]: '/media/music',
    },
    connectsTo: ['radarr', 'sonarr'],
  },
  {
    id: 'plex', name: 'Plex',
    description: 'Stream your media anywhere — requires Plex account',
    category: 'Media', icon: '🎬',
    image: 'plexinc/pms-docker:latest',
    ports: { 32400: 32400 },
    volumes: {
      [`${BASE_DIR}/plex/config`]: '/config',
      [D.movies]: '/media/movies',
      [D.tv]: '/media/tv',
      [D.music]: '/media/music',
    },
  },
  {
    id: 'navidrome', name: 'Navidrome',
    description: 'Modern music server with web UI and subsonic API',
    category: 'Media', icon: '🎵',
    image: 'deluan/navidrome:latest',
    ports: { 4533: 4533 },
    volumes: {
      [`${BASE_DIR}/navidrome/data`]: '/data',
      [D.music]: '/music',
    },
  },
  {
    id: 'audiobookshelf', name: 'Audiobookshelf',
    description: 'Self-hosted audiobook and podcast server',
    category: 'Media', icon: '📚',
    image: 'ghcr.io/advplyr/audiobookshelf:latest',
    ports: { 13378: 80 },
    volumes: {
      [`${BASE_DIR}/audiobookshelf/config`]: '/config',
      [`${BASE_DIR}/audiobookshelf/metadata`]: '/metadata',
      [D.audiobooks]: '/audiobooks',
      [D.books]: '/books',
    },
  },
  {
    id: 'tautulli', name: 'Tautulli',
    description: 'Plex monitoring and statistics',
    category: 'Media', icon: '📊',
    image: 'linuxserver/tautulli:latest',
    ports: { 8181: 8181 },
    volumes: { [`${BASE_DIR}/tautulli`]: '/config' },
    connectsTo: ['plex'],
  },
  {
    id: 'overseerr', name: 'Overseerr',
    description: 'Media request management for Plex',
    category: 'Media', icon: '🎥',
    image: 'linuxserver/overseerr:latest',
    ports: { 5055: 5055 },
    volumes: { [`${BASE_DIR}/overseerr`]: '/config' },
    connectsTo: ['plex', 'radarr', 'sonarr'],
  },
  {
    id: 'jellyseerr', name: 'Jellyseerr',
    description: 'Media request management for Jellyfin',
    category: 'Media', icon: '🎥',
    image: 'fallenbagel/jellyseerr:latest',
    ports: { 5056: 5055 },
    volumes: { [`${BASE_DIR}/jellyseerr`]: '/app/config' },
    connectsTo: ['jellyfin', 'radarr', 'sonarr'],
  },

  // ── Downloads ──────────────────────────────
  {
    id: 'qbittorrent', name: 'qBittorrent',
    description: 'BitTorrent client with web UI',
    category: 'Downloads', icon: '⬇️', stack: 'media-server',
    image: 'linuxserver/qbittorrent:latest',
    ports: { 8085: 8085, 6881: 6881 },
    volumes: {
      [`${BASE_DIR}/qbittorrent/config`]: '/config',
      [D.downloads]: '/downloads',
    },
    env: { WEBUI_PORT: '8085', PUID: '0', PGID: '0' },
    defaultLogin: { user: 'admin', pass: 'proxnest' },
  },
  {
    id: 'radarr', name: 'Radarr',
    description: 'Movie collection manager — auto-downloads movies',
    category: 'Downloads', icon: '🎬', stack: 'media-server',
    image: 'linuxserver/radarr:latest',
    ports: { 7878: 7878 },
    volumes: {
      [`${BASE_DIR}/radarr`]: '/config',
      [D.movies]: '/movies',
      [D.downloads]: '/downloads',
    },
    env: { PUID: '0', PGID: '0' },
    connectsTo: ['qbittorrent', 'prowlarr'],
  },
  {
    id: 'sonarr', name: 'Sonarr',
    description: 'TV series collection manager — auto-downloads episodes',
    category: 'Downloads', icon: '📺', stack: 'media-server',
    image: 'linuxserver/sonarr:latest',
    ports: { 8989: 8989 },
    volumes: {
      [`${BASE_DIR}/sonarr`]: '/config',
      [D.tv]: '/tv',
      [D.downloads]: '/downloads',
    },
    env: { PUID: '0', PGID: '0' },
    connectsTo: ['qbittorrent', 'prowlarr'],
  },
  {
    id: 'prowlarr', name: 'Prowlarr',
    description: 'Indexer manager — finds content for Radarr/Sonarr',
    category: 'Downloads', icon: '🔍', stack: 'media-server',
    image: 'linuxserver/prowlarr:latest',
    ports: { 9696: 9696 },
    volumes: { [`${BASE_DIR}/prowlarr`]: '/config' },
    env: { PUID: '0', PGID: '0' },
    connectsTo: ['radarr', 'sonarr'],
  },
  {
    id: 'bazarr', name: 'Bazarr',
    description: 'Automatic subtitle downloads for movies and TV',
    category: 'Downloads', icon: '💬', stack: 'media-server',
    image: 'linuxserver/bazarr:latest',
    ports: { 6767: 6767 },
    volumes: {
      [`${BASE_DIR}/bazarr`]: '/config',
      [D.movies]: '/movies',
      [D.tv]: '/tv',
    },
    env: { PUID: '0', PGID: '0' },
    connectsTo: ['radarr', 'sonarr'],
  },

  // ── Cloud ──────────────────────────────────
  {
    id: 'nextcloud', name: 'Nextcloud',
    description: 'Self-hosted file sync, calendar, contacts',
    category: 'Cloud', icon: '☁️', stack: 'cloud-suite',
    image: 'nextcloud:latest',
    ports: { 8080: 80 },
    volumes: { [`${BASE_DIR}/nextcloud`]: '/var/www/html' },
    defaultLogin: { user: 'admin', pass: 'proxnest' },
  },
  {
    id: 'immich', name: 'Immich',
    description: 'Google Photos alternative — photo and video backup',
    category: 'Cloud', icon: '📷', stack: 'cloud-suite',
    image: 'ghcr.io/immich-app/immich-server:latest',
    ports: { 2283: 2283 },
    volumes: {
      [`${BASE_DIR}/immich/upload`]: '/usr/src/app/upload',
      [D.photos]: '/usr/src/app/upload/library',
    },
  },
  {
    id: 'filebrowser', name: 'FileBrowser',
    description: 'Web-based file manager for your server',
    category: 'Cloud', icon: '📁',
    image: 'filebrowser/filebrowser:latest',
    ports: { 8090: 80 },
    volumes: {
      ['/data']: '/srv',
      [`${BASE_DIR}/filebrowser/db`]: '/database',
    },
    defaultLogin: { user: 'admin', pass: 'admin' },
  },
  {
    id: 'syncthing', name: 'Syncthing',
    description: 'Continuous peer-to-peer file synchronization',
    category: 'Cloud', icon: '🔄',
    image: 'linuxserver/syncthing:latest',
    ports: { 8384: 8384, 22000: 22000 },
    volumes: {
      [`${BASE_DIR}/syncthing/config`]: '/config',
      [`${BASE_DIR}/syncthing/data`]: '/data1',
    },
    env: { PUID: '0', PGID: '0' },
  },

  // ── Network ────────────────────────────────
  {
    id: 'pihole', name: 'Pi-hole',
    description: 'Network-wide ad blocking DNS server',
    category: 'Network', icon: '🛡️',
    image: 'pihole/pihole:latest',
    ports: { 8053: 80, 53: 53 },
    volumes: {
      [`${BASE_DIR}/pihole/etc`]: '/etc/pihole',
      [`${BASE_DIR}/pihole/dnsmasq`]: '/etc/dnsmasq.d',
    },
    env: { WEBPASSWORD: 'proxnest' },
    defaultLogin: { user: 'admin', pass: 'proxnest' },
  },
  {
    id: 'adguard', name: 'AdGuard Home',
    description: 'DNS ad blocker and privacy guard',
    category: 'Network', icon: '🛡️',
    image: 'adguard/adguardhome:latest',
    ports: { 3000: 3000 },
    volumes: {
      [`${BASE_DIR}/adguard/work`]: '/opt/adguardhome/work',
      [`${BASE_DIR}/adguard/conf`]: '/opt/adguardhome/conf',
    },
  },
  {
    id: 'nginx-proxy-manager', name: 'Nginx Proxy Manager',
    description: 'Easy reverse proxy with free SSL certificates',
    category: 'Network', icon: '🌐',
    image: 'jc21/nginx-proxy-manager:latest',
    ports: { 81: 81, 80: 80, 443: 443 },
    volumes: {
      [`${BASE_DIR}/npm/data`]: '/data',
      [`${BASE_DIR}/npm/letsencrypt`]: '/etc/letsencrypt',
    },
    defaultLogin: { user: 'admin@example.com', pass: 'changeme' },
  },
  {
    id: 'wireguard', name: 'WireGuard',
    description: 'Fast VPN — access your server from anywhere',
    category: 'Network', icon: '🔒',
    image: 'linuxserver/wireguard:latest',
    ports: { 51820: 51820 },
    volumes: { [`${BASE_DIR}/wireguard`]: '/config' },
    env: { SERVERURL: 'auto', PEERS: '3', PUID: '0', PGID: '0' },
  },

  // ── Monitoring ─────────────────────────────
  {
    id: 'grafana', name: 'Grafana',
    description: 'Beautiful dashboards for system monitoring',
    category: 'Monitoring', icon: '📈', stack: 'monitoring',
    image: 'grafana/grafana:latest',
    ports: { 3001: 3000 },
    volumes: { [`${BASE_DIR}/grafana`]: '/var/lib/grafana' },
    defaultLogin: { user: 'admin', pass: 'admin' },
  },
  {
    id: 'uptime-kuma', name: 'Uptime Kuma',
    description: 'Monitor your services and get alerts when they go down',
    category: 'Monitoring', icon: '💓', stack: 'monitoring',
    image: 'louislam/uptime-kuma:latest',
    ports: { 3002: 3001 },
    volumes: { [`${BASE_DIR}/uptime-kuma`]: '/app/data' },
  },
  {
    id: 'portainer', name: 'Portainer',
    description: 'Docker container management UI',
    category: 'Monitoring', icon: '🐳', stack: 'monitoring',
    image: 'portainer/portainer-ce:latest',
    ports: { 9443: 9443 },
    volumes: {
      [`${BASE_DIR}/portainer`]: '/data',
      '/var/run/docker.sock': '/var/run/docker.sock',
    },
  },
  {
    id: 'dozzle', name: 'Dozzle',
    description: 'Real-time Docker log viewer',
    category: 'Monitoring', icon: '📋', stack: 'monitoring',
    image: 'amir20/dozzle:latest',
    ports: { 8081: 8080 },
    volumes: { '/var/run/docker.sock': '/var/run/docker.sock' },
  },

  // ── Productivity ───────────────────────────
  {
    id: 'n8n', name: 'n8n',
    description: 'Workflow automation — connect your apps together',
    category: 'Automation', icon: '⚡',
    image: 'n8nio/n8n:latest',
    ports: { 5678: 5678 },
    volumes: { [`${BASE_DIR}/n8n`]: '/home/node/.n8n' },
  },
  {
    id: 'mealie', name: 'Mealie',
    description: 'Recipe manager and meal planner',
    category: 'Productivity', icon: '🍳',
    image: 'ghcr.io/mealie-recipes/mealie:latest',
    ports: { 9925: 9000 },
    volumes: { [`${BASE_DIR}/mealie`]: '/app/data' },
  },
  {
    id: 'paperless', name: 'Paperless-ngx',
    description: 'Scan and organize all your documents digitally',
    category: 'Productivity', icon: '📄', stack: 'cloud-suite',
    image: 'ghcr.io/paperless-ngx/paperless-ngx:latest',
    ports: { 8010: 8000 },
    volumes: {
      [`${BASE_DIR}/paperless/data`]: '/usr/src/paperless/data',
      [`${BASE_DIR}/paperless/media`]: '/usr/src/paperless/media',
      [`${BASE_DIR}/paperless/consume`]: '/usr/src/paperless/consume',
    },
    defaultLogin: { user: 'admin', pass: 'proxnest' },
  },
  {
    id: 'vaultwarden', name: 'Vaultwarden',
    description: 'Self-hosted password manager (Bitwarden compatible)',
    category: 'Productivity', icon: '🔐',
    image: 'vaultwarden/server:latest',
    ports: { 8222: 80 },
    volumes: { [`${BASE_DIR}/vaultwarden`]: '/data' },
  },
  {
    id: 'homepage', name: 'Homepage',
    description: 'Beautiful dashboard for all your services',
    category: 'Productivity', icon: '🏠',
    image: 'ghcr.io/gethomepage/homepage:latest',
    ports: { 3003: 3000 },
    volumes: {
      [`${BASE_DIR}/homepage/config`]: '/app/config',
      '/var/run/docker.sock': '/var/run/docker.sock',
    },
  },
  // ── Home Automation ─────────────────────
  {
    id: 'homeassistant', name: 'Home Assistant',
    description: 'Open-source home automation',
    category: 'Automation', icon: '🏠',
    image: 'ghcr.io/home-assistant/home-assistant:stable',
    ports: { 8123: 8123 },
    volumes: { [`${BASE_DIR}/homeassistant`]: '/config' },
    env: { TZ: 'America/New_York' },
  },
  {
    id: 'mosquitto', name: 'Mosquitto MQTT',
    description: 'Lightweight MQTT message broker',
    category: 'Automation', icon: '📡',
    image: 'eclipse-mosquitto:latest',
    ports: { 1883: 1883, 9001: 9001 },
    volumes: {
      [`${BASE_DIR}/mosquitto/config`]: '/mosquitto/config',
      [`${BASE_DIR}/mosquitto/data`]: '/mosquitto/data',
      [`${BASE_DIR}/mosquitto/log`]: '/mosquitto/log',
    },
  },
  {
    id: 'nodered', name: 'Node-RED',
    description: 'Flow-based programming for IoT automation',
    category: 'Automation', icon: '🔴',
    image: 'nodered/node-red:latest',
    ports: { 1880: 1880 },
    volumes: { [`${BASE_DIR}/nodered`]: '/data' },
  },
  // ── Developer Tools ─────────────────────
  {
    id: 'gitea', name: 'Gitea',
    description: 'Self-hosted Git service (lightweight GitHub)',
    category: 'Development', icon: '🐙',
    image: 'gitea/gitea:latest',
    ports: { 3001: 3000, 2222: 22 },
    volumes: { [`${BASE_DIR}/gitea`]: '/data' },
    env: { GITEA__database__DB_TYPE: 'sqlite3' },
  },
  {
    id: 'codeserver', name: 'VS Code Server',
    description: 'VS Code in your browser',
    category: 'Development', icon: '💻',
    image: 'linuxserver/code-server:latest',
    ports: { 8443: 8443 },
    volumes: { [`${BASE_DIR}/codeserver`]: '/config' },
    env: { PUID: '0', PGID: '0' },
    defaultLogin: { user: '', pass: 'proxnest' },
  },
  // ── More Media ──────────────────────────
  {
    id: 'tdarr', name: 'Tdarr',
    description: 'Media transcoding & health checking',
    category: 'Media', icon: '🎞️',
    image: 'ghcr.io/haveagitgat/tdarr:latest',
    ports: { 8265: 8265 },
    volumes: {
      [`${BASE_DIR}/tdarr/server`]: '/app/server',
      [`${BASE_DIR}/tdarr/configs`]: '/app/configs',
      [`${BASE_DIR}/tdarr/logs`]: '/app/logs',
      [D.media.movies]: '/media/movies',
      [D.media.tv]: '/media/tv',
    },
    env: { serverIP: '0.0.0.0', serverPort: '8266', webUIPort: '8265', internalNode: 'true' },
  },
  {
    id: 'calibre', name: 'Calibre-web',
    description: 'eBook library management',
    category: 'Media', icon: '📚',
    image: 'linuxserver/calibre-web:latest',
    ports: { 8083: 8083 },
    volumes: { [`${BASE_DIR}/calibre`]: '/config', [D.media.books]: '/books' },
    env: { PUID: '0', PGID: '0' },
    defaultLogin: { user: 'admin', pass: 'admin123' },
  },
];

/**
 * Look up an app config by ID.
 */
export function getAppConfig(appId: string): AppConfig | undefined {
  return APP_CATALOG.find(a => a.id === appId);
}

/**
 * Ensure shared media/download directories exist.
 * Called before any app install.
 */
export function ensureSharedDirs(): void {
  // Import is at top of file via static import
  for (const dir of Object.values(SHARED_DIRS)) {
    try { mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
  }
}
