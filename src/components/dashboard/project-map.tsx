'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { MAP_STATUS, type MapNode, type MapNodeStatus } from '@/lib/dashboard-mock';

const HUB = { x: 760, y: 310 };

type ApiBid = {
  id: string;
  bidNumber: string;
  projectName: string;
  status: string;
  priority: string;
  source: string;
  distanceMiles: string | number | null;
  responseDeadline: string | null;
  createdAt: string;
  client: { id: string; companyName: string };
};

/** Status precedence: hot wins over the underlying status when priority=urgent. */
function bidToMapStatus(bid: ApiBid): MapNodeStatus {
  if (bid.priority === 'urgent') return 'hot';
  if (bid.status === 'won' || bid.status === 'sent_to_takeoff') return 'active';
  if (bid.status === 'lost' || bid.status === 'rejected') return 'done';
  // new, qualified, anything else still in pipeline
  return 'bid';
}

/** Stable 0..1 hash from string — used to position bids without lat/lng. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

const SVG_BOUNDS = {
  minX: 60,
  maxX: 940,
  minY: 70,
  maxY: 640,
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Convert a bid into an SVG node positioned around the Boston hub.
 *  ~1.8px per mile; if distance is unknown, place close to hub.
 *  Angle is derived from a hash of the bid id so positions are stable. */
function bidToNode(bid: ApiBid): MapNode {
  const distRaw =
    bid.distanceMiles === null || bid.distanceMiles === undefined
      ? null
      : Number(bid.distanceMiles);
  const distance = distRaw && Number.isFinite(distRaw) ? distRaw : null;
  const radius = distance !== null ? Math.min(distance * 1.8 + 14, 220) : 24;

  const angle = hash01(bid.id) * Math.PI * 2;
  const x = clamp(HUB.x + radius * Math.cos(angle), SVG_BOUNDS.minX, SVG_BOUNDS.maxX);
  const y = clamp(HUB.y + radius * Math.sin(angle), SVG_BOUNDS.minY, SVG_BOUNDS.maxY);

  const status = bidToMapStatus(bid);
  const distLabel = distance !== null ? `${distance}mi` : '—';
  // Truncate names so they fit the SVG without overlapping too much
  const shortName =
    bid.projectName.length > 26 ? bid.projectName.slice(0, 24) + '…' : bid.projectName;

  return {
    id: bid.bidNumber.replace(/^BID-\d{4}-/, 'BID-'),
    name: shortName,
    x,
    y,
    status,
    dist: distLabel,
    val: status === 'done' ? 'completed' : '—',
    anchor: x > HUB.x ? 'start' : 'end',
    below: y < HUB.y - 10 ? false : y > HUB.y + 50,
  };
}

export function ProjectMap() {
  const [bids, setBids] = useState<ApiBid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/bids')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (active && Array.isArray(d)) setBids(d);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleBids = useMemo(
    () => bids.filter((b) => !['rejected', 'lost'].includes(b.status)),
    [bids]
  );

  const nodes = useMemo(() => visibleBids.map(bidToNode), [visibleBids]);
  const bidByNodeId = useMemo(() => {
    const m = new Map<string, ApiBid>();
    visibleBids.forEach((b) => {
      m.set(b.bidNumber.replace(/^BID-\d{4}-/, 'BID-'), b);
    });
    return m;
  }, [visibleBids]);

  // Stats from real data
  const stats = useMemo(() => {
    const distances = visibleBids
      .map((b) =>
        b.distanceMiles !== null && b.distanceMiles !== undefined
          ? Number(b.distanceMiles)
          : null
      )
      .filter((d): d is number => d !== null && Number.isFinite(d));
    const avg = distances.length
      ? Math.round(distances.reduce((a, b) => a + b, 0) / distances.length)
      : 0;
    const farthest = distances.length ? Math.max(...distances) : 0;
    const active = visibleBids.filter((b) =>
      ['sent_to_takeoff', 'won'].includes(b.status)
    ).length;
    const overThreshold = visibleBids.filter(
      (b) => b.distanceMiles !== null && Number(b.distanceMiles) > 100
    ).length;
    return { avg, farthest, active, overThreshold, total: visibleBids.length };
  }, [visibleBids]);

  const routesByDist = useMemo(
    () =>
      [...nodes].sort((a, b) => {
        const da = parseFloat(a.dist);
        const db = parseFloat(b.dist);
        if (Number.isNaN(da) && Number.isNaN(db)) return 0;
        if (Number.isNaN(da)) return 1;
        if (Number.isNaN(db)) return -1;
        return da - db;
      }),
    [nodes]
  );

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      {/* Main map card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(80%_60%_at_50%_40%,rgba(58,90,122,0.22)_0%,transparent_70%),radial-gradient(120%_80%_at_20%_10%,#0A2434_0%,#04151E_60%,#01090F_100%)] shadow-lg">
        {/* Top overlay: title + legend */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 bg-gradient-to-b from-[#04151E]/90 to-transparent px-6 pb-10 pt-5 text-white">
          <div>
            <h4 className="text-[15px] font-semibold leading-tight">
              Active bids &amp; projects
            </h4>
            <div className="mt-1 text-[11.5px] text-white/55">
              Distance from Boston HQ · 100-mile operational radius
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-3 text-[11px] text-white/75">
            <LegendItem color="#18B56A" label="Active" />
            <LegendItem color="#E08A00" label="Bidding" />
            <LegendItem color="#E14545" label="Hot" />
            <LegendItem color="#5E86A1" label="Completed" />
          </div>
        </div>

        <svg
          viewBox="0 0 1000 720"
          preserveAspectRatio="xMidYMid meet"
          className="block h-auto min-h-[640px] w-full"
        >
          <defs>
            <pattern id="pm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(94, 134, 161, 0.07)" strokeWidth="0.5" />
            </pattern>
            <pattern id="pm-grid-bold" width="200" height="200" patternUnits="userSpaceOnUse">
              <path d="M 200 0 L 0 0 0 200" fill="none" stroke="rgba(94, 134, 161, 0.12)" strokeWidth="0.8" />
            </pattern>
            <radialGradient id="pm-hubGlow">
              <stop offset="0%" stopColor="#5E86A1" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#3A5A7A" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#3A5A7A" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="gradActive" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#18B56A" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#18B56A" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="gradBid" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#E08A00" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#E08A00" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="gradHot" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#E14545" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#E14545" stopOpacity="0.35" />
            </linearGradient>
            <linearGradient id="gradDone" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#5E86A1" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#5E86A1" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          <rect width="1000" height="720" fill="url(#pm-grid)" />
          <rect width="1000" height="720" fill="url(#pm-grid-bold)" />

          {/* Lat/long reference */}
          <g stroke="rgba(94, 134, 161, 0.1)" strokeWidth="0.5" strokeDasharray="2 4">
            <line x1="0" y1="180" x2="1000" y2="180" />
            <line x1="0" y1="360" x2="1000" y2="360" />
            <line x1="0" y1="540" x2="1000" y2="540" />
            <line x1="250" y1="0" x2="250" y2="720" />
            <line x1="500" y1="0" x2="500" y2="720" />
            <line x1="750" y1="0" x2="750" y2="720" />
          </g>
          <g
            fontFamily="var(--font-mono)"
            fontSize="8"
            fill="rgba(148, 169, 186, 0.4)"
            letterSpacing="0.08em"
          >
            <text x="8" y="178">42.5°N</text>
            <text x="8" y="358">42.0°N</text>
            <text x="8" y="538">41.5°N</text>
            <text x="246" y="712">73°W</text>
            <text x="496" y="712">72°W</text>
            <text x="746" y="712">71°W</text>
          </g>

          {/* Massachusetts silhouette */}
          <path
            d="M 50,280 L 120,255 L 180,265 L 240,260 L 310,270 L 380,265 L 450,270
               L 520,275 L 580,280 L 640,275 L 700,270 L 760,275 L 820,285
               L 870,305 L 900,340 L 910,385 L 895,430 L 870,465 L 830,480
               L 790,470 L 770,455 L 760,470 L 780,495 L 800,520
               L 810,545 L 790,560 L 745,555 L 700,540
               L 650,530 L 620,540 L 600,555 L 590,575 L 575,560
               L 550,540 L 510,530 L 480,520 L 450,510 L 410,495 L 370,485
               L 330,475 L 290,460 L 260,445 L 230,430
               L 200,415 L 170,395 L 140,375 L 110,355 L 85,335 L 65,310 Z"
            fill="rgba(58, 90, 122, 0.09)"
            stroke="rgba(94, 134, 161, 0.28)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M 790,495 Q 830,510 870,515 Q 900,510 920,490 Q 915,470 895,465
               Q 870,475 845,490 Q 820,500 800,495 Z"
            fill="rgba(58, 90, 122, 0.09)"
            stroke="rgba(94, 134, 161, 0.28)"
            strokeWidth="1.2"
          />

          <text
            x="80"
            y="320"
            fontFamily="var(--font-sans)"
            fontSize="24"
            fontWeight="800"
            fill="rgba(94, 134, 161, 0.13)"
            letterSpacing="0.15em"
          >
            MASSACHUSETTS
          </text>

          {/* Hub */}
          <circle cx={HUB.x} cy={HUB.y} r="140" fill="url(#pm-hubGlow)" />
          <g fill="none" stroke="#5E86A1" strokeDasharray="2 6" opacity="0.35">
            <circle cx={HUB.x} cy={HUB.y} r="45" />
            <circle cx={HUB.x} cy={HUB.y} r="90" />
            <circle cx={HUB.x} cy={HUB.y} r="135" />
            <circle
              cx={HUB.x}
              cy={HUB.y}
              r="180"
              stroke="#3A5A7A"
              strokeDasharray="2 4"
              opacity="0.5"
            />
          </g>
          <g
            fontFamily="var(--font-mono)"
            fontSize="8"
            fill="rgba(148, 169, 186, 0.5)"
            letterSpacing="0.08em"
          >
            <text x="800" y="268">25mi</text>
            <text x="840" y="225">50mi</text>
            <text x="880" y="185">75mi</text>
            <text x="920" y="145">100mi</text>
          </g>

          <circle
            className="pm-ping"
            cx={HUB.x}
            cy={HUB.y}
            r="4"
            fill="none"
            stroke="#5E86A1"
            strokeWidth="2"
          />
          <circle cx={HUB.x} cy={HUB.y} r="11" fill="#00283C" stroke="#5E86A1" strokeWidth="2.5" />
          <circle cx={HUB.x} cy={HUB.y} r="4" fill="#5E86A1" />

          <g>
            <rect
              x={HUB.x - 68}
              y={HUB.y + 15}
              width="136"
              height="42"
              rx="6"
              fill="rgba(0, 40, 60, 0.92)"
              stroke="rgba(94, 134, 161, 0.5)"
              strokeWidth="1"
            />
            <text
              x={HUB.x}
              y={HUB.y + 34}
              textAnchor="middle"
              fontFamily="var(--font-sans)"
              fontSize="15"
              fontWeight="700"
              fill="#fff"
            >
              BOSTON
            </text>
            <text
              x={HUB.x}
              y={HUB.y + 50}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize="11"
              fontWeight="700"
              fill="#E7EEF4"
              letterSpacing="0.12em"
            >
              BOS · HQ
            </text>
          </g>

          {/* Routes + nodes */}
          {nodes.map((n) => {
            const st = MAP_STATUS[n.status];
            const mx = (HUB.x + n.x) / 2;
            const dx = n.x - HUB.x;
            const dy = n.y - HUB.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const curve = Math.min(len * 0.15, 40);
            const perpX = (-dy / len) * curve;
            const perpY = (dx / len) * curve;
            const cx = mx + perpX;
            const cy = (HUB.y + n.y) / 2 + perpY;
            const path = `M ${HUB.x},${HUB.y} Q ${cx},${cy} ${n.x},${n.y}`;

            const tx = n.anchor === 'end' ? -12 : 12;
            const textAnchor = n.anchor === 'end' ? 'end' : 'start';
            const ty1 = n.below ? 28 : -14;
            const ty2 = n.below ? 42 : 0;
            const ty3 = n.below ? 56 : 14;

            const targetBid = bidByNodeId.get(n.id);

            return (
              <g key={n.id}>
                <path
                  d={path}
                  fill="none"
                  stroke={`url(#${st.grad})`}
                  strokeWidth="2"
                  strokeDasharray="5 4"
                  className="pm-route-line"
                />
                <g transform={`translate(${n.x}, ${n.y})`}>
                  <circle
                    r={n.status === 'done' ? 5 : 6}
                    fill={st.color}
                    stroke="#04151E"
                    strokeWidth="2"
                  />
                  {n.status === 'hot' && (
                    <circle
                      className="pm-ping"
                      r="4"
                      fill="none"
                      stroke={st.color}
                      strokeWidth="1.5"
                    />
                  )}
                  <text
                    x={tx}
                    y={ty1}
                    textAnchor={textAnchor}
                    fontFamily="var(--font-mono)"
                    fontSize="9.5"
                    fill="#CBD5E1"
                    fontWeight="600"
                    letterSpacing="0.1em"
                  >
                    {n.id}
                  </text>
                  <text
                    x={tx}
                    y={ty2}
                    textAnchor={textAnchor}
                    fontFamily="var(--font-sans)"
                    fontSize="12"
                    fontWeight="600"
                    fill={n.status === 'done' ? '#CBD5E1' : '#fff'}
                  >
                    {n.name}
                  </text>
                  <text
                    x={tx}
                    y={ty3}
                    textAnchor={textAnchor}
                    fontFamily="var(--font-mono)"
                    fontSize="10"
                    fill="#5E86A1"
                    fontWeight="600"
                  >
                    {n.dist} · {n.val}
                  </text>
                  {targetBid && (
                    <a href={`/bids/${targetBid.id}`} aria-label={`Open ${n.name}`}>
                      <circle r="14" fill="transparent" style={{ cursor: 'pointer' }} />
                    </a>
                  )}
                </g>
              </g>
            );
          })}

          {!loading && nodes.length === 0 && (
            <text
              x="500"
              y="650"
              textAnchor="middle"
              fontFamily="var(--font-sans)"
              fontSize="13"
              fill="rgba(255,255,255,0.4)"
            >
              No active bids yet — create one to see it on the map.
            </text>
          )}
        </svg>

        {loading && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-white/50">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading bids…
          </div>
        )}

        {/* Bottom overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-t from-[#04151E]/90 to-transparent px-6 pb-4 pt-8 text-[11px] text-white/60">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="10" cy="10" r="8" />
              <path d="M10 2 L12 10 L10 18 L8 10 Z" fill="currentColor" />
            </svg>
            <span className="font-mono tracking-wider">N · 42.36°N, 71.06°W</span>
          </div>
          <div className="flex items-center gap-2 font-mono">
            <span>0</span>
            <div
              className="h-0.5 w-16"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, rgba(255,255,255,0.5) 0 4px, transparent 4px 8px)',
              }}
            />
            <span>50mi</span>
          </div>
          <div>Projection · Mercator · 1:1,200,000</div>
        </div>
      </div>

      {/* Side panel */}
      <div className="flex flex-col gap-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface p-3">
          <MapStat
            label="Total bids"
            value={String(stats.total)}
            color="var(--color-blue-500)"
          />
          <MapStat
            label="Active routes"
            value={String(stats.active)}
            color="var(--color-success-500)"
          />
          <MapStat
            label="Avg distance"
            value={stats.avg ? String(stats.avg) : '—'}
            unit={stats.avg ? 'mi' : undefined}
          />
          <MapStat
            label="Farthest bid"
            value={stats.farthest ? String(stats.farthest) : '—'}
            unit={stats.farthest ? 'mi' : undefined}
          />
        </div>

        {/* Routes list */}
        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
            Routes — By Distance
          </div>
          {routesByDist.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-fg-subtle">
              No bids yet — create one to populate the map.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {routesByDist.map((n, i) => {
                const st = MAP_STATUS[n.status];
                const targetBid = bidByNodeId.get(n.id);
                const inner = (
                  <>
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-sunken font-mono text-[10.5px] font-semibold text-fg-muted">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-fg-default">
                        {n.name}
                      </div>
                      <div className="truncate font-mono text-[10.5px] text-fg-subtle">
                        BOS → {n.id}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          background: st.color,
                          boxShadow: `0 0 8px ${st.color}`,
                        }}
                      />
                      <span className="font-mono text-[11px] font-semibold text-fg-default">
                        {n.dist}
                      </span>
                    </div>
                  </>
                );
                if (targetBid) {
                  return (
                    <Link
                      key={n.id}
                      href={`/bids/${targetBid.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-sunken/60"
                    >
                      {inner}
                    </Link>
                  );
                }
                return (
                  <div key={n.id} className="flex items-center gap-3 px-4 py-2.5">
                    {inner}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Callout */}
        <div className="rounded-lg border border-[color:var(--color-blue-200)] bg-gradient-to-br from-blue-100 to-blue-100/60 p-4 shadow-sm border-l-[3px] border-l-blue-500">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy-700">
            100-mile Radius Rule
          </div>
          <div className="mt-2 text-[12.5px] leading-relaxed text-navy-800">
            {stats.overThreshold > 0 ? (
              <>
                <strong>{stats.overThreshold}</strong>{' '}
                bid{stats.overThreshold === 1 ? '' : 's'} exceed the 100-mile
                threshold — review before qualification.
              </>
            ) : (
              <>All active bids are within operational range.</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </div>
  );
}

function MapStat({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit?: string;
  color?: string;
}) {
  return (
    <div className="rounded-md bg-sunken p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
        {label}
      </div>
      <div
        className="mt-1 font-mono text-[20px] font-bold"
        style={{ color: color ?? 'var(--fg-default)' }}
      >
        {value}
        {unit && <span className="ml-0.5 text-[13px] opacity-70">{unit}</span>}
      </div>
    </div>
  );
}
