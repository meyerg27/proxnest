# Storage Management

ProxNest makes storage management simple with a guided wizard, visual disk management, and ZFS integration.

## Storage Wizard

The Storage Wizard detects all connected disks and guides you through setting up your storage.

### the Wizard
1. Go to **Dashboard → Storage**
2. Click **Storage Wizard** (or it launches automatically on first boot)

### Steps
1. **Disk Detection** - ProxNest scans for all connected drives (SATA, NVMe, USB)
2. **Disk Selection** - Choose which disks to use and their roles
3. **Pool Creation** - Create storage pools (ZFS, ext4, or use existing)
4. **Role Assignment** - Assign roles like media, downloads, backups, apps
5. **Verification** - Review and confirm your configuration

---

## Disk Roles

ProxNest uses role-based storage to organize your data:

| Role | Purpose | Recommended Drive |
|------|---------|-------------------|
| **OS** | Operating system and ProxNest agent | NVMe/SSD, 128-256 GB |
| **Apps** | App data, configs, databases | SSD, 256 GB+ |
| **Media** | Movies, TV, music, photos | HDD, 2 TB+ |
| **Downloads** | Temporary download storage | HDD/SSD, 500 GB+ |
| **Backups** | Backup storage for configs and data | HDD, 1 TB+ |

### Directory Structure
```
/data/
├── media/
│   ├── movies/         → Radarr, Jellyfin
│   ├── tv/             → Sonarr, Jellyfin
│   ├── music/          → Lidarr, Navidrome
│   ├── books/          → Readarr, Calibre-Web
│   ├── photos/         → Immich, PhotoPrism
│   └── audiobooks/     → Audiobookshelf
├── downloads/
│   ├── complete/       → Finished downloads
│   └── incomplete/     → In-progress downloads
├── backups/
│   ├── app-configs/    → App configuration backups
│   └── snapshots/      → VM/CT snapshots
└── apps/
    └── [app-name]/     → App-specific data
```

---

## ZFS Basics

ProxNest uses ZFS as the default filesystem for data drives. Here's what you need to know:

### ZFS?
- **Data integrity** - Checksums detect and correct bit rot
- **Snapshots** - Instant, zero-cost snapshots for backups
- **Compression** - Transparent LZ4 compression saves space
- **RAID** - Built-in redundancy (mirror, RAIDZ1/2/3)

### Types

| Type | Drives | Redundancy | Usable Space | Best For |
|------|--------|------------|--------------|----------|
| **Single** | 1 | None | 100% | Testing only |
| **Mirror** | 2+ | Can lose 1 drive | 50% | Best for most users |
| **RAIDZ1** | 3+ | Can lose 1 drive | N-1 drives | Good capacity/safety balance |
| **RAIDZ2** | 4+ | Can lose 2 drives | N-2 drives | Critical data |
| **RAIDZ3** | 5+ | Can lose 3 drives | N-3 drives | Enterprise/paranoid |

### Commands (via Web Terminal)
```bash
# List pools
zpool list

# Pool status and health
zpool status

# Create a mirror pool
zpool create mypool mirror /dev/sdb /dev/sdc

# Create a RAIDZ1 pool
zpool create mypool raidz1 /dev/sdb /dev/sdc /dev/sdd

# Create a ZFS dataset
zfs create mypool/media

# Enable compression
zfs set compression=lz4 mypool

# List datasets
zfs list

# Create a snapshot
zfs snapshot mypool/media@backup-2026-03-23

# List snapshots
zfs list -t snapshot
```

---

## Recommended Layouts

### Build (1-2 drives)
```
Drive 1 (SSD): OS + Apps
Drive 2 (HDD): Media + Downloads + Backups (single ZFS)
```

### Build (3-4 drives)
```
Drive 1 (NVMe/SSD): OS + Apps
Drive 2-3 (HDD, ZFS mirror): Media
Drive 4 (HDD): Downloads + Backups
```

### User Build (5+ drives)
```
Drive 1 (NVMe): OS + Apps
Drive 2 (SSD): Downloads (fast I/O)
Drive 3-5 (HDD, RAIDZ1): Media
Drive 6 (HDD): Backups
```

### Redundancy
```
Drive 1-2 (NVMe, ZFS mirror): OS + Apps
Drive 3-6 (HDD, RAIDZ2): Media
Drive 7-8 (HDD, ZFS mirror): Backups
```

---

## Tips

- **Always use ZFS mirror or RAIDZ** for important data - single-drive pools have no redundancy
- **Enable compression** (LZ4) - it's almost free and saves 10-30% space
- **Don't fill pools past 80%** - ZFS performance degrades significantly
- **Use SSDs for apps** - databases and app configs benefit hugely from SSD speed
- **Regular scrubs** - ProxNest schedules weekly ZFS scrubs automatically
- **SMART monitoring** - Dashboard shows drive health; replace drives showing warnings

---

Need help planning your storage? [Join our Discord](https://discord.gg/b4NGUMYU34) and share your hardware specs.
