/**
 * ProxNest Agent — WebSocket Connection Manager
 * Handles persistent connection to ProxNest cloud portal
 * with automatic reconnection, heartbeats, and command handling.
 */

import WebSocket from 'ws';
import type { AgentConfig, AgentIdentity } from './config.js';
import { saveIdentity } from './config.js';
import { MetricsCollector, type FullMetrics, type HeartbeatMetrics } from './collector.js';
import type { Logger } from './logger.js';

// ─── Protocol Messages ───────────────────────────

type OutgoingMessage =
  | { type: 'register'; agentId: string; claimToken?: string; registrationToken?: string; system: FullMetrics['system'] }
  | { type: 'heartbeat'; agentId: string; metrics: HeartbeatMetrics }
  | { type: 'metrics'; agentId: string; metrics: FullMetrics }
  | { type: 'command_result'; agentId: string; commandId: string; success: boolean; data?: unknown; error?: string }
  | { type: 'pong' };

type IncomingMessage =
  | { type: 'registered'; serverId: string }
  | { type: 'claimed'; userId: string; serverName: string }
  | { type: 'command'; commandId: string; action: string; params?: Record<string, unknown> }
  | { type: 'request_metrics' }
  | { type: 'config_update'; config: Partial<AgentConfig> }
  | { type: 'ping' }
  | { type: 'error'; message: string };

export type CommandHandler = (
  action: string,
  params: Record<string, unknown>,
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

// ─── Connection Manager ──────────────────────────

export class ConnectionManager {
  private ws: WebSocket | null = null;
  private config: AgentConfig;
  private identity: AgentIdentity;
  private collector: MetricsCollector;
  private log: Logger;
  private commandHandler: CommandHandler | null = null;

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private metricsTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private isConnected = false;
  private isStopping = false;

  constructor(
    config: AgentConfig,
    identity: AgentIdentity,
    collector: MetricsCollector,
    logger: Logger,
  ) {
    this.config = config;
    this.identity = identity;
    this.collector = collector;
    this.log = logger;
  }

  // ─── Public API ─────────────────────────────
  onCommand(handler: CommandHandler): void {
    this.commandHandler = handler;
  }

  connect(): void {
    if (this.isStopping) return;

    this.log.info({ url: this.config.portalUrl }, 'Connecting to ProxNest portal...');

    try {
      this.ws = new WebSocket(this.config.portalUrl, {
        headers: {
          'X-Agent-Id': this.identity.agentId,
          'X-Agent-Version': '0.1.0',
        },
        handshakeTimeout: 10_000,
      });

      this.ws.on('open', () => this.onOpen());
      this.ws.on('message', (data) => this.onMessage(data));
      this.ws.on('close', (code, reason) => this.onClose(code, reason.toString()));
      this.ws.on('error', (err) => this.onError(err));
    } catch (err) {
      this.log.error({ err }, 'Failed to create WebSocket connection');
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.isStopping = true;
    this.clearTimers();
    if (this.ws) {
      this.ws.close(1000, 'Agent shutting down');
      this.ws = null;
    }
    this.isConnected = false;
  }

  get connected(): boolean {
    return this.isConnected;
  }

  // ─── Event Handlers ────────────────────────

  private onOpen(): void {
    this.log.info('Connected to ProxNest portal');
    this.isConnected = true;
    this.reconnectAttempt = 0;

    // Send registration
    const system = this.collector.getSystemInfo();
    this.send({
      type: 'register',
      agentId: this.identity.agentId,
      claimToken: this.identity.claimToken,
      registrationToken: this.config.registrationToken,
      system,
    });

    // Start periodic heartbeats and metrics
    this.startTimers();
  }

  private onMessage(raw: WebSocket.RawData): void {
    let msg: IncomingMessage;
    try {
      msg = JSON.parse(raw.toString()) as IncomingMessage;
    } catch {
      this.log.warn('Received invalid JSON from portal');
      return;
    }

    this.log.debug({ type: msg.type }, 'Received message');

    switch (msg.type) {
      case 'registered':
        this.handleRegistered(msg);
        break;
      case 'claimed':
        this.handleClaimed(msg);
        break;
      case 'command':
        this.handleCommand(msg);
        break;
      case 'request_metrics':
        this.sendFullMetrics();
        break;
      case 'config_update':
        this.handleConfigUpdate(msg);
        break;
      case 'ping':
        this.send({ type: 'pong' });
        break;
      case 'error':
        this.log.error({ message: msg.message }, 'Portal error');
        break;
    }
  }

  private onClose(code: number, reason: string): void {
    this.log.info({ code, reason }, 'Disconnected from portal');
    this.isConnected = false;
    this.clearTimers();

    if (!this.isStopping) {
      this.scheduleReconnect();
    }
  }

  private onError(err: Error): void {
    this.log.error({ err: err.message }, 'WebSocket error');
  }

  // ─── Message Handlers ─────────────────────

  private handleRegistered(msg: { serverId: string }): void {
    this.log.info({ serverId: msg.serverId }, 'Agent registered with portal');
    this.identity.serverId = msg.serverId;
    this.identity.registeredAt = new Date().toISOString();
    saveIdentity(this.identity);

    if (this.identity.claimToken) {
      this.log.info('─────────────────────────────────────');
      this.log.info(`  Claim Code: ${this.identity.claimToken}`);
      this.log.info('  Use this code in the ProxNest dashboard');
      this.log.info('  to link this server to your account.');
      this.log.info('─────────────────────────────────────');
    }
  }

  private handleClaimed(msg: { userId: string; serverName: string }): void {
    this.log.info({ userId: msg.userId, serverName: msg.serverName }, 'Server claimed by user');
    // Clear claim token — server is now linked
    delete this.identity.claimToken;
    saveIdentity(this.identity);
  }

  private async handleCommand(msg: { commandId: string; action: string; params?: Record<string, unknown> }): Promise<void> {
    if (!this.commandHandler) {
      this.send({
        type: 'command_result',
        agentId: this.identity.agentId,
        commandId: msg.commandId,
        success: false,
        error: 'No command handler registered',
      });
      return;
    }

    this.log.info({ action: msg.action, commandId: msg.commandId }, 'Executing command');

    try {
      const result = await this.commandHandler(msg.action, msg.params || {});
      this.send({
        type: 'command_result',
        agentId: this.identity.agentId,
        commandId: msg.commandId,
        ...result,
      });
    } catch (err) {
      this.send({
        type: 'command_result',
        agentId: this.identity.agentId,
        commandId: msg.commandId,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private handleConfigUpdate(msg: { config: Partial<AgentConfig> }): void {
    this.log.info('Received config update from portal');
    // Apply runtime config changes (non-persistent)
    if (msg.config.heartbeatInterval) {
      this.config.heartbeatInterval = msg.config.heartbeatInterval;
      this.restartTimers();
    }
    if (msg.config.metricsInterval) {
      this.config.metricsInterval = msg.config.metricsInterval;
      this.restartTimers();
    }
  }

  // ─── Metrics Sending ──────────────────────

  private sendHeartbeat(): void {
    if (!this.isConnected) return;
    try {
      const metrics = this.collector.collectHeartbeat();
      this.send({
        type: 'heartbeat',
        agentId: this.identity.agentId,
        metrics,
      });
    } catch (err) {
      this.log.error({ err }, 'Failed to collect heartbeat metrics');
    }
  }

  private sendFullMetrics(): void {
    if (!this.isConnected) return;
    try {
      const metrics = this.collector.collectFull();
      this.send({
        type: 'metrics',
        agentId: this.identity.agentId,
        metrics,
      });
      this.log.debug('Full metrics sent');
    } catch (err) {
      this.log.error({ err }, 'Failed to collect full metrics');
    }
  }

  // ─── Timers ───────────────────────────────

  private startTimers(): void {
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.config.heartbeatInterval);
    this.metricsTimer = setInterval(() => this.sendFullMetrics(), this.config.metricsInterval);

    // Send initial full metrics
    setTimeout(() => this.sendFullMetrics(), 2000);
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (this.metricsTimer) { clearInterval(this.metricsTimer); this.metricsTimer = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
  }

  private restartTimers(): void {
    this.clearTimers();
    if (this.isConnected) this.startTimers();
  }

  // ─── Reconnection ────────────────────────

  private scheduleReconnect(): void {
    if (this.isStopping) return;

    const delay = Math.min(
      this.config.reconnectBaseDelay * Math.pow(2, this.reconnectAttempt),
      this.config.reconnectMaxDelay,
    );
    this.reconnectAttempt++;

    this.log.info({ delay: Math.round(delay / 1000), attempt: this.reconnectAttempt }, 'Reconnecting in seconds...');

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  // ─── Send Helper ──────────────────────────

  private send(msg: OutgoingMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(msg));
    } catch (err) {
      this.log.error({ err }, 'Failed to send message');
    }
  }
}
