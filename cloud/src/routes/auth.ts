/**
 * ProxNest Cloud Portal — Auth Routes
 * Registration, login, profile, session management.
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { db, type DbUser } from '../db.js';
import { config } from '../config.js';

// ─── Validation Schemas ──────────────────────────

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  display_name: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  avatar_url: z.string().url().optional(),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8).max(128),
});

// ─── Helpers ─────────────────────────────────────

function sanitizeUser(user: DbUser) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    plan: user.plan,
    max_servers: user.max_servers,
    created_at: user.created_at,
  };
}

function audit(userId: number | null, action: string, resource: string | null, details: string | null, ip: string) {
  db.prepare(
    'INSERT INTO audit_log (user_id, action, resource, details, ip_address) VALUES (?, ?, ?, ?, ?)',
  ).run(userId, action, resource, details, ip);
}

// ─── Routes ──────────────────────────────────────

export const authRoutes: FastifyPluginAsync = async (app) => {
  // ━━━ POST /auth/register ━━━━━━━━━━━━━━━━━━━━━━
  app.post('/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = registerSchema.parse(request.body);
    const ip = request.ip;

    // Check existing
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(body.email) as DbUser | undefined;
    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    // Hash password
    const hash = await bcrypt.hash(body.password, config.BCRYPT_ROUNDS);

    // Insert user
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)',
    ).run(body.email, hash, body.display_name || null);

    const userId = result.lastInsertRowid as number;

    // Create JWT
    const jti = nanoid(32);
    const token = app.jwt.sign(
      { id: userId, email: body.email },
      { jti, expiresIn: config.JWT_EXPIRES_IN },
    );

    // Record session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(
      'INSERT INTO sessions (user_id, token_jti, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)',
    ).run(userId, jti, ip, request.headers['user-agent'] || null, expiresAt);

    audit(userId, 'register', 'user', null, ip);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as DbUser;

    return reply.status(201).send({
      token,
      user: sanitizeUser(user),
    });
  });

  // ━━━ POST /auth/login ━━━━━━━━━━━━━━━━━━━━━━━━━
  app.post('/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = loginSchema.parse(request.body);
    const ip = request.ip;

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(body.email) as DbUser | undefined;
    if (!user) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(body.password, user.password_hash);
    if (!valid) {
      audit(user.id, 'login_failed', 'user', null, ip);
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    // Create JWT
    const jti = nanoid(32);
    const token = app.jwt.sign(
      { id: user.id, email: user.email },
      { jti, expiresIn: config.JWT_EXPIRES_IN },
    );

    // Record session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(
      'INSERT INTO sessions (user_id, token_jti, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)',
    ).run(user.id, jti, ip, request.headers['user-agent'] || null, expiresAt);

    // Update last login
    db.prepare('UPDATE users SET last_login = datetime("now") WHERE id = ?').run(user.id);

    audit(user.id, 'login', 'user', null, ip);

    return {
      token,
      user: sanitizeUser(user),
    };
  });

  // ━━━ GET /auth/me ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  app.get('/auth/me', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(request.user.id) as DbUser;
    if (!user) throw { statusCode: 404, message: 'User not found' };
    return { user: sanitizeUser(user) };
  });

  // ━━━ PATCH /auth/profile ━━━━━━━━━━━━━━━━━━━━━━
  app.patch('/auth/profile', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest) => {
    const body = updateProfileSchema.parse(request.body);
    const updates: string[] = [];
    const params: unknown[] = [];

    if (body.display_name !== undefined) {
      updates.push('display_name = ?');
      params.push(body.display_name);
    }
    if (body.avatar_url !== undefined) {
      updates.push('avatar_url = ?');
      params.push(body.avatar_url);
    }

    if (updates.length === 0) return { ok: true };

    updates.push('updated_at = datetime("now")');
    params.push(request.user.id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(request.user.id) as DbUser;
    return { user: sanitizeUser(user) };
  });

  // ━━━ POST /auth/change-password ━━━━━━━━━━━━━━━
  app.post('/auth/change-password', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = changePasswordSchema.parse(request.body);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(request.user.id) as DbUser;

    const valid = await bcrypt.compare(body.current_password, user.password_hash);
    if (!valid) {
      return reply.status(400).send({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(body.new_password, config.BCRYPT_ROUNDS);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?').run(hash, user.id);

    // Revoke all other sessions
    db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ? AND token_jti != ?')
      .run(user.id, (request as any).jti || '');

    audit(user.id, 'change_password', 'user', null, request.ip);
    return { ok: true, message: 'Password changed. Other sessions revoked.' };
  });

  // ━━━ POST /auth/logout ━━━━━━━━━━━━━━━━━━━━━━━
  app.post('/auth/logout', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest) => {
    // Revoke current session token
    const payload = request.user as any;
    if (payload.jti) {
      db.prepare('UPDATE sessions SET revoked = 1 WHERE token_jti = ?').run(payload.jti);
    }
    audit(request.user.id, 'logout', 'user', null, request.ip);
    return { ok: true };
  });

  // ━━━ GET /auth/sessions ━━━━━━━━━━━━━━━━━━━━━━
  app.get('/auth/sessions', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest) => {
    const sessions = db.prepare(
      `SELECT id, ip_address, user_agent, created_at, expires_at, revoked
       FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
    ).all(request.user.id);
    return { sessions };
  });

  // ━━━ DELETE /auth/sessions/:id ━━━━━━━━━━━━━━━━
  app.delete('/auth/sessions/:id', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const sessionId = parseInt((request.params as any).id, 10);
    const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?')
      .get(sessionId, request.user.id);
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    db.prepare('UPDATE sessions SET revoked = 1 WHERE id = ?').run(sessionId);
    return { ok: true };
  });
};
