import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import { VALID_PROJECT_STATUSES } from '@/lib/takeoff-utils';

const createProjectSchema = z.object({
  name: z.string().min(3),
  projectNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  workType: z.string().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  estimatorId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /api/projects - List projects in the current company
export async function GET(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'takeoff', 'view'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status'); // 'active' | 'archived' | 'all'
  const search = searchParams.get('search') || '';
  const source = searchParams.get('source'); // 'bid' | 'standalone' | 'all'

  const where: any = { companyId: ctx.companyId };

  if (!status || status === 'active') where.status = 'active';
  else if (status === 'archived') where.status = 'archived';
  // 'all' → no status filter

  if (source === 'bid') where.bidId = { not: null };
  else if (source === 'standalone') where.bidId = null;

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { projectNumber: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } },
    ];
  }

  try {
    const projects = await prisma.project.findMany({
      where,
      include: {
        client: { select: { id: true, companyName: true } },
        bid: { select: { id: true, bidNumber: true, status: true } },
        estimator: { select: { id: true, name: true, email: true } },
        _count: { select: { documents: true, classifications: true } },
      },
      orderBy: [{ startedAt: 'desc' }],
    });
    return NextResponse.json(projects);
  } catch (err) {
    console.error('[projects.GET]', err);
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 });
  }
}

// POST /api/projects - Create a standalone project (not tied to a Bid)
export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'takeoff', 'create'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let parsed;
  try {
    const body = await req.json();
    parsed = createProjectSchema.parse(body);
  } catch (err: any) {
    const issue = err?.issues?.[0]?.message ?? err?.message ?? 'Invalid payload';
    return NextResponse.json({ error: issue }, { status: 400 });
  }

  try {
    // Verify tenant-owned referenced entities
    if (parsed.clientId) {
      const c = await prisma.client.findFirst({
        where: { id: parsed.clientId, companyId: ctx.companyId },
        select: { id: true },
      });
      if (!c) return NextResponse.json({ error: 'Client not found' }, { status: 400 });
    }
    if (parsed.estimatorId) {
      const u = await prisma.user.findFirst({
        where: { id: parsed.estimatorId, companyId: ctx.companyId },
        select: { id: true },
      });
      if (!u) return NextResponse.json({ error: 'Estimator not found' }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        companyId: ctx.companyId,
        name: parsed.name,
        projectNumber: parsed.projectNumber ?? null,
        address: parsed.address ?? null,
        workType: parsed.workType ?? null,
        clientId: parsed.clientId ?? null,
        estimatorId: parsed.estimatorId ?? null,
        notes: parsed.notes ?? null,
        status: 'active',
      },
      include: {
        client: { select: { id: true, companyName: true } },
        estimator: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    console.error('[projects.POST]', err);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
