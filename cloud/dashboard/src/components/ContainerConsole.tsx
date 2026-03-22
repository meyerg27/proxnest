/**
 * ProxNest Cloud — Container Console Modal
 * Full-featured web terminal for VM/CT console access via xterm.js.
 * Streams stdin/stdout through cloud WebSocket ↔ agent ↔ pct exec.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  X, Terminal as TerminalIcon, Loader2, AlertTriangle,
  Maximize2, Minimize2, Container, Monitor,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useTerminal } from '../hooks/useTerminal';

interface ContainerConsoleProps {
  serverId: number;
  vmid: number;
  guestType: 'lxc' | 'qemu' | 'host';
  guestName: string;
  onClose: () => void;
}

export function ContainerConsole({ serverId, vmid, guestType, guestName, onClose }: ContainerConsoleProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const terminal = useTerminal({
    serverId,
    vmid,
    guestType,
    cols: 120,
    rows: 30,
  });

  // Initialize xterm.js
  useEffect(() => {
    if (!termRef.current) return;

    const xterm = new Terminal({
      theme: {
        background: '#0a0e17',
        foreground: '#c4cdd9',
        cursor: '#c4cdd9',
        cursorAccent: '#0a0e17',
        selectionBackground: 'rgba(255,255,255,0.15)',
        selectionForeground: undefined,
        black: '#1a1e2e',
        red: '#f43f5e',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#c4cdd9',
        brightBlack: '#4b5563',
        brightRed: '#fb7185',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#f9fafb',
      },
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, Monaco, monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    xterm.open(termRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Handle user input → send as base64 to agent
    xterm.onData((data: string) => {
      // Convert string to base64
      const encoded = btoa(data);
      terminal.sendInput(encoded);
    });

    // Handle binary input (paste, etc.)
    xterm.onBinary((data: string) => {
      const bytes = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) {
        bytes[i] = data.charCodeAt(i);
      }
      const encoded = btoa(String.fromCharCode(...bytes));
      terminal.sendInput(encoded);
    });

    // Handle terminal resize
    xterm.onResize(({ cols, rows }) => {
      terminal.sendResize(cols, rows);
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      try { fitAddon.fit(); } catch { /* ignore */ }
    });
    resizeObserver.observe(termRef.current);

    // Welcome message
    xterm.writeln('\x1b[2m── ProxNest Console ──\x1b[0m');
    xterm.writeln(`\x1b[2mConnecting to ${guestType.toUpperCase()} ${vmid} (${guestName})...\x1b[0m`);
    xterm.writeln('');

    return () => {
      resizeObserver.disconnect();
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []); // Only mount once

  // Receive terminal data from agent → write to xterm
  useEffect(() => {
    terminal.onData((base64Data: string) => {
      if (xtermRef.current) {
        try {
          const decoded = atob(base64Data);
          xtermRef.current.write(decoded);
        } catch { /* ignore decode errors */ }
      }
    });
  }, [terminal.onData]);

  // Show status messages
  useEffect(() => {
    if (!xtermRef.current) return;
    if (terminal.sessionReady) {
      xtermRef.current.writeln('\x1b[32m✓ Connected\x1b[0m');
      xtermRef.current.writeln('');
      // Focus terminal
      xtermRef.current.focus();
    }
  }, [terminal.sessionReady]);

  useEffect(() => {
    if (!xtermRef.current) return;
    if (terminal.error) {
      xtermRef.current.writeln('');
      xtermRef.current.writeln(`\x1b[31m✗ ${terminal.error}\x1b[0m`);
    }
  }, [terminal.error]);

  // Fit on fullscreen toggle
  useEffect(() => {
    setTimeout(() => {
      try { fitAddonRef.current?.fit(); } catch { /* ignore */ }
    }, 100);
  }, [fullscreen]);

  // Keyboard shortcut for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreen) {
        setFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreen]);

  const handleClose = useCallback(() => {
    terminal.close();
    onClose();
  }, [terminal.close, onClose]);

  return (
    <div
      className={clsx(
        'fixed z-50 flex items-center justify-center',
        fullscreen ? 'inset-0' : 'inset-0 p-4',
      )}
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className={clsx(
          'relative glass glow-border overflow-hidden flex flex-col',
          fullscreen
            ? 'w-full h-full rounded-none'
            : 'w-full max-w-5xl h-[85vh] rounded-2xl',
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-nest-800/50 flex-shrink-0 bg-nest-950/80">
          <div className="flex items-center gap-3">
            <div className={clsx(
              'p-1.5 rounded-lg',
              guestType === 'qemu'
                ? 'bg-indigo-500/10 border border-indigo-500/20'
                : 'bg-cyan-500/10 border border-cyan-500/20',
            )}>
              {guestType === 'qemu'
                ? <Monitor size={14} className="text-indigo-400" />
                : <Container size={14} className="text-cyan-400" />
              }
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <TerminalIcon size={13} className="text-nest-400" />
                Console — {guestName}
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-nest-800 text-nest-400 font-mono">
                  {vmid}
                </span>
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={clsx(
                  'h-1.5 w-1.5 rounded-full',
                  terminal.sessionReady ? 'bg-emerald-400 animate-pulse' :
                  terminal.connected ? 'bg-amber-400' :
                  'bg-nest-600',
                )} />
                <span className="text-[10px] text-nest-500">
                  {terminal.sessionReady ? 'Connected' :
                   terminal.connected ? 'Opening session…' :
                   terminal.error ? 'Error' : 'Connecting…'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFullscreen(f => !f)}
              className="p-1.5 rounded-lg text-nest-400 hover:text-white hover:bg-nest-800/50 transition-all"
              title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-nest-400 hover:text-white hover:bg-nest-800/50 transition-all"
              title="Close console"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Terminal area */}
        <div className="flex-1 relative overflow-hidden bg-[#0a0e17]">
          {/* Loading overlay */}
          {!terminal.sessionReady && !terminal.error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0a0e17]/80">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={28} className="animate-spin text-nest-400" />
                <p className="text-xs text-nest-500">
                  {terminal.connected ? 'Opening terminal session…' : 'Connecting to server…'}
                </p>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {terminal.error && !terminal.sessionReady && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0a0e17]/80">
              <div className="flex flex-col items-center gap-3 text-center max-w-sm">
                <AlertTriangle size={28} className="text-rose-400" />
                <p className="text-sm text-rose-400">{terminal.error}</p>
                <p className="text-xs text-nest-500">
                  {guestType === 'qemu'
                    ? 'QEMU VMs require a serial console configured. Check VM hardware settings.'
                    : 'Make sure the container is running and has /bin/bash available.'}
                </p>
                <button
                  onClick={handleClose}
                  className="text-xs px-4 py-1.5 rounded-lg glass text-nest-300 hover:text-white transition-all mt-2"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* xterm.js container */}
          <div
            ref={termRef}
            className="w-full h-full p-2"
            style={{ cursor: terminal.sessionReady ? 'text' : 'default' }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-1.5 border-t border-nest-800/30 bg-nest-950/80 text-[10px] text-nest-600 flex-shrink-0">
          <span>
            {guestType === 'lxc' ? 'LXC Container' : 'QEMU VM'} • {guestName} ({vmid})
          </span>
          <span>
            {fullscreen ? 'Esc to exit fullscreen' : 'Click terminal to focus'} • Ctrl+C to interrupt
          </span>
        </div>
      </div>
    </div>
  );
}
