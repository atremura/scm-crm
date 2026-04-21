import type { RevenuePoint } from '@/lib/dashboard-mock';

export function PipelineChart({ data }: { data: RevenuePoint[] }) {
  const W = 640;
  const H = 220;
  const P = { t: 16, r: 12, b: 28, l: 36 };
  const chartW = W - P.l - P.r;
  const chartH = H - P.t - P.b;
  const maxVal = Math.max(...data.map((d) => d.value));
  const barW = chartW / data.length;
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[220px] w-full">
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={P.l}
              x2={W - P.r}
              y1={P.t + chartH * (1 - t)}
              y2={P.t + chartH * (1 - t)}
              stroke="var(--border)"
              strokeDasharray={i === 0 ? '' : '2 4'}
            />
            <text
              x={P.l - 8}
              y={P.t + chartH * (1 - t) + 3}
              fontSize="10"
              textAnchor="end"
              fill="var(--fg-subtle)"
              fontFamily="var(--font-sans)"
            >
              ${(maxVal * t).toFixed(0)}k
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const x = P.l + barW * i + barW * 0.25;
          const bW = barW * 0.5;
          const h = (d.bids / 35) * chartH;
          return (
            <g key={d.m}>
              <rect
                x={x}
                y={P.t + chartH - h}
                width={bW}
                height={h}
                rx="3"
                fill="var(--color-blue-100)"
              />
              <rect
                x={x}
                y={P.t + chartH - (d.won / 35) * chartH}
                width={bW}
                height={(d.won / 35) * chartH}
                rx="3"
                fill="var(--color-blue-500)"
              />
              <text
                x={x + bW / 2}
                y={H - 10}
                fontSize="11"
                textAnchor="middle"
                fill="var(--fg-muted)"
                fontFamily="var(--font-sans)"
              >
                {d.m}
              </text>
            </g>
          );
        })}

        <path
          d={
            'M ' +
            data
              .map((d, i) => {
                const x = P.l + barW * i + barW / 2;
                const y = P.t + chartH * (1 - d.value / maxVal);
                return `${x},${y}`;
              })
              .join(' L ')
          }
          fill="none"
          stroke="var(--color-navy-800)"
          strokeWidth="2"
        />
        {data.map((d, i) => {
          const x = P.l + barW * i + barW / 2;
          const y = P.t + chartH * (1 - d.value / maxVal);
          return (
            <circle
              key={'c' + i}
              cx={x}
              cy={y}
              r="3.5"
              fill="#fff"
              stroke="var(--color-navy-800)"
              strokeWidth="2"
            />
          );
        })}
      </svg>
      <div className="mt-2 flex justify-center gap-4 text-[11.5px] text-fg-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-blue-100" />
          Bids received
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-blue-500" />
          Qualified/Won
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-2.5 bg-navy-800" />
          Value ($k)
        </span>
      </div>
    </div>
  );
}
