/**
 * ProxNest Cloud Portal — Dashboard Proxy Routes
 * Proxies dashboard API requests from cloud portal to user's local server
 * through the agent's WebSocket tunnel. No port forwarding needed.
 *
 * Flow: Browser → Cloud API /proxy/:serverId/* → Agent WS → Agent Local API → Response
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { db, type DbServer } from '../db.js';
import { agentPool } from '../agent-pool.js';

// ─── Routes ──────────────────────────────────────

export const proxyRoutes: FastifyPluginAsync = async (app) => {
  // ━━━ ALL /proxy/:serverId/* — Proxy to agent ━━━
  // Catches all methods: GET, POST, PUT, PATCH, DELETE
  app.all('/proxy/:serverId/*', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { serverId } = request.params as { serverId: string };
    const wildcardPath = (request.params as any)['*'] || '';

    // Verify the user owns this server
    const server = db.prepare(
      'SELECT * FROM servers WHERE id = ? AND user_id = ?',
    ).get(parseInt(serverId, 10), request.user.id) as DbServer | undefined;

    if (!server) {
      return reply.status(404).send({ error: 'Server not found' });
    }

    if (!agentPool.isOnline(server.agent_id)) {
      return reply.status(503).send({
        error: 'Server is offline',
        server_name: server.name,
        last_seen: server.last_seen,
      });
    }

    // Proxy the request through the agent WebSocket
    try {
      const proxyPath = `/${wildcardPath}${request.url.includes('?') ? '?' + request.url.split('?')[1] : ''}`;

      const result = await agentPool.proxyRequest(
        server.agent_id,
        request.method,
        proxyPath,
        request.body,
        30_000,
      );

      // Forward response
      reply.status(result.status);

      // Forward safe headers
      const safeHeaders = ['content-type', 'cache-control', 'etag', 'last-modified'];
      for (const header of safeHeaders) {
        if (result.headers[header]) {
          reply.header(header, result.headers[header]);
        }
      }

      return reply.send(result.body);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Proxy request failed';

      if (message.includes('timed out')) {
        return reply.status(504).send({ error: 'Server did not respond in time' });
      }
      if (message.includes('not connected')) {
        return reply.status(503).send({ error: 'Server went offline during request' });
      }

      return reply.status(502).send({ error: message });
    }
  });

  // ━━━ WebSocket Proxy — Real-time dashboard streaming ━━━
  // For live metrics, log tailing, terminal access
  app.get('/proxy/:serverId/ws', {
    websocket: true,
    onRequest: [app.authenticate],
  }, async (socket: any, request: FastifyRequest) => {
    const { serverId } = request.params as { serverId: string };

    const server = db.prepare(
      'SELECT * FROM servers WHERE id = ? AND user_id = ?',
    ).get(parseInt(serverId, 10), request.user.id) as DbServer | undefined;

    if (!server) {
      socket.close(4004, 'Server not found');
      return;
    }

    if (!agentPool.isOnline(server.agent_id)) {
      socket.close(4503, 'Server offline');
      return;
    }

    // Set up bidirectional WebSocket proxy
    // Client ↔ Cloud ↔ Agent

    // Forward client messages to agent
    socket.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        agentPool.sendToAgent(server.agent_id, {
          type: 'ws_proxy',
          clientId: request.user.id.toString(),
          data: msg,
        });
      } catch {
        // Ignore malformed messages
      }
    });

    // Register this client for receiving proxied WS messages
    // (Agent pool would route messages back — simplified here)

    socket.on('close', () => {
      // Cleanup proxy registration
    });

    socket.on('error', () => {
      // Handle errors
    });

    // Notify agent about new WS client
    agentPool.sendToAgent(server.agent_id, {
      type: 'ws_proxy_connect',
      clientId: request.user.id.toString(),
      serverId: server.id,
    });
  });

  // ━━━ GET /proxy/:serverId/status — Quick health check ━━━
  app.get('/proxy-status/:serverId', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { serverId } = request.params as { serverId: string };

    const server = db.prepare(
      'SELECT * FROM servers WHERE id = ? AND user_id = ?',
    ).get(parseInt(serverId, 10), request.user.id) as DbServer | undefined;

    if (!server) return reply.status(404).send({ error: 'Server not found' });

    const online = agentPool.isOnline(server.agent_id);
    const metrics = agentPool.getMetrics(server.agent_id);

    return {
      server_id: server.id,
      name: server.name,
      online,
      last_seen: server.last_seen,
      metrics: online ? metrics : null,
    };
  });
};
