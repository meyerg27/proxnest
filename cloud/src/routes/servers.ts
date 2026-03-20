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

// ─── Validation Schemas ──────────────────────────

const claimSchema = z.object({
  claim_token: z.string().min(6).max(12),
  name: z.string().min(1).max(100).optional(),
});

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
  // ━━━ GET /servers — List user's servers ━━━━━━━
  app.get('/servers', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest) => {
    const servers = db.prepare(
      'SELECT * FROM servers WHERE user_id = ? ORDER BY created_at DESC',
    ).all(request.user.id) as DbServer[];

    // Enrich with live online status from agent pool
    return {
      servers: servers.map((s) => ({
        ...sanitizeServer(s),
        is_online: agentPool.isOnline(s.agent_id),
      })),
    };
  });

  // ━━━ GET /servers/:id — Single server details ━
  app.get('/servers/:id', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const server = db.prepare(
      'SELECT * FROM servers WHERE id = ? AND user_id = ?',
    ).get(parseInt(id, 10), request.user.id) as DbServer | undefined;

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

  // ━━━ POST /servers/claim — Claim server with token ━━━
  app.post('/servers/claim', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = claimSchema.parse(request.body);

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

    // Find unclaimed server by token
    const server = db.prepare(
      'SELECT * FROM servers WHERE claim_token = ? AND user_id IS NULL',
    ).get(body.claim_token) as DbServer | undefined;

    if (!server) {
      return reply.status(404).send({ error: 'Invalid claim token or server already claimed' });
    }

    // Claim it
    db.prepare(
      `UPDATE servers SET user_id = ?, name = ?, claim_token = NULL, updated_at = datetime('now')
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
      db.prepare('UPDATE servers SET name = ?, updated_at = datetime("now") WHERE id = ?')
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

    const server = db.prepare(
      'SELECT * FROM servers WHERE id = ? AND user_id = ?',
    ).get(parseInt(id, 10), request.user.id) as DbServer | undefined;

    if (!server) return reply.status(404).send({ error: 'Server not found' });
    if (!agentPool.isOnline(server.agent_id)) {
      return reply.status(503).send({ error: 'Server is offline' });
    }

    // Send command to agent and wait for response
    try {
      const result = await agentPool.sendCommand(server.agent_id, action, params || {}, 30_000);
      return result;
    } catch (err) {
      return reply.status(504).send({
        error: err instanceof Error ? err.message : 'Command timed out',
      });
    }
  });
};
