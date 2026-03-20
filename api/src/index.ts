import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { config } from './config.js';
import { initDatabase } from './db.js';
import { authRoutes } from './routes/auth.js';
import { nodeRoutes } from './routes/nodes.js';
import { storageRoutes } from './routes/storage.js';
import { appRoutes } from './routes/apps.js';
import { userRoutes } from './routes/users.js';
import { systemRoutes } from './routes/system.js';

// ─── Extend Fastify Types ─────────────────────────
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: number; username: string; role: string };
    user: { id: number; username: string; role: string };
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
});

// ─── Plugins ──────────────────────────────────────
await app.register(cors, {
  origin: true,
  credentials: true,
});

await app.register(jwt, {
  secret: config.JWT_SECRET,
});

// ─── Auth Decorator ───────────────────────────────
app.decorate('authenticate', async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
});

// ─── Global Error Handler ─────────────────────────
app.setErrorHandler((error, request, reply) => {
  // Zod validation errors
  if (error.name === 'ZodError') {
    return reply.status(400).send({
      error: 'Validation error',
      details: JSON.parse(error.message),
    });
  }

  // Known status codes
  if (error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({ error: error.message });
  }

  // Unknown errors
  app.log.error(error);
  return reply.status(500).send({ error: 'Internal server error' });
});

// ─── Routes ───────────────────────────────────────
// All routes are prefixed with /api/v1
await app.register(
  async (api) => {
    await api.register(authRoutes);
    await api.register(nodeRoutes);
    await api.register(storageRoutes);
    await api.register(appRoutes);
    await api.register(userRoutes);
    await api.register(systemRoutes);
  },
  { prefix: '/api/v1' },
);

// ─── Root ─────────────────────────────────────────
app.get('/', async () => ({
  name: 'ProxNest API',
  version: '0.1.0',
  docs: '/api/v1/health',
}));

// ─── Start ────────────────────────────────────────
async function start() {
  try {
    // Initialize database
    initDatabase();
    app.log.info('Database initialized');

    // Start server
    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`ProxNest API running on http://${config.HOST}:${config.PORT}`);
    app.log.info(`Proxmox host: ${config.PROXMOX_HOST}`);
  } catch (err) {
    app.log.fatal(err);
    process.exit(1);
  }
}

start();
