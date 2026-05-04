'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  AlertTriangle,
  HelpCircle,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type ApiPreliminaryClassification = {
  name: string;
  external_id: string | null;
  type: 'area' | 'linear' | 'count';
  uom: string;
  quantity: number;
  quantity_basis: string;
  scope: 'service' | 'service_and_material';
  division_hint: string | null;
  productivity_hint: string | null;
  material_hint: string | null;
  confidence: number;
  source_reference: string;
  notes: string | null;
};

type ApiParsedResult = {
  project_summary: string;
  critical_points: string[];
  unresolved_questions: string[];
  preliminary_classifications: ApiPreliminaryClassification[];
};

type ApiRun = {
  id: string;
  modelUsed: string;
  promptVersion: string;
  status: 'pending' | 'accepted' | 'partially_accepted' | 'rejected' | 'failed';
  itemsProposed: number;
  itemsAccepted: number;
  itemsRejected: number;
  costCents: number | string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  documentIds: string[];
  parsedResult: ApiParsedResult | null;
  errorMessage: string | null;
  reviewedAt: string | null;
  reviewer: { id: string; name: string } | null;
  reviewNote: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  documents: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    documentType: string;
  }>;
};

export default function AnalysisRunDetailPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const { id: projectId, runId } = use(params);
  const [run, setRun] = useState<ApiRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const res = await fetch(`/api/projects/${projectId}/analysis-runs/${runId}`);
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? 'Failed to load run');
        }
        const data: ApiRun = await res.json();
        if (cancelled) return;
        setRun(data);

        // Keep polling while the worker is still running. Stop when
        // we have a completedAt timestamp OR the run failed.
        const done = data.completedAt !== null || data.status === 'failed';
        if (!done) {
          timer = setTimeout(tick, 5_000);
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(err.message);
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [projectId, runId]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <div className="rounded-lg border border-danger-500/30 bg-danger-500/10 p-4 text-[13px] text-danger-500">
          {error}
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-fg-subtle">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const result = run.parsedResult;
  const grouped = groupByDivision(result?.preliminary_classifications ?? []);
  const cost = run.costCents !== null ? `$${(Number(run.costCents) / 100).toFixed(2)}` : '—';

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5 p-6 md:p-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/takeoff/${projectId}`}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to project
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <span className="rounded-md bg-sunken px-2 py-0.5 font-mono text-[12px] font-semibold text-fg-muted">
              {run.id.slice(0, 8).toUpperCase()}
            </span>
            <RunStatusBadge status={run.status} />
          </div>
          <h1 className="mt-1.5 text-[20px] font-bold text-fg-default">AI Scope Analysis</h1>
          <p className="text-[12.5px] text-fg-muted">
            Model: <b>{run.modelUsed}</b> · Prompt v{run.promptVersion} ·{' '}
            {new Date(run.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-[12.5px]">
          <Stat label="Items proposed" value={String(run.itemsProposed)} />
          <Stat label="Cost" value={cost} />
          <Stat
            label="Tokens"
            value={`${formatToks(run.inputTokens)} / ${formatToks(run.outputTokens)}`}
            hint="in / out"
          />
        </div>
      </div>

      {run.errorMessage && (
        <div className="rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-[13px] text-danger-500">
          <b>Run failed:</b> {run.errorMessage}
        </div>
      )}

      {run.completedAt === null && run.status === 'pending' && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-[13px]">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-400" />
          <div className="flex-1">
            <div className="font-semibold text-fg-default">Analysis in progress</div>
            <div className="text-fg-muted">
              Uploading PDFs to Anthropic and running Opus 4.7. This can take 1–5 minutes for large
              projects. The page refreshes automatically every 5 seconds.
            </div>
          </div>
        </div>
      )}

      {/* Project summary */}
      {result?.project_summary && (
        <Section title="Project summary" icon={<FileText className="h-4 w-4" />}>
          <p className="whitespace-pre-wrap text-[13px] text-fg-default">
            {result.project_summary}
          </p>
        </Section>
      )}

      {/* Critical points */}
      {result?.critical_points && result.critical_points.length > 0 && (
        <Section
          title={`Critical points (${result.critical_points.length})`}
          icon={<AlertTriangle className="h-4 w-4 text-warn-500" />}
          variant="warn"
        >
          <ul className="space-y-1.5 text-[13px]">
            {result.critical_points.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-warn-500">•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Unresolved questions */}
      {result?.unresolved_questions && result.unresolved_questions.length > 0 && (
        <Section
          title={`Unresolved questions (${result.unresolved_questions.length})`}
          icon={<HelpCircle className="h-4 w-4 text-blue-400" />}
          variant="info"
        >
          <ul className="space-y-1.5 text-[13px]">
            {result.unresolved_questions.map((q, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-blue-400">?</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Items grouped by division */}
      {result?.preliminary_classifications && result.preliminary_classifications.length > 0 && (
        <Section title={`Items proposed (${run.itemsProposed})`}>
          <div className="space-y-4">
            {grouped.map((g) => (
              <div key={g.name}>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                  {g.name} · {g.items.length} items
                </div>
                <div className="overflow-hidden rounded-md border border-border">
                  <table className="w-full text-[12.5px]">
                    <thead className="bg-sunken/70 text-left text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle">
                      <tr>
                        <th className="px-2.5 py-1.5">Code</th>
                        <th className="px-2.5 py-1.5">Description</th>
                        <th className="px-2.5 py-1.5 text-right">Qty</th>
                        <th className="px-2.5 py-1.5">UOM</th>
                        <th className="px-2.5 py-1.5">Scope</th>
                        <th className="px-2.5 py-1.5">Conf.</th>
                        <th className="px-2.5 py-1.5">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {g.items.map((it, i) => (
                        <tr key={i} className="align-top hover:bg-sunken/40">
                          <td className="px-2.5 py-1.5 font-mono text-[10.5px] text-fg-muted">
                            {it.external_id ?? '—'}
                          </td>
                          <td className="px-2.5 py-1.5">
                            <div className="font-medium text-fg-default">{it.name}</div>
                            <div className="mt-0.5 text-[11px] text-fg-subtle">
                              ↳ {it.quantity_basis}
                            </div>
                            {it.notes && (
                              <div className="mt-0.5 text-[11px] italic text-fg-muted">
                                {it.notes}
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-mono">
                            {it.quantity.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-2.5 py-1.5 uppercase text-fg-subtle">{it.uom}</td>
                          <td className="px-2.5 py-1.5">
                            <span
                              className={`rounded px-1.5 py-[1px] font-mono text-[10px] font-bold ${
                                it.scope === 'service'
                                  ? 'bg-warn-500/15 text-warn-500'
                                  : 'bg-blue-500/15 text-blue-400'
                              }`}
                            >
                              {it.scope === 'service' ? 'S' : 'S+M'}
                            </span>
                          </td>
                          <td className="px-2.5 py-1.5">
                            <ConfidenceBadge value={it.confidence} />
                          </td>
                          <td className="px-2.5 py-1.5 text-fg-muted">{it.source_reference}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Documents used */}
      {run.documents && run.documents.length > 0 && (
        <Section title="Documents analyzed" icon={<FileText className="h-4 w-4" />}>
          <ul className="space-y-1 text-[13px]">
            {run.documents.map((d) => (
              <li key={d.id}>
                <a
                  href={d.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  {d.fileName}
                </a>
                <span className="ml-2 text-[11px] text-fg-subtle">({d.documentType})</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Footer note — accept flow lands in Week 2 */}
      <div className="rounded-lg border border-dashed border-border bg-sunken/40 p-3 text-[12.5px] text-fg-muted">
        Review this output. The accept-into-Takeoff flow ships in the next iteration — for now this
        view is read-only so you can validate what Claude produced before we wire up creating
        Classifications.
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function groupByDivision(items: ApiPreliminaryClassification[]) {
  const map = new Map<string, ApiPreliminaryClassification[]>();
  for (const it of items) {
    const k = it.division_hint ?? 'Unclassified';
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  return Array.from(map.entries())
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function formatToks(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle">{label}</div>
      <div className="mt-0.5 font-mono text-[14px] font-semibold text-fg-default">{value}</div>
      {hint && <div className="text-[10px] text-fg-subtle">{hint}</div>}
    </div>
  );
}

function Section({
  title,
  icon,
  children,
  variant,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  variant?: 'warn' | 'info';
}) {
  const border =
    variant === 'warn'
      ? 'border-warn-500/30 bg-warn-500/5'
      : variant === 'info'
        ? 'border-blue-500/30 bg-blue-500/5'
        : 'border-border bg-surface';
  return (
    <section className={`rounded-lg border p-4 ${border}`}>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-[13.5px] font-semibold text-fg-default">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.85
      ? 'bg-success-500/15 text-success-500'
      : value >= 0.6
        ? 'bg-warn-500/15 text-warn-500'
        : 'bg-danger-500/15 text-danger-500';
  return (
    <span
      className={`inline-flex rounded px-1.5 py-[1px] font-mono text-[10px] font-bold ${color}`}
    >
      {pct}%
    </span>
  );
}

function RunStatusBadge({ status }: { status: ApiRun['status'] }) {
  const color =
    status === 'failed'
      ? 'bg-danger-500/15 text-danger-500'
      : status === 'rejected'
        ? 'bg-fg-subtle/15 text-fg-subtle'
        : status === 'accepted' || status === 'partially_accepted'
          ? 'bg-success-500/15 text-success-500'
          : 'bg-blue-500/15 text-blue-400';
  const Icon =
    status === 'failed'
      ? XCircle
      : status === 'accepted' || status === 'partially_accepted'
        ? CheckCircle2
        : Clock;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-[1px] text-[11px] font-semibold uppercase ${color}`}
    >
      <Icon className="h-3 w-3" />
      {status.replace(/_/g, ' ')}
    </span>
  );
}
