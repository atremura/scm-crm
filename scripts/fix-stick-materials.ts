/**
 * Catalog fix: a chunk of the Cowork-imported materials are sold in
 * 8/10/12-ft sticks but landed in our DB with UOM=EA and the per-stick
 * price. When the AI picks one for an LF takeoff, it multiplies LF × $/EA
 * and produces 8-12× the right cost.
 *
 * This script finds those rows by parsing the length out of the material
 * name (matches "8 ft", "10 ft", "12 ft", "8'", etc), divides the unit
 * price by the length, and switches the UOM to LF. Existing notes get
 * a marker so we can recognize already-fixed rows on re-runs.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const COMPANY_SLUG = 'jmo';
const MARKER = '[lf-normalized]';

function parseLengthFt(name: string): number | null {
  // Match "12 ft", "12ft", "12'", "x 12 ft", but only when the rest of the
  // name suggests a stick (HardieTrim, Hardie lap, Trim, Plank, board).
  const len = name.match(/(\d{1,2})\s*(?:ft|'|\s)/i);
  if (!len) return null;
  const ft = parseInt(len[1], 10);
  if (!Number.isFinite(ft) || ft < 4 || ft > 24) return null;
  return ft;
}

(async () => {
  const company = await prisma.company.findUnique({
    where: { slug: COMPANY_SLUG },
    select: { id: true, name: true },
  });
  if (!company) throw new Error('Company jmo not found');

  // Candidates: UOM == 'EA' AND name contains a length spec AND name suggests
  // a linear product (trim, lap, plank, board, fascia, baseboard, casing).
  const candidates = await prisma.material.findMany({
    where: {
      companyId: company.id,
      uom: 'EA',
      OR: [
        { name: { contains: 'trim', mode: 'insensitive' } },
        { name: { contains: 'lap', mode: 'insensitive' } },
        { name: { contains: 'plank', mode: 'insensitive' } },
        { name: { contains: 'board', mode: 'insensitive' } },
        { name: { contains: 'fascia', mode: 'insensitive' } },
        { name: { contains: 'baseboard', mode: 'insensitive' } },
        { name: { contains: 'casing', mode: 'insensitive' } },
        { name: { contains: 'crown', mode: 'insensitive' } },
        { name: { contains: 'corner post', mode: 'insensitive' } },
        { name: { contains: 'starter strip', mode: 'insensitive' } },
        { name: { contains: 'j-channel', mode: 'insensitive' } },
        { name: { contains: 'pvc 1x', mode: 'insensitive' } },
      ],
    },
  });

  let updated = 0;
  let skipped = 0;
  let alreadyFixed = 0;
  const detail: string[] = [];

  for (const m of candidates) {
    if (m.notes?.includes(MARKER)) {
      alreadyFixed++;
      continue;
    }
    const len = parseLengthFt(m.name);
    if (!len) {
      skipped++;
      continue;
    }

    const newAvg = Math.round(m.avgCents / len);
    const newLow = m.lowCents !== null ? Math.round(m.lowCents / len) : null;
    const newHigh = m.highCents !== null ? Math.round(m.highCents / len) : null;
    const note = `${MARKER} originally $${(m.avgCents / 100).toFixed(2)}/${m.uom} per ${len}-ft stick → ${(newAvg / 100).toFixed(2)}/LF`;
    detail.push(
      `  ${m.name.slice(0, 60).padEnd(60)} $${(m.avgCents / 100).toFixed(2)}/EA × ${len}ft → $${(newAvg / 100).toFixed(2)}/LF`
    );

    await prisma.material.update({
      where: { id: m.id },
      data: {
        uom: 'LF',
        avgCents: newAvg,
        lowCents: newLow,
        highCents: newHigh,
        notes: m.notes ? `${m.notes} · ${note}` : note,
      },
    });
    updated++;
  }

  console.log(`Updated ${updated} · skipped ${skipped} · already-fixed ${alreadyFixed}`);
  if (detail.length > 0) {
    console.log('\nDetails:');
    for (const d of detail) console.log(d);
  }
  await prisma.$disconnect();
})();
