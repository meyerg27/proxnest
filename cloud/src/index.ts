/**
 * ProxNest Cloud Portal — Main Server
 * ═══════════════════════════════════════════════
 * Public cloud service at cloud.proxnest.com
 * Allows users to access their ProxNest servers remotely
 * without port forwarding via WebSocket tunneling.
 *
 * Architecture:
 *   Browser → Cloud API → Agent WebSocket → Local ProxNest API
 *
 * Endpoints:
 *   /api/v1/auth/*       — User registration, login, profile
 *   /api/v1/servers/*    — Server management, claiming
 *   /api/v1/proxy/:id/*  — Proxied dashboard requests to local server
 *   /ws/agent            — Agent WebSocket endpoint (agents connect here)
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { initDatabase, db } from './db.js';
import { agentPool } from './agent-pool.js';
import { authRoutes } from './routes/auth.js';
import { serverRoutes } from './routes/servers.js';
import { memberRoutes } from './routes/members.js';
import { proxyRoutes } from './routes/proxy.js';

// ─── Extend Fastify Types ─────────────────────────
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: number; email: string };
    user: { id: number; email: string };
  }
}

// ─── Create Server ────────────────────────────────
const app = Fastify({
  logger: {
    level: config.LOG_LEVEL,
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss' },
    },
  },
  maxParamLength: 500,
});

// ─── Plugins ──────────────────────────────────────
await app.register(cors, {
  origin: true,
  credentials: true,
});

await app.register(jwt, {
  secret: config.JWT_SECRET,
});

await app.register(websocket, {
  options: {
    maxPayload: config.AGENT_MAX_PAYLOAD,
  },
});

await app.register(rateLimit, {
  max: config.RATE_LIMIT_MAX,
  timeWindow: config.RATE_LIMIT_WINDOW,
});

// ─── Auth Decorator ───────────────────────────────
app.decorate('authenticate', async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ error: 'Unauthorized' });
  }
});

// ─── Global Error Handler ─────────────────────────
app.setErrorHandler((error, request, reply) => {
  if (error.name === 'ZodError') {
    return reply.status(400).send({
      error: 'Validation error',
      details: JSON.parse(error.message),
    });
  }

  if (error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({ error: error.message });
  }

  app.log.error(error);
  return reply.status(500).send({ error: 'Internal server error' });
});

// ─── Agent WebSocket Endpoint ─────────────────────
// Agents connect here to register and maintain persistent connections
app.register(async function agentWsPlugin(fastify) {
  fastify.get('/ws/agent', { websocket: true }, (socket, request) => {
    // Extract public IP — CF tunnel headers first, then forwarded, then raw
    const publicIp =
      (request.headers['cf-connecting-ip'] as string) ||
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (request.headers['x-real-ip'] as string) ||
      request.ip;
    app.log.info({ ip: publicIp }, 'Agent WebSocket connected');
    agentPool.handleConnection(socket as any, publicIp);
  });
});

// ─── Client WebSocket Endpoint ────────────────────
// Browser dashboard clients connect here for real-time updates (install progress, etc.)
app.register(async function clientWsPlugin(fastify) {
  fastify.get('/ws/client', { websocket: true }, async (socket, request) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');
    const serverIdStr = url.searchParams.get('serverId');

    if (!token || !serverIdStr) {
      socket.close(4400, 'Missing token or serverId');
      return;
    }

    // Verify JWT
    let user: { id: number; email: string };
    try {
      user = app.jwt.verify<{ id: number; email: string }>(token);
    } catch {
      socket.close(4401, 'Invalid token');
      return;
    }

    const serverId = parseInt(serverIdStr, 10);

    // Verify user owns this server
    const server = db.prepare(
      'SELECT * FROM servers WHERE id = ? AND user_id = ?',
    ).get(serverId, user.id) as any;

    if (!server) {
      socket.close(4404, 'Server not found');
      return;
    }

    app.log.info({ userId: user.id, serverId }, 'Client WebSocket connected for install progress');

    // Register this client to receive progress updates
    agentPool.registerClient(socket as any, user.id, serverId, server.agent_id);

    // Send initial ack
    socket.send(JSON.stringify({ type: 'connected', serverId }));
  });
});

// ─── API Routes ───────────────────────────────────
await app.register(
  async (api) => {
    await api.register(authRoutes);
    await api.register(serverRoutes);
    await api.register(memberRoutes);
    await api.register(proxyRoutes);
  },
  { prefix: '/api/v1' },
);

// ─── Health & Info ────────────────────────────────
app.get('/', async () => ({
  name: 'ProxNest Cloud',
  version: '0.1.0',
  status: 'operational',
  agents_connected: agentPool.getConnectedCount(),
}));

app.get('/health', async () => ({
  status: 'ok',
  uptime: process.uptime(),
  agents: agentPool.getConnectedCount(),
}));

// ─── Start ────────────────────────────────────────
async function start() {
  try {
    initDatabase();
    app.log.info('Database initialized');

    agentPool.start();
    app.log.info('Agent pool started');

    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`ProxNest Cloud Portal running on http://${config.HOST}:${config.PORT}`);
    app.log.info('Agent WebSocket endpoint: ws://localhost:' + config.PORT + '/ws/agent');
  } catch (err) {
    app.log.fatal(err);
    process.exit(1);
  }
}

// ─── Graceful Shutdown ────────────────────────────
const shutdown = async () => {
  app.log.info('Shutting down...');
  agentPool.stop();
  await app.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
