import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/permissions';

const ACTIVE_STATUSES = ['new', 'qualified', 'sent_to_takeoff'];
const TERMINAL_STATUSES = ['won', 'lost', 'rejected'];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function monthLabel(d: Date): string {
  return d.toLocaleString('en-US', { month: 'short' });
}

export async function GET() {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [bids, statusGroups, recentHistory] = await Promise.all([
      prisma.bid.findMany({
        where: { companyId: ctx.companyId },
        select: {
          id: true,
          status: true,
          distanceMiles: true,
          createdAt: true,
          responseDeadline: true,
        },
      }),
      prisma.bid.groupBy({
        by: ['status'],
        where: { companyId: ctx.companyId },
        _count: { _all: true },
      }),
      prisma.bidStatusHistory.findMany({
        where: { bid: { companyId: ctx.companyId } },
        orderBy: { changedAt: 'desc' },
        take: 8,
        include: {
          user: { select: { id: true, name: true } },
          bid: { select: { id: true, bidNumber: true, projectName: true } },
        },
      }),
    ]);

    // ---- KPIs ----
    const active = bids.filter((b) => ACTIVE_STATUSES.includes(b.status)).length;
    const won = bids.filter((b) => b.status === 'won').length;
    const lost = bids.filter((b) => b.status === 'lost').length;
    const winRate =
      won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null;

    const distances = bids
      .map((b) =>
        b.distanceMiles !== null && b.distanceMiles !== undefined
          ? Number(b.distanceMiles)
          : null
      )
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const avgDistance = distances.length
      ? Math.round(distances.reduce((a, b) => a + b, 0) / distances.length)
      : null;

    const now = Date.now();
    const msDay = 86400 * 1000;
    const newThisWeek = bids.filter(
      (b) => b.createdAt && now - new Date(b.createdAt).getTime() < 7 * msDay
    ).length;

    const dueThisWeek = bids.filter((b) => {
      if (!b.responseDeadline) return false;
      const t = new Date(b.responseDeadline).getTime();
      return t >= now && t - now < 7 * msDay;
    }).length;

    // ---- Funnel ----
    const counts: Record<string, number> = {};
    statusGroups.forEach((g) => {
      counts[g.status] = g._count._all;
    });
    const funnel = [
      { stage: 'New', status: 'new', count: counts.new ?? 0 },
      { stage: 'Reviewing', status: 'qualified', count: counts.qualified ?? 0 },
      {
        stage: 'Qualified',
        status: 'qualified',
        count: counts.qualified ?? 0,
      },
      {
        stage: 'Sent to Takeoff',
        status: 'sent_to_takeoff',
        count: counts.sent_to_takeoff ?? 0,
      },
    ];

    // ---- Monthly series (last 6 months) ----
    const series: Array<{
      m: string;
      bids: number;
      won: number;
    }> = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const start = addMonths(startOfMonth(today), -i);
      const end = addMonths(start, 1);
      const monthBids = bids.filter((b) => {
        const c = b.createdAt ? new Date(b.createdAt) : null;
        return c && c >= start && c < end;
      });
      series.push({
        m: monthLabel(start),
        bids: monthBids.length,
        won: monthBids.filter((b) => b.status === 'won').length,
      });
    }

    // ---- Recent activity ----
    const activity = recentHistory.map((h) => ({
      id: h.id,
      who: h.user.name,
      what: `${h.fromStatus ? `moved ${h.bid.bidNumber} from "${h.fromStatus}" to ` : `created ${h.bid.bidNumber} as `}"${h.toStatus}"`,
      when: h.changedAt,
      bidId: h.bid.id,
      bidNumber: h.bid.bidNumber,
      projectName: h.bid.projectName,
      tone:
        h.toStatus === 'won'
          ? 'green'
          : h.toStatus === 'rejected' || h.toStatus === 'lost'
            ? 'amber'
            : h.toStatus === 'sent_to_takeoff'
              ? 'green'
              : 'blue',
    }));

    return NextResponse.json({
      kpis: {
        active,
        winRate,
        avgDistance,
        newThisWeek,
        dueThisWeek,
        won,
        lost,
        total: bids.length,
        terminalCount: bids.filter((b) => TERMINAL_STATUSES.includes(b.status))
          .length,
      },
      funnel,
      series,
      activity,
    });
  } catch (err) {
    console.error('[dashboard.GET]', err);
    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 }
    );
  }
}
