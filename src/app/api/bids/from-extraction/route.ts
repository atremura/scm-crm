import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import { VALID_PRIORITIES } from '@/lib/bid-utils';
import { acceptExtractionAsBid } from '@/lib/bid-creator';

const requestSchema = z.object({
  extractionId: z.string().uuid(),
  // Either pick an existing client, or create one inline
  clientId: z.string().uuid().optional(),
  newClient: z
    .object({
      companyName: z.string().min(2),
      type: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      state: z.string().optional().nullable(),
      contactName: z.string().optional().nullable(),
      contactEmail: z.string().optional().nullable(),
      contactPhone: z.string().optional().nullable(),
    })
    .optional(),
  // Reviewed bid fields (user may have edited the AI suggestions)
  bid: z.object({
    projectName: z.string().min(3),
    projectAddress: z.string().nullable().optional(),
    workType: z.string().nullable().optional(),
    responseDeadline: z.string().nullable().optional(), // ISO date or null
    priority: z.enum(VALID_PRIORITIES).default('medium'),
    notes: z.string().nullable().optional(),
    bondRequired: z.boolean().optional().default(false),
    unionJob: z.boolean().optional().default(false),
    prevailingWage: z.boolean().optional().default(false),
    davisBacon: z.boolean().optional().default(false),
    insuranceRequirements: z.string().nullable().optional(),
  }),
});

export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'bid', 'create'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let parsed;
  try {
    const body = await req.json();
    parsed = requestSchema.parse(body);
  } catch (err: any) {
    const issue = err?.issues?.[0]?.message ?? err?.message ?? 'Invalid payload';
    return NextResponse.json({ error: issue }, { status: 400 });
  }

  if (!parsed.clientId && !parsed.newClient) {
    return NextResponse.json(
      { error: 'Provide either clientId or newClient' },
      { status: 400 }
    );
  }

  try {
    const result = await acceptExtractionAsBid(parsed.extractionId, {
      companyId: ctx.companyId,
      actorUserId: ctx.userId,
      clientId: parsed.clientId,
      newClient: parsed.newClient,
      bidOverrides: {
        projectName: parsed.bid.projectName,
        projectAddress: parsed.bid.projectAddress ?? null,
        workType: parsed.bid.workType ?? null,
        responseDeadline: parsed.bid.responseDeadline ?? null,
        priority: parsed.bid.priority,
        notes: parsed.bid.notes ?? null,
        bondRequired: parsed.bid.bondRequired ?? false,
        unionJob: parsed.bid.unionJob ?? false,
        prevailingWage: parsed.bid.prevailingWage ?? false,
        davisBacon: parsed.bid.davisBacon ?? false,
        insuranceRequirements: parsed.bid.insuranceRequirements ?? null,
      },
      // Manual review path — start at 'new' so user can do normal qualify flow
      forceStatus: 'new',
    });

    const fresh = await prisma.bid.findFirst({
      where: { id: result.bidId, companyId: ctx.companyId },
      include: { client: true },
    });
    return NextResponse.json(fresh, { status: 201 });
  } catch (err: any) {
    console.error('[bids.from-extraction.POST]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to create bid' },
      { status: 500 }
    );
  }
}
