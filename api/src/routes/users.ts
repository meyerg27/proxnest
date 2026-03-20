import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';

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

const updateUserSchema = z.object({
  display_name: z.string().max(64).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'user', 'viewer']).optional(),
});

const changePasswordSchema = z.object({
  current_password: z.string(),
  new_password: z.string().min(8).max(128),
});

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  // ─── List Users (admin only) ────────────────────
  app.get('/users', async (request, reply) => {
    const user = request.user as { id: number; role: string };
    if (user.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    const users = db.prepare(
      'SELECT id, username, email, role, display_name, avatar_url, created_at, last_login FROM users ORDER BY created_at',
    ).all() as Omit<UserRow, 'password_hash'>[];

    return { users };
  });

  // ─── Update User ────────────────────────────────
  app.patch<{ Params: { id: string } }>('/users/:id', async (request, reply) => {
    const currentUser = request.user as { id: number; role: string };
    const targetId = parseInt(request.params.id, 10);

    // Users can update themselves; admins can update anyone
    if (currentUser.id !== targetId && currentUser.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const body = updateUserSchema.parse(request.body);

    // Only admins can change roles
    if (body.role && currentUser.role !== 'admin') {
      return reply.status(403).send({ error: 'Only admins can change roles' });
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.display_name !== undefined) {
      updates.push('display_name = ?');
      values.push(body.display_name);
    }
    if (body.email !== undefined) {
      updates.push('email = ?');
      values.push(body.email);
    }
    if (body.role !== undefined) {
      updates.push('role = ?');
      values.push(body.role);
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    updates.push('updated_at = datetime("now")');
    values.push(targetId);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare(
      'SELECT id, username, email, role, display_name, avatar_url, created_at FROM users WHERE id = ?',
    ).get(targetId);

    return { user: updated };
  });

  // ─── Change Password ───────────────────────────
  app.post('/users/change-password', async (request, reply) => {
    const currentUser = request.user as { id: number };
    const body = changePasswordSchema.parse(request.body);

    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(currentUser.id) as
      | { password_hash: string }
      | undefined;

    if (!user || !(await bcrypt.compare(body.current_password, user.password_hash))) {
      return reply.status(401).send({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(body.new_password, 12);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?').run(
      hash,
      currentUser.id,
    );

    db.prepare('INSERT INTO audit_log (user_id, action) VALUES (?, ?)').run(
      currentUser.id,
      'user.password_changed',
    );

    return { ok: true, message: 'Password updated' };
  });

  // ─── Delete User (admin only) ──────────────────
  app.delete<{ Params: { id: string } }>('/users/:id', async (request, reply) => {
    const currentUser = request.user as { id: number; role: string };
    const targetId = parseInt(request.params.id, 10);

    if (currentUser.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    if (currentUser.id === targetId) {
      return reply.status(400).send({ error: 'Cannot delete yourself' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    return { ok: true, message: 'User deleted' };
  });
};
