import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/permissions';

const patchSchema = z.record(z.string(), z.string());

export async function GET() {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await prisma.systemSetting.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { key: 'asc' },
    });
    const map: Record<string, string> = {};
    rows.forEach((r) => {
      map[r.key] = r.value;
    });
    return NextResponse.json({ settings: map, raw: rows });
  } catch (err) {
    console.error('[settings.GET]', err);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden — only Admin can change settings' }, { status: 403 });
  }

  let parsed: Record<string, string>;
  try {
    const body = await req.json();
    parsed = patchSchema.parse(body);
  } catch (err: any) {
    const issue = err?.issues?.[0]?.message ?? err?.message ?? 'Invalid payload';
    return NextResponse.json({ error: issue }, { status: 400 });
  }

  try {
    const ops = Object.entries(parsed).map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { companyId_key: { companyId: ctx.companyId, key } },
        update: { value },
        create: { companyId: ctx.companyId, key, value },
      })
    );
    await prisma.$transaction(ops);

    const rows = await prisma.systemSetting.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { key: 'asc' },
    });
    const map: Record<string, string> = {};
    rows.forEach((r) => {
      map[r.key] = r.value;
    });
    return NextResponse.json({ settings: map });
  } catch (err) {
    console.error('[settings.PATCH]', err);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
