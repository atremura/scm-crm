import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';

const createClientSchema = z.object({
  companyName: z.string().min(2),
  type: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  primaryContact: z
    .object({
      name: z.string().min(1),
      email: z.string().email().optional().nullable(),
      phone: z.string().optional().nullable(),
      role: z.string().optional().nullable(),
    })
    .optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const includeInactive = searchParams.get('includeInactive') === 'true';
  const status = searchParams.get('status'); // 'active' | 'inactive' | 'all'
  const type = searchParams.get('type');

  const where: any = { companyId: ctx.companyId };
  if (status === 'inactive') where.isActive = false;
  else if (status === 'all') {
    // no filter
  } else if (!includeInactive) where.isActive = true;
  if (type) where.type = type;
  if (search) {
    where.OR = [
      { companyName: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { contacts: { some: { name: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  try {
    const clients = await prisma.client.findMany({
      where,
      include: {
        contacts: { where: { isPrimary: true }, take: 1 },
        _count: { select: { bids: true } },
      },
      orderBy: { companyName: 'asc' },
      take: 100,
    });
    return NextResponse.json(clients);
  } catch (err) {
    console.error('[clients.GET]', err);
    return NextResponse.json({ error: 'Failed to list clients' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'bid', 'create'))) {
    // Creating a client inline from the bid form uses bid.create permission
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let parsed;
  try {
    const body = await req.json();
    parsed = createClientSchema.parse(body);
  } catch (err: any) {
    const issue = err?.issues?.[0]?.message ?? err?.message ?? 'Invalid payload';
    return NextResponse.json({ error: issue }, { status: 400 });
  }

  try {
    const client = await prisma.client.create({
      data: {
        companyId: ctx.companyId,
        companyName: parsed.companyName,
        type: parsed.type ?? null,
        address: parsed.address ?? null,
        city: parsed.city ?? null,
        state: parsed.state ?? null,
        zipCode: parsed.zipCode ?? null,
        contacts: parsed.primaryContact
          ? {
              create: [
                {
                  name: parsed.primaryContact.name,
                  email: parsed.primaryContact.email ?? null,
                  phone: parsed.primaryContact.phone ?? null,
                  role: parsed.primaryContact.role ?? null,
                  isPrimary: true,
                },
              ],
            }
          : undefined,
      },
      include: { contacts: true },
    });
    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    console.error('[clients.POST]', err);
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
  }
}
