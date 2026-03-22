/**
 * ProxNest Agent — Backup & Restore Manager
 * Export/import app configs and data volumes.
 */

import { execSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BACKUP_BASE = '/opt/proxnest-apps/backups';

export interface BackupInfo {
  id: string;
  filename: string;
  path: string;
  createdAt: string;
  sizeHuman: string;
  sizeBytes: number;
  apps: string[];
  type: 'full' | 'single';
}

export interface BackupResult {
  success: boolean;
  backup?: BackupInfo;
  error?: string;
}

function run(cmd: string, timeout = 60000): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout }).trim();
  } catch { return ''; }
}

function humanSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
}

/**
 * Backup a single app's config and persistent data.
 */
export function backupApp(appId: string): BackupResult {
  const containerName = `proxnest-${appId}`;

  // Check container exists
  const inspectRaw = run(`docker inspect ${containerName} 2>/dev/null`);
  if (!inspectRaw) {
    return { success: false, error: `App ${appId} not found` };
  }

  let inspect: any;
  try { inspect = JSON.parse(inspectRaw)[0]; } catch {
    return { success: false, error: 'Failed to inspect container' };
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupName = `${appId}-${timestamp}`;
  const backupDir = join(BACKUP_BASE, backupName);

  try {
    mkdirSync(backupDir, { recursive: true });

    // 1. Save container config (image, env, ports, volumes, etc.)
    writeFileSync(join(backupDir, 'container.json'), JSON.stringify(inspect, null, 2));

    // 2. Save volume data
    const binds = inspect.HostConfig?.Binds || [];
    const volumeManifest: Array<{ hostPath: string; containerPath: string; archived: boolean }> = [];

    for (const bind of binds) {
      const [hostPath, containerPath] = (bind as string).split(':');
      if (!hostPath || !containerPath) continue;
      // Skip very large dirs (downloads, media) — those aren't "config"
      if (hostPath.includes('/downloads') || hostPath.includes('/media/')) {
        volumeManifest.push({ hostPath, containerPath, archived: false });
        continue;
      }

      // Archive config volumes
      const dirSize = parseInt(run(`du -sb ${hostPath} 2>/dev/null`).split('\t')[0] || '0');
      if (dirSize > 500 * 1e6) {
        // Skip volumes >500MB — likely data, not config
        volumeManifest.push({ hostPath, containerPath, archived: false });
        continue;
      }

      if (existsSync(hostPath)) {
        const archiveName = hostPath.replace(/\//g, '_').replace(/^_/, '') + '.tar.gz';
        run(`tar czf "${join(backupDir, archiveName)}" -C "${hostPath}" . 2>/dev/null`, 120000);
        volumeManifest.push({ hostPath, containerPath, archived: true });
      } else {
        volumeManifest.push({ hostPath, containerPath, archived: false });
      }
    }

    writeFileSync(join(backupDir, 'volumes.json'), JSON.stringify(volumeManifest, null, 2));

    // 3. Save wire state for this app
    try {
      const wireState = readFileSync('/opt/proxnest-apps/.wire-state.json', 'utf-8');
      const parsed = JSON.parse(wireState);
      const appWire = parsed.endpoints?.[appId];
      if (appWire) {
        writeFileSync(join(backupDir, 'wire-state.json'), JSON.stringify(appWire, null, 2));
      }
    } catch { /* no wire state */ }

    // 4. Create final archive
    const archivePath = join(BACKUP_BASE, `${backupName}.tar.gz`);
    run(`tar czf "${archivePath}" -C "${BACKUP_BASE}" "${backupName}" 2>/dev/null`, 120000);

    // Clean up temp dir
    run(`rm -rf "${backupDir}"`);

    const stat = statSync(archivePath);

    return {
      success: true,
      backup: {
        id: backupName,
        filename: `${backupName}.tar.gz`,
        path: archivePath,
        createdAt: new Date().toISOString(),
        sizeHuman: humanSize(stat.size),
        sizeBytes: stat.size,
        apps: [appId],
        type: 'single',
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Backup all installed apps.
 */
export function backupAll(): BackupResult {
  const containers = run("docker ps --filter 'name=proxnest-' --format '{{.Names}}'");
  if (!containers) return { success: false, error: 'No apps installed' };

  const appIds = containers.split('\n').filter(Boolean).map(n => n.replace('proxnest-', ''));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupName = `full-backup-${timestamp}`;
  const backupDir = join(BACKUP_BASE, backupName);

  try {
    mkdirSync(backupDir, { recursive: true });

    // Backup each app into the dir
    const results: Array<{ appId: string; success: boolean; error?: string }> = [];
    for (const appId of appIds) {
      const result = backupApp(appId);
      if (result.success && result.backup) {
        // Move individual backup into full backup dir
        run(`mv "${result.backup.path}" "${backupDir}/"`);
      }
      results.push({ appId, success: result.success, error: result.error });
    }

    // Save global state files
    for (const stateFile of ['.wire-state.json', '.storage-config.json']) {
      const src = join('/opt/proxnest-apps', stateFile);
      if (existsSync(src)) {
        run(`cp "${src}" "${backupDir}/"`);
      }
    }

    writeFileSync(join(backupDir, 'manifest.json'), JSON.stringify({
      version: 1,
      createdAt: new Date().toISOString(),
      apps: appIds,
      results,
    }, null, 2));

    // Create final archive
    const archivePath = join(BACKUP_BASE, `${backupName}.tar.gz`);
    run(`tar czf "${archivePath}" -C "${BACKUP_BASE}" "${backupName}" 2>/dev/null`, 300000);
    run(`rm -rf "${backupDir}"`);

    const stat = statSync(archivePath);

    return {
      success: true,
      backup: {
        id: backupName,
        filename: `${backupName}.tar.gz`,
        path: archivePath,
        createdAt: new Date().toISOString(),
        sizeHuman: humanSize(stat.size),
        sizeBytes: stat.size,
        apps: appIds,
        type: 'full',
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * List available backups.
 */
export function listBackups(): BackupInfo[] {
  try {
    mkdirSync(BACKUP_BASE, { recursive: true });
    const files = readdirSync(BACKUP_BASE).filter(f => f.endsWith('.tar.gz'));

    return files.map(f => {
      const path = join(BACKUP_BASE, f);
      const stat = statSync(path);
      const isFull = f.startsWith('full-backup-');
      const appId = isFull ? 'all' : f.split('-')[0];

      return {
        id: f.replace('.tar.gz', ''),
        filename: f,
        path,
        createdAt: stat.mtime.toISOString(),
        sizeHuman: humanSize(stat.size),
        sizeBytes: stat.size,
        apps: isFull ? [] : [appId],
        type: isFull ? 'full' as const : 'single' as const,
      };
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch { return []; }
}

/**
 * Restore an app from backup.
 */
export function restoreApp(backupId: string): { success: boolean; restored: string[]; error?: string } {
  const archivePath = join(BACKUP_BASE, `${backupId}.tar.gz`);
  if (!existsSync(archivePath)) {
    return { success: false, restored: [], error: 'Backup not found' };
  }

  const tempDir = join(BACKUP_BASE, `restore-${Date.now()}`);

  try {
    mkdirSync(tempDir, { recursive: true });
    run(`tar xzf "${archivePath}" -C "${tempDir}" 2>/dev/null`, 120000);

    // Find container.json
    const containerJson = run(`find "${tempDir}" -name container.json -type f 2>/dev/null`);
    if (!containerJson) {
      run(`rm -rf "${tempDir}"`);
      return { success: false, restored: [], error: 'Invalid backup: no container.json' };
    }

    const containerDir = containerJson.split('/').slice(0, -1).join('/');
    const inspect = JSON.parse(readFileSync(containerJson, 'utf-8'));
    const appId = (inspect.Name || '').replace(/^\/proxnest-/, '');

    // Restore volume data
    const volumesJsonPath = join(containerDir, 'volumes.json');
    if (existsSync(volumesJsonPath)) {
      const volumes = JSON.parse(readFileSync(volumesJsonPath, 'utf-8'));
      for (const vol of volumes) {
        if (!vol.archived) continue;
        const archiveName = vol.hostPath.replace(/\//g, '_').replace(/^_/, '') + '.tar.gz';
        const volArchive = join(containerDir, archiveName);
        if (existsSync(volArchive)) {
          mkdirSync(vol.hostPath, { recursive: true });
          run(`tar xzf "${volArchive}" -C "${vol.hostPath}" 2>/dev/null`, 120000);
        }
      }
    }

    // Restore wire state
    const wireStatePath = join(containerDir, 'wire-state.json');
    if (existsSync(wireStatePath)) {
      try {
        const globalWire = existsSync('/opt/proxnest-apps/.wire-state.json')
          ? JSON.parse(readFileSync('/opt/proxnest-apps/.wire-state.json', 'utf-8'))
          : { endpoints: {}, wires: [] };
        const appWire = JSON.parse(readFileSync(wireStatePath, 'utf-8'));
        globalWire.endpoints[appId] = appWire;
        writeFileSync('/opt/proxnest-apps/.wire-state.json', JSON.stringify(globalWire, null, 2));
      } catch { /* best effort */ }
    }

    run(`rm -rf "${tempDir}"`);
    return { success: true, restored: [appId] };
  } catch (err) {
    run(`rm -rf "${tempDir}"`);
    return { success: false, restored: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Delete a backup.
 */
export function deleteBackup(backupId: string): { success: boolean; error?: string } {
  const archivePath = join(BACKUP_BASE, `${backupId}.tar.gz`);
  if (!existsSync(archivePath)) {
    return { success: false, error: 'Backup not found' };
  }
  try {
    run(`rm -f "${archivePath}"`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
