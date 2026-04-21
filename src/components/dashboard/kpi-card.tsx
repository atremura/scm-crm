import { ArrowUp, ArrowDown } from 'lucide-react';
import type { Kpi } from '@/lib/dashboard-mock';

function Sparkline({ up = true }: { up?: boolean }) {
  const pts = up
    ? [[0, 12], [10, 10], [20, 13], [30, 8], [40, 9], [50, 5], [60, 3]]
    : [[0, 3], [10, 5], [20, 4], [30, 7], [40, 6], [50, 10], [60, 12]];
  const path = 'M ' + pts.map((p) => p.join(',')).join(' L ');
  return (
    <svg width="70" height="22" viewBox="0 0 60 16" className="block">
      <path
        d={path}
        fill="none"
        stroke={up ? 'var(--color-success-500)' : 'var(--color-danger-500)'}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <div className="relative flex flex-col gap-2.5 overflow-hidden rounded-lg border border-border bg-surface px-5 py-[18px]">
      <div className="text-xs font-medium uppercase tracking-[0.06em] text-fg-muted">
        {kpi.label}
      </div>
      <div className="text-[28px] font-bold leading-none text-fg-default">
        {kpi.value}
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
            kpi.up
              ? 'bg-success-100 text-success-600'
              : 'bg-danger-100 text-danger-600'
          }`}
        >
          {kpi.up ? (
            <ArrowUp className="h-2.5 w-2.5" strokeWidth={3} />
          ) : (
            <ArrowDown className="h-2.5 w-2.5" strokeWidth={3} />
          )}
          {kpi.delta}
        </span>
        <span className="text-[11.5px] text-fg-subtle">{kpi.sub}</span>
      </div>
      <div className="absolute bottom-3 right-4">
        <Sparkline up={kpi.up} />
      </div>
    </div>
  );
}
