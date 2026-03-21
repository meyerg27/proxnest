/**
 * ProxNest Cloud Portal — Notification Routes
 * CRUD for alert rules + notification history + webhook/email delivery.
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../db.js';
import { hasPermission } from './members.js';

// ─── Validation Schemas ──────────────────────────

const createRuleSchema = z.object({
  server_id: z.number(),
  name: z.string().min(1).max(100),
  condition: z.enum(['server_offline', 'cpu_high', 'ram_high', 'disk_high']),
  threshold: z.number().min(0).max(100).optional(), // percent for cpu/ram/disk
  duration_seconds: z.number().min(0).max(3600).optional(), // how long before firing
  channel: z.enum(['webhook', 'email']),
  target: z.string().min(1).max(500), // webhook URL or email address
  cooldown_minutes: z.number().min(1).max(1440).optional().default(30),
  enabled: z.boolean().optional().default(true),
});

const updateRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  threshold: z.number().min(0).max(100).optional(),
  duration_seconds: z.number().min(0).max(3600).optional(),
  channel: z.enum(['webhook', 'email']).optional(),
  target: z.string().min(1).max(500).optional(),
  cooldown_minutes: z.number().min(1).max(1440).optional(),
  enabled: z.boolean().optional(),
});

// ─── Routes ──────────────────────────────────────

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  // ━━━ GET /servers/:id/notifications/rules — List alert rules ━━━
  app.get('/servers/:id/notifications/rules', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const serverId = parseInt(id, 10);

    if (!hasPermission(serverId, request.user.id, 'viewer')) {
      return reply.status(404).send({ error: 'Server not found' });
    }

    const rules = db.prepare(
      'SELECT * FROM notification_rules WHERE server_id = ? ORDER BY created_at DESC',
    ).all(serverId);

    return { rules };
  });

  // ━━━ POST /servers/:id/notifications/rules — Create alert rule ━━━
  app.post('/servers/:id/notifications/rules', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const serverId = parseInt(id, 10);

    if (!hasPermission(serverId, request.user.id, 'admin')) {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    const body = createRuleSchema.parse({ ...(request.body as any), server_id: serverId });

    // Default thresholds
    const threshold = body.threshold ?? (body.condition === 'cpu_high' ? 90 : body.condition === 'ram_high' ? 90 : body.condition === 'disk_high' ? 90 : 0);
    const durationSec = body.duration_seconds ?? (body.condition === 'server_offline' ? 120 : 300);

    const result = db.prepare(
      `INSERT INTO notification_rules (server_id, user_id, name, condition, threshold, duration_seconds, channel, target, cooldown_minutes, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      serverId,
      request.user.id,
      body.name,
      body.condition,
      threshold,
      durationSec,
      body.channel,
      body.target,
      body.cooldown_minutes,
      body.enabled ? 1 : 0,
    );

    const rule = db.prepare('SELECT * FROM notification_rules WHERE id = ?').get(result.lastInsertRowid);
    return reply.status(201).send({ rule });
  });

  // ━━━ PATCH /servers/:id/notifications/rules/:ruleId — Update rule ━━━
  app.patch('/servers/:id/notifications/rules/:ruleId', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, ruleId } = request.params as { id: string; ruleId: string };
    const serverId = parseInt(id, 10);

    if (!hasPermission(serverId, request.user.id, 'admin')) {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    const body = updateRuleSchema.parse(request.body);

    const existing = db.prepare(
      'SELECT * FROM notification_rules WHERE id = ? AND server_id = ?',
    ).get(parseInt(ruleId, 10), serverId) as any;

    if (!existing) return reply.status(404).send({ error: 'Rule not found' });

    const updates: string[] = [];
    const params: any[] = [];

    if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name); }
    if (body.threshold !== undefined) { updates.push('threshold = ?'); params.push(body.threshold); }
    if (body.duration_seconds !== undefined) { updates.push('duration_seconds = ?'); params.push(body.duration_seconds); }
    if (body.channel !== undefined) { updates.push('channel = ?'); params.push(body.channel); }
    if (body.target !== undefined) { updates.push('target = ?'); params.push(body.target); }
    if (body.cooldown_minutes !== undefined) { updates.push('cooldown_minutes = ?'); params.push(body.cooldown_minutes); }
    if (body.enabled !== undefined) { updates.push('enabled = ?'); params.push(body.enabled ? 1 : 0); }

    if (updates.length === 0) return reply.status(400).send({ error: 'No fields to update' });

    updates.push("updated_at = datetime('now')");
    params.push(existing.id);

    db.prepare(`UPDATE notification_rules SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT * FROM notification_rules WHERE id = ?').get(existing.id);
    return { rule: updated };
  });

  // ━━━ DELETE /servers/:id/notifications/rules/:ruleId ━━━
  app.delete('/servers/:id/notifications/rules/:ruleId', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, ruleId } = request.params as { id: string; ruleId: string };
    const serverId = parseInt(id, 10);

    if (!hasPermission(serverId, request.user.id, 'admin')) {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    const result = db.prepare(
      'DELETE FROM notification_rules WHERE id = ? AND server_id = ?',
    ).run(parseInt(ruleId, 10), serverId);

    if (result.changes === 0) return reply.status(404).send({ error: 'Rule not found' });
    return { ok: true };
  });

  // ━━━ GET /servers/:id/notifications/history — Recent notifications ━━━
  app.get('/servers/:id/notifications/history', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const serverId = parseInt(id, 10);

    if (!hasPermission(serverId, request.user.id, 'viewer')) {
      return reply.status(404).send({ error: 'Server not found' });
    }

    const limit = Math.min(parseInt((request.query as any).limit || '50', 10), 200);

    const history = db.prepare(
      `SELECT nh.*, nr.name as rule_name, nr.condition, nr.channel, nr.target
       FROM notification_history nh
       JOIN notification_rules nr ON nh.rule_id = nr.id
       WHERE nr.server_id = ?
       ORDER BY nh.fired_at DESC
       LIMIT ?`,
    ).all(serverId, limit);

    return { history };
  });

  // ━━━ POST /servers/:id/notifications/test — Test a notification ━━━
  app.post('/servers/:id/notifications/test', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const serverId = parseInt(id, 10);

    if (!hasPermission(serverId, request.user.id, 'admin')) {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    const { channel, target } = request.body as { channel: string; target: string };

    if (!channel || !target) {
      return reply.status(400).send({ error: 'channel and target are required' });
    }

    const server = db.prepare('SELECT name FROM servers WHERE id = ?').get(serverId) as any;
    const serverName = server?.name || `Server #${serverId}`;

    try {
      if (channel === 'webhook') {
        const resp = await fetch(target, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'test',
            server: serverName,
            message: `🔔 ProxNest test notification from "${serverName}"`,
            timestamp: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!resp.ok) throw new Error(`Webhook returned ${resp.status}`);
      } else if (channel === 'email') {
        // Email would need SMTP config — for now just validate format
        if (!target.includes('@')) throw new Error('Invalid email address');
        // TODO: integrate SMTP transport
        return { ok: true, note: 'Email delivery requires SMTP configuration. Webhook is recommended.' };
      }
      return { ok: true };
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Test failed' });
    }
  });
};
