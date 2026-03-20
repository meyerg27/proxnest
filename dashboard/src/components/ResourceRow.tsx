import { clsx } from 'clsx';
import { Play, Square, Monitor, Container } from 'lucide-react';
import type { Resource } from '@/types/api';

interface ResourceRowProps {
  resource: Resource;
  onAction: (vmid: number, type: string, action: string) => void;
  loading?: boolean;
}

export function ResourceRow({ resource, onAction, loading }: ResourceRowProps) {
  const isRunning = resource.status === 'running';
  const Icon = resource.type === 'qemu' ? Monitor : Container;

  return (
    <div className="glass rounded-lg p-4 flex items-center gap-4 glass-hover transition-all duration-150">
      {/* Status indicator */}
      <div className="relative">
        <Icon size={20} className={isRunning ? 'text-emerald-400' : 'text-nest-500'} />
        <span
          className={clsx(
            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-nest-900',
            isRunning ? 'bg-emerald-400' : 'bg-nest-500',
          )}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">{resource.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-nest-800 text-nest-400 uppercase font-mono">
            {resource.type} {resource.vmid}
          </span>
        </div>
        <div className="flex items-center gap-4 mt-1 text-xs text-nest-400">
          <span>Node: {resource.node}</span>
          {isRunning && (
            <>
              <span>CPU: {resource.cpu}%</span>
              <span>RAM: {resource.memoryMB}MB / {resource.maxMemoryMB}MB</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isRunning ? (
          <button
            onClick={() => onAction(resource.vmid, resource.type, 'stop')}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors
              disabled:opacity-50"
          >
            <Square size={12} />
            Stop
          </button>
        ) : (
          <button
            onClick={() => onAction(resource.vmid, resource.type, 'start')}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors
              disabled:opacity-50"
          >
            <Play size={12} />
            Start
          </button>
        )}
      </div>
    </div>
  );
}
