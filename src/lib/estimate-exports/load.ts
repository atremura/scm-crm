import { prisma } from '@/lib/prisma';
import type { ExportData, ExportLine } from './types';

/**
 * Loads everything an export template needs and shapes it into the
 * ExportData contract. Returns null if the estimate doesn't exist
 * for the given company.
 */
export async function loadExportData(
  estimateId: string,
  companyId: string,
): Promise<ExportData | null> {
  const estimate = await prisma.estimate.findFirst({
    where: { id: estimateId, companyId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          address: true,
          client: {
            select: {
              companyName: true,
              address: true,
              city: true,
              state: true,
              zipCode: true,
              contacts: {
                where: { isPrimary: true },
                select: { name: true, email: true, phone: true },
                take: 1,
              },
            },
          },
        },
      },
      lines: {
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          laborTrade: { select: { name: true } },
        },
      },
    },
  });
  if (!estimate) return null;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      baseAddress: true,
      phone: true,
      email: true,
      contactName: true,
      logoUrl: true,
    },
  });
  if (!company) return null;

  const gc = Number(estimate.generalConditionsPercent ?? 0);
  const oh = Number(estimate.overheadPercent ?? 0);
  const profit = Number(estimate.markupPercent ?? 0);
  const markupFactor = (1 + gc / 100) * (1 + oh / 100) * (1 + profit / 100);

  const primaryContact = estimate.project.client?.contacts[0] ?? null;
  const clientAddress =
    [
      estimate.project.client?.address,
      [
        estimate.project.client?.city,
        estimate.project.client?.state,
        estimate.project.client?.zipCode,
      ]
        .filter(Boolean)
        .join(', '),
    ]
      .filter(Boolean)
      .join(' — ') || null;

  // Map raw EstimateLine → ExportLine (Prisma Decimals → numbers, $/u
  // derived from totals so we don't need a separate column on the table)
  const lines: ExportLine[] = estimate.lines.map((l) => {
    const qty = Number(l.quantity);
    const matBreakdown = (l.materialBreakdown as any[] | null) ?? null;
    const matUnitCostCents =
      matBreakdown && matBreakdown.length > 0 && matBreakdown[0].unitCostCents
        ? Number(matBreakdown[0].unitCostCents)
        : null;
    const wastePercent =
      matBreakdown && matBreakdown.length > 0 && matBreakdown[0].wastePercent !== undefined
        ? Number(matBreakdown[0].wastePercent)
        : null;
    return {
      externalId: l.externalId,
      name: l.name,
      groupName: l.groupName,
      scope: l.scope,
      uom: l.uom,
      quantity: qty,
      laborTradeName: l.laborTrade?.name ?? null,
      mhPerUnit: l.mhPerUnit !== null ? Number(l.mhPerUnit) : null,
      laborRateCents: l.laborRateCents,
      laborHours: l.laborHours !== null ? Number(l.laborHours) : null,
      laborCostCents: l.laborCostCents ?? 0,
      matUnitCostCents,
      wastePercent,
      materialCostCents: l.materialCostCents ?? 0,
      subtotalCents: l.subtotalCents ?? (l.laborCostCents ?? 0) + (l.materialCostCents ?? 0),
      notes: l.notes,
    };
  });

  // Group by groupName, preserving first-seen order so the sections
  // appear in the same sequence as on screen.
  const sectionMap = new Map<string, { name: string; lines: ExportLine[] }>();
  for (const line of lines) {
    const key = line.groupName ?? 'Unclassified';
    let bucket = sectionMap.get(key);
    if (!bucket) {
      bucket = { name: key, lines: [] };
      sectionMap.set(key, bucket);
    }
    bucket.lines.push(line);
  }
  const sections = Array.from(sectionMap.values()).map((s) => {
    const subtotalLaborCents = s.lines.reduce((a, l) => a + l.laborCostCents, 0);
    const subtotalMaterialCents = s.lines.reduce((a, l) => a + l.materialCostCents, 0);
    return {
      name: s.name,
      lines: s.lines,
      subtotalLaborCents,
      subtotalMaterialCents,
      subtotalCents: subtotalLaborCents + subtotalMaterialCents,
    };
  });

  const directLaborCents = lines.reduce((a, l) => a + l.laborCostCents, 0);
  const directMaterialCents = lines.reduce((a, l) => a + l.materialCostCents, 0);
  const directCents = directLaborCents + directMaterialCents;
  const grandTotalCents = Math.round(directCents * markupFactor);
  const ohpCents = grandTotalCents - directCents;

  return {
    proposalNumber: estimate.proposalNumber,
    projectName: estimate.project.name,
    projectAddress: estimate.project.address,
    totalEnvelopeSf: estimate.totalEnvelopeSf !== null ? Number(estimate.totalEnvelopeSf) : null,
    validForDays: estimate.validForDays,
    acceptedAt: estimate.acceptedAt,
    assumptions: estimate.assumptions,

    company: {
      name: company.name,
      contactName: company.contactName,
      phone: company.phone,
      email: company.email,
      address: company.baseAddress,
      logoUrl: company.logoUrl,
    },

    client: {
      name: estimate.project.client?.companyName ?? '—',
      contactName: primaryContact?.name ?? null,
      phone: primaryContact?.phone ?? null,
      email: primaryContact?.email ?? null,
      address: clientAddress,
    },

    generalConditionsPercent: gc,
    overheadPercent: oh,
    profitPercent: profit,
    markupFactor,

    lines,
    totals: {
      directLaborCents,
      directMaterialCents,
      directCents,
      ohpCents,
      grandTotalCents,
    },
    sections,
  };
}
