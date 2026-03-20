# ProxNest — Build Progress

## Run 1 — 2026-03-20

### ✅ Phase 1: Architecture Doc (README.md)
- Full architecture document with diagrams
- Tech stack defined (React+TS+Tailwind frontend, Node+TS+Fastify backend, Proxmox API)
- Feature breakdown: App Store, Storage, Dashboard, Users, Cloud Portal
- Revenue model: Free tier + $5/mo Pro
- Project structure defined
- License: AGPLv3 core + proprietary features

### ✅ Phase 2: Landing Page (landing/)
- Full React + TypeScript + Tailwind landing page
- Vite build, production-ready (builds clean, 339KB JS + 25KB CSS gzipped to ~112KB)
- **Sections built:**
  - Navbar (responsive, mobile hamburger, glass effect)
  - Hero (animated headline, CTA buttons, mock dashboard preview)
  - Features (6 cards: App Store, Storage, Dashboard, Local-First, Proxmox Powered, Multi-User)
  - App Store showcase (4 categories: Media, Downloads, Cloud, Network with 12 apps)
  - Comparison table (ProxNest vs Hexos vs Unraid — 9 features)
  - Pricing (Free + Pro tiers with feature lists)
  - CTA section (download + GitHub buttons)
  - Footer (4-column with links)
- **Design:** Dark theme (nest-900 base), indigo accent, glass morphism cards, gradient text, glow borders, Framer Motion animations
- **Dependencies:** react, tailwindcss v4 (@tailwindcss/vite), lucide-react, framer-motion

---

## Run 4 — 2026-03-20

### ✅ Phase: Complete App Store Templates
- Expanded `/api/src/app-templates.ts` from ~41 to **63 app templates** + 4 compose stacks
- Added 2 new categories: **gaming**, **communication** (now 11 total)
- **22 apps added:**
  - Media: Kodi Headless, Jellyseerr, Tdarr
  - Downloads: JDownloader
  - Cloud: Seafile (with MariaDB + Memcached compose)
  - Home Automation: Node-RED, Mosquitto, Zigbee2MQTT, ESPHome
  - Security: Authentik (full compose with PostgreSQL + Redis + worker), Fail2Ban
  - Productivity: Stirling-PDF, Calibre-Web
  - Development: Hoppscotch (with PostgreSQL compose), IT Tools
  - Gaming: GameVault (with PostgreSQL), Lancache, Minecraft Server (Paper, RCON), Valheim Server
  - Communication: Matrix/Synapse (with PostgreSQL), Mattermost (with PostgreSQL), Rocket.Chat (with MongoDB)
- Every template has: id, name, description, icon, category, type, tags, website, docker config (image, ports, volumes, env), webPort, minResources
- Complex apps include full Docker Compose definitions with all dependent services
- File: 2,369 lines, all 63 required apps verified present
- Committed and pushed to GitHub

---

## Run 5 — 2026-03-20

### ✅ Phase: Cloud Portal Backend (`/cloud/`)
Already built in prior run. Verified complete:
- `cloud/src/index.ts` (165 lines) — Fastify server with CORS, JWT, WebSocket, rate limiting, error handling, graceful shutdown
- `cloud/src/routes/auth.ts` (239 lines) — User registration/login (email + password, bcrypt, JWT), profile endpoint
- `cloud/src/routes/servers.ts` (209 lines) — Server registration (agent phones home via WS), list user's servers, claim flow with tokens
- `cloud/src/routes/proxy.ts` (160 lines) — WebSocket proxy to forward dashboard requests to user's server through the agent tunnel
- `cloud/src/db.ts` (141 lines) — SQLite (better-sqlite3, WAL mode) with users, servers, sessions, audit_log tables + typed interfaces
- `cloud/src/config.ts` (24 lines) — Environment-based config
- `cloud/src/agent-pool.ts` (375 lines) — Agent WebSocket connection pool management (register, heartbeat, proxy routing)

### ✅ Phase: Cloud Portal Frontend (`/cloud/dashboard/`)
Already built in prior run. Verified complete:
- `cloud/dashboard/src/App.tsx` — Routes with auth guard (Login, Register, ServerList, ServerDashboard, Account)
- `cloud/dashboard/src/pages/Login.tsx` (147 lines) — Login form with email/password
- `cloud/dashboard/src/pages/Register.tsx` (201 lines) — Registration form with validation
- `cloud/dashboard/src/pages/ServerList.tsx` (513 lines) — All user's servers with online/offline status, claim new server flow
- `cloud/dashboard/src/pages/ServerDashboard.tsx` (384 lines) — Proxied dashboard via WebSocket tunnel to local server
- `cloud/dashboard/src/pages/Account.tsx` (432 lines) — Account settings (profile, password change, plan info)
- `cloud/dashboard/src/hooks/useAuth.tsx` — Auth context with JWT token management
- `cloud/dashboard/src/lib/api.ts` — Cloud API client
- `cloud/dashboard/src/components/CloudLayout.tsx` — Shell layout with nav

### ✅ Phase: Agent Cloud Connection (`/agent/src/connection.ts`)
Already built in prior run. Verified complete (394 lines):
- Connects to cloud.proxnest.com via WebSocket on startup
- Sends heartbeats with system metrics on configurable interval
- Accepts and handles proxied dashboard requests (HTTP→WS→local API→response)
- Auto-reconnect with exponential backoff (configurable base/max delay)
- Full protocol: register, heartbeat, metrics, command_result, proxy_response, pong
- Config updates from portal (runtime heartbeat/metrics interval changes)
- Graceful disconnect on shutdown

### ✅ Phase: Dashboard Polish (all pages feature-complete)
Already built in prior run. Verified all pages are production-quality:

**AppsStore.tsx** (168 lines):
- Grid of app cards with icon, name, description, type badge, tags
- Search input with real-time filtering
- Category filter buttons with counts
- Install button with loading spinner and success state
- External link to app website

**InstalledApps.tsx** (418 lines):
- Running apps with start/stop/restart/remove buttons
- Status badges (running/stopped/installing/restarting/error/removing) with colors
- Log viewer modal with auto-scroll, 5s refresh, syntax highlighting for errors/warnings
- Expandable card details (template, category, IP, port, install date)
- Search and status filter pills with counts
- Empty state with link to App Store

**Storage.tsx** (888 lines):
- ZFS pool cards with health status, usage bar, frag/dedup stats
- Storage pool cards with content types, shared/active/enabled flags
- Physical disk list with SSD/HDD detection, wear level, used/unused status
- Create ZFS Pool wizard (3-step: Select Disks → Configure → Confirm)
  - Disk selection with checkboxes
  - RAID level picker (single/mirror/raidz/raidz2/raidz3) with min-disk validation
  - Compression (lz4/zstd/gzip/on/off), ashift, add-as-Proxmox-storage options
  - Estimated capacity calculator
  - Review summary with destructive action warning
- Node selector for multi-node setups
- Auto-refresh every 30s

**Dashboard.tsx** (459 lines):
- Real-time CPU/RAM/network/disk I/O graphs (SVG line charts with smooth bezier curves)
- Timeframe selector (1H/24H/7D/30D)
- 4 stat cards (CPU, Memory, Storage, Nodes) with progress bars
- 4 quick count cards (VMs, Containers, Installed Apps, Users)
- 8 chart panels: CPU, Memory, Network (in/out), Disk I/O (read/write), Load Average, IO Wait, Swap, Root Disk
- VM/Container resource list with start/stop actions
- Auto-refresh (15s for 1H, 60s otherwise)

**Supporting components:**
- `MiniChart.tsx` (230 lines) — SVG line/area chart with gradient fill, grid, labels, multi-line variant for overlaid metrics
- `StatCard.tsx` — Stats with icon, value, subtitle, progress bar, 5 color themes
- `ResourceRow.tsx` — VM/Container row with status indicator, type badge, CPU/RAM stats, start/stop

**API client** (`lib/api.ts`, 155 lines) — Complete typed client covering: auth, dashboard summary, nodes (list/detail/resources/action/tasks/rrd), storage (list/content/disks/summary/zfs), apps (store/installed/install/uninstall/action/logs/featured/stacks), users, system (health/notifications/settings/audit-log)

**Types** (`types/api.ts`, 160 lines) — Full TypeScript interfaces for all API responses

---

## ✅ ALL PRIORITIES COMPLETE

All 5 priority items verified complete:
1. ✅ App Store templates — 63 apps + 4 stacks in `/api/src/app-templates.ts` (2,369 lines)
2. ✅ Cloud Portal backend — `/cloud/src/` with auth, servers, WebSocket proxy, SQLite DB
3. ✅ Cloud Portal frontend — `/cloud/dashboard/` with login, register, server list, proxied dashboard, account
4. ✅ Agent cloud connection — `/agent/src/connection.ts` with WS, heartbeats, proxy, auto-reconnect
5. ✅ Dashboard polish — All 4 pages feature-complete with charts, wizards, modals, filters

## Full File Summary

```
landing/          — Marketing site (React+Vite+Tailwind+Framer Motion)
api/              — Local API server (Fastify+TypeScript+SQLite)
  src/app-templates.ts  — 63 app templates + 4 compose stacks
  src/routes/     — auth, apps, nodes, storage, system, users
  src/proxmox.ts  — Proxmox VE API client
  src/db.ts       — SQLite database
agent/            — System agent (metrics, commands, cloud connection)
  src/connection.ts     — WebSocket to cloud portal
  src/collector.ts      — System metrics collection
  src/commands.ts       — Command execution
  src/local-api.ts      — Local REST API for dashboard
dashboard/        — Local dashboard (React+Vite+Tailwind)
  src/pages/      — Dashboard, AppsStore, InstalledApps, Storage, Login, Setup, Nodes, Settings, Users
  src/components/ — MiniChart, StatCard, ResourceRow, Layout
  src/lib/api.ts  — Typed API client
  src/types/api.ts — TypeScript interfaces
cloud/            — Cloud portal server (Fastify+WebSocket+SQLite)
  src/routes/     — auth, servers, proxy
  src/agent-pool.ts     — Agent WebSocket pool
  dashboard/      — Cloud dashboard (React+Vite+Tailwind)
    src/pages/    — Login, Register, ServerList, ServerDashboard, Account
```
