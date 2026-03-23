# Getting Started with ProxNest

## 🚀 Quick Start (5 minutes)

### Step 1: Install
1. Download the ProxNest ISO from [proxnest.com](https://proxnest.com)
2. Flash it to a USB drive using [Balena Etcher](https://etcher.balena.io/)
3. Boot your server from the USB drive
4. Follow the Proxmox installer (takes ~3 minutes)
5. Server reboots → ProxNest agent installs automatically

### Step 2: Connect to Cloud
1. Go to [cloud.proxnest.com](https://cloud.proxnest.com) and create an account
2. Your server appears automatically — click **Claim** and enter the code shown on your server's console
3. You now have full control from the cloud dashboard!

### Step 3: Install Your First Stack
1. In the dashboard, go to **App Store**
2. Click **Media Server** stack (Jellyfin + Radarr + Sonarr + Prowlarr + qBittorrent + Bazarr)
3. Click **Install Stack** — apps deploy into isolated containers automatically
4. Apps auto-wire themselves: Radarr connects to qBittorrent, Prowlarr syncs indexers to Radarr/Sonarr, etc.

### Step 4: Enjoy
- **Jellyfin**: Stream your movies and TV shows
- **Radarr**: Search and download movies automatically
- **Sonarr**: Search and download TV shows automatically
- Each app has its own IP, its own resources, and shows as a separate container in Proxmox

## 📦 Available Stacks

| Stack | Apps | Description |
|-------|------|-------------|
| 🎬 Media Server | 6 apps | Jellyfin + Radarr + Sonarr + Prowlarr + qBittorrent + Bazarr |
| ⬇️ Downloads | 4 apps | qBittorrent + Radarr + Sonarr + Prowlarr |
| ☁️ Personal Cloud | 3 apps | Nextcloud + Immich + Paperless |
| 📊 Monitoring | 4 apps | Grafana + Uptime Kuma + Portainer + Dozzle |
| 🏠 Home Automation | 3 apps | Home Assistant + Mosquitto + Node-RED |
| 🔒 Privacy | 3 apps | Pi-hole + WireGuard + Vaultwarden |
| 📝 Productivity | 3 apps | Mealie + Paperless + Audiobookshelf |
| 💻 Dev Tools | 3 apps | Gitea + Portainer + Code Server |

## 🔧 Architecture

```
Your Server (Proxmox VE)
├── CT 200: Jellyfin (2GB RAM, 2 cores)
├── CT 201: qBittorrent (1GB RAM, 1 core)
├── CT 202: Radarr (1GB RAM, 1 core)
├── CT 203: Sonarr (1GB RAM, 1 core)
├── CT 204: Prowlarr (512MB RAM, 1 core)
├── CT 205: Bazarr (512MB RAM, 1 core)
└── ProxNest Agent → cloud.proxnest.com
```

Each app runs in its own LXC container with:
- Dedicated IP address
- Individual CPU/RAM limits
- Docker inside for the app itself
- Auto-wiring to connect apps together

## 💡 Tips

- **Storage**: Use the Storage Wizard to assign disks for media, downloads, and backups
- **VPN**: Upload your VPN config in Settings to protect your downloads
- **Backups**: Enable automatic backups in the Backups tab
- **Updates**: The dashboard shows available updates for each app
- **Terminal**: Click the terminal icon on any app to get a shell inside its container

## 🆘 Help

- **Guides**: Each app has a built-in guide (click the ? icon)
- **Getting Started checklist**: Dashboard shows your next steps
- **Community**: [Discord](https://discord.gg/proxnest) | [Reddit](https://reddit.com/r/proxnest)
- **GitHub**: [github.com/proxnest-os/proxnest](https://github.com/proxnest-os/proxnest)
