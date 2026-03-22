/**
 * ProxNest Agent — Storage Wizard
 * Detect disks, partitions, mount points. Let users configure storage for apps.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

export interface DiskInfo {
  name: string;        // sda, sdb, nvme0n1
  path: string;        // /dev/sda
  model: string;
  serial: string;
  size: number;        // bytes
  sizeHuman: string;   // "1.8 TB"
  type: 'disk' | 'part' | 'lvm' | 'zfs';
  fstype: string | null;
  mountpoint: string | null;
  label: string | null;
  children?: DiskInfo[];
  inUse: boolean;      // has mountpoint or is OS disk
  isOsDisk: boolean;
}

export interface StoragePool {
  id: string;
  name: string;
  type: 'mount' | 'zfs' | 'lvm';
  path: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  totalHuman: string;
  usedHuman: string;
  freeHuman: string;
  percentUsed: number;
  assignedRoles: string[]; // 'media', 'downloads', 'backups', 'apps'
}

export interface StorageConfig {
  pools: Record<string, {
    path: string;
    roles: string[];
  }>;
  // Derived paths based on roles
  mediaDirs: {
    movies: string;
    tv: string;
    music: string;
    books: string;
    audiobooks: string;
    photos: string;
  };
  downloadDirs: {
    complete: string;
    incomplete: string;
  };
  backupDir: string;
  appDataDir: string;
}

const STATE_FILE = '/opt/proxnest-apps/.storage-config.json';
const ROLES = ['media', 'downloads', 'backups', 'apps'] as const;

function humanSize(bytes: number): string {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${bytes} B`;
}

function run(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 15000 }).trim();
  } catch { return ''; }
}

/**
 * Detect all disks, partitions, and storage devices.
 */
export function detectDisks(): DiskInfo[] {
  const raw = run('lsblk -J -b -o NAME,PATH,MODEL,SERIAL,SIZE,TYPE,FSTYPE,MOUNTPOINT,LABEL 2>/dev/null');
  if (!raw) return [];

  try {
    const data = JSON.parse(raw);
    const osDisk = getOsDisk();

    function mapDevice(dev: any, parentIsOs = false): DiskInfo {
      const isOs = parentIsOs || dev.path === osDisk || dev.mountpoint === '/' || dev.mountpoint === '/boot/efi';
      return {
        name: dev.name,
        path: dev.path || `/dev/${dev.name}`,
        model: (dev.model || '').trim(),
        serial: (dev.serial || '').trim(),
        size: dev.size || 0,
        sizeHuman: humanSize(dev.size || 0),
        type: dev.type === 'part' ? 'part' : dev.type === 'lvm' ? 'lvm' : 'disk',
        fstype: dev.fstype || null,
        mountpoint: dev.mountpoint || null,
        label: dev.label || null,
        children: dev.children?.map((c: any) => mapDevice(c, isOs)),
        inUse: !!(dev.mountpoint),
        isOsDisk: isOs,
      };
    }

    return (data.blockdevices || [])
      .filter((d: any) => d.type === 'disk')
      .map((d: any) => mapDevice(d));
  } catch { return []; }
}

/**
 * Get the disk that contains the OS (root filesystem).
 */
function getOsDisk(): string {
  const rootDev = run("findmnt -n -o SOURCE / 2>/dev/null");
  if (!rootDev) return '';
  // Resolve to parent disk: /dev/sda1 → /dev/sda, /dev/mapper/... → resolve
  const parent = run(`lsblk -n -o PKNAME ${rootDev} 2>/dev/null`);
  return parent ? `/dev/${parent}` : rootDev;
}

/**
 * Detect ZFS pools.
 */
export function detectZfsPools(): StoragePool[] {
  const pools: StoragePool[] = [];
  const zpoolList = run("zpool list -H -o name,size,alloc,free 2>/dev/null");
  if (!zpoolList) return pools;

  for (const line of zpoolList.split('\n')) {
    const [name, size, alloc, free] = line.split('\t');
    if (!name) continue;

    const mountpoint = run(`zfs get -H -o value mountpoint ${name} 2>/dev/null`) || `/${name}`;

    // Parse sizes (e.g., "1.82T", "500G")
    const parseSize = (s: string): number => {
      const match = s.match(/([\d.]+)([TGMK]?)/i);
      if (!match) return 0;
      const val = parseFloat(match[1]);
      const unit = (match[2] || '').toUpperCase();
      if (unit === 'T') return val * 1e12;
      if (unit === 'G') return val * 1e9;
      if (unit === 'M') return val * 1e6;
      if (unit === 'K') return val * 1e3;
      return val;
    };

    const totalBytes = parseSize(size);
    const usedBytes = parseSize(alloc);
    const freeBytes = parseSize(free);

    pools.push({
      id: `zfs-${name}`,
      name,
      type: 'zfs',
      path: mountpoint,
      totalBytes, usedBytes, freeBytes,
      totalHuman: humanSize(totalBytes),
      usedHuman: humanSize(usedBytes),
      freeHuman: humanSize(freeBytes),
      percentUsed: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0,
      assignedRoles: [],
    });
  }
  return pools;
}

/**
 * Detect existing mount points that could be storage.
 */
export function detectMountPoints(): StoragePool[] {
  const pools: StoragePool[] = [];
  const mounts = run("df -B1 --output=source,target,size,used,avail -x tmpfs -x devtmpfs -x squashfs -x overlay 2>/dev/null");
  if (!mounts) return pools;

  const lines = mounts.split('\n').slice(1); // skip header
  const skipPaths = ['/', '/boot', '/boot/efi', '/snap'];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    const [source, target, size, used, avail] = parts;
    if (skipPaths.includes(target) || target.startsWith('/boot')) continue;
    if (source.startsWith('tmpfs') || source.startsWith('/dev/loop')) continue;

    const totalBytes = parseInt(size) || 0;
    const usedBytes = parseInt(used) || 0;
    const freeBytes = parseInt(avail) || 0;

    pools.push({
      id: `mount-${target.replace(/\//g, '-').replace(/^-/, '')}`,
      name: target,
      type: 'mount',
      path: target,
      totalBytes, usedBytes, freeBytes,
      totalHuman: humanSize(totalBytes),
      usedHuman: humanSize(usedBytes),
      freeHuman: humanSize(freeBytes),
      percentUsed: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0,
      assignedRoles: [],
    });
  }
  return pools;
}

/**
 * Get all available storage pools.
 */
export function getAllPools(): StoragePool[] {
  const zfs = detectZfsPools();
  const mounts = detectMountPoints();

  // Deduplicate: prefer ZFS entries over mount entries for same path
  const zfsPaths = new Set(zfs.map(p => p.path));
  const filtered = mounts.filter(m => !zfsPaths.has(m.path));

  const all = [...zfs, ...filtered];

  // Load saved config and annotate roles
  const config = loadConfig();
  if (config) {
    for (const pool of all) {
      const savedPool = Object.entries(config.pools).find(([, v]) => v.path === pool.path);
      if (savedPool) {
        pool.assignedRoles = savedPool[1].roles;
      }
    }
  }

  return all;
}

/**
 * Format a disk with ext4 and optional label.
 */
export function formatDisk(devicePath: string, label?: string): { success: boolean; error?: string } {
  // Safety: never format the OS disk
  const osDisk = getOsDisk();
  if (devicePath === osDisk || devicePath.startsWith(osDisk)) {
    return { success: false, error: 'Cannot format the OS disk!' };
  }

  // Check it's not mounted
  const mounted = run(`findmnt -n ${devicePath} 2>/dev/null`);
  if (mounted) {
    return { success: false, error: `${devicePath} is currently mounted. Unmount first.` };
  }

  try {
    const labelFlag = label ? `-L "${label}"` : '';
    execSync(`mkfs.ext4 -F ${labelFlag} ${devicePath}`, { timeout: 120000 });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Mount a device to a path and add to fstab.
 */
export function mountDevice(devicePath: string, mountPath: string): { success: boolean; error?: string } {
  try {
    mkdirSync(mountPath, { recursive: true });

    // Get UUID for fstab
    const uuid = run(`blkid -s UUID -o value ${devicePath} 2>/dev/null`);
    const fstype = run(`blkid -s TYPE -o value ${devicePath} 2>/dev/null`) || 'ext4';

    // Mount
    execSync(`mount ${devicePath} ${mountPath}`, { timeout: 10000 });

    // Add to fstab if not already there
    if (uuid) {
      const fstab = readFileSync('/etc/fstab', 'utf-8');
      if (!fstab.includes(uuid)) {
        const entry = `UUID=${uuid}  ${mountPath}  ${fstype}  defaults,nofail  0  2\n`;
        writeFileSync('/etc/fstab', fstab + entry);
      }
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Assign roles to a storage pool and generate directory structure.
 */
export function assignRoles(poolPath: string, roles: string[]): { success: boolean; config: StorageConfig | null; error?: string } {
  const validRoles = roles.filter(r => (ROLES as readonly string[]).includes(r));
  if (validRoles.length === 0) {
    return { success: false, config: null, error: `Invalid roles. Valid: ${ROLES.join(', ')}` };
  }

  // Load or create config
  let config = loadConfig() || {
    pools: {},
    mediaDirs: { movies: '', tv: '', music: '', books: '', audiobooks: '', photos: '' },
    downloadDirs: { complete: '', incomplete: '' },
    backupDir: '',
    appDataDir: '',
  };

  // Update pool assignment
  const poolId = poolPath.replace(/\//g, '-').replace(/^-/, '');
  config.pools[poolId] = { path: poolPath, roles: validRoles };

  // Create directories based on roles
  try {
    if (validRoles.includes('media')) {
      const mediaBase = `${poolPath}/media`;
      for (const sub of ['movies', 'tv', 'music', 'books', 'audiobooks', 'photos']) {
        mkdirSync(`${mediaBase}/${sub}`, { recursive: true });
        (config.mediaDirs as any)[sub] = `${mediaBase}/${sub}`;
      }
    }
    if (validRoles.includes('downloads')) {
      const dlBase = `${poolPath}/downloads`;
      mkdirSync(`${dlBase}/complete`, { recursive: true });
      mkdirSync(`${dlBase}/incomplete`, { recursive: true });
      config.downloadDirs = { complete: `${dlBase}/complete`, incomplete: `${dlBase}/incomplete` };
    }
    if (validRoles.includes('backups')) {
      const backupDir = `${poolPath}/backups`;
      mkdirSync(backupDir, { recursive: true });
      config.backupDir = backupDir;
    }
    if (validRoles.includes('apps')) {
      const appDir = `${poolPath}/appdata`;
      mkdirSync(appDir, { recursive: true });
      config.appDataDir = appDir;
    }

    // Also create symlinks at /data for app compatibility
    mkdirSync('/data', { recursive: true });
    if (validRoles.includes('media') && config.mediaDirs.movies) {
      const mediaBase = `${poolPath}/media`;
      trySymlink(mediaBase, '/data/media');
    }
    if (validRoles.includes('downloads') && config.downloadDirs.complete) {
      const dlBase = `${poolPath}/downloads`;
      trySymlink(dlBase, '/data/downloads');
    }

    saveConfig(config);
    return { success: true, config };
  } catch (err) {
    return { success: false, config: null, error: err instanceof Error ? err.message : String(err) };
  }
}

function trySymlink(target: string, linkPath: string): void {
  try {
    const { lstatSync, symlinkSync, unlinkSync } = require('node:fs');
    try {
      const stat = lstatSync(linkPath);
      if (stat.isSymbolicLink()) unlinkSync(linkPath);
      else return; // Don't overwrite real directories
    } catch { /* doesn't exist, good */ }
    symlinkSync(target, linkPath);
  } catch { /* best effort */ }
}

/**
 * Load saved storage config.
 */
export function loadConfig(): StorageConfig | null {
  try {
    if (!existsSync(STATE_FILE)) return null;
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  } catch { return null; }
}

/**
 * Save storage config.
 */
function saveConfig(config: StorageConfig): void {
  try {
    mkdirSync('/opt/proxnest-apps', { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(config, null, 2));
  } catch { /* best effort */ }
}
