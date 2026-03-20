import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan';
  progress?: number; // 0-100
}

const colorMap = {
  indigo: { bg: 'from-indigo-500/20 to-indigo-600/5', text: 'text-indigo-400', bar: 'bg-indigo-500' },
  emerald: { bg: 'from-emerald-500/20 to-emerald-600/5', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  amber: { bg: 'from-amber-500/20 to-amber-600/5', text: 'text-amber-400', bar: 'bg-amber-500' },
  rose: { bg: 'from-rose-500/20 to-rose-600/5', text: 'text-rose-400', bar: 'bg-rose-500' },
  cyan: { bg: 'from-cyan-500/20 to-cyan-600/5', text: 'text-cyan-400', bar: 'bg-cyan-500' },
};

export function StatCard({ label, value, subtitle, icon: Icon, color = 'indigo', progress }: StatCardProps) {
  const c = colorMap[color];

  return (
    <div className="glass rounded-xl p-5 glow-border glass-hover transition-all duration-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-nest-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-nest-400">{subtitle}</p>}
        </div>
        <div className={clsx('flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br', c.bg)}>
          <Icon size={20} className={c.text} />
        </div>
      </div>

      {progress !== undefined && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-nest-400 mb-1">
            <span>Usage</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-nest-800">
            <div
              className={clsx('h-full rounded-full progress-bar', c.bar, {
                'opacity-100': progress < 75,
                'opacity-100 animate-pulse': progress >= 90,
              })}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
