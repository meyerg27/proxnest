# ProxNest — Reddit Launch Posts

---

## Post 1: r/selfhosted

**Title:** I built a free Proxmox-based NAS OS with one-click app installs and auto-wiring

**Body:**

Hey r/selfhosted — I've been working on something I'm pretty excited about and wanted to share it with you all.

**ProxNest** is a free NAS OS built on top of Proxmox VE that turns any old PC (or new one) into a full media server and NAS in about 5 minutes. Flash the ISO, boot, run through the wizard, and you're done.

**What makes it different:**

- **36 apps, 8 pre-built stacks** — Jellyfin, Sonarr, Radarr, Prowlarr, qBittorrent, Nextcloud, Immich, Home Assistant, Vaultwarden, and way more
- **One-click installs** — pick an app or an entire stack (like "Media Server") and it deploys automatically
- **Auto-wiring** — apps talk to each other out of the box. Install the media server stack and Sonarr already knows about your download client, Jellyfin already sees your media libraries. No manual config needed.
- **Cloud dashboard** at [cloud.proxnest.com](https://cloud.proxnest.com) — manage your server from anywhere, no port forwarding required
- **Built-in VPN support** — WireGuard/Tailscale integration for secure remote access
- **Automated backups** — schedule backups per app or for the whole system
- **Each app runs in its own LXC container** — full resource isolation, one app crashing doesn't take down everything else

**"But what about Hexos?"**

Yeah, I know Hexos exists. I tried it. Here's the thing — it's $200+ for a license, it's heavily cloud-dependent (their servers go down, your NAS management goes with it), and honestly it's been pretty buggy in my experience. ProxNest gives you the same easy NAS experience but it's **free**, runs on **Proxmox** (battle-tested hypervisor), and you actually **own** your infrastructure.

Free tier is fully functional with unlimited apps. Pro is $5/mo if you want the cloud dashboard for remote management — but the local experience is 100% free forever.

Check it out: [proxnest.com](https://proxnest.com)

GitHub: [github.com/meyerg27/proxnest](https://github.com/meyerg27/proxnest)

![ProxNest Dashboard Screenshot](https://proxnest.com/screenshots/dashboard-demo.png)

Would love to hear your feedback — what apps would you want to see added? What's missing? Tear it apart, I can take it. 🙂

---

## Post 2: r/homeserver

**Title:** ProxNest: Free alternative to Hexos — Proxmox under the hood, no subscription needed

**Body:**

I've been building **ProxNest** — a NAS operating system built on Proxmox VE that makes setting up a home server genuinely easy without sacrificing the power users expect.

**The foundation: Proxmox VE**

Under the hood, ProxNest is a full Proxmox installation. That means you get enterprise-grade virtualization, ZFS support, proper resource management, and everything else PVE offers. ProxNest adds a polished web UI on top that handles app deployment, monitoring, and management.

**Architecture:**

- Every app runs in its **own LXC container** with Docker inside — full process and resource isolation
- **Web terminal** access to any container directly from the dashboard
- **VM creation wizard** — need a full VM for something? Create one in a few clicks without touching the Proxmox UI
- **Resource monitoring per container** — see exactly how much CPU, RAM, and storage each app is consuming
- **ZFS integration** — leverage your existing pool, snapshots, and scrubs

**The app ecosystem:**

- 36 apps available: Jellyfin, Plex, Sonarr, Radarr, Prowlarr, qBittorrent, Transmission, Nextcloud, Immich, PhotoPrism, Vaultwarden, Home Assistant, Gitea, Pi-hole, AdGuard Home, Wireguard, and more
- 8 pre-configured stacks (Media Server, Photos, Productivity, Home Automation, etc.)
- Auto-wiring connects apps automatically — no manual API key copying or URL configuration

**vs. Hexos:**

| | ProxNest | Hexos |
|---|---|---|
| Price | Free (Pro $5/mo for cloud) | $200+ license |
| Foundation | Proxmox VE | Custom Linux |
| Cloud dependency | Optional | Required |
| Container isolation | LXC per app | Shared Docker |
| Open source | Yes | No |
| VM support | Full Proxmox VMs | Limited |

**Links:**

- Website: [proxnest.com](https://proxnest.com)
- Cloud dashboard: [cloud.proxnest.com](https://cloud.proxnest.com)
- GitHub: [github.com/meyerg27/proxnest](https://github.com/meyerg27/proxnest)

Happy to answer any technical questions. What would you want to see in a NAS OS?

---

## Post 3: r/Proxmox

**Title:** Built a web UI that turns Proxmox into a NAS OS — auto-installs apps in isolated LXC containers

**Body:**

Fellow Proxmox users — I built **ProxNest**, a layer on top of PVE that turns it into a consumer-friendly NAS OS while keeping all the Proxmox power underneath.

**How it works (architecture):**

1. **ProxNest Agent** — a lightweight service that runs directly on your PVE host. It handles container provisioning, app deployment, networking, and auto-wiring between apps. Communicates with the cloud dashboard via secure websocket tunnel.

2. **LXC containers with Docker inside** — each app gets its own unprivileged CT. Inside that CT, the actual application runs as a Docker container. This gives you double isolation: LXC-level resource limits and namespacing + Docker's app packaging. If Sonarr goes haywire, it can't touch your Jellyfin container.

3. **Auto-wiring via inter-CT API calls** — when you install a stack (e.g., Media Server = Sonarr + Radarr + Prowlarr + qBittorrent + Jellyfin), the agent provisions each CT, then makes API calls between them to configure connections. Sonarr gets told about qBittorrent's address and API key, Jellyfin gets pointed at the shared media mount, Prowlarr pushes indexers to Sonarr/Radarr. All automatic.

4. **Cloud dashboard** at [cloud.proxnest.com](https://cloud.proxnest.com) — optional remote management. The agent opens an outbound tunnel (no port forwarding needed). Dashboard gives you app management, resource monitoring per CT, web terminal, and a VM creation wizard that wraps `qm create` with sane defaults.

5. **Shared storage** — bind mounts from the host into relevant CTs. Media libraries, config directories, and backup locations are managed by the agent so apps see consistent paths.

**What you keep:**

- Full `pveam`, `pct`, `qm` access — it's still your Proxmox box
- ZFS, Ceph, whatever storage you're running
- Cluster support if you're running multiple nodes
- SSH access, API access, everything

**What ProxNest adds:**

- 36 pre-packaged apps, 8 stacks
- One-click deploy with proper resource allocation
- Auto-wiring between apps (no manual config)
- Per-CT monitoring dashboard
- Backup scheduling per app
- Clean web UI for non-technical household members

It's open source: [github.com/meyerg27/proxnest](https://github.com/meyerg27/proxnest)

I built this because I was tired of manually setting up LXC containers and configuring apps to talk to each other every time I rebuilt my server. Would love feedback from people who actually know Proxmox — what am I doing wrong? What would you do differently?
