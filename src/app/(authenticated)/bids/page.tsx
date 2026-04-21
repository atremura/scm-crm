'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Mail,
  Upload,
  Plus,
  Search,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MoreHorizontal,
  Sparkles,
  Flame,
  Inbox,
  AlertCircle,
  CalendarClock,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AiScoreBar } from '@/components/bids/ai-score-bar';
import { getUrgencyLevel } from '@/lib/bid-utils';

type ApiBid = {
  id: string;
  bidNumber: string;
  projectName: string;
  projectAddress: string | null;
  workType: string | null;
  status: string;
  priority: string;
  source: string;
  distanceMiles: number | string | null;
  responseDeadline: string | null;
  receivedDate: string | null;
  createdAt: string;
  client: { id: string; companyName: string; type: string | null };
  assignedUser: { id: string; name: string; email: string } | null;
  _count: { documents: number };
};

type TabKey = 'all' | 'new' | 'reviewing' | 'qualified' | 'sent_to_takeoff' | 'rejected';
type ViewMode = 'list' | 'board';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'sent_to_takeoff', label: 'Sent to Takeoff' },
  { key: 'rejected', label: 'Rejected' },
];

const STATUS_META: Record<
  string,
  { label: string; dot: string; text: string; bg: string }
> = {
  new: { label: 'New', dot: 'bg-ink-400', text: 'text-fg-muted', bg: 'bg-ink-100/60' },
  qualified: { label: 'Qualified', dot: 'bg-blue-500', text: 'text-blue-300', bg: 'bg-blue-500/15' },
  sent_to_takeoff: { label: 'Sent to Takeoff', dot: 'bg-success-500', text: 'text-success-500', bg: 'bg-success-500/15' },
  won: { label: 'Won', dot: 'bg-success-500', text: 'text-success-500', bg: 'bg-success-500/15' },
  lost: { label: 'Lost', dot: 'bg-danger-500', text: 'text-danger-500', bg: 'bg-danger-500/15' },
  rejected: { label: 'Rejected', dot: 'bg-danger-500', text: 'text-danger-500', bg: 'bg-danger-500/15' },
};

const SOURCE_META: Record<string, { label: string; className: string }> = {
  manual: {
    label: 'Manual',
    className: 'bg-ink-100/60 text-fg-muted border border-border',
  },
  email_ai: {
    label: 'Email AI',
    className: 'bg-violet-500/15 text-violet-500 border border-violet-500/30',
  },
  portal_api: {
    label: 'Portal API',
    className: 'bg-blue-500/15 text-blue-500 border border-blue-500/30',
  },
};

function relativeDate(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days >= 14 ? 's' : ''} ago`;
  return `${Math.floor(days / 30)} month${days >= 60 ? 's' : ''} ago`;
}

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

export default function BidsPage() {
  const [bids, setBids] = useState<ApiBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('list');

  async function loadBids(status: TabKey, q: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      if (q) params.set('search', q);
      const res = await fetch(`/api/bids?${params}`);
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load');
      const data = await res.json();
      setBids(data);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load bids');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBids(tab, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    const t = setTimeout(() => loadBids(tab, search), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Compute tab counts from a broader fetch — for now, count from current data
  const counts = useMemo(() => {
    const c: Record<TabKey, number> = {
      all: 0,
      new: 0,
      reviewing: 0,
      qualified: 0,
      sent_to_takeoff: 0,
      rejected: 0,
    };
    bids.forEach((b) => {
      c.all++;
      if (c[b.status as TabKey] !== undefined) c[b.status as TabKey]++;
    });
    return c;
  }, [bids]);

  // Stat cards are based on the current filtered fetch
  const stats = useMemo(() => {
    const now = Date.now();
    const msDay = 86400 * 1000;
    let active = 0;
    let dueToday = 0;
    let dueWeek = 0;
    let qualifiedPending = 0;
    bids.forEach((b) => {
      if (!['rejected', 'won', 'lost'].includes(b.status)) active++;
      if (b.status === 'qualified') qualifiedPending++;
      if (b.responseDeadline) {
        const d = new Date(b.responseDeadline).getTime();
        const diff = Math.floor((d - now) / msDay);
        if (diff >= 0 && diff < 1) dueToday++;
        if (diff >= 0 && diff < 7) dueWeek++;
      }
    });
    return { active, dueToday, dueWeek, qualifiedPending };
  }, [bids]);

  const isEmpty = !loading && bids.length === 0 && !search && tab === 'all';

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 p-6 md:p-8">
      {/* Page head */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-fg-default">
            BIDs
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Incoming opportunities from clients and Gmail capture. AI pre-analysis runs on every new bid.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" disabled title="Coming in Phase 1.5B">
            <Mail className="h-3.5 w-3.5" />
            Sync Gmail
          </Button>
          <Button variant="outline" size="sm" disabled title="Coming soon">
            <Upload className="h-3.5 w-3.5" />
            Import
          </Button>
          <Button size="sm" asChild>
            <Link href="/bids/new">
              <Plus className="h-3.5 w-3.5" />
              New Bid
            </Link>
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Active Bids"
          value={stats.active}
          icon={<Inbox className="h-4 w-4" />}
          tone="blue"
        />
        <StatCard
          label="Due Today"
          value={stats.dueToday}
          icon={<AlertCircle className="h-4 w-4" />}
          tone={stats.dueToday > 0 ? 'danger' : 'muted'}
        />
        <StatCard
          label="Due This Week"
          value={stats.dueWeek}
          icon={<CalendarClock className="h-4 w-4" />}
          tone="warn"
        />
        <StatCard
          label="Qualified — Pending Takeoff"
          value={stats.qualifiedPending}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative flex items-center gap-2 px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                active ? 'text-fg-default' : 'text-fg-muted hover:text-fg-default'
              }`}
            >
              {t.label}
              <span
                className={`text-[11.5px] font-medium ${
                  active ? 'text-blue-500' : 'text-fg-subtle'
                }`}
              >
                {counts[t.key]}
              </span>
              {active && (
                <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-blue-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[260px] flex-1 max-w-[360px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-fg-subtle" />
          <Input
            placeholder="Search bids, clients, IDs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" disabled title="Advanced filters coming soon">
          <Filter className="h-3.5 w-3.5" />
          Filters
        </Button>
        <Button variant="outline" size="sm" disabled>
          Work Type: Any
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="sm" disabled>
          Owner: Any
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        <div className="ml-auto inline-flex rounded-md bg-sunken p-0.5">
          <button
            type="button"
            onClick={() => setView('list')}
            className={`rounded px-3 py-1 text-[12.5px] font-semibold transition-colors ${
              view === 'list'
                ? 'bg-surface text-fg-default shadow-sm'
                : 'text-fg-muted hover:text-fg-default'
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setView('board')}
            className={`rounded px-3 py-1 text-[12.5px] font-semibold transition-colors ${
              view === 'board'
                ? 'bg-surface text-fg-default shadow-sm'
                : 'text-fg-muted hover:text-fg-default'
            }`}
          >
            Board
          </button>
        </div>
      </div>

      {isEmpty ? (
        <EmptyState />
      ) : view === 'list' ? (
        <BidsTable bids={bids} loading={loading} total={bids.length} />
      ) : (
        <BidsBoard bids={bids} loading={loading} />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: 'blue' | 'success' | 'warn' | 'danger' | 'muted';
}) {
  const toneBg: Record<typeof tone, string> = {
    blue: 'bg-blue-500/15 text-blue-500',
    success: 'bg-success-500/15 text-success-500',
    warn: 'bg-warn-500/15 text-warn-500',
    danger: 'bg-danger-500/15 text-danger-500',
    muted: 'bg-ink-100/60 text-fg-muted',
  };
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-muted">
          {label}
        </span>
        <span className={`grid h-7 w-7 place-items-center rounded-md ${toneBg[tone]}`}>
          {icon}
        </span>
      </div>
      <div className="mt-2 text-[26px] font-bold leading-none text-fg-default">
        {value}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-500/10 text-blue-500">
        <Inbox className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-[18px] font-bold text-fg-default">No bids yet</h2>
      <p className="mt-1.5 max-w-md text-sm text-fg-muted">
        Create your first bid manually — email capture and portal integration come
        later. Every bid starts with a client and a deadline.
      </p>
      <Button size="lg" className="mt-5" asChild>
        <Link href="/bids/new">
          <Plus className="h-4 w-4" />
          New Bid
        </Link>
      </Button>
    </div>
  );
}

function FlagBadge({ bid }: { bid: ApiBid }) {
  const distance = typeof bid.distanceMiles === 'string'
    ? parseFloat(bid.distanceMiles)
    : bid.distanceMiles;
  const isFar = distance !== null && distance !== undefined && !Number.isNaN(distance) && distance > 100;
  if (isFar) {
    return (
      <span className="inline-flex items-center rounded-full bg-danger-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-danger-500">
        Out of range
      </span>
    );
  }
  if (bid.priority === 'urgent') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warn-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-warn-500">
        <Flame className="h-2.5 w-2.5" fill="currentColor" />
        Hot
      </span>
    );
  }
  if (bid.source === 'email_ai') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-violet-500">
        <Sparkles className="h-2.5 w-2.5" />
        AI
      </span>
    );
  }
  return null;
}

function SourceBadge({ source }: { source: string }) {
  const meta = SOURCE_META[source] ?? SOURCE_META.manual;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

function OwnerCell({ bid }: { bid: ApiBid }) {
  if (!bid.assignedUser) return <span className="text-fg-subtle">—</span>;
  const initials = bid.assignedUser.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      title={bid.assignedUser.name}
      className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-navy-800 text-[10.5px] font-bold text-white"
    >
      {initials}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.new;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.bg} ${meta.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function DueCell({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-fg-subtle">—</span>;
  const urgency = getUrgencyLevel(new Date(iso));
  if (!urgency) return <span className="text-fg-muted">{formatDueDate(iso)}</span>;
  return (
    <div className="flex flex-col">
      <span className={`text-[13px] font-semibold ${urgency.colorClass}`}>
        {formatDueDate(iso)}
      </span>
      <span
        className={`mt-0.5 inline-flex w-fit items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${urgency.bgClass} ${urgency.colorClass} ${
          urgency.pulse ? 'animate-pulse' : ''
        }`}
      >
        {urgency.label}
      </span>
    </div>
  );
}

function DistanceCell({ value }: { value: ApiBid['distanceMiles'] }) {
  if (value === null || value === undefined) {
    return <span className="text-fg-subtle">—</span>;
  }
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) return <span className="text-fg-subtle">—</span>;
  const isFar = n > 100;
  return (
    <span className={`inline-flex items-center gap-1 ${isFar ? 'text-danger-500' : 'text-fg-default'}`}>
      <MapPin className="h-3 w-3" />
      {n} mi
    </span>
  );
}

function BidsTable({
  bids,
  loading,
  total,
}: {
  bids: ApiBid[];
  loading: boolean;
  total: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
              <th className="w-9 px-4 py-3">
                <input type="checkbox" className="h-4 w-4 rounded border-border" />
              </th>
              <th className="px-4 py-3">Bid</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Work Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Distance</th>
              <th className="px-4 py-3">AI Score</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Owner</th>
              <th className="w-10 px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && bids.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-fg-subtle">
                  Loading…
                </td>
              </tr>
            ) : bids.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-fg-subtle">
                  No bids match the current filters
                </td>
              </tr>
            ) : (
              bids.map((b) => (
                <tr
                  key={b.id}
                  className="cursor-pointer border-b border-border last:border-b-0 transition-colors hover:bg-sunken/60"
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="h-4 w-4 rounded border-border" />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/bids/${b.id}`} className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-fg-default">
                          {b.projectName}
                        </span>
                        <FlagBadge bid={b} />
                      </div>
                      <span className="mt-0.5 font-mono text-[11px] text-fg-muted">
                        {b.bidNumber} · {relativeDate(b.createdAt)}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-fg-default">
                    {b.client.companyName}
                  </td>
                  <td className="px-4 py-3">
                    {b.workType ? (
                      <span className="inline-flex items-center rounded-full border border-border bg-sunken px-2 py-0.5 text-[11px] font-medium text-fg-muted">
                        {b.workType}
                      </span>
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={b.status} />
                  </td>
                  <td className="px-4 py-3">
                    <SourceBadge source={b.source} />
                  </td>
                  <td className="px-4 py-3">
                    <DistanceCell value={b.distanceMiles} />
                  </td>
                  <td className="px-4 py-3">
                    <AiScoreBar score={null} />
                  </td>
                  <td className="px-4 py-3">
                    <DueCell iso={b.responseDeadline} />
                  </td>
                  <td className="px-4 py-3">
                    <OwnerCell bid={b} />
                  </td>
                  <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/bids/${b.id}`}>
                        <MoreHorizontal className="h-[15px] w-[15px]" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {bids.length > 0 && (
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-[12.5px] text-fg-muted">
          <span>
            Showing {bids.length} of {total} bids
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" disabled>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="secondary" size="sm">1</Button>
            <Button variant="ghost" size="sm" disabled>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const BOARD_COLS: { key: string; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'sent_to_takeoff', label: 'Sent to Takeoff' },
  { key: 'won', label: 'Won' },
];

function BidsBoard({ bids, loading }: { bids: ApiBid[]; loading: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {BOARD_COLS.map((col) => {
        const items = bids.filter((b) => b.status === col.key);
        return (
          <div key={col.key} className="rounded-lg border border-border bg-sunken/50 p-3">
            <header className="mb-3 flex items-center justify-between px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
              <span>{col.label}</span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-[10.5px] text-fg-default">
                {items.length}
              </span>
            </header>
            <div className="flex flex-col gap-2">
              {items.map((b) => (
                <Link
                  key={b.id}
                  href={`/bids/${b.id}`}
                  className="block cursor-pointer rounded-lg border border-border bg-surface p-3 transition-colors hover:border-blue-500/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10.5px] text-fg-muted">
                      {b.bidNumber}
                    </span>
                    <FlagBadge bid={b} />
                  </div>
                  <div className="mt-1.5 text-[13px] font-semibold leading-snug text-fg-default">
                    {b.projectName}
                  </div>
                  <div className="mt-1 text-[12px] text-fg-muted">
                    {b.client.companyName}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-fg-muted">
                    <MapPin className="h-3 w-3" />
                    {b.distanceMiles ? `${b.distanceMiles}mi · ` : ''}
                    {b.workType ?? 'No work type'}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <SourceBadge source={b.source} />
                    <DueCell iso={b.responseDeadline} />
                  </div>
                </Link>
              ))}
              {items.length === 0 && !loading && (
                <div className="rounded-md border border-dashed border-border p-4 text-center text-[11.5px] text-fg-subtle">
                  No bids
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
