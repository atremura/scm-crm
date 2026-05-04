import ExcelJS from 'exceljs';
import type { ExportData } from './types';
import { loadLogoBuffer } from './logo';

const BRAND_BLUE = 'FF0E1E46'; // Navy — matches the app's sidebar
const BRAND_BLUE_SOFT = 'FFE0E7FF'; // indigo-100
const BORDER_GRAY = 'FFD1D5DB';
const TEXT_MUTED = 'FF6B7280';
const WARN_BG = 'FFFEF3C7'; // amber-100 (needsReview hint)

export async function buildInternalExcel(data: ExportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = data.company.name;
  wb.created = new Date();

  const ws = wb.addWorksheet('Estimate (Internal)', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
    views: [{ showGridLines: false }],
  });

  // 14 columns matching the on-screen Lines table
  // # | Code | Description | Trade | Unit | Qty | MH/u | $/hr | Mat $/u | Waste% | Total MH | Labor $ | Material $ | Subtotal
  ws.columns = [
    { width: 5 }, // A — #
    { width: 12 }, // B — Code
    { width: 38 }, // C — Description
    { width: 18 }, // D — Trade
    { width: 7 }, // E — Unit
    { width: 11 }, // F — Qty
    { width: 8 }, // G — MH/u
    { width: 9 }, // H — $/hr
    { width: 10 }, // I — Mat $/u
    { width: 8 }, // J — Waste %
    { width: 10 }, // K — Total MH
    { width: 13 }, // L — Labor $
    { width: 13 }, // M — Material $
    { width: 14 }, // N — Subtotal
  ];

  let row = 1;

  // ---- Logo strip ----
  const logo = await loadLogoBuffer(data.company.logoUrl);
  if (logo) {
    ws.getRow(row).height = 56;
    const imageId = wb.addImage({
      buffer: logo.buffer,
      extension: logo.extension,
    });
    ws.addImage(imageId, {
      tl: { col: 0, row: row - 1 },
      ext: { width: 160, height: 64 },
      editAs: 'oneCell',
    });
    ws.getCell(`H${row}`).value = data.company.name;
    ws.getCell(`H${row}`).font = {
      name: 'Arial',
      size: 14,
      bold: true,
      color: { argb: BRAND_BLUE },
    };
    ws.getCell(`H${row}`).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.mergeCells(`H${row}:N${row}`);
    row++;
  }

  // ---- Title ----
  const title = ws.getCell(`A${row}`);
  title.value = data.proposalNumber
    ? `INTERNAL ESTIMATE — ${data.proposalNumber}`
    : 'INTERNAL ESTIMATE';
  title.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  title.alignment = { vertical: 'middle', indent: 1 };
  ws.mergeCells(`A${row}:N${row}`);
  ws.getRow(row).height = 28;
  ws.getCell(`A${row}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: BRAND_BLUE },
  };
  row += 2;

  // Project info
  ws.getCell(`A${row}`).value = 'Project:';
  ws.getCell(`A${row}`).font = { bold: true };
  ws.getCell(`B${row}`).value = data.projectName;
  ws.mergeCells(`B${row}:G${row}`);
  ws.getCell(`H${row}`).value = 'Client:';
  ws.getCell(`H${row}`).font = { bold: true };
  ws.getCell(`I${row}`).value = data.client.name;
  ws.mergeCells(`I${row}:N${row}`);
  row++;
  ws.getCell(`A${row}`).value = 'Address:';
  ws.getCell(`A${row}`).font = { bold: true };
  ws.getCell(`B${row}`).value = data.projectAddress ?? '—';
  ws.mergeCells(`B${row}:G${row}`);
  if (data.totalEnvelopeSf) {
    ws.getCell(`H${row}`).value = 'Envelope:';
    ws.getCell(`H${row}`).font = { bold: true };
    ws.getCell(`I${row}`).value = `${data.totalEnvelopeSf.toLocaleString()} SF`;
    ws.mergeCells(`I${row}:N${row}`);
  }
  row += 2;

  // ---- Items table header ----
  const tableHeaders = [
    '#',
    'Code',
    'Description',
    'Trade',
    'Unit',
    'Qty',
    'MH/u',
    '$/hr',
    'Mat $/u',
    'Waste %',
    'Total MH',
    'Labor $',
    'Material $',
    'Subtotal',
  ];
  tableHeaders.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: BRAND_BLUE },
    };
    cell.alignment = {
      horizontal: i === 0 || i === 1 ? 'center' : i === 2 || i === 3 ? 'left' : 'right',
      vertical: 'middle',
      wrapText: true,
    };
  });
  ws.getRow(row).height = 28;
  row++;

  // ---- Sections + lines ----
  let itemNumber = 0;
  for (const section of data.sections) {
    if (section.lines.length === 0) continue;

    // Section bar
    ws.getCell(`A${row}`).value = section.name.toUpperCase();
    ws.getCell(`A${row}`).font = { bold: true, color: { argb: BRAND_BLUE }, size: 11 };
    ws.getCell(`A${row}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: BRAND_BLUE_SOFT },
    };
    ws.mergeCells(`A${row}:N${row}`);
    ws.getRow(row).height = 22;
    row++;

    let sectionMh = 0;

    for (const line of section.lines) {
      itemNumber++;
      const labCost = line.laborCostCents / 100;
      const matCost = line.materialCostCents / 100;
      const sub = line.subtotalCents / 100;
      sectionMh += line.laborHours ?? 0;

      ws.getCell(`A${row}`).value = itemNumber;
      ws.getCell(`A${row}`).alignment = { horizontal: 'center' };
      ws.getCell(`B${row}`).value = line.externalId ?? '—';
      ws.getCell(`B${row}`).font = { name: 'Consolas', size: 10 };
      ws.getCell(`B${row}`).alignment = { horizontal: 'center' };
      ws.getCell(`C${row}`).value = line.name;
      ws.getCell(`D${row}`).value = line.laborTradeName ?? '—';
      ws.getCell(`E${row}`).value = line.uom;
      ws.getCell(`E${row}`).alignment = { horizontal: 'center' };
      ws.getCell(`F${row}`).value = line.quantity;
      ws.getCell(`F${row}`).numFmt = '#,##0.00';
      ws.getCell(`G${row}`).value = line.mhPerUnit ?? null;
      ws.getCell(`G${row}`).numFmt = '0.000';
      ws.getCell(`H${row}`).value = line.laborRateCents !== null ? line.laborRateCents / 100 : null;
      ws.getCell(`H${row}`).numFmt = '"$"#,##0';
      ws.getCell(`I${row}`).value =
        line.matUnitCostCents !== null ? line.matUnitCostCents / 100 : null;
      ws.getCell(`I${row}`).numFmt = '"$"#,##0.00';
      ws.getCell(`J${row}`).value = line.wastePercent !== null ? line.wastePercent / 100 : null;
      ws.getCell(`J${row}`).numFmt = '0%';
      ws.getCell(`K${row}`).value = line.laborHours ?? null;
      ws.getCell(`K${row}`).numFmt = '#,##0.00';
      ws.getCell(`L${row}`).value = labCost;
      ws.getCell(`L${row}`).numFmt = '"$"#,##0.00';
      ws.getCell(`M${row}`).value = matCost;
      ws.getCell(`M${row}`).numFmt = '"$"#,##0.00';
      ws.getCell(`N${row}`).value = sub;
      ws.getCell(`N${row}`).numFmt = '"$"#,##0.00';
      ws.getCell(`N${row}`).font = { bold: true };

      for (let col = 1; col <= 14; col++) {
        ws.getCell(row, col).border = {
          bottom: { style: 'thin', color: { argb: BORDER_GRAY } },
        };
      }

      if (line.notes) {
        row++;
        ws.getCell(`C${row}`).value = `↳ ${line.notes}`;
        ws.getCell(`C${row}`).font = { italic: true, color: { argb: TEXT_MUTED }, size: 9 };
        ws.mergeCells(`C${row}:N${row}`);
      }

      row++;
    }

    // Section subtotal
    ws.getCell(`C${row}`).value = `Subtotal — ${section.name}`;
    ws.getCell(`C${row}`).font = { italic: true, bold: true };
    ws.mergeCells(`C${row}:J${row}`);
    ws.getCell(`K${row}`).value = sectionMh;
    ws.getCell(`K${row}`).numFmt = '#,##0.00';
    ws.getCell(`K${row}`).font = { bold: true };
    ws.getCell(`L${row}`).value = section.subtotalLaborCents / 100;
    ws.getCell(`L${row}`).numFmt = '"$"#,##0.00';
    ws.getCell(`L${row}`).font = { bold: true };
    ws.getCell(`M${row}`).value = section.subtotalMaterialCents / 100;
    ws.getCell(`M${row}`).numFmt = '"$"#,##0.00';
    ws.getCell(`M${row}`).font = { bold: true };
    ws.getCell(`N${row}`).value = section.subtotalCents / 100;
    ws.getCell(`N${row}`).numFmt = '"$"#,##0.00';
    ws.getCell(`N${row}`).font = { bold: true };
    for (let col = 1; col <= 14; col++) {
      ws.getCell(row, col).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' },
      };
    }
    row += 2;
  }

  // ---- Direct Cost Summary ----
  const totalMh = data.lines.reduce((a, l) => a + (l.laborHours ?? 0), 0);

  ws.getCell(`C${row}`).value = 'DIRECT COST SUMMARY';
  ws.getCell(`C${row}`).font = { bold: true, size: 12 };
  ws.mergeCells(`C${row}:N${row}`);
  row++;
  ws.getCell(`C${row}`).value = 'Subtotal — Direct Cost';
  ws.getCell(`C${row}`).font = { bold: true };
  ws.mergeCells(`C${row}:J${row}`);
  ws.getCell(`K${row}`).value = totalMh;
  ws.getCell(`K${row}`).numFmt = '#,##0.00';
  ws.getCell(`L${row}`).value = data.totals.directLaborCents / 100;
  ws.getCell(`L${row}`).numFmt = '"$"#,##0.00';
  ws.getCell(`L${row}`).font = { bold: true };
  ws.getCell(`M${row}`).value = data.totals.directMaterialCents / 100;
  ws.getCell(`M${row}`).numFmt = '"$"#,##0.00';
  ws.getCell(`M${row}`).font = { bold: true };
  ws.getCell(`N${row}`).value = data.totals.directCents / 100;
  ws.getCell(`N${row}`).numFmt = '"$"#,##0.00';
  ws.getCell(`N${row}`).font = { bold: true };
  row += 2;

  // ---- OH&P Adjustments ----
  ws.getCell(`C${row}`).value = 'OH&P ADJUSTMENTS';
  ws.getCell(`C${row}`).font = { bold: true, size: 12 };
  ws.mergeCells(`C${row}:N${row}`);
  row++;

  const directD = data.totals.directCents / 100;
  const gcAmount = directD * (data.generalConditionsPercent / 100);
  const ohAfterGc = (directD + gcAmount) * (data.overheadPercent / 100);
  const profitAfterOh = (directD + gcAmount + ohAfterGc) * (data.profitPercent / 100);

  const adjRows: Array<[string, number, number]> = [
    [
      `General Conditions (${data.generalConditionsPercent}%)`,
      data.generalConditionsPercent,
      gcAmount,
    ],
    [`Company Overhead (${data.overheadPercent}%)`, data.overheadPercent, ohAfterGc],
    [`Profit (${data.profitPercent}%)`, data.profitPercent, profitAfterOh],
  ];
  for (const [label, , amount] of adjRows) {
    ws.getCell(`C${row}`).value = label;
    ws.mergeCells(`C${row}:M${row}`);
    ws.getCell(`N${row}`).value = amount;
    ws.getCell(`N${row}`).numFmt = '"$"#,##0.00';
    row++;
  }
  ws.getCell(`C${row}`).value = 'Total OH&P (multiplicative)';
  ws.getCell(`C${row}`).font = { bold: true };
  ws.mergeCells(`C${row}:M${row}`);
  ws.getCell(`N${row}`).value = data.totals.ohpCents / 100;
  ws.getCell(`N${row}`).numFmt = '"$"#,##0.00';
  ws.getCell(`N${row}`).font = { bold: true };
  row += 2;

  // ---- Grand Total ----
  ws.getCell(`C${row}`).value = 'GRAND TOTAL (Direct + OH&P)';
  ws.getCell(`C${row}`).font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  ws.getCell(`C${row}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: BRAND_BLUE },
  };
  ws.getCell(`C${row}`).alignment = { vertical: 'middle' };
  ws.mergeCells(`C${row}:M${row}`);
  ws.getCell(`N${row}`).value = data.totals.grandTotalCents / 100;
  ws.getCell(`N${row}`).numFmt = '"$"#,##0.00';
  ws.getCell(`N${row}`).font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  ws.getCell(`N${row}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: BRAND_BLUE },
  };
  ws.getCell(`N${row}`).alignment = { vertical: 'middle' };
  ws.getRow(row).height = 28;
  row++;

  if (data.totalEnvelopeSf) {
    const cps = data.totals.grandTotalCents / 100 / data.totalEnvelopeSf;
    ws.getCell(`C${row}`).value = `Cost per SF (÷ ${data.totalEnvelopeSf.toLocaleString()} SF)`;
    ws.getCell(`C${row}`).font = { italic: true, color: { argb: TEXT_MUTED } };
    ws.mergeCells(`C${row}:M${row}`);
    ws.getCell(`N${row}`).value = cps;
    ws.getCell(`N${row}`).numFmt = '"$"#,##0.00"/SF"';
    ws.getCell(`N${row}`).font = { italic: true, color: { argb: TEXT_MUTED } };
    row++;
  }
  row += 2;

  // ---- Notes ----
  ws.getCell(`A${row}`).value = 'NOTES & ASSUMPTIONS';
  ws.getCell(`A${row}`).font = { bold: true, color: { argb: BRAND_BLUE }, size: 11 };
  ws.mergeCells(`A${row}:N${row}`);
  row++;

  const noteLines = (data.assumptions ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  if (noteLines.length === 0) {
    noteLines.push('No additional assumptions recorded.');
  }
  for (const note of noteLines) {
    ws.getCell(`A${row}`).value = '•';
    ws.getCell(`A${row}`).alignment = { horizontal: 'right' };
    ws.getCell(`B${row}`).value = note;
    ws.mergeCells(`B${row}:N${row}`);
    ws.getRow(row).alignment = { wrapText: true, vertical: 'top' };
    row++;
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
