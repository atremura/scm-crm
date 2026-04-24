/**
 * Seeds the per-tenant Estimate reference catalogs from Andre's
 * AWG_Construction_Productivity_Database_V2.xlsx.
 *
 * Idempotent:
 *   - Divisions / Regions / LaborTrades / LaborRates are upserted
 *     against their natural unique keys.
 *   - ProductivityEntry / Material / CostFactor are wiped for the
 *     target tenant and re-inserted — re-running after editing the
 *     spreadsheet overwrites with the new values.
 *
 * Usage:
 *   npx tsx scripts/seed-productivity-db.ts
 *   npx tsx scripts/seed-productivity-db.ts --company-slug=jmo --file=./path.xlsx
 *
 * Env overrides:
 *   SEED_PRODUCTIVITY_XLSX   — default path to the workbook
 *   SEED_COMPANY_SLUG        — default 'jmo'
 */
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'node:path';

const DEFAULT_XLSX =
  'C:/Users/awgco/OneDrive/AWG/7-APP AWG/AWG MIND/AWG MIND/cerebro claude/07_Recursos/planilhas/AWG_Construction_Productivity_Database_V2.xlsx';

type Args = { companySlug: string; file: string };

function parseArgs(): Args {
  const out: Args = {
    companySlug: process.env.SEED_COMPANY_SLUG ?? 'jmo',
    file: process.env.SEED_PRODUCTIVITY_XLSX ?? DEFAULT_XLSX,
  };
  for (const raw of process.argv.slice(2)) {
    const [k, v] = raw.replace(/^-+/, '').split('=');
    if (k === 'company-slug' && v) out.companySlug = v;
    if (k === 'file' && v) out.file = v;
  }
  return out;
}

/** Cash → cents, null-safe. */
function $cents(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function pct(v: unknown): number {
  // Waste in the sheet is stored as 0.08 (→ 8%). We persist as integer 8.
  if (v === '' || v === null || v === undefined) return 5;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return 5;
  return Math.round(n * 100);
}

function num(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function findHeaderRow(aoa: unknown[][], firstHeaderCell: string): number {
  const needle = firstHeaderCell.toLowerCase().trim();
  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const cell = String(aoa[i]?.[0] ?? '').toLowerCase().trim();
    if (cell === needle) return i;
  }
  throw new Error(`Could not find "${firstHeaderCell}" header in sheet`);
}

async function main() {
  const args = parseArgs();
  console.log(`📊 Seeding productivity DB`);
  console.log(`   File:    ${args.file}`);
  console.log(`   Tenant:  ${args.companySlug}`);
  console.log();

  const prisma = new PrismaClient();

  const found = await prisma.company.findUnique({
    where: { slug: args.companySlug },
    select: { id: true, name: true },
  });
  if (!found) {
    throw new Error(`Company with slug "${args.companySlug}" not found`);
  }
  const company: { id: string; name: string } = found;
  console.log(`🏢 Target: ${company.name} (${company.id})`);

  const wb = XLSX.readFile(args.file);
  const sheetOf = (name: string) => {
    const ws = wb.Sheets[name];
    if (!ws) throw new Error(`Sheet "${name}" not found in workbook`);
    return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  };

  // ============================================================
  // 1. Regions — hardcoded (only two in the workbook today)
  // ============================================================
  console.log('\n📍 Regions...');
  const regions = [
    { stateCode: 'MA', name: 'Massachusetts', isDefault: true },
    { stateCode: 'FL', name: 'Florida', isDefault: false },
  ];
  const regionByCode = new Map<string, string>();
  for (const r of regions) {
    const saved = await prisma.region.upsert({
      where: { companyId_stateCode: { companyId: company.id, stateCode: r.stateCode } },
      update: { name: r.name, isDefault: r.isDefault },
      create: { companyId: company.id, ...r },
    });
    regionByCode.set(r.stateCode, saved.id);
    console.log(`   ✓ ${r.stateCode} — ${r.name}`);
  }

  // ============================================================
  // 2. Divisions — extracted from Productivity + Materials sheets
  // ============================================================
  console.log('\n🗂  Divisions...');
  const prodAoa = sheetOf('1. Productivity');
  const prodHeader = findHeaderRow(prodAoa, 'Division');
  const matAoa = sheetOf('4. Materials');
  const matHeader = findHeaderRow(matAoa, 'Division');

  const divisionNames = new Set<string>();
  for (let i = prodHeader + 1; i < prodAoa.length; i++) {
    const d = str(prodAoa[i]?.[0]);
    if (d) divisionNames.add(d);
  }
  for (let i = matHeader + 1; i < matAoa.length; i++) {
    const d = str(matAoa[i]?.[0]);
    if (d) divisionNames.add(d);
  }

  const divisionByName = new Map<string, string>();
  let order = 0;
  for (const name of Array.from(divisionNames).sort()) {
    const saved = await prisma.division.upsert({
      where: { companyId_name: { companyId: company.id, name } },
      update: { displayOrder: order },
      create: { companyId: company.id, name, displayOrder: order },
    });
    divisionByName.set(name, saved.id);
    order++;
    console.log(`   ✓ ${name}`);
  }

  // ============================================================
  // 3. Labor Trades — from the MA rates sheet (FL has the same set)
  // ============================================================
  console.log('\n👷 Labor trades...');
  const maAoa = sheetOf('2. Labor Rates MA');
  const maHeader = findHeaderRow(maAoa, 'Trade');
  const tradeByName = new Map<string, string>();
  for (let i = maHeader + 1; i < maAoa.length; i++) {
    const name = str(maAoa[i]?.[0]);
    if (!name) continue;
    const notes = str(maAoa[i]?.[5]);
    const saved = await prisma.laborTrade.upsert({
      where: { companyId_name: { companyId: company.id, name } },
      update: { notes: notes ?? undefined },
      create: { companyId: company.id, name, notes: notes ?? null },
    });
    tradeByName.set(name, saved.id);
  }
  console.log(`   ✓ ${tradeByName.size} trades`);

  // ============================================================
  // 4. Labor Rates — MA + FL, both shop types (open_shop: L/A/H;
  //    union: only Avg column per sheet)
  // ============================================================
  async function seedRatesFor(
    regionCode: 'MA' | 'FL',
    sheetName: string
  ): Promise<{ openShop: number; union: number }> {
    const aoa = sheetOf(sheetName);
    const hdr = findHeaderRow(aoa, 'Trade');
    const regionId = regionByCode.get(regionCode);
    if (!regionId) throw new Error(`Region ${regionCode} missing`);
    let openShop = 0;
    let union = 0;
    for (let i = hdr + 1; i < aoa.length; i++) {
      const tradeName = str(aoa[i]?.[0]);
      if (!tradeName) continue;
      const tradeId = tradeByName.get(tradeName);
      if (!tradeId) {
        console.warn(`   ⚠ trade "${tradeName}" not in master list — skipping`);
        continue;
      }
      const osLow = $cents(aoa[i]?.[1]);
      const osAvg = $cents(aoa[i]?.[2]);
      const osHigh = $cents(aoa[i]?.[3]);
      const unionAvg = $cents(aoa[i]?.[4]);
      const notes = str(aoa[i]?.[5]);

      if (osAvg !== null) {
        await prisma.laborRate.upsert({
          where: {
            companyId_tradeId_regionId_shopType: {
              companyId: company.id,
              tradeId,
              regionId,
              shopType: 'open_shop',
            },
          },
          update: { lowCents: osLow, avgCents: osAvg, highCents: osHigh, notes },
          create: {
            companyId: company.id,
            tradeId,
            regionId,
            shopType: 'open_shop',
            lowCents: osLow,
            avgCents: osAvg,
            highCents: osHigh,
            notes,
          },
        });
        openShop++;
      }
      if (unionAvg !== null) {
        await prisma.laborRate.upsert({
          where: {
            companyId_tradeId_regionId_shopType: {
              companyId: company.id,
              tradeId,
              regionId,
              shopType: 'union',
            },
          },
          update: { avgCents: unionAvg, lowCents: null, highCents: null },
          create: {
            companyId: company.id,
            tradeId,
            regionId,
            shopType: 'union',
            avgCents: unionAvg,
            lowCents: null,
            highCents: null,
          },
        });
        union++;
      }
    }
    return { openShop, union };
  }

  console.log('\n💵 Labor rates...');
  const maRates = await seedRatesFor('MA', '2. Labor Rates MA');
  console.log(`   ✓ MA: ${maRates.openShop} open-shop, ${maRates.union} union`);
  const flRates = await seedRatesFor('FL', '3. Labor Rates FL');
  console.log(`   ✓ FL: ${flRates.openShop} open-shop, ${flRates.union} union`);

  // ============================================================
  // 5. Productivity — wipe + insertMany for idempotent edits
  // ============================================================
  console.log('\n⏱  Productivity entries...');
  await prisma.productivityEntry.deleteMany({ where: { companyId: company.id } });
  const prodRows: any[] = [];
  for (let i = prodHeader + 1; i < prodAoa.length; i++) {
    const r = prodAoa[i];
    const divName = str(r?.[0]);
    const scopeName = str(r?.[1]);
    if (!divName || !scopeName) continue;
    const divisionId = divisionByName.get(divName);
    if (!divisionId) {
      console.warn(`   ⚠ division "${divName}" not found for "${scopeName}"`);
      continue;
    }
    prodRows.push({
      companyId: company.id,
      divisionId,
      scopeName,
      uom: str(r?.[2]) ?? 'EA',
      crewDescription: str(r?.[3]),
      assumedTradeId: null, // not mapped in the sheet; user can enrich later
      mhPerUnitLow: num(r?.[4]),
      mhPerUnitAvg: num(r?.[5]) ?? 0,
      mhPerUnitHigh: num(r?.[6]),
      // For fuzzy matching later — full scope name lower-cased lets the
      // pricing engine tokenize however it wants.
      matchKeywords: scopeName.toLowerCase(),
      notes: str(r?.[7]),
    });
  }
  await prisma.productivityEntry.createMany({ data: prodRows });
  console.log(`   ✓ ${prodRows.length} productivity entries`);

  // ============================================================
  // 6. Materials — wipe + insertMany
  // ============================================================
  console.log('\n📦 Materials...');
  await prisma.material.deleteMany({ where: { companyId: company.id } });
  const matRows: any[] = [];
  for (let i = matHeader + 1; i < matAoa.length; i++) {
    const r = matAoa[i];
    const divName = str(r?.[0]);
    const name = str(r?.[1]);
    if (!divName || !name) continue;
    const divisionId = divisionByName.get(divName);
    matRows.push({
      companyId: company.id,
      divisionId: divisionId ?? null,
      name,
      uom: str(r?.[2]) ?? 'EA',
      lowCents: $cents(r?.[3]),
      avgCents: $cents(r?.[4]) ?? 0,
      highCents: $cents(r?.[5]),
      wastePercent: pct(r?.[6]),
      notes: str(r?.[7]),
    });
  }
  await prisma.material.createMany({ data: matRows });
  console.log(`   ✓ ${matRows.length} materials`);

  // ============================================================
  // 7. Cost Factors — wipe + insertMany
  // ============================================================
  console.log('\n🎯 Cost factors...');
  await prisma.costFactor.deleteMany({ where: { companyId: company.id } });
  const cfAoa = sheetOf('7. Cost Factors');
  const cfHeader = findHeaderRow(cfAoa, 'Factor');
  const cfRows: any[] = [];
  for (let i = cfHeader + 1; i < cfAoa.length; i++) {
    const r = cfAoa[i];
    const name = str(r?.[0]);
    if (!name) continue;
    const stateCode = str(r?.[1]);
    const impact = num(r?.[2]);
    const appliesRaw = str(r?.[3])?.toLowerCase();
    const desc = str(r?.[4]);
    if (impact === null) continue;
    const regionId = stateCode ? regionByCode.get(stateCode) ?? null : null;
    // Normalize "Applies To"
    let appliesTo: 'labor' | 'material' | 'overhead';
    if (appliesRaw === 'labor') appliesTo = 'labor';
    else if (appliesRaw === 'material') appliesTo = 'material';
    else if (appliesRaw === 'oh' || appliesRaw === 'overhead') appliesTo = 'overhead';
    else {
      console.warn(`   ⚠ unknown appliesTo "${appliesRaw}" for "${name}" — skipping`);
      continue;
    }
    cfRows.push({
      companyId: company.id,
      regionId,
      name,
      impactPercent: impact,
      appliesTo,
      description: desc,
      isActive: true,
      // Keep conservative — user opts factors in per-estimate for now.
      // They can flip autoApply on in the admin UI once settled.
      autoApply: false,
    });
  }
  await prisma.costFactor.createMany({ data: cfRows });
  console.log(`   ✓ ${cfRows.length} cost factors`);

  // ============================================================
  // Summary
  // ============================================================
  console.log('\n✅ Seed complete.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const counts = await prisma.$transaction([
    prisma.division.count({ where: { companyId: company.id } }),
    prisma.region.count({ where: { companyId: company.id } }),
    prisma.laborTrade.count({ where: { companyId: company.id } }),
    prisma.laborRate.count({ where: { companyId: company.id } }),
    prisma.productivityEntry.count({ where: { companyId: company.id } }),
    prisma.material.count({ where: { companyId: company.id } }),
    prisma.costFactor.count({ where: { companyId: company.id } }),
  ]);
  console.log(`   Divisions:       ${counts[0]}`);
  console.log(`   Regions:         ${counts[1]}`);
  console.log(`   Labor trades:    ${counts[2]}`);
  console.log(`   Labor rates:     ${counts[3]}`);
  console.log(`   Productivity:    ${counts[4]}`);
  console.log(`   Materials:       ${counts[5]}`);
  console.log(`   Cost factors:    ${counts[6]}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
