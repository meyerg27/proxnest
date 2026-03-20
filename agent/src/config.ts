/**
 * ProxNest Agent Configuration
 * Loaded from environment variables and /etc/proxnest/agent.json
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const CONFIG_DIR = '/etc/proxnest';
const CONFIG_FILE = join(CONFIG_DIR, 'agent.json');
const IDENTITY_FILE = join(CONFIG_DIR, 'identity.json');

// ─── Schema ───────────────────────────────────────
const ConfigSchema = z.object({
  /** ProxNest cloud portal URL (WebSocket endpoint) */
  portalUrl: z.string().url().default('wss://portal.proxnest.com/agent'),

  /** ProxNest API base URL for REST calls */
  apiUrl: z.string().url().default('https://api.proxnest.com'),

  /** Proxmox API host (auto-detected if not set) */
  proxmoxHost: z.string().default('https://127.0.0.1:8006'),

  /** Proxmox API token ID (e.g., root@pam!proxnest) */
  proxmoxTokenId: z.string().optional(),

  /** Proxmox API token secret */
  proxmoxTokenSecret: z.string().optional(),

  /** How often to send heartbeats (ms) */
  heartbeatInterval: z.number().min(5000).default(30_000),

  /** How often to collect full metrics (ms) */
  metricsInterval: z.number().min(10000).default(60_000),

  /** Reconnect delay after disconnect (ms, doubles each retry up to max) */
  reconnectBaseDelay: z.number().default(5_000),
  reconnectMaxDelay: z.number().default(300_000),

  /** Log level */
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  /** Enable local API server for dashboard discovery */
  localApiPort: z.number().default(9120),

  /** Registration token (provided during setup) */
  registrationToken: z.string().optional(),
});

export type AgentConfig = z.infer<typeof ConfigSchema>;

// ─── Identity ─────────────────────────────────────
const IdentitySchema = z.object({
  agentId: z.string().uuid(),
  serverId: z.string().optional(),
  registeredAt: z.string().optional(),
  claimToken: z.string().optional(),
});

export type AgentIdentity = z.infer<typeof IdentitySchema>;

// ─── Load Config ──────────────────────────────────
function loadFileConfig(): Partial<AgentConfig> {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function loadEnvConfig(): Partial<AgentConfig> {
  const env: Partial<AgentConfig> = {};
  if (process.env.PROXNEST_PORTAL_URL) env.portalUrl = process.env.PROXNEST_PORTAL_URL;
  if (process.env.PROXNEST_API_URL) env.apiUrl = process.env.PROXNEST_API_URL;
  if (process.env.PROXMOX_HOST) env.proxmoxHost = process.env.PROXMOX_HOST;
  if (process.env.PROXMOX_TOKEN_ID) env.proxmoxTokenId = process.env.PROXMOX_TOKEN_ID;
  if (process.env.PROXMOX_TOKEN_SECRET) env.proxmoxTokenSecret = process.env.PROXMOX_TOKEN_SECRET;
  if (process.env.PROXNEST_HEARTBEAT_INTERVAL) env.heartbeatInterval = parseInt(process.env.PROXNEST_HEARTBEAT_INTERVAL, 10);
  if (process.env.PROXNEST_METRICS_INTERVAL) env.metricsInterval = parseInt(process.env.PROXNEST_METRICS_INTERVAL, 10);
  if (process.env.PROXNEST_LOG_LEVEL) env.logLevel = process.env.PROXNEST_LOG_LEVEL as AgentConfig['logLevel'];
  if (process.env.PROXNEST_LOCAL_PORT) env.localApiPort = parseInt(process.env.PROXNEST_LOCAL_PORT, 10);
  if (process.env.PROXNEST_REGISTRATION_TOKEN) env.registrationToken = process.env.PROXNEST_REGISTRATION_TOKEN;
  return env;
}

export function loadConfig(): AgentConfig {
  const fileConfig = loadFileConfig();
  const envConfig = loadEnvConfig();
  // Env overrides file config
  const merged = { ...fileConfig, ...envConfig };
  return ConfigSchema.parse(merged);
}

// ─── Identity Management ─────────────────────────
export function loadIdentity(): AgentIdentity {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  if (existsSync(IDENTITY_FILE)) {
    try {
      const raw = readFileSync(IDENTITY_FILE, 'utf-8');
      return IdentitySchema.parse(JSON.parse(raw));
    } catch {
      // Corrupted identity — regenerate
    }
  }

  // Generate new identity
  const identity: AgentIdentity = {
    agentId: randomUUID(),
    claimToken: randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase(),
  };

  writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2), { mode: 0o600 });
  return identity;
}

export function saveIdentity(identity: AgentIdentity): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2), { mode: 0o600 });
}

export function saveConfig(config: Partial<AgentConfig>): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  const existing = loadFileConfig();
  const merged = { ...existing, ...config };
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), { mode: 0o600 });
}
