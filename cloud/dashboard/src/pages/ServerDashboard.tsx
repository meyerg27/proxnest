/**
 * ProxNest Cloud — Server Dashboard (Full Management Interface)
 * Tabs: Overview, VMs & Containers, App Store, Storage, Members, System, Network, Logs
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type CloudServer, type ServerMetrics, type ServerMember, type NotificationRule, type NotificationEvent, normalizeMetrics } from '../lib/api';
import {
  ArrowLeft, Server, Wifi, WifiOff, Cpu, MemoryStick, HardDrive,
  Container, RefreshCw, Terminal, Activity, Clock, Loader2,
  Box, Play, Square, RotateCw, Plus, Search, Download,
  Network, Database, ScrollText, ExternalLink, Monitor,
  ChevronDown, ChevronRight, X, Package, Layers, Globe, Shield,
  Gauge, Zap, Home, Eye, Gamepad2, MessageSquare, FolderOpen,
  ArrowUpDown, Star, ChevronLeft, Settings, AlertTriangle,
  CheckCircle2, XCircle, Info, Power, UploadCloud, Wrench,
  Brain, Filter, SortAsc, SortDesc, Archive, Trash2, DownloadCloud, History,
  Users, UserPlus, UserMinus, Crown, ShieldCheck, Eye as EyeIcon, Wrench as WrenchIcon,
  Bell, BellRing, Send, TestTube, ToggleLeft, ToggleRight,
  BarChart3, Camera, Lock, KeyRound, Link2, FolderTree, HelpCircle,
  Lightbulb, BookOpen, Sparkles,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useInstallProgress } from '../hooks/useInstallProgress';
import { InstallProgressModal } from '../components/InstallProgressModal';
import { AppLogsModal } from '../components/AppLogsModal';
import { ContainerConsole } from '../components/ContainerConsole';
import { ResourceGraphs } from '../components/ResourceGraphs';

// ─── Types ───────────────────────────────────────

type Tab = 'overview' | 'guests' | 'apps' | 'storage' | 'backups' | 'snapshots' | 'members' | 'firewall' | 'system' | 'settings' | 'network' | 'logs' | 'notifications' | 'graphs';

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

interface BackupInfo {
  volid: string;
  storage: string;
  vmid: number;
  size: number;
  format: string;
  timestamp: string;
  notes: string;
  filename: string;
}

interface BackupStorage {
  id: string;
  type: string;
  path: string;
  availableGB: number;
}

interface FirewallRule {
  num: number;
  chain: string;
  target: string;
  protocol: string;
  source: string;
  destination: string;
  port: string;
  extra: string;
}

interface PveFirewallRule {
  pos: number;
  type: string;
  action: string;
  proto?: string;
  dport?: string;
  source?: string;
  iface?: string;
  enable: boolean;
  comment?: string;
}

interface ListeningPort {
  port: number;
  protocol: string;
  process: string;
}

interface FirewallData {
  iptablesRules: FirewallRule[];
  pveFirewall: { enabled: boolean; rules: PveFirewallRule[] };
  listeningPorts: ListeningPort[];
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

// ─── App Stacks ──────────────────────────────────

interface AppStack {
  id: string;
  name: string;
  icon: string;
  description: string;
  apps: string[];
  gradient: string;
}

const APP_STACKS: AppStack[] = [
  {
    id: 'media-server',
    name: 'Media Server',
    icon: '🎬',
    description: 'Complete media streaming setup with automated downloads and subtitles',
    apps: ['jellyfin', 'radarr', 'sonarr', 'prowlarr', 'qbittorrent', 'bazarr'],
    gradient: 'from-purple-500/20 to-pink-500/20',
  },
  {
    id: 'download-stack',
    name: 'Download Stack',
    icon: '⬇️',
    description: 'Automated media acquisition with torrent client and indexer management',
    apps: ['qbittorrent', 'radarr', 'sonarr', 'prowlarr'],
    gradient: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    id: 'personal-cloud',
    name: 'Personal Cloud',
    icon: '☁️',
    description: 'Self-hosted cloud storage, photo management, and document organization',
    apps: ['nextcloud', 'immich', 'paperless-ngx'],
    gradient: 'from-sky-500/20 to-indigo-500/20',
  },
  {
    id: 'monitoring',
    name: 'Monitoring',
    icon: '📊',
    description: 'Full observability stack with dashboards, uptime monitoring, and container management',
    apps: ['grafana', 'uptime-kuma', 'portainer', 'dozzle'],
    gradient: 'from-orange-500/20 to-amber-500/20',
  },
];

// Shared media directories shown after media app installs
const MEDIA_DIRECTORIES = [
  '/data/media/movies',
  '/data/media/tv',
  '/data/media/music',
  '/data/downloads',
];

const MEDIA_APP_IDS = new Set([
  'jellyfin', 'plex', 'emby', 'radarr', 'sonarr', 'bazarr',
  'prowlarr', 'qbittorrent', 'transmission', 'lidarr', 'readarr',
  'navidrome', 'tdarr', 'overseerr', 'jellyseerr',
]);

// Connected apps metadata
const CONNECTED_APPS: Record<string, string[]> = {
  radarr: ['qbittorrent', 'prowlarr', 'bazarr', 'jellyfin'],
  sonarr: ['qbittorrent', 'prowlarr', 'bazarr', 'jellyfin'],
  bazarr: ['radarr', 'sonarr'],
  prowlarr: ['radarr', 'sonarr', 'lidarr'],
  jellyfin: ['radarr', 'sonarr', 'bazarr'],
  qbittorrent: ['radarr', 'sonarr'],
  nextcloud: ['immich'],
  immich: ['nextcloud'],
  grafana: ['uptime-kuma', 'portainer'],
  'uptime-kuma': ['grafana'],
  portainer: ['dozzle', 'grafana'],
  dozzle: ['portainer'],
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

function GuestRow({ guest, onAction, loading, onConsole }: {
  guest: GuestInfo;
  onAction: (vmid: number, type: string, action: string) => void;
  loading: boolean;
  onConsole?: (vmid: number, type: 'lxc' | 'qemu', name: string) => void;
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
              {onConsole && (
                <button
                  onClick={() => onConsole(guest.vmid, guest.type as 'lxc' | 'qemu', guest.name)}
                  className="p-2 rounded-lg text-nest-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                  title="Open Console"
                >
                  <Terminal size={14} />
                </button>
              )}
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

function AppCard({ app, installed, installedUrl, onInstall, installing, onClick }: {
  app: AppTemplate;
  installed: boolean;
  installedUrl?: string;
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
            <span className="flex items-center gap-1.5">
              <span className="text-[10px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 size={10} /> Installed
              </span>
              {installedUrl && (
                <a
                  href={installedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-[10px] px-2 py-1 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 font-medium flex items-center gap-1 transition-all"
                >
                  <ExternalLink size={10} /> Open
                </a>
              )}
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

function AppDetailModal({ app, installed, installedInfo, onInstall, installing, onClose, onAction, onViewLogs }: {
  app: AppTemplate;
  installed: boolean;
  installedInfo?: { id: string; status: string; url: string; ports: string };
  onInstall: (app: AppTemplate) => void;
  installing: boolean;
  onClose: () => void;
  onAction?: (appId: string, action: 'start' | 'stop' | 'uninstall') => void;
  onViewLogs?: (appId: string, appName: string, appIcon?: string) => void;
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

          {/* Install / Manage Buttons */}
          <div className="pt-2 space-y-2">
            {installed && installedInfo ? (
              <>
                {installedInfo.url && (
                  <a
                    href={installedInfo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 text-sm font-medium text-center flex items-center justify-center gap-2 hover:bg-sky-500/20 transition-all"
                  >
                    <ExternalLink size={16} /> Open {app.name}
                  </a>
                )}
                <button
                  onClick={() => { onViewLogs?.(app.id, app.name, app.icon); onClose(); }}
                  className="w-full py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-medium flex items-center justify-center gap-2 hover:bg-violet-500/20 transition-all"
                >
                  <ScrollText size={14} /> View Logs
                </button>
                <div className="flex gap-2">
                  {installedInfo.status === 'running' ? (
                    <button
                      onClick={() => onAction?.(app.id, 'stop')}
                      className="flex-1 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium flex items-center justify-center gap-2 hover:bg-amber-500/20 transition-all"
                    >
                      <Square size={14} /> Stop
                    </button>
                  ) : (
                    <button
                      onClick={() => onAction?.(app.id, 'start')}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-all"
                    >
                      <Play size={14} /> Start
                    </button>
                  )}
                  <button
                    onClick={() => { onAction?.(app.id, 'uninstall'); onClose(); }}
                    className="flex-1 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-medium flex items-center justify-center gap-2 hover:bg-rose-500/20 transition-all"
                  >
                    <X size={14} /> Uninstall
                  </button>
                </div>
                <div className="text-center text-xs text-nest-500 flex items-center justify-center gap-1.5">
                  <div className={clsx(
                    'h-2 w-2 rounded-full',
                    installedInfo.status === 'running' ? 'bg-emerald-400' : 'bg-rose-400',
                  )} />
                  Status: {installedInfo.status}
                </div>
              </>
            ) : installed ? (
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
  interface InstalledApp {
    id: string;
    name: string;
    image: string;
    status: string;
    ports: string;
    url: string;
  }
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [appTemplates, setAppTemplates] = useState<AppTemplate[]>([]);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [backupStorages, setBackupStorages] = useState<BackupStorage[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [showCreateBackup, setShowCreateBackup] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deletingBackup, setDeletingBackup] = useState<string | null>(null);
  const [restoringBackup, setRestoringBackup] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<BackupInfo | null>(null);

  // System Updates state
  const [updatePackages, setUpdatePackages] = useState<Array<{ name: string; currentVersion: string; newVersion: string; arch: string; repo: string }>>([]);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateApplying, setUpdateApplying] = useState(false);
  const [updateLastCheck, setUpdateLastCheck] = useState<string | null>(null);
  const [updateSecurityCount, setUpdateSecurityCount] = useState(0);
  const [updateRebootRequired, setUpdateRebootRequired] = useState(false);
  const [updateLog, setUpdateLog] = useState<string[]>([]);
  const [updateResult, setUpdateResult] = useState<{ type: 'success' | 'error'; text: string; upgraded?: number } | null>(null);

  // Firewall state
  const [firewallData, setFirewallData] = useState<FirewallData | null>(null);
  const [firewallLoading, setFirewallLoading] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [addingRule, setAddingRule] = useState(false);
  const [deletingRule, setDeletingRule] = useState<number | null>(null);
  const [firewallMessage, setFirewallMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Members state
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addMemberRole, setAddMemberRole] = useState<'admin' | 'operator' | 'viewer'>('viewer');
  const [addingMember, setAddingMember] = useState(false);
  const [memberMessage, setMemberMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // UI state
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [installingApp, setInstallingApp] = useState<string | null>(null);
  const [installingAppMeta, setInstallingAppMeta] = useState<{ name: string; icon?: string } | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [appSearch, setAppSearch] = useState('');
  const [appCategory, setAppCategory] = useState('all');
  const [appFilter, setAppFilter] = useState<'all' | 'installed'>('all');
  const [installMessage, setInstallMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedApp, setSelectedApp] = useState<AppTemplate | null>(null);
  const [guestSort, setGuestSort] = useState<GuestSort>('status');
  const [guestSortDir, setGuestSortDir] = useState<'asc' | 'desc'>('asc');
  const [logsApp, setLogsApp] = useState<{ id: string; name: string; icon?: string } | null>(null);
  const [consoleGuest, setConsoleGuest] = useState<{ vmid: number; type: 'lxc' | 'qemu' | 'host'; name: string } | null>(null);

  // Stack install state
  const [installingStack, setInstallingStack] = useState<string | null>(null);
  const [stackProgress, setStackProgress] = useState<{ current: number; total: number; currentApp: string; results: Array<{ app: string; success: boolean; url?: string; error?: string; defaultLogin?: { user: string; pass: string } }> } | null>(null);
  const [stackResult, setStackResult] = useState<{ stackId: string; results: Array<{ app: string; success: boolean; url?: string; error?: string; defaultLogin?: { user: string; pass: string } }> } | null>(null);

  // Default login credentials visibility
  const [showCredsFor, setShowCredsFor] = useState<string | null>(null);

  // Last install result with default login
  const [lastInstallResult, setLastInstallResult] = useState<{ appId: string; url?: string; defaultLogin?: { user: string; pass: string } } | null>(null);

  // Settings state
  interface ServerSettings {
    hostname: string;
    fqdn: string;
    timezone: string;
    localTime: string;
    ntpEnabled: boolean;
    ntpSynced: boolean;
    dnsServers: string[];
    dnsSearch: string[];
    timezones: string[];
    networkConfig: string;
    hostsFile: string;
  }
  const [settings, setSettings] = useState<ServerSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState<string | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editHostname, setEditHostname] = useState('');
  const [editTimezone, setEditTimezone] = useState('');
  const [editDns, setEditDns] = useState('');
  const [editDnsSearch, setEditDnsSearch] = useState('');
  const [tzSearch, setTzSearch] = useState('');

  // Notifications state
  const [notifRules, setNotifRules] = useState<NotificationRule[]>([]);
  const [notifHistory, setNotifHistory] = useState<NotificationEvent[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [showAddNotifRule, setShowAddNotifRule] = useState(false);
  const [addingNotifRule, setAddingNotifRule] = useState(false);
  const [notifMessage, setNotifMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testingNotif, setTestingNotif] = useState(false);

  // Storage Wizard state
  interface DiskInfo {
    devpath: string;
    model: string;
    size: number;
    serial: string;
    used: string;
    health: string;
  }
  interface StoragePool {
    path: string;
    type: string;
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    roles: string[];
  }
  const [detectedDisks, setDetectedDisks] = useState<DiskInfo[]>([]);
  const [storagePools, setStoragePools] = useState<StoragePool[]>([]);
  const [disksLoading, setDisksLoading] = useState(false);
  const [assigningRoles, setAssigningRoles] = useState<string | null>(null);

  // App Updates state
  interface AppUpdate {
    appId: string;
    name: string;
    currentDigest: string;
    latestDigest: string;
    updateAvailable: boolean;
  }
  const [appUpdates, setAppUpdates] = useState<AppUpdate[]>([]);
  const [appUpdatesLoading, setAppUpdatesLoading] = useState(false);
  const [updatingApp, setUpdatingApp] = useState<string | null>(null);
  const [pruningImages, setPruningImages] = useState(false);
  const [appUpdateMessage, setAppUpdateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // App Backups state
  interface AppBackup {
    id: string;
    appId: string;
    date: string;
    size: number;
    filename: string;
  }
  const [appBackups, setAppBackups] = useState<AppBackup[]>([]);
  const [appBackupsLoading, setAppBackupsLoading] = useState(false);
  const [appBackupRunning, setAppBackupRunning] = useState<string | null>(null);
  const [appRestoringBackup, setAppRestoringBackup] = useState<string | null>(null);
  const [deletingAppBackup, setDeletingAppBackup] = useState<string | null>(null);
  const [appBackupMessage, setAppBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Notification Bell state
  interface NotifSummary {
    healthy: number;
    unhealthy: number;
    warnings: number;
  }
  interface NotifItem {
    id: string;
    type: 'error' | 'warning' | 'info';
    message: string;
    timestamp: string;
    read: boolean;
    actionLabel?: string;
    actionCommand?: string;
  }
  const [notifBellSummary, setNotifBellSummary] = useState<NotifSummary | null>(null);
  const [notifBellItems, setNotifBellItems] = useState<NotifItem[]>([]);
  const [notifBellOpen, setNotifBellOpen] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  // Snapshots state
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
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [showCreateSnapshot, setShowCreateSnapshot] = useState(false);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [snapshotMessage, setSnapshotMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deletingSnapshot, setDeletingSnapshot] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState<SnapshotInfo | null>(null);
  const [snapshotFilter, setSnapshotFilter] = useState<number | 'all'>('all');

  // Getting Started & Recommendations state
  interface GettingStartedStep { step: string; done: boolean; priority: 'high' | 'medium' | 'low' }
  interface AppRecommendation { appId: string; reason: string }
  interface AppGuide { postInstallSteps: string[]; tips: string[]; commonIssues: { problem: string; solution: string }[]; externalDocs?: string }
  const [gettingStartedSteps, setGettingStartedSteps] = useState<GettingStartedStep[]>([]);
  const [gettingStartedRecs, setGettingStartedRecs] = useState<AppRecommendation[]>([]);
  const [gettingStartedLoading, setGettingStartedLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<AppRecommendation[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [appGuides, setAppGuides] = useState<Record<string, AppGuide>>({});
  const [showGuideFor, setShowGuideFor] = useState<string | null>(null);
  const [guideLoading, setGuideLoading] = useState<string | null>(null);

  // ─── Install progress WebSocket ────────────
  const { progress: installProgress, clearProgress } = useInstallProgress(serverId || null);

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
        const raw = (result.data as any).installed || [];
        // Handle both old format (string[]) and new format (object[])
        if (raw.length > 0 && typeof raw[0] === 'string') {
          setInstalledApps(raw.map((id: string) => ({ id, name: id, image: '', status: 'unknown', ports: '', url: '' })));
        } else {
          setInstalledApps(raw);
        }
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

  const fetchBackups = useCallback(async () => {
    setBackupLoading(true);
    try {
      const result = await api.sendCommand(serverId, 'backups.list');
      if (result.success && result.data) {
        setBackups((result.data as any).backups || []);
      }
    } catch { /* ignore */ }
    try {
      const result = await api.sendCommand(serverId, 'backups.storages');
      if (result.success && result.data) {
        setBackupStorages((result.data as any).storages || []);
      }
    } catch { /* ignore */ }
    setBackupLoading(false);
  }, [serverId]);

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const result = await api.getMembers(serverId);
      setMembers(result.members);
    } catch { /* ignore */ }
    setMembersLoading(false);
  }, [serverId]);

  const fetchUpdates = useCallback(async () => {
    setUpdateChecking(true);
    setUpdateResult(null);
    try {
      const result = await api.sendCommand(serverId, 'system.update');
      if (result.success && result.data) {
        const d = result.data as any;
        setUpdatePackages(d.packages || []);
        setUpdateSecurityCount(d.securityCount || 0);
        setUpdateLastCheck(d.lastUpdate || new Date().toISOString());
        setUpdateRebootRequired(d.rebootRequired || false);
      } else {
        setUpdateResult({ type: 'error', text: result.error || 'Failed to check for updates' });
      }
    } catch (err) {
      setUpdateResult({ type: 'error', text: err instanceof Error ? err.message : 'Failed to check for updates' });
    } finally {
      setUpdateChecking(false);
    }
  }, [serverId]);

  const applyUpdates = useCallback(async (mode: string = 'upgrade', packages?: string[]) => {
    setUpdateApplying(true);
    setUpdateResult(null);
    setUpdateLog([]);
    try {
      const result = await api.sendCommand(serverId, 'system.update.apply', { mode, packages });
      if (result.success && result.data) {
        const d = result.data as any;
        setUpdateLog(d.log || []);
        setUpdateRebootRequired(d.rebootRequired || false);
        setUpdateResult({
          type: 'success',
          text: `Update complete — ${d.upgraded || 0} upgraded, ${d.newlyInstalled || 0} newly installed`,
          upgraded: d.upgraded || 0,
        });
        // Refresh the package list
        setTimeout(() => fetchUpdates(), 2000);
      } else {
        const d = result.data as any;
        setUpdateLog(d?.log || []);
        setUpdateResult({ type: 'error', text: result.error || 'Update failed' });
      }
    } catch (err) {
      setUpdateResult({ type: 'error', text: err instanceof Error ? err.message : 'Update failed' });
    } finally {
      setUpdateApplying(false);
    }
  }, [serverId, fetchUpdates]);

  const fetchFirewall = useCallback(async () => {
    setFirewallLoading(true);
    try {
      const result = await api.sendCommand(serverId, 'firewall.list');
      if (result.success && result.data) {
        setFirewallData(result.data as FirewallData);
      }
    } catch { /* ignore */ }
    setFirewallLoading(false);
  }, [serverId]);

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const result = await api.sendCommand(serverId, 'settings.get');
      if (result.success && result.data) {
        const d = result.data as ServerSettings;
        setSettings(d);
        setEditHostname(d.hostname);
        setEditTimezone(d.timezone);
        setEditDns(d.dnsServers.join(', '));
        setEditDnsSearch(d.dnsSearch.join(' '));
      }
    } catch { /* ignore */ }
    setSettingsLoading(false);
  }, [serverId]);

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const [rulesRes, historyRes] = await Promise.all([
        api.getNotificationRules(serverId),
        api.getNotificationHistory(serverId),
      ]);
      setNotifRules(rulesRes.rules);
      setNotifHistory(historyRes.history);
    } catch { /* ignore */ }
    setNotifLoading(false);
  }, [serverId]);

  const fetchSnapshots = useCallback(async () => {
    setSnapshotsLoading(true);
    try {
      const result = await api.sendCommand(serverId, 'snapshots.list');
      if (result.success && result.data) {
        setSnapshots((result.data as any).snapshots || []);
      }
    } catch { /* ignore */ }
    setSnapshotsLoading(false);
  }, [serverId]);

  const fetchGettingStarted = useCallback(async () => {
    setGettingStartedLoading(true);
    try {
      const result = await api.sendCommand(serverId, 'apps.gettingStarted', {});
      if (result.success && result.data) {
        const d = result.data as any;
        setGettingStartedSteps(d.steps || []);
        setGettingStartedRecs(d.recommendations || []);
      }
    } catch { /* ignore */ }
    setGettingStartedLoading(false);
  }, [serverId]);

  const fetchRecommendations = useCallback(async () => {
    setRecsLoading(true);
    try {
      const result = await api.sendCommand(serverId, 'apps.recommendations', {});
      if (result.success && result.data) {
        setRecommendations((result.data as any).recommendations || []);
      }
    } catch { /* ignore */ }
    setRecsLoading(false);
  }, [serverId]);

  const fetchAppGuide = useCallback(async (appId: string) => {
    if (appGuides[appId]) { setShowGuideFor(appId); return; }
    setGuideLoading(appId);
    try {
      const result = await api.sendCommand(serverId, 'apps.guide', { appId });
      if (result.success && result.data) {
        const guide = result.data as AppGuide;
        setAppGuides(prev => ({ ...prev, [appId]: guide }));
        setShowGuideFor(appId);
      }
    } catch { /* ignore */ }
    setGuideLoading(null);
  }, [serverId, appGuides]);

  // ─── Storage Wizard fetchers ────────────────

  const fetchDisksAndPools = useCallback(async () => {
    setDisksLoading(true);
    try {
      const [disksRes, poolsRes] = await Promise.all([
        api.sendCommand(serverId, 'storage.disks'),
        api.sendCommand(serverId, 'storage.pools'),
      ]);
      if (disksRes.success && disksRes.data) {
        const d = disksRes.data as any;
        setDetectedDisks(d.data?.disks || d.disks || []);
      }
      if (poolsRes.success && poolsRes.data) {
        const d = poolsRes.data as any;
        setStoragePools(d.pools || []);
      }
    } catch { /* ignore */ }
    setDisksLoading(false);
  }, [serverId]);

  const handleAssignRoles = useCallback(async (pool: string, roles: string[]) => {
    setAssigningRoles(pool);
    try {
      await api.sendCommand(serverId, 'storage.assignRoles', { pool, roles });
      await fetchDisksAndPools();
    } catch { /* ignore */ }
    setAssigningRoles(null);
  }, [serverId, fetchDisksAndPools]);

  // ─── App Updates fetchers ─────────────────

  const fetchAppUpdates = useCallback(async () => {
    setAppUpdatesLoading(true);
    setAppUpdateMessage(null);
    try {
      const result = await api.sendCommand(serverId, 'apps.checkUpdates');
      if (result.success && result.data) {
        setAppUpdates((result.data as any).apps || []);
      } else {
        setAppUpdateMessage({ type: 'error', text: result.error || 'Failed to check app updates' });
      }
    } catch (err) {
      setAppUpdateMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed' });
    }
    setAppUpdatesLoading(false);
  }, [serverId]);

  const handleUpdateApp = useCallback(async (appId: string) => {
    setUpdatingApp(appId);
    setAppUpdateMessage(null);
    try {
      const result = await api.sendCommand(serverId, 'apps.update', { appId });
      if (result.success) {
        setAppUpdateMessage({ type: 'success', text: `${appId} updated successfully` });
        fetchAppUpdates();
      } else {
        setAppUpdateMessage({ type: 'error', text: result.error || `Failed to update ${appId}` });
      }
    } catch (err) {
      setAppUpdateMessage({ type: 'error', text: err instanceof Error ? err.message : 'Update failed' });
    }
    setUpdatingApp(null);
    setTimeout(() => setAppUpdateMessage(null), 5000);
  }, [serverId, fetchAppUpdates]);

  const handlePruneImages = useCallback(async () => {
    setPruningImages(true);
    setAppUpdateMessage(null);
    try {
      const result = await api.sendCommand(serverId, 'apps.pruneImages');
      if (result.success && result.data) {
        const d = result.data as any;
        setAppUpdateMessage({ type: 'success', text: `Pruned images — ${d.spaceReclaimed || '0 B'} reclaimed` });
      } else {
        setAppUpdateMessage({ type: 'error', text: result.error || 'Failed to prune images' });
      }
    } catch (err) {
      setAppUpdateMessage({ type: 'error', text: err instanceof Error ? err.message : 'Prune failed' });
    }
    setPruningImages(false);
    setTimeout(() => setAppUpdateMessage(null), 5000);
  }, [serverId]);

  // ─── App Backups fetchers ─────────────────

  const fetchAppBackups = useCallback(async () => {
    setAppBackupsLoading(true);
    try {
      const result = await api.sendCommand(serverId, 'backup.list');
      if (result.success && result.data) {
        setAppBackups((result.data as any).backups || []);
      }
    } catch { /* ignore */ }
    setAppBackupsLoading(false);
  }, [serverId]);

  const handleAppBackupAll = useCallback(async () => {
    setAppBackupRunning('all');
    setAppBackupMessage(null);
    try {
      const result = await api.sendCommand(serverId, 'backup.all');
      if (result.success) {
        setAppBackupMessage({ type: 'success', text: 'All apps backed up successfully' });
        fetchAppBackups();
      } else {
        setAppBackupMessage({ type: 'error', text: result.error || 'Backup failed' });
      }
    } catch (err) {
      setAppBackupMessage({ type: 'error', text: err instanceof Error ? err.message : 'Backup failed' });
    }
    setAppBackupRunning(null);
    setTimeout(() => setAppBackupMessage(null), 5000);
  }, [serverId, fetchAppBackups]);

  const handleAppBackupSingle = useCallback(async (appId: string) => {
    setAppBackupRunning(appId);
    setAppBackupMessage(null);
    try {
      const result = await api.sendCommand(serverId, 'backup.app', { appId });
      if (result.success) {
        setAppBackupMessage({ type: 'success', text: `${appId} backed up successfully` });
        fetchAppBackups();
      } else {
        setAppBackupMessage({ type: 'error', text: result.error || `Backup of ${appId} failed` });
      }
    } catch (err) {
      setAppBackupMessage({ type: 'error', text: err instanceof Error ? err.message : 'Backup failed' });
    }
    setAppBackupRunning(null);
    setTimeout(() => setAppBackupMessage(null), 5000);
  }, [serverId, fetchAppBackups]);

  const handleAppBackupRestore = useCallback(async (backupId: string) => {
    if (!confirm('Restore this backup? The app will be stopped and restored.')) return;
    setAppRestoringBackup(backupId);
    setAppBackupMessage(null);
    try {
      const result = await api.sendCommand(serverId, 'backup.restore', { backupId });
      if (result.success) {
        setAppBackupMessage({ type: 'success', text: 'Backup restored successfully' });
      } else {
        setAppBackupMessage({ type: 'error', text: result.error || 'Restore failed' });
      }
    } catch (err) {
      setAppBackupMessage({ type: 'error', text: err instanceof Error ? err.message : 'Restore failed' });
    }
    setAppRestoringBackup(null);
    setTimeout(() => setAppBackupMessage(null), 5000);
  }, [serverId]);

  const handleAppBackupDelete = useCallback(async (backupId: string) => {
    if (!confirm('Delete this backup permanently?')) return;
    setDeletingAppBackup(backupId);
    try {
      const result = await api.sendCommand(serverId, 'backup.delete', { backupId });
      if (result.success) {
        setAppBackupMessage({ type: 'success', text: 'Backup deleted' });
        fetchAppBackups();
      } else {
        setAppBackupMessage({ type: 'error', text: result.error || 'Delete failed' });
      }
    } catch (err) {
      setAppBackupMessage({ type: 'error', text: err instanceof Error ? err.message : 'Delete failed' });
    }
    setDeletingAppBackup(null);
    setTimeout(() => setAppBackupMessage(null), 5000);
  }, [serverId, fetchAppBackups]);

  // ─── Notification Bell fetcher ────────────

  const fetchNotifBell = useCallback(async () => {
    try {
      const result = await api.sendCommand(serverId, 'notifications.check');
      if (result.success && result.data) {
        const d = result.data as any;
        setNotifBellSummary(d.summary || null);
        setNotifBellItems(d.notifications || []);
      }
    } catch { /* ignore */ }
  }, [serverId]);

  const handleMarkAllRead = useCallback(async () => {
    setMarkingAllRead(true);
    try {
      await api.sendCommand(serverId, 'notifications.markRead', { ids: ['all'] });
      await fetchNotifBell();
    } catch { /* ignore */ }
    setMarkingAllRead(false);
  }, [serverId, fetchNotifBell]);

  const handleNotifAction = useCallback(async (command: string) => {
    try {
      await api.sendCommand(serverId, command);
      await fetchNotifBell();
    } catch { /* ignore */ }
  }, [serverId, fetchNotifBell]);

  // ─── Initial + periodic fetch ──────────────

  useEffect(() => {
    if (!serverId) return;
    const init = async () => {
      const online = await fetchServer();
      if (online) {
        fetchGuests();
        fetchNotifBell();
      }
    };
    init();
    const interval = setInterval(fetchServer, 15_000);
    const notifInterval = setInterval(() => { if (server?.is_online) fetchNotifBell(); }, 30_000);
    return () => { clearInterval(interval); clearInterval(notifInterval); };
  }, [serverId, fetchServer, fetchGuests, fetchNotifBell]);

  // ─── Fetch data on tab change ──────────────

  useEffect(() => {
    if (!server?.is_online) return;
    switch (activeTab) {
      case 'overview': fetchGuests(); fetchGettingStarted(); break;
      case 'guests': fetchGuests(); break;
      case 'storage': fetchStorage(); fetchDisksAndPools(); break;
      case 'network': fetchNetwork(); break;
      case 'apps': fetchApps(); fetchRecommendations(); fetchAppUpdates(); fetchAppBackups(); break;
      case 'backups': fetchBackups(); break;
      case 'snapshots': fetchSnapshots(); fetchGuests(); break;
      case 'members': fetchMembers(); break;
      case 'firewall': fetchFirewall(); break;
      case 'settings': fetchSettings(); break;
      case 'notifications': fetchNotifications(); break;
      case 'logs': fetchLogs(); break;
    }
  }, [activeTab, server?.is_online, fetchGuests, fetchStorage, fetchNetwork, fetchApps, fetchLogs, fetchMembers, fetchSettings, fetchNotifications, fetchSnapshots, fetchGettingStarted, fetchRecommendations]);

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
        case 'backups': await fetchBackups(); break;
        case 'snapshots': await fetchSnapshots(); break;
        case 'members': await fetchMembers(); break;
        case 'firewall': await fetchFirewall(); break;
        case 'settings': await fetchSettings(); break;
        case 'notifications': await fetchNotifications(); break;
        case 'logs': await fetchLogs(); break;
        case 'system': fetchUpdates(); break;
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
    setInstallingAppMeta({ name: app.name, icon: app.icon });
    setShowProgressModal(true);
    setInstallMessage(null);
    clearProgress();
    try {
      // Send just the appId — agent looks it up from its own catalog
      // Agent streams progress via WebSocket, final result comes here
      const result = await api.sendCommand(serverId, 'apps.install', { appId: app.id });
      if (result.success) {
        const data = result.data as any;
        const url = data?.url || '';
        const defaultLogin = data?.defaultLogin;
        const loginInfo = defaultLogin ? `\nDefault login: ${defaultLogin.user} / ${defaultLogin.pass}` : '';
        setInstallMessage({
          type: 'success',
          text: url
            ? `✅ ${app.name} installed! Access at ${url}${loginInfo}`
            : `✅ ${app.name} installed successfully!${loginInfo}`,
        });
        if (defaultLogin) {
          setLastInstallResult({ appId: app.id, url, defaultLogin });
        }
        // Store guide if provided
        if (data?.guide) {
          setAppGuides(prev => ({ ...prev, [app.id]: data.guide }));
        }
        // Refresh installed apps list
        fetchApps();
      } else {
        setInstallMessage({ type: 'error', text: result.error || 'Installation failed' });
      }
    } catch (err) {
      setInstallMessage({ type: 'error', text: err instanceof Error ? err.message : 'Installation failed' });
    } finally {
      setInstallingApp(null);
      // Don't auto-close the progress modal — let user dismiss it
    }
  };

  const handleCloseProgressModal = () => {
    setShowProgressModal(false);
    setInstallingAppMeta(null);
    clearProgress();
    // Clear the success/error message after a delay
    setTimeout(() => setInstallMessage(null), 5000);
  };

  const handleAppAction = async (appId: string, action: 'start' | 'stop' | 'uninstall') => {
    try {
      const command = action === 'uninstall' ? 'apps.uninstall' : `apps.${action}`;
      const result = await api.sendCommand(serverId, command, { appId });
      if (result.success) {
        setInstallMessage({
          type: 'success',
          text: action === 'uninstall'
            ? `${appId} uninstalled`
            : `${appId} ${action === 'start' ? 'started' : 'stopped'}`,
        });
        fetchApps();
      } else {
        setInstallMessage({ type: 'error', text: result.error || `Failed to ${action}` });
      }
    } catch (err) {
      setInstallMessage({ type: 'error', text: err instanceof Error ? err.message : `Failed to ${action}` });
    }
    setTimeout(() => setInstallMessage(null), 5000);
  };

  // ─── Stack install handler ──────────────────

  const handleStackInstall = async (stack: AppStack) => {
    setInstallingStack(stack.id);
    setStackResult(null);
    setStackProgress({ current: 0, total: stack.apps.length, currentApp: stack.apps[0], results: [] });

    try {
      const result = await api.sendCommand(serverId, 'stacks.install', { stackId: stack.id });
      if (result.success) {
        const data = result.data as any;
        const results = data?.results || stack.apps.map((app: string) => ({ app, success: true }));
        setStackResult({ stackId: stack.id, results });
        setStackProgress(null);
        fetchApps();
      } else {
        // Treat as all failed
        setStackResult({
          stackId: stack.id,
          results: stack.apps.map(app => ({ app, success: false, error: result.error || 'Stack install failed' })),
        });
        setStackProgress(null);
      }
    } catch (err) {
      setStackResult({
        stackId: stack.id,
        results: stack.apps.map(app => ({ app, success: false, error: err instanceof Error ? err.message : 'Unknown error' })),
      });
      setStackProgress(null);
    } finally {
      setInstallingStack(null);
    }
  };

  // ─── Backup actions ─────────────────────────

  const handleCreateBackup = async (vmid: number, storage: string, mode: string, compress: string, notes?: string) => {
    setCreatingBackup(true);
    setBackupMessage(null);
    try {
      const result = await api.sendCommand(serverId, 'backups.create', { vmid, storage, mode, compress, notes });
      if (result.success) {
        setBackupMessage({ type: 'success', text: `Backup of VM/CT ${vmid} created successfully` });
        setShowCreateBackup(false);
        fetchBackups();
      } else {
        setBackupMessage({ type: 'error', text: result.error || 'Backup creation failed' });
      }
    } catch (err) {
      setBackupMessage({ type: 'error', text: err instanceof Error ? err.message : 'Backup creation failed' });
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDeleteBackup = async (volid: string) => {
    setDeletingBackup(volid);
    try {
      const result = await api.sendCommand(serverId, 'backups.delete', { volid });
      if (result.success) {
        setBackupMessage({ type: 'success', text: 'Backup deleted' });
        fetchBackups();
      } else {
        setBackupMessage({ type: 'error', text: result.error || 'Delete failed' });
      }
    } catch (err) {
      setBackupMessage({ type: 'error', text: err instanceof Error ? err.message : 'Delete failed' });
    } finally {
      setDeletingBackup(null);
      setTimeout(() => setBackupMessage(null), 5000);
    }
  };

  const handleRestoreBackup = async (volid: string, targetStorage?: string) => {
    setRestoringBackup(volid);
    setShowRestoreConfirm(null);
    try {
      const result = await api.sendCommand(serverId, 'backups.restore', { volid, targetStorage: targetStorage || 'local-lvm' });
      if (result.success) {
        const data = result.data as any;
        setBackupMessage({ type: 'success', text: `Backup restored as VM/CT ${data.vmid}` });
        fetchGuests();
      } else {
        setBackupMessage({ type: 'error', text: result.error || 'Restore failed' });
      }
    } catch (err) {
      setBackupMessage({ type: 'error', text: err instanceof Error ? err.message : 'Restore failed' });
    } finally {
      setRestoringBackup(null);
      setTimeout(() => setBackupMessage(null), 5000);
    }
  };

  // ─── Member actions ─────────────────────────

  const handleAddMember = async () => {
    if (!addMemberEmail.trim()) return;
    setAddingMember(true);
    setMemberMessage(null);
    try {
      await api.addMember(serverId, addMemberEmail.trim(), addMemberRole);
      setMemberMessage({ type: 'success', text: `Added ${addMemberEmail} as ${addMemberRole}` });
      setAddMemberEmail('');
      setAddMemberRole('viewer');
      setShowAddMember(false);
      fetchMembers();
    } catch (err) {
      setMemberMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to add member' });
    } finally {
      setAddingMember(false);
      setTimeout(() => setMemberMessage(null), 5000);
    }
  };

  const handleUpdateMemberRole = async (userId: number, role: 'admin' | 'operator' | 'viewer') => {
    try {
      await api.updateMemberRole(serverId, userId, role);
      setMemberMessage({ type: 'success', text: 'Role updated' });
      fetchMembers();
    } catch (err) {
      setMemberMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update role' });
    }
    setTimeout(() => setMemberMessage(null), 5000);
  };

  const handleRemoveMember = async (userId: number, email: string) => {
    if (!confirm(`Remove ${email} from this server?`)) return;
    try {
      await api.removeMember(serverId, userId);
      setMemberMessage({ type: 'success', text: `${email} removed` });
      fetchMembers();
    } catch (err) {
      setMemberMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to remove member' });
    }
    setTimeout(() => setMemberMessage(null), 5000);
  };

  // ─── Firewall actions ────────────────────────

  const handleAddFirewallRule = async (ruleAction: string, protocol: string, port: string, source?: string) => {
    setAddingRule(true);
    setFirewallMessage(null);
    try {
      const result = await api.sendCommand(serverId, 'firewall.addRule', {
        action: ruleAction,
        protocol,
        port,
        source: source || undefined,
      });
      if (result.success) {
        setFirewallMessage({ type: 'success', text: `Rule added: ${ruleAction} ${protocol}/${port}${source ? ` from ${source}` : ''}` });
        setShowAddRule(false);
        fetchFirewall();
      } else {
        setFirewallMessage({ type: 'error', text: result.error || 'Failed to add rule' });
      }
    } catch (err) {
      setFirewallMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to add rule' });
    } finally {
      setAddingRule(false);
      setTimeout(() => setFirewallMessage(null), 5000);
    }
  };

  const handleDeleteFirewallRule = async (ruleNum: number) => {
    if (!confirm(`Delete firewall rule #${ruleNum}?`)) return;
    setDeletingRule(ruleNum);
    try {
      const result = await api.sendCommand(serverId, 'firewall.deleteRule', { ruleNum });
      if (result.success) {
        setFirewallMessage({ type: 'success', text: `Rule #${ruleNum} deleted` });
        fetchFirewall();
      } else {
        setFirewallMessage({ type: 'error', text: result.error || 'Failed to delete rule' });
      }
    } catch (err) {
      setFirewallMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete rule' });
    } finally {
      setDeletingRule(null);
      setTimeout(() => setFirewallMessage(null), 5000);
    }
  };

  // ─── Snapshot actions ────────────────────────

  const handleCreateSnapshot = async (vmid: number, type: string, snapname: string, description: string, includeRAM: boolean) => {
    setCreatingSnapshot(true);
    setSnapshotMessage(null);
    try {
      const result = await api.sendCommand(serverId, 'snapshots.create', { vmid, type, snapname, description, includeRAM });
      if (result.success) {
        setSnapshotMessage({ type: 'success', text: `Snapshot '${snapname}' created for ${type.toUpperCase()} ${vmid}` });
        setShowCreateSnapshot(false);
        fetchSnapshots();
      } else {
        setSnapshotMessage({ type: 'error', text: result.error || 'Snapshot creation failed' });
      }
    } catch (err) {
      setSnapshotMessage({ type: 'error', text: err instanceof Error ? err.message : 'Snapshot creation failed' });
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleDeleteSnapshot = async (vmid: number, type: string, snapname: string) => {
    if (!confirm(`Delete snapshot '${snapname}' from ${type.toUpperCase()} ${vmid}?`)) return;
    setDeletingSnapshot(`${vmid}-${snapname}`);
    try {
      const result = await api.sendCommand(serverId, 'snapshots.delete', { vmid, type, snapname });
      if (result.success) {
        setSnapshotMessage({ type: 'success', text: `Snapshot '${snapname}' deleted` });
        fetchSnapshots();
      } else {
        setSnapshotMessage({ type: 'error', text: result.error || 'Delete failed' });
      }
    } catch (err) {
      setSnapshotMessage({ type: 'error', text: err instanceof Error ? err.message : 'Delete failed' });
    } finally {
      setDeletingSnapshot(null);
      setTimeout(() => setSnapshotMessage(null), 5000);
    }
  };

  const handleRollbackSnapshot = async (vmid: number, type: string, snapname: string) => {
    setRollingBack(`${vmid}-${snapname}`);
    setShowRollbackConfirm(null);
    try {
      const result = await api.sendCommand(serverId, 'snapshots.rollback', { vmid, type, snapname });
      if (result.success) {
        setSnapshotMessage({ type: 'success', text: `Rolled back ${type.toUpperCase()} ${vmid} to '${snapname}'` });
        fetchGuests();
        fetchSnapshots();
      } else {
        setSnapshotMessage({ type: 'error', text: result.error || 'Rollback failed' });
      }
    } catch (err) {
      setSnapshotMessage({ type: 'error', text: err instanceof Error ? err.message : 'Rollback failed' });
    } finally {
      setRollingBack(null);
      setTimeout(() => setSnapshotMessage(null), 5000);
    }
  };

  const filteredSnapshots = useMemo(() => {
    if (snapshotFilter === 'all') return snapshots;
    return snapshots.filter(s => s.vmid === snapshotFilter);
  }, [snapshots, snapshotFilter]);

  const snapshotGuestIds = useMemo(() => {
    const ids = [...new Set(snapshots.map(s => s.vmid))];
    return ids.sort((a, b) => a - b);
  }, [snapshots]);

  // ─── App filtering ─────────────────────────

  const installedIds = useMemo(() => new Set(installedApps.map(a => a.id)), [installedApps]);

  const filteredApps = useMemo(() => {
    const templates = appTemplates.length > 0 ? appTemplates : [];
    let filtered = templates;

    if (appFilter === 'installed') {
      filtered = filtered.filter(a => installedIds.has(a.id));
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
  }, [appTemplates, appCategory, appSearch, appFilter, installedIds]);

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

        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          {server.is_online && (
            <div className="relative">
              <button
                onClick={() => setNotifBellOpen(!notifBellOpen)}
                className="relative p-2 rounded-lg text-nest-400 hover:text-white hover:bg-nest-800/50 transition-colors"
                title="Notifications"
              >
                <Bell size={16} />
                {notifBellSummary && (notifBellSummary.unhealthy > 0 || notifBellSummary.warnings > 0) && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white px-1 animate-pulse">
                    {notifBellSummary.unhealthy + notifBellSummary.warnings}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {notifBellOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifBellOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 z-50 glass rounded-xl glow-border overflow-hidden shadow-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-nest-800/60">
                      <span className="text-sm font-semibold text-white flex items-center gap-2">
                        <Bell size={14} className="text-nest-400" />
                        Notifications
                      </span>
                      <div className="flex items-center gap-2">
                        {notifBellItems.length > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            disabled={markingAllRead}
                            className="text-[10px] text-nest-400 hover:text-white transition-colors"
                          >
                            {markingAllRead ? 'Clearing…' : 'Mark all read'}
                          </button>
                        )}
                        <button onClick={() => setNotifBellOpen(false)} className="text-nest-500 hover:text-white">
                          <X size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Summary */}
                    {notifBellSummary && (
                      <div className="flex items-center gap-3 px-4 py-2 bg-nest-900/30 border-b border-nest-800/40 text-[11px]">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 size={10} /> {notifBellSummary.healthy} healthy
                        </span>
                        {notifBellSummary.warnings > 0 && (
                          <span className="flex items-center gap-1 text-amber-400">
                            <AlertTriangle size={10} /> {notifBellSummary.warnings} warning{notifBellSummary.warnings !== 1 ? 's' : ''}
                          </span>
                        )}
                        {notifBellSummary.unhealthy > 0 && (
                          <span className="flex items-center gap-1 text-rose-400">
                            <XCircle size={10} /> {notifBellSummary.unhealthy} error{notifBellSummary.unhealthy !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Items */}
                    <div className="max-h-[320px] overflow-y-auto divide-y divide-nest-800/30">
                      {notifBellItems.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <BellRing size={24} className="text-nest-600 mx-auto mb-2" />
                          <p className="text-xs text-nest-500">No notifications</p>
                        </div>
                      ) : (
                        notifBellItems.map(item => (
                          <div
                            key={item.id}
                            className={clsx(
                              'px-4 py-3 hover:bg-nest-800/20 transition-colors',
                              !item.read && 'bg-nest-800/10',
                            )}
                          >
                            <div className="flex items-start gap-2.5">
                              <span className="text-sm flex-shrink-0 mt-0.5">
                                {item.type === 'error' ? '🔴' : item.type === 'warning' ? '🟡' : 'ℹ️'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-nest-200">{item.message}</p>
                                <p className="text-[10px] text-nest-500 mt-0.5">
                                  {new Date(item.timestamp).toLocaleString()}
                                </p>
                                {item.actionLabel && item.actionCommand && (
                                  <button
                                    onClick={() => handleNotifAction(item.actionCommand!)}
                                    className="mt-1.5 text-[10px] px-2 py-0.5 rounded bg-nest-700/40 text-nest-300 hover:text-white hover:bg-nest-600/40 transition-all"
                                  >
                                    {item.actionLabel}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium glass text-nest-300 hover:text-white transition-colors"
          >
            <RefreshCw size={14} className={clsx(refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
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
          'rounded-lg px-4 py-3 text-sm',
          installMessage.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
            : 'bg-rose-500/10 border border-rose-500/20 text-rose-400',
        )}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              {installMessage.type === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              {(() => {
                const urlMatch = installMessage.text.match(/(https?:\/\/\S+)/);
                if (urlMatch) {
                  const parts = installMessage.text.split(urlMatch[1]);
                  return (
                    <>
                      {parts[0]}
                      <a href={urlMatch[1]} target="_blank" rel="noopener noreferrer" className="underline font-semibold hover:text-white">
                        {urlMatch[1]}
                      </a>
                      {parts[1]}
                    </>
                  );
                }
                return installMessage.text;
              })()}
            </span>
            <button onClick={() => { setInstallMessage(null); setLastInstallResult(null); }} className="ml-2 hover:text-white">
              <X size={14} />
            </button>
          </div>

          {/* Default login credentials */}
          {installMessage.type === 'success' && lastInstallResult?.defaultLogin && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
              <KeyRound size={13} className="flex-shrink-0" />
              <span>Default Login:</span>
              <code className="font-mono font-semibold">{lastInstallResult.defaultLogin.user}</code>
              <span className="text-nest-500">/</span>
              <code className="font-mono font-semibold">{lastInstallResult.defaultLogin.pass}</code>
            </div>
          )}

          {/* Media directories hint */}
          {installMessage.type === 'success' && lastInstallResult?.appId && MEDIA_APP_IDS.has(lastInstallResult.appId) && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-nest-800/40 border border-nest-700/30 text-nest-400 text-xs">
              <div className="flex items-center gap-1.5 mb-1 text-nest-300">
                <FolderTree size={11} /> Shared Media Directories
              </div>
              <div className="font-mono text-[10px] text-nest-500 space-y-0.5">
                {MEDIA_DIRECTORIES.map(d => <div key={d}>{d}</div>)}
              </div>
            </div>
          )}

          {/* Post-install guide */}
          {installMessage.type === 'success' && lastInstallResult?.appId && appGuides[lastInstallResult.appId] && (() => {
            const guide = appGuides[lastInstallResult.appId];
            return (
              <details className="mt-2 rounded-lg bg-sky-500/5 border border-sky-500/15 overflow-hidden">
                <summary className="px-3 py-2 text-xs text-sky-400 font-semibold cursor-pointer flex items-center gap-1.5 hover:bg-sky-500/10 transition-all">
                  <BookOpen size={12} /> Post-Install Guide — click to expand
                </summary>
                <div className="px-3 pb-3 space-y-2">
                  {guide.postInstallSteps.length > 0 && (
                    <ol className="space-y-1 mt-1">
                      {guide.postInstallSteps.map((step, i) => (
                        <li key={i} className="text-[11px] text-nest-300 flex gap-2">
                          <span className="text-nest-500 font-mono flex-shrink-0">{i + 1}.</span> {step}
                        </li>
                      ))}
                    </ol>
                  )}
                  {guide.tips.length > 0 && guide.tips.map((tip, i) => (
                    <div key={i} className="text-[11px] text-nest-300 flex gap-1.5">
                      <Lightbulb size={10} className="text-amber-400 flex-shrink-0 mt-0.5" /> {tip}
                    </div>
                  ))}
                  {guide.externalDocs && (
                    <a href={guide.externalDocs} target="_blank" rel="noopener noreferrer" className="text-[11px] text-sky-400 hover:underline flex items-center gap-1">
                      <ExternalLink size={10} /> Official Docs
                    </a>
                  )}
                </div>
              </details>
            );
          })()}
        </div>
      )}

      {/* ─── App Detail Modal ───────────────────── */}
      {selectedApp && (
        <AppDetailModal
          app={selectedApp}
          installed={installedIds.has(selectedApp.id)}
          installedInfo={installedApps.find(a => a.id === selectedApp.id)}
          onInstall={handleAppInstall}
          installing={installingApp === selectedApp.id}
          onClose={() => setSelectedApp(null)}
          onAction={handleAppAction}
          onViewLogs={(appId, appName, appIcon) => setLogsApp({ id: appId, name: appName, icon: appIcon })}
        />
      )}

      {/* ─── Install Progress Modal ───────────── */}
      {showProgressModal && installingAppMeta && installProgress && (
        <InstallProgressModal
          appName={installingAppMeta.name}
          appIcon={installingAppMeta.icon}
          progress={installProgress}
          onClose={handleCloseProgressModal}
        />
      )}

      {/* ─── App Logs Modal ─────────────────────── */}
      {logsApp && (
        <AppLogsModal
          serverId={serverId}
          appId={logsApp.id}
          appName={logsApp.name}
          appIcon={logsApp.icon}
          onClose={() => setLogsApp(null)}
        />
      )}

      {/* ─── Container Console Modal ─────────────── */}
      {consoleGuest && (
        <ContainerConsole
          serverId={serverId}
          vmid={consoleGuest.vmid}
          guestType={consoleGuest.type}
          guestName={consoleGuest.name}
          onClose={() => setConsoleGuest(null)}
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
            <TabButton active={activeTab === 'backups'} onClick={() => setActiveTab('backups')} icon={Archive} label="Backups" badge={backups.length} />
            <TabButton active={activeTab === 'snapshots'} onClick={() => setActiveTab('snapshots')} icon={Camera} label="Snapshots" badge={snapshots.length || undefined} />
            <TabButton active={activeTab === 'members'} onClick={() => setActiveTab('members')} icon={Users} label="Members" badge={members.length || undefined} />
            <TabButton active={activeTab === 'firewall'} onClick={() => setActiveTab('firewall')} icon={Shield} label="Firewall" />
            <TabButton active={activeTab === 'system'} onClick={() => setActiveTab('system')} icon={Settings} label="System" />
            <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={Wrench} label="Settings" />
            <TabButton active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')} icon={Bell} label="Alerts" badge={notifRules.filter(r => r.enabled).length || undefined} />
            <TabButton active={activeTab === 'graphs'} onClick={() => setActiveTab('graphs')} icon={BarChart3} label="Graphs" />
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
                      onClick={() => setActiveTab('system')}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/10 transition-all"
                    >
                      <UploadCloud size={12} /> System Updates
                    </button>
                    <button
                      onClick={() => setConsoleGuest({ vmid: 0, type: 'host', name: 'Host Shell' })}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/10 transition-all"
                    >
                      <Terminal size={12} /> Open Terminal
                    </button>
                  </div>
                </div>

                {/* Getting Started */}
                {(gettingStartedSteps.length > 0 || gettingStartedRecs.length > 0) && (
                  <div className="glass rounded-xl p-5 glow-border">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <Sparkles size={14} className="text-amber-400" />
                      Getting Started
                    </h3>

                    {/* Steps checklist */}
                    {gettingStartedSteps.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {gettingStartedSteps.map((s, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <div className={clsx(
                              'mt-0.5 flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                              s.done
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : s.priority === 'high'
                                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                  : s.priority === 'medium'
                                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                    : 'bg-nest-800 text-nest-400 border border-nest-700/50',
                            )}>
                              {s.done ? <CheckCircle2 size={12} /> : (i + 1)}
                            </div>
                            <span className={clsx(
                              'text-sm',
                              s.done ? 'text-nest-500 line-through' : 'text-nest-200',
                            )}>
                              {s.step}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Suggested Apps */}
                    {gettingStartedRecs.length > 0 && (
                      <div>
                        <p className="text-xs text-nest-400 font-semibold uppercase tracking-wider mb-2">Suggested Apps</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {gettingStartedRecs.map(rec => {
                            const tmpl = DEFAULT_APPS.find(a => a.id === rec.appId);
                            if (!tmpl) return null;
                            return (
                              <div key={rec.appId} className="flex items-center gap-3 p-3 rounded-lg bg-nest-800/30 border border-nest-700/30 hover:bg-nest-800/50 transition-all">
                                <span className="text-lg">{tmpl.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white">{tmpl.name}</p>
                                  <p className="text-[11px] text-nest-400 truncate">{rec.reason}</p>
                                </div>
                                {installedIds.has(rec.appId) ? (
                                  <span className="text-[10px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 size={10} /> Installed
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleAppInstall(tmpl)}
                                    disabled={installingApp === rec.appId}
                                    className="text-[11px] px-3 py-1.5 rounded-lg bg-nest-500/20 text-nest-200 hover:bg-nest-400/30 hover:text-white transition-all font-medium disabled:opacity-50 flex items-center gap-1"
                                  >
                                    <Download size={10} /> Install
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
                          onConsole={(vmid, type, name) => setConsoleGuest({ vmid, type, name })}
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
                      onConsole={(vmid, type, name) => setConsoleGuest({ vmid, type, name })}
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

              {/* ── App Stacks Section ── */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Layers size={14} className="text-nest-400" />
                  One-Click Stacks
                  <span className="text-[10px] text-nest-500 font-normal">Install entire app bundles</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {APP_STACKS.map(stack => {
                    const isInstalling = installingStack === stack.id;
                    const result = stackResult?.stackId === stack.id ? stackResult : null;
                    const progress = isInstalling ? stackProgress : null;
                    const allInstalled = stack.apps.every(a => installedIds.has(a));

                    return (
                      <div
                        key={stack.id}
                        className={clsx(
                          'relative overflow-hidden rounded-xl p-4 glow-border transition-all',
                          'bg-gradient-to-br', stack.gradient,
                        )}
                      >
                        <div className="absolute inset-0 bg-nest-950/70 backdrop-blur-sm" />
                        <div className="relative z-10 space-y-3">
                          {/* Stack header */}
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">{stack.icon}</span>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-white">{stack.name}</h4>
                              <p className="text-xs text-nest-400 mt-0.5">{stack.description}</p>
                            </div>
                          </div>

                          {/* Included apps pills */}
                          <div className="flex flex-wrap gap-1.5">
                            {stack.apps.map(appId => {
                              const tmpl = DEFAULT_APPS.find(a => a.id === appId);
                              const isInst = installedIds.has(appId);
                              return (
                                <span
                                  key={appId}
                                  className={clsx(
                                    'inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium',
                                    isInst
                                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                      : 'bg-nest-800/60 text-nest-400 border border-nest-700/30',
                                  )}
                                >
                                  {tmpl?.icon || '📦'} {tmpl?.name || appId}
                                  {isInst && <CheckCircle2 size={8} />}
                                </span>
                              );
                            })}
                          </div>

                          {/* Progress indicator */}
                          {progress && (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 text-xs text-nest-300">
                                <Loader2 size={12} className="animate-spin text-sky-400" />
                                Installing {progress.currentApp}… ({progress.current + 1}/{progress.total})
                              </div>
                              <div className="h-1.5 rounded-full bg-nest-800/60 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-sky-500 transition-all duration-500"
                                  style={{ width: `${((progress.current) / progress.total) * 100}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Results */}
                          {result && (
                            <div className="space-y-1.5 p-2 rounded-lg bg-nest-900/50 border border-nest-800/50">
                              {result.results.map(r => (
                                <div key={r.app} className="flex items-center gap-2 text-xs">
                                  {r.success ? (
                                    <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />
                                  ) : (
                                    <XCircle size={12} className="text-rose-400 flex-shrink-0" />
                                  )}
                                  <span className={r.success ? 'text-nest-300' : 'text-rose-300'}>
                                    {DEFAULT_APPS.find(a => a.id === r.app)?.name || r.app}
                                  </span>
                                  {r.url && (
                                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline ml-auto truncate max-w-[140px]">
                                      {r.url}
                                    </a>
                                  )}
                                  {r.defaultLogin && (
                                    <span className="ml-auto text-[10px] text-amber-400 flex items-center gap-1">
                                      <KeyRound size={9} /> {r.defaultLogin.user} / {r.defaultLogin.pass}
                                    </span>
                                  )}
                                  {r.error && <span className="text-rose-400 text-[10px] ml-auto truncate max-w-[160px]">{r.error}</span>}
                                </div>
                              ))}
                              {/* Media directories if any media apps in results */}
                              {result.results.some(r => r.success && MEDIA_APP_IDS.has(r.app)) && (
                                <div className="mt-2 pt-2 border-t border-nest-800/50">
                                  <div className="flex items-center gap-1.5 text-xs text-nest-400 mb-1">
                                    <FolderTree size={11} /> Shared Media Directories
                                  </div>
                                  <div className="font-mono text-[10px] text-nest-500 space-y-0.5">
                                    {MEDIA_DIRECTORIES.map(d => (
                                      <div key={d}>{d}</div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <button
                                onClick={() => setStackResult(null)}
                                className="text-[10px] text-nest-500 hover:text-nest-300 mt-1"
                              >
                                Dismiss
                              </button>
                            </div>
                          )}

                          {/* Install button */}
                          {!result && (
                            <button
                              onClick={() => handleStackInstall(stack)}
                              disabled={isInstalling || allInstalled}
                              className={clsx(
                                'w-full text-xs px-3 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
                                allInstalled
                                  ? 'bg-emerald-500/10 text-emerald-400 cursor-default'
                                  : isInstalling
                                    ? 'bg-nest-700/30 text-nest-400 cursor-wait'
                                    : 'bg-nest-500/20 text-nest-200 hover:bg-nest-400/30 hover:text-white',
                              )}
                            >
                              {allInstalled ? (
                                <><CheckCircle2 size={12} /> All Installed</>
                              ) : isInstalling ? (
                                <><Loader2 size={12} className="animate-spin" /> Installing Stack…</>
                              ) : (
                                <><Download size={12} /> Install Stack</>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Installed Apps Section */}
              {installedApps.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    Installed Apps ({installedApps.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                    {installedApps.map(app => {
                      const isRunning = app.status === 'running';
                      const connectedApps = CONNECTED_APPS[app.id] || [];
                      const hasCredentials = lastInstallResult?.appId === app.id && lastInstallResult.defaultLogin;
                      return (
                        <div key={app.id} className="glass rounded-xl p-3 glow-border space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              <div className="text-lg p-1.5 rounded-lg bg-white/5 border border-white/5">
                                {DEFAULT_APPS.find(t => t.id === app.id)?.icon || '📦'}
                              </div>
                              <div className={clsx(
                                'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-nest-950',
                                isRunning ? 'bg-emerald-400' : 'bg-rose-400',
                              )} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-white truncate capitalize">{app.id}</span>
                                <span className={clsx(
                                  'text-[10px] px-1.5 py-0.5 rounded font-medium',
                                  isRunning ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400',
                                )}>
                                  {app.status}
                                </span>
                              </div>
                              {app.url && (
                                <a
                                  href={app.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-nest-400 hover:text-nest-200 truncate block"
                                >
                                  {app.url}
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {/* Guide help button */}
                              <button
                                onClick={() => fetchAppGuide(app.id)}
                                disabled={guideLoading === app.id}
                                className={clsx(
                                  'p-1.5 rounded-lg transition-all',
                                  showGuideFor === app.id
                                    ? 'text-sky-400 bg-sky-500/10'
                                    : 'text-nest-400 hover:text-sky-400 hover:bg-sky-500/10',
                                )}
                                title="Setup guide"
                              >
                                {guideLoading === app.id ? <Loader2 size={13} className="animate-spin" /> : <HelpCircle size={13} />}
                              </button>
                              {/* Credentials reveal button */}
                              {hasCredentials && (
                                <button
                                  onClick={() => setShowCredsFor(showCredsFor === app.id ? null : app.id)}
                                  className={clsx(
                                    'p-1.5 rounded-lg transition-all',
                                    showCredsFor === app.id
                                      ? 'text-amber-400 bg-amber-500/10'
                                      : 'text-nest-400 hover:text-amber-400 hover:bg-amber-500/10',
                                  )}
                                  title="Show login credentials"
                                >
                                  <KeyRound size={13} />
                                </button>
                              )}
                              {app.url && (
                                <a
                                  href={app.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg text-nest-400 hover:text-sky-400 hover:bg-sky-500/10 transition-all"
                                  title="Open"
                                >
                                  <ExternalLink size={13} />
                                </a>
                              )}
                              <button
                                onClick={() => setLogsApp({
                                  id: app.id,
                                  name: app.id,
                                  icon: DEFAULT_APPS.find(t => t.id === app.id)?.icon,
                                })}
                                className="p-1.5 rounded-lg text-nest-400 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
                                title="View Logs"
                              >
                                <ScrollText size={13} />
                              </button>
                              {isRunning ? (
                                <button
                                  onClick={() => handleAppAction(app.id, 'stop')}
                                  className="p-1.5 rounded-lg text-nest-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                                  title="Stop"
                                >
                                  <Square size={13} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleAppAction(app.id, 'start')}
                                  className="p-1.5 rounded-lg text-nest-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                                  title="Start"
                                >
                                  <Play size={13} />
                                </button>
                              )}
                              <button
                                onClick={() => handleAppAction(app.id, 'uninstall')}
                                className="p-1.5 rounded-lg text-nest-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                title="Uninstall"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Credentials reveal */}
                          {showCredsFor === app.id && lastInstallResult?.defaultLogin && (
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/15 text-xs">
                              <Lock size={11} className="text-amber-400 flex-shrink-0" />
                              <span className="text-nest-300">Login:</span>
                              <code className="text-amber-300 font-mono text-[11px]">{lastInstallResult.defaultLogin.user}</code>
                              <span className="text-nest-500">/</span>
                              <code className="text-amber-300 font-mono text-[11px]">{lastInstallResult.defaultLogin.pass}</code>
                            </div>
                          )}

                          {/* App Guide Panel */}
                          {showGuideFor === app.id && appGuides[app.id] && (
                            <div className="p-3 rounded-lg bg-sky-500/5 border border-sky-500/15 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                                  <BookOpen size={12} /> Setup Guide
                                </span>
                                <button onClick={() => setShowGuideFor(null)} className="text-nest-500 hover:text-white">
                                  <X size={12} />
                                </button>
                              </div>
                              {appGuides[app.id].postInstallSteps.length > 0 && (
                                <div>
                                  <p className="text-[10px] text-nest-400 font-semibold uppercase tracking-wider mb-1">Steps</p>
                                  <ol className="space-y-1">
                                    {appGuides[app.id].postInstallSteps.map((step, i) => (
                                      <li key={i} className="text-[11px] text-nest-300 flex gap-2">
                                        <span className="text-nest-500 font-mono flex-shrink-0">{i + 1}.</span>
                                        {step}
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              )}
                              {appGuides[app.id].tips.length > 0 && (
                                <div>
                                  <p className="text-[10px] text-nest-400 font-semibold uppercase tracking-wider mb-1">Tips</p>
                                  {appGuides[app.id].tips.map((tip, i) => (
                                    <div key={i} className="text-[11px] text-nest-300 flex gap-1.5 mb-0.5">
                                      <Lightbulb size={10} className="text-amber-400 flex-shrink-0 mt-0.5" /> {tip}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {appGuides[app.id].commonIssues.length > 0 && (
                                <div>
                                  <p className="text-[10px] text-nest-400 font-semibold uppercase tracking-wider mb-1">Common Issues</p>
                                  {appGuides[app.id].commonIssues.map((issue, i) => (
                                    <div key={i} className="text-[11px] mb-1 p-1.5 rounded bg-nest-900/40">
                                      <span className="text-rose-400">⚠ {issue.problem}</span>
                                      <span className="text-nest-400 block mt-0.5">→ {issue.solution}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {appGuides[app.id].externalDocs && (
                                <a
                                  href={appGuides[app.id].externalDocs}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-sky-400 hover:underline flex items-center gap-1"
                                >
                                  <ExternalLink size={10} /> Official Documentation
                                </a>
                              )}
                            </div>
                          )}

                          {/* Connected apps */}
                          {connectedApps.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-nest-500 flex items-center gap-1">
                                <Link2 size={9} /> Works with:
                              </span>
                              {connectedApps.map(cId => {
                                const isInst = installedIds.has(cId);
                                const tmpl = DEFAULT_APPS.find(a => a.id === cId);
                                return (
                                  <button
                                    key={cId}
                                    onClick={() => {
                                      if (!isInst) {
                                        const t = DEFAULT_APPS.find(a => a.id === cId);
                                        if (t) handleAppInstall(t);
                                      }
                                    }}
                                    className={clsx(
                                      'inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full transition-all',
                                      isInst
                                        ? 'bg-emerald-500/10 text-emerald-400 cursor-default'
                                        : 'bg-nest-800/40 text-nest-500 hover:text-nest-300 hover:bg-nest-700/40 cursor-pointer',
                                    )}
                                    title={isInst ? `${tmpl?.name || cId} installed` : `Click to install ${tmpl?.name || cId}`}
                                  >
                                    {tmpl?.icon || '📦'} {tmpl?.name || cId}
                                    {isInst ? <CheckCircle2 size={8} className="text-emerald-400" /> : <Download size={8} />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recommended for You */}
              {recommendations.length > 0 && appFilter === 'all' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Sparkles size={14} className="text-violet-400" />
                    Recommended for You
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {recommendations.map(rec => {
                      const tmpl = DEFAULT_APPS.find(a => a.id === rec.appId);
                      if (!tmpl || installedIds.has(rec.appId)) return null;
                      return (
                        <div
                          key={rec.appId}
                          className={clsx(
                            'relative overflow-hidden rounded-xl p-4 glow-border transition-all group',
                            'bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10',
                          )}
                        >
                          <div className="absolute inset-0 bg-nest-950/70 backdrop-blur-sm group-hover:bg-nest-950/50 transition-colors" />
                          <div className="relative z-10 flex items-center gap-3">
                            <div className="text-2xl p-1.5 rounded-lg bg-white/5 border border-white/5 flex-shrink-0">
                              {tmpl.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white">{tmpl.name}</p>
                              <p className="text-[11px] text-violet-300/70 mt-0.5">{rec.reason}</p>
                            </div>
                            <button
                              onClick={() => handleAppInstall(tmpl)}
                              disabled={installingApp === rec.appId}
                              className="text-[11px] px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-200 hover:bg-violet-400/30 hover:text-white transition-all font-medium disabled:opacity-50 flex items-center gap-1 flex-shrink-0"
                            >
                              {installingApp === rec.appId ? (
                                <><Loader2 size={10} className="animate-spin" /> Installing…</>
                              ) : (
                                <><Download size={10} /> Install</>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
                      installed={installedIds.has(app.id)}
                      installedUrl={installedApps.find(a => a.id === app.id)?.url}
                      onInstall={handleAppInstall}
                      installing={installingApp === app.id}
                      onClick={() => setSelectedApp(app)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ App Updates & Backups (inside apps tab) ═══ */}
          {activeTab === 'apps' && installedApps.length > 0 && (
            <div className="space-y-5 mt-6 border-t border-nest-800/40 pt-6">
              {/* ─── App Update Manager ──────────────── */}
              <div className="glass rounded-xl p-5 glow-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <UploadCloud size={14} className="text-sky-400" />
                    App Update Manager
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePruneImages}
                      disabled={pruningImages}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all border border-amber-500/10 disabled:opacity-50"
                    >
                      {pruningImages ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      Prune Images
                    </button>
                    <button
                      onClick={fetchAppUpdates}
                      disabled={appUpdatesLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium glass text-nest-300 hover:text-white transition-colors"
                    >
                      <RefreshCw size={12} className={clsx(appUpdatesLoading && 'animate-spin')} />
                      Check Updates
                    </button>
                  </div>
                </div>

                {/* Update message */}
                {appUpdateMessage && (
                  <div className={clsx(
                    'rounded-lg px-4 py-3 text-sm mb-4 flex items-center justify-between',
                    appUpdateMessage.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/10 border border-rose-500/20 text-rose-400',
                  )}>
                    <span className="flex items-center gap-2">
                      {appUpdateMessage.type === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      {appUpdateMessage.text}
                    </span>
                    <button onClick={() => setAppUpdateMessage(null)} className="ml-2 hover:text-white">
                      <X size={14} />
                    </button>
                  </div>
                )}

                {appUpdatesLoading ? (
                  <div className="text-center py-6">
                    <Loader2 size={24} className="animate-spin text-sky-400 mx-auto mb-2" />
                    <p className="text-xs text-nest-500">Checking for app updates…</p>
                  </div>
                ) : appUpdates.length === 0 ? (
                  <div className="text-center py-4">
                    <CheckCircle2 size={24} className="text-emerald-400 mx-auto mb-2" />
                    <p className="text-xs text-nest-400">All apps up to date</p>
                    <p className="text-[10px] text-nest-500 mt-0.5">Click "Check Updates" to scan for new versions</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {appUpdates.map(app => (
                      <div key={app.appId} className="flex items-center gap-3 p-3 rounded-lg bg-nest-900/30 hover:bg-nest-800/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-white">{app.name || app.appId}</span>
                            {app.updateAvailable && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 font-medium animate-pulse">
                                Update Available
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-nest-500 font-mono">
                            <span title={app.currentDigest}>Current: {app.currentDigest?.substring(0, 12) || 'N/A'}</span>
                            <span className="text-nest-700">→</span>
                            <span className="text-emerald-400" title={app.latestDigest}>Latest: {app.latestDigest?.substring(0, 12) || 'N/A'}</span>
                          </div>
                        </div>
                        {app.updateAvailable && (
                          <button
                            onClick={() => handleUpdateApp(app.appId)}
                            disabled={updatingApp === app.appId}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 hover:text-white transition-all border border-sky-500/20 disabled:opacity-50 flex-shrink-0"
                          >
                            {updatingApp === app.appId ? (
                              <><Loader2 size={12} className="animate-spin" /> Updating…</>
                            ) : (
                              <><UploadCloud size={12} /> Update</>
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ─── App Backup Manager ──────────────── */}
              <div className="glass rounded-xl p-5 glow-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Archive size={14} className="text-amber-400" />
                    App Backups
                    <span className="text-xs text-nest-500 font-normal ml-1">
                      {appBackups.length} backup{appBackups.length !== 1 ? 's' : ''}
                    </span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchAppBackups}
                      disabled={appBackupsLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium glass text-nest-300 hover:text-white transition-colors"
                    >
                      <RefreshCw size={12} className={clsx(appBackupsLoading && 'animate-spin')} /> Refresh
                    </button>
                    <button
                      onClick={handleAppBackupAll}
                      disabled={appBackupRunning === 'all'}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-all border border-amber-500/20 disabled:opacity-50"
                    >
                      {appBackupRunning === 'all' ? (
                        <><Loader2 size={12} className="animate-spin" /> Backing up…</>
                      ) : (
                        <><Archive size={12} /> Backup All</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Backup message */}
                {appBackupMessage && (
                  <div className={clsx(
                    'rounded-lg px-4 py-3 text-sm mb-4 flex items-center justify-between',
                    appBackupMessage.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/10 border border-rose-500/20 text-rose-400',
                  )}>
                    <span className="flex items-center gap-2">
                      {appBackupMessage.type === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      {appBackupMessage.text}
                    </span>
                    <button onClick={() => setAppBackupMessage(null)} className="ml-2 hover:text-white">
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Per-app backup buttons */}
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  <span className="text-[10px] text-nest-500 uppercase tracking-wider">Backup Single App:</span>
                  {installedApps.map(app => (
                    <button
                      key={app.id}
                      onClick={() => handleAppBackupSingle(app.id)}
                      disabled={appBackupRunning === app.id}
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-nest-800/40 text-nest-400 hover:text-white hover:bg-nest-700/40 transition-all disabled:opacity-50 flex items-center gap-1"
                    >
                      {appBackupRunning === app.id ? <Loader2 size={10} className="animate-spin" /> : <Archive size={10} />}
                      {app.name || app.id}
                    </button>
                  ))}
                </div>

                {/* Backup list */}
                {appBackupsLoading && appBackups.length === 0 ? (
                  <div className="text-center py-4">
                    <Loader2 size={24} className="animate-spin text-nest-400 mx-auto mb-2" />
                    <p className="text-xs text-nest-500">Loading app backups…</p>
                  </div>
                ) : appBackups.length === 0 ? (
                  <div className="text-center py-4">
                    <Archive size={28} className="text-nest-600 mx-auto mb-2" />
                    <p className="text-xs text-nest-500">No app backups yet</p>
                    <p className="text-[10px] text-nest-600 mt-0.5">Use "Backup All" to create your first app backup</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {appBackups.map(backup => {
                      const sizeStr = backup.size > 1073741824
                        ? `${(backup.size / 1073741824).toFixed(1)} GB`
                        : backup.size > 1048576
                        ? `${(backup.size / 1048576).toFixed(0)} MB`
                        : `${(backup.size / 1024).toFixed(0)} KB`;
                      const isDeleting = deletingAppBackup === backup.id;
                      const isRestoring = appRestoringBackup === backup.id;

                      return (
                        <div key={backup.id} className="flex items-center gap-3 p-3 rounded-lg bg-nest-900/30 hover:bg-nest-800/30 transition-colors group">
                          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex-shrink-0">
                            <Archive size={14} className="text-amber-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-white">{backup.appId}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-nest-800 text-nest-400 font-mono truncate max-w-[200px]">
                                {backup.filename || backup.id}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-[10px] text-nest-500">
                              <span className="flex items-center gap-1">
                                <Clock size={10} /> {new Date(backup.date).toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <HardDrive size={10} /> {sizeStr}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {isDeleting || isRestoring ? (
                              <Loader2 size={14} className="animate-spin text-nest-400" />
                            ) : (
                              <>
                                <button
                                  onClick={() => handleAppBackupRestore(backup.id)}
                                  className="p-2 rounded-lg text-nest-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                                  title="Restore"
                                >
                                  <History size={14} />
                                </button>
                                <button
                                  onClick={() => handleAppBackupDelete(backup.id)}
                                  className="p-2 rounded-lg text-nest-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ Storage Tab ══════════════════════ */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Database size={16} className="text-nest-400" />
                  Storage Wizard
                  <span className="text-xs text-nest-500 font-normal ml-1">
                    {storages.length} PVE pools • {detectedDisks.length} disks
                  </span>
                </h2>
                <button
                  onClick={() => { fetchStorage(); fetchDisksAndPools(); }}
                  disabled={disksLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium glass text-nest-300 hover:text-white transition-colors"
                >
                  <RefreshCw size={12} className={clsx(disksLoading && 'animate-spin')} /> Refresh
                </button>
              </div>

              {/* ─── Detected Disks ─────────────────── */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <HardDrive size={14} className="text-indigo-400" />
                  Detected Disks
                </h3>
                {disksLoading && detectedDisks.length === 0 ? (
                  <div className="glass rounded-xl p-6 text-center glow-border">
                    <Loader2 size={24} className="animate-spin text-nest-400 mx-auto mb-2" />
                    <p className="text-xs text-nest-500">Scanning disks…</p>
                  </div>
                ) : detectedDisks.length === 0 ? (
                  <div className="glass rounded-xl p-6 text-center glow-border">
                    <HardDrive size={28} className="text-nest-600 mx-auto mb-2" />
                    <p className="text-xs text-nest-500">No disk info available</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {detectedDisks.map(disk => {
                      const sizeGB = (disk.size / 1073741824).toFixed(1);
                      const healthColor = disk.health === 'PASSED' || disk.health === 'OK'
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : disk.health === 'UNKNOWN'
                        ? 'text-nest-400 bg-nest-800/60'
                        : 'text-rose-400 bg-rose-500/10';
                      return (
                        <div key={disk.devpath} className="glass rounded-xl p-4 glow-border">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex-shrink-0">
                              <HardDrive size={18} className="text-indigo-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-white truncate">{disk.model || 'Unknown Disk'}</span>
                                <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-medium', healthColor)}>
                                  {disk.health || 'N/A'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-nest-500">
                                <span className="font-mono">{disk.devpath}</span>
                                <span className="text-nest-700">•</span>
                                <span>{sizeGB} GB</span>
                                {disk.serial && (
                                  <>
                                    <span className="text-nest-700">•</span>
                                    <span className="truncate max-w-[120px]" title={disk.serial}>{disk.serial}</span>
                                  </>
                                )}
                              </div>
                              <div className="mt-1.5">
                                <span className={clsx(
                                  'text-[10px] px-1.5 py-0.5 rounded font-medium',
                                  disk.used === 'mounted' || disk.used === 'yes'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : disk.used === 'no' || disk.used === 'unused'
                                    ? 'bg-nest-800/60 text-nest-400'
                                    : 'bg-amber-500/10 text-amber-400',
                                )}>
                                  {disk.used === 'mounted' || disk.used === 'yes' ? '● In Use' : disk.used === 'no' || disk.used === 'unused' ? '○ Available' : disk.used || 'Unknown'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ─── Storage Pools with Roles ─────────── */}
              {storagePools.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <FolderOpen size={14} className="text-teal-400" />
                    Storage Pools & Role Assignment
                  </h3>
                  <div className="space-y-3">
                    {storagePools.map(pool => {
                      const usagePct = pool.totalBytes > 0 ? Math.round(pool.usedBytes / pool.totalBytes * 100) : 0;
                      const barColor = usagePct < 70 ? 'bg-emerald-500' : usagePct < 85 ? 'bg-amber-500' : 'bg-rose-500';
                      const roles = pool.roles || [];
                      const allRoles = ['media', 'downloads', 'backups', 'apps'];
                      const isAssigning = assigningRoles === pool.path;

                      return (
                        <div key={pool.path} className="glass rounded-xl p-5 glow-border">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-sm font-semibold text-white font-mono">{pool.path}</p>
                              <p className="text-[10px] text-nest-500 mt-0.5">{pool.type || 'directory'}</p>
                            </div>
                            <p className="text-xs text-nest-400">
                              {(pool.usedBytes / 1073741824).toFixed(1)} / {(pool.totalBytes / 1073741824).toFixed(1)} GB
                            </p>
                          </div>

                          {/* Usage bar */}
                          <div className="h-2 rounded-full bg-nest-800/80 overflow-hidden mb-3">
                            <div className={clsx('h-full rounded-full transition-all', barColor)} style={{ width: `${usagePct}%` }} />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-nest-500 mb-3">
                            <span>{usagePct}% used</span>
                            <span>{(pool.freeBytes / 1073741824).toFixed(1)} GB free</span>
                          </div>

                          {/* Role assignment buttons */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] text-nest-500">Roles:</span>
                            {allRoles.map(role => {
                              const isActive = roles.includes(role);
                              return (
                                <button
                                  key={role}
                                  disabled={isAssigning}
                                  onClick={() => {
                                    const newRoles = isActive
                                      ? roles.filter(r => r !== role)
                                      : [...roles, role];
                                    handleAssignRoles(pool.path, newRoles);
                                  }}
                                  className={clsx(
                                    'text-[10px] px-2 py-1 rounded-lg font-medium transition-all capitalize',
                                    isActive
                                      ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                                      : 'bg-nest-800/40 text-nest-500 hover:text-nest-300 hover:bg-nest-700/40',
                                    isAssigning && 'opacity-50 cursor-wait',
                                  )}
                                >
                                  {isActive ? '✓ ' : ''}{role}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ─── PVE Storage Pools ────────────────── */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Database size={14} className="text-nest-400" />
                  PVE Storage Pools
                  <span className="text-xs text-nest-500 font-normal">{storages.length} pools</span>
                </h3>

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
            </div>
          )}

          {/* ═══ Backups Tab ════════════════════════ */}
          {activeTab === 'backups' && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Archive size={16} className="text-nest-400" />
                  Backup Management
                  <span className="text-xs text-nest-500 font-normal ml-1">
                    {backups.length} backup{backups.length !== 1 ? 's' : ''}
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchBackups}
                    disabled={backupLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium glass text-nest-300 hover:text-white transition-colors"
                  >
                    <RefreshCw size={12} className={clsx(backupLoading && 'animate-spin')} /> Refresh
                  </button>
                  <button
                    onClick={() => setShowCreateBackup(true)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-nest-500/20 text-nest-200 hover:bg-nest-400/30 hover:text-white transition-all border border-nest-400/20"
                  >
                    <Plus size={12} /> Create Backup
                  </button>
                </div>
              </div>

              {/* Backup message */}
              {backupMessage && (
                <div className={clsx(
                  'rounded-lg px-4 py-3 text-sm flex items-center justify-between',
                  backupMessage.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-400',
                )}>
                  <span className="flex items-center gap-2">
                    {backupMessage.type === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {backupMessage.text}
                  </span>
                  <button onClick={() => setBackupMessage(null)} className="ml-2 hover:text-white">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Create Backup Modal */}
              {showCreateBackup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateBackup(false)}>
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                  <div
                    className="relative w-full max-w-md glass rounded-2xl glow-border overflow-hidden"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          <Plus size={18} className="text-nest-400" />
                          Create Backup
                        </h3>
                        <button
                          onClick={() => setShowCreateBackup(false)}
                          className="p-2 rounded-lg text-nest-400 hover:text-white hover:bg-nest-800/50 transition-all"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <form onSubmit={e => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const formData = new FormData(form);
                        handleCreateBackup(
                          parseInt(formData.get('vmid') as string, 10),
                          formData.get('storage') as string,
                          formData.get('mode') as string,
                          formData.get('compress') as string,
                          formData.get('notes') as string || undefined,
                        );
                      }} className="space-y-4">
                        {/* VMID */}
                        <div>
                          <label className="text-xs text-nest-400 font-semibold uppercase tracking-wider block mb-1.5">
                            VM/CT ID
                          </label>
                          <select
                            name="vmid"
                            required
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white focus:outline-none focus:border-nest-400/40 transition-colors"
                          >
                            {guests.map(g => (
                              <option key={g.vmid} value={g.vmid}>
                                {g.vmid} — {g.name} ({g.type === 'qemu' ? 'VM' : 'CT'})
                              </option>
                            ))}
                            {guests.length === 0 && <option value="">No guests available</option>}
                          </select>
                        </div>

                        {/* Storage */}
                        <div>
                          <label className="text-xs text-nest-400 font-semibold uppercase tracking-wider block mb-1.5">
                            Storage
                          </label>
                          <select
                            name="storage"
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white focus:outline-none focus:border-nest-400/40 transition-colors"
                          >
                            {backupStorages.length > 0
                              ? backupStorages.map(s => (
                                  <option key={s.id} value={s.id}>
                                    {s.id} ({s.type}) — {s.availableGB} GB free
                                  </option>
                                ))
                              : <option value="local">local (default)</option>
                            }
                          </select>
                        </div>

                        {/* Mode */}
                        <div>
                          <label className="text-xs text-nest-400 font-semibold uppercase tracking-wider block mb-1.5">
                            Backup Mode
                          </label>
                          <select
                            name="mode"
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white focus:outline-none focus:border-nest-400/40 transition-colors"
                          >
                            <option value="snapshot">Snapshot (no downtime)</option>
                            <option value="suspend">Suspend (brief pause)</option>
                            <option value="stop">Stop (full shutdown)</option>
                          </select>
                        </div>

                        {/* Compression */}
                        <div>
                          <label className="text-xs text-nest-400 font-semibold uppercase tracking-wider block mb-1.5">
                            Compression
                          </label>
                          <select
                            name="compress"
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white focus:outline-none focus:border-nest-400/40 transition-colors"
                          >
                            <option value="zstd">ZSTD (fast + small)</option>
                            <option value="lzo">LZO (fast)</option>
                            <option value="gzip">GZIP (compatible)</option>
                            <option value="none">None</option>
                          </select>
                        </div>

                        {/* Notes */}
                        <div>
                          <label className="text-xs text-nest-400 font-semibold uppercase tracking-wider block mb-1.5">
                            Notes (optional)
                          </label>
                          <input
                            name="notes"
                            type="text"
                            placeholder="Pre-upgrade backup..."
                            maxLength={200}
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white placeholder-nest-500 focus:outline-none focus:border-nest-400/40 transition-colors"
                          />
                        </div>

                        {/* Submit */}
                        <button
                          type="submit"
                          disabled={creatingBackup || guests.length === 0}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-nest-500/30 to-nest-400/30 hover:from-nest-500/50 hover:to-nest-400/50 text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-nest-400/20"
                        >
                          {creatingBackup ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Creating Backup… (this may take a while)
                            </>
                          ) : (
                            <>
                              <Archive size={14} /> Create Backup
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {/* Restore Confirm Modal */}
              {showRestoreConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowRestoreConfirm(null)}>
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                  <div
                    className="relative w-full max-w-sm glass rounded-2xl glow-border overflow-hidden p-6"
                    onClick={e => e.stopPropagation()}
                  >
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                      <History size={18} className="text-amber-400" />
                      Restore Backup
                    </h3>
                    <p className="text-sm text-nest-300 mb-2">
                      This will create a new VM/CT from this backup:
                    </p>
                    <div className="glass rounded-lg p-3 mb-4 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-nest-500">File</span>
                        <span className="text-nest-300 font-mono truncate ml-2 max-w-[200px]">{showRestoreConfirm.filename}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-nest-500">VMID</span>
                        <span className="text-white">{showRestoreConfirm.vmid}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-nest-500">Size</span>
                        <span className="text-nest-300">
                          {showRestoreConfirm.size > 1073741824
                            ? `${(showRestoreConfirm.size / 1073741824).toFixed(1)} GB`
                            : `${(showRestoreConfirm.size / 1048576).toFixed(0)} MB`}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-amber-400/80 mb-4">
                      ⚠ A new VM/CT will be created with the next available ID.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowRestoreConfirm(null)}
                        className="flex-1 py-2.5 rounded-xl glass text-nest-300 text-sm font-medium hover:text-white transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleRestoreBackup(showRestoreConfirm.volid)}
                        disabled={restoringBackup !== null}
                        className="flex-1 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {restoringBackup ? (
                          <><Loader2 size={14} className="animate-spin" /> Restoring…</>
                        ) : (
                          <><History size={14} /> Restore</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Backup List */}
              {backupLoading && backups.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center glow-border">
                  <Loader2 size={36} className="text-nest-600 mx-auto mb-3 animate-spin" />
                  <p className="text-sm text-nest-400">Loading backups…</p>
                </div>
              ) : backups.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center glow-border">
                  <Archive size={36} className="text-nest-600 mx-auto mb-3" />
                  <p className="text-sm text-nest-400">No backups found</p>
                  <p className="text-xs text-nest-500 mt-1">Create your first backup to protect your VMs & containers</p>
                  <button
                    onClick={() => setShowCreateBackup(true)}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-nest-500/20 text-nest-200 hover:bg-nest-400/30 transition-all border border-nest-400/20"
                  >
                    <Plus size={12} /> Create Backup
                  </button>
                </div>
              ) : (
                <>
                  {/* Summary */}
                  <div className="glass rounded-xl p-4 glow-border">
                    <div className="flex items-center gap-6 flex-wrap">
                      <div>
                        <p className="text-[10px] text-nest-500 uppercase tracking-wider">Total Backups</p>
                        <p className="text-lg font-bold text-white">{backups.length}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-nest-500 uppercase tracking-wider">Total Size</p>
                        <p className="text-lg font-bold text-white">
                          {(() => {
                            const total = backups.reduce((s, b) => s + b.size, 0);
                            if (total > 1073741824) return `${(total / 1073741824).toFixed(1)} GB`;
                            return `${(total / 1048576).toFixed(0)} MB`;
                          })()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-nest-500 uppercase tracking-wider">VMs/CTs Backed Up</p>
                        <p className="text-lg font-bold text-white">
                          {new Set(backups.map(b => b.vmid)).size}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-nest-500 uppercase tracking-wider">Latest Backup</p>
                        <p className="text-sm font-semibold text-white">
                          {backups[0]?.timestamp
                            ? new Date(backups[0].timestamp).toLocaleDateString()
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Backup Cards */}
                  <div className="space-y-2">
                    {backups.map(backup => {
                      const isLxc = backup.filename.includes('vzdump-lxc');
                      const isDeleting = deletingBackup === backup.volid;
                      const isRestoring = restoringBackup === backup.volid;
                      const sizeStr = backup.size > 1073741824
                        ? `${(backup.size / 1073741824).toFixed(1)} GB`
                        : `${(backup.size / 1048576).toFixed(0)} MB`;
                      const dateStr = backup.timestamp
                        ? new Date(backup.timestamp).toLocaleString()
                        : 'Unknown date';
                      const guestName = guests.find(g => g.vmid === backup.vmid)?.name;

                      return (
                        <div key={backup.volid} className="glass rounded-xl p-4 glow-border glass-hover transition-all group">
                          <div className="flex items-center gap-4">
                            {/* Icon */}
                            <div className={clsx(
                              'flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0',
                              isLxc
                                ? 'bg-cyan-500/10 border border-cyan-500/20'
                                : 'bg-indigo-500/10 border border-indigo-500/20',
                            )}>
                              <Archive size={18} className={isLxc ? 'text-cyan-400' : 'text-indigo-400'} />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-white">
                                  {guestName || `VMID ${backup.vmid}`}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-nest-800 text-nest-400 font-mono">
                                  {backup.vmid}
                                </span>
                                <span className={clsx(
                                  'text-[10px] px-1.5 py-0.5 rounded-md font-medium uppercase',
                                  isLxc
                                    ? 'bg-cyan-500/10 text-cyan-400'
                                    : 'bg-indigo-500/10 text-indigo-400',
                                )}>
                                  {isLxc ? 'CT' : 'VM'}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-nest-800/60 text-nest-500">
                                  {backup.format}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 mt-1.5 text-xs text-nest-500">
                                <span className="flex items-center gap-1">
                                  <Clock size={10} /> {dateStr}
                                </span>
                                <span className="flex items-center gap-1">
                                  <HardDrive size={10} /> {sizeStr}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Database size={10} /> {backup.storage}
                                </span>
                              </div>
                              {backup.notes && (
                                <p className="text-[11px] text-nest-400 mt-1 truncate max-w-md">{backup.notes}</p>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {isRestoring || isDeleting ? (
                                <Loader2 size={16} className="animate-spin text-nest-400" />
                              ) : (
                                <>
                                  <button
                                    onClick={() => setShowRestoreConfirm(backup)}
                                    className="p-2 rounded-lg text-nest-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                                    title="Restore"
                                  >
                                    <History size={14} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Delete backup of VMID ${backup.vmid}?\n${backup.filename}`)) {
                                        handleDeleteBackup(backup.volid);
                                      }
                                    }}
                                    className="p-2 rounded-lg text-nest-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                    title="Delete"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Backup storage info */}
              {backupStorages.length > 0 && (
                <div className="glass rounded-xl p-4 glow-border">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Database size={14} className="text-nest-400" />
                    Backup Storage
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {backupStorages.map(s => (
                      <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-nest-900/30">
                        <FolderOpen size={16} className="text-nest-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white">{s.id}</p>
                          <p className="text-[10px] text-nest-500">{s.type} — {s.availableGB} GB free</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ Snapshots Tab ═════════════════════ */}
          {activeTab === 'snapshots' && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Camera size={16} className="text-nest-400" />
                  Snapshot Management
                  <span className="text-xs text-nest-500 font-normal ml-1">
                    {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchSnapshots}
                    disabled={snapshotsLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium glass text-nest-300 hover:text-white transition-colors"
                  >
                    <RefreshCw size={12} className={clsx(snapshotsLoading && 'animate-spin')} /> Refresh
                  </button>
                  <button
                    onClick={() => setShowCreateSnapshot(true)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-nest-500/20 text-nest-200 hover:bg-nest-400/30 hover:text-white transition-all border border-nest-400/20"
                  >
                    <Plus size={12} /> Create Snapshot
                  </button>
                </div>
              </div>

              {/* Snapshot message */}
              {snapshotMessage && (
                <div className={clsx(
                  'rounded-lg px-4 py-3 text-sm flex items-center justify-between',
                  snapshotMessage.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-400',
                )}>
                  <span className="flex items-center gap-2">
                    {snapshotMessage.type === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {snapshotMessage.text}
                  </span>
                  <button onClick={() => setSnapshotMessage(null)} className="ml-2 hover:text-white">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Filter by guest */}
              {snapshotGuestIds.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-xs text-nest-500">Filter:</span>
                  <button
                    onClick={() => setSnapshotFilter('all')}
                    className={clsx(
                      'text-[11px] px-2.5 py-1 rounded-lg transition-all',
                      snapshotFilter === 'all'
                        ? 'bg-nest-600/30 text-white border border-nest-400/20'
                        : 'text-nest-400 hover:text-white bg-nest-800/30',
                    )}
                  >
                    All ({snapshots.length})
                  </button>
                  {snapshotGuestIds.map(vmid => {
                    const guest = guests.find(g => g.vmid === vmid);
                    const count = snapshots.filter(s => s.vmid === vmid).length;
                    return (
                      <button
                        key={vmid}
                        onClick={() => setSnapshotFilter(vmid)}
                        className={clsx(
                          'text-[11px] px-2.5 py-1 rounded-lg transition-all',
                          snapshotFilter === vmid
                            ? 'bg-nest-600/30 text-white border border-nest-400/20'
                            : 'text-nest-400 hover:text-white bg-nest-800/30',
                        )}
                      >
                        {guest?.name || `ID ${vmid}`} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Create Snapshot Modal */}
              {showCreateSnapshot && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateSnapshot(false)}>
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                  <div
                    className="relative w-full max-w-md glass rounded-2xl glow-border overflow-hidden"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          <Camera size={18} className="text-nest-400" />
                          Create Snapshot
                        </h3>
                        <button
                          onClick={() => setShowCreateSnapshot(false)}
                          className="p-2 rounded-lg text-nest-400 hover:text-white hover:bg-nest-800/50 transition-all"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <form onSubmit={e => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const formData = new FormData(form);
                        const vmidVal = formData.get('vmid') as string;
                        const [vid, vtype] = vmidVal.split(':');
                        handleCreateSnapshot(
                          parseInt(vid, 10),
                          vtype,
                          (formData.get('snapname') as string) || `snap-${Date.now()}`,
                          (formData.get('description') as string) || '',
                          formData.get('includeRAM') === 'on',
                        );
                      }} className="space-y-4">
                        {/* Guest selector */}
                        <div>
                          <label className="text-xs text-nest-400 font-semibold uppercase tracking-wider block mb-1.5">
                            VM / Container
                          </label>
                          <select
                            name="vmid"
                            required
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white focus:outline-none focus:border-nest-400/40 transition-colors"
                          >
                            {guests.map(g => (
                              <option key={g.vmid} value={`${g.vmid}:${g.type}`}>
                                {g.vmid} — {g.name} ({g.type === 'qemu' ? 'VM' : 'CT'}) [{g.status}]
                              </option>
                            ))}
                            {guests.length === 0 && <option value="">No guests available</option>}
                          </select>
                        </div>

                        {/* Snapshot name */}
                        <div>
                          <label className="text-xs text-nest-400 font-semibold uppercase tracking-wider block mb-1.5">
                            Snapshot Name
                          </label>
                          <input
                            name="snapname"
                            type="text"
                            placeholder={`snap-${Date.now()}`}
                            pattern="[a-zA-Z0-9_-]+"
                            title="Only letters, numbers, hyphens, and underscores"
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white placeholder-nest-500 focus:outline-none focus:border-nest-400/40 transition-colors"
                          />
                          <p className="text-[10px] text-nest-500 mt-1">Letters, numbers, hyphens, underscores only</p>
                        </div>

                        {/* Description */}
                        <div>
                          <label className="text-xs text-nest-400 font-semibold uppercase tracking-wider block mb-1.5">
                            Description (optional)
                          </label>
                          <input
                            name="description"
                            type="text"
                            placeholder="Before upgrade..."
                            maxLength={200}
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white placeholder-nest-500 focus:outline-none focus:border-nest-400/40 transition-colors"
                          />
                        </div>

                        {/* Include RAM (VM only) */}
                        <div className="flex items-center gap-3">
                          <input
                            name="includeRAM"
                            type="checkbox"
                            className="w-4 h-4 rounded bg-nest-800 border-nest-600 text-nest-500 focus:ring-nest-400"
                          />
                          <div>
                            <label className="text-xs text-nest-300 font-medium">Include RAM State</label>
                            <p className="text-[10px] text-nest-500">VMs only — saves memory state (slower, larger snapshot)</p>
                          </div>
                        </div>

                        {/* Submit */}
                        <button
                          type="submit"
                          disabled={creatingSnapshot || guests.length === 0}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-nest-500/30 to-nest-400/30 hover:from-nest-500/50 hover:to-nest-400/50 text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-nest-400/20"
                        >
                          {creatingSnapshot ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Creating Snapshot…
                            </>
                          ) : (
                            <>
                              <Camera size={14} /> Create Snapshot
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {/* Rollback Confirm Modal */}
              {showRollbackConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowRollbackConfirm(null)}>
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                  <div
                    className="relative w-full max-w-sm glass rounded-2xl glow-border overflow-hidden p-6"
                    onClick={e => e.stopPropagation()}
                  >
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                      <History size={18} className="text-amber-400" />
                      Rollback to Snapshot
                    </h3>
                    <p className="text-sm text-nest-300 mb-2">
                      This will revert {showRollbackConfirm.type.toUpperCase()} {showRollbackConfirm.vmid} ({showRollbackConfirm.guestName}) to the state captured in this snapshot:
                    </p>
                    <div className="glass rounded-lg p-3 mb-4 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-nest-500">Snapshot</span>
                        <span className="text-white font-mono">{showRollbackConfirm.name}</span>
                      </div>
                      {showRollbackConfirm.snaptime > 0 && (
                        <div className="flex justify-between">
                          <span className="text-nest-500">Created</span>
                          <span className="text-nest-300">{new Date(showRollbackConfirm.snaptime * 1000).toLocaleString()}</span>
                        </div>
                      )}
                      {showRollbackConfirm.description && (
                        <div className="flex justify-between">
                          <span className="text-nest-500">Description</span>
                          <span className="text-nest-300 truncate ml-2 max-w-[180px]">{showRollbackConfirm.description}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-rose-400/80 mb-4">
                      ⚠ The guest will be stopped if running. All changes since this snapshot will be lost!
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowRollbackConfirm(null)}
                        className="flex-1 py-2.5 rounded-xl glass text-nest-300 text-sm font-medium hover:text-white transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleRollbackSnapshot(showRollbackConfirm.vmid, showRollbackConfirm.type, showRollbackConfirm.name)}
                        disabled={rollingBack !== null}
                        className="flex-1 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {rollingBack ? <Loader2 size={14} className="animate-spin" /> : <History size={14} />}
                        Rollback
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Snapshot List */}
              {snapshotsLoading && snapshots.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center glow-border">
                  <Loader2 size={24} className="animate-spin text-nest-400 mx-auto mb-3" />
                  <p className="text-sm text-nest-400">Loading snapshots…</p>
                </div>
              ) : filteredSnapshots.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center glow-border">
                  <Camera size={36} className="text-nest-600 mx-auto mb-3" />
                  <p className="text-sm text-nest-400">
                    {snapshots.length === 0 ? 'No snapshots found' : 'No snapshots match the filter'}
                  </p>
                  <p className="text-xs text-nest-500 mt-1">
                    Create snapshots to capture the state of your VMs and containers
                  </p>
                  <button
                    onClick={() => setShowCreateSnapshot(true)}
                    className="mt-4 text-xs px-4 py-2 rounded-lg bg-nest-500/20 text-nest-200 hover:bg-nest-400/30 transition-all border border-nest-400/20"
                  >
                    <Plus size={10} className="inline mr-1" /> Create First Snapshot
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSnapshots.map(snap => {
                    const snapKey = `${snap.vmid}-${snap.name}`;
                    const isDeleting = deletingSnapshot === snapKey;
                    const isRolling = rollingBack === snapKey;

                    return (
                      <div key={snapKey} className="glass rounded-xl p-4 glow-border glass-hover transition-all group">
                        <div className="flex items-center gap-4">
                          {/* Icon */}
                          <div className="relative flex-shrink-0">
                            <div className={clsx(
                              'flex h-10 w-10 items-center justify-center rounded-xl',
                              snap.type === 'qemu'
                                ? 'bg-indigo-500/10 border border-indigo-500/20'
                                : 'bg-cyan-500/10 border border-cyan-500/20',
                            )}>
                              <Camera size={18} className={snap.type === 'qemu' ? 'text-indigo-400' : 'text-cyan-400'} />
                            </div>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-white font-mono">{snap.name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-nest-800 text-nest-400">
                                {snap.guestName || `ID ${snap.vmid}`}
                              </span>
                              <span className={clsx(
                                'text-[10px] px-1.5 py-0.5 rounded-md font-medium uppercase',
                                snap.type === 'qemu'
                                  ? 'bg-indigo-500/10 text-indigo-400'
                                  : 'bg-cyan-500/10 text-cyan-400',
                              )}>
                                {snap.type === 'qemu' ? 'VM' : 'CT'} {snap.vmid}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-nest-500">
                              {snap.snaptime > 0 && (
                                <span className="flex items-center gap-1">
                                  <Clock size={10} />
                                  {new Date(snap.snaptime * 1000).toLocaleString()}
                                </span>
                              )}
                              {snap.description && (
                                <span className="truncate max-w-[300px]" title={snap.description}>
                                  {snap.description}
                                </span>
                              )}
                              {snap.parent && (
                                <span className="flex items-center gap-1 text-nest-600">
                                  ← {snap.parent}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isDeleting || isRolling ? (
                              <Loader2 size={16} className="animate-spin text-nest-400" />
                            ) : (
                              <>
                                <button
                                  onClick={() => setShowRollbackConfirm(snap)}
                                  className="p-2 rounded-lg text-nest-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                                  title="Rollback to this snapshot"
                                >
                                  <History size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteSnapshot(snap.vmid, snap.type, snap.name)}
                                  className="p-2 rounded-lg text-nest-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                  title="Delete snapshot"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Info box */}
              <div className="glass rounded-xl p-4 glow-border">
                <div className="flex items-start gap-3">
                  <Info size={16} className="text-nest-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-nest-500 space-y-1">
                    <p><strong className="text-nest-300">Snapshots</strong> capture the complete state of a VM or container at a point in time.</p>
                    <p>• <strong className="text-nest-400">Create</strong> a snapshot before making risky changes (upgrades, config edits)</p>
                    <p>• <strong className="text-nest-400">Rollback</strong> to revert to a previous state if something goes wrong</p>
                    <p>• <strong className="text-nest-400">Delete</strong> old snapshots to reclaim disk space (snapshots grow over time)</p>
                    <p className="text-amber-400/70">⚠ Rollback will stop the guest if running and discard all changes since the snapshot</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Members Tab ════════════════════════ */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Users size={16} className="text-nest-400" />
                  User Management
                  <span className="text-xs text-nest-500 font-normal ml-1">
                    {members.length} member{members.length !== 1 ? 's' : ''}
                  </span>
                </h2>
                <button
                  onClick={() => setShowAddMember(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-nest-500/20 text-nest-200 hover:bg-nest-400/30 hover:text-white transition-all border border-nest-400/20"
                >
                  <UserPlus size={12} /> Add Member
                </button>
              </div>

              {/* Member message */}
              {memberMessage && (
                <div className={clsx(
                  'rounded-lg px-4 py-3 text-sm flex items-center justify-between',
                  memberMessage.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-400',
                )}>
                  <span className="flex items-center gap-2">
                    {memberMessage.type === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {memberMessage.text}
                  </span>
                  <button onClick={() => setMemberMessage(null)} className="ml-2 hover:text-white">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Role Legend */}
              <div className="glass rounded-xl p-4 glow-border">
                <h3 className="text-xs font-semibold text-nest-400 uppercase tracking-wider mb-3">Role Permissions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { role: 'Owner', icon: Crown, color: 'text-amber-400', bg: 'bg-amber-500/10', perms: 'Full control, transfer ownership' },
                    { role: 'Admin', icon: ShieldCheck, color: 'text-indigo-400', bg: 'bg-indigo-500/10', perms: 'Manage members, all commands' },
                    { role: 'Operator', icon: WrenchIcon, color: 'text-emerald-400', bg: 'bg-emerald-500/10', perms: 'Control guests, apps, backups' },
                    { role: 'Viewer', icon: EyeIcon, color: 'text-nest-400', bg: 'bg-nest-800/60', perms: 'Read-only access' },
                  ].map(({ role, icon: Icon, color, bg, perms }) => (
                    <div key={role} className={clsx('flex items-center gap-2.5 p-2.5 rounded-lg', bg)}>
                      <Icon size={14} className={color} />
                      <div>
                        <p className={clsx('text-xs font-semibold', color)}>{role}</p>
                        <p className="text-[10px] text-nest-500">{perms}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add Member Modal */}
              {showAddMember && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowAddMember(false)}>
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                  <div
                    className="relative w-full max-w-md glass rounded-2xl glow-border overflow-hidden"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          <UserPlus size={18} className="text-nest-400" />
                          Add Member
                        </h3>
                        <button
                          onClick={() => setShowAddMember(false)}
                          className="p-2 rounded-lg text-nest-400 hover:text-white hover:bg-nest-800/50 transition-all"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="space-y-4">
                        {/* Email */}
                        <div>
                          <label className="text-xs text-nest-400 font-semibold uppercase tracking-wider block mb-1.5">
                            Email Address
                          </label>
                          <input
                            type="email"
                            value={addMemberEmail}
                            onChange={e => setAddMemberEmail(e.target.value)}
                            placeholder="user@example.com"
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white placeholder-nest-500 focus:outline-none focus:border-nest-400/40 transition-colors"
                            autoFocus
                          />
                          <p className="text-[10px] text-nest-500 mt-1">User must have a ProxNest account</p>
                        </div>

                        {/* Role */}
                        <div>
                          <label className="text-xs text-nest-400 font-semibold uppercase tracking-wider block mb-1.5">
                            Role
                          </label>
                          <div className="space-y-2">
                            {([
                              { value: 'viewer' as const, label: 'Viewer', desc: 'Can view metrics, status, and logs', icon: EyeIcon, color: 'text-nest-400' },
                              { value: 'operator' as const, label: 'Operator', desc: 'Can control guests, apps, and create backups', icon: WrenchIcon, color: 'text-emerald-400' },
                              { value: 'admin' as const, label: 'Admin', desc: 'Full access except ownership transfer', icon: ShieldCheck, color: 'text-indigo-400' },
                            ]).map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setAddMemberRole(opt.value)}
                                className={clsx(
                                  'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all',
                                  addMemberRole === opt.value
                                    ? 'bg-nest-600/20 border border-nest-400/20'
                                    : 'bg-nest-900/30 border border-transparent hover:bg-nest-800/50',
                                )}
                              >
                                <opt.icon size={16} className={opt.color} />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-white">{opt.label}</p>
                                  <p className="text-[11px] text-nest-500">{opt.desc}</p>
                                </div>
                                <div className={clsx(
                                  'h-4 w-4 rounded-full border-2 transition-all',
                                  addMemberRole === opt.value
                                    ? 'border-nest-400 bg-nest-400'
                                    : 'border-nest-600',
                                )} />
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Submit */}
                        <button
                          onClick={handleAddMember}
                          disabled={addingMember || !addMemberEmail.trim()}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-nest-500/30 to-nest-400/30 hover:from-nest-500/50 hover:to-nest-400/50 text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-nest-400/20"
                        >
                          {addingMember ? (
                            <><Loader2 size={14} className="animate-spin" /> Adding…</>
                          ) : (
                            <><UserPlus size={14} /> Add Member</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Member List */}
              {membersLoading && members.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center glow-border">
                  <Loader2 size={36} className="text-nest-600 mx-auto mb-3 animate-spin" />
                  <p className="text-sm text-nest-400">Loading members…</p>
                </div>
              ) : members.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center glow-border">
                  <Users size={36} className="text-nest-600 mx-auto mb-3" />
                  <p className="text-sm text-nest-400">No members yet</p>
                  <p className="text-xs text-nest-500 mt-1">Add team members to share access to this server</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map(member => {
                    const isOwnerRole = member.role === 'owner';
                    const roleConfig = {
                      owner: { icon: Crown, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
                      admin: { icon: ShieldCheck, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
                      operator: { icon: WrenchIcon, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                      viewer: { icon: EyeIcon, color: 'text-nest-400', bg: 'bg-nest-800/60', border: 'border-nest-700' },
                    }[member.role] || { icon: EyeIcon, color: 'text-nest-400', bg: 'bg-nest-800/60', border: 'border-nest-700' };
                    const RoleIcon = roleConfig.icon;

                    return (
                      <div key={member.user_id} className="glass rounded-xl p-4 glow-border glass-hover transition-all group">
                        <div className="flex items-center gap-4">
                          {/* Avatar */}
                          <div className="relative flex-shrink-0">
                            {member.avatar_url ? (
                              <img
                                src={member.avatar_url}
                                alt={member.display_name || member.email}
                                className="h-10 w-10 rounded-xl object-cover border border-nest-800"
                              />
                            ) : (
                              <div className={clsx(
                                'flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold',
                                roleConfig.bg, 'border', roleConfig.border,
                              )}>
                                <span className={roleConfig.color}>
                                  {(member.display_name || member.email).charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            {isOwnerRole && (
                              <div className="absolute -top-1 -right-1">
                                <Crown size={10} className="text-amber-400 fill-amber-400" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-white truncate">
                                {member.display_name || member.email.split('@')[0]}
                              </span>
                              <span className={clsx(
                                'text-[10px] px-1.5 py-0.5 rounded-md font-medium uppercase flex items-center gap-1',
                                roleConfig.bg, roleConfig.color, 'border', roleConfig.border,
                              )}>
                                <RoleIcon size={10} />
                                {member.role}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-nest-500">
                              <span className="truncate">{member.email}</span>
                              {member.invited_by_email && (
                                <>
                                  <span className="text-nest-700">•</span>
                                  <span>Invited by {member.invited_by_email.split('@')[0]}</span>
                                </>
                              )}
                              <span className="text-nest-700">•</span>
                              <span>{new Date(member.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>

                          {/* Actions */}
                          {!isOwnerRole && (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {/* Role selector */}
                              <select
                                value={member.role}
                                onChange={e => handleUpdateMemberRole(member.user_id, e.target.value as 'admin' | 'operator' | 'viewer')}
                                className="text-[11px] px-2 py-1.5 rounded-lg bg-nest-900/50 border border-nest-800 text-nest-300 focus:outline-none focus:border-nest-400/40 cursor-pointer transition-colors"
                              >
                                <option value="viewer">Viewer</option>
                                <option value="operator">Operator</option>
                                <option value="admin">Admin</option>
                              </select>
                              {/* Remove */}
                              <button
                                onClick={() => handleRemoveMember(member.user_id, member.email)}
                                className="p-2 rounded-lg text-nest-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                title="Remove member"
                              >
                                <UserMinus size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ Firewall Tab ════════════════════════ */}
          {activeTab === 'firewall' && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Shield size={16} className="text-nest-400" />
                  Firewall Management
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchFirewall}
                    disabled={firewallLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium glass text-nest-300 hover:text-white transition-colors"
                  >
                    <RefreshCw size={12} className={clsx(firewallLoading && 'animate-spin')} /> Refresh
                  </button>
                  <button
                    onClick={() => setShowAddRule(true)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-nest-500/20 text-nest-200 hover:bg-nest-400/30 hover:text-white transition-all border border-nest-400/20"
                  >
                    <Plus size={12} /> Add Rule
                  </button>
                </div>
              </div>

              {/* Message */}
              {firewallMessage && (
                <div className={clsx(
                  'rounded-lg px-4 py-3 text-sm flex items-center justify-between',
                  firewallMessage.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-400',
                )}>
                  <span className="flex items-center gap-2">
                    {firewallMessage.type === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {firewallMessage.text}
                  </span>
                  <button onClick={() => setFirewallMessage(null)} className="ml-2 hover:text-white">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Add Rule Modal */}
              {showAddRule && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowAddRule(false)}>
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                  <div
                    className="relative w-full max-w-md glass rounded-2xl glow-border overflow-hidden"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          <Plus size={18} className="text-nest-400" />
                          Add Firewall Rule
                        </h3>
                        <button
                          onClick={() => setShowAddRule(false)}
                          className="p-2 rounded-lg text-nest-400 hover:text-white hover:bg-nest-800/50 transition-all"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <form onSubmit={e => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const fd = new FormData(form);
                        handleAddFirewallRule(
                          fd.get('action') as string,
                          fd.get('protocol') as string,
                          fd.get('port') as string,
                          (fd.get('source') as string) || undefined,
                        );
                      }} className="space-y-4">
                        {/* Action */}
                        <div>
                          <label className="text-xs text-nest-400 font-semibold uppercase tracking-wider block mb-1.5">
                            Action
                          </label>
                          <select
                            name="action"
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white focus:outline-none focus:border-nest-400/40 transition-colors"
                          >
                            <option value="ACCEPT">ACCEPT — Allow traffic</option>
                            <option value="DROP">DROP — Silently block</option>
                            <option value="REJECT">REJECT — Block with response</option>
                          </select>
                        </div>

                        {/* Protocol */}
                        <div>
                          <label className="text-xs text-nest-400 font-semibold uppercase tracking-wider block mb-1.5">
                            Protocol
                          </label>
                          <select
                            name="protocol"
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white focus:outline-none focus:border-nest-400/40 transition-colors"
                          >
                            <option value="tcp">TCP</option>
                            <option value="udp">UDP</option>
                          </select>
                        </div>

                        {/* Port */}
                        <div>
                          <label className="text-xs text-nest-400 font-semibold uppercase tracking-wider block mb-1.5">
                            Port
                          </label>
                          <input
                            name="port"
                            type="text"
                            required
                            placeholder="e.g., 80, 443, 8000:8100"
                            pattern="^\d+(?::\d+)?$"
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white placeholder-nest-500 focus:outline-none focus:border-nest-400/40 transition-colors"
                          />
                          <p className="text-[10px] text-nest-500 mt-1">Single port or range (e.g., 8000:8100)</p>
                        </div>

                        {/* Source (optional) */}
                        <div>
                          <label className="text-xs text-nest-400 font-semibold uppercase tracking-wider block mb-1.5">
                            Source IP (optional)
                          </label>
                          <input
                            name="source"
                            type="text"
                            placeholder="e.g., 192.168.1.0/24 or leave empty for any"
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white placeholder-nest-500 focus:outline-none focus:border-nest-400/40 transition-colors"
                          />
                        </div>

                        {/* Quick presets */}
                        <div>
                          <p className="text-xs text-nest-400 font-semibold uppercase tracking-wider mb-2">Quick Presets</p>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { label: 'SSH (22)', port: '22' },
                              { label: 'HTTP (80)', port: '80' },
                              { label: 'HTTPS (443)', port: '443' },
                              { label: 'PVE (8006)', port: '8006' },
                              { label: 'DNS (53)', port: '53' },
                            ].map(preset => (
                              <button
                                key={preset.port}
                                type="button"
                                onClick={() => {
                                  const portInput = document.querySelector('input[name="port"]') as HTMLInputElement;
                                  if (portInput) portInput.value = preset.port;
                                }}
                                className="text-[10px] px-2 py-1 rounded-lg bg-nest-800/60 text-nest-400 hover:text-white hover:bg-nest-700/60 transition-all"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Submit */}
                        <button
                          type="submit"
                          disabled={addingRule}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-nest-500/30 to-nest-400/30 hover:from-nest-500/50 hover:to-nest-400/50 text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-nest-400/20"
                        >
                          {addingRule ? (
                            <><Loader2 size={14} className="animate-spin" /> Adding Rule…</>
                          ) : (
                            <><Shield size={14} /> Add Rule</>
                          )}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading */}
              {firewallLoading && !firewallData ? (
                <div className="glass rounded-xl p-8 text-center glow-border">
                  <Loader2 size={36} className="text-nest-600 mx-auto mb-3 animate-spin" />
                  <p className="text-sm text-nest-400">Loading firewall rules…</p>
                </div>
              ) : !firewallData ? (
                <div className="glass rounded-xl p-8 text-center glow-border">
                  <Shield size={36} className="text-nest-600 mx-auto mb-3" />
                  <p className="text-sm text-nest-400">Could not load firewall data</p>
                  <button onClick={fetchFirewall} className="text-xs text-nest-300 hover:text-white mt-2 underline">
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="glass rounded-xl p-4 glow-border">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                          <Shield size={16} className="text-indigo-400" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-white">{firewallData.iptablesRules.length}</p>
                          <p className="text-[10px] text-nest-500 uppercase tracking-wider">iptables Rules</p>
                        </div>
                      </div>
                    </div>
                    <div className="glass rounded-xl p-4 glow-border">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <Globe size={16} className="text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-white">{firewallData.listeningPorts.length}</p>
                          <p className="text-[10px] text-nest-500 uppercase tracking-wider">Listening Ports</p>
                        </div>
                      </div>
                    </div>
                    <div className="glass rounded-xl p-4 glow-border">
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          'p-2 rounded-lg border',
                          firewallData.pveFirewall.enabled
                            ? 'bg-emerald-500/10 border-emerald-500/20'
                            : 'bg-nest-800/60 border-nest-700',
                        )}>
                          <Shield size={16} className={firewallData.pveFirewall.enabled ? 'text-emerald-400' : 'text-nest-500'} />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-white">
                            {firewallData.pveFirewall.enabled ? 'Active' : 'Inactive'}
                          </p>
                          <p className="text-[10px] text-nest-500 uppercase tracking-wider">PVE Firewall</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* iptables Rules */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Shield size={14} className="text-indigo-400" />
                      iptables INPUT Rules
                    </h3>

                    {firewallData.iptablesRules.length === 0 ? (
                      <div className="glass rounded-xl p-6 text-center glow-border">
                        <p className="text-sm text-nest-400">No iptables INPUT rules found</p>
                        <p className="text-xs text-nest-500 mt-1">The server may be using Proxmox firewall or has a default-allow policy</p>
                      </div>
                    ) : (
                      <div className="glass rounded-xl glow-border overflow-hidden">
                        {/* Table header */}
                        <div className="grid grid-cols-[3rem_5rem_4rem_8rem_8rem_5rem_1fr_3rem] gap-2 px-4 py-2.5 border-b border-nest-800/60 text-[10px] text-nest-500 font-semibold uppercase tracking-wider">
                          <span>#</span>
                          <span>Action</span>
                          <span>Proto</span>
                          <span>Source</span>
                          <span>Destination</span>
                          <span>Port</span>
                          <span>Extra</span>
                          <span></span>
                        </div>
                        {/* Rules */}
                        {firewallData.iptablesRules.map(rule => (
                          <div
                            key={rule.num}
                            className="grid grid-cols-[3rem_5rem_4rem_8rem_8rem_5rem_1fr_3rem] gap-2 px-4 py-2.5 border-b border-nest-800/20 hover:bg-nest-800/20 transition-colors items-center group"
                          >
                            <span className="text-xs text-nest-500 font-mono">{rule.num}</span>
                            <span className={clsx(
                              'text-[10px] px-1.5 py-0.5 rounded font-medium w-fit',
                              rule.target === 'ACCEPT' ? 'bg-emerald-500/10 text-emerald-400' :
                              rule.target === 'DROP' ? 'bg-rose-500/10 text-rose-400' :
                              rule.target === 'REJECT' ? 'bg-amber-500/10 text-amber-400' :
                              'bg-nest-800/60 text-nest-400',
                            )}>
                              {rule.target}
                            </span>
                            <span className="text-xs text-nest-300 font-mono">{rule.protocol}</span>
                            <span className="text-xs text-nest-400 font-mono truncate">{rule.source}</span>
                            <span className="text-xs text-nest-400 font-mono truncate">{rule.destination}</span>
                            <span className="text-xs text-white font-mono">{rule.port || '—'}</span>
                            <span className="text-[10px] text-nest-500 truncate">{rule.extra}</span>
                            <button
                              onClick={() => handleDeleteFirewallRule(rule.num)}
                              disabled={deletingRule === rule.num}
                              className="p-1.5 rounded-lg text-nest-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                              title="Delete rule"
                            >
                              {deletingRule === rule.num ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Trash2 size={12} />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* PVE Firewall Rules */}
                  {firewallData.pveFirewall.rules.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Shield size={14} className="text-teal-400" />
                        Proxmox Firewall Rules
                        {firewallData.pveFirewall.enabled && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                            ENABLED
                          </span>
                        )}
                      </h3>
                      <div className="space-y-2">
                        {firewallData.pveFirewall.rules.map(rule => (
                          <div key={rule.pos} className="glass rounded-lg p-3 flex items-center gap-3">
                            <span className="text-xs text-nest-500 font-mono w-8">#{rule.pos}</span>
                            <span className={clsx(
                              'text-[10px] px-1.5 py-0.5 rounded font-medium',
                              rule.type === 'IN' ? 'bg-sky-500/10 text-sky-400' : 'bg-violet-500/10 text-violet-400',
                            )}>
                              {rule.type}
                            </span>
                            <span className={clsx(
                              'text-[10px] px-1.5 py-0.5 rounded font-medium',
                              rule.action === 'ACCEPT' ? 'bg-emerald-500/10 text-emerald-400' :
                              rule.action === 'DROP' ? 'bg-rose-500/10 text-rose-400' :
                              'bg-amber-500/10 text-amber-400',
                            )}>
                              {rule.action}
                            </span>
                            {rule.proto && (
                              <span className="text-xs text-nest-300 font-mono">{rule.proto}</span>
                            )}
                            {rule.dport && (
                              <span className="text-xs text-white font-mono">:{rule.dport}</span>
                            )}
                            {rule.source && (
                              <span className="text-xs text-nest-400 font-mono">from {rule.source}</span>
                            )}
                            {rule.iface && (
                              <span className="text-[10px] text-nest-500">iface: {rule.iface}</span>
                            )}
                            {!rule.enable && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-nest-800 text-nest-500 font-medium">
                                DISABLED
                              </span>
                            )}
                            {rule.comment && (
                              <span className="text-[10px] text-nest-500 ml-auto truncate max-w-[200px]">
                                {rule.comment}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Listening Ports */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Globe size={14} className="text-emerald-400" />
                      Listening Ports
                      <span className="text-xs text-nest-500 font-normal">
                        ({firewallData.listeningPorts.length} ports)
                      </span>
                    </h3>
                    <div className="glass rounded-xl glow-border overflow-hidden">
                      <div className="grid grid-cols-[5rem_4rem_1fr] gap-2 px-4 py-2.5 border-b border-nest-800/60 text-[10px] text-nest-500 font-semibold uppercase tracking-wider">
                        <span>Port</span>
                        <span>Proto</span>
                        <span>Process</span>
                      </div>
                      {firewallData.listeningPorts.map(lp => {
                        // Check if port has an ACCEPT rule
                        const hasAllowRule = firewallData.iptablesRules.some(
                          r => r.target === 'ACCEPT' && (r.port === String(lp.port) || !r.port),
                        );
                        // Check known important ports
                        const knownPorts: Record<number, string> = {
                          22: 'SSH', 53: 'DNS', 80: 'HTTP', 443: 'HTTPS',
                          3128: 'Proxy', 5432: 'PostgreSQL', 3306: 'MySQL',
                          6379: 'Redis', 8006: 'PVE Web', 8080: 'HTTP-Alt',
                          9090: 'Prometheus', 3000: 'Grafana',
                        };
                        const label = knownPorts[lp.port];
                        return (
                          <div
                            key={lp.port}
                            className="grid grid-cols-[5rem_4rem_1fr] gap-2 px-4 py-2 border-b border-nest-800/20 hover:bg-nest-800/20 transition-colors items-center"
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="text-xs text-white font-mono font-semibold">{lp.port}</span>
                              {label && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-nest-800/60 text-nest-500">
                                  {label}
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-nest-400">{lp.protocol}</span>
                            <span className="flex items-center gap-2">
                              <span className="text-xs text-nest-300 font-mono">{lp.process || '—'}</span>
                              {hasAllowRule && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                                  allowed
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Safety info */}
                  <div className="glass rounded-xl p-4 glow-border">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-white">Firewall Safety</p>
                        <p className="text-xs text-nest-400 mt-1">
                          Be careful when modifying firewall rules. Blocking port 22 (SSH) or 8006 (PVE Web) may lock you out of your server.
                          Rules are persisted to <span className="font-mono text-nest-300">/etc/iptables/rules.v4</span>.
                          Proxmox firewall rules are managed via the PVE web interface.
                        </p>
                      </div>
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

                {/* ─── System Updates ─────────────────── */}
                <div className="glass rounded-xl p-5 glow-border">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <UploadCloud size={14} className="text-nest-400" />
                      System Updates
                    </h3>
                    <div className="flex items-center gap-2">
                      {updateLastCheck && (
                        <span className="text-[10px] text-nest-500">
                          Last check: {new Date(updateLastCheck).toLocaleString()}
                        </span>
                      )}
                      <button
                        onClick={fetchUpdates}
                        disabled={updateChecking || updateApplying}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium glass text-nest-300 hover:text-white transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={clsx(updateChecking && 'animate-spin')} />
                        {updateChecking ? 'Checking…' : 'Check for Updates'}
                      </button>
                    </div>
                  </div>

                  {/* Update result message */}
                  {updateResult && (
                    <div className={clsx(
                      'rounded-lg px-4 py-3 text-sm mb-4 flex items-center justify-between',
                      updateResult.type === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/10 border border-rose-500/20 text-rose-400',
                    )}>
                      <span className="flex items-center gap-2">
                        {updateResult.type === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        {updateResult.text}
                      </span>
                      <button onClick={() => setUpdateResult(null)} className="ml-2 hover:text-white">
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* Reboot required warning */}
                  {updateRebootRequired && (
                    <div className="rounded-lg px-4 py-3 text-sm mb-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <AlertTriangle size={14} />
                        Reboot required to complete updates
                      </span>
                      <button
                        onClick={() => { if (confirm('Reboot the server now?')) api.sendCommand(serverId, 'system.reboot').catch(() => {}); }}
                        className="text-xs px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-medium transition-all"
                      >
                        <Power size={10} className="inline mr-1" /> Reboot Now
                      </button>
                    </div>
                  )}

                  {/* Status summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div className="glass rounded-lg p-3 text-center">
                      <p className={clsx(
                        'text-2xl font-bold',
                        updatePackages.length === 0 ? 'text-emerald-400' : 'text-amber-400',
                      )}>
                        {updateChecking ? '…' : updatePackages.length}
                      </p>
                      <p className="text-[10px] text-nest-500 uppercase tracking-wider mt-1">Available Updates</p>
                    </div>
                    <div className="glass rounded-lg p-3 text-center">
                      <p className={clsx(
                        'text-2xl font-bold',
                        updateSecurityCount > 0 ? 'text-rose-400' : 'text-emerald-400',
                      )}>
                        {updateChecking ? '…' : updateSecurityCount}
                      </p>
                      <p className="text-[10px] text-nest-500 uppercase tracking-wider mt-1">Security Updates</p>
                    </div>
                    <div className="glass rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-white">
                        {updateChecking ? '…' : (updatePackages.length === 0 ? '✓' : '⬆')}
                      </p>
                      <p className="text-[10px] text-nest-500 uppercase tracking-wider mt-1">
                        {updatePackages.length === 0 ? 'Up to Date' : 'Updates Available'}
                      </p>
                    </div>
                  </div>

                  {/* Upgradable packages list */}
                  {updatePackages.length > 0 && (
                    <div className="space-y-3">
                      {/* Action buttons */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <p className="text-xs text-nest-400">
                          {updatePackages.length} package{updatePackages.length !== 1 ? 's' : ''} can be upgraded
                          {updateSecurityCount > 0 && (
                            <span className="text-rose-400 ml-1">
                              ({updateSecurityCount} security)
                            </span>
                          )}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { if (confirm(`Apply ${updatePackages.length} update(s)? This runs apt-get upgrade.`)) applyUpdates('upgrade'); }}
                            disabled={updateApplying}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 hover:text-white transition-all border border-blue-500/20 disabled:opacity-50"
                          >
                            {updateApplying ? (
                              <><Loader2 size={12} className="animate-spin" /> Upgrading…</>
                            ) : (
                              <><UploadCloud size={12} /> Upgrade All</>
                            )}
                          </button>
                          <button
                            onClick={() => { if (confirm('Run dist-upgrade? This may install/remove packages.')) applyUpdates('dist-upgrade'); }}
                            disabled={updateApplying}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all border border-amber-500/10 disabled:opacity-50"
                            title="Distribution upgrade — may install new or remove obsolete packages"
                          >
                            <Wrench size={12} /> Dist-Upgrade
                          </button>
                        </div>
                      </div>

                      {/* Package table */}
                      <div className="rounded-lg overflow-hidden border border-nest-800/60">
                        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-3 py-2 bg-nest-900/50 text-[10px] text-nest-500 uppercase tracking-wider font-semibold">
                          <span>Package</span>
                          <span>Current</span>
                          <span>Available</span>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto scrollbar-thin">
                          {updatePackages.map((pkg, i) => (
                            <div
                              key={pkg.name}
                              className={clsx(
                                'grid grid-cols-[1fr_auto_auto] gap-x-4 px-3 py-2 text-xs items-center',
                                i % 2 === 0 ? 'bg-nest-900/20' : 'bg-nest-900/40',
                                'hover:bg-nest-800/40 transition-colors',
                              )}
                            >
                              <div className="min-w-0">
                                <span className="text-white font-medium truncate block">{pkg.name}</span>
                                {pkg.repo && (
                                  <span className="text-[10px] text-nest-500">
                                    {pkg.repo.includes('security') && (
                                      <span className="text-rose-400 mr-1">🔒</span>
                                    )}
                                    {pkg.repo}
                                  </span>
                                )}
                              </div>
                              <span className="text-nest-500 font-mono text-[11px] whitespace-nowrap">
                                {pkg.currentVersion ? pkg.currentVersion.substring(0, 20) : '—'}
                              </span>
                              <span className="text-emerald-400 font-mono text-[11px] whitespace-nowrap">
                                {pkg.newVersion ? pkg.newVersion.substring(0, 20) : '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* No updates state */}
                  {!updateChecking && updatePackages.length === 0 && !updateResult && (
                    <div className="text-center py-4">
                      <CheckCircle2 size={28} className="text-emerald-400 mx-auto mb-2" />
                      <p className="text-sm text-nest-300">System is up to date</p>
                      <p className="text-xs text-nest-500 mt-1">All packages are at their latest version</p>
                    </div>
                  )}

                  {/* Checking state */}
                  {updateChecking && (
                    <div className="text-center py-6">
                      <Loader2 size={28} className="text-blue-400 mx-auto mb-2 animate-spin" />
                      <p className="text-sm text-nest-300">Checking for updates…</p>
                      <p className="text-xs text-nest-500 mt-1">Running apt-get update, this may take a moment</p>
                    </div>
                  )}

                  {/* Upgrade progress / log */}
                  {(updateApplying || updateLog.length > 0) && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs text-nest-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                          <Terminal size={12} />
                          {updateApplying ? 'Upgrade in progress…' : 'Upgrade Log'}
                        </h4>
                        {updateApplying && (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 rounded-full bg-nest-800/80 overflow-hidden">
                              <div className="h-full w-full rounded-full bg-gradient-to-r from-blue-500/60 to-blue-300/60 animate-pulse" />
                            </div>
                            <Loader2 size={12} className="text-blue-400 animate-spin" />
                          </div>
                        )}
                        {!updateApplying && updateLog.length > 0 && (
                          <button
                            onClick={() => setUpdateLog([])}
                            className="text-[10px] text-nest-500 hover:text-white transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="rounded-lg bg-nest-950/80 border border-nest-800/60 p-3 max-h-[250px] overflow-y-auto scrollbar-thin font-mono text-[11px] text-nest-400 leading-relaxed">
                        {updateLog.length > 0 ? (
                          updateLog.map((line, i) => (
                            <div key={i} className={clsx(
                              line.includes('Unpacking') || line.includes('Setting up') ? 'text-emerald-400/70' :
                              line.includes('Err:') || line.includes('E:') ? 'text-rose-400' :
                              line.includes('Get:') || line.includes('Fetched') ? 'text-blue-400/70' :
                              'text-nest-400',
                            )}>
                              {line}
                            </div>
                          ))
                        ) : (
                          <div className="text-nest-500 flex items-center gap-2">
                            <Loader2 size={10} className="animate-spin" />
                            Waiting for output…
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Backup Status */}
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
                    <button
                      onClick={() => setActiveTab('backups')}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium glass text-nest-300 hover:text-white transition-all"
                    >
                      <Archive size={12} /> Manage Backups
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ═══ Settings Tab ════════════════════ */}
          {activeTab === 'settings' && (() => {
            const handleSaveHostname = async () => {
              if (!editHostname.trim() || editHostname === settings?.hostname) return;
              setSettingsSaving('hostname');
              setSettingsMessage(null);
              try {
                const result = await api.sendCommand(serverId, 'settings.hostname', { hostname: editHostname.trim() });
                if (result.success) {
                  setSettingsMessage({ type: 'success', text: `Hostname changed to ${editHostname.trim()}` });
                  fetchSettings();
                  fetchServer();
                } else {
                  setSettingsMessage({ type: 'error', text: result.error || 'Failed to change hostname' });
                }
              } catch (err) {
                setSettingsMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed' });
              } finally {
                setSettingsSaving(null);
                setTimeout(() => setSettingsMessage(null), 5000);
              }
            };

            const handleSaveTimezone = async () => {
              if (!editTimezone || editTimezone === settings?.timezone) return;
              setSettingsSaving('timezone');
              setSettingsMessage(null);
              try {
                const result = await api.sendCommand(serverId, 'settings.timezone', { timezone: editTimezone });
                if (result.success) {
                  setSettingsMessage({ type: 'success', text: `Timezone changed to ${editTimezone}` });
                  fetchSettings();
                } else {
                  setSettingsMessage({ type: 'error', text: result.error || 'Failed to change timezone' });
                }
              } catch (err) {
                setSettingsMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed' });
              } finally {
                setSettingsSaving(null);
                setTimeout(() => setSettingsMessage(null), 5000);
              }
            };

            const handleSaveDns = async () => {
              const servers = editDns.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
              if (servers.length === 0) return;
              setSettingsSaving('dns');
              setSettingsMessage(null);
              try {
                const searchDomains = editDnsSearch.split(/\s+/).filter(Boolean);
                const result = await api.sendCommand(serverId, 'settings.dns', {
                  servers,
                  search: searchDomains.length > 0 ? searchDomains : undefined,
                });
                if (result.success) {
                  setSettingsMessage({ type: 'success', text: `DNS updated: ${servers.join(', ')}` });
                  fetchSettings();
                } else {
                  setSettingsMessage({ type: 'error', text: result.error || 'Failed to update DNS' });
                }
              } catch (err) {
                setSettingsMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed' });
              } finally {
                setSettingsSaving(null);
                setTimeout(() => setSettingsMessage(null), 5000);
              }
            };

            const filteredTimezones = settings?.timezones.filter(tz =>
              !tzSearch || tz.toLowerCase().includes(tzSearch.toLowerCase())
            ) || [];

            return (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Wrench size={16} className="text-nest-400" />
                    Server Settings
                  </h2>
                  <button
                    onClick={fetchSettings}
                    disabled={settingsLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium glass text-nest-300 hover:text-white transition-colors"
                  >
                    <RefreshCw size={12} className={clsx(settingsLoading && 'animate-spin')} /> Refresh
                  </button>
                </div>

                {/* Settings message */}
                {settingsMessage && (
                  <div className={clsx(
                    'rounded-lg px-4 py-3 text-sm flex items-center justify-between',
                    settingsMessage.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/10 border border-rose-500/20 text-rose-400',
                  )}>
                    <span className="flex items-center gap-2">
                      {settingsMessage.type === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      {settingsMessage.text}
                    </span>
                    <button onClick={() => setSettingsMessage(null)} className="ml-2 hover:text-white">
                      <X size={14} />
                    </button>
                  </div>
                )}

                {settingsLoading && !settings ? (
                  <div className="glass rounded-xl p-8 text-center glow-border">
                    <Loader2 size={36} className="text-nest-600 mx-auto mb-3 animate-spin" />
                    <p className="text-sm text-nest-400">Loading server settings…</p>
                  </div>
                ) : settings ? (
                  <>
                    {/* ─── Hostname ──────────────────────── */}
                    <div className="glass rounded-xl p-5 glow-border">
                      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <Server size={14} className="text-nest-400" />
                        Hostname
                      </h3>
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] text-nest-500 uppercase tracking-wider block mb-1.5">Current Hostname</label>
                            <p className="text-sm text-white font-mono bg-nest-900/40 rounded-lg px-3 py-2">{settings.hostname}</p>
                          </div>
                          {settings.fqdn && settings.fqdn !== settings.hostname && (
                            <div>
                              <label className="text-[10px] text-nest-500 uppercase tracking-wider block mb-1.5">FQDN</label>
                              <p className="text-sm text-nest-300 font-mono bg-nest-900/40 rounded-lg px-3 py-2">{settings.fqdn}</p>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] text-nest-500 uppercase tracking-wider block mb-1.5">New Hostname</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editHostname}
                              onChange={e => setEditHostname(e.target.value)}
                              placeholder="my-server"
                              maxLength={63}
                              className="flex-1 px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white placeholder-nest-500 font-mono focus:outline-none focus:border-nest-400/40 transition-colors"
                            />
                            <button
                              onClick={handleSaveHostname}
                              disabled={settingsSaving === 'hostname' || editHostname === settings.hostname || !editHostname.trim()}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-nest-500/20 text-nest-200 hover:bg-nest-400/30 hover:text-white transition-all border border-nest-400/20 disabled:opacity-40"
                            >
                              {settingsSaving === 'hostname' ? (
                                <><Loader2 size={12} className="animate-spin" /> Saving…</>
                              ) : (
                                <><CheckCircle2 size={12} /> Apply</>
                              )}
                            </button>
                          </div>
                          <p className="text-[10px] text-nest-500 mt-1.5">
                            Alphanumeric and hyphens only. Changes take effect immediately.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* ─── Timezone ──────────────────────── */}
                    <div className="glass rounded-xl p-5 glow-border">
                      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <Clock size={14} className="text-nest-400" />
                        Date & Time
                      </h3>
                      <div className="space-y-4">
                        {/* Current info */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="text-[10px] text-nest-500 uppercase tracking-wider block mb-1.5">Current Time</label>
                            <p className="text-sm text-white font-mono bg-nest-900/40 rounded-lg px-3 py-2">{settings.localTime || 'N/A'}</p>
                          </div>
                          <div>
                            <label className="text-[10px] text-nest-500 uppercase tracking-wider block mb-1.5">Timezone</label>
                            <p className="text-sm text-white font-mono bg-nest-900/40 rounded-lg px-3 py-2">{settings.timezone}</p>
                          </div>
                          <div>
                            <label className="text-[10px] text-nest-500 uppercase tracking-wider block mb-1.5">NTP Sync</label>
                            <div className="flex items-center gap-2 bg-nest-900/40 rounded-lg px-3 py-2">
                              <div className={clsx(
                                'h-2 w-2 rounded-full',
                                settings.ntpSynced ? 'bg-emerald-400' : settings.ntpEnabled ? 'bg-amber-400' : 'bg-nest-600',
                              )} />
                              <span className="text-sm text-white">
                                {settings.ntpSynced ? 'Synchronized' : settings.ntpEnabled ? 'Enabled (not synced)' : 'Disabled'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Timezone selector */}
                        <div>
                          <label className="text-[10px] text-nest-500 uppercase tracking-wider block mb-1.5">Change Timezone</label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nest-500" />
                              <input
                                type="text"
                                value={tzSearch}
                                onChange={e => setTzSearch(e.target.value)}
                                placeholder="Search timezone (e.g., New_York, UTC)…"
                                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white placeholder-nest-500 focus:outline-none focus:border-nest-400/40 transition-colors"
                              />
                            </div>
                          </div>
                          {tzSearch && filteredTimezones.length > 0 && (
                            <div className="mt-2 max-h-[200px] overflow-y-auto rounded-lg border border-nest-800/60 bg-nest-950/80 scrollbar-thin">
                              {filteredTimezones.slice(0, 50).map(tz => (
                                <button
                                  key={tz}
                                  onClick={() => { setEditTimezone(tz); setTzSearch(tz); }}
                                  className={clsx(
                                    'w-full text-left px-3 py-2 text-xs font-mono hover:bg-nest-800/50 transition-colors',
                                    tz === editTimezone ? 'text-emerald-400 bg-emerald-500/5' : 'text-nest-300',
                                    tz === settings.timezone && 'text-nest-500',
                                  )}
                                >
                                  {tz}
                                  {tz === settings.timezone && <span className="text-nest-600 ml-2">(current)</span>}
                                </button>
                              ))}
                              {filteredTimezones.length > 50 && (
                                <p className="text-[10px] text-nest-500 px-3 py-2">+{filteredTimezones.length - 50} more — refine your search</p>
                              )}
                            </div>
                          )}
                          {tzSearch && filteredTimezones.length === 0 && (
                            <p className="text-xs text-nest-500 mt-2">No timezones match "{tzSearch}"</p>
                          )}
                          {editTimezone && editTimezone !== settings.timezone && (
                            <div className="mt-3 flex items-center gap-2">
                              <span className="text-xs text-nest-400">
                                Change from <span className="text-white font-mono">{settings.timezone}</span> → <span className="text-emerald-400 font-mono">{editTimezone}</span>
                              </span>
                              <button
                                onClick={handleSaveTimezone}
                                disabled={settingsSaving === 'timezone'}
                                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-nest-500/20 text-nest-200 hover:bg-nest-400/30 hover:text-white transition-all border border-nest-400/20 disabled:opacity-40"
                              >
                                {settingsSaving === 'timezone' ? (
                                  <><Loader2 size={12} className="animate-spin" /> Saving…</>
                                ) : (
                                  <><CheckCircle2 size={12} /> Apply</>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ─── DNS Configuration ─────────────── */}
                    <div className="glass rounded-xl p-5 glow-border">
                      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <Globe size={14} className="text-nest-400" />
                        DNS Configuration
                      </h3>
                      <div className="space-y-4">
                        {/* Current DNS display */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] text-nest-500 uppercase tracking-wider block mb-1.5">Current DNS Servers</label>
                            <div className="flex items-center gap-2 flex-wrap">
                              {settings.dnsServers.map(dns => (
                                <span key={dns} className="text-xs px-2 py-1 rounded-lg bg-nest-900/50 text-white font-mono border border-nest-800/60">
                                  {dns}
                                </span>
                              ))}
                              {settings.dnsServers.length === 0 && (
                                <span className="text-xs text-nest-500">No DNS configured</span>
                              )}
                            </div>
                          </div>
                          {settings.dnsSearch.length > 0 && (
                            <div>
                              <label className="text-[10px] text-nest-500 uppercase tracking-wider block mb-1.5">Search Domains</label>
                              <div className="flex items-center gap-2 flex-wrap">
                                {settings.dnsSearch.map(d => (
                                  <span key={d} className="text-xs px-2 py-1 rounded-lg bg-nest-900/50 text-nest-300 font-mono border border-nest-800/60">
                                    {d}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Edit DNS */}
                        <div>
                          <label className="text-[10px] text-nest-500 uppercase tracking-wider block mb-1.5">DNS Servers</label>
                          <input
                            type="text"
                            value={editDns}
                            onChange={e => setEditDns(e.target.value)}
                            placeholder="1.1.1.1, 8.8.8.8"
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white placeholder-nest-500 font-mono focus:outline-none focus:border-nest-400/40 transition-colors"
                          />
                          <p className="text-[10px] text-nest-500 mt-1">Comma-separated IP addresses</p>
                        </div>
                        <div>
                          <label className="text-[10px] text-nest-500 uppercase tracking-wider block mb-1.5">Search Domains (optional)</label>
                          <input
                            type="text"
                            value={editDnsSearch}
                            onChange={e => setEditDnsSearch(e.target.value)}
                            placeholder="local.domain"
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white placeholder-nest-500 font-mono focus:outline-none focus:border-nest-400/40 transition-colors"
                          />
                          <p className="text-[10px] text-nest-500 mt-1">Space-separated search domains for DNS resolution</p>
                        </div>

                        {/* Quick DNS presets */}
                        <div>
                          <label className="text-[10px] text-nest-500 uppercase tracking-wider block mb-1.5">Presets</label>
                          <div className="flex items-center gap-2 flex-wrap">
                            {[
                              { label: 'Cloudflare', dns: '1.1.1.1, 1.0.0.1' },
                              { label: 'Google', dns: '8.8.8.8, 8.8.4.4' },
                              { label: 'Quad9', dns: '9.9.9.9, 149.112.112.112' },
                              { label: 'OpenDNS', dns: '208.67.222.222, 208.67.220.220' },
                            ].map(preset => (
                              <button
                                key={preset.label}
                                onClick={() => setEditDns(preset.dns)}
                                className={clsx(
                                  'text-[11px] px-2.5 py-1 rounded-lg transition-all font-medium',
                                  editDns === preset.dns
                                    ? 'bg-nest-500/20 text-white border border-nest-400/20'
                                    : 'text-nest-400 hover:text-white bg-nest-800/40 hover:bg-nest-800/60',
                                )}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={handleSaveDns}
                          disabled={settingsSaving === 'dns' || !editDns.trim()}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-nest-500/20 text-nest-200 hover:bg-nest-400/30 hover:text-white transition-all border border-nest-400/20 disabled:opacity-40"
                        >
                          {settingsSaving === 'dns' ? (
                            <><Loader2 size={12} className="animate-spin" /> Saving…</>
                          ) : (
                            <><CheckCircle2 size={12} /> Save DNS Configuration</>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* ─── Network Config (read-only) ──── */}
                    {settings.networkConfig && (
                      <div className="glass rounded-xl p-5 glow-border">
                        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                          <Network size={14} className="text-nest-400" />
                          Network Interfaces Config
                          <span className="text-[10px] text-nest-500 font-normal">/etc/network/interfaces</span>
                        </h3>
                        <div className="rounded-lg bg-nest-950/80 border border-nest-800/60 p-3 max-h-[300px] overflow-y-auto scrollbar-thin font-mono text-[11px] text-nest-400 leading-relaxed whitespace-pre">
                          {settings.networkConfig}
                        </div>
                        <p className="text-[10px] text-nest-500 mt-2 flex items-center gap-1">
                          <Info size={10} />
                          Network interface configuration is shown read-only. Edit via Proxmox or SSH for safety.
                        </p>
                      </div>
                    )}

                    {/* ─── /etc/hosts ───────────────────── */}
                    {settings.hostsFile && (
                      <div className="glass rounded-xl p-5 glow-border">
                        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                          <ScrollText size={14} className="text-nest-400" />
                          Hosts File
                          <span className="text-[10px] text-nest-500 font-normal">/etc/hosts</span>
                        </h3>
                        <div className="rounded-lg bg-nest-950/80 border border-nest-800/60 p-3 max-h-[200px] overflow-y-auto scrollbar-thin font-mono text-[11px] text-nest-400 leading-relaxed whitespace-pre">
                          {settings.hostsFile}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="glass rounded-xl p-8 text-center glow-border">
                    <Wrench size={36} className="text-nest-600 mx-auto mb-3" />
                    <p className="text-sm text-nest-400">Could not load server settings</p>
                    <button onClick={fetchSettings} className="text-xs text-nest-300 hover:text-white mt-2 underline">
                      Retry
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ Graphs Tab ══════════════════════ */}
          {activeTab === 'graphs' && (
            <ResourceGraphs serverId={serverId} />
          )}

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

          {/* ═══ Notifications Tab ═══════════════ */}
          {activeTab === 'notifications' && (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Bell size={16} className="text-nest-400" />
                  Alerts & Notifications
                  <span className="text-xs text-nest-500 font-normal ml-1">
                    {notifRules.length} rule{notifRules.length !== 1 ? 's' : ''}
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchNotifications}
                    disabled={notifLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium glass text-nest-300 hover:text-white transition-colors"
                  >
                    <RefreshCw size={12} className={clsx(notifLoading && 'animate-spin')} /> Refresh
                  </button>
                  <button
                    onClick={() => setShowAddNotifRule(true)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-nest-500/20 text-nest-200 hover:bg-nest-400/30 hover:text-white transition-all border border-nest-400/20"
                  >
                    <Plus size={12} /> Add Alert Rule
                  </button>
                </div>
              </div>

              {/* Notification message */}
              {notifMessage && (
                <div className={clsx(
                  'rounded-lg px-4 py-3 text-sm flex items-center justify-between',
                  notifMessage.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-400',
                )}>
                  <span className="flex items-center gap-2">
                    {notifMessage.type === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {notifMessage.text}
                  </span>
                  <button onClick={() => setNotifMessage(null)} className="ml-2 hover:text-white">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Create Rule Modal */}
              {showAddNotifRule && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowAddNotifRule(false)}>
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                  <div
                    className="relative w-full max-w-md glass rounded-2xl glow-border overflow-hidden"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          <BellRing size={18} className="text-amber-400" />
                          New Alert Rule
                        </h3>
                        <button
                          onClick={() => setShowAddNotifRule(false)}
                          className="p-2 rounded-lg text-nest-400 hover:text-white hover:bg-nest-800/50 transition-all"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        setAddingNotifRule(true);
                        const form = e.target as HTMLFormElement;
                        const fd = new FormData(form);
                        try {
                          await api.createNotificationRule(serverId, {
                            name: fd.get('name') as string,
                            condition: fd.get('condition') as any,
                            threshold: parseInt(fd.get('threshold') as string, 10) || undefined,
                            duration_seconds: parseInt(fd.get('duration') as string, 10) || undefined,
                            channel: fd.get('channel') as any,
                            target: fd.get('target') as string,
                            cooldown_minutes: parseInt(fd.get('cooldown') as string, 10) || 30,
                          });
                          setNotifMessage({ type: 'success', text: 'Alert rule created' });
                          setShowAddNotifRule(false);
                          fetchNotifications();
                        } catch (err) {
                          setNotifMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create rule' });
                        } finally {
                          setAddingNotifRule(false);
                          setTimeout(() => setNotifMessage(null), 5000);
                        }
                      }} className="space-y-4">
                        {/* Name */}
                        <div>
                          <label className="text-xs text-nest-400 font-semibold uppercase tracking-wider block mb-1.5">Rule Name</label>
                          <input name="name" required placeholder="e.g. High CPU Alert" maxLength={100}
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white placeholder-nest-500 focus:outline-none focus:border-nest-400/40 transition-colors" />
                        </div>

                        {/* Condition */}
                        <div>
                          <label className="text-xs text-nest-400 font-semibold uppercase tracking-wider block mb-1.5">Condition</label>
                          <select name="condition" required
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white focus:outline-none focus:border-nest-400/40 transition-colors">
                            <option value="server_offline">🔴 Server goes offline</option>
                            <option value="cpu_high">🔥 CPU usage too high</option>
                            <option value="ram_high">💾 RAM usage too high</option>
                            <option value="disk_high">💿 Disk usage too high</option>
                          </select>
                        </div>

                        {/* Threshold */}
                        <div>
                          <label className="text-xs text-nest-400 font-semibold uppercase tracking-wider block mb-1.5">Threshold (%)</label>
                          <input name="threshold" type="number" min={1} max={100} defaultValue={90} placeholder="90"
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white placeholder-nest-500 focus:outline-none focus:border-nest-400/40 transition-colors" />
                          <p className="text-[10px] text-nest-600 mt-1">Ignored for "server offline" condition</p>
                        </div>

                        {/* Duration */}
                        <div>
                          <label className="text-xs text-nest-400 font-semibold uppercase tracking-wider block mb-1.5">Duration (seconds)</label>
                          <input name="duration" type="number" min={0} max={3600} defaultValue={300} placeholder="300"
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white placeholder-nest-500 focus:outline-none focus:border-nest-400/40 transition-colors" />
                          <p className="text-[10px] text-nest-600 mt-1">How long condition must persist before alerting</p>
                        </div>

                        {/* Channel */}
                        <div>
                          <label className="text-xs text-nest-400 font-semibold uppercase tracking-wider block mb-1.5">Delivery Channel</label>
                          <select name="channel" required
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white focus:outline-none focus:border-nest-400/40 transition-colors">
                            <option value="webhook">🌐 Webhook (Discord, Slack, etc.)</option>
                            <option value="email">📧 Email</option>
                          </select>
                        </div>

                        {/* Target */}
                        <div>
                          <label className="text-xs text-nest-400 font-semibold uppercase tracking-wider block mb-1.5">Target URL / Email</label>
                          <input name="target" required placeholder="https://discord.com/api/webhooks/..." maxLength={500}
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white placeholder-nest-500 focus:outline-none focus:border-nest-400/40 transition-colors" />
                        </div>

                        {/* Cooldown */}
                        <div>
                          <label className="text-xs text-nest-400 font-semibold uppercase tracking-wider block mb-1.5">Cooldown (minutes)</label>
                          <input name="cooldown" type="number" min={1} max={1440} defaultValue={30} placeholder="30"
                            className="w-full px-3 py-2 rounded-lg text-sm bg-nest-900/50 border border-nest-800 text-white placeholder-nest-500 focus:outline-none focus:border-nest-400/40 transition-colors" />
                          <p className="text-[10px] text-nest-600 mt-1">Minutes between repeat alerts for the same rule</p>
                        </div>

                        <button
                          type="submit"
                          disabled={addingNotifRule}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-nest-500/30 to-nest-400/30 hover:from-nest-500/50 hover:to-nest-400/50 text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-nest-400/20"
                        >
                          {addingNotifRule ? (
                            <><Loader2 size={14} className="animate-spin" /> Creating…</>
                          ) : (
                            <><Bell size={14} /> Create Alert Rule</>
                          )}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {/* Alert Rules */}
              {notifLoading && notifRules.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center glow-border">
                  <Loader2 size={36} className="text-nest-600 mx-auto mb-3 animate-spin" />
                  <p className="text-sm text-nest-400">Loading alert rules…</p>
                </div>
              ) : notifRules.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center glow-border">
                  <Bell size={36} className="text-nest-600 mx-auto mb-3" />
                  <p className="text-sm text-nest-400">No alert rules configured</p>
                  <p className="text-xs text-nest-500 mt-1">Set up alerts for server offline, high CPU, RAM, or disk usage</p>
                  <button
                    onClick={() => setShowAddNotifRule(true)}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-nest-500/20 text-nest-200 hover:bg-nest-400/30 transition-all border border-nest-400/20"
                  >
                    <Plus size={12} /> Create Your First Alert
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifRules.map(rule => {
                    const conditionLabels: Record<string, { icon: string; label: string; color: string }> = {
                      server_offline: { icon: '🔴', label: 'Server Offline', color: 'text-rose-400' },
                      cpu_high: { icon: '🔥', label: `CPU ≥ ${rule.threshold}%`, color: 'text-amber-400' },
                      ram_high: { icon: '💾', label: `RAM ≥ ${rule.threshold}%`, color: 'text-blue-400' },
                      disk_high: { icon: '💿', label: `Disk ≥ ${rule.threshold}%`, color: 'text-purple-400' },
                    };
                    const cond = conditionLabels[rule.condition] || { icon: '⚠️', label: rule.condition, color: 'text-nest-400' };

                    return (
                      <div key={rule.id} className={clsx(
                        'glass rounded-xl p-4 glow-border transition-all',
                        !rule.enabled && 'opacity-50',
                      )}>
                        <div className="flex items-center gap-4">
                          <div className="text-2xl flex-shrink-0">{cond.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-white">{rule.name}</span>
                              <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-medium', rule.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-nest-800 text-nest-500')}>
                                {rule.enabled ? 'Active' : 'Disabled'}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-nest-800/60 text-nest-400">
                                {rule.channel === 'webhook' ? '🌐 Webhook' : '📧 Email'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-nest-500 flex-wrap">
                              <span className={cond.color}>{cond.label}</span>
                              <span className="text-nest-700">•</span>
                              <span>Wait {rule.duration_seconds}s</span>
                              <span className="text-nest-700">•</span>
                              <span>Cooldown {rule.cooldown_minutes}m</span>
                              {rule.last_fired_at && (
                                <>
                                  <span className="text-nest-700">•</span>
                                  <span className="text-amber-400/70">Last fired: {new Date(rule.last_fired_at).toLocaleString()}</span>
                                </>
                              )}
                            </div>
                            <p className="text-[10px] text-nest-600 mt-0.5 truncate font-mono max-w-md">{rule.target}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {/* Toggle */}
                            <button
                              onClick={async () => {
                                try {
                                  await api.updateNotificationRule(serverId, rule.id, { enabled: !rule.enabled });
                                  fetchNotifications();
                                } catch { /* ignore */ }
                              }}
                              className={clsx(
                                'p-2 rounded-lg transition-all',
                                rule.enabled
                                  ? 'text-emerald-400 hover:bg-emerald-500/10'
                                  : 'text-nest-500 hover:bg-nest-800/50',
                              )}
                              title={rule.enabled ? 'Disable' : 'Enable'}
                            >
                              {rule.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                            </button>
                            {/* Test */}
                            <button
                              onClick={async () => {
                                setTestingNotif(true);
                                try {
                                  const result = await api.testNotification(serverId, rule.channel, rule.target);
                                  setNotifMessage({ type: 'success', text: result.note || 'Test notification sent!' });
                                } catch (err) {
                                  setNotifMessage({ type: 'error', text: err instanceof Error ? err.message : 'Test failed' });
                                } finally {
                                  setTestingNotif(false);
                                  setTimeout(() => setNotifMessage(null), 5000);
                                }
                              }}
                              disabled={testingNotif}
                              className="p-2 rounded-lg text-nest-400 hover:text-sky-400 hover:bg-sky-500/10 transition-all"
                              title="Send test notification"
                            >
                              <Send size={14} />
                            </button>
                            {/* Delete */}
                            <button
                              onClick={async () => {
                                if (!confirm(`Delete alert rule "${rule.name}"?`)) return;
                                try {
                                  await api.deleteNotificationRule(serverId, rule.id);
                                  setNotifMessage({ type: 'success', text: 'Rule deleted' });
                                  fetchNotifications();
                                } catch (err) {
                                  setNotifMessage({ type: 'error', text: err instanceof Error ? err.message : 'Delete failed' });
                                }
                                setTimeout(() => setNotifMessage(null), 5000);
                              }}
                              className="p-2 rounded-lg text-nest-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                              title="Delete rule"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Notification History */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <History size={14} className="text-nest-400" />
                  Recent Alerts
                  <span className="text-xs text-nest-500 font-normal ml-1">
                    {notifHistory.length} event{notifHistory.length !== 1 ? 's' : ''}
                  </span>
                </h3>

                {notifHistory.length === 0 ? (
                  <div className="glass rounded-xl p-6 text-center glow-border">
                    <BellRing size={28} className="text-nest-600 mx-auto mb-2" />
                    <p className="text-xs text-nest-500">No alerts fired yet</p>
                  </div>
                ) : (
                  <div className="glass rounded-xl glow-border overflow-hidden">
                    <div className="max-h-[400px] overflow-y-auto divide-y divide-nest-800/40">
                      {notifHistory.map(evt => (
                        <div key={evt.id} className="px-4 py-3 flex items-center gap-3">
                          <div className={clsx(
                            'h-2 w-2 rounded-full flex-shrink-0',
                            evt.status === 'sent' ? 'bg-emerald-400' : 'bg-rose-400',
                          )} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-nest-300">{evt.message}</p>
                            <div className="flex items-center gap-3 mt-0.5 text-[10px] text-nest-500">
                              <span>{evt.rule_name}</span>
                              <span className="text-nest-700">•</span>
                              <span>{evt.channel === 'webhook' ? '🌐' : '📧'} {evt.channel}</span>
                              <span className="text-nest-700">•</span>
                              <span>{new Date(evt.fired_at).toLocaleString()}</span>
                              {evt.error && (
                                <>
                                  <span className="text-nest-700">•</span>
                                  <span className="text-rose-400">{evt.error}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <span className={clsx(
                            'text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0',
                            evt.status === 'sent' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400',
                          )}>
                            {evt.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Info Box */}
              <div className="glass rounded-xl p-4 glow-border">
                <div className="flex items-start gap-3">
                  <Info size={16} className="text-sky-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-nest-400 space-y-1">
                    <p><span className="text-white font-medium">How it works:</span> The cloud server checks your server's metrics every 30 seconds against your alert rules.</p>
                    <p>If a condition is breached for the specified duration, a notification is sent via webhook or email. A cooldown prevents spam.</p>
                    <p><span className="text-white font-medium">Webhook tip:</span> Use Discord or Slack webhook URLs for instant alerts. The payload includes event type, server name, value, and threshold.</p>
                  </div>
                </div>
              </div>
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

              {/* Terminal */}
              <div className="glass rounded-xl p-4 glow-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Terminal size={18} className="text-nest-400" />
                    <div>
                      <p className="text-sm font-medium text-white">Web Terminal</p>
                      <p className="text-xs text-nest-500">Full shell access to your Proxmox server</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setConsoleGuest({ vmid: 0, type: 'host', name: 'Host Shell' })}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 hover:text-white transition-all"
                  >
                    <Terminal size={12} /> Open Terminal
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