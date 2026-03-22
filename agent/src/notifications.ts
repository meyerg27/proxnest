/**
 * ProxNest Agent — Notification System
 * Monitor apps, disk space, updates and generate alerts.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

export interface Notification {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  category: 'app' | 'disk' | 'update' | 'backup' | 'system';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  actionLabel?: string;
  actionCommand?: string;
}

const STATE_FILE = '/opt/proxnest-apps/.notifications.json';

function run(cmd: string, timeout = 10000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }).trim(); } catch { return ''; }
}

function loadNotifications(): Notification[] {
  try {
    if (!existsSync(STATE_FILE)) return [];
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  } catch { return []; }
}

function saveNotifications(notifs: Notification[]): void {
  try {
    mkdirSync('/opt/proxnest-apps', { recursive: true });
    // Keep last 100 notifications
    writeFileSync(STATE_FILE, JSON.stringify(notifs.slice(-100), null, 2));
  } catch { /* best effort */ }
}

function addNotification(n: Omit<Notification, 'id' | 'createdAt' | 'read'>): void {
  const notifs = loadNotifications();
  // Don't add duplicate (same title+message within 1 hour)
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const isDuplicate = notifs.some(
    existing => existing.title === n.title && existing.message === n.message && existing.createdAt > oneHourAgo
  );
  if (isDuplicate) return;

  notifs.push({
    ...n,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    read: false,
  });
  saveNotifications(notifs);
}

/**
 * Run all health checks and generate notifications.
 */
export function runHealthCheck(): { notifications: Notification[]; summary: { healthy: number; unhealthy: number; warnings: number } } {
  let healthy = 0, unhealthy = 0, warnings = 0;

  // 1. Check app health
  const containers = run("docker ps -a --filter 'name=proxnest-' --format '{{.Names}}|{{.Status}}'");
  if (containers) {
    for (const line of containers.split('\n')) {
      if (!line) continue;
      const [name, status] = line.split('|');
      const appId = name.replace('proxnest-', '');

      if (status.includes('Exited') || status.includes('Dead')) {
        unhealthy++;
        addNotification({
          type: 'error',
          category: 'app',
          title: `${appId} is down`,
          message: `Container ${name} has stopped (${status}). Click to restart.`,
          actionLabel: 'Restart',
          actionCommand: `apps.restart:${appId}`,
        });
      } else if (status.includes('unhealthy')) {
        warnings++;
        addNotification({
          type: 'warning',
          category: 'app',
          title: `${appId} is unhealthy`,
          message: `Container ${name} is running but reporting unhealthy status.`,
        });
      } else {
        healthy++;
      }
    }
  }

  // 2. Check disk space
  const diskLines = run("df -h --output=target,pcent,avail -x tmpfs -x devtmpfs -x squashfs 2>/dev/null");
  if (diskLines) {
    for (const line of diskLines.split('\n').slice(1)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 3) continue;
      const [mount, pctStr, avail] = parts;
      const pct = parseInt(pctStr);

      if (pct >= 95) {
        addNotification({
          type: 'error',
          category: 'disk',
          title: `Disk almost full: ${mount}`,
          message: `${mount} is ${pct}% full (${avail} remaining). Free up space immediately!`,
        });
      } else if (pct >= 85) {
        warnings++;
        addNotification({
          type: 'warning',
          category: 'disk',
          title: `Disk space warning: ${mount}`,
          message: `${mount} is ${pct}% full (${avail} remaining). Consider cleaning up.`,
          actionLabel: 'Prune Images',
          actionCommand: 'apps.pruneImages',
        });
      }
    }
  }

  // 3. Check system resources
  const loadAvg = run("cat /proc/loadavg 2>/dev/null").split(' ')[0];
  const cpuCount = parseInt(run("nproc 2>/dev/null")) || 1;
  if (parseFloat(loadAvg) > cpuCount * 2) {
    warnings++;
    addNotification({
      type: 'warning',
      category: 'system',
      title: 'High CPU load',
      message: `Load average is ${loadAvg} (${cpuCount} cores). System may be slow.`,
    });
  }

  // 4. Check RAM
  const memInfo = run("free -m 2>/dev/null");
  if (memInfo) {
    const memLine = memInfo.split('\n').find(l => l.startsWith('Mem:'));
    if (memLine) {
      const parts = memLine.split(/\s+/);
      const total = parseInt(parts[1]);
      const available = parseInt(parts[6]);
      const pctUsed = Math.round(((total - available) / total) * 100);
      if (pctUsed > 90) {
        addNotification({
          type: 'warning',
          category: 'system',
          title: 'High memory usage',
          message: `RAM is ${pctUsed}% used (${available}MB free of ${total}MB). Consider stopping unused apps.`,
        });
      }
    }
  }

  return {
    notifications: loadNotifications().filter(n => !n.read),
    summary: { healthy, unhealthy, warnings },
  };
}

/**
 * Get all notifications (optionally unread only).
 */
export function getNotifications(unreadOnly = false): Notification[] {
  const notifs = loadNotifications();
  return unreadOnly ? notifs.filter(n => !n.read) : notifs;
}

/**
 * Mark notifications as read.
 */
export function markRead(ids: string[]): void {
  const notifs = loadNotifications();
  const idSet = new Set(ids);
  for (const n of notifs) {
    if (idSet.has(n.id) || idSet.has('all')) n.read = true;
  }
  saveNotifications(notifs);
}

/**
 * Clear all notifications.
 */
export function clearNotifications(): void {
  saveNotifications([]);
}
