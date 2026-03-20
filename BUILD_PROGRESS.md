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

## Next Up (priority order)
- [ ] **Cloud Portal backend** — `/cloud/` Fastify server for remote access (auth, server registration, WebSocket proxy)
- [ ] **Cloud Portal frontend** — `/cloud/dashboard/` React app (login, server list, proxied dashboard)
- [ ] **Agent cloud connection** — Update `/agent/src/connection.ts` for cloud.proxnest.com WebSocket
- [ ] **Dashboard polish** — Feature-complete pages (AppStore grid, InstalledApps management, Storage wizard, Dashboard graphs)
