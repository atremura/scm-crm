import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'bid', 'view'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? 'pending';

  try {
    const extractions = await prisma.bidExtraction.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        emailSubject: true,
        fromAddress: true,
        confidence: true,
        summary: true,
        flags: true,
        extractedData: true,
        modelUsed: true,
        inputTokens: true,
        outputTokens: true,
        costCents: true,
        status: true,
        createdAt: true,
      },
    });
    return NextResponse.json(extractions);
  } catch (err) {
    console.error('[bids.extractions.GET]', err);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}
