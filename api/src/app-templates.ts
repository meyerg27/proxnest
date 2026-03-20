/**
 * App Store Templates
 * Pre-defined app configurations for one-click installs.
 * Categories: media, downloads, cloud, network, monitoring, development, home, security, productivity
 */

export interface AppTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'media' | 'downloads' | 'cloud' | 'network' | 'monitoring' | 'development' | 'home' | 'security' | 'productivity' | 'gaming' | 'communication';
  type: 'lxc' | 'docker';
  tags: string[];
  website: string;
  /** LXC config */
  lxc?: {
    ostemplate: string;
    cores: number;
    memory: number;   // MB
    swap: number;      // MB
    rootfs: number;    // GB
    features?: string;
    unprivileged?: boolean;
    startup_script?: string;
  };
  /** Docker config */
  docker?: {
    image: string;
    ports: Record<string, number>;
    volumes: Record<string, string>;
    environment?: Record<string, string>;
    compose?: string;
    capabilities?: string[];
    network_mode?: string;
    restart?: string;
  };
  /** Default web UI port for quick access link */
  webPort: number;
  /** Minimum resources */
  minResources?: {
    cores: number;
    memoryMB: number;
    diskGB: number;
  };
  /** Featured / promoted in UI */
  featured?: boolean;
}

export interface ComposeStack {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tags: string[];
  apps: string[]; // template IDs included
  compose: string;
  webPorts: Record<string, number>; // service -> port
}

// ─────────────────────────────────────────────────────
// App Templates
// ─────────────────────────────────────────────────────

export const APP_TEMPLATES: AppTemplate[] = [
  // ═══════════════════════════════════════════════════
  // MEDIA
  // ═══════════════════════════════════════════════════
  {
    id: 'plex',
    name: 'Plex Media Server',
    description: 'Stream your media library to any device. Movies, TV, music, photos.',
    icon: '🎬',
    category: 'media',
    type: 'docker',
    tags: ['media', 'streaming', 'movies', 'tv'],
    website: 'https://plex.tv',
    featured: true,
    docker: {
      image: 'lscr.io/linuxserver/plex:latest',
      ports: { '32400': 32400 },
      volumes: {
        '/config': '/opt/proxnest/apps/plex/config',
        '/media': '/mnt/media',
      },
      environment: {
        PUID: '1000',
        PGID: '1000',
        TZ: 'America/New_York',
        VERSION: 'docker',
      },
      restart: 'unless-stopped',
    },
    webPort: 32400,
    minResources: { cores: 2, memoryMB: 2048, diskGB: 10 },
  },
  {
    id: 'jellyfin',
    name: 'Jellyfin',
    description: 'Free and open-source media server. No subscriptions, no premium features.',
    icon: '🪼',
    category: 'media',
    type: 'docker',
    tags: ['media', 'streaming', 'open-source'],
    website: 'https://jellyfin.org',
    featured: true,
    docker: {
      image: 'jellyfin/jellyfin:latest',
      ports: { '8096': 8096 },
      volumes: {
        '/config': '/opt/proxnest/apps/jellyfin/config',
        '/cache': '/opt/proxnest/apps/jellyfin/cache',
        '/media': '/mnt/media',
      },
      restart: 'unless-stopped',
    },
    webPort: 8096,
    minResources: { cores: 2, memoryMB: 2048, diskGB: 8 },
  },
  {
    id: 'emby',
    name: 'Emby',
    description: 'Personal media server with live TV, DVR, and smart home integration.',
    icon: '📺',
    category: 'media',
    type: 'docker',
    tags: ['media', 'streaming', 'live-tv', 'dvr'],
    website: 'https://emby.media',
    docker: {
      image: 'lscr.io/linuxserver/emby:latest',
      ports: { '8096': 8096 },
      volumes: {
        '/config': '/opt/proxnest/apps/emby/config',
        '/media': '/mnt/media',
      },
      environment: { PUID: '1000', PGID: '1000', TZ: 'America/New_York' },
      restart: 'unless-stopped',
    },
    webPort: 8096,
    minResources: { cores: 2, memoryMB: 2048, diskGB: 8 },
  },
  {
    id: 'sonarr',
    name: 'Sonarr',
    description: 'Smart TV show management. Automatic downloads, renaming, and organization.',
    icon: '📡',
    category: 'media',
    type: 'docker',
    tags: ['media', 'tv', 'pvr', 'automation', 'arr'],
    website: 'https://sonarr.tv',
    docker: {
      image: 'lscr.io/linuxserver/sonarr:latest',
      ports: { '8989': 8989 },
      volumes: {
        '/config': '/opt/proxnest/apps/sonarr/config',
        '/downloads': '/mnt/downloads',
        '/tv': '/mnt/media/tv',
      },
      environment: { PUID: '1000', PGID: '1000', TZ: 'America/New_York' },
      restart: 'unless-stopped',
    },
    webPort: 8989,
    minResources: { cores: 1, memoryMB: 512, diskGB: 2 },
  },
  {
    id: 'radarr',
    name: 'Radarr',
    description: 'Movie collection manager. Automated downloading and organization.',
    icon: '🎥',
    category: 'media',
    type: 'docker',
    tags: ['media', 'movies', 'pvr', 'automation', 'arr'],
    website: 'https://radarr.video',
    docker: {
      image: 'lscr.io/linuxserver/radarr:latest',
      ports: { '7878': 7878 },
      volumes: {
        '/config': '/opt/proxnest/apps/radarr/config',
        '/downloads': '/mnt/downloads',
        '/movies': '/mnt/media/movies',
      },
      environment: { PUID: '1000', PGID: '1000', TZ: 'America/New_York' },
      restart: 'unless-stopped',
    },
    webPort: 7878,
    minResources: { cores: 1, memoryMB: 512, diskGB: 2 },
  },
  {
    id: 'bazarr',
    name: 'Bazarr',
    description: 'Automatic subtitle downloading for Sonarr and Radarr.',
    icon: '💬',
    category: 'media',
    type: 'docker',
    tags: ['media', 'subtitles', 'automation', 'arr'],
    website: 'https://www.bazarr.media',
    docker: {
      image: 'lscr.io/linuxserver/bazarr:latest',
      ports: { '6767': 6767 },
      volumes: {
        '/config': '/opt/proxnest/apps/bazarr/config',
        '/movies': '/mnt/media/movies',
        '/tv': '/mnt/media/tv',
      },
      environment: { PUID: '1000', PGID: '1000', TZ: 'America/New_York' },
      restart: 'unless-stopped',
    },
    webPort: 6767,
    minResources: { cores: 1, memoryMB: 256, diskGB: 1 },
  },
  {
    id: 'lidarr',
    name: 'Lidarr',
    description: 'Music collection manager. Like Sonarr but for music.',
    icon: '🎵',
    category: 'media',
    type: 'docker',
    tags: ['media', 'music', 'automation', 'arr'],
    website: 'https://lidarr.audio',
    docker: {
      image: 'lscr.io/linuxserver/lidarr:latest',
      ports: { '8686': 8686 },
      volumes: {
        '/config': '/opt/proxnest/apps/lidarr/config',
        '/downloads': '/mnt/downloads',
        '/music': '/mnt/media/music',
      },
      environment: { PUID: '1000', PGID: '1000', TZ: 'America/New_York' },
      restart: 'unless-stopped',
    },
    webPort: 8686,
    minResources: { cores: 1, memoryMB: 512, diskGB: 2 },
  },
  {
    id: 'readarr',
    name: 'Readarr',
    description: 'Book and audiobook collection manager for ebook and audiobook enthusiasts.',
    icon: '📚',
    category: 'media',
    type: 'docker',
    tags: ['media', 'books', 'audiobooks', 'automation', 'arr'],
    website: 'https://readarr.com',
    docker: {
      image: 'lscr.io/linuxserver/readarr:develop',
      ports: { '8787': 8787 },
      volumes: {
        '/config': '/opt/proxnest/apps/readarr/config',
        '/downloads': '/mnt/downloads',
        '/books': '/mnt/media/books',
      },
      environment: { PUID: '1000', PGID: '1000', TZ: 'America/New_York' },
      restart: 'unless-stopped',
    },
    webPort: 8787,
    minResources: { cores: 1, memoryMB: 512, diskGB: 2 },
  },
  {
    id: 'overseerr',
    name: 'Overseerr',
    description: 'Media request management for Plex. Let users request movies and TV shows.',
    icon: '🎫',
    category: 'media',
    type: 'docker',
    tags: ['media', 'requests', 'plex', 'automation'],
    website: 'https://overseerr.dev',
    docker: {
      image: 'lscr.io/linuxserver/overseerr:latest',
      ports: { '5055': 5055 },
      volumes: {
        '/config': '/opt/proxnest/apps/overseerr/config',
      },
      environment: { PUID: '1000', PGID: '1000', TZ: 'America/New_York' },
      restart: 'unless-stopped',
    },
    webPort: 5055,
    minResources: { cores: 1, memoryMB: 256, diskGB: 1 },
  },
  {
    id: 'tautulli',
    name: 'Tautulli',
    description: 'Plex monitoring and tracking. See who\'s watching, history, and stats.',
    icon: '📊',
    category: 'media',
    type: 'docker',
    tags: ['media', 'plex', 'monitoring', 'stats'],
    website: 'https://tautulli.com',
    docker: {
      image: 'lscr.io/linuxserver/tautulli:latest',
      ports: { '8181': 8181 },
      volumes: {
        '/config': '/opt/proxnest/apps/tautulli/config',
      },
      environment: { PUID: '1000', PGID: '1000', TZ: 'America/New_York' },
      restart: 'unless-stopped',
    },
    webPort: 8181,
    minResources: { cores: 1, memoryMB: 256, diskGB: 1 },
  },
  {
    id: 'audiobookshelf',
    name: 'Audiobookshelf',
    description: 'Self-hosted audiobook and podcast server with mobile apps.',
    icon: '🎧',
    category: 'media',
    type: 'docker',
    tags: ['media', 'audiobooks', 'podcasts', 'streaming'],
    website: 'https://www.audiobookshelf.org',
    docker: {
      image: 'ghcr.io/advplyr/audiobookshelf:latest',
      ports: { '13378': 13378 },
      volumes: {
        '/config': '/opt/proxnest/apps/audiobookshelf/config',
        '/metadata': '/opt/proxnest/apps/audiobookshelf/metadata',
        '/audiobooks': '/mnt/media/audiobooks',
        '/podcasts': '/mnt/media/podcasts',
      },
      restart: 'unless-stopped',
    },
    webPort: 13378,
    minResources: { cores: 1, memoryMB: 256, diskGB: 2 },
  },

  // ═══════════════════════════════════════════════════
  // DOWNLOADS
  // ═══════════════════════════════════════════════════
  {
    id: 'qbittorrent',
    name: 'qBittorrent',
    description: 'Lightweight and feature-rich BitTorrent client with web UI.',
    icon: '⬇️',
    category: 'downloads',
    type: 'docker',
    tags: ['downloads', 'torrent', 'bittorrent'],
    website: 'https://www.qbittorrent.org',
    docker: {
      image: 'lscr.io/linuxserver/qbittorrent:latest',
      ports: { '8080': 8080, '6881': 6881 },
      volumes: {
        '/config': '/opt/proxnest/apps/qbittorrent/config',
        '/downloads': '/mnt/downloads',
      },
      environment: { PUID: '1000', PGID: '1000', TZ: 'America/New_York', WEBUI_PORT: '8080' },
      restart: 'unless-stopped',
    },
    webPort: 8080,
    minResources: { cores: 1, memoryMB: 512, diskGB: 2 },
  },
  {
    id: 'transmission',
    name: 'Transmission',
    description: 'Simple, lightweight BitTorrent client with clean web interface.',
    icon: '🔽',
    category: 'downloads',
    type: 'docker',
    tags: ['downloads', 'torrent', 'bittorrent', 'lightweight'],
    website: 'https://transmissionbt.com',
    docker: {
      image: 'lscr.io/linuxserver/transmission:latest',
      ports: { '9091': 9091, '51413': 51413 },
      volumes: {
        '/config': '/opt/proxnest/apps/transmission/config',
        '/downloads': '/mnt/downloads',
      },
      environment: { PUID: '1000', PGID: '1000', TZ: 'America/New_York' },
      restart: 'unless-stopped',
    },
    webPort: 9091,
    minResources: { cores: 1, memoryMB: 256, diskGB: 1 },
  },
  {
    id: 'sabnzbd',
    name: 'SABnzbd',
    description: 'The automated Usenet download tool. Simple, reliable, fast.',
    icon: '📥',
    category: 'downloads',
    type: 'docker',
    tags: ['downloads', 'usenet', 'nzb'],
    website: 'https://sabnzbd.org',
    docker: {
      image: 'lscr.io/linuxserver/sabnzbd:latest',
      ports: { '8080': 8081 },
      volumes: {
        '/config': '/opt/proxnest/apps/sabnzbd/config',
        '/downloads': '/mnt/downloads',
      },
      environment: { PUID: '1000', PGID: '1000', TZ: 'America/New_York' },
      restart: 'unless-stopped',
    },
    webPort: 8081,
    minResources: { cores: 1, memoryMB: 512, diskGB: 2 },
  },
  {
    id: 'nzbget',
    name: 'NZBGet',
    description: 'Efficient Usenet downloader written in C++ for maximum performance.',
    icon: '📦',
    category: 'downloads',
    type: 'docker',
    tags: ['downloads', 'usenet', 'nzb', 'performance'],
    website: 'https://nzbget.com',
    docker: {
      image: 'lscr.io/linuxserver/nzbget:latest',
      ports: { '6789': 6789 },
      volumes: {
        '/config': '/opt/proxnest/apps/nzbget/config',
        '/downloads': '/mnt/downloads',
      },
      environment: { PUID: '1000', PGID: '1000', TZ: 'America/New_York' },
      restart: 'unless-stopped',
    },
    webPort: 6789,
    minResources: { cores: 1, memoryMB: 256, diskGB: 1 },
  },
  {
    id: 'prowlarr',
    name: 'Prowlarr',
    description: 'Indexer manager for Sonarr, Radarr, and other apps. One place for all your indexers.',
    icon: '🔍',
    category: 'downloads',
    type: 'docker',
    tags: ['downloads', 'indexer', 'automation', 'arr'],
    website: 'https://prowlarr.com',
    docker: {
      image: 'lscr.io/linuxserver/prowlarr:latest',
      ports: { '9696': 9696 },
      volumes: {
        '/config': '/opt/proxnest/apps/prowlarr/config',
      },
      environment: { PUID: '1000', PGID: '1000', TZ: 'America/New_York' },
      restart: 'unless-stopped',
    },
    webPort: 9696,
    minResources: { cores: 1, memoryMB: 256, diskGB: 1 },
  },
  {
    id: 'flaresolverr',
    name: 'FlareSolverr',
    description: 'Proxy server to bypass Cloudflare protection. Used by Prowlarr and Jackett.',
    icon: '🔓',
    category: 'downloads',
    type: 'docker',
    tags: ['downloads', 'proxy', 'cloudflare', 'automation'],
    website: 'https://github.com/FlareSolverr/FlareSolverr',
    docker: {
      image: 'ghcr.io/flaresolverr/flaresolverr:latest',
      ports: { '8191': 8191 },
      volumes: {},
      environment: { TZ: 'America/New_York', LOG_LEVEL: 'info' },
      restart: 'unless-stopped',
    },
    webPort: 8191,
    minResources: { cores: 1, memoryMB: 512, diskGB: 1 },
  },

  // ═══════════════════════════════════════════════════
  // CLOUD & STORAGE
  // ═══════════════════════════════════════════════════
  {
    id: 'nextcloud',
    name: 'Nextcloud',
    description: 'Self-hosted cloud storage, calendar, contacts, and collaboration platform.',
    icon: '☁️',
    category: 'cloud',
    type: 'lxc',
    tags: ['cloud', 'storage', 'office', 'collaboration'],
    website: 'https://nextcloud.com',
    featured: true,
    lxc: {
      ostemplate: 'local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst',
      cores: 2,
      memory: 2048,
      swap: 512,
      rootfs: 16,
      unprivileged: true,
      startup_script: `#!/bin/bash
set -e
apt-get update
apt-get install -y apache2 mariadb-server php php-gd php-mysql php-curl php-mbstring php-intl php-gmp php-bcmath php-xml php-imagick php-zip libapache2-mod-php unzip
cd /var/www
wget -q https://download.nextcloud.com/server/releases/latest.tar.bz2
tar xjf latest.tar.bz2
chown -R www-data:www-data nextcloud
rm latest.tar.bz2
a2enmod rewrite headers env dir mime
systemctl restart apache2
echo "Nextcloud installed. Visit http://YOUR_IP/nextcloud to complete setup."`,
    },
    webPort: 80,
    minResources: { cores: 2, memoryMB: 2048, diskGB: 16 },
  },
  {
    id: 'immich',
    name: 'Immich',
    description: 'High-performance self-hosted photo and video management. Google Photos alternative.',
    icon: '📸',
    category: 'cloud',
    type: 'docker',
    tags: ['cloud', 'photos', 'backup', 'ai'],
    website: 'https://immich.app',
    featured: true,
    docker: {
      image: 'ghcr.io/immich-app/immich-server:release',
      ports: { '2283': 2283 },
      volumes: {
        '/upload': '/opt/proxnest/apps/immich/upload',
      },
      compose: `version: "3.8"
services:
  immich-server:
    image: ghcr.io/immich-app/immich-server:release
    ports:
      - "2283:2283"
    volumes:
      - /opt/proxnest/apps/immich/upload:/usr/src/app/upload
    environment:
      - DB_HOSTNAME=immich-postgres
      - DB_USERNAME=postgres
      - DB_PASSWORD=postgres
      - DB_DATABASE_NAME=immich
      - REDIS_HOSTNAME=immich-redis
    depends_on:
      - immich-redis
      - immich-postgres
    restart: unless-stopped
  immich-redis:
    image: redis:7-alpine
    restart: unless-stopped
  immich-postgres:
    image: tensorchord/pgvecto-rs:pg16-v0.2.1
    environment:
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_USER=postgres
      - POSTGRES_DB=immich
    volumes:
      - /opt/proxnest/apps/immich/pgdata:/var/lib/postgresql/data
    restart: unless-stopped`,
    },
    webPort: 2283,
    minResources: { cores: 2, memoryMB: 4096, diskGB: 20 },
  },
  {
    id: 'syncthing',
    name: 'Syncthing',
    description: 'Continuous file synchronization. Peer-to-peer, no cloud required.',
    icon: '🔄',
    category: 'cloud',
    type: 'docker',
    tags: ['cloud', 'sync', 'backup', 'p2p'],
    website: 'https://syncthing.net',
    docker: {
      image: 'lscr.io/linuxserver/syncthing:latest',
      ports: { '8384': 8384, '22000': 22000 },
      volumes: {
        '/config': '/opt/proxnest/apps/syncthing/config',
        '/data': '/opt/proxnest/apps/syncthing/data',
      },
      environment: { PUID: '1000', PGID: '1000', TZ: 'America/New_York' },
      restart: 'unless-stopped',
    },
    webPort: 8384,
    minResources: { cores: 1, memoryMB: 256, diskGB: 2 },
  },
  {
    id: 'filebrowser',
    name: 'File Browser',
    description: 'Web-based file manager. Upload, download, organize, and share files.',
    icon: '📁',
    category: 'cloud',
    type: 'docker',
    tags: ['cloud', 'files', 'storage', 'sharing'],
    website: 'https://filebrowser.org',
    docker: {
      image: 'filebrowser/filebrowser:latest',
      ports: { '80': 8082 },
      volumes: {
        '/srv': '/mnt/storage',
        '/database/filebrowser.db': '/opt/proxnest/apps/filebrowser/filebrowser.db',
      },
      restart: 'unless-stopped',
    },
    webPort: 8082,
    minResources: { cores: 1, memoryMB: 128, diskGB: 1 },
  },
  {
    id: 'minio',
    name: 'MinIO',
    description: 'S3-compatible object storage server. High performance, Kubernetes native.',
    icon: '🪣',
    category: 'cloud',
    type: 'docker',
    tags: ['cloud', 'storage', 's3', 'object-storage'],
    website: 'https://min.io',
    docker: {
      image: 'minio/minio:latest',
      ports: { '9000': 9000, '9001': 9001 },
      volumes: {
        '/data': '/opt/proxnest/apps/minio/data',
      },
      environment: {
        MINIO_ROOT_USER: 'admin',
        MINIO_ROOT_PASSWORD: 'changeme123',
      },
      restart: 'unless-stopped',
    },
    webPort: 9001,
    minResources: { cores: 2, memoryMB: 512, diskGB: 10 },
  },

  // ═══════════════════════════════════════════════════
  // NETWORK
  // ═══════════════════════════════════════════════════
  {
    id: 'pihole',
    name: 'Pi-hole',
    description: 'Network-wide ad blocking. DNS sinkhole that protects all your devices.',
    icon: '🛡️',
    category: 'network',
    type: 'lxc',
    tags: ['network', 'dns', 'adblock', 'privacy'],
    website: 'https://pi-hole.net',
    featured: true,
    lxc: {
      ostemplate: 'local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst',
      cores: 1,
      memory: 512,
      swap: 256,
      rootfs: 4,
      unprivileged: true,
      startup_script: `#!/bin/bash
set -e
apt-get update && apt-get install -y curl
curl -sSL https://install.pi-hole.net | bash /dev/stdin --unattended`,
    },
    webPort: 80,
    minResources: { cores: 1, memoryMB: 512, diskGB: 4 },
  },
  {
    id: 'adguard-home',
    name: 'AdGuard Home',
    description: 'Network-wide ad and tracker blocking DNS server with modern UI.',
    icon: '🚫',
    category: 'network',
    type: 'docker',
    tags: ['network', 'dns', 'adblock', 'privacy'],
    website: 'https://adguard.com/adguard-home.html',
    docker: {
      image: 'adguard/adguardhome:latest',
      ports: { '3000': 3000, '53': 53 },
      volumes: {
        '/opt/adguardhome/work': '/opt/proxnest/apps/adguard/work',
        '/opt/adguardhome/conf': '/opt/proxnest/apps/adguard/conf',
      },
      restart: 'unless-stopped',
    },
    webPort: 3000,
    minResources: { cores: 1, memoryMB: 256, diskGB: 2 },
  },
  {
    id: 'tailscale',
    name: 'Tailscale',
    description: 'Zero-config VPN built on WireGuard. Connect your devices securely.',
    icon: '🌐',
    category: 'network',
    type: 'docker',
    tags: ['network', 'vpn', 'wireguard', 'mesh'],
    website: 'https://tailscale.com',
    docker: {
      image: 'tailscale/tailscale:latest',
      ports: {},
      volumes: {
        '/var/lib/tailscale': '/opt/proxnest/apps/tailscale/state',
      },
      environment: {
        TS_AUTHKEY: '',
        TS_STATE_DIR: '/var/lib/tailscale',
      },
      capabilities: ['NET_ADMIN', 'NET_RAW'],
      restart: 'unless-stopped',
    },
    webPort: 0,
    minResources: { cores: 1, memoryMB: 128, diskGB: 1 },
  },
  {
    id: 'wireguard',
    name: 'WireGuard',
    description: 'Fast, modern VPN tunnel. Simple, fast, and lean.',
    icon: '🔒',
    category: 'network',
    type: 'docker',
    tags: ['network', 'vpn', 'wireguard', 'tunnel'],
    website: 'https://www.wireguard.com',
    docker: {
      image: 'lscr.io/linuxserver/wireguard:latest',
      ports: { '51820': 51820 },
      volumes: {
        '/config': '/opt/proxnest/apps/wireguard/config',
      },
      environment: {
        PUID: '1000',
        PGID: '1000',
        TZ: 'America/New_York',
        SERVERURL: 'auto',
        PEERS: '3',
      },
      capabilities: ['NET_ADMIN', 'SYS_MODULE'],
      restart: 'unless-stopped',
    },
    webPort: 0,
    minResources: { cores: 1, memoryMB: 128, diskGB: 1 },
  },
  {
    id: 'nginx-proxy-manager',
    name: 'Nginx Proxy Manager',
    description: 'Easy reverse proxy with free SSL certificates. Beautiful web UI.',
    icon: '🔀',
    category: 'network',
    type: 'docker',
    tags: ['network', 'proxy', 'ssl', 'reverse-proxy'],
    website: 'https://nginxproxymanager.com',
    featured: true,
    docker: {
      image: 'jc21/nginx-proxy-manager:latest',
      ports: { '80': 80, '443': 443, '81': 81 },
      volumes: {
        '/data': '/opt/proxnest/apps/npm/data',
        '/etc/letsencrypt': '/opt/proxnest/apps/npm/letsencrypt',
      },
      restart: 'unless-stopped',
    },
    webPort: 81,
    minResources: { cores: 1, memoryMB: 256, diskGB: 2 },
  },
  {
    id: 'traefik',
    name: 'Traefik',
    description: 'Cloud-native reverse proxy and load balancer. Auto-discovery, auto-SSL.',
    icon: '🚦',
    category: 'network',
    type: 'docker',
    tags: ['network', 'proxy', 'load-balancer', 'cloud-native'],
    website: 'https://traefik.io',
    docker: {
      image: 'traefik:v3.0',
      ports: { '80': 80, '443': 443, '8080': 8083 },
      volumes: {
        '/var/run/docker.sock': '/var/run/docker.sock',
        '/etc/traefik': '/opt/proxnest/apps/traefik/config',
        '/letsencrypt': '/opt/proxnest/apps/traefik/letsencrypt',
      },
      restart: 'unless-stopped',
    },
    webPort: 8083,
    minResources: { cores: 1, memoryMB: 256, diskGB: 1 },
  },
  {
    id: 'cloudflared',
    name: 'Cloudflare Tunnel',
    description: 'Expose local services securely without port forwarding. Zero Trust access.',
    icon: '🌩️',
    category: 'network',
    type: 'docker',
    tags: ['network', 'tunnel', 'cloudflare', 'zero-trust'],
    website: 'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/',
    docker: {
      image: 'cloudflare/cloudflared:latest',
      ports: {},
      volumes: {},
      environment: {
        TUNNEL_TOKEN: '',
      },
      restart: 'unless-stopped',
    },
    webPort: 0,
    minResources: { cores: 1, memoryMB: 128, diskGB: 1 },
  },

  // ═══════════════════════════════════════════════════
  // MONITORING
  // ═══════════════════════════════════════════════════
  {
    id: 'uptime-kuma',
    name: 'Uptime Kuma',
    description: 'Self-hosted monitoring tool. Beautiful status pages and alerting.',
    icon: '📊',
    category: 'monitoring',
    type: 'docker',
    tags: ['monitoring', 'uptime', 'status', 'alerts'],
    website: 'https://uptime.kuma.pet',
    featured: true,
    docker: {
      image: 'louislam/uptime-kuma:latest',
      ports: { '3001': 3001 },
      volumes: {
        '/app/data': '/opt/proxnest/apps/uptime-kuma/data',
      },
      restart: 'unless-stopped',
    },
    webPort: 3001,
    minResources: { cores: 1, memoryMB: 256, diskGB: 2 },
  },
  {
    id: 'grafana',
    name: 'Grafana',
    description: 'Beautiful dashboards for your data. Visualize metrics from any source.',
    icon: '📈',
    category: 'monitoring',
    type: 'docker',
    tags: ['monitoring', 'visualization', 'dashboards', 'metrics'],
    website: 'https://grafana.com',
    docker: {
      image: 'grafana/grafana-oss:latest',
      ports: { '3000': 3002 },
      volumes: {
        '/var/lib/grafana': '/opt/proxnest/apps/grafana/data',
      },
      restart: 'unless-stopped',
    },
    webPort: 3002,
    minResources: { cores: 1, memoryMB: 256, diskGB: 2 },
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    description: 'Monitoring system and time series database. Pull-based metrics collection.',
    icon: '🔥',
    category: 'monitoring',
    type: 'docker',
    tags: ['monitoring', 'metrics', 'time-series', 'alerting'],
    website: 'https://prometheus.io',
    docker: {
      image: 'prom/prometheus:latest',
      ports: { '9090': 9090 },
      volumes: {
        '/etc/prometheus': '/opt/proxnest/apps/prometheus/config',
        '/prometheus': '/opt/proxnest/apps/prometheus/data',
      },
      restart: 'unless-stopped',
    },
    webPort: 9090,
    minResources: { cores: 1, memoryMB: 512, diskGB: 5 },
  },
  {
    id: 'netdata',
    name: 'Netdata',
    description: 'Real-time performance and health monitoring for systems and applications.',
    icon: '💚',
    category: 'monitoring',
    type: 'docker',
    tags: ['monitoring', 'real-time', 'performance', 'system'],
    website: 'https://www.netdata.cloud',
    docker: {
      image: 'netdata/netdata:stable',
      ports: { '19999': 19999 },
      volumes: {
        '/etc/netdata': '/opt/proxnest/apps/netdata/config',
        '/var/lib/netdata': '/opt/proxnest/apps/netdata/data',
        '/proc': '/host/proc:ro',
        '/sys': '/host/sys:ro',
      },
      capabilities: ['SYS_PTRACE'],
      restart: 'unless-stopped',
    },
    webPort: 19999,
    minResources: { cores: 1, memoryMB: 256, diskGB: 2 },
  },
  {
    id: 'dozzle',
    name: 'Dozzle',
    description: 'Real-time Docker log viewer. Lightweight, no database, just logs.',
    icon: '📜',
    category: 'monitoring',
    type: 'docker',
    tags: ['monitoring', 'logs', 'docker', 'real-time'],
    website: 'https://dozzle.dev',
    docker: {
      image: 'amir20/dozzle:latest',
      ports: { '8080': 8084 },
      volumes: {
        '/var/run/docker.sock': '/var/run/docker.sock',
      },
      restart: 'unless-stopped',
    },
    webPort: 8084,
    minResources: { cores: 1, memoryMB: 128, diskGB: 1 },
  },

  // ═══════════════════════════════════════════════════
  // DEVELOPMENT
  // ═══════════════════════════════════════════════════
  {
    id: 'gitea',
    name: 'Gitea',
    description: 'Lightweight self-hosted Git service. Like GitHub, but yours.',
    icon: '🍵',
    category: 'development',
    type: 'docker',
    tags: ['development', 'git', 'ci-cd', 'code'],
    website: 'https://about.gitea.com',
    docker: {
      image: 'gitea/gitea:latest',
      ports: { '3000': 3003, '22': 2222 },
      volumes: {
        '/data': '/opt/proxnest/apps/gitea/data',
      },
      environment: {
        USER_UID: '1000',
        USER_GID: '1000',
        GITEA__database__DB_TYPE: 'sqlite3',
      },
      restart: 'unless-stopped',
    },
    webPort: 3003,
    minResources: { cores: 1, memoryMB: 512, diskGB: 5 },
  },
  {
    id: 'code-server',
    name: 'Code Server',
    description: 'VS Code in the browser. Code from anywhere on any device.',
    icon: '💻',
    category: 'development',
    type: 'docker',
    tags: ['development', 'ide', 'vscode', 'code'],
    website: 'https://coder.com',
    docker: {
      image: 'lscr.io/linuxserver/code-server:latest',
      ports: { '8443': 8443 },
      volumes: {
        '/config': '/opt/proxnest/apps/code-server/config',
        '/workspace': '/opt/proxnest/apps/code-server/workspace',
      },
      environment: { PUID: '1000', PGID: '1000', TZ: 'America/New_York' },
      restart: 'unless-stopped',
    },
    webPort: 8443,
    minResources: { cores: 2, memoryMB: 1024, diskGB: 5 },
  },
  {
    id: 'portainer',
    name: 'Portainer',
    description: 'Container management made easy. Full Docker and Kubernetes UI.',
    icon: '🐳',
    category: 'development',
    type: 'docker',
    tags: ['development', 'docker', 'containers', 'management'],
    website: 'https://www.portainer.io',
    featured: true,
    docker: {
      image: 'portainer/portainer-ce:latest',
      ports: { '9443': 9443, '8000': 8085 },
      volumes: {
        '/data': '/opt/proxnest/apps/portainer/data',
        '/var/run/docker.sock': '/var/run/docker.sock',
      },
      restart: 'unless-stopped',
    },
    webPort: 9443,
    minResources: { cores: 1, memoryMB: 256, diskGB: 2 },
  },
  {
    id: 'drone',
    name: 'Woodpecker CI',
    description: 'Lightweight CI/CD engine. Community fork of Drone, simple and powerful.',
    icon: '🪵',
    category: 'development',
    type: 'docker',
    tags: ['development', 'ci-cd', 'automation', 'pipelines'],
    website: 'https://woodpecker-ci.org',
    docker: {
      image: 'woodpeckerci/woodpecker-server:latest',
      ports: { '8000': 8086 },
      volumes: {
        '/var/lib/woodpecker': '/opt/proxnest/apps/woodpecker/data',
      },
      environment: {
        WOODPECKER_OPEN: 'true',
        WOODPECKER_HOST: 'http://localhost:8086',
        WOODPECKER_ADMIN: 'admin',
      },
      restart: 'unless-stopped',
    },
    webPort: 8086,
    minResources: { cores: 1, memoryMB: 512, diskGB: 5 },
  },

  // ═══════════════════════════════════════════════════
  // HOME
  // ═══════════════════════════════════════════════════
  {
    id: 'home-assistant',
    name: 'Home Assistant',
    description: 'Open-source home automation. Control everything in your smart home.',
    icon: '🏠',
    category: 'home',
    type: 'docker',
    tags: ['home', 'automation', 'iot', 'smart-home'],
    website: 'https://home-assistant.io',
    featured: true,
    docker: {
      image: 'ghcr.io/home-assistant/home-assistant:stable',
      ports: { '8123': 8123 },
      volumes: {
        '/config': '/opt/proxnest/apps/homeassistant/config',
      },
      environment: { TZ: 'America/New_York' },
      restart: 'unless-stopped',
    },
    webPort: 8123,
    minResources: { cores: 2, memoryMB: 1024, diskGB: 8 },
  },
  {
    id: 'homepage',
    name: 'Homepage',
    description: 'A modern, fully static, fast, secure, highly customizable application dashboard.',
    icon: '🏡',
    category: 'home',
    type: 'docker',
    tags: ['home', 'dashboard', 'startpage'],
    website: 'https://gethomepage.dev',
    docker: {
      image: 'ghcr.io/gethomepage/homepage:latest',
      ports: { '3000': 3004 },
      volumes: {
        '/app/config': '/opt/proxnest/apps/homepage/config',
      },
      restart: 'unless-stopped',
    },
    webPort: 3004,
    minResources: { cores: 1, memoryMB: 128, diskGB: 1 },
  },
  {
    id: 'homarr',
    name: 'Homarr',
    description: 'Sleek, modern dashboard for your server. Integrates with 50+ services.',
    icon: '🎯',
    category: 'home',
    type: 'docker',
    tags: ['home', 'dashboard', 'startpage', 'integrations'],
    website: 'https://homarr.dev',
    docker: {
      image: 'ghcr.io/homarr-labs/homarr:latest',
      ports: { '7575': 7575 },
      volumes: {
        '/appdata': '/opt/proxnest/apps/homarr/data',
      },
      restart: 'unless-stopped',
    },
    webPort: 7575,
    minResources: { cores: 1, memoryMB: 256, diskGB: 1 },
  },
  {
    id: 'changedetection',
    name: 'changedetection.io',
    description: 'Website change detection and notification. Monitor any web page.',
    icon: '👁️',
    category: 'home',
    type: 'docker',
    tags: ['home', 'monitoring', 'web', 'notifications'],
    website: 'https://changedetection.io',
    docker: {
      image: 'ghcr.io/dgtlmoon/changedetection.io:latest',
      ports: { '5000': 5000 },
      volumes: {
        '/datastore': '/opt/proxnest/apps/changedetection/data',
      },
      restart: 'unless-stopped',
    },
    webPort: 5000,
    minResources: { cores: 1, memoryMB: 256, diskGB: 2 },
  },

  // ═══════════════════════════════════════════════════
  // SECURITY
  // ═══════════════════════════════════════════════════
  {
    id: 'vaultwarden',
    name: 'Vaultwarden',
    description: 'Bitwarden-compatible password manager. Lightweight Rust implementation.',
    icon: '🔐',
    category: 'security',
    type: 'docker',
    tags: ['security', 'passwords', 'bitwarden', 'vault'],
    website: 'https://github.com/dani-garcia/vaultwarden',
    featured: true,
    docker: {
      image: 'vaultwarden/server:latest',
      ports: { '80': 8087 },
      volumes: {
        '/data': '/opt/proxnest/apps/vaultwarden/data',
      },
      environment: {
        SIGNUPS_ALLOWED: 'true',
        ADMIN_TOKEN: '',
      },
      restart: 'unless-stopped',
    },
    webPort: 8087,
    minResources: { cores: 1, memoryMB: 128, diskGB: 1 },
  },
  {
    id: 'authelia',
    name: 'Authelia',
    description: 'Single sign-on and two-factor authentication for your reverse proxy.',
    icon: '🔑',
    category: 'security',
    type: 'docker',
    tags: ['security', 'sso', '2fa', 'authentication'],
    website: 'https://www.authelia.com',
    docker: {
      image: 'authelia/authelia:latest',
      ports: { '9091': 9092 },
      volumes: {
        '/config': '/opt/proxnest/apps/authelia/config',
      },
      restart: 'unless-stopped',
    },
    webPort: 9092,
    minResources: { cores: 1, memoryMB: 256, diskGB: 1 },
  },
  {
    id: 'crowdsec',
    name: 'CrowdSec',
    description: 'Collaborative security engine. Detect and block attacks using community intelligence.',
    icon: '🛡️',
    category: 'security',
    type: 'docker',
    tags: ['security', 'firewall', 'ids', 'community'],
    website: 'https://www.crowdsec.net',
    docker: {
      image: 'crowdsecurity/crowdsec:latest',
      ports: { '8080': 8088 },
      volumes: {
        '/etc/crowdsec': '/opt/proxnest/apps/crowdsec/config',
        '/var/lib/crowdsec/data': '/opt/proxnest/apps/crowdsec/data',
      },
      restart: 'unless-stopped',
    },
    webPort: 8088,
    minResources: { cores: 1, memoryMB: 256, diskGB: 2 },
  },

  // ═══════════════════════════════════════════════════
  // PRODUCTIVITY
  // ═══════════════════════════════════════════════════
  {
    id: 'bookstack',
    name: 'BookStack',
    description: 'Self-hosted wiki platform for organizing and storing information.',
    icon: '📖',
    category: 'productivity',
    type: 'docker',
    tags: ['productivity', 'wiki', 'documentation', 'knowledge-base'],
    website: 'https://www.bookstackapp.com',
    docker: {
      image: 'lscr.io/linuxserver/bookstack:latest',
      ports: { '80': 8089 },
      volumes: {
        '/config': '/opt/proxnest/apps/bookstack/config',
      },
      environment: {
        PUID: '1000',
        PGID: '1000',
        TZ: 'America/New_York',
        APP_URL: 'http://localhost:8089',
        DB_HOST: 'bookstack-db',
        DB_DATABASE: 'bookstack',
        DB_USERNAME: 'bookstack',
        DB_PASSWORD: 'bookstack',
      },
      compose: `version: "3.8"
services:
  bookstack:
    image: lscr.io/linuxserver/bookstack:latest
    ports:
      - "8089:80"
    volumes:
      - /opt/proxnest/apps/bookstack/config:/config
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=America/New_York
      - APP_URL=http://localhost:8089
      - DB_HOST=bookstack-db
      - DB_DATABASE=bookstack
      - DB_USERNAME=bookstack
      - DB_PASSWORD=bookstack
    depends_on:
      - bookstack-db
    restart: unless-stopped
  bookstack-db:
    image: mariadb:10
    environment:
      - MYSQL_ROOT_PASSWORD=bookstack
      - MYSQL_DATABASE=bookstack
      - MYSQL_USER=bookstack
      - MYSQL_PASSWORD=bookstack
    volumes:
      - /opt/proxnest/apps/bookstack/db:/var/lib/mysql
    restart: unless-stopped`,
      restart: 'unless-stopped',
    },
    webPort: 8089,
    minResources: { cores: 1, memoryMB: 512, diskGB: 5 },
  },
  {
    id: 'paperless-ngx',
    name: 'Paperless-ngx',
    description: 'Document management system. Scan, index, and archive paper documents.',
    icon: '📄',
    category: 'productivity',
    type: 'docker',
    tags: ['productivity', 'documents', 'ocr', 'archive'],
    website: 'https://docs.paperless-ngx.com',
    docker: {
      image: 'ghcr.io/paperless-ngx/paperless-ngx:latest',
      ports: { '8000': 8090 },
      volumes: {
        '/usr/src/paperless/data': '/opt/proxnest/apps/paperless/data',
        '/usr/src/paperless/media': '/opt/proxnest/apps/paperless/media',
        '/usr/src/paperless/export': '/opt/proxnest/apps/paperless/export',
        '/usr/src/paperless/consume': '/opt/proxnest/apps/paperless/consume',
      },
      compose: `version: "3.8"
services:
  paperless-web:
    image: ghcr.io/paperless-ngx/paperless-ngx:latest
    ports:
      - "8090:8000"
    volumes:
      - /opt/proxnest/apps/paperless/data:/usr/src/paperless/data
      - /opt/proxnest/apps/paperless/media:/usr/src/paperless/media
      - /opt/proxnest/apps/paperless/export:/usr/src/paperless/export
      - /opt/proxnest/apps/paperless/consume:/usr/src/paperless/consume
    environment:
      - PAPERLESS_REDIS=redis://paperless-redis:6379
      - PAPERLESS_DBENGINE=sqlite
      - PAPERLESS_OCR_LANGUAGE=eng
      - PAPERLESS_URL=http://localhost:8090
    depends_on:
      - paperless-redis
    restart: unless-stopped
  paperless-redis:
    image: redis:7-alpine
    restart: unless-stopped`,
      restart: 'unless-stopped',
    },
    webPort: 8090,
    minResources: { cores: 2, memoryMB: 1024, diskGB: 10 },
  },
  {
    id: 'n8n',
    name: 'n8n',
    description: 'Workflow automation tool. Connect apps and automate tasks visually.',
    icon: '⚡',
    category: 'productivity',
    type: 'docker',
    tags: ['productivity', 'automation', 'workflows', 'integrations'],
    website: 'https://n8n.io',
    docker: {
      image: 'n8nio/n8n:latest',
      ports: { '5678': 5678 },
      volumes: {
        '/home/node/.n8n': '/opt/proxnest/apps/n8n/data',
      },
      environment: {
        N8N_BASIC_AUTH_ACTIVE: 'true',
        N8N_BASIC_AUTH_USER: 'admin',
        N8N_BASIC_AUTH_PASSWORD: 'changeme',
      },
      restart: 'unless-stopped',
    },
    webPort: 5678,
    minResources: { cores: 1, memoryMB: 512, diskGB: 2 },
  },
  {
    id: 'mealie',
    name: 'Mealie',
    description: 'Recipe manager and meal planner. Import recipes from any website.',
    icon: '🍽️',
    category: 'productivity',
    type: 'docker',
    tags: ['productivity', 'recipes', 'meal-planning', 'cooking'],
    website: 'https://mealie.io',
    docker: {
      image: 'ghcr.io/mealie-recipes/mealie:latest',
      ports: { '9000': 9093 },
      volumes: {
        '/app/data': '/opt/proxnest/apps/mealie/data',
      },
      environment: {
        TZ: 'America/New_York',
        BASE_URL: 'http://localhost:9093',
      },
      restart: 'unless-stopped',
    },
    webPort: 9093,
    minResources: { cores: 1, memoryMB: 256, diskGB: 2 },
  },
  {
    id: 'stirling-pdf',
    name: 'Stirling-PDF',
    description: 'Self-hosted PDF manipulation tool. Merge, split, rotate, convert, and more.',
    icon: '📑',
    category: 'productivity',
    type: 'docker',
    tags: ['productivity', 'pdf', 'tools', 'documents'],
    website: 'https://github.com/Stirling-Tools/Stirling-PDF',
    docker: {
      image: 'frooodle/s-pdf:latest',
      ports: { '8080': 8094 },
      volumes: {
        '/usr/share/tessdata': '/opt/proxnest/apps/stirling-pdf/tessdata',
        '/configs': '/opt/proxnest/apps/stirling-pdf/configs',
      },
      environment: { DOCKER_ENABLE_SECURITY: 'false' },
      restart: 'unless-stopped',
    },
    webPort: 8094,
    minResources: { cores: 1, memoryMB: 512, diskGB: 2 },
  },
  {
    id: 'calibre-web',
    name: 'Calibre-Web',
    description: 'Web app for browsing, reading, and downloading eBooks from your Calibre library.',
    icon: '📕',
    category: 'productivity',
    type: 'docker',
    tags: ['productivity', 'ebooks', 'library', 'reading'],
    website: 'https://github.com/janeczku/calibre-web',
    docker: {
      image: 'lscr.io/linuxserver/calibre-web:latest',
      ports: { '8083': 8095 },
      volumes: {
        '/config': '/opt/proxnest/apps/calibre-web/config',
        '/books': '/mnt/media/books',
      },
      environment: { PUID: '1000', PGID: '1000', TZ: 'America/New_York' },
      restart: 'unless-stopped',
    },
    webPort: 8095,
    minResources: { cores: 1, memoryMB: 256, diskGB: 2 },
  },
  {
    id: 'hoppscotch',
    name: 'Hoppscotch',
    description: 'Open-source API development ecosystem. Postman alternative with real-time collaboration.',
    icon: '🦗',
    category: 'development',
    type: 'docker',
    tags: ['development', 'api', 'testing', 'rest'],
    website: 'https://hoppscotch.io',
    docker: {
      image: 'hoppscotch/hoppscotch:latest',
      ports: { '3000': 3005 },
      volumes: {},
      environment: {
        DATABASE_URL: 'postgresql://postgres:postgres@hoppscotch-db:5432/hoppscotch',
        TOKEN_SALT_COMPLEXITY: '10',
        MAGIC_LINK_TOKEN_VALIDITY: '3',
        REFRESH_TOKEN_VALIDITY: '604800000',
        ACCESS_TOKEN_VALIDITY: '86400000',
        RATE_LIMIT_TTL: '60',
        RATE_LIMIT_MAX: '100',
      },
      compose: `version: "3.8"
services:
  hoppscotch:
    image: hoppscotch/hoppscotch:latest
    container_name: proxnest-hoppscotch
    ports:
      - "3170:3170"
      - "3000:3000"
      - "3100:3100"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@hoppscotch-db:5432/hoppscotch
    depends_on:
      - hoppscotch-db
    restart: unless-stopped
  hoppscotch-db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=hoppscotch
    volumes:
      - /opt/proxnest/apps/hoppscotch/pgdata:/var/lib/postgresql/data
    restart: unless-stopped`,
      restart: 'unless-stopped',
    },
    webPort: 3005,
    minResources: { cores: 1, memoryMB: 512, diskGB: 3 },
  },
  {
    id: 'it-tools',
    name: 'IT Tools',
    description: 'Collection of handy online tools for developers: hash generators, encoders, converters, and more.',
    icon: '🧰',
    category: 'development',
    type: 'docker',
    tags: ['development', 'tools', 'utilities', 'converters'],
    website: 'https://it-tools.tech',
    docker: {
      image: 'corentinth/it-tools:latest',
      ports: { '80': 8096 },
      volumes: {},
      restart: 'unless-stopped',
    },
    webPort: 8096,
    minResources: { cores: 1, memoryMB: 128, diskGB: 1 },
  },

  // ═══════════════════════════════════════════════════
  // MEDIA — Additional
  // ═══════════════════════════════════════════════════
  {
    id: 'kodi-headless',
    name: 'Kodi Headless',
    description: 'Headless Kodi instance for library management and MySQL/MariaDB syncing.',
    icon: '🎮',
    category: 'media',
    type: 'docker',
    tags: ['media', 'kodi', 'library', 'headless'],
    website: 'https://kodi.tv',
    docker: {
      image: 'lscr.io/linuxserver/kodi-headless:latest',
      ports: { '8080': 8097, '9090': 9094, '9777': 9777 },
      volumes: {
        '/config/.kodi': '/opt/proxnest/apps/kodi-headless/config',
      },
      environment: { PUID: '1000', PGID: '1000', TZ: 'America/New_York' },
      restart: 'unless-stopped',
    },
    webPort: 8097,
    minResources: { cores: 1, memoryMB: 512, diskGB: 2 },
  },
  {
    id: 'jellyseerr',
    name: 'Jellyseerr',
    description: 'Media request management for Jellyfin and Emby. Fork of Overseerr.',
    icon: '🎟️',
    category: 'media',
    type: 'docker',
    tags: ['media', 'requests', 'jellyfin', 'automation'],
    website: 'https://github.com/Fallenbagel/jellyseerr',
    docker: {
      image: 'fallenbagel/jellyseerr:latest',
      ports: { '5055': 5056 },
      volumes: {
        '/app/config': '/opt/proxnest/apps/jellyseerr/config',
      },
      environment: { TZ: 'America/New_York' },
      restart: 'unless-stopped',
    },
    webPort: 5056,
    minResources: { cores: 1, memoryMB: 256, diskGB: 1 },
  },
  {
    id: 'tdarr',
    name: 'Tdarr',
    description: 'Distributed transcoding system. Automatically optimize your media library file sizes.',
    icon: '🔧',
    category: 'media',
    type: 'docker',
    tags: ['media', 'transcoding', 'optimization', 'automation'],
    website: 'https://home.tdarr.io',
    docker: {
      image: 'ghcr.io/haveagitgat/tdarr:latest',
      ports: { '8265': 8265, '8266': 8266 },
      volumes: {
        '/app/server': '/opt/proxnest/apps/tdarr/server',
        '/app/configs': '/opt/proxnest/apps/tdarr/configs',
        '/app/logs': '/opt/proxnest/apps/tdarr/logs',
        '/media': '/mnt/media',
        '/temp': '/opt/proxnest/apps/tdarr/temp',
      },
      environment: {
        PUID: '1000',
        PGID: '1000',
        TZ: 'America/New_York',
        serverIP: '0.0.0.0',
        serverPort: '8266',
        webUIPort: '8265',
        internalNode: 'true',
        inContainer: 'true',
      },
      restart: 'unless-stopped',
    },
    webPort: 8265,
    minResources: { cores: 2, memoryMB: 2048, diskGB: 10 },
  },

  // ═══════════════════════════════════════════════════
  // DOWNLOADS — Additional
  // ═══════════════════════════════════════════════════
  {
    id: 'jdownloader',
    name: 'JDownloader',
    description: 'Open-source download management tool for one-click hosters and direct links.',
    icon: '📎',
    category: 'downloads',
    type: 'docker',
    tags: ['downloads', 'direct-download', 'one-click', 'management'],
    website: 'https://jdownloader.org',
    docker: {
      image: 'jlesage/jdownloader-2:latest',
      ports: { '5800': 5800 },
      volumes: {
        '/config': '/opt/proxnest/apps/jdownloader/config',
        '/output': '/mnt/downloads',
      },
      restart: 'unless-stopped',
    },
    webPort: 5800,
    minResources: { cores: 1, memoryMB: 512, diskGB: 2 },
  },

  // ═══════════════════════════════════════════════════
  // CLOUD — Additional
  // ═══════════════════════════════════════════════════
  {
    id: 'seafile',
    name: 'Seafile',
    description: 'High-performance file syncing and sharing with built-in file encryption and collaboration.',
    icon: '🐚',
    category: 'cloud',
    type: 'docker',
    tags: ['cloud', 'storage', 'sync', 'collaboration', 'encryption'],
    website: 'https://www.seafile.com',
    docker: {
      image: 'seafileltd/seafile-mc:latest',
      ports: { '80': 8098 },
      volumes: {
        '/shared/seafile': '/opt/proxnest/apps/seafile/data',
      },
      compose: `version: "3.8"
services:
  seafile-db:
    image: mariadb:10.11
    container_name: proxnest-seafile-db
    environment:
      - MYSQL_ROOT_PASSWORD=db_dev
      - MYSQL_LOG_CONSOLE=true
    volumes:
      - /opt/proxnest/apps/seafile/mysql:/var/lib/mysql
    restart: unless-stopped
  seafile-memcached:
    image: memcached:1.6-alpine
    container_name: proxnest-seafile-memcached
    entrypoint: memcached -m 256
    restart: unless-stopped
  seafile:
    image: seafileltd/seafile-mc:latest
    container_name: proxnest-seafile
    ports:
      - "8098:80"
    volumes:
      - /opt/proxnest/apps/seafile/data:/shared/seafile
    environment:
      - DB_HOST=seafile-db
      - DB_ROOT_PASSWD=db_dev
      - SEAFILE_ADMIN_EMAIL=admin@seafile.local
      - SEAFILE_ADMIN_PASSWORD=changeme
      - SEAFILE_SERVER_LETSENCRYPT=false
    depends_on:
      - seafile-db
      - seafile-memcached
    restart: unless-stopped`,
      restart: 'unless-stopped',
    },
    webPort: 8098,
    minResources: { cores: 2, memoryMB: 1024, diskGB: 10 },
  },

  // ═══════════════════════════════════════════════════
  // HOME AUTOMATION — Additional
  // ═══════════════════════════════════════════════════
  {
    id: 'node-red',
    name: 'Node-RED',
    description: 'Flow-based programming for IoT. Wire together hardware, APIs, and online services.',
    icon: '🔴',
    category: 'home',
    type: 'docker',
    tags: ['home', 'automation', 'iot', 'flows', 'programming'],
    website: 'https://nodered.org',
    docker: {
      image: 'nodered/node-red:latest',
      ports: { '1880': 1880 },
      volumes: {
        '/data': '/opt/proxnest/apps/node-red/data',
      },
      environment: { TZ: 'America/New_York' },
      restart: 'unless-stopped',
    },
    webPort: 1880,
    minResources: { cores: 1, memoryMB: 256, diskGB: 2 },
  },
  {
    id: 'mosquitto',
    name: 'Eclipse Mosquitto',
    description: 'Lightweight MQTT message broker for IoT and home automation messaging.',
    icon: '🦟',
    category: 'home',
    type: 'docker',
    tags: ['home', 'mqtt', 'iot', 'messaging', 'broker'],
    website: 'https://mosquitto.org',
    docker: {
      image: 'eclipse-mosquitto:latest',
      ports: { '1883': 1883, '9001': 9095 },
      volumes: {
        '/mosquitto/config': '/opt/proxnest/apps/mosquitto/config',
        '/mosquitto/data': '/opt/proxnest/apps/mosquitto/data',
        '/mosquitto/log': '/opt/proxnest/apps/mosquitto/log',
      },
      restart: 'unless-stopped',
    },
    webPort: 0,
    minResources: { cores: 1, memoryMB: 64, diskGB: 1 },
  },
  {
    id: 'zigbee2mqtt',
    name: 'Zigbee2MQTT',
    description: 'Bridge Zigbee devices to MQTT. Control Zigbee devices without vendor bridges.',
    icon: '📡',
    category: 'home',
    type: 'docker',
    tags: ['home', 'zigbee', 'mqtt', 'iot', 'smart-home'],
    website: 'https://www.zigbee2mqtt.io',
    docker: {
      image: 'koenkk/zigbee2mqtt:latest',
      ports: { '8080': 8099 },
      volumes: {
        '/app/data': '/opt/proxnest/apps/zigbee2mqtt/data',
        '/run/udev': '/run/udev:ro',
      },
      environment: { TZ: 'America/New_York' },
      restart: 'unless-stopped',
    },
    webPort: 8099,
    minResources: { cores: 1, memoryMB: 256, diskGB: 1 },
  },
  {
    id: 'esphome',
    name: 'ESPHome',
    description: 'System to control ESP8266/ESP32 devices. Create custom firmware with YAML.',
    icon: '⚡',
    category: 'home',
    type: 'docker',
    tags: ['home', 'esp32', 'esp8266', 'iot', 'firmware'],
    website: 'https://esphome.io',
    docker: {
      image: 'ghcr.io/esphome/esphome:latest',
      ports: { '6052': 6052 },
      volumes: {
        '/config': '/opt/proxnest/apps/esphome/config',
      },
      environment: { TZ: 'America/New_York' },
      restart: 'unless-stopped',
    },
    webPort: 6052,
    minResources: { cores: 1, memoryMB: 512, diskGB: 2 },
  },

  // ═══════════════════════════════════════════════════
  // SECURITY — Additional
  // ═══════════════════════════════════════════════════
  {
    id: 'authentik',
    name: 'Authentik',
    description: 'Identity provider and SSO solution. SAML, OAuth2, LDAP, and SCIM support.',
    icon: '🛂',
    category: 'security',
    type: 'docker',
    tags: ['security', 'sso', 'identity', 'oauth', 'ldap'],
    website: 'https://goauthentik.io',
    docker: {
      image: 'ghcr.io/goauthentik/server:latest',
      ports: { '9000': 9096, '9443': 9444 },
      volumes: {
        '/media': '/opt/proxnest/apps/authentik/media',
        '/templates': '/opt/proxnest/apps/authentik/templates',
      },
      compose: `version: "3.8"
services:
  authentik-server:
    image: ghcr.io/goauthentik/server:latest
    container_name: proxnest-authentik
    command: server
    ports:
      - "9096:9000"
      - "9444:9443"
    volumes:
      - /opt/proxnest/apps/authentik/media:/media
      - /opt/proxnest/apps/authentik/templates:/templates
    environment:
      - AUTHENTIK_SECRET_KEY=changeme-generate-a-real-key
      - AUTHENTIK_REDIS__HOST=authentik-redis
      - AUTHENTIK_POSTGRESQL__HOST=authentik-db
      - AUTHENTIK_POSTGRESQL__USER=authentik
      - AUTHENTIK_POSTGRESQL__PASSWORD=authentik
      - AUTHENTIK_POSTGRESQL__NAME=authentik
    depends_on:
      - authentik-db
      - authentik-redis
    restart: unless-stopped
  authentik-worker:
    image: ghcr.io/goauthentik/server:latest
    command: worker
    environment:
      - AUTHENTIK_SECRET_KEY=changeme-generate-a-real-key
      - AUTHENTIK_REDIS__HOST=authentik-redis
      - AUTHENTIK_POSTGRESQL__HOST=authentik-db
      - AUTHENTIK_POSTGRESQL__USER=authentik
      - AUTHENTIK_POSTGRESQL__PASSWORD=authentik
      - AUTHENTIK_POSTGRESQL__NAME=authentik
    depends_on:
      - authentik-db
      - authentik-redis
    restart: unless-stopped
  authentik-db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_PASSWORD=authentik
      - POSTGRES_USER=authentik
      - POSTGRES_DB=authentik
    volumes:
      - /opt/proxnest/apps/authentik/pgdata:/var/lib/postgresql/data
    restart: unless-stopped
  authentik-redis:
    image: redis:7-alpine
    restart: unless-stopped`,
      restart: 'unless-stopped',
    },
    webPort: 9096,
    minResources: { cores: 2, memoryMB: 2048, diskGB: 5 },
  },
  {
    id: 'fail2ban',
    name: 'Fail2Ban',
    description: 'Intrusion prevention framework. Bans IPs showing malicious signs from log files.',
    icon: '🚨',
    category: 'security',
    type: 'docker',
    tags: ['security', 'firewall', 'intrusion-prevention', 'banning'],
    website: 'https://www.fail2ban.org',
    docker: {
      image: 'crazymax/fail2ban:latest',
      ports: {},
      volumes: {
        '/data': '/opt/proxnest/apps/fail2ban/data',
        '/var/log': '/var/log:ro',
      },
      environment: {
        TZ: 'America/New_York',
        F2B_LOG_TARGET: 'STDOUT',
        F2B_LOG_LEVEL: 'INFO',
        F2B_DB_PURGE_AGE: '1d',
      },
      capabilities: ['NET_ADMIN', 'NET_RAW'],
      network_mode: 'host',
      restart: 'unless-stopped',
    },
    webPort: 0,
    minResources: { cores: 1, memoryMB: 128, diskGB: 1 },
  },

  // ═══════════════════════════════════════════════════
  // GAMING
  // ═══════════════════════════════════════════════════
  {
    id: 'gamevault',
    name: 'GameVault',
    description: 'Self-hosted game library manager. Organize, download, and play games from your server.',
    icon: '🎮',
    category: 'gaming',
    type: 'docker',
    tags: ['gaming', 'library', 'games', 'management'],
    website: 'https://gamevau.lt',
    docker: {
      image: 'phalcode/gamevault-backend:latest',
      ports: { '8080': 8100 },
      volumes: {
        '/files': '/mnt/media/games',
        '/images': '/opt/proxnest/apps/gamevault/images',
      },
      compose: `version: "3.8"
services:
  gamevault-backend:
    image: phalcode/gamevault-backend:latest
    container_name: proxnest-gamevault
    ports:
      - "8100:8080"
    volumes:
      - /mnt/media/games:/files
      - /opt/proxnest/apps/gamevault/images:/images
    environment:
      - DB_HOST=gamevault-db
      - DB_USERNAME=gamevault
      - DB_PASSWORD=gamevault
      - DB_DATABASE=gamevault
    depends_on:
      - gamevault-db
    restart: unless-stopped
  gamevault-db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=gamevault
      - POSTGRES_PASSWORD=gamevault
      - POSTGRES_DB=gamevault
    volumes:
      - /opt/proxnest/apps/gamevault/pgdata:/var/lib/postgresql/data
    restart: unless-stopped`,
      restart: 'unless-stopped',
    },
    webPort: 8100,
    minResources: { cores: 1, memoryMB: 512, diskGB: 5 },
  },
  {
    id: 'lancache',
    name: 'Lancache',
    description: 'Cache game downloads from Steam, Epic, Origin, and more. Save bandwidth on LAN parties.',
    icon: '🎯',
    category: 'gaming',
    type: 'docker',
    tags: ['gaming', 'cache', 'steam', 'downloads', 'lan'],
    website: 'https://lancache.net',
    docker: {
      image: 'lancachenet/monolithic:latest',
      ports: { '80': 8101, '443': 8102 },
      volumes: {
        '/data/cache': '/opt/proxnest/apps/lancache/cache',
        '/data/logs': '/opt/proxnest/apps/lancache/logs',
      },
      environment: {
        CACHE_MEM_SIZE: '500m',
        CACHE_DISK_SIZE: '500g',
        CACHE_MAX_AGE: '3560d',
        TZ: 'America/New_York',
      },
      restart: 'unless-stopped',
    },
    webPort: 0,
    minResources: { cores: 2, memoryMB: 1024, diskGB: 500 },
  },
  {
    id: 'minecraft-server',
    name: 'Minecraft Server',
    description: 'Dedicated Minecraft Java Edition server with automatic version management.',
    icon: '⛏️',
    category: 'gaming',
    type: 'docker',
    tags: ['gaming', 'minecraft', 'server', 'java'],
    website: 'https://www.minecraft.net',
    docker: {
      image: 'itzg/minecraft-server:latest',
      ports: { '25565': 25565, '25575': 25575 },
      volumes: {
        '/data': '/opt/proxnest/apps/minecraft/data',
      },
      environment: {
        EULA: 'TRUE',
        TYPE: 'PAPER',
        MEMORY: '2G',
        MAX_PLAYERS: '20',
        DIFFICULTY: 'normal',
        VIEW_DISTANCE: '10',
        ENABLE_RCON: 'true',
        RCON_PASSWORD: 'changeme',
        TZ: 'America/New_York',
      },
      restart: 'unless-stopped',
    },
    webPort: 0,
    minResources: { cores: 2, memoryMB: 2048, diskGB: 10 },
  },
  {
    id: 'valheim-server',
    name: 'Valheim Server',
    description: 'Dedicated Valheim game server with automatic updates and backups.',
    icon: '⚔️',
    category: 'gaming',
    type: 'docker',
    tags: ['gaming', 'valheim', 'server', 'survival'],
    website: 'https://www.valheimgame.com',
    docker: {
      image: 'lloesche/valheim-server:latest',
      ports: { '2456-2458': 2456 },
      volumes: {
        '/config': '/opt/proxnest/apps/valheim/config',
        '/opt/valheim': '/opt/proxnest/apps/valheim/game',
      },
      environment: {
        SERVER_NAME: 'ProxNest Valheim',
        WORLD_NAME: 'ProxNest',
        SERVER_PASS: 'changeme',
        BACKUPS: 'true',
        BACKUPS_INTERVAL: '7200',
        TZ: 'America/New_York',
      },
      restart: 'unless-stopped',
    },
    webPort: 0,
    minResources: { cores: 2, memoryMB: 4096, diskGB: 15 },
  },

  // ═══════════════════════════════════════════════════
  // COMMUNICATION
  // ═══════════════════════════════════════════════════
  {
    id: 'matrix-synapse',
    name: 'Matrix / Synapse',
    description: 'Decentralized, end-to-end encrypted messaging server. The Matrix protocol reference implementation.',
    icon: '💬',
    category: 'communication',
    type: 'docker',
    tags: ['communication', 'chat', 'matrix', 'encrypted', 'decentralized'],
    website: 'https://matrix.org',
    docker: {
      image: 'matrixdotorg/synapse:latest',
      ports: { '8008': 8103, '8448': 8448 },
      volumes: {
        '/data': '/opt/proxnest/apps/synapse/data',
      },
      environment: {
        SYNAPSE_SERVER_NAME: 'localhost',
        SYNAPSE_REPORT_STATS: 'no',
        TZ: 'America/New_York',
      },
      compose: `version: "3.8"
services:
  synapse:
    image: matrixdotorg/synapse:latest
    container_name: proxnest-synapse
    ports:
      - "8103:8008"
      - "8448:8448"
    volumes:
      - /opt/proxnest/apps/synapse/data:/data
    environment:
      - SYNAPSE_SERVER_NAME=localhost
      - SYNAPSE_REPORT_STATS=no
      - SYNAPSE_CONFIG_DIR=/data
    restart: unless-stopped
  synapse-db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=synapse
      - POSTGRES_PASSWORD=synapse
      - POSTGRES_DB=synapse
      - POSTGRES_INITDB_ARGS=--encoding=UTF-8 --lc-collate=C --lc-ctype=C
    volumes:
      - /opt/proxnest/apps/synapse/pgdata:/var/lib/postgresql/data
    restart: unless-stopped`,
      restart: 'unless-stopped',
    },
    webPort: 8103,
    minResources: { cores: 2, memoryMB: 1024, diskGB: 10 },
  },
  {
    id: 'mattermost',
    name: 'Mattermost',
    description: 'Open-source Slack alternative. Team messaging with channels, threads, and integrations.',
    icon: '📨',
    category: 'communication',
    type: 'docker',
    tags: ['communication', 'chat', 'team', 'slack-alternative'],
    website: 'https://mattermost.com',
    docker: {
      image: 'mattermost/mattermost-team-edition:latest',
      ports: { '8065': 8065 },
      volumes: {
        '/mattermost/config': '/opt/proxnest/apps/mattermost/config',
        '/mattermost/data': '/opt/proxnest/apps/mattermost/data',
        '/mattermost/logs': '/opt/proxnest/apps/mattermost/logs',
        '/mattermost/plugins': '/opt/proxnest/apps/mattermost/plugins',
      },
      compose: `version: "3.8"
services:
  mattermost:
    image: mattermost/mattermost-team-edition:latest
    container_name: proxnest-mattermost
    ports:
      - "8065:8065"
    volumes:
      - /opt/proxnest/apps/mattermost/config:/mattermost/config
      - /opt/proxnest/apps/mattermost/data:/mattermost/data
      - /opt/proxnest/apps/mattermost/logs:/mattermost/logs
      - /opt/proxnest/apps/mattermost/plugins:/mattermost/plugins
    environment:
      - MM_SQLSETTINGS_DRIVERNAME=postgres
      - MM_SQLSETTINGS_DATASOURCE=postgres://mattermost:mattermost@mattermost-db:5432/mattermost?sslmode=disable
      - TZ=America/New_York
    depends_on:
      - mattermost-db
    restart: unless-stopped
  mattermost-db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=mattermost
      - POSTGRES_PASSWORD=mattermost
      - POSTGRES_DB=mattermost
    volumes:
      - /opt/proxnest/apps/mattermost/pgdata:/var/lib/postgresql/data
    restart: unless-stopped`,
      restart: 'unless-stopped',
    },
    webPort: 8065,
    minResources: { cores: 2, memoryMB: 1024, diskGB: 10 },
  },
  {
    id: 'rocket-chat',
    name: 'Rocket.Chat',
    description: 'Open-source team communication platform. Video conferencing, file sharing, and bots.',
    icon: '🚀',
    category: 'communication',
    type: 'docker',
    tags: ['communication', 'chat', 'video', 'team', 'bots'],
    website: 'https://www.rocket.chat',
    docker: {
      image: 'registry.rocket.chat/rocketchat/rocket.chat:latest',
      ports: { '3000': 3006 },
      volumes: {
        '/app/uploads': '/opt/proxnest/apps/rocketchat/uploads',
      },
      compose: `version: "3.8"
services:
  rocketchat:
    image: registry.rocket.chat/rocketchat/rocket.chat:latest
    container_name: proxnest-rocketchat
    ports:
      - "3006:3000"
    volumes:
      - /opt/proxnest/apps/rocketchat/uploads:/app/uploads
    environment:
      - MONGO_URL=mongodb://rocketchat-db:27017/rocketchat
      - MONGO_OPLOG_URL=mongodb://rocketchat-db:27017/local
      - ROOT_URL=http://localhost:3006
    depends_on:
      - rocketchat-db
    restart: unless-stopped
  rocketchat-db:
    image: mongo:6.0
    command: mongod --oplogSize 128 --replSet rs0
    volumes:
      - /opt/proxnest/apps/rocketchat/mongo:/data/db
    restart: unless-stopped`,
      restart: 'unless-stopped',
    },
    webPort: 3006,
    minResources: { cores: 2, memoryMB: 1024, diskGB: 10 },
  },
];

// ─────────────────────────────────────────────────────
// Docker Compose Stacks (bundles of apps)
// ─────────────────────────────────────────────────────

export const COMPOSE_STACKS: ComposeStack[] = [
  {
    id: 'media-stack',
    name: 'Complete Media Stack',
    description: 'Full media automation: Jellyfin + Sonarr + Radarr + Prowlarr + qBittorrent. Everything you need for automated media management.',
    icon: '🎬',
    category: 'media',
    tags: ['media', 'automation', 'streaming', 'arr-stack'],
    apps: ['jellyfin', 'sonarr', 'radarr', 'prowlarr', 'qbittorrent', 'bazarr'],
    webPorts: {
      jellyfin: 8096,
      sonarr: 8989,
      radarr: 7878,
      prowlarr: 9696,
      qbittorrent: 8080,
      bazarr: 6767,
    },
    compose: `version: "3.8"

# ProxNest Media Stack
# Automated media management with streaming

services:
  jellyfin:
    image: jellyfin/jellyfin:latest
    container_name: proxnest-jellyfin
    ports:
      - "8096:8096"
    volumes:
      - /opt/proxnest/stacks/media/jellyfin/config:/config
      - /opt/proxnest/stacks/media/jellyfin/cache:/cache
      - /mnt/media:/media
    environment:
      - TZ=America/New_York
    restart: unless-stopped

  sonarr:
    image: lscr.io/linuxserver/sonarr:latest
    container_name: proxnest-sonarr
    ports:
      - "8989:8989"
    volumes:
      - /opt/proxnest/stacks/media/sonarr:/config
      - /mnt/downloads:/downloads
      - /mnt/media/tv:/tv
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=America/New_York
    restart: unless-stopped

  radarr:
    image: lscr.io/linuxserver/radarr:latest
    container_name: proxnest-radarr
    ports:
      - "7878:7878"
    volumes:
      - /opt/proxnest/stacks/media/radarr:/config
      - /mnt/downloads:/downloads
      - /mnt/media/movies:/movies
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=America/New_York
    restart: unless-stopped

  bazarr:
    image: lscr.io/linuxserver/bazarr:latest
    container_name: proxnest-bazarr
    ports:
      - "6767:6767"
    volumes:
      - /opt/proxnest/stacks/media/bazarr:/config
      - /mnt/media/movies:/movies
      - /mnt/media/tv:/tv
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=America/New_York
    restart: unless-stopped

  prowlarr:
    image: lscr.io/linuxserver/prowlarr:latest
    container_name: proxnest-prowlarr
    ports:
      - "9696:9696"
    volumes:
      - /opt/proxnest/stacks/media/prowlarr:/config
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=America/New_York
    restart: unless-stopped

  qbittorrent:
    image: lscr.io/linuxserver/qbittorrent:latest
    container_name: proxnest-qbittorrent
    ports:
      - "8080:8080"
      - "6881:6881"
    volumes:
      - /opt/proxnest/stacks/media/qbittorrent:/config
      - /mnt/downloads:/downloads
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=America/New_York
      - WEBUI_PORT=8080
    restart: unless-stopped`,
  },
  {
    id: 'monitoring-stack',
    name: 'Monitoring Stack',
    description: 'Prometheus + Grafana + Uptime Kuma. Full observability for your homelab.',
    icon: '📊',
    category: 'monitoring',
    tags: ['monitoring', 'metrics', 'dashboards', 'alerting'],
    apps: ['prometheus', 'grafana', 'uptime-kuma'],
    webPorts: {
      grafana: 3002,
      prometheus: 9090,
      'uptime-kuma': 3001,
    },
    compose: `version: "3.8"

# ProxNest Monitoring Stack
# Full observability for your homelab

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: proxnest-prometheus
    ports:
      - "9090:9090"
    volumes:
      - /opt/proxnest/stacks/monitoring/prometheus/config:/etc/prometheus
      - /opt/proxnest/stacks/monitoring/prometheus/data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'
    restart: unless-stopped

  grafana:
    image: grafana/grafana-oss:latest
    container_name: proxnest-grafana
    ports:
      - "3002:3000"
    volumes:
      - /opt/proxnest/stacks/monitoring/grafana:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    depends_on:
      - prometheus
    restart: unless-stopped

  uptime-kuma:
    image: louislam/uptime-kuma:latest
    container_name: proxnest-uptime-kuma
    ports:
      - "3001:3001"
    volumes:
      - /opt/proxnest/stacks/monitoring/uptime-kuma:/app/data
    restart: unless-stopped`,
  },
  {
    id: 'security-stack',
    name: 'Security Stack',
    description: 'Vaultwarden + Authelia + CrowdSec. Password management, SSO, and intrusion detection.',
    icon: '🔐',
    category: 'security',
    tags: ['security', 'passwords', 'sso', 'ids'],
    apps: ['vaultwarden', 'authelia', 'crowdsec'],
    webPorts: {
      vaultwarden: 8087,
      authelia: 9092,
    },
    compose: `version: "3.8"

# ProxNest Security Stack
# Passwords + SSO + Intrusion Detection

services:
  vaultwarden:
    image: vaultwarden/server:latest
    container_name: proxnest-vaultwarden
    ports:
      - "8087:80"
    volumes:
      - /opt/proxnest/stacks/security/vaultwarden:/data
    environment:
      - SIGNUPS_ALLOWED=true
    restart: unless-stopped

  authelia:
    image: authelia/authelia:latest
    container_name: proxnest-authelia
    ports:
      - "9092:9091"
    volumes:
      - /opt/proxnest/stacks/security/authelia:/config
    restart: unless-stopped

  crowdsec:
    image: crowdsecurity/crowdsec:latest
    container_name: proxnest-crowdsec
    ports:
      - "8088:8080"
    volumes:
      - /opt/proxnest/stacks/security/crowdsec/config:/etc/crowdsec
      - /opt/proxnest/stacks/security/crowdsec/data:/var/lib/crowdsec/data
    restart: unless-stopped`,
  },
  {
    id: 'dev-stack',
    name: 'Developer Stack',
    description: 'Gitea + Code Server + Woodpecker CI. Self-hosted development environment.',
    icon: '💻',
    category: 'development',
    tags: ['development', 'git', 'ide', 'ci-cd'],
    apps: ['gitea', 'code-server', 'drone'],
    webPorts: {
      gitea: 3003,
      'code-server': 8443,
      woodpecker: 8086,
    },
    compose: `version: "3.8"

# ProxNest Developer Stack
# Git + IDE + CI/CD

services:
  gitea:
    image: gitea/gitea:latest
    container_name: proxnest-gitea
    ports:
      - "3003:3000"
      - "2222:22"
    volumes:
      - /opt/proxnest/stacks/dev/gitea:/data
    environment:
      - USER_UID=1000
      - USER_GID=1000
      - GITEA__database__DB_TYPE=sqlite3
    restart: unless-stopped

  code-server:
    image: lscr.io/linuxserver/code-server:latest
    container_name: proxnest-code-server
    ports:
      - "8443:8443"
    volumes:
      - /opt/proxnest/stacks/dev/code-server/config:/config
      - /opt/proxnest/stacks/dev/workspace:/workspace
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=America/New_York
    restart: unless-stopped

  woodpecker:
    image: woodpeckerci/woodpecker-server:latest
    container_name: proxnest-woodpecker
    ports:
      - "8086:8000"
    volumes:
      - /opt/proxnest/stacks/dev/woodpecker:/var/lib/woodpecker
    environment:
      - WOODPECKER_OPEN=true
      - WOODPECKER_HOST=http://localhost:8086
      - WOODPECKER_ADMIN=admin
    restart: unless-stopped`,
  },
];

// ─────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────

export function getTemplateById(id: string): AppTemplate | undefined {
  return APP_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: string): AppTemplate[] {
  return APP_TEMPLATES.filter((t) => t.category === category);
}

export function getFeaturedTemplates(): AppTemplate[] {
  return APP_TEMPLATES.filter((t) => t.featured);
}

export function searchTemplates(query: string): AppTemplate[] {
  const q = query.toLowerCase();
  return APP_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.includes(q)) ||
      t.category.includes(q),
  );
}

export function getStackById(id: string): ComposeStack | undefined {
  return COMPOSE_STACKS.find((s) => s.id === id);
}

export function getCategories(): { id: string; name: string; count: number }[] {
  const cats = [...new Set(APP_TEMPLATES.map((t) => t.category))];
  return cats.map((cat) => ({
    id: cat,
    name: cat.charAt(0).toUpperCase() + cat.slice(1),
    count: APP_TEMPLATES.filter((t) => t.category === cat).length,
  }));
}
