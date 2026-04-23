import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';

const contactSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
});

const patchClientSchema = z
  .object({
    companyName: z.string().min(2).optional(),
    type: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    zipCode: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    contacts: z.array(contactSchema).optional(),
  })
  .strict();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const client = await prisma.client.findFirst({
      where: { id, companyId: ctx.companyId },
      include: {
        contacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] },
        bids: {
          select: {
            id: true,
            bidNumber: true,
            projectName: true,
            status: true,
            responseDeadline: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        _count: { select: { bids: true } },
      },
    });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    return NextResponse.json(client);
  } catch (err) {
    console.error('[clients.[id].GET]', err);
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'bid', 'edit'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  let parsed;
  try {
    const body = await req.json();
    parsed = patchClientSchema.parse(body);
  } catch (err: any) {
    const issue = err?.issues?.[0]?.message ?? err?.message ?? 'Invalid payload';
    return NextResponse.json({ error: issue }, { status: 400 });
  }

  const existing = await prisma.client.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!existing) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const { contacts, ...clientFields } = parsed;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Update client base fields
      const c = await tx.client.update({
        where: { id },
        data: clientFields as any,
      });

      // If contacts array was provided, do a full replace.
      // We DON'T cascade-delete on bids since contacts have no FK from bids.
      if (contacts !== undefined) {
        // Wipe existing
        await tx.clientContact.deleteMany({ where: { clientId: id } });
        // Recreate
        if (contacts.length > 0) {
          // Ensure only one primary
          let primarySeen = false;
          const data = contacts.map((ct) => {
            const isPrimary = !!ct.isPrimary && !primarySeen;
            if (isPrimary) primarySeen = true;
            return {
              clientId: id,
              name: ct.name,
              email: ct.email ?? null,
              phone: ct.phone ?? null,
              role: ct.role ?? null,
              isPrimary,
            };
          });
          // If no contact was marked primary, mark the first one
          if (!primarySeen && data.length > 0) data[0].isPrimary = true;
          await tx.clientContact.createMany({ data });
        }
      }

      return c;
    });

    const fresh = await prisma.client.findUnique({
      where: { id: updated.id },
      include: {
        contacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] },
        _count: { select: { bids: true } },
      },
    });
    return NextResponse.json(fresh);
  } catch (err) {
    console.error('[clients.[id].PATCH]', err);
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
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
  const existing = await prisma.client.findFirst({
    where: { id, companyId: ctx.companyId },
    include: { _count: { select: { bids: true } } },
  });
  if (!existing) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  try {
    await prisma.client.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[clients.[id].DELETE]', err);
    return NextResponse.json({ error: 'Failed to archive client' }, { status: 500 });
  }
}
