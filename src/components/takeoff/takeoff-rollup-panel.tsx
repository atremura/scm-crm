'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Download,
  Send,
  Ruler,
  Loader2,
  CheckCircle2,
  Clock,
  User as UserIcon,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  CLASSIFICATION_SCOPE_LABELS,
  CLASSIFICATION_SCOPE_BADGE,
  type ClassificationScope,
} from '@/lib/takeoff-utils';
import { SendToEstimateDialog } from '@/components/takeoff/send-to-estimate-dialog';

type ApiClassification = {
  id: string;
  name: string;
  externalId: string | null;
  type: string;
  uom: string;
  scope: string;
  quantity: number | string;
  unitCost: number | string | null;
};

type ProjectLite = {
  id: string;
  name: string;
  projectNumber: string | null;
  status: string;
  estimator: { id: string; name: string } | null;
  sentToEstimateAt: string | null;
  sentToEstimateBy: { id: string; name: string } | null;
  estimateReceiver: { id: string; name: string; email: string } | null;
  estimateHandoffNote: string | null;
};

type Props = {
  project: ProjectLite;
  currentUserId: string | null;
  onProjectChanged: () => void;
};

export function TakeoffRollupPanel({
  project,
  currentUserId,
  onProjectChanged,
}: Props) {
  const [rows, setRows] = useState<ApiClassification[] | null>(null);
  const [sendOpen, setSendOpen] = useState(false);

  async function load() {
    const res = await fetch(`/api/projects/${project.id}/classifications`);
    if (res.ok) {
      const d = await res.json();
      setRows(Array.isArray(d) ? d : []);
    } else {
      setRows([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const summary = useMemo(() => {
    const s = {
      total: 0,
      byUom: { SF: 0, LF: 0, EA: 0 } as Record<string, number>,
      estValue: 0,
      serviceCount: 0,
      serviceAndMaterialCount: 0,
    };
    if (!rows) return s;
    s.total = rows.length;
    for (const r of rows) {
      const q = Number(r.quantity) || 0;
      const c = Number(r.unitCost) || 0;
      s.byUom[r.uom] = (s.byUom[r.uom] ?? 0) + q;
      s.estValue += q * c;
      if (r.scope === 'service') s.serviceCount++;
      else if (r.scope === 'service_and_material') s.serviceAndMaterialCount++;
    }
    return s;
  }, [rows]);

  function exportCsv() {
    if (!rows || rows.length === 0) {
      toast.error('No classifications to export');
      return;
    }
    const header = [
      'Code',
      'Name',
      'Scope',
      'Type',
      'Quantity',
      'UOM',
      'Unit Cost',
      'Subtotal',
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
      const q = Number(r.quantity) || 0;
      const c = Number(r.unitCost) || 0;
      const subtotal = q * c;
      lines.push(
        [
          csvCell(r.externalId ?? ''),
          csvCell(r.name),
          csvCell(CLASSIFICATION_SCOPE_LABELS[r.scope as ClassificationScope] ?? r.scope),
          csvCell(r.type),
          q.toString(),
          csvCell(r.uom),
          c ? c.toFixed(2) : '',
          subtotal ? subtotal.toFixed(2) : '',
        ].join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = (project.projectNumber ?? project.name)
      .replace(/[^a-zA-Z0-9-_]+/g, '_')
      .slice(0, 60);
    a.download = `takeoff_${slug}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  }

  const isSent = project.status === 'sent_to_estimate' || !!project.sentToEstimateAt;
  const isAccepted = project.status === 'estimate_accepted';

  return (
    <div className="space-y-5">
      {/* Handoff banner */}
      {(isSent || isAccepted) && (
        <div
          className={`rounded-lg border p-4 ${
            isAccepted
              ? 'border-success-500/30 bg-success-500/10'
              : 'border-blue-500/30 bg-blue-500/10'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              {isAccepted ? (
                <CheckCircle2 className="h-5 w-5 text-success-500" />
              ) : (
                <Clock className="h-5 w-5 text-blue-400" />
              )}
            </div>
            <div className="min-w-0 flex-1 text-[13px]">
              <div className="font-semibold text-fg-default">
                {isAccepted ? 'Accepted for estimate' : 'Sent to Estimate'}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-fg-muted">
                {project.sentToEstimateAt && (
                  <span>
                    {new Date(project.sentToEstimateAt).toLocaleDateString()} at{' '}
                    {new Date(project.sentToEstimateAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
                {project.sentToEstimateBy && (
                  <span className="inline-flex items-center gap-1">
                    <UserIcon className="h-3 w-3" />
                    From {project.sentToEstimateBy.name}
                  </span>
                )}
                {project.estimateReceiver && (
                  <span className="inline-flex items-center gap-1">
                    <UserIcon className="h-3 w-3" />
                    To {project.estimateReceiver.name}
                  </span>
                )}
              </div>
              {project.estimateHandoffNote && (
                <div className="mt-2 whitespace-pre-wrap rounded-md bg-surface px-3 py-2 text-[12px] text-fg-default">
                  {project.estimateHandoffNote}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-fg-default">Takeoff summary</h2>
          <p className="text-[12px] text-fg-muted">
            Rollup of every classification on this project, ready for handoff.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows || rows.length === 0}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button
            size="sm"
            onClick={() => setSendOpen(true)}
            disabled={!rows || rows.length === 0 || isAccepted}
          >
            <Send className="h-3.5 w-3.5" />
            {isSent ? 'Re-send to Estimate' : 'Send to Estimate'}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard label="Classifications" value={summary.total.toString()} />
        <SummaryCard
          label="Total area"
          value={summary.byUom.SF.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          uom="SF"
        />
        <SummaryCard
          label="Total linear"
          value={summary.byUom.LF.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          uom="LF"
        />
        <SummaryCard
          label="Total count"
          value={summary.byUom.EA.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          uom="EA"
        />
        <SummaryCard
          label="Est. value"
          value={
            summary.estValue > 0
              ? `$${summary.estValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : '—'
          }
          hint={summary.estValue > 0 ? 'from unit costs' : 'no unit costs yet'}
        />
      </div>

      {/* Scope breakdown */}
      {rows && rows.length > 0 && (
        <div className="flex items-center gap-6 rounded-md border border-border bg-sunken/40 px-4 py-2.5 text-[12.5px]">
          <div>
            <span className="text-fg-muted">Service only: </span>
            <b className="text-fg-default">{summary.serviceCount}</b>
          </div>
          <div>
            <span className="text-fg-muted">Service + Material: </span>
            <b className="text-fg-default">{summary.serviceAndMaterialCount}</b>
          </div>
        </div>
      )}

      {/* Table */}
      {rows === null ? (
        <div className="flex items-center justify-center py-10 text-fg-subtle">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-sunken/40 py-12 text-center">
          <Ruler className="mx-auto h-7 w-7 text-fg-subtle" />
          <p className="mt-2 text-[13px] text-fg-muted">
            No classifications yet. Open a document to add them.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href={`/takeoff/${project.id}?tab=documents`}>
              <ExternalLink className="h-3.5 w-3.5" />
              Go to documents
            </Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-[12.5px]">
            <thead className="bg-sunken/70 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Scope</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2">UOM</th>
                <th className="px-3 py-2 text-right">Unit cost</th>
                <th className="px-3 py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const q = Number(r.quantity) || 0;
                const c = Number(r.unitCost) || 0;
                const sub = q * c;
                return (
                  <tr key={r.id} className="hover:bg-sunken/40">
                    <td className="px-3 py-1.5 font-mono text-[11px] text-fg-muted">
                      {r.externalId ?? '—'}
                    </td>
                    <td className="px-3 py-1.5 text-fg-default">{r.name}</td>
                    <td className="px-3 py-1.5">
                      <ScopeBadge scope={r.scope} />
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {q.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-1.5 uppercase tracking-wide text-fg-subtle">
                      {r.uom}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-fg-muted">
                      {c ? `$${c.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {sub ? `$${sub.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SendToEstimateDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        projectId={project.id}
        currentEstimatorId={project.estimator?.id ?? null}
        currentUserId={currentUserId}
        onSent={() => {
          onProjectChanged();
          load();
        }}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  uom,
  hint,
}: {
  label: string;
  value: string;
  uom?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[18px] font-semibold text-fg-default">
        {value}
        {uom && (
          <span className="ml-1 text-[11px] font-normal text-fg-subtle">{uom}</span>
        )}
      </div>
      {hint && <div className="mt-0.5 text-[10.5px] text-fg-subtle">{hint}</div>}
    </div>
  );
}

function ScopeBadge({ scope }: { scope: string }) {
  const s = scope as ClassificationScope;
  const label = CLASSIFICATION_SCOPE_BADGE[s] ?? '?';
  const full = CLASSIFICATION_SCOPE_LABELS[s] ?? scope;
  const color =
    s === 'service'
      ? 'bg-warn-500/15 text-warn-500'
      : 'bg-blue-500/15 text-blue-400';
  return (
    <span
      title={full}
      className={`inline-flex rounded px-1.5 py-[1px] font-mono text-[10px] font-bold ${color}`}
    >
      {label}
    </span>
  );
}

function csvCell(v: string): string {
  // Escape per RFC 4180: wrap in quotes if contains comma/quote/newline,
  // and double-up any embedded quotes.
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
