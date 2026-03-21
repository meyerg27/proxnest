/**
 * ProxNest Cloud — App Logs Modal
 * Displays docker logs for an installed app with auto-scroll, search, and auto-refresh.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, RefreshCw, Search, Download, ArrowDown, Loader2,
  ScrollText, Pause, Play, ChevronDown,
} from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '../lib/api';

interface AppLogsModalProps {
  serverId: number;
  appId: string;
  appName: string;
  appIcon?: string;
  onClose: () => void;
}

export function AppLogsModal({ serverId, appId, appName, appIcon, onClose }: AppLogsModalProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [tail, setTail] = useState(200);
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const result = await api.sendCommand(serverId, 'apps.logs', { appId, tail });
      if (result.success && result.data) {
        const data = result.data as { lines: string[]; count: number };
        setLines(data.lines || []);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch logs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, [serverId, appId, tail]);

  // Initial fetch
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh every 5s
  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(fetchLogs, 5000);
    }
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [autoRefresh, fetchLogs]);

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  // Detect manual scroll (disable auto-scroll if user scrolls up)
  const handleScroll = () => {
    if (!logContainerRef.current) return;
    const el = logContainerRef.current;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(isAtBottom);
  };

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      setAutoScroll(true);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${appId}-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter lines by search
  const filteredLines = search
    ? lines.filter(l => l.toLowerCase().includes(search.toLowerCase()))
    : lines;

  // Colorize log lines
  const getLineClass = (line: string): string => {
    const lower = line.toLowerCase();
    if (lower.includes('error') || lower.includes('fatal') || lower.includes('panic') || lower.includes('exception')) {
      return 'text-rose-400';
    }
    if (lower.includes('warn') || lower.includes('warning')) {
      return 'text-amber-400';
    }
    if (lower.includes('debug') || lower.includes('trace')) {
      return 'text-nest-500';
    }
    if (lower.includes('info')) {
      return 'text-sky-400/80';
    }
    return 'text-nest-300';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-4xl h-[80vh] glass rounded-2xl glow-border overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-nest-800/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            {appIcon && <span className="text-xl">{appIcon}</span>}
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <ScrollText size={14} className="text-nest-400" />
                {appName} — Logs
              </h2>
              <p className="text-[11px] text-nest-500 mt-0.5">
                {filteredLines.length} lines
                {search && ` (filtered from ${lines.length})`}
                {autoRefresh && ' • Auto-refreshing'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Tail selector */}
            <div className="relative">
              <select
                value={tail}
                onChange={e => setTail(Number(e.target.value))}
                className="appearance-none text-[11px] pl-2 pr-6 py-1.5 rounded-lg bg-nest-800/60 text-nest-300 border border-nest-700/50 focus:outline-none focus:border-nest-500/50 cursor-pointer"
              >
                <option value={50}>50 lines</option>
                <option value={100}>100 lines</option>
                <option value={200}>200 lines</option>
                <option value={500}>500 lines</option>
                <option value={1000}>1000 lines</option>
              </select>
              <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-nest-500 pointer-events-none" />
            </div>

            {/* Auto-refresh toggle */}
            <button
              onClick={() => setAutoRefresh(p => !p)}
              className={clsx(
                'p-1.5 rounded-lg transition-all',
                autoRefresh
                  ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-nest-800/60 text-nest-400 hover:text-white',
              )}
              title={autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
            >
              {autoRefresh ? <Pause size={13} /> : <Play size={13} />}
            </button>

            {/* Manual refresh */}
            <button
              onClick={fetchLogs}
              className="p-1.5 rounded-lg text-nest-400 hover:text-white bg-nest-800/60 hover:bg-nest-800 transition-all"
              title="Refresh now"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>

            {/* Download */}
            <button
              onClick={handleDownload}
              disabled={lines.length === 0}
              className="p-1.5 rounded-lg text-nest-400 hover:text-white bg-nest-800/60 hover:bg-nest-800 transition-all disabled:opacity-30"
              title="Download logs"
            >
              <Download size={13} />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-nest-400 hover:text-white hover:bg-nest-800/50 transition-all"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-4 py-2 border-b border-nest-800/30 flex-shrink-0">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-nest-500" />
            <input
              type="text"
              placeholder="Filter logs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-nest-900/50 border border-nest-800/50 text-white placeholder-nest-600 focus:outline-none focus:border-nest-500/40 transition-colors font-mono"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-nest-500 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Log content */}
        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overflow-x-auto p-4 font-mono text-[11px] leading-[1.6] scrollbar-thin"
        >
          {loading && lines.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={24} className="animate-spin text-nest-400" />
                <p className="text-xs text-nest-500">Fetching logs…</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <ScrollText size={32} className="text-nest-600 mx-auto mb-3" />
                <p className="text-sm text-rose-400 mb-2">{error}</p>
                <button
                  onClick={fetchLogs}
                  className="text-xs text-nest-300 hover:text-white underline"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : filteredLines.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <ScrollText size={32} className="text-nest-600 mx-auto mb-3" />
                <p className="text-sm text-nest-400">
                  {search ? 'No matching log lines' : 'No logs available'}
                </p>
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="text-xs text-nest-300 hover:text-white underline mt-1"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            </div>
          ) : (
            filteredLines.map((line, i) => (
              <div
                key={i}
                className={clsx(
                  'py-[1px] whitespace-pre-wrap break-all hover:bg-white/[0.02] transition-colors',
                  getLineClass(line),
                )}
              >
                <span className="text-nest-600 select-none mr-3 inline-block w-[3ch] text-right">{i + 1}</span>
                {search ? highlightSearch(line, search) : line}
              </div>
            ))
          )}
        </div>

        {/* Scroll-to-bottom FAB */}
        {!autoScroll && filteredLines.length > 0 && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-6 p-2.5 rounded-full bg-nest-700/90 text-white shadow-lg hover:bg-nest-600 transition-all border border-nest-600/50 backdrop-blur-sm"
            title="Scroll to bottom"
          >
            <ArrowDown size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Highlight search matches in a log line */
function highlightSearch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const parts: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  let lastIndex = 0;

  let idx = lower.indexOf(qLower);
  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx));
    }
    parts.push(
      <span key={idx} className="bg-amber-500/30 text-amber-200 rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </span>
    );
    lastIndex = idx + query.length;
    idx = lower.indexOf(qLower, lastIndex);
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return <>{parts}</>;
}
