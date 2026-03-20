import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';

const registerSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  display_name: z.string().max(64).optional(),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

interface UserRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_login: string | null;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  // ─── Register ───────────────────────────────────
  app.post('/auth/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);

    // Check if first user (auto-admin)
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const role = userCount.count === 0 ? 'admin' : 'user';

    const passwordHash = await bcrypt.hash(body.password, 12);

    try {
      const result = db.prepare(
        'INSERT INTO users (username, email, password_hash, role, display_name) VALUES (?, ?, ?, ?, ?)',
      ).run(body.username, body.email, passwordHash, role, body.display_name || body.username);

      const token = app.jwt.sign(
        { id: result.lastInsertRowid, username: body.username, role },
        { expiresIn: '7d' },
      );

      // Log it
      db.prepare(
        'INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)',
      ).run(result.lastInsertRowid, 'user.register', JSON.stringify({ role }));

      return reply.status(201).send({
        token,
        user: {
          id: result.lastInsertRowid,
          username: body.username,
          email: body.email,
          role,
          display_name: body.display_name || body.username,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE constraint failed')) {
        return reply.status(409).send({ error: 'Username or email already exists' });
      }
      throw err;
    }
  });

  // ─── Login ──────────────────────────────────────
  app.post('/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = db.prepare(
      'SELECT * FROM users WHERE username = ? OR email = ?',
    ).get(body.username, body.username) as UserRow | undefined;

    if (!user || !(await bcrypt.compare(body.password, user.password_hash))) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    // Update last login
    db.prepare('UPDATE users SET last_login = datetime("now") WHERE id = ?').run(user.id);

    const token = app.jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      { expiresIn: '7d' },
    );

    db.prepare(
      'INSERT INTO audit_log (user_id, action, ip_address) VALUES (?, ?, ?)',
    ).run(user.id, 'user.login', request.ip);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      },
    };
  });

  // ─── Get Current User ──────────────────────────
  app.get('/auth/me', { onRequest: [app.authenticate] }, async (request) => {
    const { id } = request.user as { id: number };
    const user = db.prepare(
      'SELECT id, username, email, role, display_name, avatar_url, created_at, last_login FROM users WHERE id = ?',
    ).get(id) as Omit<UserRow, 'password_hash'> | undefined;

    if (!user) {
      throw { statusCode: 404, message: 'User not found' };
    }

    return { user };
  });

  // ─── Setup Check ───────────────────────────────
  app.get('/auth/setup-required', async () => {
    const { count } = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    return { setupRequired: count === 0 };
  });
};
