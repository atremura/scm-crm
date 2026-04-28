/**
 * Seeds a starter set of DerivativeCostRule rows so IA-2 has something
 * to lean on day 1 instead of having to AI-propose every common rule
 * from scratch. Idempotent — looks up existing rules by name+companyId
 * and updates instead of duplicating.
 *
 * Coverage:
 *   - Hardie fasteners (smooth / shake / panel)
 *   - Drywall screws
 *   - Framing nails
 *   - Tyvek tape
 *   - EPDM tape (rainscreen)
 *   - Window/door perimeter sealant
 *   - Final clean (% of total floor SF — but as % of subtotal here)
 *   - Dumpster (per week)
 *   - Port-a-john (per week)
 *   - Consumables allowance (% of material)
 *
 * Materials are looked up by case-insensitive substring of name. If a
 * material isn't in the catalog, the rule still gets created with
 * materialIdRef=null — IA-2 / Andre fixes later.
 *
 * Usage:
 *   npx tsx scripts/seed-derivative-rules.ts                    # default jmo
 *   npx tsx scripts/seed-derivative-rules.ts --company-slug=xxx
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Rule = {
  name: string;
  triggerProductivityMatchCode: string | null;
  triggerDivisionName: string | null;
  costType: 'material' | 'labor' | 'site' | 'cleanup';
  formula: any; // discriminated by .kind, see derivative-rules-engine.ts
  materialMatch: string | null; // case-insensitive substring against Material.name
  uomIn: string | null;
  uomOut: string | null;
  notes: string;
};

const RULES: Rule[] = [
  // --- Hardie fasteners ---
  {
    name: 'Hardie smooth siding fasteners (ring-shank)',
    triggerProductivityMatchCode: 'ELFCS',
    triggerDivisionName: null,
    costType: 'material',
    formula: { kind: 'qty_per_unit', factor: 0.025, uomIn: 'SF', uomOut: 'BX' },
    materialMatch: 'ring-shank',
    uomIn: 'SF',
    uomOut: 'BX',
    notes: '0.025 boxes (1000-ct) per SF — 1 box covers ~40 SF of lap @ 16" OC.',
  },
  {
    name: 'Hardie shake fasteners',
    triggerProductivityMatchCode: 'ELFCSS',
    triggerDivisionName: null,
    costType: 'material',
    formula: { kind: 'qty_per_unit', factor: 0.028, uomIn: 'SF', uomOut: 'BX' },
    materialMatch: 'ring-shank',
    uomIn: 'SF',
    uomOut: 'BX',
    notes: 'Shakes have smaller exposure → ~0.028 boxes per SF.',
  },
  {
    name: 'Hardie panel fasteners',
    triggerProductivityMatchCode: 'ELFCP',
    triggerDivisionName: null,
    costType: 'material',
    formula: { kind: 'qty_per_unit', factor: 0.020, uomIn: 'SF', uomOut: 'BX' },
    materialMatch: 'ring-shank',
    uomIn: 'SF',
    uomOut: 'BX',
    notes: '4x8 panels = fewer fasteners per SF than lap.',
  },

  // --- Tape / sealant ---
  {
    name: 'Tyvek seam tape',
    triggerProductivityMatchCode: 'WRB',
    triggerDivisionName: null,
    costType: 'material',
    formula: { kind: 'qty_per_unit', factor: 0.17, uomIn: 'SF', uomOut: 'EA' },
    materialMatch: 'tyvek tape',
    uomIn: 'SF',
    uomOut: 'EA',
    notes: '~1 LF tape per 6 SF house wrap (seam coverage). Adjust per project.',
  },
  {
    name: 'EPDM tape (rainscreen)',
    triggerProductivityMatchCode: 'FURR',
    triggerDivisionName: null,
    costType: 'material',
    formula: { kind: 'qty_per_unit', factor: 1.0, uomIn: 'LF', uomOut: 'LF' },
    materialMatch: 'epdm tape',
    uomIn: 'LF',
    uomOut: 'LF',
    notes: '1 LF tape per LF furring strip — seal to substrate before fastening.',
  },

  // --- Drywall screws ---
  {
    name: 'Drywall screws (1-5/8")',
    triggerProductivityMatchCode: null,
    triggerDivisionName: 'Drywall',
    costType: 'material',
    formula: { kind: 'qty_per_unit', factor: 0.01, uomIn: 'SF', uomOut: 'LB' },
    materialMatch: 'drywall screw',
    uomIn: 'SF',
    uomOut: 'LB',
    notes: '~1 lb of screws per 100 SF drywall (fine-thread for metal studs).',
  },

  // --- Site costs (project-level — no trigger, runs once per estimate) ---
  {
    name: 'Dumpster rental (15-yard)',
    triggerProductivityMatchCode: null,
    triggerDivisionName: null,
    costType: 'site',
    formula: { kind: 'fixed_per_week', cents: 65000 }, // $650/week
    materialMatch: null,
    uomIn: null,
    uomOut: 'WK',
    notes: '$650/week, 1 swap/week typical for renovation.',
  },
  {
    name: 'Port-a-john',
    triggerProductivityMatchCode: null,
    triggerDivisionName: null,
    costType: 'site',
    formula: { kind: 'fixed_per_week', cents: 4500 }, // $45/week
    materialMatch: null,
    uomIn: null,
    uomOut: 'WK',
    notes: '$45/week pro-rated from $180-200/month service.',
  },

  // --- Cleanup / consumables ---
  {
    name: 'Consumables allowance (blades / sandpaper / drill bits)',
    triggerProductivityMatchCode: null,
    triggerDivisionName: null,
    costType: 'material',
    formula: { kind: 'percent_of_direct', percent: 2.0, basis: 'material' },
    materialMatch: null,
    uomIn: null,
    uomOut: 'EA',
    notes: '2% of total material direct cost. Bumps to 3% on heavy-cut work (tile, hardwood).',
  },
];

const COMPANY_SLUG = process.argv
  .find((a) => a.startsWith('--company-slug='))
  ?.split('=')[1] ?? 'jmo';

(async () => {
  const company = await prisma.company.findUnique({
    where: { slug: COMPANY_SLUG },
    select: { id: true, name: true },
  });
  if (!company) throw new Error(`Company ${COMPANY_SLUG} not found`);
  console.log(`Target: ${company.name}`);

  const divisions = await prisma.division.findMany({ where: { companyId: company.id } });
  const divByName = new Map(divisions.map((d) => [d.name.toLowerCase(), d]));

  const materials = await prisma.material.findMany({ where: { companyId: company.id } });

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const r of RULES) {
    let triggerDivisionId: string | null = null;
    if (r.triggerDivisionName) {
      const d = divByName.get(r.triggerDivisionName.toLowerCase());
      if (!d) {
        console.warn(`  ⚠ Division "${r.triggerDivisionName}" not found — skipping ${r.name}`);
        skipped++;
        continue;
      }
      triggerDivisionId = d.id;
    }

    let materialIdRef: string | null = null;
    if (r.materialMatch) {
      const needle = r.materialMatch.toLowerCase();
      const mat = materials.find((m) => m.name.toLowerCase().includes(needle));
      if (!mat) {
        console.warn(
          `  ⚠ Material "${r.materialMatch}" not in catalog — creating rule with materialIdRef=null (IA-2/Andre fixes later)`
        );
      } else {
        materialIdRef = mat.id;
      }
    }

    const existing = await prisma.derivativeCostRule.findFirst({
      where: { companyId: company.id, name: r.name },
    });

    const data = {
      companyId: company.id,
      name: r.name,
      triggerProductivityMatchCode: r.triggerProductivityMatchCode,
      triggerDivisionId,
      costType: r.costType,
      formula: r.formula,
      materialIdRef,
      uomIn: r.uomIn,
      uomOut: r.uomOut,
      isActive: true,
      createdBy: 'manual',
      notes: r.notes,
    };

    if (existing) {
      await prisma.derivativeCostRule.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.derivativeCostRule.create({ data });
      added++;
    }
  }

  console.log(`\nDone. Added ${added} · Updated ${updated} · Skipped ${skipped}`);
  const total = await prisma.derivativeCostRule.count({ where: { companyId: company.id } });
  console.log(`Total rules for ${company.name}: ${total}`);
  await prisma.$disconnect();
})();
