# Installation Guide

## System Requirements

### Minimum
| Component | Requirement |
|-----------|-------------|
| CPU | x86_64 processor, 2+ cores |
| RAM | 4 GB (8 GB recommended) |
| Storage | 32 GB SSD/NVMe for OS |
| Network | Ethernet (1 Gbps recommended) |

### Recommended
| Component | Recommendation |
|-----------|---------------|
| CPU | Intel i3/i5 or AMD Ryzen 3/5, 4+ cores |
| RAM | 16-32 GB DDR4/DDR5 |
| OS Drive | 128-256 GB NVMe SSD |
| Data Drives | 2x HDD/SSD (for ZFS mirror) |
| Network | 2.5 Gbps Ethernet |

### Supported Hardware
- Intel NUC, Mini PCs (Beelink, MinisForum, etc.)
- Dell OptiPlex, HP ProDesk micro desktops
- Custom-built servers
- Any x86_64 machine that runs Proxmox VE 7+ or 8+

---

## Option A: Install Script (Existing Proxmox)

If you already have Proxmox VE installed, run:

```bash
curl -fsSL https://proxnest.com/install.sh | bash
```

This will:
1. Install the ProxNest agent daemon
2. Set up the local dashboard
3. Configure networking and storage detection
4. Register with the cloud portal (optional)

The script is idempotent — safe to run multiple times.

---

## Option B: Fresh Install from ISO

### 1. Download the ISO

Download the latest ProxNest ISO from:
- **[GitHub Releases](https://github.com/proxnest-os/proxnest/releases/download/v0.4.0/proxnest-0.4.0.iso)** (1.5 GB)

### 2. Flash to USB Drive

You'll need a USB drive (8 GB+). Use any of these tools:

**balenaEtcher (Recommended — All platforms)**
1. Download [balenaEtcher](https://etcher.balena.io/)
2. Select the ProxNest ISO
3. Select your USB drive
4. Click "Flash!"

**Rufus (Windows)**
1. Download [Rufus](https://rufus.ie/)
2. Select the ISO, choose "DD Image" mode
3. Click Start

**dd (Linux/macOS)**
```bash
# Find your USB device (e.g., /dev/sdb or /dev/disk2)
lsblk  # Linux
diskutil list  # macOS

# Flash (replace /dev/sdX with your device)
sudo dd if=proxnest-0.4.0.iso of=/dev/sdX bs=4M status=progress
sync
```

> ⚠️ **Warning:** This will erase all data on the USB drive. Double-check the device path.

### 3. Boot and Install

1. Insert the USB drive into your server
2. Boot from USB (press F2/F12/Del during POST for boot menu)
3. Select "Install ProxNest"
4. Follow the on-screen wizard:
   - Accept the license agreement
   - Select the target disk for installation
   - Set root password
   - Configure network (DHCP or static IP)
   - Set timezone
5. Wait for installation to complete (~5 minutes)
6. Remove USB and reboot

### 4. First-Time Setup Wizard

After the first boot, open your browser and navigate to:

```
https://<your-server-ip>:3000
```

The setup wizard will guide you through:

1. **Create Admin Account** — Set your username and password
2. **Storage Setup** — Detect disks and assign roles
3. **Network Config** — Set hostname, configure DNS
4. **App Recommendations** — Install your first apps based on your use case
5. **Cloud Dashboard** (Optional) — Link to cloud.proxnest.com for remote access

---

## Connecting to Cloud Dashboard

The cloud dashboard at [cloud.proxnest.com](https://cloud.proxnest.com) lets you manage your server remotely.

1. Create an account at [cloud.proxnest.com/register](https://cloud.proxnest.com/register)
2. In the cloud dashboard, click "Add Server"
3. Copy the registration command shown
4. Run it on your ProxNest server via SSH or web terminal
5. Your server will appear in the cloud dashboard within 30 seconds

The cloud dashboard is 100% optional. Everything works locally without it.

---

## Post-Install

After installation, we recommend:

1. **Update the system:** Dashboard → System → Check for Updates
2. **Set up storage:** Dashboard → Storage → Storage Wizard
3. **Install your first app:** Dashboard → App Store → Pick a stack or individual app
4. **Join Discord:** [discord.gg/b4NGUMYU34](https://discord.gg/b4NGUMYU34) for community support

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't access dashboard | Check firewall, ensure port 3000 is open |
| USB won't boot | Try different USB port, use DD mode in Rufus |
| Network not detected | Use wired Ethernet, check cable connection |
| Slow installation | Normal for HDDs — SSD recommended for OS drive |

Need help? [Join our Discord](https://discord.gg/b4NGUMYU34) or [open an issue](https://github.com/proxnest-os/proxnest/issues).
