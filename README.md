# ProxNest 🏠

**The home server OS that doesn't suck.**

ProxNest is a beautiful, local-first home server operating system built on top of Proxmox VE. It turns bare metal into a fully managed home server with one-click app installs, simple storage management, and a modern web dashboard — no cloud dependency required.

## Why ProxNest?

| | Hexos | Unraid | ProxNest |
|---|---|---|---|
| **Price** | $200 | $60-130 | Free / $5/mo Pro |
| **Base** | TrueNAS | Custom Linux | Proxmox VE |
| **Cloud Required** | Yes ❌ | No | No ✅ |
| **VM Support** | Limited | Basic | Full KVM ✅ |
| **Containers** | Docker only | Docker only | Docker + LXC ✅ |
| **Storage** | ZFS (TrueNAS) | Custom | ZFS (native) ✅ |
| **API** | Minimal | Minimal | Full Proxmox API ✅ |
| **Status** | Beta (delayed) | Stable | Building 🚧 |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   ProxNest Stack                     │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │  Web Dashboard│  │ Landing Page │   React + TS    │
│  │  (port 3000) │  │ (proxnest.com)│  + Tailwind    │
│  └──────┬───────┘  └──────────────┘                 │
│         │                                            │
│  ┌──────┴───────┐                                   │
│  │  ProxNest API │  Node.js + TypeScript             │
│  │  (port 4000) │  REST API wrapping Proxmox        │
│  └──────┬───────┘                                   │
│         │                                            │
│  ┌──────┴───────┐                                   │
│  │  ProxNest    │  Lightweight daemon                │
│  │  Agent       │  System monitoring, cloud sync     │
│  └──────┬───────┘                                   │
│         │                                            │
│  ┌──────┴───────┐                                   │
│  │  Proxmox VE  │  KVM, LXC, ZFS, Networking       │
│  │  (host OS)   │                                    │
│  └──────────────┘                                   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

### Frontend (Dashboard + Landing)
- **React 18** + TypeScript
- **Tailwind CSS** — utility-first styling
- **Vite** — fast builds
- **Lucide React** — icon library
- **Framer Motion** — animations
- **React Router v6** — client-side routing
- **React Query** — server state management

### Backend (API)
- **Node.js** + TypeScript
- **Fastify** — high-performance HTTP framework
- **Proxmox API client** — wraps the PVE REST API
- **JWT** — authentication
- **Zod** — schema validation
- **SQLite** (via better-sqlite3) — local config/state DB

### Agent
- **Node.js** + TypeScript (single binary via `pkg`)
- **WebSocket** — real-time communication with dashboard
- **systeminformation** — hardware stats
- **node-cron** — scheduled tasks (backups, updates)

## Core Features

### 1. One-Click App Marketplace
Pre-configured templates for popular self-hosted apps:
- **Media:** Plex, Jellyfin, Emby, Navidrome
- **Downloads:** Radarr, Sonarr, Lidarr, Prowlarr, qBittorrent, SABnzbd
- **Cloud:** Nextcloud, Immich, Paperless-ngx
- **Networking:** Pi-hole, AdGuard Home, WireGuard, Tailscale
- **Home Automation:** Home Assistant, Node-RED, Zigbee2MQTT
- **Dev:** Gitea, VS Code Server, Portainer

Each app is a template that specifies:
```typescript
interface AppTemplate {
  id: string;
  name: string;
  icon: string;
  category: 'media' | 'downloads' | 'cloud' | 'network' | 'home' | 'dev';
  type: 'docker' | 'lxc';
  config: DockerComposeConfig | LXCConfig;
  ports: PortMapping[];
  volumes: VolumeMapping[];
  env: EnvVar[];
  requirements: { minRam: number; minDisk: number; };
}
```

### 2. Storage Management (ZFS Made Simple)
- Visual pool/dataset browser
- Create pools with guided wizard (mirror, RAIDZ1/2/3)
- Snapshot management with schedule builder
- Disk health monitoring (SMART)
- Storage usage charts and projections

### 3. Dashboard
- System overview (CPU, RAM, network, temps)
- Running apps with status indicators
- Storage pool health at a glance
- Recent activity log
- Dark theme, responsive, fast

### 4. User Management
- Local user accounts with role-based access
- Admin / User / Viewer roles
- Per-app access control
- Session management

### 5. Cloud Portal (Optional)
- Zero-config remote access via agent
- Agent registers with portal, establishes WireGuard tunnel
- Access dashboard from anywhere without port forwarding
- Push notifications for alerts
- **100% optional** — everything works locally without it

## Project Structure

```
proxnest/
├── README.md              # This file
├── BUILD_PROGRESS.md      # Build tracking
├── landing/               # Marketing website (proxnest.com)
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── dashboard/             # Admin web UI
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── api/                   # Backend REST API
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
└── agent/                 # Server daemon
    ├── src/
    ├── package.json
    └── tsconfig.json
```

## Revenue Model

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | Dashboard, 5 apps, basic storage, local only |
| **Pro** | $5/mo or $50/yr | Unlimited apps, cloud portal, VPN, priority support |
| **Hardware Bundle** | TBD | Pre-installed on partner mini PCs |

## Development

```bash
# Landing page
cd landing && npm install && npm run dev

# API server
cd api && npm install && npm run dev

# Dashboard
cd dashboard && npm install && npm run dev
```

## License

Dual-licensed: Open-source core (AGPLv3) + Commercial features (proprietary).
