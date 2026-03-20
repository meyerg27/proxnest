import { FastifyPluginAsync } from 'fastify';
import { db } from '../db.js';
import { proxmox } from '../proxmox.js';
import { APP_TEMPLATES } from '../app-templates.js';

interface NotificationRow {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  read: number;
  created_at: string;
}

interface AuditRow {
  id: number;
  user_id: number;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export const systemRoutes: FastifyPluginAsync = async (app) => {
  // ─── Health Check (no auth) ─────────────────────
  app.get('/health', async () => {
    let proxmoxOk = false;
    let proxmoxError: string | null = null;

    try {
      await proxmox.getNodes();
      proxmoxOk = true;
    } catch (err) {
      proxmoxError = err instanceof Error ? err.message : String(err);
    }

    return {
      status: 'ok',
      version: '0.1.0',
      uptime: process.uptime(),
      proxmox: { connected: proxmoxOk, error: proxmoxError },
      database: 'sqlite',
      appTemplates: APP_TEMPLATES.length,
    };
  });

  // ─── Dashboard Summary ─────────────────────────
  app.get('/dashboard', { onRequest: [app.authenticate] }, async () => {
    const [nodes, resources] = await Promise.all([
      proxmox.getNodes(),
      proxmox.getClusterResources(),
    ]);

    const vms = resources.filter((r) => r.type === 'qemu');
    const containers = resources.filter((r) => r.type === 'lxc');
    const running = resources.filter((r) => (r.type === 'qemu' || r.type === 'lxc') && r.status === 'running');

    const installedApps = db.prepare('SELECT COUNT(*) as count FROM installed_apps').get() as { count: number };
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

    // Aggregate cluster resources
    const totalCPU = nodes.reduce((sum, n) => sum + n.maxcpu, 0);
    const usedCPU = nodes.reduce((sum, n) => sum + n.cpu * n.maxcpu, 0);
    const totalMem = nodes.reduce((sum, n) => sum + n.maxmem, 0);
    const usedMem = nodes.reduce((sum, n) => sum + n.mem, 0);
    const totalDisk = nodes.reduce((sum, n) => sum + n.maxdisk, 0);
    const usedDisk = nodes.reduce((sum, n) => sum + n.disk, 0);

    return {
      cluster: {
        nodes: nodes.length,
        cpu: { total: totalCPU, used: +usedCPU.toFixed(1), percent: Math.round((usedCPU / totalCPU) * 100) },
        memory: {
          totalGB: +(totalMem / 1073741824).toFixed(1),
          usedGB: +(usedMem / 1073741824).toFixed(1),
          percent: Math.round((usedMem / totalMem) * 100),
        },
        disk: {
          totalGB: +(totalDisk / 1073741824).toFixed(1),
          usedGB: +(usedDisk / 1073741824).toFixed(1),
          percent: Math.round((usedDisk / totalDisk) * 100),
        },
      },
      guests: {
        vms: vms.length,
        containers: containers.length,
        running: running.length,
        stopped: vms.length + containers.length - running.length,
      },
      apps: installedApps.count,
      users: userCount.count,
    };
  });

  // ─── Notifications ──────────────────────────────
  app.get('/notifications', { onRequest: [app.authenticate] }, async (request) => {
    const user = request.user as { id: number };
    const notifications = db.prepare(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    ).all(user.id) as NotificationRow[];
    const unread = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0',
    ).get(user.id) as { count: number };

    return { notifications, unread: unread.count };
  });

  app.post('/notifications/read-all', { onRequest: [app.authenticate] }, async (request) => {
    const user = request.user as { id: number };
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(user.id);
    return { ok: true };
  });

  // ─── Audit Log (admin only) ────────────────────
  app.get('/audit-log', { onRequest: [app.authenticate] }, async (request, reply) => {
    const user = request.user as { id: number; role: string };
    if (user.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    const { limit = '100' } = request.query as { limit?: string };
    const logs = db.prepare(
      `SELECT a.*, u.username FROM audit_log a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC LIMIT ?`,
    ).all(parseInt(limit, 10)) as (AuditRow & { username: string })[];

    return { logs };
  });

  // ─── Settings ───────────────────────────────────
  app.get('/settings', { onRequest: [app.authenticate] }, async (request, reply) => {
    const user = request.user as { id: number; role: string };
    if (user.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    const settings = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    return {
      settings: Object.fromEntries(settings.map((s) => [s.key, JSON.parse(s.value)])),
    };
  });

  app.put('/settings', { onRequest: [app.authenticate] }, async (request, reply) => {
    const user = request.user as { id: number; role: string };
    if (user.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    const body = request.body as Record<string, unknown>;
    const upsert = db.prepare(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now")) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    );

    const tx = db.transaction(() => {
      for (const [key, value] of Object.entries(body)) {
        upsert.run(key, JSON.stringify(value));
      }
    });
    tx();

    return { ok: true, message: 'Settings updated' };
  });
};
