/**
 * ProxNest Cloud Portal — Agent Connection Pool
 * Manages WebSocket connections from ProxNest agents (servers).
 * Handles registration, heartbeats, commands, and dashboard proxying.
 */

import type { WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import { db, type DbServer } from './db.js';
import { config } from './config.js';

// ─── Types ───────────────────────────────────────

interface AgentConnection {
  ws: WebSocket;
  agentId: string;
  serverId: number | null;
  lastSeen: number;
  metrics: AgentMetrics | null;
  pendingCommands: Map<string, {
    resolve: (value: CommandResult) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>;
}

export interface AgentMetrics {
  cpu_usage: number;
  ram_used_mb: number;
  ram_total_mb: number;
  disk_used_gb: number;
  disk_total_gb: number;
  uptime_seconds: number;
  load_average: number[];
  containers_running: number;
  containers_total: number;
  network_rx_bytes: number;
  network_tx_bytes: number;
  timestamp: string;
}

export interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

type AgentMessage =
  | { type: 'register'; agentId: string; claimToken?: string; registrationToken?: string; system: Record<string, unknown> }
  | { type: 'heartbeat'; agentId: string; metrics: AgentMetrics }
  | { type: 'metrics'; agentId: string; metrics: Record<string, unknown> }
  | { type: 'command_result'; agentId: string; commandId: string; success: boolean; data?: unknown; error?: string }
  | { type: 'proxy_response'; requestId: string; status: number; headers: Record<string, string>; body: string }
  | { type: 'install_progress'; agentId: string; data: Record<string, unknown> }
  | { type: 'terminal_data'; agentId: string; sessionId: string; data: string }
  | { type: 'terminal_exit'; agentId: string; sessionId: string; code: number | null }
  | { type: 'terminal_opened'; agentId: string; sessionId: string; success: boolean; error?: string }
  | { type: 'pong' };

/** Client WebSocket connection (browser dashboard user) */
interface ClientConnection {
  ws: WebSocket;
  userId: number;
  serverId: number;
}

// ─── Pool ────────────────────────────────────────

class AgentPool {
  private agents = new Map<string, AgentConnection>();
  private clients = new Map<string, ClientConnection[]>(); // agentId → client WS list
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    // Periodically mark stale agents offline
    this.cleanupTimer = setInterval(() => this.cleanupStale(), 30_000);
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    // Close all connections
    for (const conn of this.agents.values()) {
      conn.ws.close(1001, 'Server shutting down');
    }
    this.agents.clear();
  }

  // ─── Handle new agent WebSocket ──────────────

  handleConnection(ws: WebSocket, publicIp?: string): void {
    let agentId: string | null = null;
    const connPublicIp = publicIp || null;

    ws.on('message', (raw) => {
      let msg: AgentMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        return;
      }

      switch (msg.type) {
        case 'register':
          agentId = msg.agentId;
          this.handleRegister(ws, msg, connPublicIp);
          break;
        case 'heartbeat':
          if (agentId) this.handleHeartbeat(agentId, msg.metrics);
          break;
        case 'metrics':
          if (agentId) this.handleFullMetrics(agentId, msg.metrics);
          break;
        case 'command_result':
          if (agentId) this.handleCommandResult(agentId, msg);
          break;
        case 'install_progress':
          if (agentId) this.broadcastToClients(agentId, { type: 'install_progress', data: msg.data });
          break;
        case 'terminal_data':
        case 'terminal_exit':
        case 'terminal_opened':
          if (agentId) this.broadcastToClients(agentId, msg);
          break;
        case 'proxy_response':
          if (agentId) this.handleProxyResponse(agentId, msg);
          break;
        case 'pong':
          if (agentId) {
            const conn = this.agents.get(agentId);
            if (conn) conn.lastSeen = Date.now();
          }
          break;
      }
    });

    ws.on('close', () => {
      if (agentId) {
        this.agents.delete(agentId);
        // Mark offline in DB
        db.prepare(`UPDATE servers SET is_online = 0, last_seen = datetime('now') WHERE agent_id = ?`)
          .run(agentId);
      }
    });

    ws.on('error', () => {
      if (agentId) this.agents.delete(agentId);
    });

    // Ping to keep alive
    const pingTimer = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      } else {
        clearInterval(pingTimer);
      }
    }, config.AGENT_PING_INTERVAL);

    ws.on('close', () => clearInterval(pingTimer));
  }

  // ─── Registration ─────────────────────────────

  private handleRegister(
    ws: WebSocket,
    msg: { agentId: string; claimToken?: string; registrationToken?: string; system: Record<string, unknown> },
    publicIp?: string | null,
  ): void {
    const { agentId, claimToken, system } = msg;

    // Check if agent already registered in DB
    let server = db.prepare('SELECT * FROM servers WHERE agent_id = ?').get(agentId) as DbServer | undefined;

    if (!server) {
      // New agent — create registration
      const newClaimToken = claimToken || nanoid(8).toUpperCase();

      const result = db.prepare(
        `INSERT INTO servers (agent_id, claim_token, hostname, os, cpu_model, cpu_cores, ram_total_mb, proxmox_version, agent_version, public_ip, is_online, last_seen)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
      ).run(
        agentId,
        newClaimToken,
        system.hostname || null,
        system.os || null,
        system.cpuModel || null,
        system.cpuCores || null,
        system.ramTotalMb || null,
        system.proxmoxVersion || null,
        system.agentVersion || '0.1.0',
        publicIp || null,
      );

      server = db.prepare('SELECT * FROM servers WHERE id = ?').get(result.lastInsertRowid) as DbServer;

      ws.send(JSON.stringify({
        type: 'registered',
        serverId: String(server.id),
      }));
    } else {
      // Existing agent — update info and mark online
      db.prepare(
        `UPDATE servers SET
           hostname = COALESCE(?, hostname),
           os = COALESCE(?, os),
           cpu_model = COALESCE(?, cpu_model),
           cpu_cores = COALESCE(?, cpu_cores),
           ram_total_mb = COALESCE(?, ram_total_mb),
           proxmox_version = COALESCE(?, proxmox_version),
           agent_version = COALESCE(?, agent_version),
           public_ip = COALESCE(?, public_ip),
           is_online = 1,
           last_seen = datetime('now'),
           updated_at = datetime('now')
         WHERE agent_id = ?`,
      ).run(
        system.hostname || null,
        system.os || null,
        system.cpuModel || null,
        system.cpuCores || null,
        system.ramTotalMb || null,
        system.proxmoxVersion || null,
        system.agentVersion || null,
        publicIp || null,
        agentId,
      );

      ws.send(JSON.stringify({
        type: 'registered',
        serverId: String(server.id),
      }));
    }

    // Store connection
    this.agents.set(agentId, {
      ws,
      agentId,
      serverId: server.id,
      lastSeen: Date.now(),
      metrics: null,
      pendingCommands: new Map(),
    });
  }

  // ─── Heartbeat ────────────────────────────────

  private handleHeartbeat(agentId: string, rawMetrics: any): void {
    const conn = this.agents.get(agentId);
    if (conn) {
      conn.lastSeen = Date.now();
      // Normalize nested heartbeat format to flat AgentMetrics
      conn.metrics = {
        timestamp: rawMetrics.timestamp || new Date().toISOString(),
        uptimeSeconds: rawMetrics.uptimeSeconds ?? rawMetrics.uptime_seconds ?? 0,
        cpu: rawMetrics.cpu ?? { usagePercent: rawMetrics.cpu_usage ?? 0, loadAvg: 0 },
        memory: rawMetrics.memory ?? { usagePercent: 0, usedMB: rawMetrics.ram_used_mb ?? 0, totalMB: rawMetrics.ram_total_mb ?? 0 },
        disk: rawMetrics.disk ?? { usedGB: rawMetrics.disk_used_gb ?? 0, totalGB: rawMetrics.disk_total_gb ?? 0 },
        guestCount: rawMetrics.guestCount ?? { running: rawMetrics.containers_running ?? 0, stopped: rawMetrics.containers_total ? rawMetrics.containers_total - (rawMetrics.containers_running ?? 0) : 0 },
      } as any;
    }

    db.prepare(`UPDATE servers SET is_online = 1, last_seen = datetime('now') WHERE agent_id = ?`)
      .run(agentId);
  }

  private handleFullMetrics(agentId: string, metrics: Record<string, unknown>): void {
    const conn = this.agents.get(agentId);
    if (conn) {
      conn.lastSeen = Date.now();
      // Store full metrics (could persist to time-series DB later)
    }
  }

  // ─── Command Handling ─────────────────────────

  private handleCommandResult(agentId: string, msg: { commandId: string; success: boolean; data?: unknown; error?: string }): void {
    const conn = this.agents.get(agentId);
    if (!conn) return;

    const pending = conn.pendingCommands.get(msg.commandId);
    if (pending) {
      clearTimeout(pending.timer);
      conn.pendingCommands.delete(msg.commandId);
      pending.resolve({ success: msg.success, data: msg.data, error: msg.error });
    }
  }

  // ─── Proxy Response ───────────────────────────

  private proxyCallbacks = new Map<string, {
    resolve: (value: { status: number; headers: Record<string, string>; body: string }) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

  private handleProxyResponse(agentId: string, msg: { requestId: string; status: number; headers: Record<string, string>; body: string }): void {
    const cb = this.proxyCallbacks.get(msg.requestId);
    if (cb) {
      clearTimeout(cb.timer);
      this.proxyCallbacks.delete(msg.requestId);
      cb.resolve({ status: msg.status, headers: msg.headers, body: msg.body });
    }
  }

  // ─── Client WebSocket Management ──────────────

  /** Register a browser client to receive real-time updates for a specific server/agent */
  registerClient(ws: WebSocket, userId: number, serverId: number, agentId: string): void {
    const client: ClientConnection = { ws, userId, serverId };
    const list = this.clients.get(agentId) || [];
    list.push(client);
    this.clients.set(agentId, list);

    ws.on('close', () => this.removeClient(agentId, ws));
    ws.on('error', () => this.removeClient(agentId, ws));
  }

  private removeClient(agentId: string, ws: WebSocket): void {
    const list = this.clients.get(agentId);
    if (!list) return;
    const filtered = list.filter(c => c.ws !== ws);
    if (filtered.length === 0) {
      this.clients.delete(agentId);
    } else {
      this.clients.set(agentId, filtered);
    }
  }

  /** Broadcast a message to all browser clients watching this agent */
  private broadcastToClients(agentId: string, msg: Record<string, unknown>): void {
    const list = this.clients.get(agentId);
    if (!list || list.length === 0) return;
    const payload = JSON.stringify(msg);
    for (const client of list) {
      if (client.ws.readyState === client.ws.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  // ─── Public API ───────────────────────────────

  isOnline(agentId: string): boolean {
    const conn = this.agents.get(agentId);
    if (!conn) return false;
    return (Date.now() - conn.lastSeen) < config.AGENT_TIMEOUT;
  }

  getMetrics(agentId: string): AgentMetrics | null {
    return this.agents.get(agentId)?.metrics || null;
  }

  sendToAgent(agentId: string, msg: Record<string, unknown>): boolean {
    const conn = this.agents.get(agentId);
    if (!conn || conn.ws.readyState !== conn.ws.OPEN) return false;
    conn.ws.send(JSON.stringify(msg));
    return true;
  }

  async sendCommand(agentId: string, action: string, params: Record<string, unknown>, timeoutMs = 300_000): Promise<CommandResult> {
    const conn = this.agents.get(agentId);
    if (!conn || conn.ws.readyState !== conn.ws.OPEN) {
      throw new Error('Agent not connected');
    }

    const commandId = nanoid(16);

    return new Promise<CommandResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        conn.pendingCommands.delete(commandId);
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      conn.pendingCommands.set(commandId, { resolve, reject, timer });

      conn.ws.send(JSON.stringify({
        type: 'command',
        commandId,
        action,
        params,
      }));
    });
  }

  /**
   * Proxy an HTTP request through the agent's local API.
   * Cloud dashboard → Cloud API → Agent WS → Agent local API → response back.
   */
  async proxyRequest(
    agentId: string,
    method: string,
    path: string,
    body?: unknown,
    timeoutMs = 30_000,
  ): Promise<{ status: number; headers: Record<string, string>; body: string }> {
    const conn = this.agents.get(agentId);
    if (!conn || conn.ws.readyState !== conn.ws.OPEN) {
      throw new Error('Agent not connected');
    }

    const requestId = nanoid(16);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.proxyCallbacks.delete(requestId);
        reject(new Error(`Proxy request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.proxyCallbacks.set(requestId, { resolve, reject, timer });

      conn.ws.send(JSON.stringify({
        type: 'proxy_request',
        requestId,
        method,
        path,
        body: body ? JSON.stringify(body) : undefined,
      }));
    });
  }

  getConnectedCount(): number {
    return this.agents.size;
  }

  /** Look up which agentId is associated with a given server connection */
  getAgentIdForServerId(serverId: number): string | null {
    for (const conn of this.agents.values()) {
      if (conn.serverId === serverId) return conn.agentId;
    }
    return null;
  }

  // ─── Cleanup ──────────────────────────────────

  private cleanupStale(): void {
    const now = Date.now();
    for (const [agentId, conn] of this.agents) {
      if (now - conn.lastSeen > config.AGENT_TIMEOUT) {
        conn.ws.close(4000, 'Stale connection');
        this.agents.delete(agentId);
        db.prepare(`UPDATE servers SET is_online = 0, last_seen = datetime('now') WHERE agent_id = ?`)
          .run(agentId);
      }
    }
  }
}

// Singleton
export const agentPool = new AgentPool();
