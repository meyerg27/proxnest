# ProxNest Auto-Configuration Spec

## Core Principle
**Every app installs with ONE CLICK and is FULLY configured. Zero user intervention.**

The user should NEVER have to:
- Edit a config file
- Set up folder paths
- Connect apps to each other
- Configure API keys between services
- Set up reverse proxy entries
- Create users/databases manually

## Storage Layout (Auto-Created on First Setup)

When user sets up storage, ProxNest auto-creates this structure:

```
/data/
├── media/
│   ├── movies/          # Radarr → Plex/Jellyfin
│   ├── tv/              # Sonarr → Plex/Jellyfin
│   ├── music/           # Lidarr → Plex/Jellyfin
│   ├── books/           # Readarr → Calibre-Web
│   ├── audiobooks/      # Readarr → Audiobookshelf
│   ├── photos/          # Immich
│   └── podcasts/        # Audiobookshelf
├── downloads/
│   ├── complete/        # qBit/SABnzbd finished
│   ├── incomplete/      # In-progress downloads
│   └── watch/           # Torrent file drop
├── apps/
│   ├── nextcloud/       # Nextcloud user data
│   ├── vaultwarden/     # Password vault data
│   ├── paperless/       # Document scans
│   ├── mealie/          # Recipe data
│   ├── gitea/           # Git repos
│   └── [app-name]/      # Auto-created per app
├── backups/
│   └── proxnest/        # Auto-backups
└── config/
    └── [app-name]/      # App configs (bind mounted)
```

## App Auto-Configuration Rules

### Media Stack (Plex/Jellyfin)
On install:
1. Create container with GPU passthrough (if available)
2. Bind mount `/data/media/movies`, `/data/media/tv`, `/data/media/music`
3. Auto-create libraries:
   - Movies → `/data/media/movies`
   - TV Shows → `/data/media/tv`
   - Music → `/data/media/music`
4. Enable hardware transcoding if GPU detected
5. Generate API key and store in ProxNest DB

### *arr Stack (Radarr/Sonarr/Prowlarr/Bazarr)
On install of ANY *arr app:
1. Check if qBittorrent is installed → if not, prompt to install it first
2. Auto-configure download client pointing to qBit
3. Set root folder to correct `/data/media/[type]`
4. If Prowlarr installed → auto-connect indexers to Radarr/Sonarr
5. If Plex/Jellyfin installed → add as notification target (notify on import)
6. Set quality profiles to sensible defaults (1080p, English)
7. Enable hardlinks (same filesystem = instant imports)

### Download Client (qBittorrent)
On install:
1. Set download path to `/data/downloads/complete`
2. Set incomplete path to `/data/downloads/incomplete`
3. Set torrent watch folder to `/data/downloads/watch`
4. Set sensible defaults: max 8 active, sequential download off
5. Generate random admin password, store in ProxNest
6. If VPN app installed → route through VPN automatically

### Cloud Storage (Nextcloud)
On install:
1. Deploy with PostgreSQL (not SQLite)
2. Set data dir to `/data/apps/nextcloud`
3. Create admin account with ProxNest credentials
4. Install recommended apps (Calendar, Contacts, Tasks, Notes)
5. Configure trusted domains (local IP + ProxNest domain)
6. Set PHP memory limit to 512MB
7. Configure cron job for background tasks

### Photo Management (Immich)
On install:
1. Deploy with PostgreSQL + Redis + ML container
2. Set upload location to `/data/media/photos`
3. If GPU available → use CUDA ML image
4. Create admin account with ProxNest credentials
5. Enable machine learning (face detection, object recognition)

### Home Automation (Home Assistant)
On install:
1. Deploy as VM (not container) for USB passthrough support
2. Auto-detect Zigbee/Z-Wave USB dongles
3. Set up mDNS/avahi for device discovery
4. If Mosquitto installed → pre-configure MQTT broker

### Reverse Proxy (NPM/Traefik)
On install:
1. Auto-generate SSL certs for local domain
2. Create proxy entries for ALL installed apps
3. When any new app installs → auto-add proxy entry
4. Wildcard cert for *.local.proxnest domain

### Monitoring (Grafana + Prometheus)
On install:
1. Auto-configure Prometheus to scrape Proxmox node exporter
2. Import pre-built dashboards (Node Exporter, Docker, ZFS)
3. Add all ProxNest apps as monitoring targets
4. Set up alerting (disk full, high CPU, app down)

## App Interconnection Matrix

When App B is installed and App A already exists, auto-connect:

| App A (existing) | App B (new) | Auto-Config |
|---|---|---|
| qBittorrent | Radarr/Sonarr | Add as download client |
| Prowlarr | Radarr/Sonarr | Sync indexers |
| Radarr/Sonarr | Plex/Jellyfin | Add notification on import |
| Radarr/Sonarr | Bazarr | Connect for subtitle fetching |
| Any app | NPM/Traefik | Add reverse proxy entry |
| Any app | Prometheus | Add scrape target |
| Mosquitto | Home Assistant | Configure MQTT |
| Mosquitto | Zigbee2MQTT | Configure MQTT broker |
| WireGuard | qBittorrent | Route traffic through VPN |
| Authentik | Any app with OIDC | Configure SSO |
| PostgreSQL | Apps needing DB | Auto-create database |

## First-Time Setup Wizard

Step 1: Welcome
- "Welcome to ProxNest. Let's set up your home server."

Step 2: Storage
- Detect all drives
- Show: "OS drive (256GB SSD) | Storage drives: 2x 14TB HDD, 1x 1TB SSD"
- Recommend: "Create ZFS mirror with your 14TB drives for redundancy"
- One click → ZFS pool created, folder structure created

Step 3: Network
- Auto-detect IP, gateway, DNS
- Option to set static IP
- Option to set hostname

Step 4: Admin Account
- Create admin username + password
- This becomes the login for ALL apps (SSO)

Step 5: Quick Install
- "What do you want to use your server for?"
- [ ] Media Server (Plex + *arr stack + qBit)
- [ ] Cloud Storage (Nextcloud + Immich)
- [ ] Home Automation (Home Assistant + MQTT)
- [ ] Network Security (AdGuard + WireGuard)
- [ ] All of the above
- One click → entire stack deploys and auto-configures

Step 6: Done
- "Your server is ready! Here's your dashboard."
- Show dashboard with all apps running

## API Endpoints for App Management

```
POST /api/apps/install     - Install app (returns job ID)
GET  /api/apps/install/:id - Check install progress
POST /api/apps/:id/start   - Start app
POST /api/apps/:id/stop    - Stop app  
POST /api/apps/:id/restart - Restart app
DELETE /api/apps/:id       - Uninstall app
GET  /api/apps/:id/logs    - Stream app logs
GET  /api/apps/:id/config  - Get app config
PUT  /api/apps/:id/config  - Update app config
GET  /api/apps/store       - List available apps
GET  /api/apps/installed   - List installed apps
POST /api/apps/stack       - Install app stack (e.g., "media")
```

## App Stacks (Pre-configured bundles)

### Media Server Stack
- Plex OR Jellyfin (user picks)
- Radarr + Sonarr + Prowlarr + Bazarr
- qBittorrent (with VPN if user has one)
- Overseerr/Jellyseerr (request management)
- Tdarr (transcoding optimization)

### Cloud Stack
- Nextcloud
- Immich
- Vaultwarden
- Syncthing

### Home Automation Stack
- Home Assistant
- Mosquitto MQTT
- Zigbee2MQTT (if USB dongle detected)
- Node-RED
- ESPHome

### Network Security Stack
- AdGuard Home
- WireGuard
- CrowdSec
- Authentik (SSO for all apps)

### Developer Stack
- Code Server
- Gitea
- n8n
- IT Tools
- Portainer
