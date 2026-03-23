---
title: "Home server setup guide for beginners (2026)"
date: 2026-03-23
description: "Everything you need to know to build your first home server in 2026. Hardware, OS, apps, storage, and remote access."
tags: ["home server", "beginner", "self-hosted", "proxmox", "plex", "guide"]
---

# Home server setup guide for beginners (2026)

So you want to run your own server at home. Maybe you're tired of paying for cloud storage. Maybe you want to stream your own media. Maybe you just think it's cool. All valid reasons.

This guide covers everything from picking hardware to accessing your server remotely. No prior experience needed. Just a willingness to learn and a free weekend.

## What hardware to buy

You don't need a rack-mounted server. A mini PC works great for most people, and it's quiet enough to sit on a shelf in your living room.

**Best starter hardware in 2026:**

- **Intel N100 mini PCs** ($130-180). Four cores, low power draw (15W), Quick Sync for hardware transcoding. The Beelink EQ12 and ACEMAGIC S1 are popular picks. Perfect for 2-3 Plex streams and a handful of services.
- **Intel N305 mini PCs** ($200-280). Eight cores. More headroom if you plan to run a lot of stuff. The Beelink EQR6 is solid.
- **Used office PCs** ($80-150 on eBay). Dell OptiPlex, HP EliteDesk, Lenovo ThinkCentre. i5 or i7 from 8th gen or newer. Great value if you don't mind the size.
- **Older gaming PCs.** If you have one sitting around, it's probably overkill for a server. Which is fine.

**RAM:** 16GB minimum. 32GB if your budget allows. RAM is what limits how many services you can run. You'll hit RAM walls before CPU walls.

**Storage:**
- One SSD for the OS. 128GB is enough but 256GB gives you breathing room.
- One or more larger drives for data. Old HDDs work fine for media. 4-8TB drives are the sweet spot for price per TB right now.
- Don't use USB drives for anything permanent. They disconnect, they fail, they're slow. Internal SATA or NVMe only.

## Picking an OS

This is where people spend way too long deciding. Here's the honest breakdown.

**Proxmox VE** (free). The power user choice. Runs VMs and containers. Steep learning curve but incredible flexibility. If you want to run lots of services and learn how infrastructure actually works, this is the one. Biggest community for home lab stuff.

**TrueNAS SCALE** (free). Best for pure NAS use. Amazing ZFS management. Good if your main goal is file storage with a few apps. Not great if you want to run 15 different services.

**Unraid** ($59+). User-friendly. Mixed drive sizes in one pool (unique feature). Good app store via Docker. Costs money but saves time. Popular with people who want things to just work. Parity protection means you can lose a drive and keep your data, even with mismatched drives.

**OpenMediaVault** (free). Debian-based, simpler than Proxmox, focused on NAS features. Good middle ground if Proxmox feels like too much and TrueNAS is too opinionated.

**[ProxNest](https://proxnest.com)** (built on Proxmox). If you like the idea of Proxmox but the UI intimidates you, ProxNest adds a friendlier management layer on top. One-click app deployments, simplified storage config. You still get full Proxmox underneath.

My suggestion for beginners: Unraid if you want easy, Proxmox if you want to learn. Both are good choices.

## Essential apps to run

Once your OS is installed, here's what most people set up first.

### Media server

**Plex** or **Jellyfin**. Plex has the better client apps and a slicker UI. Some features need a Plex Pass ($5/month or $120 lifetime). Jellyfin is fully free and open source. Slightly rougher around the edges but getting better fast.

Pick one and stick with it. They both do the same thing: stream your movies and TV shows to any device.

### The *arr stack

This is the automation suite for media management:

- **Sonarr** for TV shows
- **Radarr** for movies
- **Prowlarr** for indexer management
- **Bazarr** for subtitles

These apps monitor for new releases, grab them from your preferred sources, rename files properly, and organize them into folders that Plex/Jellyfin can scan. Once configured, you add a show and it just appears in your library.

Setting up the *arr stack is a rite of passage. It takes an evening. You'll mess up the folder structure at least once. That's normal.

### File sync and cloud replacement

**Nextcloud** is the go-to. It's like Google Drive but you own it. File sync, calendar, contacts, photo backup, document editing. It can replace a lot of cloud services.

Fair warning: Nextcloud is powerful but maintenance-heavy. Updates sometimes break things. The mobile apps are decent, not great. If you just want file sync, **Syncthing** is simpler and more reliable.

### DNS and ad blocking

**Pi-hole** or **AdGuard Home**. These act as your network's DNS server and block ads at the DNS level. Every device on your network gets ad blocking without installing anything on each device.

AdGuard Home is slightly easier to set up. Pi-hole has a bigger community. Both work well.

### Other popular picks

- **Home Assistant** for smart home automation (runs great in a VM)
- **Vaultwarden** for self-hosted password management (Bitwarden compatible)
- **Uptime Kuma** for monitoring your services
- **Nginx Proxy Manager** for reverse proxy with easy SSL
- **Portainer** if you're running Docker and want a management UI

## Storage basics

This is the part people skip and regret later.

**Rule 1: RAID is not a backup.** RAID (or ZFS mirroring) protects against drive failure. It does not protect against accidental deletion, ransomware, or your house flooding. You still need backups.

**Rule 2: ZFS mirror or RAID1 for important data.** Two drives, mirrored. If one dies, you replace it and the data rebuilds. This is the minimum for anything you care about. If your media library took months to build, mirror it.

**Rule 3: Separate OS and data drives.** Keep your operating system on one SSD. Keep your data on separate drives. If you need to reinstall the OS, your data is untouched.

**Rule 4: No USB drives.** I said it already but I'll say it again. USB drives are for transferring files, not for running services or storing libraries. They drop connection randomly, they're slow over USB 3.0 for sustained writes, and they have no SMART monitoring in most cases.

**Rule 5: Start with what you have.** You don't need to buy a 4-bay NAS enclosure on day one. One SSD for the OS and one HDD for data gets you started. Add more drives later when you know what you need.

## Remote access

Your server is on your home network. How do you access it when you're not home?

**Option 1: Tailscale** (easiest). Install Tailscale on your server and your devices. They connect over a WireGuard VPN tunnel. No port forwarding needed. Free for personal use. Takes about 5 minutes to set up. This is what I recommend for beginners.

**Option 2: WireGuard** (more control). Run your own VPN server. Faster than Tailscale in some cases because there's no coordination server. But you need to forward a port on your router and manage keys yourself.

**Option 3: Cloudflare Tunnels** (for web services). If you want to expose specific services to the internet (like Nextcloud) without opening ports, Cloudflare Tunnels work well. Free tier is generous. You need a domain name pointed at Cloudflare. Good for services you want accessible from a browser.

**What NOT to do:** Don't forward port 443 or 80 directly to your services without a reverse proxy and proper security. Don't expose your Proxmox management interface to the internet. Don't skip authentication.

## Getting started checklist

Here's your weekend project, step by step:

1. **Pick your hardware.** Mini PC, old desktop, whatever you have.
2. **Install your OS.** Download the ISO, flash it to a USB stick with Rufus or balenaEtcher, boot from it, install.
3. **Set a static IP.** Check your router's DHCP settings and either reserve an IP for your server's MAC address or configure a static IP in the OS.
4. **Install your first app.** Start with Plex or Jellyfin. Get something working before you go crazy with 15 services.
5. **Set up storage properly.** Even if it's just one data drive for now. Keep OS and data separate.
6. **Install Tailscale.** Remote access from day one.
7. **Add more services gradually.** Don't try to set up everything in one weekend. You'll burn out.

## It's worth it

Running your own server is one of those projects where the first weekend is rough and then it just quietly works in the background for years. Your media streams. Your files sync. Your ads get blocked.

Start small. Get one thing working. Then add the next thing. Before you know it, you've got a proper home lab running and you're eyeing a second server on eBay.

Welcome to the hobby.
