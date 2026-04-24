/**
 * Switch the rainscreen productivities (Z-girt, PT 1x3 furring,
 * mineral wool, rigid insulation) from per-LF to per-SF wall — the
 * way Cowork's proposal actually meters them. The Kanso takeoff
 * lists 136,916 SF of envelope, not LF, so an LF productivity gets
 * abused by the AI when nothing else fits.
 *
 * Rough math from Cowork's spreadsheet:
 *   Z-girt @ 24" OC horizontal: ~0.5 LF girt per SF wall
 *     → 0.115 MH/LF × 0.5 LF/SF = 0.058 MH/SF wall (round 0.06)
 *   PT 1x3 vertical @ 16" OC:    0.75 LF furring per SF wall
 *     → 0.035 MH/LF × 0.75 = 0.026 MH/SF (round 0.025)
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

(async () => {
  const company = await prisma.company.findUnique({
    where: { slug: 'jmo' },
    select: { id: true },
  });
  if (!company) throw new Error('jmo not found');

  const fixes = [
    {
      scopeName: 'Z-girt thermally broken — install (horizontal 24" OC)',
      newScope: 'Z-girt thermally broken — install (per SF wall)',
      uom: 'SF',
      mhLow: 0.04,
      mhAvg: 0.06,
      mhHigh: 0.08,
      notes:
        'Per SF of wall. Z-girt @ 24" OC horizontal ≈ 0.5 LF girt per SF wall × 0.115 MH/LF.',
    },
    {
      scopeName: 'PT 1x3 vertical furring + EPDM tape — install',
      newScope: 'PT 1x3 vertical furring + EPDM tape — install (per SF wall)',
      uom: 'SF',
      mhLow: 0.018,
      mhAvg: 0.025,
      mhHigh: 0.04,
      notes:
        'Per SF of wall. 1x3 vertical @ 16" OC ≈ 0.75 LF per SF × 0.035 MH/LF.',
    },
  ];

  for (const f of fixes) {
    const existing = await prisma.productivityEntry.findFirst({
      where: { companyId: company.id, scopeName: f.scopeName },
    });
    if (!existing) {
      console.log(`  not found: ${f.scopeName}`);
      continue;
    }
    await prisma.productivityEntry.update({
      where: { id: existing.id },
      data: {
        scopeName: f.newScope,
        uom: f.uom,
        mhPerUnitLow: f.mhLow,
        mhPerUnitAvg: f.mhAvg,
        mhPerUnitHigh: f.mhHigh,
        notes: f.notes,
      },
    });
    console.log(`  ✓ ${f.newScope} (${f.uom}, MH avg ${f.mhAvg})`);
  }

  // Reset KANSO lines that need re-pricing — anything where the AI
  // used a now-corrected catalog row, or had cross-UOM productivity.
  // Strategy: any line whose productivity entry is in Finish Carpentry
  // or whose scope mentions Z-girt / furring / fascia / trim / corner /
  // baseboard / casing — clear material + flag for review so the next
  // Re-price all hits them.
  const reset = await prisma.estimateLine.updateMany({
    where: {
      estimateId: 'd657c745-1d6a-49d3-9b79-b0d12f010862',
      OR: [
        { name: { contains: 'TRIM', mode: 'insensitive' } },
        { name: { contains: 'FASCIA', mode: 'insensitive' } },
        { name: { contains: 'CORNER', mode: 'insensitive' } },
        { name: { contains: 'GUARDRAIL', mode: 'insensitive' } },
        { name: { contains: 'Z-Girt', mode: 'insensitive' } },
        { name: { contains: 'Furring', mode: 'insensitive' } },
        { name: { contains: 'Wood Furring', mode: 'insensitive' } },
        { name: { contains: 'Fasteners', mode: 'insensitive' } },
        { name: { contains: 'Tape', mode: 'insensitive' } },
      ],
    },
    data: {
      needsReview: true,
      userOverridden: false,
      materialBreakdown: undefined,
      materialCostCents: null,
      laborCostCents: null,
      laborHours: null,
      mhPerUnit: null,
      laborRateCents: null,
      productivityEntryId: null,
      laborTradeId: null,
      subtotalCents: null,
      groupName: 'Unclassified',
    },
  });
  console.log(`\nReset ${reset.count} Kanso lines back to needsReview for Re-price all.`);

  await prisma.$disconnect();
})();
