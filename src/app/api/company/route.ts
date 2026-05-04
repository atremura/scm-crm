import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/permissions';

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    website: z.string().nullable().optional(),
    baseAddress: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    contactName: z.string().nullable().optional(),
  })
  .strict();

export async function GET() {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const company = await prisma.company.findUnique({
    where: { id: ctx.companyId },
    select: {
      id: true,
      name: true,
      slug: true,
      website: true,
      baseAddress: true,
      phone: true,
      email: true,
      contactName: true,
      logoUrl: true,
    },
  });
  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }
  return NextResponse.json(company);
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.role !== 'Admin') {
    return NextResponse.json(
      { error: 'Forbidden — only Admin can change company info' },
      { status: 403 },
    );
  }

  let parsed;
  try {
    parsed = patchSchema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.errors?.[0]?.message ?? 'Invalid payload' },
      { status: 400 },
    );
  }

  const updated = await prisma.company.update({
    where: { id: ctx.companyId },
    data: parsed,
    select: {
      id: true,
      name: true,
      slug: true,
      website: true,
      baseAddress: true,
      phone: true,
      email: true,
      contactName: true,
      logoUrl: true,
    },
  });
  return NextResponse.json(updated);
}
