# ProxNest — Master Checklist v2

## 🔴 Architecture: Apps as Individual CTs
- [x] CT installer module — creates dedicated LXC per app with Docker inside
- [x] Auto-detect CT template (Debian 12)
- [x] Resource profiles per app (RAM, cores, disk)
- [x] Sequential IP assignment (192.168.50.200+)
- [x] State tracking (.ct-state.json)
- [x] Jellyfin CT 200 — WORKING ✅
- [x] qBittorrent CT 201 — WORKING ✅
- [x] Radarr CT 202 — WORKING ✅
- [ ] Fix DNS timeout on CT installs (Sonarr/Prowlarr/Bazarr failed mid-install)
- [ ] Fix API timeout for CT installs (WebSocket disconnects during long installs)
- [ ] Update stacks.install to use CT mode sequentially
- [ ] apps.list shows CT-based apps with VMID, IP, CPU, RAM
- [ ] apps.uninstall destroys CT properly
- [ ] Update auto-wiring to work across CTs (different IPs per app)

## 🔴 VM Creation & Console
- [ ] Create VM from ISO (upload ISO or select from storage)
- [ ] Create VM from cloud image (Ubuntu, Debian)
- [ ] VM settings: CPU, RAM, disk, network
- [ ] VM console via xterm.js (already have terminal infrastructure — extend to VMs)
- [ ] VM start/stop/reboot/delete from dashboard
- [ ] VM list with live stats (CPU, RAM, disk, network)
- [ ] CT console for app containers too

## 🔴 More Stacks (tested & verified)
- [ ] **Media Server Stack** — Jellyfin + Radarr + Sonarr + qBit + Prowlarr + Bazarr (re-test as CTs)
- [ ] **Download Stack** — qBit + Radarr + Sonarr + Prowlarr (subset, verify wiring)
- [ ] **Cloud Suite** — Nextcloud + Immich + Vaultwarden (test SSO/sharing)
- [ ] **Home Automation** — Home Assistant + Mosquitto + Node-RED + Zigbee2MQTT
- [ ] **Monitoring Stack** — Grafana + Prometheus + Uptime Kuma + Portainer
- [ ] **Privacy Stack** — Pi-hole + WireGuard + Vaultwarden
- [ ] **Productivity** — Mealie + Paperless-ngx + Calibre-web + Audiobookshelf
- [ ] **Dev Stack** — Gitea + Drone CI + Portainer + VS Code Server
- [ ] Each stack: install test, auto-wire verify, end-to-end smoke test

## 🔴 Dashboard Improvements
- [ ] Apps show as individual CTs with VMID, IP, CPU%, RAM usage bars
- [ ] VM creation wizard (step-by-step: name → OS → resources → network → create)
- [ ] Console modal works for CTs AND VMs (not just host shell)
- [ ] App cards show per-CT resource usage (not just name/status)
- [ ] Stack install progress (live pipeline view: "Creating CT → Installing Docker → Pulling image → Running")
- [ ] Better mobile responsiveness
- [ ] Fix screenshots on landing page (now deployed ✅)

## 🟡 Sync & Integration
- [ ] Auto-wire works across CTs (Radarr at .202 connects to qBit at .201)
- [ ] Shared /data mount works across all CTs (bind mount host /data into each CT)
- [ ] Hardlinks work between download and media CTs
- [ ] VPN routes through dedicated CT or host gluetun

## 🟢 Already Done
- [x] Storage Wizard
- [x] Update Manager
- [x] Backup/Restore
- [x] Notifications + Health Monitoring
- [x] Homepage Auto-Gen
- [x] VPN Upload UI
- [x] Web Terminal (host shell)
- [x] App Guides + Getting Started
- [x] Smart Recommendations
- [x] Landing Page with real screenshots + pricing
- [x] Auto-wiring (Docker mode)
- [x] One-click stacks (Docker mode)
- [x] Post-install guides for 15 apps
