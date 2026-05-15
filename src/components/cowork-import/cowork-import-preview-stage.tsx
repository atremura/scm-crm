'use client';

import { Loader2, AlertTriangle, CheckCircle2, Info, FileJson } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * Summary payload returned by POST /import-cowork on success.
 *
 * Field shapes mirror the buildSummary() function in import-service.ts —
 * any change there must be reflected here.
 */
export type PreviewSummary = {
  projectName: string;
  estimateType: string;
  scopeItemsCount: number;
  takeoffItemsCount: number;
  materialsCount: number;
  laborProductivityCount: number;
  scenariosCount: number;
  recommendedScenarioCode: string;
  totalBidPrice: number;
};

/**
 * Subset of the Cowork payload that the preview tabs need to render.
 *
 * Intentionally decoupled from CoworkImportV1 Zod schema — this type
 * describes what the UI needs, not the full payload contract.
 */
export type CoworkPayloadPreview = {
  scope_items: Array<{
    service_code: string;
    description: string;
    category?: string;
    type?: string;
    status?: string;
    allowance_amount?: number;
    notes?: string | null;
  }>;
  takeoff_items: Array<{
    takeoff_id: string;
    service_code: string;
    description?: string;
    quantity: number;
    unit: string;
    waste_pct?: number;
  }>;
  materials: Array<{
    material_id?: string;
    service_code: string;
    description: string;
    qty: number;
    unit: string;
    unit_cost: number;
    total?: number;
  }>;
  labor_productivity: Array<{
    service_code: string;
    activity?: string;
    mh_per_unit?: number;
    total_mh?: number;
    crew_size?: number;
  }>;
  labor_rates?: Array<{
    trade_code: string;
    base_hr?: number;
    billed_hr: number;
  }>;
  scenarios: Array<{
    scenario_code: string;
    label?: string;
    total_bid?: number;
    markups?: {
      profit_pct?: number;
      overhead_pct?: number;
      general_conditions_pct?: number;
      contingency_pct?: number;
    };
  }>;
};

/**
 * Warning or blocker detail from the integrity rules engine.
 * Both share the same shape; severity discriminates them.
 */
export type IntegrityFlag = {
  rule: string;
  severity: 'BLOCKER' | 'REVIEW' | 'INFO';
  message: string;
  context?: Record<string, unknown>;
};

type Props = {
  /**
   * Visible name of the uploaded file (e.g. "avalon_jmo.json").
   */
  fileName: string;
  /**
   * Status of the EstimateImport in the DB:
   *   - 'previewed' (happy path — apply available)
   *   - 'failed'    (blocker path — only reject available)
   *   - 'applied'   (read-only history view; audit timestamp shown)
   *   - 'rejected'  (read-only history view; rejection reason shown)
   */
  status: 'previewed' | 'failed' | 'applied' | 'rejected';
  /**
   * For applied imports: timestamp of when apply was confirmed.
   * Rendered as a human-readable date.
   */
  appliedAt?: string | null;
  /**
   * For rejected imports: the reason given at rejection time.
   * Rendered prominently for audit context.
   */
  rejectionReason?: string | null;
  /**
   * Summary block returned by the preview endpoint. Required for
   * 'previewed' status; optional for 'failed' (server may have failed
   * before computing summary).
   */
  summary?: PreviewSummary;
  /**
   * Non-blocking warnings (REVIEW + INFO severity). Always present even
   * if empty.
   */
  warnings: IntegrityFlag[];
  /**
   * Blocking violations (BLOCKER severity). Only populated when status
   * is 'failed'.
   */
  blockers?: IntegrityFlag[];
  /**
   * Full payload from GET /import-cowork/[importId]. When provided,
   * the component renders tabs with detailed scope/takeoff/material
   * tables. When absent, only summary + warnings are shown (used
   * for the initial preview response which doesn't include payload).
   */
  payload?: CoworkPayloadPreview;
  /**
   * Called when user clicks "Apply". Parent makes the POST /apply call
   * and handles success navigation. Only available for status='previewed'.
   */
  onApplyRequested: () => void;
  /**
   * Called when user clicks "Reject". Parent transitions to reject stage.
   */
  onRejectRequested: () => void;
  /**
   * Called when user wants to go back / change file. Optional.
   */
  onBack?: () => void;
  /**
   * True while parent is processing the apply request — disables buttons.
   */
  isApplying?: boolean;
};

function getStatusBadge(status: Props['status']) {
  switch (status) {
    case 'previewed':
      return {
        label: 'Ready to apply',
        className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
      };
    case 'failed':
      return {
        label: 'Blocked',
        className: 'bg-red-500/15 text-red-600 border-red-500/30',
      };
    case 'applied':
      return {
        label: 'Applied',
        className: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
      };
    case 'rejected':
      return {
        label: 'Rejected',
        className: 'bg-slate-500/15 text-slate-600 border-slate-500/30',
      };
  }
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Visual style for a severity-tagged badge.
 */
const SEVERITY_STYLES: Record<
  IntegrityFlag['severity'],
  { label: string; icon: typeof Info; className: string }
> = {
  BLOCKER: {
    label: 'Blocker',
    icon: AlertTriangle,
    className: 'bg-red-500/15 text-red-600 border-red-500/30',
  },
  REVIEW: {
    label: 'Review',
    icon: AlertTriangle,
    className: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  },
  INFO: {
    label: 'Info',
    icon: Info,
    className: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  },
};

function FlagRow({ flag }: { flag: IntegrityFlag }) {
  const style = SEVERITY_STYLES[flag.severity];
  const Icon = style.icon;
  return (
    <div className="flex items-start gap-3 rounded-md border border-border/60 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={style.className}>
            {style.label}
          </Badge>
          <code className="text-xs text-muted-foreground">{flag.rule}</code>
        </div>
        <p className="text-sm">{flag.message}</p>
      </div>
    </div>
  );
}

export function CoworkImportPreviewStage({
  fileName,
  status,
  summary,
  warnings,
  blockers,
  payload,
  appliedAt,
  rejectionReason,
  onApplyRequested,
  onRejectRequested,
  onBack,
  isApplying = false,
}: Props) {
  const isBlocked = status === 'failed';
  const isReadOnly = status === 'applied' || status === 'rejected';
  const hasBlockers = blockers && blockers.length > 0;
  const hasWarnings = warnings.length > 0;
  const statusBadge = getStatusBadge(status);

  return (
    <div className="space-y-5">
      {/* Header: file name + status */}
      <div
        className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-3"
        data-testid="preview-header"
      >
        <FileJson className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fileName}</p>
        </div>
        <Badge variant="outline" className={statusBadge.className}>
          {statusBadge.label}
        </Badge>
      </div>

      {/* Audit info — only for applied/rejected (read-only) statuses */}
      {(status === 'applied' || status === 'rejected') && (
        <div
          className="rounded-md border border-border/60 bg-muted/30 px-3 py-3 space-y-1"
          data-testid="audit-info"
        >
          {status === 'applied' && appliedAt && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Applied</span> on{' '}
              {new Date(appliedAt).toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
              .
            </p>
          )}
          {status === 'rejected' && rejectionReason && (
            <div>
              <p className="text-xs font-medium text-foreground">Rejection reason:</p>
              <p className="text-sm mt-0.5">{rejectionReason}</p>
            </div>
          )}
        </div>
      )}

      {/* Summary card — only if summary was computed */}
      {summary && (
        <Card className="p-4 space-y-3" data-testid="preview-summary">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Project from Cowork
              </p>
              <p className="text-base font-medium mt-1">{summary.projectName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {summary.estimateType} · recommended scenario{' '}
                <span className="font-mono">{summary.recommendedScenarioCode}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total bid</p>
              <p className="text-xl font-semibold mt-1">{formatUsd(summary.totalBidPrice)}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border/60">
            <SummaryStat label="Scope items" value={summary.scopeItemsCount} />
            <SummaryStat label="Takeoffs" value={summary.takeoffItemsCount} />
            <SummaryStat label="Materials" value={summary.materialsCount} />
            <SummaryStat label="Productivity rows" value={summary.laborProductivityCount} />
            <SummaryStat label="Scenarios" value={summary.scenariosCount} />
          </div>
        </Card>
      )}

      {/* Blockers section — only inline when no payload (Stage 1 upload).
          When payload is present, blockers live inside the Issues tab. */}
      {!payload && hasBlockers && (
        <div className="space-y-2" data-testid="preview-blockers">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <h3 className="text-sm font-medium">Blockers ({blockers!.length})</h3>
          </div>
          <div className="space-y-2">
            {blockers!.map((b, i) => (
              <FlagRow key={i} flag={b} />
            ))}
          </div>
        </div>
      )}

      {/* Warnings section — same rule: only inline when no payload. */}
      {!payload && hasWarnings && (
        <div className="space-y-2" data-testid="preview-warnings">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Warnings ({warnings.length})</h3>
          </div>
          <div className="space-y-2">
            {warnings.map((w, i) => (
              <FlagRow key={i} flag={w} />
            ))}
          </div>
        </div>
      )}

      {/* Healthy state — no warnings, status=previewed.
          Hidden when payload is present (Issues tab shows the same info)
          or when status is read-only (audit info shows above). */}
      {!payload && !isBlocked && !isReadOnly && !hasWarnings && (
        <div className="flex items-center gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <p className="text-sm text-muted-foreground">
            No warnings or blockers. Import is ready to apply.
          </p>
        </div>
      )}

      {/* Detail tabs — only when full payload available */}
      {payload && (
        <Tabs defaultValue="scope" className="space-y-3" data-testid="preview-tabs">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="scope">Scope ({payload.scope_items.length})</TabsTrigger>
            <TabsTrigger value="takeoffs">Takeoffs ({payload.takeoff_items.length})</TabsTrigger>
            <TabsTrigger value="materials">Materials ({payload.materials.length})</TabsTrigger>
            <TabsTrigger value="labor">Labor ({payload.labor_productivity.length})</TabsTrigger>
            <TabsTrigger value="scenarios">Scenarios ({payload.scenarios.length})</TabsTrigger>
            <TabsTrigger value="issues">
              Issues ({warnings.length + (blockers?.length ?? 0)})
            </TabsTrigger>
          </TabsList>

          {/* Scope */}
          <TabsContent value="scope">
            <ScopeTable rows={payload.scope_items} />
          </TabsContent>

          {/* Takeoffs */}
          <TabsContent value="takeoffs">
            <TakeoffsTable rows={payload.takeoff_items} />
          </TabsContent>

          {/* Materials */}
          <TabsContent value="materials">
            <MaterialsTable rows={payload.materials} />
          </TabsContent>

          {/* Labor */}
          <TabsContent value="labor">
            <LaborTable
              productivity={payload.labor_productivity}
              rates={payload.labor_rates ?? []}
            />
          </TabsContent>

          {/* Scenarios */}
          <TabsContent value="scenarios">
            <ScenariosTable rows={payload.scenarios} />
          </TabsContent>

          {/* Issues — combines warnings + blockers in one view */}
          <TabsContent value="issues">
            <IssuesPanel warnings={warnings} blockers={blockers ?? []} />
          </TabsContent>
        </Tabs>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pt-2">
        <div>
          {onBack && (
            <Button variant="ghost" onClick={onBack} disabled={isApplying}>
              Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(status === 'previewed' || status === 'failed') && (
            <Button variant="outline" onClick={onRejectRequested} disabled={isApplying}>
              Reject
            </Button>
          )}
          {status === 'previewed' && (
            <Button onClick={onApplyRequested} disabled={isApplying} data-testid="apply-button">
              {isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply to project
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  );
}

function EmptyTableState({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-border/60 py-8 px-3 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function formatNumber(n: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

function formatPct(decimal: number | undefined): string {
  if (decimal === undefined || decimal === null) return '—';
  return `${(decimal * 100).toFixed(1)}%`;
}

function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null) return '—';
  return formatUsd(amount);
}

type ScopeRow = CoworkPayloadPreview['scope_items'][number];
function ScopeTable({ rows }: { rows: ScopeRow[] }) {
  if (rows.length === 0) return <EmptyTableState label="No scope items in this import." />;

  return (
    <div className="rounded-md border border-border/60 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Code</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-[100px]">Type</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="text-right w-[100px]">Allowance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.service_code}>
              <TableCell className="font-mono text-xs">{r.service_code}</TableCell>
              <TableCell className="text-sm">{r.description}</TableCell>
              <TableCell className="text-xs">{r.type ?? '—'}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{r.status ?? '—'}</TableCell>
              <TableCell className="text-right text-sm">
                {r.allowance_amount ? formatCurrency(r.allowance_amount) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type TakeoffRow = CoworkPayloadPreview['takeoff_items'][number];
function TakeoffsTable({ rows }: { rows: TakeoffRow[] }) {
  if (rows.length === 0) return <EmptyTableState label="No takeoffs in this import." />;

  return (
    <div className="rounded-md border border-border/60 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Takeoff ID</TableHead>
            <TableHead className="w-[80px]">Code</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right w-[100px]">Qty</TableHead>
            <TableHead className="w-[60px]">Unit</TableHead>
            <TableHead className="text-right w-[80px]">Waste</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.takeoff_id}>
              <TableCell className="font-mono text-xs">{r.takeoff_id}</TableCell>
              <TableCell className="font-mono text-xs">{r.service_code}</TableCell>
              <TableCell className="text-sm">{r.description ?? '—'}</TableCell>
              <TableCell className="text-right text-sm">{formatNumber(r.quantity)}</TableCell>
              <TableCell className="text-xs">{r.unit}</TableCell>
              <TableCell className="text-right text-xs">{formatPct(r.waste_pct)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type MaterialRow = CoworkPayloadPreview['materials'][number];
function MaterialsTable({ rows }: { rows: MaterialRow[] }) {
  if (rows.length === 0) return <EmptyTableState label="No materials in this import." />;

  return (
    <div className="rounded-md border border-border/60 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Code</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right w-[100px]">Qty</TableHead>
            <TableHead className="w-[60px]">Unit</TableHead>
            <TableHead className="text-right w-[100px]">Unit cost</TableHead>
            <TableHead className="text-right w-[110px]">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.material_id ?? `${r.service_code}-${i}`}>
              <TableCell className="font-mono text-xs">{r.service_code}</TableCell>
              <TableCell className="text-sm">{r.description}</TableCell>
              <TableCell className="text-right text-sm">{formatNumber(r.qty, 2)}</TableCell>
              <TableCell className="text-xs">{r.unit}</TableCell>
              <TableCell className="text-right text-sm">{formatCurrency(r.unit_cost)}</TableCell>
              <TableCell className="text-right text-sm font-medium">
                {formatCurrency(r.total ?? r.qty * r.unit_cost)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type ProductivityRow = CoworkPayloadPreview['labor_productivity'][number];
type RateRow = NonNullable<CoworkPayloadPreview['labor_rates']>[number];
function LaborTable({
  productivity,
  rates,
}: {
  productivity: ProductivityRow[];
  rates: RateRow[];
}) {
  const showProductivity = productivity.length > 0;
  const showRates = rates.length > 0;

  if (!showProductivity && !showRates)
    return <EmptyTableState label="No labor data in this import." />;

  return (
    <div className="space-y-3">
      {showProductivity && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Productivity</p>
          <div className="rounded-md border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Code</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead className="text-right w-[100px]">MH/unit</TableHead>
                  <TableHead className="text-right w-[100px]">Total MH</TableHead>
                  <TableHead className="text-right w-[80px]">Crew</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productivity.map((r, i) => (
                  <TableRow key={`${r.service_code}-${i}`}>
                    <TableCell className="font-mono text-xs">{r.service_code}</TableCell>
                    <TableCell className="text-sm">{r.activity ?? '—'}</TableCell>
                    <TableCell className="text-right text-sm">
                      {r.mh_per_unit !== undefined ? formatNumber(r.mh_per_unit, 3) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {r.total_mh !== undefined ? formatNumber(r.total_mh, 1) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-xs">{r.crew_size ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {showRates && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Labor rates</p>
          <div className="rounded-md border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Trade code</TableHead>
                  <TableHead className="text-right w-[120px]">Base $/hr</TableHead>
                  <TableHead className="text-right w-[120px]">Billed $/hr</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((r) => (
                  <TableRow key={r.trade_code}>
                    <TableCell className="font-mono text-xs">{r.trade_code}</TableCell>
                    <TableCell className="text-right text-sm">
                      {r.base_hr !== undefined ? formatCurrency(r.base_hr) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(r.billed_hr)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

type ScenarioRow = CoworkPayloadPreview['scenarios'][number];
function ScenariosTable({ rows }: { rows: ScenarioRow[] }) {
  if (rows.length === 0) return <EmptyTableState label="No scenarios in this import." />;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {rows.map((s) => (
        <div key={s.scenario_code} className="rounded-md border border-border/60 p-3 space-y-2">
          <div>
            <p className="text-xs font-mono text-muted-foreground">{s.scenario_code}</p>
            <p className="text-sm font-medium mt-0.5">{s.label ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total bid</p>
            <p className="text-base font-semibold">{formatCurrency(s.total_bid)}</p>
          </div>
          {s.markups && (
            <div className="space-y-1 text-xs pt-2 border-t border-border/60">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Profit</span>
                <span>{formatPct(s.markups.profit_pct)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Overhead</span>
                <span>{formatPct(s.markups.overhead_pct)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GC</span>
                <span>{formatPct(s.markups.general_conditions_pct)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contingency</span>
                <span>{formatPct(s.markups.contingency_pct)}</span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function IssuesPanel({
  warnings,
  blockers,
}: {
  warnings: IntegrityFlag[];
  blockers: IntegrityFlag[];
}) {
  const total = warnings.length + blockers.length;
  if (total === 0) return <EmptyTableState label="No warnings or blockers — all checks passed." />;

  return (
    <div className="space-y-2">
      {blockers.map((b, i) => (
        <FlagRow key={`b-${i}`} flag={b} />
      ))}
      {warnings.map((w, i) => (
        <FlagRow key={`w-${i}`} flag={w} />
      ))}
    </div>
  );
}
