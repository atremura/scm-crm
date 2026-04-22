import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import { generateBidNumber } from '@/lib/bid-server';
import { VALID_PRIORITIES } from '@/lib/bid-utils';
import { geocodeAddress } from '@/lib/geocoding';
import { distanceAndBearingFromBoston } from '@/lib/geo';

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

  // Must reference a client one way or another
  if (!parsed.clientId && !parsed.newClient) {
    return NextResponse.json(
      { error: 'Provide either clientId or newClient' },
      { status: 400 }
    );
  }

  // Neon serverless can hibernate between requests — wake it with a retry
  // on the first DB hit, then proceed normally.
  let extraction = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      extraction = await prisma.bidExtraction.findUnique({
        where: { id: parsed.extractionId },
      });
      break;
    } catch (err: any) {
      if (err?.code === 'P1001' && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  if (!extraction) {
    return NextResponse.json({ error: 'Extraction not found' }, { status: 404 });
  }
  if (extraction.status !== 'pending') {
    return NextResponse.json(
      { error: 'This extraction has already been processed' },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Resolve / create the client
      let clientId = parsed.clientId ?? '';
      if (!clientId && parsed.newClient) {
        const client = await tx.client.create({
          data: {
            companyName: parsed.newClient.companyName,
            type: parsed.newClient.type ?? null,
            city: parsed.newClient.city ?? null,
            state: parsed.newClient.state ?? null,
            contacts: parsed.newClient.contactName
              ? {
                  create: [
                    {
                      name: parsed.newClient.contactName,
                      email: parsed.newClient.contactEmail ?? null,
                      phone: parsed.newClient.contactPhone ?? null,
                      isPrimary: true,
                    },
                  ],
                }
              : undefined,
          },
        });
        clientId = client.id;
      }

      // 2. Create the bid (source = "email_ai")
      const bidNumber = await generateBidNumber(tx as any);
      const bid = await tx.bid.create({
        data: {
          bidNumber,
          clientId,
          projectName: parsed.bid.projectName,
          projectAddress: parsed.bid.projectAddress ?? null,
          workType: parsed.bid.workType ?? null,
          receivedDate: new Date(),
          responseDeadline: parsed.bid.responseDeadline
            ? new Date(parsed.bid.responseDeadline + 'T23:59:59')
            : null,
          priority: parsed.bid.priority,
          notes: parsed.bid.notes ?? null,
          bondRequired: parsed.bid.bondRequired ?? false,
          unionJob: parsed.bid.unionJob ?? false,
          prevailingWage: parsed.bid.prevailingWage ?? false,
          davisBacon: parsed.bid.davisBacon ?? false,
          insuranceRequirements: parsed.bid.insuranceRequirements ?? null,
          source: 'email_ai',
          status: 'new',
        },
      });

      // 3. History entry
      await tx.bidStatusHistory.create({
        data: {
          bidId: bid.id,
          changedBy: ctx.userId,
          fromStatus: null,
          toStatus: 'new',
          notes: `Bid created from AI email extraction (confidence ${extraction.confidence ?? 'n/a'})`,
        },
      });

      // 4. Mark the extraction accepted + link
      await tx.bidExtraction.update({
        where: { id: extraction.id },
        data: {
          bidId: bid.id,
          status: 'accepted',
          acceptedAt: new Date(),
        },
      });

      return bid;
    }, {
      // Neon serverless cold-start can push past the default 5s easily.
      timeout: 30_000,
      maxWait: 10_000,
    });

    // 5. Best-effort geocoding (outside the transaction — Nominatim is slow)
    if (result.projectAddress) {
      try {
        const geo = await geocodeAddress(result.projectAddress);
        if (geo) {
          const { miles } = distanceAndBearingFromBoston(geo.lat, geo.lng);
          await prisma.bid.update({
            where: { id: result.id },
            data: {
              projectLatitude: geo.lat,
              projectLongitude: geo.lng,
              distanceMiles: Math.round(miles * 10) / 10,
            },
          });
        }
      } catch (e) {
        console.warn('[bids.from-extraction] geocode failed', e);
      }
    }

    const fresh = await prisma.bid.findUnique({
      where: { id: result.id },
      include: { client: true },
    });
    return NextResponse.json(fresh, { status: 201 });
  } catch (err) {
    console.error('[bids.from-extraction.POST]', err);
    return NextResponse.json({ error: 'Failed to create bid' }, { status: 500 });
  }
}
