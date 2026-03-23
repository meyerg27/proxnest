---
title: "How to set up a Plex server on Proxmox (the easy way)"
date: 2026-03-23
description: "Run Plex on Proxmox without the headache. LXC containers, storage passthrough, and a shortcut that saves you hours of config."
tags: ["plex", "proxmox", "media server", "home server", "self-hosted"]
---

# How to set up a Plex server on Proxmox (the easy way)

Proxmox is one of the best platforms for running a home media server. Full stop.

You get LXC containers that barely use any RAM. You get ZFS for your storage so your movie collection doesn't vanish when a drive dies. You get snapshots so you can roll back when you break something at 2 AM. And it's free.

But getting Plex actually running on Proxmox? That's where people get stuck.

## Why Proxmox for a media server

If you just want Plex and nothing else, sure, install Ubuntu on bare metal and call it a day. But most people don't stop at Plex. You want Sonarr. Radarr. Prowlarr. Maybe Jellyfin as a backup. A download client. Tautulli for stats.

Proxmox lets you run all of that in isolated containers. Each service gets its own little box. If Sonarr breaks, Plex keeps streaming. If you want to nuke your download client and start over, everything else stays untouched.

Plus, ZFS. If you have two drives, you can mirror them and stop worrying about losing your 4TB library to a dead disk. Proxmox makes ZFS setup pretty straightforward.

## The hard way (and why it sucks)

Here's what setting up Plex on Proxmox normally looks like:

1. Create an LXC container. Pick the right template. Debian? Ubuntu? Does it matter? (Sometimes.)
2. Figure out if you want privileged or unprivileged. Unprivileged is more secure but storage passthrough gets weird.
3. Mount your media storage into the container. This means editing config files on the host. `mp0: /tank/media,mp=/media` and hope you got the syntax right.
4. Fix permissions. Your Plex user inside the container can't read the files. `chown` everything. Maybe mess with `idmap`. Spend 30 minutes on a forum thread from 2019.
5. Install Plex. Add the repo, import the GPG key, apt install. Fine, this part is easy.
6. Open port 32400. Configure the firewall if you have one. Set up the claim token.
7. Realize hardware transcoding isn't working. Pass through `/dev/dri`. Add `lxc.cgroup2.devices.allow` lines. Restart. Still broken. Google more.
8. Finally get it working. Forget what you did. Pray you never have to do it again.

I've done this dance. Multiple times. It works, but it's not fun. And every guide you find online is slightly different because Proxmox versions keep changing the config format.

## The easy way

[ProxNest](https://proxnest.com) handles all of this for you.

I'm not saying that because I'm lazy. I'm saying it because I've wasted enough weekends on storage passthrough permissions. ProxNest is a web UI that sits on top of Proxmox and gives you one-click app deployments. Media server stack is one of the built-in options.

Here's what it actually does when you click "deploy media server":

- Creates an LXC container with the right specs (not too much RAM, not too little)
- Configures storage mounts automatically based on your Proxmox storage pools
- Sets up permissions correctly the first time
- Installs Plex with hardware transcoding enabled (if your CPU supports Quick Sync)
- Opens the right ports
- Gives you a working URL to hit

That's it. No config file editing. No permission debugging.

## Step by step with ProxNest

**1. Install ProxNest on your Proxmox host**

One command. It runs as a lightweight service alongside Proxmox. Doesn't replace anything, doesn't touch your existing VMs or containers.

**2. Open the ProxNest dashboard**

It runs on port 3000 by default. You'll see your Proxmox node, storage pools, and existing containers.

**3. Click "New Stack" and pick Media Server**

You'll get Plex pre-configured. Want to add Sonarr, Radarr, and a download client? Toggle them on. They'll each get their own container with shared media storage.

**4. Pick your storage pool**

ProxNest sees your ZFS pools, LVM, whatever you have. Select where your media lives. It handles the mount points.

**5. Deploy**

Takes a couple minutes. You'll get links to each service when it's done. Plex will be waiting at `http://your-ip:32400/web`.

**6. Claim your Plex server**

Log into Plex, point it at your media folders, and start scanning. The folders are already mapped. You just pick them in the Plex UI.

## Hardware transcoding

Quick note on this because it trips people up. If you have an Intel CPU from the last ~8 years, it has Quick Sync. That means Plex can transcode video without murdering your CPU.

ProxNest passes through `/dev/dri` automatically when it detects an Intel iGPU. You still need a Plex Pass for hardware transcoding (that's a Plex limitation, not a Proxmox one), but the actual GPU passthrough is handled.

If you're on AMD, you're stuck with software transcoding for now. It works fine for 1-2 streams on a modern CPU. Just don't expect to handle 5 4K transcodes on a Celeron.

## Worth it?

Look, you can absolutely set up Plex on Proxmox by hand. Plenty of people do. If you enjoy the process and want to learn how LXC config files work, go for it. You'll learn a lot.

But if you just want Plex running tonight so you can watch your stuff, [ProxNest](https://proxnest.com) gets you there without the detours. It's built specifically for Proxmox, so it's not fighting the system. It's just automating what you'd do manually.

Either way, Proxmox is a great choice for a media server. The isolation, ZFS support, and low overhead make it hard to beat. How you get there is up to you.
