/**
 * Devops utility — run manually before Cowork estimate sessions.
 *
 * Export master books for a JMO/AWG tenant + region as a single JSON
 * file, ready to be consumed by Cowork (external AI estimator) at the
 * start of an estimate run.
 *
 * Schema version: 1.0.0 (see /docs/cowork-master-books-schema.md if
 * documentation is added).
 *
 * Usage:
 *   npx tsx scripts/export-master-books.ts \
 *     --tenant jmo \
 *     --region NH-Belmont \
 *     --output /path/to/output.json
 *
 * If --region is omitted, uses the tenant's default region (Region.isDefault=true).
 * If --output is omitted, writes to a default path under
 * C:\Users\awgco\Desktop\cowork-input\.
 *
 * The exported JSON contains:
 *   - divisions          (top-level trade groupings)
 *   - labor_trades       (skilled labor categories)
 *   - labor_rates        ($/hr per trade, filtered to chosen region)
 *   - productivity_entries (man-hours per unit with low/avg/high bands)
 *   - material_types     (hierarchical material categories)
 *   - materials          (catalog items with low/avg/high prices)
 *   - cost_factors_available (regional/situational multipliers)
 *   - default_markups    (system-level defaults for scenarios)
 *
 * Not exported (intentional):
 *   - Equipment book (not in scm-crm schema)
 *   - Assemblies (not used in initial Cowork integration)
 *   - service_code catalog (Cowork generates from context using
 *     productivity_entries.match_code as anchor)
 */

import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();

const SCHEMA_VERSION = '1.0.0';

type Args = {
  tenant: string;
  region?: string;
  output?: string;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const out: Partial<Args> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tenant') out.tenant = args[++i];
    else if (args[i] === '--region') out.region = args[++i];
    else if (args[i] === '--output') out.output = args[++i];
  }
  if (!out.tenant) {
    console.error(
      'Usage: npx tsx scripts/export-master-books.ts --tenant <slug> [--region <name>] [--output <path>]',
    );
    process.exit(1);
  }
  return out as Args;
}

function centsToDecimal(cents: number | null | undefined): number | null {
  if (cents === null || cents === undefined) return null;
  return Math.round(cents) / 100;
}

function decimalToNumber(d: unknown): number | null {
  if (d === null || d === undefined) return null;
  if (typeof d === 'number') return d;
  if (typeof d === 'string') return parseFloat(d);
  // Prisma Decimal has a toString() that returns the value
  if (d && typeof d === 'object' && 'toString' in d) {
    return parseFloat((d as { toString(): string }).toString());
  }
  return null;
}

async function main() {
  const { tenant, region: regionArg, output: outputArg } = parseArgs();

  console.log(
    `📚 Exporting master books for tenant='${tenant}'${regionArg ? `, region='${regionArg}'` : ' (default region)'}\n`,
  );

  // 1. Find tenant
  const company = await prisma.company.findUnique({
    where: { slug: tenant },
    select: { id: true, slug: true, name: true },
  });
  if (!company) {
    console.error(`❌ Tenant slug='${tenant}' not found.`);
    process.exit(1);
  }
  console.log(`✓ Company: ${company.name} (${company.id})`);

  // 2. Find region
  const region = regionArg
    ? await prisma.region.findFirst({
        where: { companyId: company.id, name: regionArg },
      })
    : await prisma.region.findFirst({
        where: { companyId: company.id, isDefault: true },
      });

  if (!region) {
    console.error(`❌ Region ${regionArg ? `'${regionArg}'` : '(default)'} not found for tenant.`);
    process.exit(1);
  }
  console.log(
    `✓ Region: ${region.name} (${region.stateCode})${region.isDefault ? ' [default]' : ''}\n`,
  );

  // 3. Fetch everything in parallel
  const [
    divisions,
    laborTrades,
    laborRates,
    productivityEntries,
    materialTypes,
    materials,
    costFactors,
    systemSettings,
  ] = await Promise.all([
    prisma.division.findMany({
      where: { companyId: company.id },
      orderBy: { displayOrder: 'asc' },
    }),
    prisma.laborTrade.findMany({
      where: { companyId: company.id },
      orderBy: { name: 'asc' },
    }),
    prisma.laborRate.findMany({
      where: { companyId: company.id, regionId: region.id },
      include: { trade: { select: { name: true } } },
    }),
    prisma.productivityEntry.findMany({
      where: { companyId: company.id },
      include: {
        assumedTrade: { select: { name: true } },
      },
    }),
    prisma.materialType.findMany({
      where: { companyId: company.id },
      orderBy: { name: 'asc' },
    }),
    prisma.material.findMany({
      where: { companyId: company.id },
      orderBy: { name: 'asc' },
    }),
    prisma.costFactor.findMany({
      where: {
        companyId: company.id,
        isActive: true,
        OR: [{ regionId: null }, { regionId: region.id }],
      },
      orderBy: { name: 'asc' },
    }),
    prisma.systemSetting.findMany({
      where: {
        companyId: company.id,
        key: {
          in: [
            'default_shop_type',
            'default_mh_range_mode',
            'default_markup_percent',
            'default_overhead_percent',
            'default_general_conditions_percent',
            'default_contingency_percent',
            'default_sales_tax_percent',
          ],
        },
      },
    }),
  ]);

  console.log(`✓ Fetched all master data:`);
  console.log(`    Divisions:           ${divisions.length}`);
  console.log(`    Labor trades:        ${laborTrades.length}`);
  console.log(`    Labor rates:         ${laborRates.length} (region=${region.name})`);
  console.log(`    Productivity:        ${productivityEntries.length}`);
  console.log(`    Material types:      ${materialTypes.length}`);
  console.log(`    Materials:           ${materials.length}`);
  console.log(`    Cost factors:        ${costFactors.length}`);

  // 4. Build division lookup map for productivity_entries enrichment
  const divisionById = new Map(divisions.map((d) => [d.id, d]));

  // 5. Build SystemSetting map with parsing
  const settings: Record<string, string> = {};
  for (const s of systemSettings) {
    settings[s.key] = s.value;
  }

  function settingPct(key: string): number | null {
    const v = settings[key];
    if (v === undefined) return null;
    const n = parseFloat(v);
    if (isNaN(n)) return null;
    return n / 100; // Convert "10" → 0.10 decimal
  }

  // 6. Build the export JSON
  const exportData = {
    schema_version: SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    company: {
      id: company.id,
      slug: company.slug,
      name: company.name,
    },
    region: {
      id: region.id,
      name: region.name,
      state_code: region.stateCode,
      is_default: region.isDefault,
    },

    divisions: divisions.map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      display_order: d.displayOrder,
    })),

    labor_trades: laborTrades.map((t) => ({
      id: t.id,
      name: t.name,
      division_id: t.divisionId,
      notes: t.notes,
    })),

    labor_rates: laborRates.map((r) => ({
      trade_id: r.tradeId,
      trade_name: r.trade.name,
      shop_type: r.shopType,
      low: centsToDecimal(r.lowCents),
      avg: centsToDecimal(r.avgCents)!,
      high: centsToDecimal(r.highCents),
      notes: r.notes,
    })),

    productivity_entries: productivityEntries.map((p) => {
      const division = divisionById.get(p.divisionId);
      return {
        id: p.id,
        match_code: p.matchCode,
        scope_name: p.scopeName,
        uom: p.uom,
        division_id: p.divisionId,
        division_name: division?.name ?? null,
        assumed_trade_id: p.assumedTradeId,
        assumed_trade_name: p.assumedTrade?.name ?? null,
        crew_description: p.crewDescription,
        mh_per_unit: {
          low: decimalToNumber(p.mhPerUnitLow),
          avg: decimalToNumber(p.mhPerUnitAvg)!,
          high: decimalToNumber(p.mhPerUnitHigh),
        },
        match_keywords: p.matchKeywords,
        notes: p.notes,
      };
    }),

    material_types: materialTypes.map((mt) => ({
      id: mt.id,
      slug: mt.slug,
      name: mt.name,
      parent_id: mt.parentId,
    })),

    materials: materials.map((m) => ({
      id: m.id,
      name: m.name,
      sku: m.sku,
      uom: m.uom,
      division_id: m.divisionId,
      division_name: m.divisionId ? (divisionById.get(m.divisionId)?.name ?? null) : null,
      material_type_id: m.materialTypeId,
      supplier: m.supplier,
      supplier_url: m.supplierUrl,
      price: {
        low: centsToDecimal(m.lowCents),
        avg: centsToDecimal(m.avgCents)!,
        high: centsToDecimal(m.highCents),
      },
      waste_pct: m.wastePercent / 100, // int → decimal
      last_priced_at: m.lastPricedAt?.toISOString() ?? null,
      notes: m.notes,
    })),

    cost_factors_available: costFactors.map((cf) => ({
      id: cf.id,
      name: cf.name,
      region_id: cf.regionId,
      region_name: cf.regionId === region.id ? region.name : null,
      impact_pct: decimalToNumber(cf.impactPercent),
      applies_to: cf.appliesTo,
      auto_apply: cf.autoApply,
      is_active: cf.isActive,
      description: cf.description,
    })),

    default_markups: {
      shop_type: settings.default_shop_type ?? 'open_shop',
      mh_range_mode: settings.default_mh_range_mode ?? 'avg',
      markup_pct: settingPct('default_markup_percent'),
      overhead_pct: settingPct('default_overhead_percent'),
      general_conditions_pct: settingPct('default_general_conditions_percent'),
      contingency_pct: settingPct('default_contingency_percent'),
      sales_tax_pct: settingPct('default_sales_tax_percent'),
    },

    stats: {
      divisions_count: divisions.length,
      labor_trades_count: laborTrades.length,
      labor_rates_count: laborRates.length,
      productivity_entries_count: productivityEntries.length,
      material_types_count: materialTypes.length,
      materials_count: materials.length,
      cost_factors_count: costFactors.length,
    },
  };

  // 7. Resolve output path
  const defaultDir = path.join(process.env.USERPROFILE ?? '', 'Desktop', 'cowork-input');
  const outputPath =
    outputArg ?? path.join(defaultDir, `${tenant}_master_books_${region.name}.json`);

  // Ensure parent directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');

  const fileSize = fs.statSync(outputPath).size;
  console.log(`\n✅ Exported to: ${outputPath}`);
  console.log(`   Size: ${(fileSize / 1024).toFixed(1)} KB`);
}

main()
  .catch((err) => {
    console.error('❌ Export failed:', err);
    console.error(err.stack);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
