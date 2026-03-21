/**
 * ProxNest Cloud — Install Progress WebSocket Hook
 * Connects to the cloud backend's client WebSocket endpoint
 * to receive real-time Docker pull/install progress from agents.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ──────────────────────────────────────

export interface PullLayer {
  id: string;
  status: string;
  progress?: string;
  current?: number;
  total?: number;
}

export interface InstallProgress {
  phase: 'pulling' | 'creating' | 'starting' | 'configuring' | 'done' | 'error';
  message: string;
  image?: string;
  layers?: PullLayer[];
  percent?: number; // 0-100 overall
  error?: string;
  url?: string;
}

// ─── Hook ───────────────────────────────────────

export function useInstallProgress(serverId: number | null) {
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (!serverId) return;

    const token = localStorage.getItem('proxnest_cloud_token');
    if (!token) return;

    // Build WS URL — same host as the page, or explicit API host
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname === 'localhost'
      ? `${wsProtocol}//${window.location.host}`
      : `wss://cloud-api.proxnest.com`;

    const ws = new WebSocket(`${wsHost}/ws/client?token=${token}&serverId=${serverId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'install_progress') {
          setProgress(msg.data as InstallProgress);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      // Reconnect after a short delay if still mounted
      reconnectTimer.current = setTimeout(() => connect(), 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [serverId]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const clearProgress = useCallback(() => {
    setProgress(null);
  }, []);

  return { progress, connected, clearProgress };
}
