/**
 * ProxNest Agent — App Catalog
 * Docker configurations for one-click app installs.
 */

export interface AppConfig {
  id: string;
  name: string;
  image: string;
  ports: Record<number, number>; // hostPort → containerPort
  volumes: Record<string, string>; // hostPath → containerPath
  env?: Record<string, string>;
}

const BASE_DIR = '/opt/proxnest-apps';

export const APP_CATALOG: AppConfig[] = [
  // ── Media ──────────────────────────────────
  {
    id: 'jellyfin', name: 'Jellyfin', image: 'jellyfin/jellyfin:latest',
    ports: { 8096: 8096 },
    volumes: { [`${BASE_DIR}/jellyfin/config`]: '/config', [`${BASE_DIR}/jellyfin/cache`]: '/cache' },
  },
  {
    id: 'plex', name: 'Plex', image: 'plexinc/pms-docker:latest',
    ports: { 32400: 32400 },
    volumes: { [`${BASE_DIR}/plex/config`]: '/config' },
  },
  {
    id: 'navidrome', name: 'Navidrome', image: 'deluan/navidrome:latest',
    ports: { 4533: 4533 },
    volumes: { [`${BASE_DIR}/navidrome/data`]: '/data', [`${BASE_DIR}/navidrome/music`]: '/music' },
  },
  {
    id: 'audiobookshelf', name: 'Audiobookshelf', image: 'ghcr.io/advplyr/audiobookshelf:latest',
    ports: { 13378: 80 },
    volumes: { [`${BASE_DIR}/audiobookshelf/config`]: '/config', [`${BASE_DIR}/audiobookshelf/metadata`]: '/metadata' },
  },
  {
    id: 'tautulli', name: 'Tautulli', image: 'linuxserver/tautulli:latest',
    ports: { 8181: 8181 },
    volumes: { [`${BASE_DIR}/tautulli`]: '/config' },
  },
  {
    id: 'overseerr', name: 'Overseerr', image: 'linuxserver/overseerr:latest',
    ports: { 5055: 5055 },
    volumes: { [`${BASE_DIR}/overseerr`]: '/config' },
  },
  {
    id: 'jellyseerr', name: 'Jellyseerr', image: 'fallenbagel/jellyseerr:latest',
    ports: { 5056: 5055 },
    volumes: { [`${BASE_DIR}/jellyseerr`]: '/app/config' },
  },

  // ── Downloads ──────────────────────────────
  {
    id: 'qbittorrent', name: 'qBittorrent', image: 'linuxserver/qbittorrent:latest',
    ports: { 8085: 8085, 6881: 6881 },
    volumes: { [`${BASE_DIR}/qbittorrent`]: '/config', [`${BASE_DIR}/qbittorrent/downloads`]: '/downloads' },
    env: { WEBUI_PORT: '8085' },
  },
  {
    id: 'radarr', name: 'Radarr', image: 'linuxserver/radarr:latest',
    ports: { 7878: 7878 },
    volumes: { [`${BASE_DIR}/radarr`]: '/config' },
  },
  {
    id: 'sonarr', name: 'Sonarr', image: 'linuxserver/sonarr:latest',
    ports: { 8989: 8989 },
    volumes: { [`${BASE_DIR}/sonarr`]: '/config' },
  },
  {
    id: 'prowlarr', name: 'Prowlarr', image: 'linuxserver/prowlarr:latest',
    ports: { 9696: 9696 },
    volumes: { [`${BASE_DIR}/prowlarr`]: '/config' },
  },
  {
    id: 'bazarr', name: 'Bazarr', image: 'linuxserver/bazarr:latest',
    ports: { 6767: 6767 },
    volumes: { [`${BASE_DIR}/bazarr`]: '/config' },
  },

  // ── Cloud ──────────────────────────────────
  {
    id: 'nextcloud', name: 'Nextcloud', image: 'nextcloud:latest',
    ports: { 8080: 80 },
    volumes: { [`${BASE_DIR}/nextcloud`]: '/var/www/html' },
  },
  {
    id: 'immich', name: 'Immich', image: 'ghcr.io/immich-app/immich-server:latest',
    ports: { 2283: 2283 },
    volumes: { [`${BASE_DIR}/immich/upload`]: '/usr/src/app/upload' },
  },
  {
    id: 'filebrowser', name: 'FileBrowser', image: 'filebrowser/filebrowser:latest',
    ports: { 8090: 80 },
    volumes: { [`${BASE_DIR}/filebrowser/data`]: '/srv', [`${BASE_DIR}/filebrowser/db`]: '/database' },
  },
  {
    id: 'syncthing', name: 'Syncthing', image: 'linuxserver/syncthing:latest',
    ports: { 8384: 8384, 22000: 22000 },
    volumes: { [`${BASE_DIR}/syncthing/config`]: '/config', [`${BASE_DIR}/syncthing/data`]: '/data1' },
  },

  // ── Network ────────────────────────────────
  {
    id: 'pihole', name: 'Pi-hole', image: 'pihole/pihole:latest',
    ports: { 8053: 80, 53: 53 },
    volumes: { [`${BASE_DIR}/pihole/etc`]: '/etc/pihole', [`${BASE_DIR}/pihole/dnsmasq`]: '/etc/dnsmasq.d' },
    env: { WEBPASSWORD: 'proxnest' },
  },
  {
    id: 'adguard', name: 'AdGuard Home', image: 'adguard/adguardhome:latest',
    ports: { 3000: 3000 },
    volumes: { [`${BASE_DIR}/adguard/work`]: '/opt/adguardhome/work', [`${BASE_DIR}/adguard/conf`]: '/opt/adguardhome/conf' },
  },
  {
    id: 'nginx-proxy-manager', name: 'Nginx Proxy Manager', image: 'jc21/nginx-proxy-manager:latest',
    ports: { 81: 81, 80: 80, 443: 443 },
    volumes: { [`${BASE_DIR}/npm/data`]: '/data', [`${BASE_DIR}/npm/letsencrypt`]: '/etc/letsencrypt' },
  },
  {
    id: 'wireguard', name: 'WireGuard', image: 'linuxserver/wireguard:latest',
    ports: { 51820: 51820 },
    volumes: { [`${BASE_DIR}/wireguard`]: '/config' },
    env: { SERVERURL: 'auto', PEERS: '3' },
  },

  // ── Monitoring ─────────────────────────────
  {
    id: 'grafana', name: 'Grafana', image: 'grafana/grafana:latest',
    ports: { 3001: 3000 },
    volumes: { [`${BASE_DIR}/grafana`]: '/var/lib/grafana' },
  },
  {
    id: 'uptime-kuma', name: 'Uptime Kuma', image: 'louislam/uptime-kuma:latest',
    ports: { 3002: 3001 },
    volumes: { [`${BASE_DIR}/uptime-kuma`]: '/app/data' },
  },
  {
    id: 'portainer', name: 'Portainer', image: 'portainer/portainer-ce:latest',
    ports: { 9443: 9443 },
    volumes: { [`${BASE_DIR}/portainer`]: '/data', '/var/run/docker.sock': '/var/run/docker.sock' },
  },
  {
    id: 'dozzle', name: 'Dozzle', image: 'amir20/dozzle:latest',
    ports: { 8081: 8080 },
    volumes: { '/var/run/docker.sock': '/var/run/docker.sock' },
  },

  // ── Productivity ───────────────────────────
  {
    id: 'n8n', name: 'n8n', image: 'n8nio/n8n:latest',
    ports: { 5678: 5678 },
    volumes: { [`${BASE_DIR}/n8n`]: '/home/node/.n8n' },
  },
  {
    id: 'mealie', name: 'Mealie', image: 'ghcr.io/mealie-recipes/mealie:latest',
    ports: { 9925: 9000 },
    volumes: { [`${BASE_DIR}/mealie`]: '/app/data' },
  },
  {
    id: 'paperless', name: 'Paperless-ngx', image: 'ghcr.io/paperless-ngx/paperless-ngx:latest',
    ports: { 8010: 8000 },
    volumes: { [`${BASE_DIR}/paperless/data`]: '/usr/src/paperless/data', [`${BASE_DIR}/paperless/media`]: '/usr/src/paperless/media' },
  },
];

/**
 * Look up an app config by ID.
 */
export function getAppConfig(appId: string): AppConfig | undefined {
  return APP_CATALOG.find(a => a.id === appId);
}
