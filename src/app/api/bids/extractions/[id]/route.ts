import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'bid', 'view'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const extraction = await prisma.bidExtraction.findUnique({
      where: { id },
      select: {
        id: true,
        emailSubject: true,
        fromAddress: true,
        rawEmail: true,
        confidence: true,
        flags: true,
        summary: true,
        extractedData: true,
        modelUsed: true,
        inputTokens: true,
        outputTokens: true,
        cacheReadTokens: true,
        costCents: true,
        status: true,
        createdAt: true,
      },
    });
    if (!extraction) {
      return NextResponse.json({ error: 'Extraction not found' }, { status: 404 });
    }
    return NextResponse.json(extraction);
  } catch (err) {
    console.error('[extractions.[id].GET]', err);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'bid', 'delete'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  try {
    await prisma.bidExtraction.update({
      where: { id },
      data: { status: 'rejected' },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[extractions.[id].DELETE]', err);
    return NextResponse.json({ error: 'Failed to reject' }, { status: 500 });
  }
}
