#!/usr/bin/env node
/**
 * ProxNest Agent — Main Entry Point
 *
 * Lightweight daemon that runs on Proxmox servers.
 * - Collects system metrics (CPU, memory, disk, ZFS, guests)
 * - Phones home to ProxNest cloud portal via WebSocket
 * - Accepts remote commands (start/stop VMs, install apps, etc.)
 * - Exposes local REST API for LAN dashboard discovery
 *
 * Usage:
 *   proxnest-agent                    # Normal start
 *   proxnest-agent --status           # Print agent status
 *   proxnest-agent --register TOKEN   # Register with cloud portal
 *   proxnest-agent --reset            # Reset identity and re-register
 */

import { loadConfig, loadIdentity, saveConfig, saveIdentity } from './config.js';
import { createLogger } from './logger.js';
import { MetricsCollector } from './collector.js';
import { ConnectionManager } from './connection.js';
import { CommandExecutor } from './commands.js';
import { LocalApiServer } from './local-api.js';
import { randomUUID } from 'node:crypto';

// ─── CLI Args ─────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
ProxNest Agent v0.1.0

Usage:
  proxnest-agent                     Start the agent daemon
  proxnest-agent --status            Show agent status and identity
  proxnest-agent --register TOKEN    Register with ProxNest cloud
  proxnest-agent --reset             Reset identity (re-register on next start)
  proxnest-agent --local-only        Run without cloud connection (local API only)

Environment:
  PROXNEST_PORTAL_URL       Cloud portal WebSocket URL
  PROXNEST_API_URL          Cloud portal REST API URL
  PROXMOX_HOST              Proxmox API host (default: https://127.0.0.1:8006)
  PROXMOX_TOKEN_ID          Proxmox API token ID
  PROXMOX_TOKEN_SECRET      Proxmox API token secret
  PROXNEST_LOG_LEVEL        Log level (trace/debug/info/warn/error)

Config: /etc/proxnest/agent.json
Identity: /etc/proxnest/identity.json
  `);
  process.exit(0);
}

// ─── Load Config & Identity ───────────────────────
const config = loadConfig();
const log = createLogger(config.logLevel);

if (args.includes('--status')) {
  const identity = loadIdentity();
  console.log(JSON.stringify({
    agentId: identity.agentId,
    serverId: identity.serverId || null,
    claimToken: identity.claimToken || null,
    registeredAt: identity.registeredAt || null,
    portalUrl: config.portalUrl,
    localApiPort: config.localApiPort,
  }, null, 2));
  process.exit(0);
}

if (args.includes('--reset')) {
  const newIdentity = {
    agentId: randomUUID(),
    claimToken: randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase(),
  };
  saveIdentity(newIdentity);
  log.info({ agentId: newIdentity.agentId, claimToken: newIdentity.claimToken }, 'Identity reset');
  process.exit(0);
}

const registerIdx = args.indexOf('--register');
if (registerIdx !== -1) {
  const token = args[registerIdx + 1];
  if (!token) {
    log.error('Registration token required: --register TOKEN');
    process.exit(1);
  }
  saveConfig({ registrationToken: token });
  log.info('Registration token saved. Start the agent to register.');
  process.exit(0);
}

const localOnly = args.includes('--local-only');

// ─── Initialize Components ────────────────────────
const identity = loadIdentity();
const collector = new MetricsCollector(log);
const commandExecutor = new CommandExecutor(log, collector);

log.info('═══════════════════════════════════════');
log.info('  ProxNest Agent v0.1.0');
log.info(`  Agent ID: ${identity.agentId}`);
if (identity.claimToken) {
  log.info(`  Claim Code: ${identity.claimToken}`);
}
if (identity.serverId) {
  log.info(`  Server ID: ${identity.serverId}`);
}
log.info('═══════════════════════════════════════');

// Print initial system info
const sysInfo = collector.getSystemInfo();
log.info({ hostname: sysInfo.hostname, cpu: sysInfo.cpuModel, cores: sysInfo.cpuThreads, ram: `${sysInfo.totalMemoryMB}MB` }, 'System detected');
if (sysInfo.pveVersion) {
  log.info({ pveVersion: sysInfo.pveVersion, kernel: sysInfo.pveKernel }, 'Proxmox VE detected');
}

// ─── Cloud Connection ─────────────────────────────
let connection: ConnectionManager | null = null;

if (!localOnly) {
  connection = new ConnectionManager(config, identity, collector, log);

  connection.onCommand(async (action, params) => {
    return commandExecutor.execute(action, params);
  });

  connection.connect();
} else {
  log.info('Running in local-only mode (no cloud connection)');
}

// ─── Local API Server ─────────────────────────────
const localApi = new LocalApiServer(
  config,
  identity,
  collector,
  connection || new ConnectionManager(config, identity, collector, log), // Dummy for local-only
  log,
);
localApi.start();

// ─── Graceful Shutdown ────────────────────────────
let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log.info({ signal }, 'Shutting down ProxNest Agent...');

  localApi.stop();
  if (connection) connection.disconnect();

  log.info('Goodbye!');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  log.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  log.fatal({ err }, 'Unhandled rejection');
  process.exit(1);
});
