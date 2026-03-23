# ProxNest

**A dashboard and auto-config layer for Proxmox home servers.**

Install apps that find and configure each other. Click "Media Server" and Jellyfin, Radarr, Sonarr, qBit, and Prowlarr all install and wire themselves together. No YAML, no port conflicts, no "why can't Radarr see my download client" troubleshooting.

Built on Proxmox VE, so you get real VMs, LXC containers, Docker, and ZFS. Not another Docker-only wrapper.

[Website](https://proxnest.com) · [Cloud Dashboard](https://cloud.proxnest.com) · [Discord](https://discord.gg/b4NGUMYU34) · [Docs](./docs/README.md)

[![Discord](https://img.shields.io/discord/1485446431765696674?color=5865F2&label=Discord&logo=discord&logoColor=white)](https://discord.gg/b4NGUMYU34)
[![License](https://img.shields.io/badge/license-AGPLv3-blue.svg)](LICENSE)

## What is this?

Proxmox is powerful but the learning curve is steep. ProxNest adds:

- **App Store with auto-wiring.** Apps install into isolated LXC containers and configure their connections automatically. Radarr finds qBit. Prowlarr syncs indexers to Radarr and Sonarr. Bazarr connects to both.
- **Storage wizard.** Detects your disks, helps you set up ZFS or ext4, assigns roles (media, downloads, backups).
- **Cloud dashboard.** Manage your server from your phone. Optional, not required.
- **Backup and restore.** One-click config backups for all apps. Restore to a clean install.
- **Web terminal.** Full shell in your browser when you need it.

It's Proxmox underneath. You can still use the Proxmox UI for anything ProxNest doesn't cover.

## Quick start

```bash
# Install on existing Proxmox
curl -fsSL https://proxnest.com/install.sh | bash

# Or download the ISO for a fresh install
# https://github.com/proxnest-os/proxnest/releases
```

## Apps

~40 apps across these categories:

| Category | Apps |
|----------|------|
| Media | Jellyfin, Plex, Navidrome, Audiobookshelf, Tautulli, Tdarr |
| Downloads | Radarr, Sonarr, qBittorrent, Prowlarr, Bazarr, SABnzbd, NZBGet, NZBHydra2 |
| Cloud | Nextcloud, Immich, Paperless-ngx, FileBrowser, Syncthing |
| Network | Pi-hole, AdGuard Home, WireGuard, Nginx Proxy Manager |
| Monitoring | Grafana, Uptime Kuma, Portainer, Dozzle |
| Automation | Home Assistant, Node-RED, n8n |
| Other | Vaultwarden, Mealie, Gitea, VS Code Server |

Pre-built stacks: Media Server, Downloads, Usenet, Cloud Suite, Monitoring, Home Automation, Privacy, Dev Tools.

## How it compares

| | TrueNAS | OMV | Unraid | ProxNest |
|---|---|---|---|---|
| Price | Free | Free | $60-130 | Free (Pro: $5/mo) |
| Focus | Storage/ZFS | Simple NAS | Storage + Docker | Apps + VMs |
| VMs | Via bhyve | No | Basic KVM | Full KVM |
| Containers | Docker (limited) | Docker | Docker | Docker + LXC |
| ZFS | Excellent | Plugin | Plugin | Native (via Proxmox) |
| App auto-config | No | No | No | Yes |
| Open source | Yes | Yes | No | Yes |

**Honest take:** TrueNAS is better if ZFS management is your priority. OMV is simpler if you just need a basic NAS. Unraid has a bigger community. ProxNest is for people who want Proxmox's power with less friction, especially around app deployment.

## Architecture

```
Cloud Dashboard (React)  ←→  ProxNest API (Node/Fastify)
                                    ↕
                              ProxNest Agent (on your server)
                                    ↕
                              Proxmox VE (KVM, LXC, ZFS)
```

The agent runs on your Proxmox host and talks to the PVE API. The cloud dashboard is optional. Everything works locally.

## Docs

- [Installation](docs/INSTALLATION.md)
- [Apps & Stacks](docs/APPS.md)
- [Storage](docs/STORAGE.md)
- [Networking](docs/NETWORKING.md)
- [Backups](docs/BACKUPS.md)
- [FAQ](docs/FAQ.md)
- [Contributing](docs/CONTRIBUTING.md)

## Development

```bash
git clone https://github.com/proxnest-os/proxnest.git
cd proxnest

# Landing page
cd landing && npm install && npm run dev

# Cloud dashboard
cd cloud/dashboard && npm install && npm run dev

# Cloud API
cd cloud && npm install && npm run dev

# Agent
cd agent && npm install && npm run dev
```

## License

AGPLv3. Core is open source. Cloud dashboard hosting is a paid option.
