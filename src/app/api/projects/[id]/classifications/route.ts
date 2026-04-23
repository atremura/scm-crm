import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import {
  VALID_CLASSIFICATION_TYPES,
  VALID_UOM,
  VALID_CLASSIFICATION_SCOPES,
  DEFAULT_UOM_BY_TYPE,
  typeForUom,
  type ClassificationType,
  type Uom,
} from '@/lib/takeoff-utils';

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(VALID_CLASSIFICATION_TYPES).optional(),
  uom: z.enum(VALID_UOM).optional(),
  scope: z.enum(VALID_CLASSIFICATION_SCOPES).optional(),
  quantity: z.number().nonnegative().optional(),
  unitCost: z.number().nonnegative().nullable().optional(),
  color: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  externalId: z.string().nullable().optional(),
  templateId: z.string().uuid().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'takeoff', 'view'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, companyId: ctx.companyId },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  try {
    const classifications = await prisma.classification.findMany({
      where: { projectId: id, companyId: ctx.companyId },
      orderBy: { createdAt: 'asc' },
      include: { template: { select: { id: true, name: true } } },
    });
    return NextResponse.json(classifications);
  } catch (err) {
    console.error('[project.classifications.GET]', err);
    return NextResponse.json({ error: 'Failed to list classifications' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'takeoff', 'edit'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, companyId: ctx.companyId },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  let parsed;
  try {
    const body = await req.json();
    parsed = createSchema.parse(body);
  } catch (err: any) {
    const issue = err?.issues?.[0]?.message ?? err?.message ?? 'Invalid payload';
    return NextResponse.json({ error: issue }, { status: 400 });
  }

  // Resolve type + uom consistently. If either is given, derive the other.
  let type: ClassificationType;
  let uom: Uom;
  if (parsed.type && parsed.uom) {
    type = parsed.type;
    uom = parsed.uom;
  } else if (parsed.type) {
    type = parsed.type;
    uom = DEFAULT_UOM_BY_TYPE[parsed.type];
  } else if (parsed.uom) {
    uom = parsed.uom;
    type = typeForUom(parsed.uom);
  } else {
    type = 'area';
    uom = 'SF';
  }

  // Verify template belongs to this tenant if provided
  if (parsed.templateId) {
    const t = await prisma.classificationTemplate.findFirst({
      where: { id: parsed.templateId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!t) return NextResponse.json({ error: 'Template not found' }, { status: 400 });
  }

  try {
    const created = await prisma.classification.create({
      data: {
        companyId: ctx.companyId,
        projectId: id,
        templateId: parsed.templateId ?? null,
        name: parsed.name,
        type,
        uom,
        scope: parsed.scope ?? 'service_and_material',
        quantity: parsed.quantity ?? 0,
        unitCost: parsed.unitCost ?? null,
        color: parsed.color ?? null,
        note: parsed.note ?? null,
        externalId: parsed.externalId ?? null,
      },
      include: { template: { select: { id: true, name: true } } },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('[project.classifications.POST]', err);
    return NextResponse.json({ error: 'Failed to create classification' }, { status: 500 });
  }
}
