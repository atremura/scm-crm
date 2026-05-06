'use client';

import { useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Loader2,
  MapPin,
  Ruler,
  Sparkles,
  AlertTriangle,
  User as UserIcon,
  ChevronDown,
  ChevronRight,
  Save,
  Trash2,
  RefreshCw,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  CLASSIFICATION_SCOPE_BADGE,
  CLASSIFICATION_SCOPE_LABELS,
  type ClassificationScope,
} from '@/lib/takeoff-utils';
import { rollupTotals } from '@/lib/estimate-pricing';
import type { ProjectContextHints } from '@/lib/project-context-hints';
import { AiSuggestDialog } from '@/components/estimate/ai-suggest-dialog';
import { ProjectContextCard } from '@/components/estimate/project-context-card';
import { AiPassesBar } from '@/components/estimate/ai-passes-bar';
import { EditableCell } from '@/components/estimate/editable-cell';

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
  materialBreakdown: Array<{
    materialId?: string | null;
    name: string;
    qty: number;
    uom: string;
    unitCostCents: number;
    wastePercent: number;
    subtotalCents?: number;
  }> | null;
  subtotalCents: number | null;
  groupName: string | null;
  suggestedByAi: boolean;
  aiConfidence: number | null;
  needsReview: boolean;
  notes: string | null;
  source: string | null;
  parentLineId: string | null;
  derivedFromRuleId: string | null;
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
  generalConditionsPercent: number | string | null;
  contingencyPercent: number | string | null;
  salesTaxPercent: number | string | null;
  totalEnvelopeSf: number | string | null;
  assumptions: string | null;
  clientName: string | null;
  createdAt: string;
  acceptedAt: string | null;
  aiHiddenCostsRunAt: string | null;
  aiHiddenCostsResult: any;
  project: {
    id: string;
    name: string;
    projectNumber: string | null;
    address: string | null;
    workType: string | null;
    // IA-1 Project Context — JSONB blob; see src/lib/project-context-hints.ts
    contextHints: ProjectContextHints | null;
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
  pendingClassifications: Array<{
    id: string;
    name: string;
    externalId: string | null;
    uom: string;
    scope: string;
    quantity: number | string;
  }>;
};

function dollars(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dollarsCompact(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  const v = cents / 100;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 10_000) return `$${(v / 1000).toFixed(1)}k`;
  return dollars(cents);
}

export default function EstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [estimate, setEstimate] = useState<ApiEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [suggestLine, setSuggestLine] = useState<ApiLine | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [savingMargins, setSavingMargins] = useState(false);
  const [repricing, setRepricing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function loadEstimate() {
    const res = await fetch(`/api/estimates/${id}`);
    if (res.status === 404) {
      toast.error('Estimate not found');
      router.push('/estimates');
      return;
    }
    if (!res.ok) {
      toast.error('Failed to load estimate');
      return;
    }
    setEstimate(await res.json());
  }

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

  // Group lines by section + compute per-section totals
  const grouped = useMemo(() => {
    if (!estimate) return [];
    const buckets = new Map<string, ApiLine[]>();
    for (const l of estimate.lines) {
      const g = l.groupName ?? 'Unclassified';
      if (!buckets.has(g)) buckets.set(g, []);
      buckets.get(g)!.push(l);
    }
    return Array.from(buckets.entries())
      .map(([section, lines]) => {
        const labor = lines.reduce((s, l) => s + (l.laborCostCents ?? 0), 0);
        const material = lines.reduce((s, l) => s + (l.materialCostCents ?? 0), 0);
        const mh = lines.reduce(
          (s, l) =>
            s + (l.laborHours !== null && l.laborHours !== undefined ? Number(l.laborHours) : 0),
          0,
        );
        return {
          section,
          lines,
          totals: { labor, material, subtotal: labor + material, mh },
        };
      })
      .sort((a, b) => {
        // Push Unclassified to the bottom; rest alphabetical
        if (a.section === 'Unclassified') return 1;
        if (b.section === 'Unclassified') return -1;
        return a.section.localeCompare(b.section);
      });
  }, [estimate]);

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
        generalConditionsPercent:
          estimate.generalConditionsPercent !== null
            ? Number(estimate.generalConditionsPercent)
            : null,
        contingencyPercent:
          estimate.contingencyPercent !== null ? Number(estimate.contingencyPercent) : null,
        salesTaxPercent:
          estimate.salesTaxPercent !== null ? Number(estimate.salesTaxPercent) : null,
      },
    );
  }, [estimate]);

  const costPerSf = useMemo(() => {
    if (!totals || !estimate?.totalEnvelopeSf) return null;
    const sf = Number(estimate.totalEnvelopeSf);
    if (sf <= 0) return null;
    return totals.totalCents / 100 / sf;
  }, [totals, estimate?.totalEnvelopeSf]);

  function toggleSection(section: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  if (loading && !estimate) {
    return (
      <div className="flex items-center justify-center py-16 text-fg-subtle">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading estimate…
      </div>
    );
  }
  if (!estimate || !totals) return null;

  const needsReviewCount = estimate.lines.filter((l) => l.needsReview).length;

  return (
    <div className="w-full space-y-5 px-4 py-5 md:px-6 md:py-6 2xl:px-8">
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
              <span className="rounded-md bg-sunken px-2 py-0.5 font-mono text-[13.5px] font-semibold text-fg-muted">
                {estimate.project.projectNumber}
              </span>
            )}
            <span className="rounded-md bg-blue-500/15 px-2 py-0.5 text-[13.5px] font-semibold uppercase tracking-wide text-blue-400">
              {estimate.status.replace(/_/g, ' ')}
            </span>
            <span className="rounded-md bg-ink-100 px-2 py-0.5 text-[13.5px] font-semibold uppercase tracking-wide text-fg-muted">
              {estimate.region.stateCode} · {estimate.shopType.replace('_', ' ')} ·{' '}
              {estimate.mhRangeMode}
            </span>
          </div>
          <h1 className="mt-2 text-[24px] font-bold leading-tight tracking-[-0.02em] text-fg-default">
            {estimate.project.name}
          </h1>
          {estimate.clientName && (
            <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-fg-muted">
              <Building2 className="h-3.5 w-3.5" />
              {estimate.clientName}
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="h-3.5 w-3.5" />
              Export
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Client-facing (no OH&P)</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <a href={`/api/estimates/${estimate.id}/export?type=client&format=xlsx`} download>
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Excel — Client proposal
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <FileText className="h-3.5 w-3.5" />
              PDF — Client proposal
              <span className="ml-auto text-[10px] text-fg-subtle">soon</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Internal (full breakdown)</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <a href={`/api/estimates/${estimate.id}/export?type=internal&format=xlsx`} download>
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Excel — Internal
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <FileText className="h-3.5 w-3.5" />
              PDF — Internal
              <span className="ml-auto text-[10px] text-fg-subtle">soon</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Needs-review banner */}
      {estimate.pendingClassifications.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-[13px]">
          <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <div className="flex-1">
            <div className="font-semibold text-fg-default">
              {estimate.pendingClassifications.length} new classification
              {estimate.pendingClassifications.length === 1 ? '' : 's'} in Takeoff
            </div>
            <div className="text-[13.5px] text-fg-muted">
              Added after this estimate was accepted. Sync to add{' '}
              {estimate.pendingClassifications.length === 1 ? 'it' : 'them'} as new line
              {estimate.pendingClassifications.length === 1 ? '' : 's'} (existing lines stay
              untouched).
            </div>
          </div>
          <Button
            size="sm"
            disabled={syncing}
            onClick={async () => {
              setSyncing(true);
              try {
                const res = await fetch(`/api/estimates/${estimate.id}/sync-from-takeoff`, {
                  method: 'POST',
                });
                const d = await res.json();
                if (!res.ok) {
                  toast.error(d?.error ?? 'Sync failed');
                  return;
                }
                toast.success(
                  d.added === 1
                    ? '1 classification added to estimate'
                    : `${d.added} classifications added to estimate`,
                );
                await loadEstimate();
              } finally {
                setSyncing(false);
              }
            }}
          >
            {syncing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Syncing…
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Sync from Takeoff
              </>
            )}
          </Button>
        </div>
      )}

      {needsReviewCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-warn-500/30 bg-warn-500/10 p-3 text-[13px]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn-500" />
          <div className="flex-1">
            <div className="font-semibold text-fg-default">
              {needsReviewCount} line{needsReviewCount === 1 ? '' : 's'} need review
            </div>
            <div className="text-[13.5px] text-fg-muted">
              Click ✨ on a single line for a one-off check, or hit <b>Re-price all</b> to send
              every flagged row to Claude in one batch (~$0.10 per line, ~15s each, parallel ×3).
            </div>
          </div>
          <Button
            size="sm"
            disabled={repricing}
            onClick={async () => {
              setRepricing(true);
              try {
                const res = await fetch(`/api/estimates/${estimate.id}/reprice-all`, {
                  method: 'POST',
                });
                const d = await res.json();
                if (!res.ok) {
                  toast.error(d?.error ?? 'Re-price failed');
                  return;
                }
                toast.success(
                  `Processed ${d.processed} · applied ${d.applied}` +
                    (d.failed ? ` · ${d.failed} failed` : '') +
                    ` · cost $${(d.totalCostCents / 100).toFixed(2)}`,
                );
                await loadEstimate();
              } finally {
                setRepricing(false);
              }
            }}
          >
            {repricing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Re-pricing {needsReviewCount}…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Re-price all
              </>
            )}
          </Button>
        </div>
      )}

      {/* AI passes banner — IA-1 + IA-2 (+ IA-3/4 placeholders) */}
      <AiPassesBar
        estimateId={estimate.id}
        ia1HasRun={estimate.project.contextHints !== null}
        ia2RunAt={estimate.aiHiddenCostsRunAt}
        ia2DerivativeLineCount={estimate.lines.filter((l) => l.source === 'ai-derivative').length}
        ia2NewRulesCount={estimate.aiHiddenCostsResult?.aiNewRules ?? 0}
        onRefreshed={loadEstimate}
      />

      {/* IA-1 Project Context card */}
      <ProjectContextCard
        estimateId={estimate.id}
        project={{
          name: estimate.project.name,
          contextHints: estimate.project.contextHints,
        }}
        onRefreshed={loadEstimate}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard
          label="Direct cost"
          value={dollarsCompact(totals.directCostCents)}
          sub={`${dollars(totals.laborFactoredCents)} labor + ${dollars(totals.materialFactoredCents)} material`}
        />
        <SummaryCard
          label="Total OH&P"
          value={dollarsCompact(totals.ohpTotalCents)}
          sub={`${((totals.ohpTotalCents / Math.max(totals.directCostCents, 1)) * 100 || 0).toFixed(1)}% of direct`}
        />
        <SummaryCard
          label="Grand total"
          value={dollarsCompact(totals.totalCents)}
          sub={dollars(totals.totalCents)}
          highlight
        />
        <SummaryCard
          label="Cost per SF"
          value={costPerSf !== null ? `$${costPerSf.toFixed(2)}/SF` : '—'}
          sub={
            estimate.totalEnvelopeSf
              ? `÷ ${Number(estimate.totalEnvelopeSf).toLocaleString()} SF`
              : 'set envelope SF below'
          }
        />
      </div>

      {/* Lines table — grouped by section */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border bg-sunken/50 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Ruler className="h-3.5 w-3.5 text-fg-muted" />
            <h3 className="text-[13px] font-semibold text-fg-default">
              Lines ({estimate.lines.length}) · {grouped.length} section
              {grouped.length === 1 ? '' : 's'}
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead className="bg-sunken/40 text-left text-[13.5px] font-semibold uppercase tracking-wider text-fg-subtle">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Trade</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2">UOM</th>
                <th className="px-3 py-2 text-right">MH/u</th>
                <th className="px-3 py-2 text-right">$/hr</th>
                <th className="px-3 py-2 text-right">Total MH</th>
                <th className="px-3 py-2 text-right">Labor $</th>
                <th className="px-3 py-2 text-right">Mat $/u</th>
                <th className="px-3 py-2 text-right">Material $</th>
                <th className="px-3 py-2 text-right">Subtotal</th>
                <th className="px-3 py-2 text-center">AI</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => {
                const isCollapsed = collapsed.has(g.section);
                return (
                  <SectionGroup
                    key={g.section}
                    section={g.section}
                    lines={g.lines}
                    totals={g.totals}
                    isCollapsed={isCollapsed}
                    onToggle={() => toggleSection(g.section)}
                    onSuggest={(l) => setSuggestLine(l)}
                    estimateId={estimate.id}
                    onLineSaved={loadEstimate}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Direct Cost Summary */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_3fr]">
        <Card>
          <CardHeader title="Direct cost summary" />
          <ul className="divide-y divide-border text-[13.5px]">
            {grouped.map((g) => (
              <li key={g.section} className="flex items-center justify-between px-4 py-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-fg-default">{g.section}</div>
                  <div className="text-[13.5px] text-fg-subtle">
                    {g.lines.length} line{g.lines.length === 1 ? '' : 's'} ·{' '}
                    {g.totals.mh.toFixed(1)} MH
                  </div>
                </div>
                <div className="font-mono font-semibold text-fg-default">
                  {dollars(g.totals.subtotal)}
                </div>
              </li>
            ))}
            <li className="flex items-center justify-between border-t-2 border-border bg-sunken/40 px-4 py-2.5">
              <span className="text-[13.5px] font-semibold uppercase tracking-wider text-fg-subtle">
                Direct cost
              </span>
              <span className="font-mono text-[14px] font-bold text-fg-default">
                {dollars(totals.directCostCents)}
              </span>
            </li>
          </ul>
        </Card>

        {/* OH&P + margins editor */}
        <MarginsEditor
          estimate={estimate}
          totals={totals}
          saving={savingMargins}
          onSave={async (patch) => {
            setSavingMargins(true);
            try {
              const res = await fetch(`/api/estimates/${estimate.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch),
              });
              if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                toast.error(d?.error ?? 'Failed to save');
                return;
              }
              toast.success('Saved');
              await loadEstimate();
            } finally {
              setSavingMargins(false);
            }
          }}
        />
      </div>

      {/* Notes & Assumptions */}
      <AssumptionsEditor
        estimate={estimate}
        onSave={async (assumptions) => {
          const res = await fetch(`/api/estimates/${estimate.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assumptions }),
          });
          if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            toast.error(d?.error ?? 'Failed to save');
            return;
          }
          toast.success('Notes saved');
          await loadEstimate();
        }}
      />

      {/* Applied cost factors */}
      {estimate.appliedFactors.length > 0 && (
        <Card>
          <CardHeader title={`Cost factors applied (${estimate.appliedFactors.length})`} />
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {estimate.appliedFactors.map((f) => (
              <span
                key={f.id}
                title={f.autoApplied ? 'Auto-applied' : 'Manually added'}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-sunken px-2 py-1 text-[13.5px]"
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
        </Card>
      )}

      {/* Meta */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetaCard label="Owner" icon={UserIcon}>
          {estimate.owner.name}
          {estimate.receivedFrom && (
            <div className="text-[13.5px] text-fg-subtle">
              Received from {estimate.receivedFrom.name}
            </div>
          )}
        </MetaCard>
        <MetaCard label="Region & config" icon={MapPin}>
          {estimate.region.name} ({estimate.region.stateCode})
          <div className="text-[13.5px] text-fg-subtle">
            {estimate.shopType.replace('_', ' ')} · {estimate.mhRangeMode} range
          </div>
        </MetaCard>
        <MetaCard label="Accepted" icon={Calendar}>
          {estimate.acceptedAt ? new Date(estimate.acceptedAt).toLocaleString() : '—'}
        </MetaCard>
      </div>

      <AiSuggestDialog
        open={!!suggestLine}
        onOpenChange={(v) => !v && setSuggestLine(null)}
        estimateId={estimate.id}
        line={suggestLine}
        onApplied={() => loadEstimate()}
      />
    </div>
  );
}

// ============================================================
// Components
// ============================================================

function SectionGroup({
  section,
  lines,
  totals,
  isCollapsed,
  onToggle,
  onSuggest,
  estimateId,
  onLineSaved,
}: {
  section: string;
  lines: ApiLine[];
  totals: { labor: number; material: number; subtotal: number; mh: number };
  isCollapsed: boolean;
  onToggle: () => void;
  onSuggest: (l: ApiLine) => void;
  estimateId: string;
  onLineSaved: () => Promise<void> | void;
}) {
  return (
    <>
      <tr className="bg-sunken/70">
        <td colSpan={14} className="px-3 py-2">
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center gap-2 text-left text-[13.5px] font-bold uppercase tracking-wide text-fg-default hover:text-blue-400"
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            <span>{section}</span>
            <span className="text-[13.5px] font-normal normal-case text-fg-subtle">
              ({lines.length} line{lines.length === 1 ? '' : 's'})
            </span>
            <span className="ml-auto flex items-center gap-4 text-[13.5px] font-normal normal-case text-fg-muted">
              <span>{totals.mh.toFixed(1)} MH</span>
              <span className="font-mono font-semibold text-fg-default">
                {dollars(totals.subtotal)}
              </span>
            </span>
          </button>
        </td>
      </tr>
      {!isCollapsed &&
        lines.map((l) => (
          <LineRow
            key={l.id}
            line={l}
            estimateId={estimateId}
            onSuggest={() => onSuggest(l)}
            onSaved={onLineSaved}
          />
        ))}
      {!isCollapsed && (
        <tr className="border-t border-border bg-sunken/30">
          <td
            colSpan={6}
            className="px-3 py-1.5 text-right text-[13.5px] font-semibold uppercase tracking-wider text-fg-subtle"
          >
            Subtotal — {section}
          </td>
          <td className="px-3 py-1.5 text-right font-mono text-[13.5px] text-fg-muted">
            {totals.mh.toFixed(1)}
          </td>
          <td className="px-3 py-1.5 text-right font-mono font-semibold text-fg-default">
            {dollars(totals.labor)}
          </td>
          <td className="px-3 py-1.5"></td>
          <td className="px-3 py-1.5 text-right font-mono font-semibold text-fg-default">
            {dollars(totals.material)}
          </td>
          <td className="px-3 py-1.5 text-right font-mono text-[13px] font-bold text-fg-default">
            {dollars(totals.subtotal)}
          </td>
          <td colSpan={2}></td>
        </tr>
      )}
    </>
  );
}

function LineRow({
  line,
  estimateId,
  onSuggest,
  onSaved,
}: {
  line: ApiLine;
  estimateId: string;
  onSuggest: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const matPerUnit = line.materialBreakdown?.[0]?.unitCostCents ?? null;
  const wastePct = line.materialBreakdown?.[0]?.wastePercent ?? null;

  async function patchLine(payload: any) {
    const res = await fetch(`/api/estimates/${estimateId}/lines/${line.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d?.error ?? 'Failed to save');
      return;
    }
    toast.success('Line updated');
    await onSaved();
  }

  return (
    <tr
      className={`border-t border-border hover:bg-sunken/30 ${
        line.needsReview ? 'bg-warn-500/5' : ''
      }`}
    >
      <td className="px-3 py-1.5 font-mono text-[13.5px] text-fg-muted">
        <div className="flex items-center gap-1">
          <SourceDot source={line.source} />
          <span>{line.externalId ?? '—'}</span>
        </div>
      </td>
      <td className="min-w-[260px] max-w-[420px] px-3 py-1.5 text-fg-default">
        <div className="truncate">{line.name}</div>
        {line.productivityEntry && (
          <div className="truncate text-[13.5px] text-fg-subtle">
            ↳ {line.productivityEntry.scopeName}
          </div>
        )}
      </td>
      <td className="px-3 py-1.5 text-fg-muted">
        <div className="truncate">{line.laborTrade?.name ?? '—'}</div>
        <ScopeBadge scope={line.scope} />
      </td>
      <td className="px-3 py-1.5">
        <EditableCell
          value={Number(line.quantity)}
          format={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          step="any"
          onSave={(v) => patchLine({ quantity: v })}
          width="w-24"
          hint="Edit quantity — labor + material recompute"
        />
      </td>
      <td className="px-3 py-1.5 uppercase tracking-wide text-fg-subtle">{line.uom}</td>
      <td className="px-3 py-1.5">
        <EditableCell
          value={line.mhPerUnit !== null ? Number(line.mhPerUnit) : null}
          format={(v) => v.toFixed(3)}
          step="0.0001"
          onSave={(v) => patchLine({ mhPerUnit: v })}
          width="w-20"
          hint="Edit MH/unit — labor recomputes"
        />
      </td>
      <td className="px-3 py-1.5">
        <EditableCell
          value={line.laborRateCents !== null ? line.laborRateCents / 100 : null}
          format={(v) => `$${v.toFixed(0)}`}
          step="0.01"
          onSave={(v) => patchLine({ laborRateCents: Math.round(v * 100) })}
          width="w-20"
          hint="Edit $/hr — labor cost recomputes"
        />
      </td>
      <td className="px-3 py-1.5 text-right font-mono">
        {line.laborHours !== null ? Number(line.laborHours).toFixed(2) : '—'}
      </td>
      <td className="px-3 py-1.5">
        <EditableCell
          value={line.laborCostCents !== null ? line.laborCostCents / 100 : null}
          format={(v) =>
            `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          }
          step="0.01"
          onSave={(v) => patchLine({ laborCostCents: Math.round(v * 100) })}
          width="w-28"
          hint="Override labor cost (locks the row)"
        />
      </td>
      <td className="px-3 py-1.5 text-right font-mono text-fg-muted">
        <EditableCell
          value={matPerUnit !== null ? matPerUnit / 100 : null}
          format={(v) => `$${v.toFixed(2)}`}
          step="0.01"
          onSave={async (v) => {
            // Rebuild the breakdown so BOTH unitCostCents and total agree.
            const w = wastePct ?? 5;
            const qty = Number(line.quantity);
            const wasted = Math.round(qty * (1 + w / 100) * 10000) / 10000;
            const newUnitCents = Math.round(v * 100);
            const newTotalCents = Math.round(wasted * newUnitCents);
            const existing = line.materialBreakdown?.[0];
            await patchLine({
              materialId: null, // clears stale breakdown
              customMaterials: [
                {
                  materialId: existing?.materialId ?? null,
                  name: existing?.name ?? line.name,
                  qty: wasted,
                  uom: existing?.uom ?? line.uom,
                  unitCostCents: newUnitCents,
                  wastePercent: w,
                  subtotalCents: newTotalCents,
                },
              ],
            });
          }}
          width="w-20"
          hint="Edit $/unit — material cost = qty × (1+waste) × $/u"
        />
        {wastePct !== null && wastePct > 0 && (
          <span className="ml-1 text-[10px] text-fg-subtle">+{wastePct}%</span>
        )}
      </td>
      <td className="px-3 py-1.5">
        <EditableCell
          value={line.materialCostCents !== null ? line.materialCostCents / 100 : null}
          format={(v) =>
            `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          }
          step="0.01"
          onSave={async (v) => {
            // Override total. If we have a breakdown, back-derive a new
            // unit cost so the $/u column stays consistent on screen.
            const newTotalCents = Math.round(v * 100);
            const existing = line.materialBreakdown?.[0];
            if (!existing || !existing.qty || existing.qty <= 0) {
              await patchLine({ materialCostCents: newTotalCents });
              return;
            }
            const newUnitCents = Math.round(newTotalCents / existing.qty);
            await patchLine({
              materialId: null,
              customMaterials: [
                {
                  materialId: existing.materialId ?? null,
                  name: existing.name,
                  qty: existing.qty,
                  uom: existing.uom,
                  unitCostCents: newUnitCents,
                  wastePercent: existing.wastePercent,
                  subtotalCents: newTotalCents,
                },
              ],
            });
          }}
          width="w-28"
          hint="Override total material cost — keeps $/u in sync"
        />
      </td>
      <td className="px-3 py-1.5 text-right font-mono font-semibold">
        {dollars(line.subtotalCents)}
      </td>
      <td className="px-3 py-1.5 text-center">
        <ConfidenceBadge confidence={line.aiConfidence} needsReview={line.needsReview} />
      </td>
      <td className="pr-2 text-right">
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onSuggest}
            title="Ask Claude for a better match"
          >
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={async () => {
              if (
                !confirm(
                  `Delete "${line.name}"?\n\nThis removes the line from the estimate (and any AI-derivative children hanging under it).`,
                )
              ) {
                return;
              }
              const res = await fetch(`/api/estimates/${estimateId}/lines/${line.id}`, {
                method: 'DELETE',
              });
              if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                toast.error(d?.error ?? 'Delete failed');
                return;
              }
              toast.success(`Removed "${line.name}"`);
              await onSaved();
            }}
            title="Delete this line"
          >
            <Trash2 className="h-3.5 w-3.5 text-danger-500" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function MarginsEditor({
  estimate,
  totals,
  saving,
  onSave,
}: {
  estimate: ApiEstimate;
  totals: ReturnType<typeof rollupTotals>;
  saving: boolean;
  onSave: (patch: Record<string, number | null>) => Promise<void>;
}) {
  const [gc, setGc] = useState(
    estimate.generalConditionsPercent !== null ? String(estimate.generalConditionsPercent) : '',
  );
  const [oh, setOh] = useState(
    estimate.overheadPercent !== null ? String(estimate.overheadPercent) : '',
  );
  const [profit, setProfit] = useState(
    estimate.markupPercent !== null ? String(estimate.markupPercent) : '',
  );
  const [tax, setTax] = useState(
    estimate.salesTaxPercent !== null ? String(estimate.salesTaxPercent) : '',
  );
  const [envSf, setEnvSf] = useState(
    estimate.totalEnvelopeSf !== null ? String(estimate.totalEnvelopeSf) : '',
  );

  const dirty =
    gc !==
      (estimate.generalConditionsPercent !== null
        ? String(estimate.generalConditionsPercent)
        : '') ||
    oh !== (estimate.overheadPercent !== null ? String(estimate.overheadPercent) : '') ||
    profit !== (estimate.markupPercent !== null ? String(estimate.markupPercent) : '') ||
    tax !== (estimate.salesTaxPercent !== null ? String(estimate.salesTaxPercent) : '') ||
    envSf !== (estimate.totalEnvelopeSf !== null ? String(estimate.totalEnvelopeSf) : '');

  function parseOrNull(v: string): number | null {
    const t = v.trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  // Live preview as the user types — same flat formula as rollupTotals.
  // Uses the current text inputs even before save so Andre sees the dollar
  // impact of changing 15% → 10% immediately.
  const direct = totals.directCostCents;
  const gcPreview = Math.round(direct * ((parseOrNull(gc) ?? 0) / 100));
  const ohPreview = Math.round(direct * ((parseOrNull(oh) ?? 0) / 100));
  const profitPreview = Math.round(direct * ((parseOrNull(profit) ?? 0) / 100));
  const taxBase = direct + gcPreview + ohPreview + profitPreview;
  const taxPreview = Math.round(taxBase * ((parseOrNull(tax) ?? 0) / 100));
  const grandPreview = taxBase + taxPreview;

  const gcDirty =
    gc !==
    (estimate.generalConditionsPercent !== null ? String(estimate.generalConditionsPercent) : '');
  const ohDirty =
    oh !== (estimate.overheadPercent !== null ? String(estimate.overheadPercent) : '');
  const profitDirty =
    profit !== (estimate.markupPercent !== null ? String(estimate.markupPercent) : '');
  const taxDirty =
    tax !== (estimate.salesTaxPercent !== null ? String(estimate.salesTaxPercent) : '');

  function liveHint(
    previewCents: number,
    savedCents: number,
    isDirty: boolean,
    suffix: string,
  ): string {
    if (!isDirty) return `${dollars(previewCents)} ${suffix}`;
    return `${dollars(previewCents)} ${suffix} · saved was ${dollars(savedCents)}`;
  }

  return (
    <Card>
      <CardHeader title="OH&P · margins · envelope" />
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <PctInput
            label="General Conditions"
            value={gc}
            onChange={setGc}
            hint={liveHint(
              gcPreview,
              totals.generalConditionsCents,
              gcDirty,
              `on ${dollars(direct)} direct`,
            )}
          />
          <PctInput
            label="Company Overhead"
            value={oh}
            onChange={setOh}
            hint={liveHint(ohPreview, totals.overheadCents, ohDirty, 'on direct')}
          />
          <PctInput
            label="Profit"
            value={profit}
            onChange={setProfit}
            hint={liveHint(profitPreview, totals.markupCents, profitDirty, 'on direct')}
          />
          <PctInput
            label="Sales Tax (optional)"
            value={tax}
            onChange={setTax}
            hint={
              parseOrNull(tax) === null
                ? 'leave blank to skip'
                : liveHint(
                    taxPreview,
                    totals.salesTaxCents,
                    taxDirty,
                    `on ${dollars(taxBase)} subtotal`,
                  )
            }
          />
        </div>

        {/* Live total preview — visible only when user is mid-edit */}
        {(gcDirty || ohDirty || profitDirty || taxDirty) && (
          <div className="rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-[13.5px]">
            <div className="font-semibold text-blue-300">Preview (not saved yet)</div>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-fg-default md:grid-cols-4">
              <div>
                Direct: <span className="font-mono">{dollars(direct)}</span>
              </div>
              <div>
                OH&P:{' '}
                <span className="font-mono">{dollars(gcPreview + ohPreview + profitPreview)}</span>
              </div>
              <div>
                Tax: <span className="font-mono">{dollars(taxPreview)}</span>
              </div>
              <div className="font-semibold">
                Grand total: <span className="font-mono">{dollars(grandPreview)}</span>
                {totals.totalCents > 0 && grandPreview !== totals.totalCents && (
                  <span className="ml-1 text-fg-subtle">
                    ({grandPreview > totals.totalCents ? '+' : ''}
                    {dollars(grandPreview - totals.totalCents)})
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        {/* OH&P totalization — mirrors the Direct cost summary card on the left.
            Always reflects the current input values, whether saved or being edited. */}
        <ul className="divide-y divide-border border-y border-border bg-sunken/30 text-[13.5px]">
          <li className="flex items-center justify-between px-4 py-2">
            <div className="min-w-0">
              <div className="font-semibold text-fg-default">Direct cost</div>
              <div className="text-[11.5px] text-fg-subtle">labor + material (post factors)</div>
            </div>
            <div className="font-mono font-semibold text-fg-default">{dollars(direct)}</div>
          </li>
          <li className="flex items-center justify-between px-4 py-2">
            <div className="min-w-0">
              <div className="font-semibold text-fg-default">General Conditions</div>
              <div className="text-[11.5px] text-fg-subtle">{parseOrNull(gc) ?? 0}% of direct</div>
            </div>
            <div className="font-mono font-semibold text-fg-default">{dollars(gcPreview)}</div>
          </li>
          <li className="flex items-center justify-between px-4 py-2">
            <div className="min-w-0">
              <div className="font-semibold text-fg-default">Company Overhead</div>
              <div className="text-[11.5px] text-fg-subtle">{parseOrNull(oh) ?? 0}% of direct</div>
            </div>
            <div className="font-mono font-semibold text-fg-default">{dollars(ohPreview)}</div>
          </li>
          <li className="flex items-center justify-between px-4 py-2">
            <div className="min-w-0">
              <div className="font-semibold text-fg-default">Profit</div>
              <div className="text-[11.5px] text-fg-subtle">
                {parseOrNull(profit) ?? 0}% of direct
              </div>
            </div>
            <div className="font-mono font-semibold text-fg-default">{dollars(profitPreview)}</div>
          </li>
          <li className="flex items-center justify-between bg-sunken/60 px-4 py-2">
            <span className="text-[12.5px] font-semibold uppercase tracking-wider text-fg-subtle">
              Total OH&P
            </span>
            <span className="font-mono text-[14px] font-bold text-fg-default">
              {dollars(gcPreview + ohPreview + profitPreview)}
            </span>
          </li>
          {parseOrNull(tax) !== null && (
            <li className="flex items-center justify-between px-4 py-2">
              <div className="min-w-0">
                <div className="font-semibold text-fg-default">Sales Tax</div>
                <div className="text-[11.5px] text-fg-subtle">
                  {parseOrNull(tax) ?? 0}% of direct + OH&P ({dollars(taxBase)})
                </div>
              </div>
              <div className="font-mono font-semibold text-fg-default">{dollars(taxPreview)}</div>
            </li>
          )}
          <li className="flex items-center justify-between border-t-2 border-border bg-sunken px-4 py-2.5">
            <span className="text-[13.5px] font-bold uppercase tracking-wider text-fg-default">
              Grand total
            </span>
            <span className="font-mono text-[16px] font-bold text-fg-default">
              {dollars(grandPreview)}
            </span>
          </li>
        </ul>

        <div className="border-t border-border pt-3">
          <Label htmlFor="envSf" className="text-[13.5px] font-semibold">
            Total envelope SF (for cost-per-SF metric)
          </Label>
          <Input
            id="envSf"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={envSf}
            onChange={(e) => setEnvSf(e.target.value)}
            placeholder="e.g. 136916.05"
            className="mt-1.5 h-8 max-w-[260px]"
            disabled={saving}
          />
        </div>
        <div className="flex items-center justify-end border-t border-border pt-3">
          <Button
            size="sm"
            onClick={() =>
              onSave({
                generalConditionsPercent: parseOrNull(gc),
                overheadPercent: parseOrNull(oh),
                markupPercent: parseOrNull(profit),
                salesTaxPercent: parseOrNull(tax),
                totalEnvelopeSf: parseOrNull(envSf),
              })
            }
            disabled={!dirty || saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" /> Save
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PctInput({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint: string;
}) {
  return (
    <div>
      <Label className="text-[13.5px] font-semibold">{label}</Label>
      <div className="mt-1.5 flex items-center gap-1">
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="h-8 w-24 text-right"
        />
        <span className="text-[13.5px] text-fg-muted">%</span>
      </div>
      <div className="mt-0.5 text-[13.5px] text-fg-subtle">{hint}</div>
    </div>
  );
}

function AssumptionsEditor({
  estimate,
  onSave,
}: {
  estimate: ApiEstimate;
  onSave: (assumptions: string | null) => Promise<void>;
}) {
  const [text, setText] = useState(estimate.assumptions ?? '');
  const [saving, setSaving] = useState(false);
  const dirty = text !== (estimate.assumptions ?? '');

  return (
    <Card>
      <CardHeader title="Notes & assumptions" />
      <div className="space-y-2 p-4">
        <Textarea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`One bullet per line, e.g.:
• Scaffolding/staging included for facade work
• Painting NOT included (Hardie comes pre-finished)
• Z-Girt galvanized steel, 16" OC verified in field`}
          className="resize-y font-mono text-[13.5px]"
        />
        <div className="flex items-center justify-end">
          <Button
            size="sm"
            disabled={!dirty || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(text.trim() || null);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" /> Save
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function SummaryCard({
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
      <div className="text-[13.5px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
        {label}
      </div>
      <div
        className={`mt-0.5 font-mono text-[18px] font-semibold ${
          highlight ? 'text-blue-400' : 'text-fg-default'
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[13.5px] text-fg-subtle">{sub}</div>}
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
      <div className="flex items-center gap-1.5 text-[13.5px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-[13px] text-fg-default">{children}</div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">{children}</div>
  );
}

function CardHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-border bg-sunken/40 px-4 py-2.5">
      <h3 className="text-[13.5px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
        {title}
      </h3>
    </div>
  );
}

/**
 * Tiny colored dot showing how the line came to exist:
 *   togal-id        — emerald (deterministic, ID exact match — strongest)
 *   togal-prefix    — sky (deterministic, name prefix — strong)
 *   ai-classified   — violet (AI classifier had to run)
 *   ai-derivative   — orange (IA-2 hidden cost)
 *   manual          — gray
 *   (null)          — gray dash
 */
function SourceDot({ source }: { source: string | null | undefined }) {
  const map: Record<string, { color: string; label: string }> = {
    'togal-id': { color: 'bg-emerald-400', label: 'Togal ID — deterministic' },
    'togal-prefix': { color: 'bg-sky-400', label: 'Name prefix — deterministic' },
    'ai-classified': { color: 'bg-violet-400', label: 'AI classifier (fuzzy)' },
    'ai-derivative': { color: 'bg-orange-400', label: 'IA-2 derivative (hidden cost)' },
    manual: { color: 'bg-fg-subtle', label: 'Manual entry' },
  };
  const meta = source ? map[source] : null;
  if (!meta) {
    return (
      <span className="h-2 w-2 shrink-0 rounded-full bg-fg-subtle/30" title="Source unknown" />
    );
  }
  return <span className={`h-2 w-2 shrink-0 rounded-full ${meta.color}`} title={meta.label} />;
}

function ScopeBadge({ scope }: { scope: string }) {
  const s = scope as ClassificationScope;
  const label = CLASSIFICATION_SCOPE_BADGE[s] ?? '?';
  const full = CLASSIFICATION_SCOPE_LABELS[s] ?? scope;
  const color = s === 'service' ? 'bg-warn-500/15 text-warn-500' : 'bg-blue-500/15 text-blue-400';
  return (
    <span
      title={full}
      className={`mt-0.5 inline-flex rounded px-1 py-[1px] font-mono text-[9px] font-bold ${color}`}
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
