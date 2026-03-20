/**
 * ProxNest Dashboard — Mini SVG Chart Component
 * Lightweight real-time line/area chart rendered as pure SVG.
 * No dependencies — just React + SVG.
 */

import { useMemo } from 'react';
import { clsx } from 'clsx';

export interface ChartDataPoint {
  time: number;
  value: number | null;
}

interface MiniChartProps {
  data: ChartDataPoint[];
  width?: number;
  height?: number;
  color: string;        // CSS color for the line (e.g. '#6366f1')
  gradientId: string;   // Unique ID for the SVG gradient
  maxValue?: number;     // Override auto-scale max
  minValue?: number;     // Override auto-scale min
  label?: string;
  valueLabel?: string;
  unit?: string;
  showGrid?: boolean;
  showTooltip?: boolean;
  className?: string;
}

function buildPath(
  data: ChartDataPoint[],
  width: number,
  height: number,
  minVal: number,
  maxVal: number,
  closed: boolean,
): string {
  const filtered = data.filter((d) => d.value !== null) as { time: number; value: number }[];
  if (filtered.length < 2) return '';

  const range = maxVal - minVal || 1;
  const padding = 2; // px padding top/bottom
  const drawHeight = height - padding * 2;

  const points = filtered.map((d, i) => {
    const x = (i / (filtered.length - 1)) * width;
    const y = padding + drawHeight - ((d.value - minVal) / range) * drawHeight;
    return { x, y };
  });

  let path = `M ${points[0].x} ${points[0].y}`;

  // Smooth cubic bezier curves
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    path += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  if (closed) {
    // Close the area: go to bottom-right, bottom-left, back to start
    path += ` L ${points[points.length - 1].x} ${height}`;
    path += ` L ${points[0].x} ${height} Z`;
  }

  return path;
}

export function MiniChart({
  data,
  width = 300,
  height = 80,
  color,
  gradientId,
  maxValue,
  minValue,
  label,
  valueLabel,
  unit = '',
  showGrid = false,
  className,
}: MiniChartProps) {
  const { linePath, areaPath, computedMax, lastValue } = useMemo(() => {
    const values = data.map((d) => d.value).filter((v) => v !== null) as number[];
    if (values.length === 0) {
      return { linePath: '', areaPath: '', computedMax: 100, lastValue: null };
    }

    const min = minValue ?? Math.min(...values);
    const max = maxValue ?? Math.max(...values, min + 1);

    return {
      linePath: buildPath(data, width, height, min, max, false),
      areaPath: buildPath(data, width, height, min, max, true),
      computedMax: max,
      lastValue: values[values.length - 1],
    };
  }, [data, width, height, maxValue, minValue]);

  const gridLines = showGrid ? [0.25, 0.5, 0.75] : [];

  return (
    <div className={clsx('relative', className)}>
      {/* Labels */}
      {(label || valueLabel) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-[10px] text-nest-400 font-medium uppercase tracking-wide">{label}</span>}
          {lastValue !== null && (
            <span className="text-xs font-semibold text-white">
              {valueLabel || `${lastValue.toFixed(1)}${unit}`}
            </span>
          )}
        </div>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {gridLines.map((pct) => (
          <line
            key={pct}
            x1={0}
            y1={height * pct}
            x2={width}
            y2={height * pct}
            stroke="currentColor"
            className="text-nest-800"
            strokeWidth={0.5}
            strokeDasharray="4 4"
          />
        ))}

        {/* Area fill */}
        {areaPath && (
          <path d={areaPath} fill={`url(#${gradientId})`} />
        )}

        {/* Line */}
        {linePath && (
          <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        )}
      </svg>
    </div>
  );
}

// ─── Multi-line Chart (for overlaid metrics like netIn/netOut) ────

export interface MultiLineData {
  time: number;
  values: (number | null)[];
}

interface MultiLineChartProps {
  data: MultiLineData[];
  lines: Array<{ color: string; label: string; unit?: string }>;
  width?: number;
  height?: number;
  maxValue?: number;
  label?: string;
  className?: string;
}

export function MultiLineChart({
  data,
  lines,
  width = 300,
  height = 80,
  maxValue,
  label,
  className,
}: MultiLineChartProps) {
  const paths = useMemo(() => {
    if (data.length < 2) return lines.map(() => '');

    // Find global max
    let globalMax = maxValue ?? 0;
    if (!maxValue) {
      for (const d of data) {
        for (const v of d.values) {
          if (v !== null && v > globalMax) globalMax = v;
        }
      }
      globalMax = globalMax || 1;
    }

    return lines.map((_, lineIdx) => {
      const lineData: ChartDataPoint[] = data.map((d) => ({
        time: d.time,
        value: d.values[lineIdx],
      }));
      return buildPath(lineData, width, height, 0, globalMax, false);
    });
  }, [data, lines, width, height, maxValue]);

  const lastValues = data.length > 0 ? data[data.length - 1].values : [];

  return (
    <div className={clsx('relative', className)}>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-nest-400 font-medium uppercase tracking-wide">{label}</span>
          <div className="flex items-center gap-3">
            {lines.map((line, i) => (
              <span key={i} className="flex items-center gap-1 text-[10px]">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: line.color }} />
                <span className="text-nest-400">{line.label}:</span>
                <span className="text-white font-medium">
                  {lastValues[i] !== null && lastValues[i] !== undefined
                    ? formatBytes(lastValues[i] as number) + (line.unit || '/s')
                    : '—'}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
      >
        {/* Grid */}
        {[0.25, 0.5, 0.75].map((pct) => (
          <line
            key={pct}
            x1={0} y1={height * pct} x2={width} y2={height * pct}
            stroke="currentColor" className="text-nest-800"
            strokeWidth={0.5} strokeDasharray="4 4"
          />
        ))}

        {paths.map((path, i) => (
          path && <path key={i} d={path} fill="none" stroke={lines[i].color} strokeWidth={1.5} strokeLinecap="round" />
        ))}
      </svg>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024));
  const idx = Math.min(i, units.length - 1);
  return `${(bytes / Math.pow(1024, idx)).toFixed(1)} ${units[idx]}`;
}
