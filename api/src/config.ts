import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  JWT_SECRET: z.string().min(16).default('proxnest-dev-secret-change-me!!'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  DATABASE_PATH: z.string().default('./data/proxnest.db'),
  PROXMOX_HOST: z.string().default('https://localhost:8006'),
  PROXMOX_TOKEN_ID: z.string().optional(),
  PROXMOX_TOKEN_SECRET: z.string().optional(),
  PROXMOX_USERNAME: z.string().optional(),
  PROXMOX_PASSWORD: z.string().optional(),
  PROXMOX_VERIFY_SSL: z.coerce.boolean().default(false),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CLOUD_PORTAL_URL: z.string().default('https://portal.proxnest.com'),
  AGENT_SECRET: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

export const config: Config = envSchema.parse(process.env);
