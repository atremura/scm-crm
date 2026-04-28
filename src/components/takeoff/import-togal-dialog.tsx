'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { normalizeUom, type Uom } from '@/lib/takeoff-utils';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  onImported: () => void;
};

// One parsed row, post-normalization, ready to POST.
export type ImportRow = {
  name: string;
  externalId: string | null;
  quantity: number;
  uom: Uom;
  /** Togal "ID (Optional)" field — used by the resolver as the highest-
   *  confidence matchCode signal. Distinct from externalId, which we
   *  derive from a code prefix in the name when no ID column exists. */
  togalId: string | null;
  /** Togal "Folder (Optional)" field — divisional grouping. Resolver
   *  uses this as a Division pre-filter for the AI fallback path. */
  togalFolder: string | null;
  /** Original full label as exported. We persist this so future
   *  reconciliation can use the unabbreviated string even after the
   *  normalized `name` is edited. */
  togalLabelOriginal: string | null;
  /** If the sheet cell we couldn't make sense of. */
  warning?: string;
};

/**
 * Locate the column index of a header by trying a list of label
 * candidates (case-insensitive, substring match). Returns -1 when
 * nothing matches.
 */
function findColumn(headerRow: unknown[], candidates: string[]): number {
  for (let i = 0; i < headerRow.length; i++) {
    const cell = String(headerRow[i] ?? '').toLowerCase().trim();
    if (!cell) continue;
    for (const c of candidates) {
      if (cell === c || cell.includes(c)) return i;
    }
  }
  return -1;
}

/**
 * Parse a Togal-formatted sheet. Modern Togal exports include columns:
 *   Classification | ID | Folder | Quantity 1 | Quantity1 UOM | ...
 *
 * Older exports (Andre's first attempt) had only:
 *   Classification | Quantity 1 | Quantity1 UOM | ...
 *
 * We detect headers dynamically and degrade gracefully when ID or
 * Folder are absent — the resolver still has the name-prefix path.
 */
function parseTogalSheet(wb: XLSX.WorkBook): {
  rows: ImportRow[];
  skipped: string[];
  sheetName: string;
} {
  // Prefer a sheet literally named "Togal" — that's what their exporter writes.
  const sheetName =
    wb.SheetNames.find((n) => n.trim().toLowerCase() === 'togal') ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

  if (aoa.length === 0) {
    return { rows: [], skipped: ['Empty sheet'], sheetName };
  }

  // Header lives on the first row with "Classification" in it.
  let headerRow = 0;
  for (let i = 0; i < Math.min(aoa.length, 5); i++) {
    const first = String(aoa[i]?.[0] ?? '').toLowerCase().trim();
    if (first === 'classification' || first.startsWith('classification')) {
      headerRow = i;
      break;
    }
  }

  const headers = aoa[headerRow] ?? [];
  const colName    = findColumn(headers, ['classification']);
  const colId      = findColumn(headers, ['id']);
  const colFolder  = findColumn(headers, ['folder']);
  const colQty     = findColumn(headers, ['quantity 1', 'quantity1', 'quantity']);
  const colUom     = findColumn(headers, ['quantity1 uom', 'quantity 1 uom', 'uom']);

  // Defaults for legacy exports without explicit headers — fall back
  // to the original positional layout (col 0/1/2).
  const idx = {
    name:   colName   >= 0 ? colName   : 0,
    id:     colId     >= 0 ? colId     : -1,
    folder: colFolder >= 0 ? colFolder : -1,
    qty:    colQty    >= 0 ? colQty    : 1,
    uom:    colUom    >= 0 ? colUom    : 2,
  };

  const rows: ImportRow[] = [];
  const skipped: string[] = [];

  for (let i = headerRow + 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!r) continue;
    const name = String(r[idx.name] ?? '').trim();
    const qtyRaw = r[idx.qty];
    const uomRaw = String(r[idx.uom] ?? '').trim();
    if (!name) continue;

    const qty = typeof qtyRaw === 'number' ? qtyRaw : parseFloat(String(qtyRaw ?? ''));
    if (!Number.isFinite(qty)) {
      skipped.push(`"${name}" — quantity "${qtyRaw}" is not a number`);
      continue;
    }
    const uom = normalizeUom(uomRaw);
    if (!uom) {
      skipped.push(`"${name}" — UOM "${uomRaw}" not recognized (expected SF, FT, LF, or EA)`);
      continue;
    }

    const togalId =
      idx.id >= 0 ? String(r[idx.id] ?? '').trim() || null : null;
    const togalFolder =
      idx.folder >= 0 ? String(r[idx.folder] ?? '').trim() || null : null;

    // Togal names often embed a code like "ELFCS-1 JAMES HARDIE ..." —
    // pull it out into externalId so the dedup match is tighter.
    let externalId: string | null = null;
    const codeMatch = name.match(/^([A-Z][A-Z0-9-]{1,20})\s+/);
    if (codeMatch) externalId = codeMatch[1];

    rows.push({
      name,
      externalId,
      quantity: qty,
      uom,
      togalId,
      togalFolder,
      togalLabelOriginal: name, // capture before any future normalization
    });
  }

  return { rows, skipped, sheetName };
}

export function ImportTogalDialog({ open, onOpenChange, projectId, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [mode, setMode] = useState<'replace' | 'add'>('replace');
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      // Reset on close so re-opening starts fresh.
      setFile(null);
      setRows(null);
      setSkipped([]);
      setSheetName(null);
      setMode('replace');
      setParsing(false);
      setSubmitting(false);
    }
  }, [open]);

  async function handleFile(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xlsm', 'xls', 'csv'].includes(ext ?? '')) {
      toast.error('Please choose a .xlsx, .xls, or .csv file');
      return;
    }
    setFile(f);
    setParsing(true);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const { rows, skipped, sheetName } = parseTogalSheet(wb);
      setRows(rows);
      setSkipped(skipped);
      setSheetName(sheetName);
      if (rows.length === 0) {
        toast.error(
          'Could not find any classification rows. Is this the Togal export?'
        );
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to read the file');
    } finally {
      setParsing(false);
    }
  }

  function removeRow(idx: number) {
    setRows((prev) => (prev ? prev.filter((_, i) => i !== idx) : null));
  }

  async function confirmImport() {
    if (!rows || rows.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/classifications/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'togal',
          fileName: file?.name ?? null,
          mode,
          rows,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Import failed');
        return;
      }
      toast.success(
        `Imported: ${data.created} new, ${data.updated} updated (${data.rowsImported} total)`
      );
      onImported();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  const totals = useMemo(() => {
    const out = { SF: 0, LF: 0, EA: 0 };
    if (!rows) return out;
    for (const r of rows) out[r.uom] += r.quantity;
    return out;
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Import from Togal</DialogTitle>
          <DialogDescription>
            Upload the <b>.xlsx</b> you exported from Togal. We&apos;ll read the
            classifications and quantities, then you confirm before anything
            lands in this project. Scope (Service vs Service+Material) is set
            to the default; classify each item afterwards.
          </DialogDescription>
        </DialogHeader>

        {/* Stage 1: Upload */}
        {!rows && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragOver ? 'border-blue-500 bg-blue-500/5' : 'border-border bg-sunken/40'
            }`}
          >
            <FileSpreadsheet className="mx-auto h-8 w-8 text-fg-subtle" />
            <div className="mt-3 text-[14px] font-semibold text-fg-default">
              {parsing ? 'Reading file…' : 'Drop the Togal export here'}
            </div>
            <div className="mt-1 text-[12px] text-fg-muted">
              or{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-blue-400 hover:underline"
                disabled={parsing}
              >
                browse
              </button>
              {' '}— .xlsx, .xls, or .csv
            </div>
            <input
              ref={inputRef}
              type="file"
              hidden
              accept=".xlsx,.xls,.csv,.xlsm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
          </div>
        )}

        {/* Stage 2: Preview */}
        {rows && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-border bg-sunken/60 px-3 py-2 text-[12.5px]">
              <div className="min-w-0">
                <div className="truncate font-semibold text-fg-default">
                  {file?.name ?? 'File'}
                </div>
                <div className="text-[11px] text-fg-subtle">
                  Sheet: {sheetName ?? '—'} · {rows.length} classification
                  {rows.length === 1 ? '' : 's'} ready
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRows(null);
                  setFile(null);
                  setSkipped([]);
                }}
                disabled={submitting}
              >
                Change file
              </Button>
            </div>

            {skipped.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-warn-500/30 bg-warn-500/10 p-2.5 text-[11.5px] text-warn-500">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <div>
                  <b>{skipped.length}</b> row{skipped.length === 1 ? '' : 's'} skipped:
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {skipped.slice(0, 5).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                    {skipped.length > 5 && <li>…and {skipped.length - 5} more</li>}
                  </ul>
                </div>
              </div>
            )}

            {/* Totals summary */}
            <div className="flex gap-3 text-[11.5px] text-fg-muted">
              {totals.SF > 0 && (
                <span>
                  Area: <b className="font-mono text-fg-default">{totals.SF.toLocaleString()}</b> SF
                </span>
              )}
              {totals.LF > 0 && (
                <span>
                  Linear: <b className="font-mono text-fg-default">{totals.LF.toLocaleString()}</b> LF
                </span>
              )}
              {totals.EA > 0 && (
                <span>
                  Count: <b className="font-mono text-fg-default">{totals.EA.toLocaleString()}</b> EA
                </span>
              )}
            </div>

            {/* Rows preview */}
            <div className="max-h-[320px] overflow-auto rounded-md border border-border">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-sunken text-left text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle">
                  <tr>
                    <th className="px-3 py-1.5">Code</th>
                    <th className="px-3 py-1.5">Name</th>
                    <th className="px-3 py-1.5 text-right">Qty</th>
                    <th className="px-3 py-1.5">UOM</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-border hover:bg-sunken/40">
                      <td className="px-3 py-1.5 font-mono text-[11px] text-fg-muted">
                        {r.externalId ?? '—'}
                      </td>
                      <td className="max-w-[280px] truncate px-3 py-1.5 text-fg-default">
                        {r.name}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {r.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-1.5 uppercase tracking-wide text-fg-subtle">
                        {r.uom}
                      </td>
                      <td className="pr-2">
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          disabled={submitting}
                          className="grid h-6 w-6 place-items-center rounded text-fg-subtle hover:bg-danger-500/10 hover:text-danger-500 disabled:opacity-40"
                          aria-label="Remove row"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Dedup mode */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="import-mode" className="text-[12px] font-semibold">
                When a classification already exists on this project
              </Label>
              <Select
                value={mode}
                onValueChange={(v) => setMode(v as 'replace' | 'add')}
                disabled={submitting}
              >
                <SelectTrigger id="import-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="replace">Replace the quantity</SelectItem>
                  <SelectItem value="add">Add to the existing quantity</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-fg-subtle">
                Match happens by code when present, otherwise by name (case-insensitive).
                New entries are always created.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmImport}
            disabled={!rows || rows.length === 0 || submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Importing…
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                Import {rows ? `${rows.length} row${rows.length === 1 ? '' : 's'}` : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
