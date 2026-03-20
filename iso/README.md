# ProxNest ISO Builder

Builds a custom Proxmox VE ISO with ProxNest pre-installed.

## How It Works

1. Downloads official Proxmox VE ISO
2. Extracts and mounts it
3. Injects ProxNest post-install hook
4. Rebrands the installer (ProxNest logo, colors)
5. Repacks into `proxnest-x.x.x.iso`
6. User flashes to USB with Balena Etcher / Rufus / `dd`

## The Install Experience

1. Boot from USB
2. ProxNest installer loads (branded, not raw Proxmox)
3. Select target disk for OS
4. Set admin password
5. Installation completes (~5 min)
6. Reboot → ProxNest first-boot wizard launches in browser
7. Setup storage, pick apps, done

## Post-Install Hook

After Proxmox installs, our hook script:
- Installs Node.js 22
- Clones ProxNest from GitHub
- Builds API + Dashboard
- Creates systemd service
- Sets up first-boot wizard trigger
- Disables default Proxmox login page (replaced by ProxNest)
