import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import {
  VALID_CLASSIFICATION_SCOPES,
  VALID_UOM,
  typeForUom,
  type Uom,
} from '@/lib/takeoff-utils';

/**
 * POST /api/projects/[id]/classifications/import
 *
 * Receives rows already parsed client-side (SheetJS) and writes them into
 * the project. Every row is dedup'd against existing classifications in the
 * same project — match is by `externalId` first, else by case-insensitive
 * `name`. Matching rows get their quantity (re)set; new rows get created
 * with scope = 'service_and_material' (user classifies manually later).
 *
 * The whole batch is wrapped in one transaction so partial imports don't
 * leave the project half-updated, and a TakeoffImport audit row is written
 * with the per-row outcome counts.
 *
 * mode:
 *   - 'replace': matching rows have their quantity overwritten
 *   - 'add':     matching rows have their quantity incremented
 */
const rowSchema = z.object({
  name: z.string().min(1),
  externalId: z.string().nullable().optional(),
  quantity: z.number().nonnegative(),
  uom: z.enum(VALID_UOM),
  note: z.string().nullable().optional(),
  scope: z.enum(VALID_CLASSIFICATION_SCOPES).optional(),
});

const bodySchema = z.object({
  source: z.enum(['togal', 'csv']).default('togal'),
  fileName: z.string().nullable().optional(),
  mode: z.enum(['replace', 'add']).default('replace'),
  rows: z.array(rowSchema).min(1),
});

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
    parsed = bodySchema.parse(body);
  } catch (err: any) {
    const issue = err?.issues?.[0]?.message ?? err?.message ?? 'Invalid payload';
    return NextResponse.json({ error: issue }, { status: 400 });
  }

  try {
    const existing = await prisma.classification.findMany({
      where: { projectId: id, companyId: ctx.companyId },
      select: { id: true, name: true, externalId: true, quantity: true, uom: true },
    });
    const byExternalId = new Map(
      existing.filter((c) => c.externalId).map((c) => [c.externalId!.toLowerCase(), c])
    );
    const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));

    let created = 0;
    let updated = 0;

    await prisma.$transaction(async (tx) => {
      for (const row of parsed.rows) {
        const key = row.externalId?.trim().toLowerCase();
        const match =
          (key && byExternalId.get(key)) ?? byName.get(row.name.trim().toLowerCase());

        if (match) {
          const newQty =
            parsed.mode === 'add'
              ? Number(match.quantity) + row.quantity
              : row.quantity;
          await tx.classification.update({
            where: { id: match.id },
            data: {
              quantity: newQty,
              // Keep UOM in sync if the import's differs (Togal's "FT" → "LF"
              // has already been normalized client-side).
              uom: row.uom,
              type: typeForUom(row.uom),
              note: row.note ?? undefined,
            },
          });
          updated++;
        } else {
          await tx.classification.create({
            data: {
              companyId: ctx.companyId,
              projectId: id,
              name: row.name.trim(),
              externalId: row.externalId?.trim() || null,
              type: typeForUom(row.uom as Uom),
              uom: row.uom,
              scope: row.scope ?? 'service_and_material',
              quantity: row.quantity,
              note: row.note ?? null,
            },
          });
          created++;
        }
      }

      await tx.takeoffImport.create({
        data: {
          companyId: ctx.companyId,
          projectId: id,
          source: parsed.source,
          fileName: parsed.fileName ?? null,
          rowsImported: parsed.rows.length,
          rowsCreated: created,
          rowsUpdated: updated,
          importedBy: ctx.userId,
        },
      });
    });

    return NextResponse.json({
      rowsImported: parsed.rows.length,
      created,
      updated,
    });
  } catch (err: any) {
    console.error('[classifications.import.POST]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Import failed' },
      { status: 500 }
    );
  }
}
