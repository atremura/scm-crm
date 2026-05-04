import { NextRequest, NextResponse } from 'next/server';
import { canDo, requireAuth } from '@/lib/permissions';
import { loadExportData } from '@/lib/estimate-exports/load';
import { buildClientExcel } from '@/lib/estimate-exports/client-excel';
import { buildInternalExcel } from '@/lib/estimate-exports/internal-excel';

/**
 * GET /api/estimates/[id]/export?type=client|internal&format=xlsx|pdf
 *
 * Streams a download of the proposal in the requested shape:
 *   - type=client    → client-facing (no OH&P; markup baked into unit prices)
 *   - type=internal  → full internal (MH, $/hr, Mat $/u, OH&P breakdown)
 *
 * Format=pdf will land in a follow-up.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'estimate', 'view'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? 'client';
  const format = url.searchParams.get('format') ?? 'xlsx';

  if (type !== 'client' && type !== 'internal') {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }
  if (format !== 'xlsx' && format !== 'pdf') {
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  }

  const data = await loadExportData(id, ctx.companyId);
  if (!data) {
    return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
  }

  if (format === 'pdf') {
    return NextResponse.json({ error: 'PDF export coming in next phase' }, { status: 501 });
  }

  const buffer = type === 'client' ? await buildClientExcel(data) : await buildInternalExcel(data);

  const slug = (data.proposalNumber ?? data.projectName)
    .toString()
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .slice(0, 60);
  const variant = type === 'client' ? 'proposal' : 'internal';
  const filename = `${slug}_${variant}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.byteLength),
    },
  });
}
