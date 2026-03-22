/**
 * ProxNest Cloud — Terminal WebSocket Hook
 * Connects to the cloud backend's client WebSocket endpoint
 * and manages a terminal session for a VM/CT console.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseTerminalOptions {
  serverId: number;
  vmid: number;
  guestType: 'lxc' | 'qemu' | 'host';
  cols?: number;
  rows?: number;
}

export interface UseTerminalResult {
  connected: boolean;
  sessionReady: boolean;
  error: string | null;
  sendInput: (data: string) => void;
  sendResize: (cols: number, rows: number) => void;
  onData: (handler: (data: string) => void) => void;
  close: () => void;
}

export function useTerminal(options: UseTerminalOptions | null): UseTerminalResult {
  const [connected, setConnected] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const dataHandlerRef = useRef<((data: string) => void) | null>(null);

  const connect = useCallback(() => {
    if (!options) return;

    const token = localStorage.getItem('proxnest_cloud_token');
    if (!token) {
      setError('Not authenticated');
      return;
    }

    // Generate a unique session ID
    const sessionId = `term-${options.vmid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionIdRef.current = sessionId;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname === 'localhost'
      ? `${wsProtocol}//${window.location.host}`
      : `wss://cloud-api.proxnest.com`;

    const ws = new WebSocket(`${wsHost}/ws/client?token=${token}&serverId=${options.serverId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Send terminal_open to start the session
      ws.send(JSON.stringify({
        type: 'terminal_open',
        sessionId,
        vmid: options.vmid,
        guestType: options.guestType,
        cols: options.cols || 80,
        rows: options.rows || 24,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'terminal_opened') {
          if (msg.sessionId === sessionId) {
            if (msg.success) {
              setSessionReady(true);
              setError(null);
            } else {
              setError(msg.error || 'Failed to open terminal');
            }
          }
        } else if (msg.type === 'terminal_data') {
          if (msg.sessionId === sessionId && dataHandlerRef.current) {
            // Data is base64-encoded
            dataHandlerRef.current(msg.data);
          }
        } else if (msg.type === 'terminal_exit') {
          if (msg.sessionId === sessionId) {
            setSessionReady(false);
            setError(`Terminal exited (code ${msg.code ?? 'unknown'})`);
          }
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      setConnected(false);
      setSessionReady(false);
      wsRef.current = null;
    };

    ws.onerror = () => {
      setError('WebSocket connection error');
      ws.close();
    };
  }, [options?.serverId, options?.vmid, options?.guestType, options?.cols, options?.rows]);

  useEffect(() => {
    connect();
    return () => {
      // Close terminal session before disconnecting
      if (wsRef.current && sessionIdRef.current) {
        try {
          wsRef.current.send(JSON.stringify({
            type: 'terminal_close',
            sessionId: sessionIdRef.current,
          }));
        } catch { /* ignore */ }
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      sessionIdRef.current = null;
    };
  }, [connect]);

  const sendInput = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && sessionIdRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'terminal_input',
        sessionId: sessionIdRef.current,
        data, // base64 from xterm
      }));
    }
  }, []);

  const sendResize = useCallback((cols: number, rows: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && sessionIdRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'terminal_resize',
        sessionId: sessionIdRef.current,
        cols,
        rows,
      }));
    }
  }, []);

  const onData = useCallback((handler: (data: string) => void) => {
    dataHandlerRef.current = handler;
  }, []);

  const close = useCallback(() => {
    if (wsRef.current && sessionIdRef.current) {
      try {
        wsRef.current.send(JSON.stringify({
          type: 'terminal_close',
          sessionId: sessionIdRef.current,
        }));
      } catch { /* ignore */ }
      wsRef.current.close();
      wsRef.current = null;
    }
    sessionIdRef.current = null;
    setConnected(false);
    setSessionReady(false);
  }, []);

  return { connected, sessionReady, error, sendInput, sendResize, onData, close };
}
