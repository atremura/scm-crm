'use client';

import { useState } from 'react';
import {
  Building2,
  Clock,
  Loader2,
  Sparkles,
  Snowflake,
  ScrollText,
  Construction,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { ProjectContextHints } from '@/lib/project-context-hints';

export type SiteConditions = {
  urban?: boolean;
  lotTight?: boolean;
  prevailingWage?: boolean;
  hvhz?: boolean;
  publicRow?: boolean;
  occupied?: boolean;
};

export type RequiredEquipment = {
  type: string;
  weeksFrom: number | null;
  weeksTo: number | null;
  qtyMin?: number;
  justification: string;
};

export type ProjectContextProps = {
  estimateId: string;
  project: {
    name: string;
    contextHints: ProjectContextHints | null;
  };
  onRefreshed: () => void;
};

const SITE_CONDITION_LABELS: Record<keyof SiteConditions, string> = {
  urban: 'Urban site',
  lotTight: 'Tight lot',
  prevailingWage: 'Prevailing wage',
  hvhz: 'HVHZ (FL)',
  publicRow: 'Public ROW',
  occupied: 'Occupied building',
};

/**
 * IA-1 — Project Context card.
 *
 * Always rendered at the top of the Estimate page. When IA-1 hasn't run
 * yet, shows a Run button + empty state. After the run, shows the
 * inferred values: stories / duration / site conditions / equipment /
 * winter risk / permits. Andre edits via the Project page (this card
 * is read-only display + a re-run trigger).
 */
export function ProjectContextCard({ estimateId, project, onRefreshed }: ProjectContextProps) {
  const [running, setRunning] = useState(false);

  const hints = project.contextHints;
  // contextHints is the signal that IA-1 (or Cowork importer) populated the
  // project. Empty object {} still counts as "ran" but with no findings.
  const hasRun = hints !== null;
  const conditions = (hints?.siteConditions ?? {}) as SiteConditions;
  const equipment = hints?.requiredEquipment ?? [];
  const permits = hints?.permitChecklist ?? [];

  const activeConditions = (
    Object.keys(SITE_CONDITION_LABELS) as Array<keyof SiteConditions>
  ).filter((k) => conditions[k]);

  async function runContext() {
    setRunning(true);
    try {
      const res = await fetch(`/api/estimates/${estimateId}/run-project-context`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'AI context failed');
        return;
      }
      const cents = data.costCents ?? 0;
      toast.success(
        `Project context updated · $${(cents / 100).toFixed(3)} (${data.tokens.input + data.tokens.output} tok)`,
      );
      onRefreshed();
    } catch (err: any) {
      toast.error(err?.message ?? 'AI context failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-canvas">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-fg-subtle" />
          <h3 className="text-[13px] font-semibold text-fg-default">Project context</h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={runContext}
          disabled={running}
          title="Re-analyze the project with IA-1"
        >
          {running ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" /> {hasRun ? 'Re-run' : 'Run'} IA-1
            </>
          )}
        </Button>
      </header>

      {!hasRun ? (
        <div className="px-4 py-4 text-[12.5px] text-fg-muted">
          IA-1 reads the project metadata + takeoff summary and infers stories, duration, equipment
          needs, site conditions, winter risk, and proposal assumptions. Click <b>Run IA-1</b> to
          populate.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 px-4 py-3 text-[12px] md:grid-cols-3">
          {/* Column 1 — Building basics */}
          <div className="space-y-2">
            <Stat label="Stories" value={hints?.stories?.toString() ?? '—'} icon={Building2} />
            <Stat
              label="Duration"
              value={hints?.durationWeeks ? `${hints.durationWeeks} wk` : '—'}
              icon={Clock}
            />
            <Stat
              label="Winter risk"
              value={hints?.winterRisk ? 'Yes' : 'No'}
              icon={Snowflake}
              tone={hints?.winterRisk ? 'warn' : 'muted'}
            />
          </div>

          {/* Column 2 — Site conditions + permits */}
          <div className="space-y-2">
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle">
                Site conditions
              </div>
              {activeConditions.length === 0 ? (
                <div className="mt-1 text-fg-muted">None flagged</div>
              ) : (
                <div className="mt-1 flex flex-wrap gap-1">
                  {activeConditions.map((k) => (
                    <span
                      key={k}
                      className="rounded bg-warn-500/15 px-1.5 py-0.5 text-[10.5px] font-medium text-warn-500"
                    >
                      {SITE_CONDITION_LABELS[k]}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle">
                Permits
              </div>
              {permits.length === 0 ? (
                <div className="mt-1 text-fg-muted">None listed</div>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {permits.map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-fg-default">
                      <ScrollText className="mt-0.5 h-3 w-3 shrink-0 text-fg-subtle" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Column 3 — Equipment */}
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle">
              Required equipment
            </div>
            {equipment.length === 0 ? (
              <div className="mt-1 text-fg-muted">None — interior or single-story</div>
            ) : (
              <ul className="mt-1 space-y-1.5">
                {equipment.map((e, i) => (
                  <li key={i} className="rounded border border-border bg-sunken/40 p-1.5">
                    <div className="flex items-start gap-1.5">
                      <Construction className="mt-0.5 h-3 w-3 shrink-0 text-fg-subtle" />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-fg-default">{e.type}</div>
                        <div className="text-[10.5px] text-fg-muted">
                          {e.weeksFrom !== null && e.weeksTo !== null ? (
                            <>
                              wk {e.weeksFrom}–{e.weeksTo}
                              {e.qtyMin && e.qtyMin > 1 ? ` · ${e.qtyMin}× min` : ''}
                            </>
                          ) : (
                            <>{e.qtyMin && e.qtyMin > 1 ? `${e.qtyMin}× min` : 'schedule TBD'}</>
                          )}
                        </div>
                        <div className="mt-0.5 text-[10.5px] italic text-fg-subtle">
                          {e.justification}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  icon: typeof Building2;
  tone?: 'default' | 'muted' | 'warn';
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-3.5 w-3.5 ${tone === 'warn' ? 'text-warn-500' : 'text-fg-subtle'}`} />
      <div className="min-w-0">
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle">
          {label}
        </div>
        <div
          className={`font-medium ${
            tone === 'warn'
              ? 'text-warn-500'
              : tone === 'muted'
                ? 'text-fg-muted'
                : 'text-fg-default'
          }`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
