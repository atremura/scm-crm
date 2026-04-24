'use client';

import { useEffect, useState } from 'react';
import {
  Sparkles,
  Loader2,
  Check,
  AlertTriangle,
  ArrowRight,
  X,
} from 'lucide-react';
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

type LineSnapshot = {
  id: string;
  name: string;
  externalId: string | null;
  scope: string;
  uom: string;
  quantity: number | string;
  productivityEntry: { id: string; scopeName: string } | null;
  laborCostCents: number | null;
  materialCostCents: number | null;
  subtotalCents: number | null;
};

type Suggestion = {
  productivityId: string | null;
  productivityReason: string;
  materialId: string | null;
  materialReason: string;
  customMaterials: Array<{
    name: string;
    qty: number;
    uom: string;
    estimatedUnitCostCents: number;
    wastePercent: number;
    note?: string;
  }>;
  confidence: number;
  needsHumanReview: boolean;
  warnings: string[];
};

type SuggestResponse = {
  suggestion: Suggestion;
  pickedProductivity: {
    id: string;
    scopeName: string;
    uom: string;
    divisionName: string;
    mhPerUnitAvg: number | string;
  } | null;
  pickedMaterial: {
    id: string;
    name: string;
    uom: string;
    avgCents: number;
    wastePercent: number;
  } | null;
  cost: {
    cents: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
  };
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  estimateId: string;
  line: LineSnapshot | null;
  onApplied: () => void;
};

function dollars(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function AiSuggestDialog({ open, onOpenChange, estimateId, line, onApplied }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SuggestResponse | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !line) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    fetch(`/api/estimates/${estimateId}/lines/${line.id}/suggest`, {
      method: 'POST',
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setError(d?.error ?? 'AI request failed');
          setData(null);
          return;
        }
        setData(d as SuggestResponse);
      })
      .catch((e) => setError(e?.message ?? 'Request failed'))
      .finally(() => setLoading(false));
  }, [open, line, estimateId]);

  async function applySuggestion() {
    if (!data || !line) return;
    setApplying(true);
    try {
      const body: any = {
        productivityEntryId: data.suggestion.productivityId,
        materialId: data.suggestion.materialId,
        suggestedByAi: true,
        aiConfidence: data.suggestion.confidence,
        needsReview: data.suggestion.needsHumanReview,
        notes: [data.suggestion.productivityReason, data.suggestion.materialReason]
          .filter(Boolean)
          .join(' · '),
      };
      if (data.suggestion.customMaterials.length > 0) {
        body.customMaterials = data.suggestion.customMaterials.map((c) => ({
          name: c.name,
          qty: c.qty,
          uom: c.uom,
          unitCostCents: c.estimatedUnitCostCents,
          wastePercent: c.wastePercent,
          subtotalCents: Math.round(c.qty * c.estimatedUnitCostCents),
          materialId: null,
        }));
      }
      const res = await fetch(`/api/estimates/${estimateId}/lines/${line.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? 'Failed to apply');
        return;
      }
      toast.success("Applied Claude's suggestion");
      onApplied();
      onOpenChange(false);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[760px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-400" />
            AI suggestion
          </DialogTitle>
          <DialogDescription>
            Claude reads the line in the project context, picks from your
            productivity + materials catalog, and proposes a price.
          </DialogDescription>
        </DialogHeader>

        {line && (
          <div className="rounded-md border border-border bg-sunken/40 px-3 py-2 text-[12.5px]">
            <div className="font-semibold text-fg-default">{line.name}</div>
            <div className="text-[11.5px] text-fg-subtle">
              {line.externalId ? `${line.externalId} · ` : ''}
              {Number(line.quantity).toLocaleString()} {line.uom} · {line.scope}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-fg-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[13px]">Asking Claude…</span>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-danger-500/30 bg-danger-500/10 p-3 text-[12.5px] text-danger-500">
            {error}
          </div>
        )}

        {data && line && (
          <div className="space-y-3 text-[12.5px]">
            {/* Confidence */}
            <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-fg-muted">Confidence</span>
                <span
                  className={`rounded px-1.5 py-[1px] font-mono text-[11px] font-bold ${
                    data.suggestion.confidence >= 80
                      ? 'bg-success-500/15 text-success-500'
                      : data.suggestion.confidence >= 60
                        ? 'bg-blue-500/15 text-blue-400'
                        : 'bg-warn-500/15 text-warn-500'
                  }`}
                >
                  {data.suggestion.confidence}
                </span>
                {data.suggestion.needsHumanReview && (
                  <span className="inline-flex items-center gap-1 text-warn-500">
                    <AlertTriangle className="h-3 w-3" />
                    Needs review
                  </span>
                )}
              </div>
              <div className="font-mono text-[11px] text-fg-subtle">
                Cost: ${(data.cost.cents / 100).toFixed(4)}
              </div>
            </div>

            {/* Productivity diff */}
            <DiffBlock
              label="Productivity"
              before={
                line.productivityEntry?.scopeName ?? <em className="text-fg-subtle">none</em>
              }
              after={
                data.pickedProductivity ? (
                  <>
                    {data.pickedProductivity.scopeName}
                    <span className="ml-1 text-[11px] text-fg-subtle">
                      ({data.pickedProductivity.divisionName} · MH/u{' '}
                      {Number(data.pickedProductivity.mhPerUnitAvg).toFixed(3)})
                    </span>
                  </>
                ) : (
                  <em className="text-fg-subtle">no productivity match</em>
                )
              }
              reason={data.suggestion.productivityReason}
            />

            {/* Material diff */}
            {line.scope === 'service_and_material' && (
              <DiffBlock
                label="Material"
                before={dollars(line.materialCostCents)}
                after={
                  data.pickedMaterial ? (
                    <>
                      {data.pickedMaterial.name}
                      <span className="ml-1 text-[11px] text-fg-subtle">
                        ($
                        {(data.pickedMaterial.avgCents / 100).toFixed(2)}/{data.pickedMaterial.uom},
                        waste {data.pickedMaterial.wastePercent}%)
                      </span>
                    </>
                  ) : data.suggestion.customMaterials.length > 0 ? (
                    <span>
                      {data.suggestion.customMaterials.length} custom item
                      {data.suggestion.customMaterials.length === 1 ? '' : 's'}
                    </span>
                  ) : (
                    <em className="text-fg-subtle">none</em>
                  )
                }
                reason={data.suggestion.materialReason}
              />
            )}

            {/* Custom materials Claude proposed */}
            {data.suggestion.customMaterials.length > 0 && (
              <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-400">
                  Claude added custom material{data.suggestion.customMaterials.length === 1 ? '' : 's'} (not in catalog)
                </div>
                <ul className="space-y-1">
                  {data.suggestion.customMaterials.map((c, i) => (
                    <li key={i} className="text-[12px]">
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-fg-subtle">
                        {' '}
                        — {c.qty} {c.uom} @ ${(c.estimatedUnitCostCents / 100).toFixed(2)} (waste{' '}
                        {c.wastePercent}%) ={' '}
                        <span className="font-mono">
                          ${((c.qty * c.estimatedUnitCostCents) / 100).toFixed(2)}
                        </span>
                      </span>
                      {c.note && (
                        <div className="text-[11px] text-fg-subtle">{c.note}</div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {data.suggestion.warnings.length > 0 && (
              <div className="rounded-md border border-warn-500/30 bg-warn-500/10 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-warn-500">
                  <AlertTriangle className="h-3 w-3" />
                  Watch out
                </div>
                <ul className="list-disc space-y-0.5 pl-4 text-[11.5px] text-fg-default">
                  {data.suggestion.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={applying}
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button
            onClick={applySuggestion}
            disabled={!data || applying || loading}
          >
            {applying ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Applying…
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                Apply suggestion
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiffBlock({
  label,
  before,
  after,
  reason,
}: {
  label: string;
  before: React.ReactNode;
  after: React.ReactNode;
  reason: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
        {label}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="min-w-0 truncate text-fg-muted line-through decoration-fg-subtle/30">
          {before}
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-blue-400" />
        <div className="min-w-0 truncate text-fg-default">{after}</div>
      </div>
      <div className="mt-1 text-[11.5px] italic text-fg-subtle">{reason}</div>
    </div>
  );
}
