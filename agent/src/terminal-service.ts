/**
 * ProxNest Agent — Terminal Service
 * Manages interactive PTY sessions for VM/CT console access.
 * Uses `script` command as a PTY wrapper for pct exec / qm terminal.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import type { Logger } from './logger.js';

interface TerminalSession {
  sessionId: string;
  vmid: number;
  guestType: 'lxc' | 'qemu' | 'host';
  process: ChildProcess;
  alive: boolean;
  cols: number;
  rows: number;
}

export class TerminalService {
  private sessions = new Map<string, TerminalSession>();
  private log: Logger;
  private onData: (sessionId: string, data: string) => void;
  private onExit: (sessionId: string, code: number | null) => void;
  private maxSessions = 10;

  constructor(
    logger: Logger,
    onData: (sessionId: string, data: string) => void,
    onExit: (sessionId: string, code: number | null) => void,
  ) {
    this.log = logger;
    this.onData = onData;
    this.onExit = onExit;
  }

  open(sessionId: string, vmid: number, guestType: 'lxc' | 'qemu' | 'host', cols = 80, rows = 24): { success: boolean; error?: string } {
    if (this.sessions.has(sessionId)) {
      return { success: false, error: 'Session already exists' };
    }

    if (this.sessions.size >= this.maxSessions) {
      return { success: false, error: 'Too many active terminal sessions' };
    }

    let innerCmd: string;
    if (guestType === 'host') {
      // Host shell — direct bash on the Proxmox server
      innerCmd = `TERM=xterm-256color /bin/bash -l`;
    } else if (guestType === 'lxc') {
      if (!Number.isInteger(vmid) || vmid < 1 || vmid > 999999999) {
        return { success: false, error: 'Invalid VMID' };
      }
      innerCmd = `TERM=xterm-256color pct exec ${vmid} -- /bin/bash -l`;
    } else {
      if (!Number.isInteger(vmid) || vmid < 1 || vmid > 999999999) {
        return { success: false, error: 'Invalid VMID' };
      }
      innerCmd = `qm terminal ${vmid}`;
    }

    this.log.info({ sessionId, vmid, guestType }, 'Opening terminal session');

    try {
      // Use `script` as a PTY wrapper — this gives us proper terminal behavior
      // (colors, cursor positioning, tab completion, etc.)
      const proc = spawn('script', ['-qfc', innerCmd, '/dev/null'], {
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLUMNS: String(cols),
          LINES: String(rows),
        },
      });

      const session: TerminalSession = {
        sessionId,
        vmid,
        guestType,
        process: proc,
        alive: true,
        cols,
        rows,
      };

      proc.stdout?.on('data', (chunk: Buffer) => {
        if (!session.alive) return;
        // Send as base64 to preserve binary terminal sequences
        this.onData(sessionId, chunk.toString('base64'));
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        if (!session.alive) return;
        this.onData(sessionId, chunk.toString('base64'));
      });

      proc.on('close', (code) => {
        this.log.info({ sessionId, code }, 'Terminal session ended');
        session.alive = false;
        this.sessions.delete(sessionId);
        this.onExit(sessionId, code);
      });

      proc.on('error', (err) => {
        this.log.error({ sessionId, err: err.message }, 'Terminal process error');
        session.alive = false;
        this.sessions.delete(sessionId);
        this.onExit(sessionId, -1);
      });

      this.sessions.set(sessionId, session);
      return { success: true };
    } catch (err) {
      this.log.error({ sessionId, err }, 'Failed to spawn terminal');
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  write(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session?.alive || !session.process.stdin?.writable) return false;

    try {
      const buf = Buffer.from(data, 'base64');
      session.process.stdin.write(buf);
      return true;
    } catch {
      return false;
    }
  }

  resize(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session?.alive) return false;

    session.cols = cols;
    session.rows = rows;

    // Best-effort resize via stty (works inside the script PTY)
    try {
      if (session.process.stdin?.writable) {
        // Send ANSI escape to resize, plus stty as fallback
        session.process.stdin.write(`stty rows ${rows} cols ${cols} 2>/dev/null\n`);
      }
      return true;
    } catch {
      return false;
    }
  }

  close(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.log.info({ sessionId }, 'Closing terminal session');
    session.alive = false;

    try {
      session.process.stdin?.end();
      session.process.kill('SIGTERM');
      // Force kill after 3 seconds
      setTimeout(() => {
        try { session.process.kill('SIGKILL'); } catch { /* ignore */ }
      }, 3000);
    } catch { /* ignore */ }

    this.sessions.delete(sessionId);
  }

  closeAll(): void {
    for (const sessionId of [...this.sessions.keys()]) {
      this.close(sessionId);
    }
  }

  getActiveCount(): number {
    return this.sessions.size;
  }
}
