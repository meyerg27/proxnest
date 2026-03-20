/**
 * ProxNest Cloud Portal — Configuration
 */

export const config = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  HOST: process.env.HOST || '0.0.0.0',
  JWT_SECRET: process.env.JWT_SECRET || 'proxnest-cloud-dev-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  DATABASE_PATH: process.env.DATABASE_PATH || './data/cloud.db',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // Agent connection settings
  AGENT_PING_INTERVAL: 30_000,       // Ping agents every 30s
  AGENT_TIMEOUT: 90_000,             // Consider agent offline after 90s silence
  AGENT_MAX_PAYLOAD: 10 * 1024 * 1024, // 10MB max WS message

  // Rate limiting
  RATE_LIMIT_MAX: 100,
  RATE_LIMIT_WINDOW: '1 minute',

  // bcrypt rounds
  BCRYPT_ROUNDS: 12,
} as const;
