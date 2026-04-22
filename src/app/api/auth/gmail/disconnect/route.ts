import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/permissions';

export async function POST() {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await prisma.user.update({
      where: { id: ctx.userId },
      data: {
        gmailEmail: null,
        gmailRefreshToken: null,
        gmailConnectedAt: null,
        gmailLastSyncAt: null,
        gmailHistoryId: null,
      },
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[gmail.disconnect]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
