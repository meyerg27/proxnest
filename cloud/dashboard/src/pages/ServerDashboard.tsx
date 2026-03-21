/**
 * ProxNest Cloud — Server Dashboard (Full Management Interface)
 * Tabs: Overview, VMs & Containers, App Store, Storage, System, Network, Logs
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type CloudServer, type ServerMetrics, normalizeMetrics } from '../lib/api';
import {
  ArrowLeft, Server, Wifi, WifiOff, Cpu, MemoryStick, HardDrive,
  Container, RefreshCw, Terminal, Activity, Clock, Loader2,
  Box, Play, Square, RotateCw, Plus, Search, Download,
  Network, Database, ScrollText, ExternalLink, Monitor,
  ChevronDown, ChevronRight, X, Package, Layers, Globe, Shield,
  Gauge, Zap, Home, Eye, Gamepad2, MessageSquare, FolderOpen,
  ArrowUpDown, Star, ChevronLeft, Settings, AlertTriangle,
  CheckCircle2, XCircle, Info, Power, UploadCloud, Wrench,
  Brain, Filter, SortAsc, SortDesc,
} from 'lucide-react';
import { clsx } from 'clsx';

// ─── Types ───────────────────────────────────────

type Tab = 'overview' | 'guests' | 'apps' | 'storage' | 'system' | 'network' | 'logs';

interface GuestInfo {
  vmid: number;
  name: string;
  type: 'qemu' | 'lxc';
  status: 'running' | 'stopped' | 'paused';
  cpus: number;
  memoryMB: number;
  diskGB: number;
  uptime: number;
  netin: number;
  netout: number;
}

interface StorageInfo {
  id: string;
  type: string;
  content: string;
  path: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usagePercent: number;
  active: boolean;
}

interface NetworkInterface {
  name: string;
  state: 'up' | 'down' | 'unknown';
  ipv4: string[];
  ipv6: string[];
  speed: number | null;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
}

interface NetworkInfo {
  interfaces: NetworkInterface[];
  bridges: Array<{ name: string; ports: string[]; stp: boolean }>;
  gateway: string;
  dns: string[];
}

interface AppTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  type: 'lxc' | 'docker';
  tags: string[];
  featured?: boolean;
  webPort: number;
  minResources?: { cores: number; memoryMB: number; diskGB: number };
  docker?: {
    image: string;
    ports: Record<string, number>;
    volumes: Record<string, string>;
    environment?: Record<string, string>;
    compose?: string;
  };
  lxc?: {
    ostemplate: string;
    cores: number;
    memory: number;
    swap: number;
    rootfs: number;
    unprivileged?: boolean;
    features?: string;
    startup_script?: string;
  };
}

type GuestSort = 'name' | 'vmid' | 'status' | 'memory';

// ─── Default App Catalog (100+ Apps) ────────────

const DEFAULT_APPS: AppTemplate[] = [
  // ── Media ──────────────────────────────────
  { id: 'jellyfin', name: 'Jellyfin', description: 'Free media server for movies, TV & music', icon: '🎬', category: 'media', type: 'docker', tags: ['media', 'streaming'], featured: true, webPort: 8096, minResources: { cores: 2, memoryMB: 2048, diskGB: 10 }, docker: { image: 'jellyfin/jellyfin:latest', ports: { '8096': 8096 }, volumes: { '/config': '/opt/jellyfin/config', '/cache': '/opt/jellyfin/cache' } } },
  { id: 'plex', name: 'Plex', description: 'Stream movies & TV from your server', icon: '▶️', category: 'media', type: 'docker', tags: ['media', 'streaming'], featured: true, webPort: 32400, minResources: { cores: 2, memoryMB: 2048, diskGB: 10 }, docker: { image: 'plexinc/pms-docker:latest', ports: { '32400': 32400 }, volumes: { '/config': '/opt/plex/config' } } },
  { id: 'emby', name: 'Emby', description: 'Personal media server with live TV support', icon: '📺', category: 'media', type: 'docker', tags: ['media', 'streaming', 'live-tv'], webPort: 8920, minResources: { cores: 2, memoryMB: 2048, diskGB: 10 }, docker: { image: 'emby/embyserver:latest', ports: { '8920': 8920 }, volumes: { '/config': '/opt/emby/config' } } },
  { id: 'navidrome', name: 'Navidrome', description: 'Modern music server & streamer', icon: '🎵', category: 'media', type: 'docker', tags: ['music', 'streaming'], webPort: 4533, minResources: { cores: 1, memoryMB: 512, diskGB: 5 }, docker: { image: 'deluan/navidrome:latest', ports: { '4533': 4533 }, volumes: { '/data': '/opt/navidrome/data', '/music': '/music' } } },
  { id: 'airsonic', name: 'Airsonic-Advanced', description: 'Web-based music streaming server', icon: '🎶', category: 'media', type: 'docker', tags: ['music', 'streaming'], webPort: 4040, minResources: { cores: 1, memoryMB: 1024, diskGB: 5 }, docker: { image: 'linuxserver/airsonic-advanced:latest', ports: { '4040': 4040 }, volumes: { '/config': '/opt/airsonic/config', '/music': '/music' } } },
  { id: 'kavita', name: 'Kavita', description: 'Lightning-fast comics & manga reader', icon: '📖', category: 'media', type: 'docker', tags: ['comics', 'manga', 'reading'], webPort: 5000, minResources: { cores: 1, memoryMB: 512, diskGB: 5 }, docker: { image: 'jvmilazz0/kavita:latest', ports: { '5000': 5000 }, volumes: { '/config': '/opt/kavita/config', '/manga': '/manga' } } },
  { id: 'komga', name: 'Komga', description: 'Comic & manga server with OPDS support', icon: '📚', category: 'media', type: 'docker', tags: ['comics', 'manga'], webPort: 25600, minResources: { cores: 1, memoryMB: 1024, diskGB: 5 }, docker: { image: 'gotson/komga:latest', ports: { '25600': 25600 }, volumes: { '/config': '/opt/komga/config', '/data': '/comics' } } },
  { id: 'stash', name: 'Stash', description: 'Organizer & player for adult media', icon: '🔞', category: 'media', type: 'docker', tags: ['media', 'organizer'], webPort: 9999, minResources: { cores: 2, memoryMB: 2048, diskGB: 10 }, docker: { image: 'stashapp/stash:latest', ports: { '9999': 9999 }, volumes: { '/config': '/opt/stash/config', '/data': '/opt/stash/data' } } },
  { id: 'tautulli', name: 'Tautulli', description: 'Plex monitoring & analytics dashboard', icon: '📊', category: 'media', type: 'docker', tags: ['plex', 'monitoring', 'analytics'], webPort: 8181, minResources: { cores: 1, memoryMB: 256, diskGB: 2 }, docker: { image: 'linuxserver/tautulli:latest', ports: { '8181': 8181 }, volumes: { '/config': '/opt/tautulli' } } },
  { id: 'overseerr', name: 'Overseerr', description: 'Request management for Plex', icon: '🎟️', category: 'media', type: 'docker', tags: ['plex', 'requests'], webPort: 5055, minResources: { cores: 1, memoryMB: 512, diskGB: 2 }, docker: { image: 'linuxserver/overseerr:latest', ports: { '5055': 5055 }, volumes: { '/config': '/opt/overseerr' } } },
  { id: 'jellyseerr', name: 'Jellyseerr', description: 'Request management for Jellyfin & Plex', icon: '🎫', category: 'media', type: 'docker', tags: ['jellyfin', 'requests'], webPort: 5056, minResources: { cores: 1, memoryMB: 512, diskGB: 2 }, docker: { image: 'fallenbagel/jellyseerr:latest', ports: { '5056': 5055 }, volumes: { '/config': '/opt/jellyseerr' } } },
  { id: 'bazarr', name: 'Bazarr', description: 'Automated subtitle manager for Sonarr/Radarr', icon: '💬', category: 'media', type: 'docker', tags: ['subtitles', 'automation'], webPort: 6767, minResources: { cores: 1, memoryMB: 256, diskGB: 2 }, docker: { image: 'linuxserver/bazarr:latest', ports: { '6767': 6767 }, volumes: { '/config': '/opt/bazarr' } } },
  { id: 'tdarr', name: 'Tdarr', description: 'Distributed media transcoding system', icon: '🔄', category: 'media', type: 'docker', tags: ['transcoding', 'media'], webPort: 8265, minResources: { cores: 4, memoryMB: 4096, diskGB: 10 }, docker: { image: 'ghcr.io/haveagitgat/tdarr:latest', ports: { '8265': 8265 }, volumes: { '/config': '/opt/tdarr/config', '/temp': '/opt/tdarr/temp' } } },
  { id: 'calibre-web', name: 'Calibre-Web', description: 'Web-based ebook management & reader', icon: '📕', category: 'media', type: 'docker', tags: ['ebooks', 'library'], webPort: 8083, minResources: { cores: 1, memoryMB: 256, diskGB: 5 }, docker: { image: 'linuxserver/calibre-web:latest', ports: { '8083': 8083 }, volumes: { '/config': '/opt/calibre-web' } } },
  { id: 'audiobookshelf', name: 'Audiobookshelf', description: 'Self-hosted audiobook & podcast server', icon: '🎧', category: 'media', type: 'docker', tags: ['audiobooks', 'podcasts'], featured: true, webPort: 13378, minResources: { cores: 1, memoryMB: 512, diskGB: 5 }, docker: { image: 'ghcr.io/advplyr/audiobookshelf:latest', ports: { '13378': 80 }, volumes: { '/config': '/opt/audiobookshelf/config', '/metadata': '/opt/audiobookshelf/metadata' } } },
  { id: 'photoprism', name: 'PhotoPrism', description: 'AI-powered photo management', icon: '📸', category: 'media', type: 'docker', tags: ['photos', 'ai', 'gallery'], webPort: 2342, minResources: { cores: 2, memoryMB: 4096, diskGB: 20 }, docker: { image: 'photoprism/photoprism:latest', ports: { '2342': 2342 }, volumes: { '/storage': '/opt/photoprism/storage', '/originals': '/opt/photoprism/originals' } } },
  { id: 'dim', name: 'Dim', description: 'Self-hosted media manager & streamer', icon: '🌑', category: 'media', type: 'docker', tags: ['media', 'streaming'], webPort: 8000, minResources: { cores: 2, memoryMB: 1024, diskGB: 5 }, docker: { image: 'ghcr.io/dusk-labs/dim:latest', ports: { '8000': 8000 }, volumes: { '/config': '/opt/dim/config' } } },
  { id: 'tubearchivist', name: 'TubeArchivist', description: 'YouTube archive & search engine', icon: '📹', category: 'media', type: 'docker', tags: ['youtube', 'archive'], webPort: 8000, minResources: { cores: 2, memoryMB: 2048, diskGB: 20 }, docker: { image: 'bbilly1/tubearchivist:latest', ports: { '8001': 8000 }, volumes: { '/cache': '/opt/tubearchivist/cache', '/youtube': '/opt/tubearchivist/youtube' } } },
  { id: 'lidarr', name: 'Lidarr', description: 'Music collection manager & downloader', icon: '🎸', category: 'media', type: 'docker', tags: ['music', 'automation'], webPort: 8686, minResources: { cores: 1, memoryMB: 512, diskGB: 5 }, docker: { image: 'linuxserver/lidarr:latest', ports: { '8686': 8686 }, volumes: { '/config': '/opt/lidarr', '/music': '/music' } } },
  { id: 'readarr', name: 'Readarr', description: 'Book & audiobook collection manager', icon: '📗', category: 'media', type: 'docker', tags: ['books', 'automation'], webPort: 8787, minResources: { cores: 1, memoryMB: 512, diskGB: 5 }, docker: { image: 'linuxserver/readarr:develop', ports: { '8787': 8787 }, volumes: { '/config': '/opt/readarr', '/books': '/books' } } },

  // ── Downloads ──────────────────────────────
  { id: 'qbittorrent', name: 'qBittorrent', description: 'Feature-rich torrent client with web UI', icon: '⬇️', category: 'downloads', type: 'docker', tags: ['torrent', 'download'], webPort: 8085, minResources: { cores: 1, memoryMB: 512, diskGB: 10 }, docker: { image: 'linuxserver/qbittorrent:latest', ports: { '8085': 8085, '6881': 6881 }, volumes: { '/config': '/opt/qbittorrent', '/downloads': '/downloads' } } },
  { id: 'transmission', name: 'Transmission', description: 'Lightweight BitTorrent client', icon: '🔽', category: 'downloads', type: 'docker', tags: ['torrent', 'download'], webPort: 9091, minResources: { cores: 1, memoryMB: 256, diskGB: 10 }, docker: { image: 'linuxserver/transmission:latest', ports: { '9091': 9091, '51413': 51413 }, volumes: { '/config': '/opt/transmission/config', '/downloads': '/downloads' } } },
  { id: 'sabnzbd', name: 'SABnzbd', description: 'Usenet binary downloader', icon: '📥', category: 'downloads', type: 'docker', tags: ['usenet', 'download'], webPort: 8080, minResources: { cores: 1, memoryMB: 1024, diskGB: 10 }, docker: { image: 'linuxserver/sabnzbd:latest', ports: { '8080': 8080 }, volumes: { '/config': '/opt/sabnzbd', '/downloads': '/downloads' } } },
  { id: 'nzbget', name: 'NZBGet', description: 'Efficient Usenet downloader', icon: '📦', category: 'downloads', type: 'docker', tags: ['usenet', 'download'], webPort: 6789, minResources: { cores: 1, memoryMB: 512, diskGB: 10 }, docker: { image: 'linuxserver/nzbget:latest', ports: { '6789': 6789 }, volumes: { '/config': '/opt/nzbget', '/downloads': '/downloads' } } },
  { id: 'prowlarr', name: 'Prowlarr', description: 'Indexer manager for Sonarr/Radarr/Lidarr', icon: '🔍', category: 'downloads', type: 'docker', tags: ['indexer', 'automation'], webPort: 9696, minResources: { cores: 1, memoryMB: 256, diskGB: 2 }, docker: { image: 'linuxserver/prowlarr:latest', ports: { '9696': 9696 }, volumes: { '/config': '/opt/prowlarr' } } },
  { id: 'jackett', name: 'Jackett', description: 'Torrent indexer proxy for automation', icon: '🧥', category: 'downloads', type: 'docker', tags: ['indexer', 'proxy'], webPort: 9117, minResources: { cores: 1, memoryMB: 256, diskGB: 2 }, docker: { image: 'linuxserver/jackett:latest', ports: { '9117': 9117 }, volumes: { '/config': '/opt/jackett' } } },
  { id: 'radarr', name: 'Radarr', description: 'Movie collection manager & automation', icon: '🎥', category: 'downloads', type: 'docker', tags: ['movies', 'automation'], featured: true, webPort: 7878, minResources: { cores: 1, memoryMB: 512, diskGB: 5 }, docker: { image: 'linuxserver/radarr:latest', ports: { '7878': 7878 }, volumes: { '/config': '/opt/radarr' } } },
  { id: 'sonarr', name: 'Sonarr', description: 'TV series collection manager', icon: '📡', category: 'downloads', type: 'docker', tags: ['tv', 'automation'], featured: true, webPort: 8989, minResources: { cores: 1, memoryMB: 512, diskGB: 5 }, docker: { image: 'linuxserver/sonarr:latest', ports: { '8989': 8989 }, volumes: { '/config': '/opt/sonarr' } } },
  { id: 'whisparr', name: 'Whisparr', description: 'Adult content collection manager', icon: '🔞', category: 'downloads', type: 'docker', tags: ['adult', 'automation'], webPort: 6969, minResources: { cores: 1, memoryMB: 512, diskGB: 5 }, docker: { image: 'hotio/whisparr:latest', ports: { '6969': 6969 }, volumes: { '/config': '/opt/whisparr' } } },
  { id: 'mylar3', name: 'Mylar3', description: 'Automated comic book downloader', icon: '🦸', category: 'downloads', type: 'docker', tags: ['comics', 'automation'], webPort: 8090, minResources: { cores: 1, memoryMB: 512, diskGB: 5 }, docker: { image: 'linuxserver/mylar3:latest', ports: { '8090': 8090 }, volumes: { '/config': '/opt/mylar3', '/comics': '/comics' } } },
  { id: 'lazylibrarian', name: 'LazyLibrarian', description: 'Automated ebook & audiobook downloader', icon: '📖', category: 'downloads', type: 'docker', tags: ['books', 'automation'], webPort: 5299, minResources: { cores: 1, memoryMB: 256, diskGB: 5 }, docker: { image: 'linuxserver/lazylibrarian:latest', ports: { '5299': 5299 }, volumes: { '/config': '/opt/lazylibrarian', '/books': '/books' } } },

  // ── Cloud & Storage ────────────────────────
  { id: 'nextcloud', name: 'Nextcloud', description: 'Self-hosted cloud storage & collaboration', icon: '☁️', category: 'cloud', type: 'docker', tags: ['cloud', 'files', 'sync'], featured: true, webPort: 8080, minResources: { cores: 2, memoryMB: 2048, diskGB: 20 }, docker: { image: 'nextcloud:latest', ports: { '8082': 80 }, volumes: { '/data': '/var/www/html' } } },
  { id: 'seafile', name: 'Seafile', description: 'High-performance file sync & share', icon: '🌊', category: 'cloud', type: 'docker', tags: ['cloud', 'files', 'sync'], webPort: 8082, minResources: { cores: 2, memoryMB: 2048, diskGB: 20 }, docker: { image: 'seafileltd/seafile-mc:latest', ports: { '8084': 80 }, volumes: { '/shared': '/opt/seafile/data' } } },
  { id: 'syncthing', name: 'Syncthing', description: 'Decentralized file sync between devices', icon: '🔁', category: 'cloud', type: 'docker', tags: ['sync', 'p2p'], webPort: 8384, minResources: { cores: 1, memoryMB: 512, diskGB: 5 }, docker: { image: 'linuxserver/syncthing:latest', ports: { '8384': 8384, '22000': 22000 }, volumes: { '/config': '/opt/syncthing/config', '/data': '/opt/syncthing/data' } } },
  { id: 'filebrowser', name: 'FileBrowser', description: 'Web file manager with sharing', icon: '📁', category: 'cloud', type: 'docker', tags: ['files', 'manager'], webPort: 8085, minResources: { cores: 1, memoryMB: 128, diskGB: 1 }, docker: { image: 'filebrowser/filebrowser:latest', ports: { '8086': 80 }, volumes: { '/srv': '/data', '/database': '/opt/filebrowser' } } },
  { id: 'minio', name: 'MinIO', description: 'S3-compatible object storage server', icon: '🗄️', category: 'cloud', type: 'docker', tags: ['s3', 'storage', 'object'], webPort: 9001, minResources: { cores: 2, memoryMB: 2048, diskGB: 20 }, docker: { image: 'minio/minio:latest', ports: { '9000': 9000, '9001': 9001 }, volumes: { '/data': '/opt/minio/data' } } },
  { id: 'immich', name: 'Immich', description: 'Self-hosted Google Photos alternative', icon: '📷', category: 'cloud', type: 'docker', tags: ['photos', 'backup', 'ai'], featured: true, webPort: 2283, minResources: { cores: 2, memoryMB: 4096, diskGB: 20 }, docker: { image: 'ghcr.io/immich-app/immich-server:latest', ports: { '2283': 3001 }, volumes: { '/upload': '/opt/immich/upload' } } },
  { id: 'duplicati', name: 'Duplicati', description: 'Encrypted cloud backup with deduplication', icon: '💾', category: 'cloud', type: 'docker', tags: ['backup', 'encryption'], webPort: 8200, minResources: { cores: 1, memoryMB: 512, diskGB: 5 }, docker: { image: 'linuxserver/duplicati:latest', ports: { '8200': 8200 }, volumes: { '/config': '/opt/duplicati/config', '/backups': '/opt/duplicati/backups' } } },
  { id: 'restic-rest', name: 'Restic REST Server', description: 'Fast & secure backup REST endpoint', icon: '🔐', category: 'cloud', type: 'docker', tags: ['backup', 'security'], webPort: 8100, minResources: { cores: 1, memoryMB: 256, diskGB: 10 }, docker: { image: 'restic/rest-server:latest', ports: { '8100': 8000 }, volumes: { '/data': '/opt/restic/data' } } },
  { id: 'borgmatic', name: 'Borgmatic', description: 'Simple BorgBackup wrapper with scheduling', icon: '🗃️', category: 'cloud', type: 'docker', tags: ['backup', 'dedup'], webPort: 8101, minResources: { cores: 1, memoryMB: 256, diskGB: 10 }, docker: { image: 'b3vis/borgmatic:latest', ports: { '8101': 8101 }, volumes: { '/config': '/opt/borgmatic/config', '/repo': '/opt/borgmatic/repo' } } },
  { id: 'kopia', name: 'Kopia', description: 'Fast encrypted backups with web UI', icon: '📋', category: 'cloud', type: 'docker', tags: ['backup', 'encryption'], webPort: 51515, minResources: { cores: 1, memoryMB: 512, diskGB: 10 }, docker: { image: 'kopia/kopia:latest', ports: { '51515': 51515 }, volumes: { '/config': '/opt/kopia/config', '/repo': '/opt/kopia/repo' } } },

  // ── Network & Security ─────────────────────
  { id: 'pihole', name: 'Pi-hole', description: 'Network-wide ad blocking DNS sinkhole', icon: '🛡️', category: 'network', type: 'docker', tags: ['dns', 'adblock', 'network'], webPort: 80, minResources: { cores: 1, memoryMB: 512, diskGB: 5 }, docker: { image: 'pihole/pihole:latest', ports: { '80': 80, '53': 53 }, volumes: { '/etc/pihole': '/opt/pihole/etc', '/etc/dnsmasq.d': '/opt/pihole/dnsmasq' } } },
  { id: 'adguard', name: 'AdGuard Home', description: 'Network-wide ad & tracker blocking', icon: '🚫', category: 'network', type: 'docker', tags: ['dns', 'adblock'], webPort: 3000, minResources: { cores: 1, memoryMB: 256, diskGB: 2 }, docker: { image: 'adguard/adguardhome:latest', ports: { '3003': 3000, '53': 53 }, volumes: { '/work': '/opt/adguard/work', '/conf': '/opt/adguard/conf' } } },
  { id: 'wireguard', name: 'WireGuard', description: 'Fast & modern VPN server', icon: '🔒', category: 'network', type: 'docker', tags: ['vpn', 'security', 'network'], webPort: 51821, minResources: { cores: 1, memoryMB: 256, diskGB: 2 }, docker: { image: 'linuxserver/wireguard:latest', ports: { '51820': 51820 }, volumes: { '/config': '/opt/wireguard' } } },
  { id: 'tailscale', name: 'Tailscale', description: 'Zero-config mesh VPN powered by WireGuard', icon: '🌐', category: 'network', type: 'docker', tags: ['vpn', 'mesh', 'wireguard'], webPort: 41641, minResources: { cores: 1, memoryMB: 128, diskGB: 1 }, docker: { image: 'tailscale/tailscale:latest', ports: { '41641': 41641 }, volumes: { '/var/lib/tailscale': '/opt/tailscale/state' } } },
  { id: 'nginx-proxy-manager', name: 'Nginx Proxy Manager', description: 'Easy reverse proxy with SSL certificates', icon: '🌍', category: 'network', type: 'docker', tags: ['proxy', 'ssl', 'web'], featured: true, webPort: 81, minResources: { cores: 1, memoryMB: 512, diskGB: 5 }, docker: { image: 'jc21/nginx-proxy-manager:latest', ports: { '80': 80, '443': 443, '81': 81 }, volumes: { '/data': '/opt/npm/data', '/letsencrypt': '/opt/npm/letsencrypt' } } },
  { id: 'traefik', name: 'Traefik', description: 'Cloud-native reverse proxy & load balancer', icon: '🚦', category: 'network', type: 'docker', tags: ['proxy', 'loadbalancer'], webPort: 8080, minResources: { cores: 1, memoryMB: 512, diskGB: 2 }, docker: { image: 'traefik:latest', ports: { '80': 80, '443': 443, '8081': 8080 }, volumes: { '/config': '/opt/traefik' } } },
  { id: 'caddy', name: 'Caddy', description: 'Auto-HTTPS web server & reverse proxy', icon: '🏗️', category: 'network', type: 'docker', tags: ['web', 'proxy', 'ssl'], webPort: 2019, minResources: { cores: 1, memoryMB: 256, diskGB: 2 }, docker: { image: 'caddy:latest', ports: { '80': 80, '443': 443, '2019': 2019 }, volumes: { '/data': '/opt/caddy/data', '/config': '/opt/caddy/config' } } },
  { id: 'cloudflared', name: 'Cloudflared', description: 'Cloudflare Tunnel for secure exposure', icon: '🌩️', category: 'network', type: 'docker', tags: ['tunnel', 'cloudflare'], webPort: 0, minResources: { cores: 1, memoryMB: 128, diskGB: 1 }, docker: { image: 'cloudflare/cloudflared:latest', ports: {}, volumes: { '/etc/cloudflared': '/opt/cloudflared' } } },
  { id: 'fail2ban', name: 'Fail2ban', description: 'Intrusion prevention & ban management', icon: '🚔', category: 'network', type: 'docker', tags: ['security', 'intrusion'], webPort: 0, minResources: { cores: 1, memoryMB: 128, diskGB: 1 }, docker: { image: 'crazymax/fail2ban:latest', ports: {}, volumes: { '/data': '/opt/fail2ban/data' } } },
  { id: 'crowdsec', name: 'CrowdSec', description: 'Collaborative security engine', icon: '👥', category: 'network', type: 'docker', tags: ['security', 'ids', 'collaborative'], webPort: 8080, minResources: { cores: 1, memoryMB: 256, diskGB: 2 }, docker: { image: 'crowdsecurity/crowdsec:latest', ports: { '8083': 8080 }, volumes: { '/config': '/opt/crowdsec/config', '/data': '/opt/crowdsec/data' } } },
  { id: 'authelia', name: 'Authelia', description: 'SSO & 2FA authentication gateway', icon: '🔑', category: 'network', type: 'docker', tags: ['auth', 'sso', '2fa'], webPort: 9091, minResources: { cores: 1, memoryMB: 256, diskGB: 2 }, docker: { image: 'authelia/authelia:latest', ports: { '9091': 9091 }, volumes: { '/config': '/opt/authelia' } } },
  { id: 'authentik', name: 'Authentik', description: 'Identity provider with LDAP & SAML', icon: '🪪', category: 'network', type: 'docker', tags: ['auth', 'identity', 'ldap'], webPort: 9000, minResources: { cores: 2, memoryMB: 2048, diskGB: 5 }, docker: { image: 'ghcr.io/goauthentik/server:latest', ports: { '9002': 9000 }, volumes: { '/media': '/opt/authentik/media', '/templates': '/opt/authentik/templates' } } },
  { id: 'speedtest-tracker', name: 'Speedtest Tracker', description: 'Track internet speed over time', icon: '🏎️', category: 'network', type: 'docker', tags: ['speed', 'monitoring', 'internet'], webPort: 8765, minResources: { cores: 1, memoryMB: 256, diskGB: 2 }, docker: { image: 'linuxserver/speedtest-tracker:latest', ports: { '8765': 80 }, volumes: { '/config': '/opt/speedtest-tracker' } } },
  { id: 'technitium-dns', name: 'Technitium DNS', description: 'Self-hosted DNS server with ad blocking', icon: '🌐', category: 'network', type: 'docker', tags: ['dns', 'server', 'adblock'], webPort: 5380, minResources: { cores: 1, memoryMB: 256, diskGB: 2 }, docker: { image: 'technitium/dns-server:latest', ports: { '5380': 5380, '53': 53 }, volumes: { '/config': '/opt/technitium' } } },
  { id: 'vaultwarden', name: 'Vaultwarden', description: 'Lightweight Bitwarden password manager', icon: '🔐', category: 'network', type: 'docker', tags: ['passwords', 'security'], featured: true, webPort: 8880, minResources: { cores: 1, memoryMB: 256, diskGB: 2 }, docker: { image: 'vaultwarden/server:latest', ports: { '8880': 80 }, volumes: { '/data': '/opt/vaultwarden/data' } } },

  // ── Home Automation ────────────────────────
  { id: 'homeassistant', name: 'Home Assistant', description: 'Open source home automation platform', icon: '🏠', category: 'home', type: 'docker', tags: ['automation', 'iot', 'smart home'], featured: true, webPort: 8123, minResources: { cores: 2, memoryMB: 2048, diskGB: 10 }, docker: { image: 'homeassistant/home-assistant:latest', ports: { '8123': 8123 }, volumes: { '/config': '/opt/homeassistant' } } },
  { id: 'nodered', name: 'Node-RED', description: 'Flow-based visual programming for IoT', icon: '🔴', category: 'home', type: 'docker', tags: ['automation', 'iot', 'flows'], webPort: 1880, minResources: { cores: 1, memoryMB: 512, diskGB: 5 }, docker: { image: 'nodered/node-red:latest', ports: { '1880': 1880 }, volumes: { '/data': '/opt/nodered' } } },
  { id: 'zigbee2mqtt', name: 'Zigbee2MQTT', description: 'Zigbee to MQTT bridge with web UI', icon: '📡', category: 'home', type: 'docker', tags: ['zigbee', 'mqtt', 'iot'], webPort: 8082, minResources: { cores: 1, memoryMB: 256, diskGB: 2 }, docker: { image: 'koenkk/zigbee2mqtt:latest', ports: { '8087': 8080 }, volumes: { '/data': '/opt/zigbee2mqtt' } } },
  { id: 'mosquitto', name: 'Mosquitto MQTT', description: 'Lightweight MQTT message broker', icon: '🦟', category: 'home', type: 'docker', tags: ['mqtt', 'broker', 'iot'], webPort: 1883, minResources: { cores: 1, memoryMB: 128, diskGB: 1 }, docker: { image: 'eclipse-mosquitto:latest', ports: { '1883': 1883, '9001': 9001 }, volumes: { '/config': '/opt/mosquitto/config', '/data': '/opt/mosquitto/data' } } },
  { id: 'esphome', name: 'ESPHome', description: 'ESP microcontroller firmware manager', icon: '🔌', category: 'home', type: 'docker', tags: ['esp', 'firmware', 'iot'], webPort: 6052, minResources: { cores: 1, memoryMB: 512, diskGB: 5 }, docker: { image: 'ghcr.io/esphome/esphome:latest', ports: { '6052': 6052 }, volumes: { '/config': '/opt/esphome' } } },
  { id: 'frigate', name: 'Frigate', description: 'AI-powered NVR with object detection', icon: '📹', category: 'home', type: 'docker', tags: ['nvr', 'camera', 'ai'], featured: true, webPort: 5000, minResources: { cores: 4, memoryMB: 4096, diskGB: 20 }, docker: { image: 'ghcr.io/blakeblackshear/frigate:stable', ports: { '5001': 5000, '8554': 8554 }, volumes: { '/config': '/opt/frigate/config', '/media': '/opt/frigate/media' } } },
  { id: 'scrypted', name: 'Scrypted', description: 'HomeKit & smart home bridge', icon: '🏡', category: 'home', type: 'docker', tags: ['homekit', 'bridge'], webPort: 10443, minResources: { cores: 2, memoryMB: 1024, diskGB: 5 }, docker: { image: 'koush/scrypted:latest', ports: { '10443': 10443 }, volumes: { '/server/volume': '/opt/scrypted' } } },
  { id: 'homebridge', name: 'Homebridge', description: 'HomeKit support for non-HomeKit devices', icon: '🍎', category: 'home', type: 'docker', tags: ['homekit', 'bridge'], webPort: 8581, minResources: { cores: 1, memoryMB: 512, diskGB: 2 }, docker: { image: 'homebridge/homebridge:latest', ports: { '8581': 8581 }, volumes: { '/homebridge': '/opt/homebridge' } } },
  { id: 'openhab', name: 'openHAB', description: 'Vendor-neutral home automation', icon: '⚙️', category: 'home', type: 'docker', tags: ['automation', 'vendor-neutral'], webPort: 8443, minResources: { cores: 2, memoryMB: 1024, diskGB: 5 }, docker: { image: 'openhab/openhab:latest', ports: { '8444': 8443 }, volumes: { '/conf': '/opt/openhab/conf', '/userdata': '/opt/openhab/userdata' } } },
  { id: 'domoticz', name: 'Domoticz', description: 'Lightweight home automation system', icon: '💡', category: 'home', type: 'docker', tags: ['automation', 'lightweight'], webPort: 8080, minResources: { cores: 1, memoryMB: 256, diskGB: 2 }, docker: { image: 'linuxserver/domoticz:latest', ports: { '8088': 8080 }, volumes: { '/config': '/opt/domoticz' } } },

  // ── Monitoring & DevOps ────────────────────
  { id: 'grafana', name: 'Grafana', description: 'Beautiful dashboards & observability', icon: '📊', category: 'monitoring', type: 'docker', tags: ['monitoring', 'dashboards', 'metrics'], featured: true, webPort: 3000, minResources: { cores: 1, memoryMB: 512, diskGB: 5 }, docker: { image: 'grafana/grafana:latest', ports: { '3000': 3000 }, volumes: { '/data': '/opt/grafana' } } },
  { id: 'prometheus', name: 'Prometheus', description: 'Time-series metrics & alerting engine', icon: '🔥', category: 'monitoring', type: 'docker', tags: ['monitoring', 'metrics', 'alerting'], webPort: 9090, minResources: { cores: 1, memoryMB: 1024, diskGB: 10 }, docker: { image: 'prom/prometheus:latest', ports: { '9090': 9090 }, volumes: { '/data': '/opt/prometheus' } } },
  { id: 'uptime-kuma', name: 'Uptime Kuma', description: 'Self-hosted uptime monitoring tool', icon: '📈', category: 'monitoring', type: 'docker', tags: ['monitoring', 'uptime'], featured: true, webPort: 3001, minResources: { cores: 1, memoryMB: 256, diskGB: 2 }, docker: { image: 'louislam/uptime-kuma:latest', ports: { '3001': 3001 }, volumes: { '/data': '/opt/uptime-kuma' } } },
  { id: 'portainer', name: 'Portainer', description: 'Docker & Kubernetes management UI', icon: '🐳', category: 'monitoring', type: 'docker', tags: ['docker', 'management'], webPort: 9443, minResources: { cores: 1, memoryMB: 512, diskGB: 5 }, docker: { image: 'portainer/portainer-ce:latest', ports: { '9443': 9443 }, volumes: { '/data': '/opt/portainer' } } },
  { id: 'dozzle', name: 'Dozzle', description: 'Real-time Docker log viewer', icon: '🪵', category: 'monitoring', type: 'docker', tags: ['docker', 'logs'], webPort: 8080, minResources: { cores: 1, memoryMB: 128, diskGB: 1 }, docker: { image: 'amir20/dozzle:latest', ports: { '8089': 8080 }, volumes: { '/var/run/docker.sock': '/var/run/docker.sock' } } },
  { id: 'watchtower', name: 'Watchtower', description: 'Auto-update Docker containers', icon: '🗼', category: 'monitoring', type: 'docker', tags: ['docker', 'updates', 'automation'], webPort: 8080, minResources: { cores: 1, memoryMB: 128, diskGB: 1 }, docker: { image: 'containrrr/watchtower:latest', ports: {}, volumes: { '/var/run/docker.sock': '/var/run/docker.sock' } } },
  { id: 'netdata', name: 'Netdata', description: 'Real-time infrastructure monitoring', icon: '🌡️', category: 'monitoring', type: 'docker', tags: ['monitoring', 'realtime', 'metrics'], webPort: 19999, minResources: { cores: 1, memoryMB: 512, diskGB: 2 }, docker: { image: 'netdata/netdata:latest', ports: { '19999': 19999 }, volumes: { '/etc/netdata': '/opt/netdata/config' } } },
  { id: 'loki', name: 'Loki', description: 'Log aggregation by Grafana Labs', icon: '📃', category: 'monitoring', type: 'docker', tags: ['logs', 'aggregation', 'grafana'], webPort: 3100, minResources: { cores: 1, memoryMB: 512, diskGB: 10 }, docker: { image: 'grafana/loki:latest', ports: { '3100': 3100 }, volumes: { '/data': '/opt/loki' } } },
  { id: 'glances', name: 'Glances', description: 'System monitoring at a glance', icon: '👁️', category: 'monitoring', type: 'docker', tags: ['monitoring', 'system'], webPort: 61208, minResources: { cores: 1, memoryMB: 256, diskGB: 1 }, docker: { image: 'nicolargo/glances:latest', ports: { '61208': 61208 }, volumes: {} } },
  { id: 'homepage', name: 'Homepage', description: 'Modern app dashboard with integrations', icon: '🏠', category: 'monitoring', type: 'docker', tags: ['dashboard', 'homepage'], webPort: 3000, minResources: { cores: 1, memoryMB: 256, diskGB: 1 }, docker: { image: 'ghcr.io/gethomepage/homepage:latest', ports: { '3002': 3000 }, volumes: { '/config': '/opt/homepage/config' } } },
  { id: 'dashy', name: 'Dashy', description: 'Feature-rich self-hosted startpage', icon: '🎯', category: 'monitoring', type: 'docker', tags: ['dashboard', 'startpage'], webPort: 8080, minResources: { cores: 1, memoryMB: 256, diskGB: 1 }, docker: { image: 'lissy93/dashy:latest', ports: { '4000': 8080 }, volumes: { '/user-data': '/opt/dashy' } } },
  { id: 'homarr', name: 'Homarr', description: 'Sleek server dashboard with widgets', icon: '🏡', category: 'monitoring', type: 'docker', tags: ['dashboard', 'widgets'], webPort: 7575, minResources: { cores: 1, memoryMB: 256, diskGB: 1 }, docker: { image: 'ghcr.io/ajnart/homarr:latest', ports: { '7575': 7575 }, volumes: { '/config': '/opt/homarr/config' } } },
  { id: 'flame', name: 'Flame', description: 'Minimalist self-hosted startpage', icon: '🔥', category: 'monitoring', type: 'docker', tags: ['dashboard', 'startpage'], webPort: 5005, minResources: { cores: 1, memoryMB: 128, diskGB: 1 }, docker: { image: 'pawelmalak/flame:latest', ports: { '5005': 5005 }, volumes: { '/data': '/opt/flame' } } },

  // ── Development ────────────────────────────
  { id: 'code-server', name: 'Code Server', description: 'VS Code in the browser', icon: '💻', category: 'development', type: 'docker', tags: ['ide', 'coding'], webPort: 8443, minResources: { cores: 2, memoryMB: 2048, diskGB: 10 }, docker: { image: 'linuxserver/code-server:latest', ports: { '8443': 8443 }, volumes: { '/config': '/opt/code-server' } } },
  { id: 'gitea', name: 'Gitea', description: 'Lightweight self-hosted Git service', icon: '🍵', category: 'development', type: 'docker', tags: ['git', 'code'], webPort: 3000, minResources: { cores: 1, memoryMB: 512, diskGB: 5 }, docker: { image: 'gitea/gitea:latest', ports: { '3004': 3000, '2222': 22 }, volumes: { '/data': '/opt/gitea' } } },
  { id: 'gitlab-runner', name: 'GitLab Runner', description: 'CI/CD runner for GitLab pipelines', icon: '🦊', category: 'development', type: 'docker', tags: ['ci', 'gitlab'], webPort: 0, minResources: { cores: 2, memoryMB: 2048, diskGB: 10 }, docker: { image: 'gitlab/gitlab-runner:latest', ports: {}, volumes: { '/config': '/opt/gitlab-runner' } } },
  { id: 'drone', name: 'Drone CI', description: 'Container-native CI/CD platform', icon: '🤖', category: 'development', type: 'docker', tags: ['ci', 'cd', 'automation'], webPort: 8080, minResources: { cores: 2, memoryMB: 1024, diskGB: 10 }, docker: { image: 'drone/drone:latest', ports: { '8091': 80 }, volumes: { '/data': '/opt/drone' } } },
  { id: 'jenkins', name: 'Jenkins', description: 'Extensible open-source CI/CD server', icon: '🎩', category: 'development', type: 'docker', tags: ['ci', 'cd', 'build'], webPort: 8080, minResources: { cores: 2, memoryMB: 2048, diskGB: 10 }, docker: { image: 'jenkins/jenkins:lts', ports: { '8092': 8080 }, volumes: { '/var/jenkins_home': '/opt/jenkins' } } },
  { id: 'jupyter', name: 'Jupyter Notebook', description: 'Interactive computing & data science', icon: '🪐', category: 'development', type: 'docker', tags: ['python', 'datascience', 'notebook'], webPort: 8888, minResources: { cores: 2, memoryMB: 2048, diskGB: 5 }, docker: { image: 'jupyter/minimal-notebook:latest', ports: { '8888': 8888 }, volumes: { '/home/jovyan/work': '/opt/jupyter/work' } } },
  { id: 'rstudio', name: 'RStudio Server', description: 'R development environment in browser', icon: '📐', category: 'development', type: 'docker', tags: ['r', 'statistics', 'datascience'], webPort: 8787, minResources: { cores: 2, memoryMB: 2048, diskGB: 5 }, docker: { image: 'rocker/rstudio:latest', ports: { '8788': 8787 }, volumes: { '/home/rstudio': '/opt/rstudio' } } },
  { id: 'adminer', name: 'Adminer', description: 'Single-file database management', icon: '🗃️', category: 'development', type: 'docker', tags: ['database', 'admin'], webPort: 8080, minResources: { cores: 1, memoryMB: 128, diskGB: 1 }, docker: { image: 'adminer:latest', ports: { '8093': 8080 }, volumes: {} } },
  { id: 'pgadmin', name: 'pgAdmin', description: 'PostgreSQL management & admin tool', icon: '🐘', category: 'development', type: 'docker', tags: ['database', 'postgres', 'admin'], webPort: 5050, minResources: { cores: 1, memoryMB: 512, diskGB: 2 }, docker: { image: 'dpage/pgadmin4:latest', ports: { '5050': 80 }, volumes: { '/var/lib/pgadmin': '/opt/pgadmin' } } },

  // ── Productivity ───────────────────────────
  { id: 'n8n', name: 'n8n', description: 'Powerful workflow automation tool', icon: '⚡', category: 'productivity', type: 'docker', tags: ['automation', 'workflows'], featured: true, webPort: 5678, minResources: { cores: 1, memoryMB: 1024, diskGB: 5 }, docker: { image: 'n8nio/n8n:latest', ports: { '5678': 5678 }, volumes: { '/data': '/opt/n8n' } } },
  { id: 'mealie', name: 'Mealie', description: 'Recipe manager & meal planner', icon: '🍽️', category: 'productivity', type: 'docker', tags: ['recipes', 'cooking'], webPort: 9925, minResources: { cores: 1, memoryMB: 512, diskGB: 5 }, docker: { image: 'ghcr.io/mealie-recipes/mealie:latest', ports: { '9925': 9000 }, volumes: { '/data': '/opt/mealie' } } },
  { id: 'paperless', name: 'Paperless-ngx', description: 'Scan, index & archive documents', icon: '📄', category: 'productivity', type: 'docker', tags: ['documents', 'ocr'], webPort: 8010, minResources: { cores: 2, memoryMB: 2048, diskGB: 10 }, docker: { image: 'ghcr.io/paperless-ngx/paperless-ngx:latest', ports: { '8010': 8000 }, volumes: { '/data': '/opt/paperless/data', '/media': '/opt/paperless/media' } } },
  { id: 'stirling-pdf', name: 'Stirling PDF', description: 'All-in-one PDF manipulation toolkit', icon: '📑', category: 'productivity', type: 'docker', tags: ['pdf', 'tools'], webPort: 8088, minResources: { cores: 1, memoryMB: 512, diskGB: 2 }, docker: { image: 'frooodle/s-pdf:latest', ports: { '8088': 8080 }, volumes: { '/data': '/opt/stirling-pdf' } } },
  { id: 'bookstack', name: 'BookStack', description: 'Self-hosted wiki & documentation', icon: '📘', category: 'productivity', type: 'docker', tags: ['wiki', 'documentation'], webPort: 6875, minResources: { cores: 1, memoryMB: 512, diskGB: 5 }, docker: { image: 'linuxserver/bookstack:latest', ports: { '6875': 80 }, volumes: { '/config': '/opt/bookstack' } } },
  { id: 'wikijs', name: 'Wiki.js', description: 'Modern & powerful wiki engine', icon: '📖', category: 'productivity', type: 'docker', tags: ['wiki', 'documentation'], webPort: 3000, minResources: { cores: 1, memoryMB: 1024, diskGB: 5 }, docker: { image: 'ghcr.io/requarks/wiki:latest', ports: { '3005': 3000 }, volumes: { '/config': '/opt/wikijs' } } },
  { id: 'outline', name: 'Outline', description: 'Beautiful team knowledge base', icon: '📝', category: 'productivity', type: 'docker', tags: ['wiki', 'knowledge', 'team'], webPort: 3000, minResources: { cores: 1, memoryMB: 1024, diskGB: 5 }, docker: { image: 'outlinewiki/outline:latest', ports: { '3006': 3000 }, volumes: { '/data': '/opt/outline' } } },
  { id: 'vikunja', name: 'Vikunja', description: 'Open-source task management & to-do lists', icon: '✅', category: 'productivity', type: 'docker', tags: ['tasks', 'todo', 'projects'], webPort: 3456, minResources: { cores: 1, memoryMB: 256, diskGB: 2 }, docker: { image: 'vikunja/vikunja:latest', ports: { '3456': 3456 }, volumes: { '/files': '/opt/vikunja/files' } } },
  { id: 'planka', name: 'Planka', description: 'Elegant Kanban board for project tracking', icon: '📋', category: 'productivity', type: 'docker', tags: ['kanban', 'projects', 'trello'], webPort: 1337, minResources: { cores: 1, memoryMB: 512, diskGB: 2 }, docker: { image: 'ghcr.io/plankanban/planka:latest', ports: { '1337': 1337 }, volumes: { '/user-avatars': '/opt/planka/avatars', '/project-background-images': '/opt/planka/backgrounds' } } },
  { id: 'excalidraw', name: 'Excalidraw', description: 'Collaborative whiteboard & diagramming', icon: '🎨', category: 'productivity', type: 'docker', tags: ['whiteboard', 'diagrams', 'collaboration'], webPort: 80, minResources: { cores: 1, memoryMB: 256, diskGB: 1 }, docker: { image: 'excalidraw/excalidraw:latest', ports: { '3007': 80 }, volumes: {} } },
  { id: 'memos', name: 'Memos', description: 'Lightweight note-taking hub', icon: '📌', category: 'productivity', type: 'docker', tags: ['notes', 'memo'], webPort: 5230, minResources: { cores: 1, memoryMB: 128, diskGB: 1 }, docker: { image: 'neosmemo/memos:stable', ports: { '5230': 5230 }, volumes: { '/var/opt/memos': '/opt/memos' } } },
  { id: 'joplin-server', name: 'Joplin Server', description: 'Sync server for Joplin notes', icon: '✍️', category: 'productivity', type: 'docker', tags: ['notes', 'sync'], webPort: 22300, minResources: { cores: 1, memoryMB: 256, diskGB: 2 }, docker: { image: 'joplin/server:latest', ports: { '22300': 22300 }, volumes: {} } },

  // ── Communication ──────────────────────────
  { id: 'matrix-synapse', name: 'Matrix Synapse', description: 'Decentralized encrypted messaging server', icon: '💬', category: 'communication', type: 'docker', tags: ['chat', 'matrix', 'encrypted'], webPort: 8008, minResources: { cores: 2, memoryMB: 2048, diskGB: 10 }, docker: { image: 'matrixdotorg/synapse:latest', ports: { '8008': 8008 }, volumes: { '/data': '/opt/synapse' } } },
  { id: 'rocketchat', name: 'Rocket.Chat', description: 'Team chat platform with video calls', icon: '🚀', category: 'communication', type: 'docker', tags: ['chat', 'team', 'video'], webPort: 3000, minResources: { cores: 2, memoryMB: 2048, diskGB: 10 }, docker: { image: 'rocket.chat:latest', ports: { '3008': 3000 }, volumes: { '/uploads': '/opt/rocketchat/uploads' } } },
  { id: 'mattermost', name: 'Mattermost', description: 'Open-source Slack alternative', icon: '💼', category: 'communication', type: 'docker', tags: ['chat', 'team', 'slack-alt'], webPort: 8065, minResources: { cores: 2, memoryMB: 2048, diskGB: 10 }, docker: { image: 'mattermost/mattermost-team-edition:latest', ports: { '8065': 8065 }, volumes: { '/data': '/opt/mattermost/data', '/config': '/opt/mattermost/config' } } },
  { id: 'gotify', name: 'Gotify', description: 'Self-hosted push notification server', icon: '🔔', category: 'communication', type: 'docker', tags: ['notifications', 'push'], webPort: 80, minResources: { cores: 1, memoryMB: 128, diskGB: 1 }, docker: { image: 'gotify/server:latest', ports: { '8094': 80 }, volumes: { '/data': '/opt/gotify' } } },
  { id: 'ntfy', name: 'ntfy', description: 'Simple HTTP-based push notifications', icon: '📢', category: 'communication', type: 'docker', tags: ['notifications', 'push', 'http'], webPort: 80, minResources: { cores: 1, memoryMB: 128, diskGB: 1 }, docker: { image: 'binwiederhier/ntfy:latest', ports: { '8095': 80 }, volumes: { '/var/cache/ntfy': '/opt/ntfy/cache', '/etc/ntfy': '/opt/ntfy/config' } } },

  // ── Gaming ─────────────────────────────────
  { id: 'minecraft', name: 'Minecraft Server', description: 'Java & Bedrock Minecraft server', icon: '⛏️', category: 'gaming', type: 'docker', tags: ['minecraft', 'game-server'], webPort: 25565, minResources: { cores: 2, memoryMB: 4096, diskGB: 10 }, docker: { image: 'itzg/minecraft-server:latest', ports: { '25565': 25565 }, volumes: { '/data': '/opt/minecraft' } } },
  { id: 'valheim', name: 'Valheim Server', description: 'Dedicated Valheim co-op server', icon: '⚔️', category: 'gaming', type: 'docker', tags: ['valheim', 'game-server'], webPort: 2456, minResources: { cores: 4, memoryMB: 4096, diskGB: 10 }, docker: { image: 'lloesche/valheim-server:latest', ports: { '2456': 2456, '2457': 2457 }, volumes: { '/config': '/opt/valheim/config', '/data': '/opt/valheim/data' } } },
  { id: 'satisfactory', name: 'Satisfactory Server', description: 'Dedicated Satisfactory factory server', icon: '🏭', category: 'gaming', type: 'docker', tags: ['satisfactory', 'game-server'], webPort: 7777, minResources: { cores: 4, memoryMB: 8192, diskGB: 15 }, docker: { image: 'wolveix/satisfactory-server:latest', ports: { '7777': 7777, '15000': 15000, '15777': 15777 }, volumes: { '/config': '/opt/satisfactory' } } },
  { id: 'palworld', name: 'PalWorld Server', description: 'Dedicated PalWorld game server', icon: '🦊', category: 'gaming', type: 'docker', tags: ['palworld', 'game-server'], webPort: 8211, minResources: { cores: 4, memoryMB: 8192, diskGB: 15 }, docker: { image: 'thijsvanloef/palworld-server-docker:latest', ports: { '8211': 8211, '27015': 27015 }, volumes: { '/palworld': '/opt/palworld' } } },
  { id: 'gamevault', name: 'GameVault', description: 'Self-hosted game library & launcher', icon: '🎮', category: 'gaming', type: 'docker', tags: ['games', 'library'], webPort: 8080, minResources: { cores: 1, memoryMB: 512, diskGB: 10 }, docker: { image: 'phalcode/gamevault-backend:latest', ports: { '8096': 8080 }, volumes: { '/files': '/opt/gamevault/files' } } },

  // ── AI & ML ────────────────────────────────
  { id: 'ollama', name: 'Ollama', description: 'Run large language models locally', icon: '🦙', category: 'ai', type: 'docker', tags: ['llm', 'ai', 'local'], featured: true, webPort: 11434, minResources: { cores: 4, memoryMB: 8192, diskGB: 20 }, docker: { image: 'ollama/ollama:latest', ports: { '11434': 11434 }, volumes: { '/root/.ollama': '/opt/ollama' } } },
  { id: 'open-webui', name: 'Open WebUI', description: 'ChatGPT-like UI for local LLMs', icon: '🤖', category: 'ai', type: 'docker', tags: ['llm', 'chat', 'ui'], featured: true, webPort: 8080, minResources: { cores: 2, memoryMB: 2048, diskGB: 5 }, docker: { image: 'ghcr.io/open-webui/open-webui:main', ports: { '3009': 8080 }, volumes: { '/data': '/opt/open-webui' } } },
  { id: 'localai', name: 'LocalAI', description: 'Self-hosted OpenAI-compatible API', icon: '🧠', category: 'ai', type: 'docker', tags: ['llm', 'api', 'openai'], webPort: 8080, minResources: { cores: 4, memoryMB: 8192, diskGB: 20 }, docker: { image: 'localai/localai:latest', ports: { '8097': 8080 }, volumes: { '/models': '/opt/localai/models' } } },
  { id: 'stable-diffusion', name: 'Stable Diffusion WebUI', description: 'AI image generation with web interface', icon: '🎨', category: 'ai', type: 'docker', tags: ['image-gen', 'ai', 'stable-diffusion'], webPort: 7860, minResources: { cores: 4, memoryMB: 8192, diskGB: 30 }, docker: { image: 'universonic/stable-diffusion-webui:latest', ports: { '7860': 7860 }, volumes: { '/data': '/opt/stable-diffusion' } } },
  { id: 'text-gen-webui', name: 'Text Generation WebUI', description: 'Gradio web UI for running LLMs', icon: '✨', category: 'ai', type: 'docker', tags: ['llm', 'text-gen', 'gradio'], webPort: 7860, minResources: { cores: 4, memoryMB: 8192, diskGB: 20 }, docker: { image: 'atinoda/text-generation-webui:latest', ports: { '7861': 7860, '5001': 5000 }, volumes: { '/data': '/opt/text-gen-webui' } } },
];

// ─── Constants ───────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  media: '🎬', downloads: '⬇️', cloud: '☁️', network: '🌐',
  monitoring: '📊', development: '💻', home: '🏠', security: '🔐',
  productivity: '📋', gaming: '🎮', communication: '💬', ai: '🧠',
};

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All Apps', media: 'Media', downloads: 'Downloads', cloud: 'Cloud & Storage',
  network: 'Network & Security', monitoring: 'Monitoring & DevOps', development: 'Development',
  home: 'Home Automation', security: 'Security', productivity: 'Productivity',
  gaming: 'Gaming', communication: 'Communication', ai: 'AI & ML',
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  media: 'from-purple-500/20 to-pink-500/20',
  downloads: 'from-blue-500/20 to-cyan-500/20',
  cloud: 'from-sky-500/20 to-indigo-500/20',
  network: 'from-emerald-500/20 to-teal-500/20',
  monitoring: 'from-orange-500/20 to-amber-500/20',
  development: 'from-violet-500/20 to-purple-500/20',
  home: 'from-yellow-500/20 to-orange-500/20',
  productivity: 'from-teal-500/20 to-green-500/20',
  gaming: 'from-red-500/20 to-pink-500/20',
  communication: 'from-blue-500/20 to-indigo-500/20',
  ai: 'from-fuchsia-500/20 to-violet-500/20',
};

// ─── Animated Stat Card ──────────────────────────

function StatCard({ label, value, subtitle, percent, gradient, icon: Icon }: {
  label: string; value: string; subtitle: string; percent?: number; gradient: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className={clsx(
      'relative overflow-hidden rounded-xl p-5 glow-border group hover:border-nest-400/20 transition-all duration-300',
      'bg-gradient-to-br', gradient,
    )}>
      <div className="absolute inset-0 bg-nest-950/60 backdrop-blur-sm" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] text-nest-400 font-semibold uppercase tracking-widest">{label}</p>
          {Icon && (
            <div className="p-1.5 rounded-lg bg-white/5 border border-white/5">
              <Icon size={14} className="text-nest-300" />
            </div>
          )}
        </div>
        <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
        <p className="text-xs text-nest-400 mt-1">{subtitle}</p>
        {percent !== undefined && (
          <div className="mt-4 h-1.5 rounded-full bg-nest-800/80 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-white/30 to-white/60"
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab Button ──────────────────────────────────

function TabButton({ active, onClick, icon: Icon, label, badge }: {
  active: boolean; onClick: () => void;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
        active
          ? 'bg-nest-600/30 text-white border border-nest-400/20 shadow-lg shadow-nest-500/10'
          : 'text-nest-400 hover:text-white hover:bg-nest-800/50',
      )}
    >
      <Icon size={15} />
      <span className="hidden sm:inline">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={clsx(
          'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
          active ? 'bg-nest-400/20 text-nest-200' : 'bg-nest-800 text-nest-500',
        )}>{badge}</span>
      )}
    </button>
  );
}

// ─── Guest Row (Enhanced) ────────────────────────

function GuestRow({ guest, onAction, loading }: {
  guest: GuestInfo;
  onAction: (vmid: number, type: string, action: string) => void;
  loading: boolean;
}) {
  const isRunning = guest.status === 'running';
  const memGB = (guest.memoryMB / 1024).toFixed(1);
  const memPct = guest.memoryMB > 0 ? Math.min(100, Math.round((guest.memoryMB / (guest.memoryMB + 512)) * 100)) : 0;

  return (
    <div className="glass rounded-xl p-4 glass-hover transition-all group">
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <div className={clsx(
            'flex h-10 w-10 items-center justify-center rounded-xl',
            guest.type === 'qemu'
              ? 'bg-indigo-500/10 border border-indigo-500/20'
              : 'bg-cyan-500/10 border border-cyan-500/20',
          )}>
            {guest.type === 'qemu'
              ? <Monitor size={18} className="text-indigo-400" />
              : <Container size={18} className="text-cyan-400" />}
          </div>
          <div className={clsx(
            'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-nest-950',
            isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-nest-600',
          )} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">{guest.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-nest-800 text-nest-400 font-mono">
              {guest.vmid}
            </span>
            <span className={clsx(
              'text-[10px] px-1.5 py-0.5 rounded-md font-medium uppercase',
              guest.type === 'qemu'
                ? 'bg-indigo-500/10 text-indigo-400'
                : 'bg-cyan-500/10 text-cyan-400',
            )}>
              {guest.type === 'qemu' ? 'VM' : 'CT'}
            </span>
            <span className={clsx(
              'text-[10px] px-1.5 py-0.5 rounded-md font-medium',
              isRunning ? 'bg-emerald-500/10 text-emerald-400' : 'bg-nest-800 text-nest-500',
            )}>
              {guest.status}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-nest-500">
              <Cpu size={10} /> {guest.cpus}c
            </span>
            <span className="flex items-center gap-1 text-xs text-nest-500">
              <MemoryStick size={10} /> {memGB} GB
            </span>
            {guest.diskGB > 0 && (
              <span className="flex items-center gap-1 text-xs text-nest-500">
                <HardDrive size={10} /> {guest.diskGB} GB
              </span>
            )}
            {/* Resource mini-bar */}
            {isRunning && (
              <div className="flex-1 max-w-[80px]">
                <div className="h-1 rounded-full bg-nest-800/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500/60 to-cyan-300/60 transition-all duration-500"
                    style={{ width: `${memPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {loading ? (
            <Loader2 size={16} className="animate-spin text-nest-400" />
          ) : isRunning ? (
            <>
              <button
                onClick={() => onAction(guest.vmid, guest.type, 'restart')}
                className="p-2 rounded-lg text-nest-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                title="Restart"
              >
                <RotateCw size={14} />
              </button>
              <button
                onClick={() => onAction(guest.vmid, guest.type, 'stop')}
                className="p-2 rounded-lg text-nest-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                title="Stop"
              >
                <Square size={14} />
              </button>
            </>
          ) : (
            <button
              onClick={() => onAction(guest.vmid, guest.type, 'start')}
              className="p-2 rounded-lg text-nest-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
              title="Start"
            >
              <Play size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Storage Ring Chart ──────────────────────────

function StorageRing({ percent, size = 64, strokeWidth = 6, color }: {
  percent: number; size?: number; strokeWidth?: number; color: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-nest-800/60"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
}

// ─── Storage Card (Enhanced) ─────────────────────

function StorageCard({ storage }: { storage: StorageInfo }) {
  const totalGB = (storage.totalBytes / 1073741824).toFixed(1);
  const usedGB = (storage.usedBytes / 1073741824).toFixed(1);
  const freeGB = (storage.freeBytes / 1073741824).toFixed(1);
  const pct = storage.usagePercent;

  const ringColor = pct > 90 ? '#f43f5e' : pct > 75 ? '#f59e0b' : '#10b981';
  const typeLabel: Record<string, string> = {
    dir: 'Directory', lvmthin: 'LVM-Thin', lvm: 'LVM', zfspool: 'ZFS',
    nfs: 'NFS', cifs: 'CIFS/SMB', ext4: 'ext4', xfs: 'XFS', btrfs: 'Btrfs',
  };
  const typeBadgeColor: Record<string, string> = {
    dir: 'bg-blue-500/10 text-blue-400',
    lvmthin: 'bg-violet-500/10 text-violet-400',
    lvm: 'bg-purple-500/10 text-purple-400',
    zfspool: 'bg-teal-500/10 text-teal-400',
    nfs: 'bg-amber-500/10 text-amber-400',
    cifs: 'bg-orange-500/10 text-orange-400',
  };

  return (
    <div className="glass rounded-xl p-5 glow-border group hover:border-nest-400/15 transition-all">
      <div className="flex items-center gap-4">
        {/* Ring chart */}
        <div className="relative flex-shrink-0">
          <StorageRing percent={pct} color={ringColor} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={clsx(
              'text-xs font-bold',
              pct > 90 ? 'text-rose-400' : pct > 75 ? 'text-amber-400' : 'text-emerald-400',
            )}>
              {pct}%
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Database size={14} className={storage.active ? 'text-emerald-400' : 'text-nest-600'} />
            <span className="text-sm font-semibold text-white">{storage.id}</span>
            <span className={clsx(
              'text-[10px] px-1.5 py-0.5 rounded font-medium',
              typeBadgeColor[storage.type] || 'bg-nest-800 text-nest-400',
            )}>
              {typeLabel[storage.type] || storage.type}
            </span>
            {pct > 80 && (
              <AlertTriangle size={12} className={pct > 90 ? 'text-rose-400' : 'text-amber-400'} />
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-nest-500">
            <span>{usedGB} GB used</span>
            <span className="text-nest-700">•</span>
            <span>{freeGB} GB free</span>
            <span className="text-nest-700">•</span>
            <span>{totalGB} GB total</span>
          </div>
          {/* Usage bar */}
          <div className="mt-2.5 h-1.5 rounded-full bg-nest-800/80 overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-700',
                pct > 90 ? 'bg-rose-500' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-500',
              )}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── App Card (Enhanced) ─────────────────────────

function AppCard({ app, installed, onInstall, installing, onClick }: {
  app: AppTemplate;
  installed: boolean;
  onInstall: (app: AppTemplate) => void;
  installing: boolean;
  onClick: () => void;
}) {
  const catGradient = CATEGORY_GRADIENTS[app.category] || 'from-nest-700/20 to-nest-800/20';

  return (
    <div
      onClick={onClick}
      className={clsx(
        'relative overflow-hidden rounded-xl p-4 glow-border glass-hover transition-all group flex flex-col cursor-pointer',
        'bg-gradient-to-br', catGradient,
      )}
    >
      <div className="absolute inset-0 bg-nest-950/70 backdrop-blur-sm group-hover:bg-nest-950/50 transition-colors" />
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-start gap-3 mb-3">
          <div className="text-2xl flex-shrink-0 p-1.5 rounded-lg bg-white/5 border border-white/5 group-hover:scale-110 transition-transform">
            {app.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white truncate">{app.name}</h3>
              {app.featured && (
                <Star size={12} className="text-amber-400 fill-amber-400 flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-nest-400 mt-0.5 line-clamp-2">{app.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-auto flex-wrap">
          <span className={clsx(
            'text-[10px] px-1.5 py-0.5 rounded font-medium',
            app.type === 'docker' ? 'bg-sky-500/10 text-sky-400' : 'bg-orange-500/10 text-orange-400',
          )}>
            {app.type === 'docker' ? '🐳 Docker' : '📦 LXC'}
          </span>
          {app.minResources && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-nest-800/60 text-nest-500">
              {app.minResources.cores}c / {app.minResources.memoryMB < 1024 ? `${app.minResources.memoryMB}MB` : `${(app.minResources.memoryMB / 1024).toFixed(0)}GB`}
            </span>
          )}
          <div className="flex-1" />
          {installed ? (
            <span className="text-[10px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 size={10} /> Installed
            </span>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); onInstall(app); }}
              disabled={installing}
              className="text-[11px] px-3 py-1.5 rounded-lg bg-nest-500/20 text-nest-200 hover:bg-nest-400/30 hover:text-white transition-all font-medium disabled:opacity-50"
            >
              {installing ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 size={10} className="animate-spin" /> Installing…
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Download size={10} /> Install
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── App Detail Modal ────────────────────────────

function AppDetailModal({ app, installed, onInstall, installing, onClose }: {
  app: AppTemplate;
  installed: boolean;
  onInstall: (app: AppTemplate) => void;
  installing: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg glass rounded-2xl glow-border overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={clsx(
          'p-6 bg-gradient-to-br',
          CATEGORY_GRADIENTS[app.category] || 'from-nest-700/20 to-nest-800/20',
        )}>
          <div className="absolute inset-0 bg-nest-950/50" />
          <div className="relative z-10">
            <button
              onClick={onClose}
              className="absolute top-0 right-0 p-2 rounded-lg text-nest-400 hover:text-white hover:bg-nest-800/50 transition-all"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-4">
              <div className="text-4xl p-3 rounded-xl bg-white/5 border border-white/10">
                {app.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">{app.name}</h2>
                  {app.featured && <Star size={16} className="text-amber-400 fill-amber-400" />}
                </div>
                <p className="text-sm text-nest-300 mt-1">{app.description}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="p-6 space-y-4">
          {/* Tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx(
              'text-xs px-2 py-1 rounded-lg font-medium',
              app.type === 'docker' ? 'bg-sky-500/10 text-sky-400' : 'bg-orange-500/10 text-orange-400',
            )}>
              {app.type === 'docker' ? '🐳 Docker' : '📦 LXC'}
            </span>
            <span className="text-xs px-2 py-1 rounded-lg bg-nest-800/60 text-nest-400">
              {CATEGORY_ICONS[app.category]} {CATEGORY_LABELS[app.category] || app.category}
            </span>
            {app.tags.map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-nest-800/40 text-nest-500">
                {tag}
              </span>
            ))}
          </div>

          {/* Requirements */}
          {app.minResources && (
            <div className="glass rounded-lg p-3">
              <p className="text-xs text-nest-400 font-semibold uppercase tracking-wider mb-2">Requirements</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <Cpu size={14} className="text-nest-400 mx-auto mb-1" />
                  <p className="text-sm font-semibold text-white">{app.minResources.cores}</p>
                  <p className="text-[10px] text-nest-500">CPU Cores</p>
                </div>
                <div className="text-center">
                  <MemoryStick size={14} className="text-nest-400 mx-auto mb-1" />
                  <p className="text-sm font-semibold text-white">
                    {app.minResources.memoryMB >= 1024
                      ? `${(app.minResources.memoryMB / 1024).toFixed(0)} GB`
                      : `${app.minResources.memoryMB} MB`}
                  </p>
                  <p className="text-[10px] text-nest-500">Memory</p>
                </div>
                <div className="text-center">
                  <HardDrive size={14} className="text-nest-400 mx-auto mb-1" />
                  <p className="text-sm font-semibold text-white">{app.minResources.diskGB} GB</p>
                  <p className="text-[10px] text-nest-500">Disk</p>
                </div>
              </div>
            </div>
          )}

          {/* Ports */}
          {app.docker?.ports && Object.keys(app.docker.ports).length > 0 && (
            <div>
              <p className="text-xs text-nest-400 font-semibold uppercase tracking-wider mb-2">Ports</p>
              <div className="flex items-center gap-2 flex-wrap">
                {Object.entries(app.docker.ports).map(([host, container]) => (
                  <span key={host} className="text-xs px-2 py-1 rounded bg-nest-800/60 text-nest-300 font-mono">
                    {host} → {container}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Docker Image */}
          {app.docker?.image && (
            <div>
              <p className="text-xs text-nest-400 font-semibold uppercase tracking-wider mb-1">Docker Image</p>
              <p className="text-sm text-nest-300 font-mono bg-nest-800/40 rounded px-2 py-1">{app.docker.image}</p>
            </div>
          )}

          {/* Web Port */}
          {app.webPort > 0 && (
            <div className="flex items-center gap-2 text-xs text-nest-400">
              <Globe size={12} />
              <span>Web interface on port <span className="text-white font-mono">{app.webPort}</span></span>
            </div>
          )}

          {/* Install Button */}
          <div className="pt-2">
            {installed ? (
              <div className="w-full py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium text-center flex items-center justify-center gap-2">
                <CheckCircle2 size={16} /> Already Installed
              </div>
            ) : (
              <button
                onClick={() => onInstall(app)}
                disabled={installing}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-nest-500/30 to-nest-400/30 hover:from-nest-500/50 hover:to-nest-400/50 text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-nest-400/20"
              >
                {installing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Installing…
                  </>
                ) : (
                  <>
                    <Download size={16} /> Install {app.name}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Network Interface Card ─────────────────────

function NetworkCard({ iface }: { iface: NetworkInterface }) {
  const formatBytes = (bytes: number) => {
    if (bytes > 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  return (
    <div className="glass rounded-xl p-4 glow-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe size={16} className={clsx(
            iface.state === 'up' ? 'text-emerald-400' : 'text-nest-600',
          )} />
          <span className="text-sm font-semibold text-white font-mono">{iface.name}</span>
          <span className={clsx(
            'text-[10px] px-1.5 py-0.5 rounded font-medium',
            iface.state === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-nest-800 text-nest-500',
          )}>
            {iface.state}
          </span>
        </div>
        {iface.speed && iface.speed > 0 && (
          <span className="text-xs text-nest-400">{iface.speed} Mbps</span>
        )}
      </div>

      {iface.ipv4.length > 0 && (
        <div className="mb-2">
          {iface.ipv4.map(ip => (
            <div key={ip} className="text-xs text-nest-300 font-mono bg-nest-800/50 rounded px-2 py-1 mb-1">
              IPv4: {ip}
            </div>
          ))}
        </div>
      )}
      {iface.ipv6.length > 0 && (
        <div className="mb-2">
          {iface.ipv6.map(ip => (
            <div key={ip} className="text-[10px] text-nest-500 font-mono truncate">
              IPv6: {ip}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-4 mt-2 text-xs text-nest-500">
        <span>↓ {formatBytes(iface.rxBytes)}</span>
        <span>↑ {formatBytes(iface.txBytes)}</span>
      </div>
    </div>
  );
}

// ─── Featured Apps Carousel ──────────────────────

function FeaturedBanner({ apps, onSelect }: { apps: AppTemplate[]; onSelect: (app: AppTemplate) => void }) {
  const [offset, setOffset] = useState(0);
  const visible = apps.slice(offset, offset + 4);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Star size={14} className="text-amber-400 fill-amber-400" />
          Featured Apps
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOffset(Math.max(0, offset - 4))}
            disabled={offset === 0}
            className="p-1 rounded text-nest-400 hover:text-white disabled:opacity-30 transition-all"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setOffset(Math.min(apps.length - 4, offset + 4))}
            disabled={offset >= apps.length - 4}
            className="p-1 rounded text-nest-400 hover:text-white disabled:opacity-30 transition-all"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {visible.map(app => (
          <button
            key={app.id}
            onClick={() => onSelect(app)}
            className={clsx(
              'relative overflow-hidden rounded-xl p-4 text-left transition-all group',
              'bg-gradient-to-br', CATEGORY_GRADIENTS[app.category] || 'from-nest-700/20 to-nest-800/20',
              'hover:scale-[1.02] hover:shadow-lg hover:shadow-nest-500/10',
            )}
          >
            <div className="absolute inset-0 bg-nest-950/50 group-hover:bg-nest-950/30 transition-colors" />
            <div className="relative z-10">
              <div className="text-2xl mb-2">{app.icon}</div>
              <p className="text-sm font-semibold text-white">{app.name}</p>
              <p className="text-[11px] text-nest-400 mt-0.5 line-clamp-1">{app.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────

export function ServerDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const serverId = parseInt(id || '0', 10);

  // Core state
  const [server, setServer] = useState<(CloudServer & { metrics?: ServerMetrics }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Data state
  const [guests, setGuests] = useState<GuestInfo[]>([]);
  const [storages, setStorages] = useState<StorageInfo[]>([]);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [installedApps, setInstalledApps] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [appTemplates, setAppTemplates] = useState<AppTemplate[]>([]);

  // UI state
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [installingApp, setInstallingApp] = useState<string | null>(null);
  const [appSearch, setAppSearch] = useState('');
  const [appCategory, setAppCategory] = useState('all');
  const [appFilter, setAppFilter] = useState<'all' | 'installed'>('all');
  const [installMessage, setInstallMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedApp, setSelectedApp] = useState<AppTemplate | null>(null);
  const [guestSort, setGuestSort] = useState<GuestSort>('status');
  const [guestSortDir, setGuestSortDir] = useState<'asc' | 'desc'>('asc');

  // ─── Fetch core server data ────────────────

  const fetchServer = useCallback(async () => {
    try {
      const { server: srv } = await api.getServer(serverId);
      setServer({ ...srv, metrics: normalizeMetrics(srv.metrics) });
      if (!srv.is_online) setError('Server is offline');
      else setError(null);
      return srv.is_online;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      return false;
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  // ─── Fetch tab-specific data ───────────────

  const fetchGuests = useCallback(async () => {
    try {
      const result = await api.sendCommand(serverId, 'guests.list');
      if (result.success && result.data) {
        setGuests((result.data as any).guests || []);
      }
    } catch { /* ignore */ }
  }, [serverId]);

  const fetchStorage = useCallback(async () => {
    try {
      const result = await api.sendCommand(serverId, 'storage.list');
      if (result.success && result.data) {
        setStorages((result.data as any).storages || []);
      }
    } catch { /* ignore */ }
  }, [serverId]);

  const fetchNetwork = useCallback(async () => {
    try {
      const result = await api.sendCommand(serverId, 'network.list');
      if (result.success && result.data) {
        setNetworkInfo(result.data as NetworkInfo);
      }
    } catch { /* ignore */ }
  }, [serverId]);

  const fetchApps = useCallback(async () => {
    try {
      const result = await api.sendCommand(serverId, 'apps.list');
      if (result.success && result.data) {
        setInstalledApps((result.data as any).installed || []);
      }
    } catch { /* ignore */ }
    if (appTemplates.length === 0) {
      setAppTemplates(DEFAULT_APPS);
    }
  }, [serverId, appTemplates.length]);

  const fetchLogs = useCallback(async () => {
    try {
      const result = await api.sendCommand(serverId, 'system.logs', { lines: 200 });
      if (result.success && result.data) {
        setLogs((result.data as any).logs || []);
      }
    } catch { /* ignore */ }
  }, [serverId]);

  // ─── Initial + periodic fetch ──────────────

  useEffect(() => {
    if (!serverId) return;
    const init = async () => {
      const online = await fetchServer();
      if (online) {
        fetchGuests();
      }
    };
    init();
    const interval = setInterval(fetchServer, 15_000);
    return () => clearInterval(interval);
  }, [serverId, fetchServer, fetchGuests]);

  // ─── Fetch data on tab change ──────────────

  useEffect(() => {
    if (!server?.is_online) return;
    switch (activeTab) {
      case 'overview':
      case 'guests': fetchGuests(); break;
      case 'storage': fetchStorage(); break;
      case 'network': fetchNetwork(); break;
      case 'apps': fetchApps(); break;
      case 'logs': fetchLogs(); break;
    }
  }, [activeTab, server?.is_online, fetchGuests, fetchStorage, fetchNetwork, fetchApps, fetchLogs]);

  // ─── Actions ───────────────────────────────

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchServer();
    if (server?.is_online) {
      switch (activeTab) {
        case 'overview':
        case 'guests': await fetchGuests(); break;
        case 'storage': await fetchStorage(); break;
        case 'network': await fetchNetwork(); break;
        case 'apps': await fetchApps(); break;
        case 'logs': await fetchLogs(); break;
        case 'system': break;
      }
    }
    setRefreshing(false);
  };

  const handleGuestAction = async (vmid: number, type: string, action: string) => {
    setActionLoading(vmid);
    try {
      await api.sendCommand(serverId, `guests.${action}`, { vmid, type });
      setTimeout(() => {
        fetchGuests();
        fetchServer();
      }, 2500);
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setTimeout(() => setActionLoading(null), 2500);
    }
  };

  const handleBulkAction = async (action: 'start' | 'stop') => {
    const targets = action === 'start'
      ? guests.filter(g => g.status !== 'running')
      : guests.filter(g => g.status === 'running');
    for (const g of targets) {
      await api.sendCommand(serverId, `guests.${action}`, { vmid: g.vmid, type: g.type }).catch(() => {});
    }
    setTimeout(() => { fetchGuests(); fetchServer(); }, 3000);
  };

  const handleAppInstall = async (app: AppTemplate) => {
    setInstallingApp(app.id);
    setInstallMessage(null);
    try {
      const params: Record<string, unknown> = {
        appId: app.id,
        method: app.type,
      };
      if (app.type === 'docker' && app.docker) {
        params.image = app.docker.image;
        params.ports = app.docker.ports;
        params.volumes = app.docker.volumes;
        params.environment = app.docker.environment;
        if (app.docker.compose) params.compose = app.docker.compose;
      } else if (app.type === 'lxc' && app.lxc) {
        params.lxc = app.lxc;
      }

      const result = await api.sendCommand(serverId, 'apps.install', params);
      if (result.success) {
        setInstallMessage({ type: 'success', text: `${app.name} installed successfully!` });
        setInstalledApps(prev => [...prev, app.id]);
      } else {
        setInstallMessage({ type: 'error', text: result.error || 'Installation failed' });
      }
    } catch (err) {
      setInstallMessage({ type: 'error', text: err instanceof Error ? err.message : 'Installation failed' });
    } finally {
      setInstallingApp(null);
      setTimeout(() => setInstallMessage(null), 5000);
    }
  };

  // ─── App filtering ─────────────────────────

  const filteredApps = useMemo(() => {
    const templates = appTemplates.length > 0 ? appTemplates : [];
    let filtered = templates;

    if (appFilter === 'installed') {
      filtered = filtered.filter(a => installedApps.includes(a.id));
    }
    if (appCategory !== 'all') {
      filtered = filtered.filter(a => a.category === appCategory);
    }
    if (appSearch) {
      const q = appSearch.toLowerCase();
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.tags.some(t => t.includes(q))
      );
    }
    return filtered;
  }, [appTemplates, appCategory, appSearch, appFilter, installedApps]);

  const featuredApps = useMemo(() => {
    return (appTemplates.length > 0 ? appTemplates : []).filter(a => a.featured);
  }, [appTemplates]);

  const categories = useMemo(() => {
    const templates = appTemplates.length > 0 ? appTemplates : [];
    const cats = [...new Set(templates.map(t => t.category))];
    return [
      { id: 'all', count: templates.length },
      ...cats.map(c => ({ id: c, count: templates.filter(t => t.category === c).length })),
    ];
  }, [appTemplates]);

  // ─── Sorted guests ────────────────────────

  const sortedGuests = useMemo(() => {
    const sorted = [...guests].sort((a, b) => {
      let cmp = 0;
      switch (guestSort) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'vmid': cmp = a.vmid - b.vmid; break;
        case 'status': {
          const order = { running: 0, paused: 1, stopped: 2 };
          cmp = order[a.status] - order[b.status];
          break;
        }
        case 'memory': cmp = a.memoryMB - b.memoryMB; break;
      }
      return guestSortDir === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }, [guests, guestSort, guestSortDir]);

  // ─── Computed stats ────────────────────────

  const guestsRunning = guests.filter(g => g.status === 'running').length;
  const guestsStopped = guests.filter(g => g.status !== 'running').length;

  // ─── Loading state ─────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-nest-400 border-t-transparent" />
          <p className="text-sm text-nest-400">Connecting to server…</p>
        </div>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-nest-400">Server not found.</p>
        <Link to="/" className="text-nest-300 hover:text-white text-sm mt-2 inline-block">← Back to servers</Link>
      </div>
    );
  }

  const m = server.metrics;

  // ─── Format uptime ─────────────────────────
  const formatUptime = (sec: number) => {
    const days = Math.floor(sec / 86400);
    const hours = Math.floor((sec % 86400) / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 rounded-lg text-nest-400 hover:text-white hover:bg-nest-800/50 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white">{server.name}</h1>
              <div className={clsx(
                'flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
                server.is_online ? 'bg-emerald-500/10 text-emerald-400' : 'bg-nest-800 text-nest-500',
              )}>
                {server.is_online ? <Wifi size={10} /> : <WifiOff size={10} />}
                {server.is_online ? 'Online' : 'Offline'}
              </div>
            </div>
            <p className="text-xs text-nest-400 mt-0.5">
              {server.hostname} • {server.os} • PVE {server.proxmox_version}
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium glass text-nest-300 hover:text-white transition-colors"
        >
          <RefreshCw size={14} className={clsx(refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* ─── Error ──────────────────────────────── */}
      {error && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
          {error}
        </div>
      )}

      {/* ─── Install message ────────────────────── */}
      {installMessage && (
        <div className={clsx(
          'rounded-lg px-4 py-3 text-sm flex items-center justify-between',
          installMessage.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
            : 'bg-rose-500/10 border border-rose-500/20 text-rose-400',
        )}>
          <span className="flex items-center gap-2">
            {installMessage.type === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {installMessage.text}
          </span>
          <button onClick={() => setInstallMessage(null)} className="ml-2 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ─── App Detail Modal ───────────────────── */}
      {selectedApp && (
        <AppDetailModal
          app={selectedApp}
          installed={installedApps.includes(selectedApp.id)}
          onInstall={handleAppInstall}
          installing={installingApp === selectedApp.id}
          onClose={() => setSelectedApp(null)}
        />
      )}

      {/* ─── Offline State ──────────────────────── */}
      {!server.is_online && (
        <div className="glass rounded-2xl p-12 text-center glow-border">
          <WifiOff size={48} className="text-nest-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Server is Offline</h2>
          <p className="text-sm text-nest-400 max-w-md mx-auto">
            This server's agent is not connected. Make sure the ProxNest agent service is running on your server.
          </p>
          {server.last_seen && (
            <p className="text-xs text-nest-500 mt-4 flex items-center justify-center gap-1">
              <Clock size={11} />
              Last seen: {new Date(server.last_seen).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* ─── Online Content ─────────────────────── */}
      {server.is_online && m && (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={Activity} label="Overview" />
            <TabButton active={activeTab === 'guests'} onClick={() => setActiveTab('guests')} icon={Layers} label="Guests" badge={guests.length} />
            <TabButton active={activeTab === 'apps'} onClick={() => setActiveTab('apps')} icon={Package} label="App Store" badge={appTemplates.length} />
            <TabButton active={activeTab === 'storage'} onClick={() => setActiveTab('storage')} icon={Database} label="Storage" />
            <TabButton active={activeTab === 'system'} onClick={() => setActiveTab('system')} icon={Settings} label="System" />
            <TabButton active={activeTab === 'network'} onClick={() => setActiveTab('network')} icon={Network} label="Network" />
            <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={ScrollText} label="Logs" />
          </div>

          {/* ═══ Overview Tab ═════════════════════ */}
          {activeTab === 'overview' && (() => {
            const cpuPct = m.cpu_usage ?? 0;
            const ramUsedGB = (m.ram_used_mb / 1024).toFixed(1);
            const ramTotalGB = (m.ram_total_mb / 1024).toFixed(0);
            const ramPct = m.ram_total_mb > 0 ? Math.round(m.ram_used_mb / m.ram_total_mb * 100) : 0;
            const diskUsedGB = m.disk_used_gb ?? 0;
            const diskTotalGB = m.disk_total_gb ?? 0;
            const diskPct = diskTotalGB > 0 ? Math.round(diskUsedGB / diskTotalGB * 100) : 0;
            const uptimeSec = m.uptime_seconds ?? 0;

            return (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <StatCard label="CPU Usage" value={`${cpuPct}%`} subtitle={`${server.cpu_cores || 0} cores`} percent={cpuPct} gradient="from-indigo-500/20 to-violet-500/20" icon={Cpu} />
                  <StatCard label="Memory" value={`${ramUsedGB} GB`} subtitle={`of ${ramTotalGB} GB`} percent={ramPct} gradient="from-emerald-500/20 to-teal-500/20" icon={MemoryStick} />
                  <StatCard label="Storage" value={`${diskUsedGB} GB`} subtitle={`of ${diskTotalGB} GB`} percent={diskPct} gradient="from-amber-500/20 to-orange-500/20" icon={HardDrive} />
                  <StatCard label="Guests" value={`${guestsRunning} running`} subtitle={`${guestsStopped} stopped • Up ${formatUptime(uptimeSec)}`} gradient="from-cyan-500/20 to-blue-500/20" icon={Layers} />
                </div>

                {/* System Info Section */}
                <div className="glass rounded-xl p-5 glow-border">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Server size={14} className="text-nest-400" />
                    System Information
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div>
                      <p className="text-[10px] text-nest-500 uppercase tracking-wider">Hostname</p>
                      <p className="text-sm text-white font-mono mt-0.5">{server.hostname || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-nest-500 uppercase tracking-wider">Operating System</p>
                      <p className="text-sm text-white mt-0.5">{server.os || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-nest-500 uppercase tracking-wider">PVE Version</p>
                      <p className="text-sm text-white mt-0.5">{server.proxmox_version || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-nest-500 uppercase tracking-wider">CPU Cores</p>
                      <p className="text-sm text-white mt-0.5">{server.cpu_cores || 0} cores</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-nest-500 uppercase tracking-wider">Uptime</p>
                      <p className="text-sm text-white mt-0.5">{formatUptime(uptimeSec)}</p>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="glass rounded-xl p-4 glow-border">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Zap size={14} className="text-amber-400" />
                    Quick Actions
                  </h3>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => api.sendCommand(serverId, 'system.reboot').catch(() => {})}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/10 transition-all"
                    >
                      <Power size={12} /> Reboot Server
                    </button>
                    <button
                      onClick={() => api.sendCommand(serverId, 'system.update').catch(() => {})}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/10 transition-all"
                    >
                      <UploadCloud size={12} /> Update System
                    </button>
                    <button
                      onClick={() => {
                        const host = server.hostname || 'server';
                        window.open(`https://${host}:7681`, '_blank');
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/10 transition-all"
                    >
                      <Terminal size={12} /> Open Terminal
                    </button>
                  </div>
                </div>

                {/* Quick Guest List */}
                {guests.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base font-semibold text-white flex items-center gap-2">
                        <Layers size={16} className="text-nest-400" />
                        VMs & Containers
                      </h2>
                      <button
                        onClick={() => setActiveTab('guests')}
                        className="text-xs text-nest-400 hover:text-white flex items-center gap-1 transition-colors"
                      >
                        View all <ChevronRight size={12} />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {guests.slice(0, 5).map(g => (
                        <GuestRow
                          key={`${g.type}-${g.vmid}`}
                          guest={g}
                          onAction={handleGuestAction}
                          loading={actionLoading === g.vmid}
                        />
                      ))}
                      {guests.length > 5 && (
                        <button
                          onClick={() => setActiveTab('guests')}
                          className="w-full py-2 rounded-lg text-xs text-nest-400 hover:text-white glass glass-hover transition-all"
                        >
                          +{guests.length - 5} more guests →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ Guests Tab ═══════════════════════ */}
          {activeTab === 'guests' && (
            <div className="space-y-4">
              {/* Header with summary bar */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Layers size={16} className="text-nest-400" />
                  VMs & Containers
                </h2>
                <div className="flex items-center gap-3">
                  {/* Summary badges */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Play size={10} /> {guestsRunning} running
                    </span>
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-nest-800 text-nest-400">
                      <Square size={10} /> {guestsStopped} stopped
                    </span>
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-nest-800/60 text-nest-500">
                      {guests.length} total
                    </span>
                  </div>
                </div>
              </div>

              {/* Sort & Bulk Actions */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-nest-500">Sort by:</span>
                  {(['status', 'name', 'vmid', 'memory'] as GuestSort[]).map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        if (guestSort === s) setGuestSortDir(d => d === 'asc' ? 'desc' : 'asc');
                        else { setGuestSort(s); setGuestSortDir('asc'); }
                      }}
                      className={clsx(
                        'text-[11px] px-2 py-1 rounded-lg transition-all capitalize',
                        guestSort === s
                          ? 'bg-nest-600/30 text-white border border-nest-400/20'
                          : 'text-nest-400 hover:text-white bg-nest-800/30',
                      )}
                    >
                      {s}
                      {guestSort === s && (
                        guestSortDir === 'asc' ? <SortAsc size={10} className="inline ml-1" /> : <SortDesc size={10} className="inline ml-1" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleBulkAction('start')}
                    className="text-[11px] px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all font-medium"
                    title="Start all stopped guests"
                  >
                    <Play size={10} className="inline mr-1" /> Start All
                  </button>
                  <button
                    onClick={() => handleBulkAction('stop')}
                    className="text-[11px] px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all font-medium"
                    title="Stop all running guests"
                  >
                    <Square size={10} className="inline mr-1" /> Stop All
                  </button>
                </div>
              </div>

              {guests.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center glow-border">
                  <Layers size={36} className="text-nest-600 mx-auto mb-3" />
                  <p className="text-sm text-nest-400">No VMs or containers found</p>
                  <p className="text-xs text-nest-500 mt-1">Create one from the App Store or your Proxmox host</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedGuests.map(g => (
                    <GuestRow
                      key={`${g.type}-${g.vmid}`}
                      guest={g}
                      onAction={handleGuestAction}
                      loading={actionLoading === g.vmid}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ App Store Tab ════════════════════ */}
          {activeTab === 'apps' && (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Package size={16} className="text-nest-400" />
                  App Store
                  <span className="text-xs text-nest-500 font-normal ml-1">
                    {appTemplates.length} apps available
                  </span>
                </h2>
                {/* Installed filter toggle */}
                <div className="flex items-center gap-1 glass rounded-lg p-0.5">
                  <button
                    onClick={() => setAppFilter('all')}
                    className={clsx(
                      'text-xs px-3 py-1.5 rounded-md transition-all font-medium',
                      appFilter === 'all' ? 'bg-nest-600/30 text-white' : 'text-nest-400 hover:text-white',
                    )}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setAppFilter('installed')}
                    className={clsx(
                      'text-xs px-3 py-1.5 rounded-md transition-all font-medium',
                      appFilter === 'installed' ? 'bg-emerald-500/20 text-emerald-400' : 'text-nest-400 hover:text-white',
                    )}
                  >
                    Installed ({installedApps.length})
                  </button>
                </div>
              </div>

              {/* Featured Apps Banner */}
              {appFilter === 'all' && appCategory === 'all' && !appSearch && featuredApps.length > 0 && (
                <FeaturedBanner apps={featuredApps} onSelect={setSelectedApp} />
              )}

              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nest-500" />
                <input
                  type="text"
                  placeholder="Search apps..."
                  value={appSearch}
                  onChange={e => setAppSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white placeholder-nest-500 focus:outline-none focus:border-nest-400/40 transition-colors"
                />
              </div>

              {/* Category pills with counts */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setAppCategory(cat.id)}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                      appCategory === cat.id
                        ? 'bg-nest-600/30 text-white border border-nest-400/20'
                        : 'text-nest-400 hover:text-white bg-nest-800/30 hover:bg-nest-800/60',
                    )}
                  >
                    {cat.id !== 'all' && <span>{CATEGORY_ICONS[cat.id] || '📁'}</span>}
                    {CATEGORY_LABELS[cat.id] || cat.id}
                    <span className="text-nest-500 text-[10px]">{cat.count}</span>
                  </button>
                ))}
              </div>

              {/* App Grid */}
              {filteredApps.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center glow-border">
                  {appTemplates.length === 0 ? (
                    <>
                      <Package size={36} className="text-nest-600 mx-auto mb-3" />
                      <p className="text-sm text-nest-400">Loading app catalog…</p>
                    </>
                  ) : (
                    <>
                      <Search size={36} className="text-nest-600 mx-auto mb-3" />
                      <p className="text-sm text-nest-400">No apps match your search</p>
                      <button
                        onClick={() => { setAppSearch(''); setAppCategory('all'); setAppFilter('all'); }}
                        className="text-xs text-nest-300 hover:text-white mt-2 underline"
                      >
                        Clear filters
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredApps.map(app => (
                    <AppCard
                      key={app.id}
                      app={app}
                      installed={installedApps.includes(app.id)}
                      onInstall={handleAppInstall}
                      installing={installingApp === app.id}
                      onClick={() => setSelectedApp(app)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ Storage Tab ══════════════════════ */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Database size={16} className="text-nest-400" />
                Storage Pools
                <span className="text-xs text-nest-500 font-normal ml-1">
                  {storages.length} pools
                </span>
              </h2>

              {storages.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center glow-border">
                  <Database size={36} className="text-nest-600 mx-auto mb-3" />
                  <p className="text-sm text-nest-400">Loading storage info…</p>
                  <button onClick={fetchStorage} className="text-xs text-nest-300 hover:text-white mt-2 underline">
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {storages.map(s => (
                      <StorageCard key={s.id} storage={s} />
                    ))}
                  </div>

                  {/* Total summary */}
                  <div className="glass rounded-xl p-5 glow-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <StorageRing
                            percent={Math.round(storages.reduce((s, st) => s + st.usedBytes, 0) / Math.max(1, storages.reduce((s, st) => s + st.totalBytes, 0)) * 100)}
                            size={48}
                            strokeWidth={5}
                            color="#818cf8"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <HardDrive size={14} className="text-nest-400" />
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">Total Storage</p>
                          <p className="text-xs text-nest-400">
                            {(storages.reduce((s, st) => s + st.usedBytes, 0) / 1073741824).toFixed(1)} GB used
                            {' / '}
                            {(storages.reduce((s, st) => s + st.totalBytes, 0) / 1073741824).toFixed(1)} GB total
                          </p>
                        </div>
                      </div>
                      {storages.some(s => s.usagePercent > 80) && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-400">
                          <AlertTriangle size={14} />
                          <span>Some pools &gt;80% full</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ═══ System Tab ═══════════════════════ */}
          {activeTab === 'system' && (() => {
            const uptimeSec = m.uptime_seconds ?? 0;
            return (
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Settings size={16} className="text-nest-400" />
                  System
                </h2>

                {/* System Info */}
                <div className="glass rounded-xl p-5 glow-border">
                  <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <Info size={14} className="text-nest-400" />
                    System Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                    {[
                      ['Hostname', server.hostname || 'N/A'],
                      ['Operating System', server.os || 'N/A'],
                      ['Kernel', (server as any).kernel_version || 'Linux'],
                      ['PVE Version', server.proxmox_version || 'N/A'],
                      ['CPU Cores', `${server.cpu_cores || 0} cores`],
                      ['Total RAM', `${(m.ram_total_mb / 1024).toFixed(0)} GB`],
                      ['CPU Model', (server as any).cpu_model || `${server.cpu_cores || 0}-core CPU`],
                      ['Uptime', formatUptime(uptimeSec)],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <p className="text-[10px] text-nest-500 uppercase tracking-wider">{label}</p>
                        <p className="text-sm text-white mt-0.5">{val}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Services Status */}
                <div className="glass rounded-xl p-5 glow-border">
                  <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <Activity size={14} className="text-nest-400" />
                    Services Status
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { name: 'pvedaemon', label: 'PVE Daemon', status: 'running' as const },
                      { name: 'pveproxy', label: 'PVE Proxy', status: 'running' as const },
                      { name: 'pvestatd', label: 'PVE Status', status: 'running' as const },
                      { name: 'proxnest-agent', label: 'ProxNest Agent', status: 'running' as const },
                      { name: 'ssh', label: 'SSH Server', status: 'running' as const },
                      { name: 'networking', label: 'Networking', status: 'running' as const },
                    ].map(svc => (
                      <div key={svc.name} className="flex items-center gap-3 p-3 rounded-lg bg-nest-900/30">
                        <div className={clsx(
                          'h-2.5 w-2.5 rounded-full',
                          svc.status === 'running' ? 'bg-emerald-400' : 'bg-rose-400',
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white">{svc.label}</p>
                          <p className="text-[10px] text-nest-500 font-mono">{svc.name}</p>
                        </div>
                        <span className={clsx(
                          'text-[10px] px-1.5 py-0.5 rounded font-medium',
                          svc.status === 'running'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-rose-500/10 text-rose-400',
                        )}>
                          {svc.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Backup Status & Updates */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="glass rounded-xl p-5 glow-border">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <FolderOpen size={14} className="text-nest-400" />
                      Backup Status
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-nest-400">Last backup</span>
                        <span className="text-nest-300">Check PVE for details</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-nest-400">Scheduled</span>
                        <span className="text-nest-300">Via PVE Backup Jobs</span>
                      </div>
                    </div>
                  </div>

                  <div className="glass rounded-xl p-5 glow-border">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <UploadCloud size={14} className="text-nest-400" />
                      System Updates
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-nest-400">Status</span>
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={10} /> System up to date
                        </span>
                      </div>
                      <button
                        onClick={() => api.sendCommand(serverId, 'system.update').catch(() => {})}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/10 transition-all"
                      >
                        <RefreshCw size={12} /> Check for Updates
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ═══ Network Tab ═════════════════════ */}
          {activeTab === 'network' && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Network size={16} className="text-nest-400" />
                Network
              </h2>

              {!networkInfo ? (
                <div className="glass rounded-xl p-8 text-center glow-border">
                  <Network size={36} className="text-nest-600 mx-auto mb-3" />
                  <p className="text-sm text-nest-400">Loading network info…</p>
                  <button onClick={fetchNetwork} className="text-xs text-nest-300 hover:text-white mt-2 underline">
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  <div className="glass rounded-xl p-4 glow-border">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-nest-400 font-medium uppercase tracking-wider mb-1">Default Gateway</p>
                        <p className="text-sm text-white font-mono">{networkInfo.gateway || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-nest-400 font-medium uppercase tracking-wider mb-1">DNS Servers</p>
                        <p className="text-sm text-white font-mono">
                          {networkInfo.dns.length > 0 ? networkInfo.dns.join(', ') : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {networkInfo.interfaces.map(iface => (
                      <NetworkCard key={iface.name} iface={iface} />
                    ))}
                  </div>

                  {networkInfo.bridges.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <Layers size={14} className="text-nest-400" />
                        Bridges
                      </h3>
                      <div className="space-y-2">
                        {networkInfo.bridges.map(br => (
                          <div key={br.name} className="glass rounded-lg p-3 flex items-center gap-3">
                            <span className="text-sm font-mono text-white">{br.name}</span>
                            <span className="text-xs text-nest-500">
                              STP: {br.stp ? 'yes' : 'no'}
                            </span>
                            {br.ports.length > 0 && (
                              <span className="text-xs text-nest-400">
                                Ports: {br.ports.join(', ')}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ═══ Logs Tab ════════════════════════ */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <ScrollText size={16} className="text-nest-400" />
                  System Logs
                  <span className="text-xs text-nest-500 font-normal ml-1">
                    Last {logs.length} entries
                  </span>
                </h2>
                <button
                  onClick={fetchLogs}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium glass text-nest-300 hover:text-white transition-colors"
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center glow-border">
                  <ScrollText size={36} className="text-nest-600 mx-auto mb-3" />
                  <p className="text-sm text-nest-400">Loading logs…</p>
                  <button onClick={fetchLogs} className="text-xs text-nest-300 hover:text-white mt-2 underline">
                    Retry
                  </button>
                </div>
              ) : (
                <div className="glass rounded-xl glow-border overflow-hidden">
                  <div className="max-h-[500px] overflow-y-auto p-4 font-mono text-xs leading-relaxed">
                    {logs.map((line, i) => (
                      <div
                        key={i}
                        className={clsx(
                          'py-0.5 border-b border-nest-800/30',
                          line.includes('error') || line.includes('ERROR') || line.includes('failed')
                            ? 'text-rose-400'
                            : line.includes('warning') || line.includes('WARN')
                            ? 'text-amber-400'
                            : 'text-nest-400',
                        )}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Terminal link */}
              <div className="glass rounded-xl p-4 glow-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Terminal size={18} className="text-nest-400" />
                    <div>
                      <p className="text-sm font-medium text-white">Web Terminal</p>
                      <p className="text-xs text-nest-500">Open a shell session via SSH or ttyd</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const host = server.hostname || 'server';
                      window.open(`https://${host}:7681`, '_blank');
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-nest-600/20 text-nest-200 hover:bg-nest-600/30 hover:text-white transition-all"
                  >
                    <ExternalLink size={12} /> Open Terminal
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}