/**
 * Backfill EstimateLine.groupName for existing estimates so they pick
 * up the auto-section grouping. Maps each line to its productivity's
 * division → section. Lines with no productivity match land in
 * "Unclassified".
 *
 * Idempotent — run as many times as needed.
 */
import { PrismaClient } from '@prisma/client';
import { sectionForDivision } from '../src/lib/estimate-pricing';

const prisma = new PrismaClient();

(async () => {
  const lines = await prisma.estimateLine.findMany({
    include: {
      productivityEntry: { include: { division: { select: { name: true } } } },
    },
  });

  let updated = 0;
  for (const l of lines) {
    const groupName = l.productivityEntry
      ? sectionForDivision(l.productivityEntry.division.name)
      : 'Unclassified';
    if (l.groupName !== groupName) {
      await prisma.estimateLine.update({
        where: { id: l.id },
        data: { groupName },
      });
      updated++;
    }
  }
  console.log(`Updated ${updated} of ${lines.length} estimate lines`);

  // Show resulting section distribution per estimate
  const estimates = await prisma.estimate.findMany({
    include: { lines: { select: { groupName: true } }, project: { select: { name: true } } },
  });
  for (const e of estimates) {
    const counts: Record<string, number> = {};
    for (const l of e.lines) {
      const g = l.groupName ?? 'Unclassified';
      counts[g] = (counts[g] ?? 0) + 1;
    }
    console.log(`\n${e.project.name}:`);
    for (const [g, n] of Object.entries(counts).sort()) {
      console.log(`  ${n.toString().padStart(3)} · ${g}`);
    }
  }

  await prisma.$disconnect();
})();
