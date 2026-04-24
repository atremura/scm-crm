'use client';

import { useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  DollarSign,
  Loader2,
  MapPin,
  Ruler,
  Sparkles,
  AlertTriangle,
  User as UserIcon,
  Inbox,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  CLASSIFICATION_SCOPE_BADGE,
  CLASSIFICATION_SCOPE_LABELS,
  type ClassificationScope,
} from '@/lib/takeoff-utils';
import { rollupTotals } from '@/lib/estimate-pricing';

type ApiLine = {
  id: string;
  name: string;
  externalId: string | null;
  scope: string;
  uom: string;
  quantity: number | string;
  mhPerUnit: number | string | null;
  laborHours: number | string | null;
  laborRateCents: number | null;
  laborCostCents: number | null;
  materialCostCents: number | null;
  subtotalCents: number | null;
  suggestedByAi: boolean;
  aiConfidence: number | null;
  needsReview: boolean;
  notes: string | null;
  laborTrade: { id: string; name: string } | null;
  productivityEntry: { id: string; scopeName: string } | null;
};

type ApiEstimate = {
  id: string;
  status: string;
  shopType: string;
  mhRangeMode: string;
  markupPercent: number | string | null;
  overheadPercent: number | string | null;
  contingencyPercent: number | string | null;
  salesTaxPercent: number | string | null;
  clientName: string | null;
  createdAt: string;
  acceptedAt: string | null;
  project: {
    id: string;
    name: string;
    projectNumber: string | null;
    address: string | null;
    workType: string | null;
    client: { id: string; companyName: string } | null;
  };
  region: { id: string; name: string; stateCode: string };
  owner: { id: string; name: string; email: string };
  receivedFrom: { id: string; name: string } | null;
  lines: ApiLine[];
  appliedFactors: Array<{
    id: string;
    name: string;
    impactPercent: number | string;
    appliesTo: string;
    autoApplied: boolean;
  }>;
};

function dollars(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function EstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [estimate, setEstimate] = useState<ApiEstimate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/estimates/${id}`)
      .then(async (r) => {
        if (r.status === 404) {
          toast.error('Estimate not found');
          router.push('/estimates');
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((d) => {
        if (d) setEstimate(d);
      })
      .catch(() => toast.error('Failed to load estimate'))
      .finally(() => setLoading(false));
  }, [id, router]);

  const totals = useMemo(() => {
    if (!estimate) return null;
    return rollupTotals(
      estimate.lines.map((l) => ({
        laborCostCents: l.laborCostCents,
        materialCostCents: l.materialCostCents,
      })),
      estimate.appliedFactors.map((f) => ({
        appliesTo: f.appliesTo as 'labor' | 'material' | 'overhead',
        impactPercent: Number(f.impactPercent),
      })),
      {
        markupPercent: estimate.markupPercent !== null ? Number(estimate.markupPercent) : null,
        overheadPercent:
          estimate.overheadPercent !== null ? Number(estimate.overheadPercent) : null,
        contingencyPercent:
          estimate.contingencyPercent !== null ? Number(estimate.contingencyPercent) : null,
        salesTaxPercent:
          estimate.salesTaxPercent !== null ? Number(estimate.salesTaxPercent) : null,
      }
    );
  }, [estimate]);

  if (loading && !estimate) {
    return (
      <div className="flex items-center justify-center py-16 text-fg-subtle">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading estimate…
      </div>
    );
  }
  if (!estimate) return null;

  const needsReviewCount = estimate.lines.filter((l) => l.needsReview).length;

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-5 p-6 md:p-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/takeoff/${estimate.project.id}`}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to project
        </Link>
      </Button>

      {/* Head */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {estimate.project.projectNumber && (
              <span className="rounded-md bg-sunken px-2 py-0.5 font-mono text-[11.5px] font-semibold text-fg-muted">
                {estimate.project.projectNumber}
              </span>
            )}
            <span className="rounded-md bg-blue-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-400">
              {estimate.status.replace(/_/g, ' ')}
            </span>
            <span className="rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
              {estimate.region.stateCode} · {estimate.shopType.replace('_', ' ')} ·{' '}
              {estimate.mhRangeMode}
            </span>
          </div>
          <h1 className="mt-2 text-[22px] font-bold leading-tight tracking-[-0.02em] text-fg-default">
            {estimate.project.name}
          </h1>
          {estimate.clientName && (
            <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-fg-muted">
              <Building2 className="h-3.5 w-3.5" />
              {estimate.clientName}
            </p>
          )}
        </div>
      </div>

      {/* Auto-pricing summary banner */}
      {needsReviewCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-warn-500/30 bg-warn-500/10 p-3 text-[13px]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn-500" />
          <div>
            <div className="font-semibold text-fg-default">
              {needsReviewCount} line{needsReviewCount === 1 ? '' : 's'} need review
            </div>
            <div className="text-[12px] text-fg-muted">
              The auto-pricing engine couldn&apos;t find a confident match. Check those
              rows and fill labor/material manually.
            </div>
          </div>
        </div>
      )}

      {/* Totals cards */}
      {totals && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <TotalCard label="Labor" value={dollars(totals.laborFactoredCents)} sub={`raw ${dollars(totals.laborCostCents)}`} />
          <TotalCard label="Material" value={dollars(totals.materialFactoredCents)} sub={`raw ${dollars(totals.materialCostCents)}`} />
          <TotalCard
            label="Overhead + Markup"
            value={dollars(totals.overheadCents + totals.markupCents)}
            sub={`${Number(estimate.overheadPercent ?? 0)}% + ${Number(estimate.markupPercent ?? 0)}%`}
          />
          <TotalCard label="Grand total" value={dollars(totals.totalCents)} highlight />
        </div>
      )}

      {/* Applied cost factors */}
      {estimate.appliedFactors.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            <h3 className="text-[13px] font-semibold text-fg-default">
              Cost factors applied ({estimate.appliedFactors.length})
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {estimate.appliedFactors.map((f) => (
              <span
                key={f.id}
                title={f.autoApplied ? 'Auto-applied' : 'Manually added'}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-sunken px-2 py-1 text-[12px]"
              >
                <span className="font-semibold text-fg-default">{f.name}</span>
                <span className="text-fg-subtle">·</span>
                <span className="font-mono text-blue-400">
                  +{(Number(f.impactPercent) * 100).toFixed(1)}%
                </span>
                <span className="text-fg-subtle">·</span>
                <span className="uppercase tracking-wide text-fg-muted">{f.appliesTo}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Lines table */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border bg-sunken/50 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Ruler className="h-3.5 w-3.5 text-fg-muted" />
            <h3 className="text-[13px] font-semibold text-fg-default">
              Lines ({estimate.lines.length})
            </h3>
          </div>
          <div className="text-[11.5px] text-fg-subtle">
            Read-only for now — inline edit coming soon.
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-sunken/40 text-left text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Scope</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2">UOM</th>
                <th className="px-3 py-2 text-right">MH/u</th>
                <th className="px-3 py-2 text-right">Labor hrs</th>
                <th className="px-3 py-2 text-right">Labor $</th>
                <th className="px-3 py-2 text-right">Material $</th>
                <th className="px-3 py-2 text-right">Subtotal</th>
                <th className="px-3 py-2 text-center">AI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {estimate.lines.map((l) => (
                <tr
                  key={l.id}
                  className={`hover:bg-sunken/30 ${l.needsReview ? 'bg-warn-500/5' : ''}`}
                >
                  <td className="px-3 py-1.5 font-mono text-[11px] text-fg-muted">
                    {l.externalId ?? '—'}
                  </td>
                  <td className="max-w-[280px] px-3 py-1.5 text-fg-default">
                    <div className="truncate">{l.name}</div>
                    {l.productivityEntry && (
                      <div className="truncate text-[10.5px] text-fg-subtle">
                        ↳ {l.productivityEntry.scopeName}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <ScopeBadge scope={l.scope} />
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    {Number(l.quantity).toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-3 py-1.5 uppercase tracking-wide text-fg-subtle">
                    {l.uom}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-fg-muted">
                    {l.mhPerUnit !== null ? Number(l.mhPerUnit).toFixed(3) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-fg-muted">
                    {l.laborHours !== null ? Number(l.laborHours).toFixed(2) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">{dollars(l.laborCostCents)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{dollars(l.materialCostCents)}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-semibold">
                    {dollars(l.subtotalCents)}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <ConfidenceBadge
                      confidence={l.aiConfidence}
                      needsReview={l.needsReview}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetaCard label="Owner" icon={UserIcon}>
          {estimate.owner.name}
          {estimate.receivedFrom && (
            <div className="text-[11.5px] text-fg-subtle">
              Received from {estimate.receivedFrom.name}
            </div>
          )}
        </MetaCard>
        <MetaCard label="Region & config" icon={MapPin}>
          {estimate.region.name} ({estimate.region.stateCode})
          <div className="text-[11.5px] text-fg-subtle">
            {estimate.shopType.replace('_', ' ')} · {estimate.mhRangeMode} range
          </div>
        </MetaCard>
        <MetaCard label="Accepted" icon={Calendar}>
          {estimate.acceptedAt ? new Date(estimate.acceptedAt).toLocaleString() : '—'}
        </MetaCard>
      </div>
    </div>
  );
}

function TotalCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        highlight ? 'border-blue-500/40 bg-blue-500/10' : 'border-border bg-surface'
      }`}
    >
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
        {label}
      </div>
      <div
        className={`mt-0.5 font-mono text-[18px] font-semibold ${
          highlight ? 'text-blue-400' : 'text-fg-default'
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[10.5px] text-fg-subtle">{sub}</div>}
    </div>
  );
}

function MetaCard({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-[13px] text-fg-default">{children}</div>
    </div>
  );
}

function ScopeBadge({ scope }: { scope: string }) {
  const s = scope as ClassificationScope;
  const label = CLASSIFICATION_SCOPE_BADGE[s] ?? '?';
  const full = CLASSIFICATION_SCOPE_LABELS[s] ?? scope;
  const color =
    s === 'service' ? 'bg-warn-500/15 text-warn-500' : 'bg-blue-500/15 text-blue-400';
  return (
    <span
      title={full}
      className={`inline-flex rounded px-1.5 py-[1px] font-mono text-[10px] font-bold ${color}`}
    >
      {label}
    </span>
  );
}

function ConfidenceBadge({
  confidence,
  needsReview,
}: {
  confidence: number | null;
  needsReview: boolean;
}) {
  if (confidence === null) return <span className="text-fg-subtle">—</span>;
  const color =
    needsReview || confidence < 70
      ? 'bg-warn-500/15 text-warn-500'
      : confidence < 85
        ? 'bg-blue-500/15 text-blue-400'
        : 'bg-success-500/15 text-success-500';
  return (
    <span
      title={needsReview ? 'Needs review' : `${confidence}% confidence`}
      className={`inline-flex rounded px-1.5 py-[1px] font-mono text-[10px] font-bold ${color}`}
    >
      {confidence}
    </span>
  );
}
