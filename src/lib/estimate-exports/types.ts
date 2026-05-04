export type ExportLine = {
  externalId: string | null;
  name: string;
  groupName: string | null;
  scope: string;
  uom: string;
  quantity: number;
  laborTradeName: string | null;
  mhPerUnit: number | null;
  laborRateCents: number | null;
  laborHours: number | null;
  laborCostCents: number;
  matUnitCostCents: number | null;
  wastePercent: number | null;
  materialCostCents: number;
  subtotalCents: number;
  notes: string | null;
};

export type ExportData = {
  proposalNumber: string | null;
  projectName: string;
  projectAddress: string | null;
  totalEnvelopeSf: number | null;
  validForDays: number;
  acceptedAt: Date | null;
  assumptions: string | null;

  company: {
    name: string;
    contactName: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    logoUrl: string | null;
  };

  client: {
    name: string;
    contactName: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
  };

  // OH&P breakdown (raw percents from estimate)
  generalConditionsPercent: number;
  overheadPercent: number;
  profitPercent: number;
  /** Multiplicative markup factor: (1+GC) × (1+OH) × (1+Profit) */
  markupFactor: number;

  lines: ExportLine[];

  totals: {
    directLaborCents: number;
    directMaterialCents: number;
    directCents: number;
    ohpCents: number;
    grandTotalCents: number;
  };

  /** Lines grouped by section (groupName), in stable order. */
  sections: Array<{
    name: string;
    lines: ExportLine[];
    subtotalLaborCents: number;
    subtotalMaterialCents: number;
    subtotalCents: number;
  }>;
};
