# Backups

ProxNest provides multiple backup layers to protect your data: app config backups, VM/CT snapshots, and full Proxmox backups.

## Backup Manager

### Config Backups
The built-in backup manager backs up all app configurations with one click.

**What gets backed up:**
- Docker volumes and bind mounts
- App configuration files
- Database dumps (for apps with databases)
- Environment variables and settings

**What does NOT get backed up:**
- Media files (movies, TV, music) - these are too large and should be on redundant storage
- Download cache - temporary and replaceable
- Container images - re-downloaded on restore

### a Backup

**Via Dashboard:**
1. Go to **Dashboard → App Store → Backups** section
2. Click **Backup All** to back up all installed apps
3. Or click the backup icon on individual apps

**Via CLI:**
```bash
# Backup all apps
proxnest backup all

# Backup a specific app
proxnest backup app jellyfin

# List all backups
proxnest backup list
```

### Process

1. Go to **Dashboard → App Store → Backups**
2. Find the backup you want to restore
3. Click **Restore**
4. Confirm - the app will be stopped, restored, and restarted

**Via CLI:**
```bash
# List available backups
proxnest backup list

# Restore a specific backup
proxnest backup restore <backup-id>
```

> ⚠️ **Note:** Restoring will overwrite the current app configuration. The app will be stopped during the restore process.

---

## Snapshots

Proxmox snapshots capture the entire state of a VM or container at a point in time.

### Snapshots

1. Go to **Dashboard → Snapshots**
2. Click **Create Snapshot**
3. Select the VM/CT
4. Name your snapshot (e.g., `before-update`)
5. Optionally include RAM state (for VMs)
6. Click Create

### Back

1. Find the snapshot in the list
2. Click **Rollback**
3. Confirm - the VM/CT will revert to the snapshot state

> ⚠️ **Warning:** Rolling back discards all changes made after the snapshot was taken.

### Snapshots
For data on ZFS pools, ProxNest also manages ZFS snapshots:

```bash
# Create a snapshot
zfs snapshot tank/media@before-migration

# List snapshots
zfs list -t snapshot

# Rollback
zfs rollback tank/media@before-migration
```

---

## Full Proxmox Backups

For complete VM/CT backups (including disk data):

1. Go to **Dashboard → Backups**
2. Click **Create Backup**
3. Select VM/CT ID
4. Choose backup storage
5. Select mode:
   - **Snapshot** - No downtime (recommended)
   - **Suspend** - Brief pause for consistency
   - **Stop** - Full stop for guaranteed consistency
6. Choose compression: **ZSTD** (recommended) or LZO
7. Click Create

### Storage
ProxNest supports multiple backup destinations:
- **Local directory** - `/var/lib/vz/dump/`
- **NFS share** - Network storage
- **PBS (Proxmox Backup Server)** - Deduplicated, incremental backups
- **USB drive** - External backup drive

---

## Scheduling

### App Backups
ProxNest can schedule automatic backups:

1. Dashboard → Settings → Backups
2. Enable "Scheduled Backups"
3. Set frequency:
   - **Daily** - Every night at 2:00 AM
   - **Weekly** - Every Sunday at 2:00 AM
   - **Custom** - Set your own cron schedule
4. Set retention: keep last N backups (default: 7)

### Backup Schedule
For VM/CT backups via Proxmox:

1. Dashboard → Backups → Schedule
2. Or configure via Proxmox datacenter → Backup

Example schedule:
```
# Daily backup of all CTs at 1 AM, keep 7 days
0 1 * * * vzdump --all --mode snapshot --compress zstd --maxfiles 7
```

---

## Backup Strategy Recommendations

### (Getting Started)
- Enable automatic app config backups (daily)
- Keep 7 days of retention

### (Recommended)
- Daily app config backups (7-day retention)
- Weekly Proxmox snapshots of VMs/CTs
- Monthly full Proxmox backups to separate storage
- ZFS snapshots on data pools (daily, 14-day retention)

### (3-2-1 Rule)
- **3 copies** of important data
- **2 different storage types** (SSD + HDD, or local + cloud)
- **1 offsite copy** (USB drive rotated offsite, or cloud backup)

```
Local App Backups (daily) → Local HDD
Proxmox Backups (weekly)  → NFS Share
ZFS Snapshots (daily)     → Same pool (fast rollback)
Offsite Backup (monthly)  → USB drive / Cloud (Duplicati/Borgmatic)
```

---

Need backup strategy advice? [Join our Discord](https://discord.gg/b4NGUMYU34) and ask in #help.
