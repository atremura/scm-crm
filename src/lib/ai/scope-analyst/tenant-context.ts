import { prisma } from '@/lib/prisma';

/**
 * Builds the tenant-specific context block that's prepended to the
 * user message. Sits at its own cache breakpoint so changes here
 * don't invalidate the BASE_SYSTEM_PROMPT cache.
 *
 * Goals:
 *   - Compact: every token costs money. No filler text.
 *   - Stable: order entries deterministically (matchCode asc) so the
 *     same tenant generates the same string each call → cache hits.
 *   - Honest: only list what exists. If the tenant has no materials,
 *     omit the section rather than say "no materials".
 *
 * Output shape (illustrative):
 *
 *   === TENANT CATALOG ===
 *   Divisions:
 *     Siding · Trim & Finish Carpentry · Rough Carpentry · Roofing · Insulation
 *
 *   Productivity matchCodes (use as productivity_hint):
 *     ELFCS  | Siding             | SF | 0.060 MH/SF | Hardie smooth lap
 *     EL02   | Trim & Finish      | LF | 0.055 MH/LF | Fiber cement corner trim
 *     ZGIRT  | Insulation         | SF | 0.018 MH/SF | Z-girt hat channel
 *     ...
 *
 *   Common materials (use as material_hint):
 *     Siding:      Hardie HZ10 Smooth Lap 8.25" | Hardie Panel 4×8 | ...
 *     Insulation:  Polyiso 2" R-13 | Tyvek HomeWrap | ...
 *     ...
 *   === END CATALOG ===
 */
export async function buildTenantContext(companyId: string): Promise<string> {
  const [divisions, productivity, materials] = await Promise.all([
    prisma.division.findMany({
      where: { companyId },
      select: { id: true, name: true, displayOrder: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.productivityEntry.findMany({
      where: { companyId, matchCode: { not: null } },
      select: {
        matchCode: true,
        scopeName: true,
        uom: true,
        mhPerUnitAvg: true,
        division: { select: { name: true } },
      },
      orderBy: [{ matchCode: 'asc' }],
    }),
    prisma.material.findMany({
      where: { companyId },
      select: {
        name: true,
        uom: true,
        division: { select: { name: true } },
      },
      orderBy: [{ name: 'asc' }],
      // Cap to keep the context block under control. If a tenant has
      // 500+ materials, we truncate here and the model uses null hints
      // for unmatched items — fine, the resolver picks them up later.
      take: 250,
    }),
  ]);

  const lines: string[] = ['=== TENANT CATALOG ==='];

  // Divisions — compact, separated by " · "
  if (divisions.length > 0) {
    lines.push('Divisions:');
    lines.push('  ' + divisions.map((d) => d.name).join(' · '));
    lines.push('');
  }

  // Productivity — fixed-width-ish for legibility
  if (productivity.length > 0) {
    lines.push('Productivity matchCodes (use as productivity_hint):');
    for (const p of productivity) {
      const mh = Number(p.mhPerUnitAvg).toFixed(3);
      lines.push(
        `  ${p.matchCode!.padEnd(8)} | ${(p.division?.name ?? '—').padEnd(22)} | ${p.uom.padEnd(3)} | ${mh} MH/${p.uom} | ${p.scopeName}`,
      );
    }
    lines.push('');
  }

  // Materials grouped by division
  if (materials.length > 0) {
    lines.push('Common materials (use as material_hint, exact name):');
    const byDivision = new Map<string, string[]>();
    for (const m of materials) {
      const key = m.division?.name ?? 'Other';
      if (!byDivision.has(key)) byDivision.set(key, []);
      byDivision.get(key)!.push(`${m.name} (${m.uom})`);
    }
    for (const [div, items] of byDivision) {
      lines.push(`  ${div}:`);
      // Wrap into chunks of ~6 items per visual line for readability
      for (let i = 0; i < items.length; i += 6) {
        lines.push('    ' + items.slice(i, i + 6).join(' · '));
      }
    }
    lines.push('');
  }

  lines.push('=== END CATALOG ===');
  return lines.join('\n');
}
