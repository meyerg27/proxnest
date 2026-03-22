/**
 * ProxNest Cloud Portal — Server Routes
 * Agent registration (phones home), server listing, claiming, management.
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db, type DbServer } from '../db.js';
import { config } from '../config.js';
import { agentPool } from '../agent-pool.js';
import { hasPermission } from './members.js';

// ─── Validation Schemas ──────────────────────────

const claimSchema = z.object({
  claim_token: z.string().min(6).max(12).optional(),
  server_id: z.number().optional(),
  name: z.string().min(1).max(100).optional(),
});

function getClientIp(request: FastifyRequest): string {
  return (
    (request.headers['cf-connecting-ip'] as string) ||
    (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (request.headers['x-real-ip'] as string) ||
    request.ip
  );
}

const updateServerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

// ─── Helpers ─────────────────────────────────────

function sanitizeServer(s: DbServer) {
  return {
    id: s.id,
    agent_id: s.agent_id,
    name: s.name,
    hostname: s.hostname,
    os: s.os,
    cpu_model: s.cpu_model,
    cpu_cores: s.cpu_cores,
    ram_total_mb: s.ram_total_mb,
    proxmox_version: s.proxmox_version,
    agent_version: s.agent_version,
    is_online: !!s.is_online,
    last_seen: s.last_seen,
    created_at: s.created_at,
  };
}

// ─── Routes ──────────────────────────────────────

export const serverRoutes: FastifyPluginAsync = async (app) => {
  // ━━━ GET /servers — List user's owned + shared servers ━━━
  app.get('/servers', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest) => {
    // Own servers
    const owned = db.prepare(
      'SELECT * FROM servers WHERE user_id = ? ORDER BY created_at DESC',
    ).all(request.user.id) as DbServer[];

    // Shared servers (member of)
    const shared = db.prepare(`
      SELECT s.* FROM servers s
      JOIN server_members sm ON sm.server_id = s.id
      WHERE sm.user_id = ?
      ORDER BY s.created_at DESC
    `).all(request.user.id) as DbServer[];

    const allServers = [...owned, ...shared];
    // Deduplicate by id
    const seen = new Set<number>();
    const unique = allServers.filter(s => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });

    return {
      servers: unique.map((s) => ({
        ...sanitizeServer(s),
        is_online: agentPool.isOnline(s.agent_id),
        metrics: agentPool.getMetrics(s.agent_id),
        role: s.user_id === request.user.id ? 'owner' : 'member',
      })),
    };
  });

  // ━━━ GET /servers/:id — Single server details ━
  app.get('/servers/:id', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const serverId = parseInt(id, 10);

    if (!hasPermission(serverId, request.user.id, 'viewer')) {
      return reply.status(404).send({ error: 'Server not found' });
    }

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as DbServer | undefined;
    if (!server) return reply.status(404).send({ error: 'Server not found' });

    // Get latest metrics from agent pool
    const metrics = agentPool.getMetrics(server.agent_id);

    return {
      server: {
        ...sanitizeServer(server),
        is_online: agentPool.isOnline(server.agent_id),
        metrics,
      },
    };
  });

  // ━━━ GET /servers/discover — Auto-discover unclaimed servers on same network ━━━
  app.get('/servers/discover', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest) => {
    const clientIp = getClientIp(request);

    // Find unclaimed servers with matching public IP
    const servers = db.prepare(
      `SELECT * FROM servers WHERE user_id IS NULL AND public_ip = ? AND public_ip IS NOT NULL`,
    ).all(clientIp) as DbServer[];

    return {
      servers: servers.map((s) => ({
        id: s.id,
        hostname: s.hostname,
        agent_id: s.agent_id,
        claim_code: s.claim_token,
        os: s.os,
        cpu_cores: s.cpu_cores,
        ram_total_mb: s.ram_total_mb,
        proxmox_version: s.proxmox_version,
        is_online: agentPool.isOnline(s.agent_id),
      })),
      client_ip: clientIp,
    };
  });

  // ━━━ POST /servers/claim — Claim server with token or auto-discovery ━━━
  app.post('/servers/claim', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = claimSchema.parse(request.body);
    const clientIp = getClientIp(request);

    // Check server limit
    const count = db.prepare(
      'SELECT COUNT(*) as cnt FROM servers WHERE user_id = ?',
    ).get(request.user.id) as { cnt: number };

    const user = db.prepare('SELECT max_servers FROM users WHERE id = ?').get(request.user.id) as { max_servers: number };
    if (count.cnt >= user.max_servers) {
      return reply.status(403).send({
        error: `Server limit reached (${user.max_servers}). Upgrade to Pro for unlimited servers.`,
      });
    }

    let server: DbServer | undefined;

    if (body.server_id) {
      // Auto-discovery claim: verify IP matches
      server = db.prepare(
        'SELECT * FROM servers WHERE id = ? AND user_id IS NULL',
      ).get(body.server_id) as DbServer | undefined;

      if (!server) {
        return reply.status(404).send({ error: 'Server not found or already claimed' });
      }

      // If IPs don't match, require claim_token as fallback
      if (server.public_ip !== clientIp) {
        if (!body.claim_token) {
          return reply.status(403).send({
            error: 'IP mismatch — claim code required. Enter the code shown on your server.',
          });
        }
        if (server.claim_token !== body.claim_token) {
          return reply.status(403).send({ error: 'Invalid claim code' });
        }
      }
    } else if (body.claim_token) {
      // Legacy claim by token only
      server = db.prepare(
        'SELECT * FROM servers WHERE claim_token = ? AND user_id IS NULL',
      ).get(body.claim_token) as DbServer | undefined;

      if (!server) {
        return reply.status(404).send({ error: 'Invalid claim token or server already claimed' });
      }
    } else {
      return reply.status(400).send({ error: 'Provide server_id or claim_token' });
    }

    // Claim it
    db.prepare(
      `UPDATE servers SET user_id = ?, name = ?, claim_token = NULL, claimed_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`,
    ).run(request.user.id, body.name || server.name, server.id);

    // Notify agent that it's been claimed
    agentPool.sendToAgent(server.agent_id, {
      type: 'claimed',
      userId: String(request.user.id),
      serverName: body.name || server.name,
    });

    db.prepare(
      'INSERT INTO audit_log (user_id, action, resource, details, ip_address) VALUES (?, ?, ?, ?, ?)',
    ).run(request.user.id, 'claim_server', `server:${server.id}`, null, request.ip);

    const updated = db.prepare('SELECT * FROM servers WHERE id = ?').get(server.id) as DbServer;
    return reply.status(200).send({ server: sanitizeServer(updated) });
  });

  // ━━━ PATCH /servers/:id — Update server name ━━━
  app.patch('/servers/:id', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateServerSchema.parse(request.body);

    const server = db.prepare(
      'SELECT * FROM servers WHERE id = ? AND user_id = ?',
    ).get(parseInt(id, 10), request.user.id) as DbServer | undefined;

    if (!server) return reply.status(404).send({ error: 'Server not found' });

    if (body.name) {
      db.prepare(`UPDATE servers SET name = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(body.name, server.id);
    }

    const updated = db.prepare('SELECT * FROM servers WHERE id = ?').get(server.id) as DbServer;
    return { server: sanitizeServer(updated) };
  });

  // ━━━ DELETE /servers/:id — Remove server ━━━━━━
  app.delete('/servers/:id', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const server = db.prepare(
      'SELECT * FROM servers WHERE id = ? AND user_id = ?',
    ).get(parseInt(id, 10), request.user.id) as DbServer | undefined;

    if (!server) return reply.status(404).send({ error: 'Server not found' });

    // Unclaim — don't delete the registration, just unlink from user
    db.prepare(
      `UPDATE servers SET user_id = NULL, claim_token = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(nanoid(8).toUpperCase(), server.id);

    db.prepare(
      'INSERT INTO audit_log (user_id, action, resource, details, ip_address) VALUES (?, ?, ?, ?, ?)',
    ).run(request.user.id, 'remove_server', `server:${server.id}`, null, request.ip);

    return { ok: true };
  });

  // ━━━ POST /servers/:id/command — Send command to agent ━━━
  app.post('/servers/:id/command', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { action, params } = request.body as { action: string; params?: Record<string, unknown> };

    if (!action) return reply.status(400).send({ error: 'action is required' });

    const serverId = parseInt(id, 10);

    // Determine minimum role for this action
    const readOnlyActions = ['guests.list', 'storage.list', 'network.list', 'apps.list', 'system.logs', 'backups.list', 'backups.storages'];
    const operatorActions = ['guests.start', 'guests.stop', 'guests.restart', 'apps.install', 'apps.start', 'apps.stop', 'apps.uninstall', 'apps.logs', 'backups.create'];
    // Everything else (system.reboot, system.update, backups.delete, backups.restore) requires admin

    let minRole: 'viewer' | 'operator' | 'admin' = 'admin';
    if (readOnlyActions.includes(action)) minRole = 'viewer';
    else if (operatorActions.includes(action)) minRole = 'operator';

    if (!hasPermission(serverId, request.user.id, minRole)) {
      return reply.status(403).send({ error: `Insufficient permissions. This action requires ${minRole} role or higher.` });
    }

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as DbServer | undefined;
    if (!server) return reply.status(404).send({ error: 'Server not found' });
    if (!agentPool.isOnline(server.agent_id)) {
      return reply.status(503).send({ error: 'Server is offline' });
    }

    // Send command to agent and wait for response
    // Use longer timeout for app operations (image pulls can take a while)
    const isLongOp = action.startsWith('apps.') || action.startsWith('stacks.') || action.startsWith('vpn.');
    const timeoutMs = isLongOp ? 600_000 : 30_000; // 10 min for installs, 30s for queries
    try {
      const result = await agentPool.sendCommand(server.agent_id, action, params || {}, timeoutMs);
      return result;
    } catch (err) {
      return reply.status(504).send({
        error: err instanceof Error ? err.message : 'Command timed out',
      });
    }
  });
};
