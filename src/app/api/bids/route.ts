import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import { generateBidNumber } from '@/lib/bid-server';
import { VALID_PRIORITIES, VALID_SOURCES } from '@/lib/bid-utils';
import { geocodeAddress } from '@/lib/geocoding';
import { distanceAndBearingFromBoston } from '@/lib/geo';

const createBidSchema = z.object({
  clientId: z.string().uuid(),
  projectName: z.string().min(3),
  projectAddress: z.string().optional().nullable(),
  workType: z.string().optional().nullable(),
  receivedDate: z.string().datetime().optional().nullable(),
  responseDeadline: z.string().datetime().optional().nullable(),
  priority: z.enum(VALID_PRIORITIES).default('medium'),
  notes: z.string().optional().nullable(),
  bondRequired: z.boolean().optional().default(false),
  unionJob: z.boolean().optional().default(false),
  prevailingWage: z.boolean().optional().default(false),
  davisBacon: z.boolean().optional().default(false),
  insuranceRequirements: z.string().optional().nullable(),
  source: z.enum(VALID_SOURCES).optional().default('manual'),
});

export async function GET(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'bid', 'view'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search') || '';
  const assignedTo = searchParams.get('assignedTo');
  const clientId = searchParams.get('clientId');
  const workType = searchParams.get('workType');
  const urgency = searchParams.get('urgency'); // today | week | overdue
  const source = searchParams.get('source');

  const where: any = {};

  if (status && status !== 'all') {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { projectName: { contains: search, mode: 'insensitive' } },
      { bidNumber: { contains: search, mode: 'insensitive' } },
      { client: { companyName: { contains: search, mode: 'insensitive' } } },
    ];
  }

  if (assignedTo === 'me') {
    where.assignedTo = ctx.userId;
  } else if (assignedTo) {
    where.assignedTo = assignedTo;
  }

  if (clientId) where.clientId = clientId;
  if (workType) where.workType = workType;
  if (source) where.source = source;

  if (urgency) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (urgency === 'overdue') {
      where.responseDeadline = { lt: startOfDay };
    } else if (urgency === 'today') {
      const end = new Date(startOfDay);
      end.setDate(end.getDate() + 1);
      where.responseDeadline = { gte: startOfDay, lt: end };
    } else if (urgency === 'week') {
      const end = new Date(startOfDay);
      end.setDate(end.getDate() + 7);
      where.responseDeadline = { gte: startOfDay, lt: end };
    }
  }

  try {
    const bids = await prisma.bid.findMany({
      where,
      include: {
        client: { select: { id: true, companyName: true, type: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        _count: { select: { documents: true } },
      },
      orderBy: [{ responseDeadline: 'asc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(bids);
  } catch (err) {
    console.error('[bids.GET]', err);
    return NextResponse.json({ error: 'Failed to list bids' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'bid', 'create'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let parsed;
  try {
    const body = await req.json();
    parsed = createBidSchema.parse(body);
  } catch (err: any) {
    const issue = err?.issues?.[0]?.message ?? err?.message ?? 'Invalid payload';
    return NextResponse.json({ error: issue }, { status: 400 });
  }

  try {
    // Verify client exists
    const client = await prisma.client.findUnique({ where: { id: parsed.clientId } });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 400 });
    }

    const bid = await prisma.$transaction(async (tx) => {
      const bidNumber = await generateBidNumber(tx as any);

      const created = await tx.bid.create({
        data: {
          bidNumber,
          clientId: parsed.clientId,
          projectName: parsed.projectName,
          projectAddress: parsed.projectAddress ?? null,
          workType: parsed.workType ?? null,
          receivedDate: parsed.receivedDate ? new Date(parsed.receivedDate) : new Date(),
          responseDeadline: parsed.responseDeadline ? new Date(parsed.responseDeadline) : null,
          priority: parsed.priority,
          notes: parsed.notes ?? null,
          bondRequired: parsed.bondRequired,
          unionJob: parsed.unionJob,
          prevailingWage: parsed.prevailingWage,
          davisBacon: parsed.davisBacon,
          insuranceRequirements: parsed.insuranceRequirements ?? null,
          source: parsed.source,
          status: 'new',
        },
      });

      await tx.bidStatusHistory.create({
        data: {
          bidId: created.id,
          changedBy: ctx.userId,
          fromStatus: null,
          toStatus: 'new',
          notes: `Bid created (source: ${parsed.source})`,
        },
      });

      return created;
    });

    // Best-effort geocoding (don't block the response on a slow Nominatim call,
    // but await briefly so the client gets the location back when possible).
    if (bid.projectAddress) {
      try {
        const result = await geocodeAddress(bid.projectAddress);
        if (result) {
          const { miles } = distanceAndBearingFromBoston(result.lat, result.lng);
          const updated = await prisma.bid.update({
            where: { id: bid.id },
            data: {
              projectLatitude: result.lat,
              projectLongitude: result.lng,
              distanceMiles: Math.round(miles * 10) / 10,
            },
          });
          return NextResponse.json(updated, { status: 201 });
        }
      } catch (e) {
        console.warn('[bids.POST] geocode failed', e);
      }
    }

    return NextResponse.json(bid, { status: 201 });
  } catch (err) {
    console.error('[bids.POST]', err);
    return NextResponse.json({ error: 'Failed to create bid' }, { status: 500 });
  }
}
