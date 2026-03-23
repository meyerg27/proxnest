# Frequently Asked Questions

## General

### is ProxNest?
ProxNest is a home server operating system built on Proxmox VE. It adds a web dashboard, one-click app installs, guided storage management, and an optional cloud portal for remote access. 

### ProxNest free?
Yes! The core is completely free and open source (AGPLv3). The **Pro** tier ($5/month or $50/year) adds cloud remote access, multi-user support, update management, and priority support.

### the difference between ProxNest and Unraid/TrueNAS/Hexos?
| | ProxNest | TrueNAS | OMV | Unraid |
|---|---------|---------|-----|--------|
| Price | Free / $5/mo Pro | Free | Free | $60-130 |
| Focus | Apps + VMs | ZFS storage | Simple NAS | Storage + Docker |
| VMs | Full KVM | Via bhyve | No | Basic KVM |
| Containers | Docker + LXC | Docker | Docker | Docker |
| ZFS | Native (Proxmox) | Excellent | Plugin | Plugin |
| App auto-config | Yes | No | No | No |
| Open Source | Yes | Yes | Yes | No |

### I need the cloud dashboard?
No. Everything works 100% locally. The cloud dashboard (cloud.proxnest.com) is purely optional - it's for remote access when you're away from home.

### hardware do I need?
Minimum: Any x86_64 machine with 4 GB RAM and 32 GB storage. Recommended: Intel NUC or mini PC with 16+ GB RAM, NVMe SSD, and data drives.

---

## Installation

### I install ProxNest on existing Proxmox?
Yes! Run: `curl -fsSL https://proxnest.com/install.sh | bash`

### installing ProxNest erase my data?
- **Install script (existing Proxmox):** No, it adds ProxNest alongside your existing setup.
- **ISO install (fresh):** Yes, it formats the target drive. Back up first.

### I dual-boot with Windows/Linux?
No, ProxNest is designed as a dedicated server OS. However, you can run Windows or Linux as a virtual machine inside ProxNest.

### server doesn't boot from USB. What do I do?
1. Check BIOS boot order - set USB as first boot device
2. Try a different USB port (USB 2.0 ports are more compatible)
3. Try re-flashing with balenaEtcher in DD mode
4. Some machines require "Legacy Boot" instead of UEFI

---

## Apps

### many apps can I install?
As many as your hardware can handle. The Free tier has no artificial limits.

### I install apps not in the App Store?
Yes! ProxNest runs on Proxmox VE with full Docker support. You can install any Docker container or LXC template manually.

### does auto-wiring work?
When you install related apps (e.g., Radarr + qBittorrent), ProxNest automatically configures them to talk to each other. Radarr gets qBittorrent as its download client, Prowlarr syncs indexers, etc.

### app won't start. What do I do?
1. Check app logs: Dashboard → App Store → Click app → View Logs
2. Verify you have enough RAM and disk space
3. Check for port conflicts with other apps
4. Try stopping and restarting the app
5. If all else fails, uninstall and reinstall

### I access apps from outside my network?
Yes, via:
- **Cloudflare Tunnels** (recommended - no port forwarding needed)
- **Tailscale** (private mesh VPN)
- **Reverse proxy + port forwarding** (traditional)

---

## Storage

### I use ZFS or ext4?
- **ZFS** for data drives - data integrity, snapshots, compression, RAID
- **ext4** for simple single-drive setups where you don't need redundancy

### much storage do I need for media?
Rough estimates:
- 1 movie (1080p) ≈ 5-15 GB
- 1 TV season (1080p) ≈ 10-30 GB
- 1,000 songs (FLAC) ≈ 50 GB
- 10,000 photos ≈ 100-200 GB

### I add drives later?
Yes! Plug in a new drive, and the Storage Wizard will detect it. You can expand existing ZFS pools or create new ones.

### RAID a backup?
**No.** RAID/ZFS mirror protects against drive failure, not data loss. You still need backups. Follow the 3-2-1 rule.

---

## Networking

### do I access my server remotely?
Options (from easiest to most control):
1. **ProxNest Cloud Dashboard** - Just link your server
2. **Tailscale** - Install from App Store, works immediately
3. **Cloudflare Tunnels** - No port forwarding needed
4. **WireGuard VPN** - Full network access
5. **Port forwarding + reverse proxy** - Traditional method

### server's IP keeps changing. How do I fix it?
Set a static IP: Dashboard → Settings → Network, or reserve an IP in your router's DHCP settings.

### do I set up a domain name?
1. Buy a domain (Cloudflare, Namecheap, etc.)
2. Point DNS to your server IP (or use Cloudflare Tunnels)
3. Set up Nginx Proxy Manager with SSL
4. Configure proxy hosts for each app

---

## Troubleshooting

### won't load
1. Check if the server is running (try SSH)
2. Try accessing via IP directly: `https://<ip>:3000`
3. Check if the ProxNest service is running: `systemctl status proxnest`
4. Restart the service: `systemctl restart proxnest`

### is using too much RAM
1. Check which apps are running: Dashboard → App Store → Installed
2. Stop apps you're not actively using
3. Consider adding more RAM - 16 GB is recommended

### containers keep restarting
1. Check container logs: `docker logs <container_name>`
2. Check disk space: `df -h`
3. Check memory: `free -h`
4. Verify the app's configuration

### connect to server from local network
1. Check cable connection
2. Ping the server: `ping <server-ip>`
3. Check firewall: Dashboard → Firewall
4. Verify you're on the same subnet

---

## & Account

### do I upgrade to Pro?
1. Go to [cloud.proxnest.com](https://cloud.proxnest.com)
2. Click on your profile → Subscription
3. Select Pro plan
4. Enter payment details

### I cancel anytime?
Yes, cancel anytime from your account page. You keep Pro features until the end of the billing period.

### there a free trial?
The Free tier is permanently free. Pro features have a 14-day free trial.

---

Still have questions? [Join our Discord](https://discord.gg/b4NGUMYU34) and ask in #help!
