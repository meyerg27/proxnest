/**
 * ProxNest Agent — Local HTTP API Server
 * Provides a lightweight REST API on localhost for:
 * - Dashboard discovery (mDNS alternative)
 * - Local status checks
 * - Direct control when cloud is unreachable
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AgentConfig, AgentIdentity } from './config.js';
import { MetricsCollector } from './collector.js';
import { ConnectionManager } from './connection.js';
import type { Logger } from './logger.js';

export class LocalApiServer {
  private server: ReturnType<typeof createServer> | null = null;
  private config: AgentConfig;
  private identity: AgentIdentity;
  private collector: MetricsCollector;
  private connection: ConnectionManager;
  private log: Logger;

  constructor(
    config: AgentConfig,
    identity: AgentIdentity,
    collector: MetricsCollector,
    connection: ConnectionManager,
    logger: Logger,
  ) {
    this.config = config;
    this.identity = identity;
    this.collector = collector;
    this.connection = connection;
    this.log = logger;
  }

  start(): void {
    this.server = createServer((req, res) => this.handleRequest(req, res));

    this.server.listen(this.config.localApiPort, '0.0.0.0', () => {
      this.log.info({ port: this.config.localApiPort }, 'Local API server listening');
    });

    this.server.on('error', (err) => {
      this.log.error({ err }, 'Local API server error');
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // CORS headers for local dashboard
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://localhost:${this.config.localApiPort}`);
    const path = url.pathname;

    try {
      switch (path) {
        case '/':
        case '/api/status':
          this.json(res, {
            name: 'ProxNest Agent',
            version: '0.1.0',
            agentId: this.identity.agentId,
            serverId: this.identity.serverId || null,
            cloudConnected: this.connection.connected,
            claimToken: this.identity.claimToken || null,
          });
          break;

        case '/api/discovery':
          // Used by dashboard to find ProxNest servers on the LAN
          this.json(res, {
            type: 'proxnest-agent',
            version: '0.1.0',
            agentId: this.identity.agentId,
            hostname: this.collector.getSystemInfo().hostname,
            proxmox: !!this.collector.getSystemInfo().pveVersion,
            port: this.config.localApiPort,
          });
          break;

        case '/api/metrics':
          this.json(res, this.collector.collectFull());
          break;

        case '/api/heartbeat':
          this.json(res, this.collector.collectHeartbeat());
          break;

        case '/api/system':
          this.json(res, this.collector.getSystemInfo());
          break;

        case '/api/guests':
          this.json(res, this.collector.getGuests());
          break;

        case '/api/storage':
          this.json(res, {
            disks: this.collector.getDiskMetrics(),
            zfsPools: this.collector.getZfsPools(),
          });
          break;

        case '/api/network':
          this.json(res, this.collector.getNetworkMetrics());
          break;

        default:
          res.writeHead(404);
          this.json(res, { error: 'Not found' }, 404);
      }
    } catch (err) {
      this.log.error({ err, path }, 'Local API request error');
      this.json(res, { error: 'Internal server error' }, 500);
    }
  }

  private json(res: ServerResponse, data: unknown, status = 200): void {
    if (!res.headersSent) {
      res.writeHead(status);
    }
    res.end(JSON.stringify(data));
  }
}
