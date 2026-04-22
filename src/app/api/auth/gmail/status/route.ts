import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/permissions';

export async function GET() {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: {
      gmailEmail: true,
      gmailConnectedAt: true,
      gmailLastSyncAt: true,
    },
  });

  return NextResponse.json({
    connected: Boolean(user?.gmailEmail),
    email: user?.gmailEmail ?? null,
    connectedAt: user?.gmailConnectedAt ?? null,
    lastSyncAt: user?.gmailLastSyncAt ?? null,
  });
}
