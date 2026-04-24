/**
 * Rollback the fix-stick-materials.ts script's overreach on foam
 * insulation boards. The regex thought "R-5 (1 in) 4x8" had a 5-ft
 * length tucked in there. Foam/polyiso comes in 4x8 sheets sold per
 * sheet (= 32 SF), not per LF. Pricing intent: $X per sheet,
 * roughly $X/32 per SF.
 *
 * For each affected row, restore UOM=EA and the original $/sheet
 * price (we recover it by multiplying back by the bogus length the
 * normalizer applied — the [lf-normalized] note records that).
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const NAMES = [
  'XPS Foam Board R-5 (1 in) 4x8',
  'XPS Foam Board R-10 (2 in) 4x8',
  'Polyiso Board R-6 (1 in) 4x8',
  'Polyiso Board R-12 (2 in) 4x8',
];

(async () => {
  const company = await prisma.company.findUnique({
    where: { slug: 'jmo' },
    select: { id: true },
  });
  if (!company) throw new Error('jmo not found');

  for (const name of NAMES) {
    const m = await prisma.material.findFirst({
      where: { companyId: company.id, name },
    });
    if (!m) continue;
    if (!m.notes?.includes('[lf-normalized]')) continue;

    // Recover the original per-sheet price by reversing the divide
    const match = m.notes.match(/originally \$(\d+\.\d+)\/EA per (\d+)-ft/);
    if (!match) {
      console.log(`Skipping ${name}: can't parse original`);
      continue;
    }
    const origCents = Math.round(parseFloat(match[1]) * 100);
    const origLow = m.lowCents !== null ? m.lowCents * parseInt(match[2], 10) : null;
    const origHigh = m.highCents !== null ? m.highCents * parseInt(match[2], 10) : null;

    await prisma.material.update({
      where: { id: m.id },
      data: {
        uom: 'EA',
        avgCents: origCents,
        lowCents: origLow,
        highCents: origHigh,
        notes: m.notes
          .split('·')
          .filter((s) => !s.includes('[lf-normalized]'))
          .join('·')
          .trim() || null,
      },
    });
    console.log(`Rolled back: ${name} → $${(origCents / 100).toFixed(2)}/EA`);
  }
  await prisma.$disconnect();
})();
