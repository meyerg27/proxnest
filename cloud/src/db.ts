/**
 * ProxNest Cloud Portal — Database
 * SQLite with users, servers, and sessions tables.
 */

import Database from 'better-sqlite3';
import { config } from './config.js';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

// Ensure data directory exists
mkdirSync(dirname(config.DATABASE_PATH), { recursive: true });

export const db = new Database(config.DATABASE_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  db.exec(`
    -- ═══════════════════════════════════════
    -- Users — cloud portal accounts
    -- ═══════════════════════════════════════
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      plan TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free', 'pro')),
      max_servers INTEGER NOT NULL DEFAULT 1,
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login TEXT
    );

    -- ═══════════════════════════════════════
    -- Servers — registered ProxNest agents
    -- ═══════════════════════════════════════
    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      agent_id TEXT UNIQUE NOT NULL,
      claim_token TEXT UNIQUE,
      name TEXT NOT NULL DEFAULT 'My Server',
      hostname TEXT,
      os TEXT,
      cpu_model TEXT,
      cpu_cores INTEGER,
      ram_total_mb INTEGER,
      proxmox_version TEXT,
      agent_version TEXT,
      ip_address TEXT,
      last_seen TEXT,
      is_online INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_servers_user_id ON servers(user_id);
    CREATE INDEX IF NOT EXISTS idx_servers_agent_id ON servers(agent_id);
    CREATE INDEX IF NOT EXISTS idx_servers_claim_token ON servers(claim_token);

    -- ═══════════════════════════════════════
    -- Sessions — active JWT sessions
    -- ═══════════════════════════════════════
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_jti TEXT UNIQUE NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token_jti ON sessions(token_jti);

    -- ═══════════════════════════════════════
    -- Audit log
    -- ═══════════════════════════════════════
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      resource TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ─── Typed query helpers ────────────────────────

export interface DbUser {
  id: number;
  email: string;
  password_hash: string;
  display_name: string | null;
  avatar_url: string | null;
  plan: 'free' | 'pro';
  max_servers: number;
  email_verified: number;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export interface DbServer {
  id: number;
  user_id: number | null;
  agent_id: string;
  claim_token: string | null;
  name: string;
  hostname: string | null;
  os: string | null;
  cpu_model: string | null;
  cpu_cores: number | null;
  ram_total_mb: number | null;
  proxmox_version: string | null;
  agent_version: string | null;
  ip_address: string | null;
  last_seen: string | null;
  is_online: number;
  created_at: string;
  updated_at: string;
}

export interface DbSession {
  id: number;
  user_id: number;
  token_jti: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: string;
  revoked: number;
  created_at: string;
}
