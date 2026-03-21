/**
 * ProxNest Cloud Portal — Server Members Routes
 * Add/remove users, manage per-server roles & permissions.
 *
 * Roles:
 *   owner    — the server's user_id (full control, cannot be removed)
 *   admin    — can manage members, send any command
 *   operator — can control guests/apps, view everything
 *   viewer   — read-only access to metrics & status
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, type DbServer, type DbServerMember, type DbUser } from '../db.js';

// ─── Validation ──────────────────────────────────

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'operator', 'viewer']).default('viewer'),
});

const updateMemberSchema = z.object({
  role: z.enum(['admin', 'operator', 'viewer']),
});

// ─── Helpers ─────────────────────────────────────

function audit(userId: number | null, action: string, resource: string | null, details: string | null, ip: string) {
  db.prepare(
    'INSERT INTO audit_log (user_id, action, resource, details, ip_address) VALUES (?, ?, ?, ?, ?)',
  ).run(userId, action, resource, details, ip);
}

/** Check if a user is the server owner */
function isOwner(server: DbServer, userId: number): boolean {
  return server.user_id === userId;
}

/** Get a user's role for a server (owner > admin > operator > viewer > null) */
export function getUserServerRole(serverId: number, userId: number): 'owner' | 'admin' | 'operator' | 'viewer' | null {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as DbServer | undefined;
  if (!server) return null;
  if (server.user_id === userId) return 'owner';

  const member = db.prepare(
    'SELECT * FROM server_members WHERE server_id = ? AND user_id = ?',
  ).get(serverId, userId) as DbServerMember | undefined;

  return member?.role ?? null;
}

/** Check if user has at least the required role level */
export function hasPermission(
  serverId: number,
  userId: number,
  minRole: 'owner' | 'admin' | 'operator' | 'viewer',
): boolean {
  const roleHierarchy = { owner: 4, admin: 3, operator: 2, viewer: 1 };
  const userRole = getUserServerRole(serverId, userId);
  if (!userRole) return false;
  return roleHierarchy[userRole] >= roleHierarchy[minRole];
}

// ─── Routes ──────────────────────────────────────

export const memberRoutes: FastifyPluginAsync = async (app) => {
  // ━━━ GET /servers/:id/members — List members ━━━
  app.get('/servers/:id/members', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const serverId = parseInt(id, 10);

    // Must have at least viewer access
    if (!hasPermission(serverId, request.user.id, 'viewer')) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as DbServer;

    // Get the owner
    const owner = db.prepare('SELECT id, email, display_name, avatar_url FROM users WHERE id = ?')
      .get(server.user_id) as Pick<DbUser, 'id' | 'email' | 'display_name' | 'avatar_url'> | undefined;

    // Get all members
    const members = db.prepare(`
      SELECT sm.id, sm.server_id, sm.user_id, sm.role, sm.created_at, sm.updated_at,
             u.email, u.display_name, u.avatar_url,
             inv.email as invited_by_email
      FROM server_members sm
      JOIN users u ON u.id = sm.user_id
      LEFT JOIN users inv ON inv.id = sm.invited_by
      WHERE sm.server_id = ?
      ORDER BY sm.created_at ASC
    `).all(serverId) as Array<DbServerMember & {
      email: string;
      display_name: string | null;
      avatar_url: string | null;
      invited_by_email: string | null;
    }>;

    const result = [];

    // Owner always first
    if (owner) {
      result.push({
        id: 0,
        user_id: owner.id,
        email: owner.email,
        display_name: owner.display_name,
        avatar_url: owner.avatar_url,
        role: 'owner' as const,
        invited_by_email: null,
        created_at: server.created_at,
      });
    }

    // Then members
    for (const m of members) {
      result.push({
        id: m.id,
        user_id: m.user_id,
        email: m.email,
        display_name: m.display_name,
        avatar_url: m.avatar_url,
        role: m.role,
        invited_by_email: m.invited_by_email,
        created_at: m.created_at,
      });
    }

    return { members: result };
  });

  // ━━━ POST /servers/:id/members — Add member ━━━
  app.post('/servers/:id/members', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const serverId = parseInt(id, 10);
    const body = addMemberSchema.parse(request.body);

    // Must be owner or admin to add members
    if (!hasPermission(serverId, request.user.id, 'admin')) {
      return reply.status(403).send({ error: 'Only owners and admins can add members' });
    }

    // Find user by email
    const targetUser = db.prepare('SELECT id, email, display_name, avatar_url FROM users WHERE email = ?')
      .get(body.email) as Pick<DbUser, 'id' | 'email' | 'display_name' | 'avatar_url'> | undefined;

    if (!targetUser) {
      return reply.status(404).send({ error: 'No user found with that email. They must register first.' });
    }

    // Can't add yourself
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as DbServer;
    if (targetUser.id === server.user_id) {
      return reply.status(400).send({ error: 'This user is already the server owner' });
    }

    // Can't add someone who's already a member
    const existing = db.prepare(
      'SELECT id FROM server_members WHERE server_id = ? AND user_id = ?',
    ).get(serverId, targetUser.id);

    if (existing) {
      return reply.status(409).send({ error: 'User is already a member of this server' });
    }

    // Non-owners can only add viewers/operators, not admins
    const callerRole = getUserServerRole(serverId, request.user.id);
    if (callerRole !== 'owner' && body.role === 'admin') {
      return reply.status(403).send({ error: 'Only the server owner can grant admin access' });
    }

    // Add member
    const result = db.prepare(
      'INSERT INTO server_members (server_id, user_id, role, invited_by) VALUES (?, ?, ?, ?)',
    ).run(serverId, targetUser.id, body.role, request.user.id);

    audit(request.user.id, 'add_member', `server:${serverId}`, `Added ${body.email} as ${body.role}`, request.ip);

    return reply.status(201).send({
      member: {
        id: result.lastInsertRowid as number,
        user_id: targetUser.id,
        email: targetUser.email,
        display_name: targetUser.display_name,
        avatar_url: targetUser.avatar_url,
        role: body.role,
        invited_by_email: request.user.email,
        created_at: new Date().toISOString(),
      },
    });
  });

  // ━━━ PATCH /servers/:id/members/:userId — Update role ━━━
  app.patch('/servers/:id/members/:userId', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, userId } = request.params as { id: string; userId: string };
    const serverId = parseInt(id, 10);
    const targetUserId = parseInt(userId, 10);
    const body = updateMemberSchema.parse(request.body);

    // Must be owner or admin
    if (!hasPermission(serverId, request.user.id, 'admin')) {
      return reply.status(403).send({ error: 'Only owners and admins can change roles' });
    }

    // Can't change the owner
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as DbServer;
    if (targetUserId === server.user_id) {
      return reply.status(400).send({ error: 'Cannot change the owner\'s role' });
    }

    // Non-owners can't promote to admin
    const callerRole = getUserServerRole(serverId, request.user.id);
    if (callerRole !== 'owner' && body.role === 'admin') {
      return reply.status(403).send({ error: 'Only the server owner can grant admin access' });
    }

    // Non-owners can't modify admins
    const targetRole = getUserServerRole(serverId, targetUserId);
    if (callerRole !== 'owner' && targetRole === 'admin') {
      return reply.status(403).send({ error: 'Only the server owner can modify admin members' });
    }

    const result = db.prepare(
      `UPDATE server_members SET role = ?, updated_at = datetime('now') WHERE server_id = ? AND user_id = ?`,
    ).run(body.role, serverId, targetUserId);

    if (result.changes === 0) {
      return reply.status(404).send({ error: 'Member not found' });
    }

    audit(request.user.id, 'update_member', `server:${serverId}`, `Changed user ${targetUserId} to ${body.role}`, request.ip);

    return { ok: true, role: body.role };
  });

  // ━━━ DELETE /servers/:id/members/:userId — Remove member ━━━
  app.delete('/servers/:id/members/:userId', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, userId } = request.params as { id: string; userId: string };
    const serverId = parseInt(id, 10);
    const targetUserId = parseInt(userId, 10);

    // Can remove yourself (leave), or must be admin+
    const isSelf = targetUserId === request.user.id;
    if (!isSelf && !hasPermission(serverId, request.user.id, 'admin')) {
      return reply.status(403).send({ error: 'Only owners and admins can remove members' });
    }

    // Can't remove the owner
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as DbServer;
    if (targetUserId === server.user_id) {
      return reply.status(400).send({ error: 'Cannot remove the server owner' });
    }

    // Non-owners can't remove admins
    if (!isSelf) {
      const callerRole = getUserServerRole(serverId, request.user.id);
      const targetRole = getUserServerRole(serverId, targetUserId);
      if (callerRole !== 'owner' && targetRole === 'admin') {
        return reply.status(403).send({ error: 'Only the server owner can remove admin members' });
      }
    }

    const result = db.prepare(
      'DELETE FROM server_members WHERE server_id = ? AND user_id = ?',
    ).run(serverId, targetUserId);

    if (result.changes === 0) {
      return reply.status(404).send({ error: 'Member not found' });
    }

    const targetUser = db.prepare('SELECT email FROM users WHERE id = ?').get(targetUserId) as { email: string } | undefined;
    audit(
      request.user.id,
      isSelf ? 'leave_server' : 'remove_member',
      `server:${serverId}`,
      `Removed ${targetUser?.email || targetUserId}`,
      request.ip,
    );

    return { ok: true };
  });
};
