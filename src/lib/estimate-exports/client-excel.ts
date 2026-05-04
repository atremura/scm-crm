import ExcelJS from 'exceljs';
import type { ExportData } from './types';
import { loadLogoBuffer } from './logo';

const BRAND_BLUE = 'FF0E1E46'; // Navy — matches the app's sidebar
const BRAND_BLUE_SOFT = 'FFE0E7FF'; // indigo-100, soft contrast against navy
const BORDER_GRAY = 'FFD1D5DB'; // gray-300
const TEXT_MUTED = 'FF6B7280'; // gray-500

const $ = (cents: number) =>
  cents === 0
    ? '—'
    : `$${(cents / 100).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

export async function buildClientExcel(data: ExportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = data.company.name;
  wb.created = new Date();

  const ws = wb.addWorksheet('Proposal', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
    views: [{ showGridLines: false }],
  });

  ws.columns = [
    { width: 6 }, // A — #
    { width: 38 }, // B — Item Description (will be merged with C)
    { width: 18 }, // C — second part of description merged area
    { width: 8 }, // D — Unit
    { width: 12 }, // E — QTY
    { width: 14 }, // F — Unit Price (Labor)
    { width: 14 }, // G — Unit Price (Material)
    { width: 16 }, // H — Subtotal (Labor)
    { width: 16 }, // I — Subtotal (Material)
    { width: 16 }, // J — Total
  ];

  let row = 1;

  // ---- Header block ----
  // Optional logo strip on its own row (white background)
  const logo = await loadLogoBuffer(data.company.logoUrl);
  if (logo) {
    ws.getRow(row).height = 56;
    const imageId = wb.addImage({
      // exceljs's index.d.ts has `declare interface Buffer extends ArrayBuffer`,
      // which interface-merges with @types/node's Buffer and ends up demanding
      // ArrayBuffer-only members (maxByteLength, resizable, resize, detached,
      // transfer, transferToFixedLength) that Node's Buffer doesn't expose at
      // the top level. Runtime is fine — exceljs reads bytes via `.buffer`.
      // @ts-expect-error — exceljs typing limitation
      buffer: logo.buffer,
      extension: logo.extension,
    });
    ws.addImage(imageId, {
      tl: { col: 0, row: row - 1 },
      ext: { width: 160, height: 64 },
      editAs: 'oneCell',
    });
    // Right side of the logo strip = company name in big bold
    ws.getCell(`F${row}`).value = data.company.name;
    ws.getCell(`F${row}`).font = {
      name: 'Arial',
      size: 14,
      bold: true,
      color: { argb: BRAND_BLUE },
    };
    ws.getCell(`F${row}`).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.mergeCells(`F${row}:J${row}`);
    row++;
  }

  // Title bar with proposal number
  const title = ws.getCell(`A${row}`);
  title.value = data.proposalNumber ? `PROPOSAL ${data.proposalNumber}` : 'PROPOSAL';
  title.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  title.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  ws.mergeCells(`A${row}:J${row}`);
  ws.getRow(row).height = 32;
  ws.getCell(`A${row}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: BRAND_BLUE },
  };
  row += 2;

  // Project name
  ws.getCell(`A${row}`).value = 'PROJECT NAME';
  ws.getCell(`A${row}`).font = { bold: true, color: { argb: TEXT_MUTED } };
  ws.getCell(`B${row}`).value = data.projectName;
  ws.getCell(`B${row}`).font = { bold: true, size: 13 };
  ws.mergeCells(`B${row}:F${row}`);
  if (data.totalEnvelopeSf) {
    ws.getCell(`G${row}`).value = 'TOTAL ENVELOPE';
    ws.getCell(`G${row}`).font = { bold: true, color: { argb: TEXT_MUTED } };
    ws.getCell(`H${row}`).value = `${data.totalEnvelopeSf.toLocaleString()} SF`;
    ws.getCell(`H${row}`).font = { bold: true };
    ws.mergeCells(`H${row}:J${row}`);
  }
  row++;

  // Project location
  ws.getCell(`A${row}`).value = 'LOCATION';
  ws.getCell(`A${row}`).font = { bold: true, color: { argb: TEXT_MUTED } };
  ws.getCell(`B${row}`).value = data.projectAddress ?? '—';
  ws.mergeCells(`B${row}:F${row}`);
  ws.getCell(`G${row}`).value = 'CLIENT';
  ws.getCell(`G${row}`).font = { bold: true, color: { argb: TEXT_MUTED } };
  ws.getCell(`H${row}`).value = data.client.name;
  ws.getCell(`H${row}`).font = { bold: true };
  ws.mergeCells(`H${row}:J${row}`);
  row++;

  // Issue date + valid for
  const issueDate = data.acceptedAt ?? new Date();
  const validUntil = new Date(issueDate);
  validUntil.setDate(validUntil.getDate() + data.validForDays);
  ws.getCell(`A${row}`).value = 'ISSUED';
  ws.getCell(`A${row}`).font = { bold: true, color: { argb: TEXT_MUTED } };
  ws.getCell(`B${row}`).value = issueDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  ws.mergeCells(`B${row}:F${row}`);
  ws.getCell(`G${row}`).value = 'VALID UNTIL';
  ws.getCell(`G${row}`).font = { bold: true, color: { argb: TEXT_MUTED } };
  ws.getCell(`H${row}`).value = validUntil.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  ws.mergeCells(`H${row}:J${row}`);
  row += 2;

  // ---- Company / Customer info side-by-side ----
  ws.getCell(`A${row}`).value = 'COMPANY INFORMATION';
  ws.getCell(`A${row}`).font = {
    bold: true,
    color: { argb: 'FFFFFFFF' },
    size: 11,
  };
  ws.getCell(`A${row}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: BRAND_BLUE },
  };
  ws.getCell(`A${row}`).alignment = { horizontal: 'left', vertical: 'middle' };
  ws.mergeCells(`A${row}:E${row}`);
  ws.getCell(`F${row}`).value = 'CUSTOMER INFORMATION';
  ws.getCell(`F${row}`).font = {
    bold: true,
    color: { argb: 'FFFFFFFF' },
    size: 11,
  };
  ws.getCell(`F${row}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: BRAND_BLUE },
  };
  ws.getCell(`F${row}`).alignment = { horizontal: 'left', vertical: 'middle' };
  ws.mergeCells(`F${row}:J${row}`);
  ws.getRow(row).height = 22;
  row++;

  const companyRows: Array<[string, string | null]> = [
    ['COMPANY', data.company.name],
    ['NAME', data.company.contactName],
    ['PHONE', data.company.phone],
    ['EMAIL', data.company.email],
    ['ADDRESS', data.company.address],
  ];
  const customerRows: Array<[string, string | null]> = [
    ['COMPANY', data.client.name],
    ['NAME', data.client.contactName],
    ['PHONE', data.client.phone],
    ['EMAIL', data.client.email],
    ['ADDRESS', data.client.address],
  ];
  for (let i = 0; i < companyRows.length; i++) {
    const [labelL, valueL] = companyRows[i];
    const [labelR, valueR] = customerRows[i];
    ws.getCell(`A${row}`).value = labelL;
    ws.getCell(`A${row}`).font = { bold: true, color: { argb: TEXT_MUTED }, size: 9 };
    ws.getCell(`B${row}`).value = valueL ?? '—';
    ws.mergeCells(`B${row}:E${row}`);
    ws.getCell(`F${row}`).value = labelR;
    ws.getCell(`F${row}`).font = { bold: true, color: { argb: TEXT_MUTED }, size: 9 };
    ws.getCell(`G${row}`).value = valueR ?? '—';
    ws.mergeCells(`G${row}:J${row}`);
    row++;
  }
  row++;

  // ---- Items table header ----
  const tableHeaderRow = row;
  const headers = [
    '#',
    'Item Description',
    '',
    'Unit',
    'QTY',
    'Unit Price (Labor)',
    'Unit Price (Material)',
    'Subtotal (Labor)',
    'Subtotal (Material)',
    'Total',
  ];
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: BRAND_BLUE },
    };
    cell.alignment = {
      horizontal: i === 0 ? 'center' : i === 1 ? 'left' : 'right',
      vertical: 'middle',
      wrapText: true,
    };
  });
  ws.mergeCells(`B${row}:C${row}`);
  ws.getRow(row).height = 32;
  row++;

  // ---- Sections + lines ----
  let itemNumber = 0;
  for (const section of data.sections) {
    if (section.lines.length === 0) continue;

    // Section header bar
    ws.getCell(`A${row}`).value = section.name.toUpperCase();
    ws.getCell(`A${row}`).font = { bold: true, color: { argb: BRAND_BLUE }, size: 11 };
    ws.getCell(`A${row}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: BRAND_BLUE_SOFT },
    };
    ws.mergeCells(`A${row}:J${row}`);
    ws.getRow(row).height = 22;
    row++;

    for (const line of section.lines) {
      itemNumber++;
      const qty = line.quantity;
      const laborUnitClient = qty > 0 ? (line.laborCostCents / qty) * data.markupFactor : 0;
      const matUnitClient = qty > 0 ? (line.materialCostCents / qty) * data.markupFactor : 0;
      const labSub = line.laborCostCents * data.markupFactor;
      const matSub = line.materialCostCents * data.markupFactor;
      const total = labSub + matSub;

      ws.getCell(`A${row}`).value = itemNumber;
      ws.getCell(`A${row}`).alignment = { horizontal: 'center' };
      ws.getCell(`B${row}`).value = line.name;
      ws.mergeCells(`B${row}:C${row}`);
      ws.getCell(`D${row}`).value = line.uom;
      ws.getCell(`D${row}`).alignment = { horizontal: 'center' };
      ws.getCell(`E${row}`).value = qty;
      ws.getCell(`E${row}`).numFmt = '#,##0.00';
      ws.getCell(`F${row}`).value = laborUnitClient / 100;
      ws.getCell(`F${row}`).numFmt = '"$"#,##0.00';
      ws.getCell(`G${row}`).value = matUnitClient / 100;
      ws.getCell(`G${row}`).numFmt = '"$"#,##0.00';
      ws.getCell(`H${row}`).value = labSub / 100;
      ws.getCell(`H${row}`).numFmt = '"$"#,##0.00';
      ws.getCell(`I${row}`).value = matSub / 100;
      ws.getCell(`I${row}`).numFmt = '"$"#,##0.00';
      ws.getCell(`J${row}`).value = total / 100;
      ws.getCell(`J${row}`).numFmt = '"$"#,##0.00';
      ws.getCell(`J${row}`).font = { bold: true };

      // Light bottom border
      for (let col = 1; col <= 10; col++) {
        ws.getCell(row, col).border = {
          bottom: { style: 'thin', color: { argb: BORDER_GRAY } },
        };
      }
      row++;
    }

    // Section subtotal
    const labSubSection = section.subtotalLaborCents * data.markupFactor;
    const matSubSection = section.subtotalMaterialCents * data.markupFactor;
    ws.getCell(`B${row}`).value = `Subtotal — ${section.name}`;
    ws.getCell(`B${row}`).font = { italic: true, bold: true };
    ws.mergeCells(`B${row}:G${row}`);
    ws.getCell(`H${row}`).value = labSubSection / 100;
    ws.getCell(`H${row}`).numFmt = '"$"#,##0.00';
    ws.getCell(`H${row}`).font = { bold: true };
    ws.getCell(`I${row}`).value = matSubSection / 100;
    ws.getCell(`I${row}`).numFmt = '"$"#,##0.00';
    ws.getCell(`I${row}`).font = { bold: true };
    ws.getCell(`J${row}`).value = (labSubSection + matSubSection) / 100;
    ws.getCell(`J${row}`).numFmt = '"$"#,##0.00';
    ws.getCell(`J${row}`).font = { bold: true };
    for (let col = 1; col <= 10; col++) {
      ws.getCell(row, col).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' }, // gray-100
      };
    }
    row += 2;
  }

  // ---- Grand totals ----
  const labTotalClient = data.totals.directLaborCents * data.markupFactor;
  const matTotalClient = data.totals.directMaterialCents * data.markupFactor;
  const grandTotal = data.totals.grandTotalCents;

  ws.getCell(`G${row}`).value = 'Subtotal Labor:';
  ws.getCell(`G${row}`).font = { bold: true };
  ws.getCell(`G${row}`).alignment = { horizontal: 'right' };
  ws.getCell(`H${row}`).value = labTotalClient / 100;
  ws.getCell(`H${row}`).numFmt = '"$"#,##0.00';
  ws.mergeCells(`H${row}:J${row}`);
  row++;

  ws.getCell(`G${row}`).value = 'Subtotal Material:';
  ws.getCell(`G${row}`).font = { bold: true };
  ws.getCell(`G${row}`).alignment = { horizontal: 'right' };
  ws.getCell(`H${row}`).value = matTotalClient / 100;
  ws.getCell(`H${row}`).numFmt = '"$"#,##0.00';
  ws.mergeCells(`H${row}:J${row}`);
  row += 2;

  ws.getCell(`G${row}`).value = 'GRAND TOTAL:';
  ws.getCell(`G${row}`).font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  ws.getCell(`G${row}`).alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getCell(`G${row}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: BRAND_BLUE },
  };
  ws.getCell(`H${row}`).value = grandTotal / 100;
  ws.getCell(`H${row}`).numFmt = '"$"#,##0.00';
  ws.getCell(`H${row}`).font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  ws.getCell(`H${row}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: BRAND_BLUE },
  };
  ws.getCell(`H${row}`).alignment = { vertical: 'middle' };
  ws.mergeCells(`H${row}:J${row}`);
  ws.getRow(row).height = 28;
  row++;

  if (data.totalEnvelopeSf) {
    const costPerSf = grandTotal / 100 / data.totalEnvelopeSf;
    ws.getCell(`G${row}`).value = 'Cost per SF:';
    ws.getCell(`G${row}`).font = { italic: true, color: { argb: TEXT_MUTED } };
    ws.getCell(`G${row}`).alignment = { horizontal: 'right' };
    ws.getCell(`H${row}`).value = costPerSf;
    ws.getCell(`H${row}`).numFmt = '"$"#,##0.00"/SF"';
    ws.getCell(`H${row}`).font = { italic: true, color: { argb: TEXT_MUTED } };
    ws.mergeCells(`H${row}:J${row}`);
    row++;
  }
  row += 2;

  // ---- Notes / assumptions ----
  ws.getCell(`A${row}`).value = 'NOTES & ASSUMPTIONS';
  ws.getCell(`A${row}`).font = { bold: true, color: { argb: BRAND_BLUE }, size: 11 };
  ws.mergeCells(`A${row}:J${row}`);
  row++;

  const noteLines = (data.assumptions ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  if (noteLines.length === 0) {
    noteLines.push('Pricing valid for ' + data.validForDays + ' days from issue date.');
    noteLines.push('All quantities verified against latest drawings.');
  }
  for (const note of noteLines) {
    ws.getCell(`A${row}`).value = '•';
    ws.getCell(`A${row}`).alignment = { horizontal: 'right' };
    ws.getCell(`B${row}`).value = note;
    ws.mergeCells(`B${row}:J${row}`);
    ws.getRow(row).alignment = { wrapText: true, vertical: 'top' };
    row++;
  }
  row += 2;

  // ---- Signature block ----
  ws.getCell(`A${row}`).value = 'ACCEPTANCE';
  ws.getCell(`A${row}`).font = { bold: true, color: { argb: BRAND_BLUE }, size: 11 };
  ws.mergeCells(`A${row}:J${row}`);
  row += 2;

  ws.getCell(`A${row}`).value =
    'By signing below, the customer accepts this proposal and authorizes the work described.';
  ws.getCell(`A${row}`).font = { italic: true, color: { argb: TEXT_MUTED } };
  ws.mergeCells(`A${row}:J${row}`);
  row += 2;

  ws.getCell(`B${row}`).value = 'Accepted by:';
  ws.getCell(`B${row}`).font = { bold: true };
  ws.getCell(`C${row}`).value = '___________________________';
  ws.mergeCells(`C${row}:E${row}`);
  ws.getCell(`G${row}`).value = 'Date:';
  ws.getCell(`G${row}`).font = { bold: true };
  ws.getCell(`H${row}`).value = '___________________________';
  ws.mergeCells(`H${row}:J${row}`);
  row += 2;

  ws.getCell(`B${row}`).value = 'Signature:';
  ws.getCell(`B${row}`).font = { bold: true };
  ws.getCell(`C${row}`).value = '___________________________';
  ws.mergeCells(`C${row}:E${row}`);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
