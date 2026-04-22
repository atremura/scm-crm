'use client';

import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  MapPin,
  Plus,
  Download,
  ArrowRight,
  Sparkles,
  Zap,
  AlertTriangle,
  Mail,
  Calendar,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { PipelineChart } from '@/components/dashboard/pipeline-chart';
import { ProjectMap } from '@/components/dashboard/project-map';
import {
  AI_INSIGHTS,
  TASKS,
  type Task,
  type AiInsight,
  type Kpi,
  type FunnelStage,
  type RevenuePoint,
  type ActivityTone,
} from '@/lib/dashboard-mock';

type DashboardData = {
  kpis: {
    active: number;
    winRate: number | null;
    avgDistance: number | null;
    newThisWeek: number;
    dueThisWeek: number;
    won: number;
    lost: number;
    total: number;
    terminalCount: number;
  };
  funnel: Array<{ stage: string; status: string; count: number }>;
  series: Array<{ m: string; bids: number; won: number }>;
  activity: Array<{
    id: string;
    who: string;
    what: string;
    when: string;
    bidId: string;
    bidNumber: string;
    projectName: string;
    tone: ActivityTone;
  }>;
};

const FUNNEL_COLORS: Record<string, string> = {
  new: 'var(--color-ink-400)',
  qualified: 'var(--color-blue-500)',
  sent_to_takeoff: 'var(--color-success-500)',
};

const AI_ICON: Record<AiInsight['icon'], React.ComponentType<{ className?: string }>> = {
  Zap,
  AlertTriangle,
  Mail,
};

const AI_TONE: Record<
  AiInsight['tone'],
  { bg: string; fg: string }
> = {
  hot: { bg: 'bg-warn-100', fg: 'text-warn-600' },
  warn: { bg: 'bg-danger-100', fg: 'text-danger-600' },
  info: { bg: 'bg-blue-100', fg: 'text-blue-700' },
};

const ACTIVITY_COLOR: Record<ActivityTone, string> = {
  blue: 'bg-blue-500',
  navy: 'bg-navy-800',
  green: 'bg-success-500',
  amber: 'bg-warn-500',
};

function loadingKpi(label: string): Kpi {
  return { label, value: '…', delta: '', up: true, sub: 'loading' };
}

function funnelRow(stage: string, count: number, status: string): FunnelStage {
  return {
    stage,
    count,
    value: count,
    color: FUNNEL_COLORS[status] ?? 'var(--color-blue-500)',
  };
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

export default function DashboardPage() {
  const [tab, setTab] = useState<'overview' | 'map'>('overview');
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('jmoDashTab');
    if (saved === 'map' || saved === 'overview') setTab(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('jmoDashTab', tab);
  }, [tab]);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.kpis) setData(d as DashboardData);
      })
      .catch(() => {});
  }, []);

  const activeBidCount = data?.kpis.active ?? null;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 p-6 md:p-8">
      {/* Page head */}
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-fg-default">
            Good morning, Andre
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Here&apos;s what needs your attention today — April 18, 2026.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" />
            New Bid
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 rounded-[10px] bg-sunken p-1">
        <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
          <LayoutDashboard className="h-3.5 w-3.5" />
          Overview
        </TabButton>
        <TabButton active={tab === 'map'} onClick={() => setTab('map')}>
          <MapPin className="h-3.5 w-3.5" />
          Project Map
          {activeBidCount !== null && (
            <span
              className={`ml-1 rounded-full px-1.5 text-[10.5px] font-semibold ${
                tab === 'map' ? 'bg-blue-500 text-white' : 'bg-ink-200 text-fg-muted'
              }`}
            >
              {activeBidCount}
            </span>
          )}
        </TabButton>
      </div>

      {tab === 'map' ? <ProjectMap /> : <Overview data={data} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-all ${
        active
          ? 'bg-surface text-fg-default shadow-sm'
          : 'text-fg-muted hover:text-fg-default'
      }`}
    >
      {children}
    </button>
  );
}

function Overview({ data }: { data: DashboardData | null }) {
  // Build KPI cards from real data when available
  const kpis: Kpi[] = data
    ? [
        {
          label: 'Active Bids',
          value: String(data.kpis.active),
          delta: `${data.kpis.terminalCount} closed`,
          up: true,
          sub: `of ${data.kpis.total} total`,
        },
        {
          label: 'Win Rate',
          value: data.kpis.winRate !== null ? `${data.kpis.winRate}%` : '—',
          delta:
            data.kpis.won + data.kpis.lost > 0
              ? `${data.kpis.won}W / ${data.kpis.lost}L`
              : 'no data',
          up: (data.kpis.winRate ?? 0) >= 50,
          sub: 'won vs lost',
        },
        {
          label: 'Avg. Distance',
          value:
            data.kpis.avgDistance !== null
              ? `${data.kpis.avgDistance} mi`
              : '—',
          delta: 'from base',
          up: true,
          sub: 'across geocoded bids',
        },
        {
          label: 'Due This Week',
          value: String(data.kpis.dueThisWeek),
          delta: `+${data.kpis.newThisWeek} new`,
          up: true,
          sub: 'next 7 days',
        },
      ]
    : [
        loadingKpi('Active Bids'),
        loadingKpi('Win Rate'),
        loadingKpi('Avg. Distance'),
        loadingKpi('Due This Week'),
      ];

  // Funnel: dedupe so qualified doesn't show twice (the API returns it as
  // both "Reviewing" and "Qualified" — for this UI we collapse to a single
  // "Qualified" stage using the qualified count).
  const funnelStages: FunnelStage[] = data
    ? [
        funnelRow('New', data.funnel.find((f) => f.status === 'new')?.count ?? 0, 'new'),
        funnelRow(
          'Qualified',
          data.funnel.find((f) => f.status === 'qualified')?.count ?? 0,
          'qualified'
        ),
        funnelRow(
          'Sent to Takeoff',
          data.funnel.find((f) => f.status === 'sent_to_takeoff')?.count ?? 0,
          'sent_to_takeoff'
        ),
      ]
    : [];

  // Series for the chart — pass real series, or zeros while loading
  const series: RevenuePoint[] = data
    ? data.series.map((s) => ({ m: s.m, bids: s.bids, won: s.won, value: 0 }))
    : [
        { m: '—', bids: 0, won: 0, value: 0 },
      ];

  const activity = data?.activity ?? [];

  return (
    <>
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} kpi={k} />
        ))}
      </div>

      {/* Two-col: Chart + AI Insights */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        {/* Pipeline chart */}
        <Card>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="text-[14.5px] font-semibold text-fg-default">
                Bid Pipeline · Last 6 Months
              </h3>
              <p className="mt-0.5 text-[12px] text-fg-muted">
                Captured bids vs. qualified, with estimated value
              </p>
            </div>
            <div className="flex gap-1.5">
              <Button variant="secondary" size="sm">6M</Button>
              <Button variant="ghost" size="sm">1Y</Button>
            </div>
          </div>
          <div className="p-5">
            <PipelineChart data={series} />
          </div>
        </Card>

        {/* AI Insights */}
        <Card>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-navy-800 to-blue-500 text-white">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-[14.5px] font-semibold text-fg-default">
                AI Copilot · Today
              </h3>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2 py-0.5 text-[10.5px] font-semibold text-blue-700">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              Live
            </span>
          </div>
          <div>
            {AI_INSIGHTS.map((insight, i) => {
              const Icon = AI_ICON[insight.icon];
              const tone = AI_TONE[insight.tone];
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 px-5 py-3.5 ${
                    i < AI_INSIGHTS.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone.bg} ${tone.fg}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-fg-default">
                      {insight.title}
                    </div>
                    <div className="mt-0.5 text-[12.5px] leading-relaxed text-fg-muted">
                      {insight.body}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="p-3">
              <Button variant="ghost" size="sm" className="w-full justify-center">
                <ArrowRight className="h-3.5 w-3.5" />
                See all insights
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Three-col: Funnel + Tasks + Activity */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_1fr_1fr]">
        <Card>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-[14.5px] font-semibold text-fg-default">Bid Funnel</h3>
            <Button variant="ghost" size="sm">
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="p-5">
            <div className="flex flex-col gap-3.5">
              {funnelStages.length === 0 ? (
                <div className="text-[12.5px] text-fg-subtle">Loading…</div>
              ) : (
                funnelStages.map((f) => {
                  const max = Math.max(1, ...funnelStages.map((x) => x.count));
                  const pct = (f.count / max) * 100;
                  return (
                    <div key={f.stage}>
                      <div className="mb-1.5 flex items-center justify-between text-[13px]">
                        <span className="font-semibold text-fg-default">
                          {f.stage}
                        </span>
                        <span className="text-fg-muted">
                          <span className="font-semibold text-fg-default">
                            {f.count}
                          </span>{' '}
                          bid{f.count === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-sunken">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{ width: `${pct}%`, background: f.color }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-[14.5px] font-semibold text-fg-default">My Tasks</h3>
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10.5px] font-semibold text-blue-700">
              {TASKS.filter((t) => !t.done).length} open
            </span>
          </div>
          <div className="py-1">
            {TASKS.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        </Card>

        <Card>
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-[14.5px] font-semibold text-fg-default">Recent Activity</h3>
          </div>
          <div className="p-5">
            {activity.length === 0 ? (
              <div className="text-center text-[12.5px] text-fg-subtle">
                No activity yet
              </div>
            ) : (
              <ol className="relative ml-3 border-l border-border">
                {activity.map((a) => (
                  <li key={a.id} className="mb-4 pl-4 last:mb-0">
                    <span
                      className={`absolute -left-[5px] h-2.5 w-2.5 rounded-full ring-2 ring-surface ${ACTIVITY_COLOR[a.tone]}`}
                    />
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="font-semibold text-fg-default">{a.who}</span>
                      <span className="text-fg-subtle">{timeAgo(a.when)}</span>
                    </div>
                    <div className="mt-0.5 text-[12.5px] leading-relaxed text-fg-muted">
                      {a.what}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
      {children}
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const [done, setDone] = useState(task.done);
  const priority = {
    high: 'bg-danger-100 text-danger-600',
    med: 'bg-warn-100 text-warn-600',
    low: 'bg-ink-100 text-fg-muted',
  }[task.priority];

  return (
    <div className="flex items-center gap-2.5 border-b border-border px-5 py-2.5 last:border-b-0">
      <button
        type="button"
        onClick={() => setDone(!done)}
        className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] transition-colors ${
          done
            ? 'border-success-500 bg-success-500 text-white'
            : 'border-[color:var(--border-strong-value)] bg-transparent'
        }`}
      >
        {done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-[13px] font-medium ${
            done ? 'text-fg-muted line-through' : 'text-fg-default'
          }`}
        >
          {task.text}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-fg-muted">
          <Calendar className="h-3 w-3" />
          {task.due}
        </div>
      </div>
      <span
        className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase ${priority}`}
      >
        {task.priority}
      </span>
    </div>
  );
}
