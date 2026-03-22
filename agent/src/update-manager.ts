/**
 * ProxNest Agent — App Update Manager
 * Check for newer Docker images, update with automatic config backup.
 */

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';

export interface UpdateCheck {
  appId: string;
  containerName: string;
  currentImage: string;
  currentDigest: string;
  latestDigest: string;
  updateAvailable: boolean;
  error?: string;
}

export interface UpdateResult {
  appId: string;
  success: boolean;
  backedUp: boolean;
  backupPath?: string;
  error?: string;
}

const BACKUP_DIR = '/opt/proxnest-apps/backups';

function run(cmd: string, timeout = 30000): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout }).trim();
  } catch { return ''; }
}

/**
 * Check all ProxNest apps for available updates.
 */
export function checkAllUpdates(): UpdateCheck[] {
  const containers = run("docker ps --filter 'name=proxnest-' --format '{{.Names}}|{{.Image}}'");
  if (!containers) return [];

  const results: UpdateCheck[] = [];

  for (const line of containers.split('\n')) {
    if (!line) continue;
    const [name, image] = line.split('|');
    const appId = name.replace('proxnest-', '');

    try {
      // Get current image digest
      const currentDigest = run(
        `docker inspect --format='{{index .RepoDigests 0}}' ${image} 2>/dev/null`
      ).split('@')[1] || '';

      // Pull latest manifest (doesn't download layers, just checks)
      run(`docker pull ${image} 2>/dev/null`, 60000);
      const latestDigest = run(
        `docker inspect --format='{{index .RepoDigests 0}}' ${image} 2>/dev/null`
      ).split('@')[1] || '';

      results.push({
        appId,
        containerName: name,
        currentImage: image,
        currentDigest: currentDigest.slice(0, 16),
        latestDigest: latestDigest.slice(0, 16),
        updateAvailable: !!(currentDigest && latestDigest && currentDigest !== latestDigest),
      });
    } catch (err) {
      results.push({
        appId,
        containerName: name,
        currentImage: image,
        currentDigest: '',
        latestDigest: '',
        updateAvailable: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

/**
 * Check a single app for updates.
 */
export function checkUpdate(appId: string): UpdateCheck {
  const containerName = `proxnest-${appId}`;
  const image = run(`docker inspect --format='{{.Config.Image}}' ${containerName} 2>/dev/null`);

  if (!image) {
    return { appId, containerName, currentImage: '', currentDigest: '', latestDigest: '', updateAvailable: false, error: 'Container not found' };
  }

  const currentDigest = run(`docker inspect --format='{{index .RepoDigests 0}}' ${image} 2>/dev/null`).split('@')[1] || '';
  run(`docker pull ${image} 2>/dev/null`, 60000);
  const latestDigest = run(`docker inspect --format='{{index .RepoDigests 0}}' ${image} 2>/dev/null`).split('@')[1] || '';

  return {
    appId,
    containerName,
    currentImage: image,
    currentDigest: currentDigest.slice(0, 16),
    latestDigest: latestDigest.slice(0, 16),
    updateAvailable: !!(currentDigest && latestDigest && currentDigest !== latestDigest),
  };
}

/**
 * Update an app: backup config → pull new image → recreate container with same settings.
 */
export function updateApp(appId: string): UpdateResult {
  const containerName = `proxnest-${appId}`;

  // 1. Get current container config
  const inspectRaw = run(`docker inspect ${containerName} 2>/dev/null`);
  if (!inspectRaw) {
    return { appId, success: false, backedUp: false, error: 'Container not found' };
  }

  let inspect: any;
  try { inspect = JSON.parse(inspectRaw)[0]; } catch {
    return { appId, success: false, backedUp: false, error: 'Failed to parse container config' };
  }

  const image = inspect.Config?.Image;
  if (!image) {
    return { appId, success: false, backedUp: false, error: 'No image found' };
  }

  // 2. Backup container config
  let backupPath = '';
  try {
    mkdirSync(BACKUP_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupPath = `${BACKUP_DIR}/${appId}-${timestamp}.json`;
    writeFileSync(backupPath, JSON.stringify(inspect, null, 2));
  } catch {
    // Non-fatal, continue with update
  }

  // 3. Extract container settings for recreation
  const env = (inspect.Config?.Env || []).map((e: string) => `-e "${e}"`).join(' ');
  const ports = Object.entries(inspect.HostConfig?.PortBindings || {}).map(([containerPort, bindings]: [string, any]) => {
    const hostPort = bindings?.[0]?.HostPort;
    if (hostPort) return `-p ${hostPort}:${containerPort.split('/')[0]}`;
    return '';
  }).filter(Boolean).join(' ');

  const volumes = (inspect.HostConfig?.Binds || []).map((b: string) => `-v ${b}`).join(' ');
  const network = inspect.HostConfig?.NetworkMode === 'host' ? '--network host' :
    inspect.HostConfig?.NetworkMode?.startsWith('container:') ? `--network ${inspect.HostConfig.NetworkMode}` : '';
  const restart = inspect.HostConfig?.RestartPolicy?.Name ? `--restart ${inspect.HostConfig.RestartPolicy.Name}` : '--restart unless-stopped';
  const privileged = inspect.HostConfig?.Privileged ? '--privileged' : '';
  const devices = (inspect.HostConfig?.Devices || []).map((d: any) => `--device ${d.PathOnHost}:${d.PathInContainer}`).join(' ');

  // 4. Pull latest image
  const pullResult = run(`docker pull ${image} 2>&1`, 120000);
  if (!pullResult) {
    return { appId, success: false, backedUp: !!backupPath, backupPath, error: 'Failed to pull latest image' };
  }

  // 5. Stop and remove old container
  run(`docker stop ${containerName} 2>/dev/null`, 30000);
  run(`docker rm ${containerName} 2>/dev/null`);

  // 6. Recreate with same settings
  const cmd = `docker run -d --name ${containerName} ${restart} ${privileged} ${network} ${ports} ${volumes} ${env} ${devices} ${image}`;
  const newId = run(cmd, 30000);

  if (!newId) {
    // Rollback: try to restart old container
    run(`docker start ${containerName} 2>/dev/null`);
    return { appId, success: false, backedUp: !!backupPath, backupPath, error: 'Failed to recreate container. Attempted rollback.' };
  }

  // 7. Verify running
  const status = run(`docker inspect --format='{{.State.Status}}' ${containerName} 2>/dev/null`);

  return {
    appId,
    success: status === 'running',
    backedUp: !!backupPath,
    backupPath,
    error: status !== 'running' ? `Container status: ${status}` : undefined,
  };
}

/**
 * Clean up old/unused Docker images to free disk space.
 */
export function pruneImages(): { success: boolean; spaceReclaimed: string } {
  const result = run('docker image prune -af 2>&1', 60000);
  const match = result.match(/Total reclaimed space:\s*(.+)/);
  return { success: true, spaceReclaimed: match?.[1] || '0B' };
}
