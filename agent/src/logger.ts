/**
 * ProxNest Agent Logger
 */

import pino from 'pino';

export function createLogger(level: string = 'info') {
  return pino({
    level,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;
