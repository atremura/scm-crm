import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/permissions';
import { buildAuthUrl } from '@/lib/gmail';

export async function GET() {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const url = buildAuthUrl(ctx.userId);
    return NextResponse.redirect(url);
  } catch (err: any) {
    console.error('[gmail.start]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to build auth URL' },
      { status: 500 }
    );
  }
}
