'use client';

import { useState } from 'react';
import { Loader2, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

type Props = {
  estimateId: string;
  ia1RunAt: string | null;
  ia2RunAt: string | null;
  ia2DerivativeLineCount: number;
  ia2NewRulesCount: number;
  onRefreshed: () => Promise<void> | void;
};

/**
 * Master "AI passes" banner — exposes IA-1 (Project Context) and IA-2
 * (Hidden Cost Detector) as independent buttons plus a "Run all" combo
 * that fires them in sequence. Status pills show last-run timestamps.
 *
 * IA-3 (Schedule + Histogram) and IA-4 (Equipment Scheduler) are
 * placeholder buttons for now — they'll wire up in a later session.
 */
export function AiPassesBar({
  estimateId,
  ia1RunAt,
  ia2RunAt,
  ia2DerivativeLineCount,
  ia2NewRulesCount,
  onRefreshed,
}: Props) {
  const [running, setRunning] = useState<'ia1' | 'ia2' | 'all' | null>(null);

  async function runIa1() {
    setRunning('ia1');
    try {
      const res = await fetch(`/api/estimates/${estimateId}/run-project-context`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'IA-1 failed');
        return false;
      }
      toast.success(
        `IA-1 done · ${data.context.requiredEquipment?.length ?? 0} equip · $${(data.costCents / 100).toFixed(3)}`
      );
      await onRefreshed();
      return true;
    } catch (err: any) {
      toast.error(err?.message ?? 'IA-1 failed');
      return false;
    } finally {
      setRunning(null);
    }
  }

  async function runIa2() {
    setRunning('ia2');
    try {
      const res = await fetch(`/api/estimates/${estimateId}/detect-hidden-costs`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'IA-2 failed');
        return false;
      }
      toast.success(
        `IA-2 done · ${data.engineProposalsAdded + data.aiDerivativeLinesAdded} lines · ${data.aiNewRulesQueued} rule proposals · $${(data.costCents / 100).toFixed(3)}`
      );
      await onRefreshed();
      return true;
    } catch (err: any) {
      toast.error(err?.message ?? 'IA-2 failed');
      return false;
    } finally {
      setRunning(null);
    }
  }

  async function runAll() {
    setRunning('all');
    try {
      // IA-1 first — IA-2 reads stories + durationWeeks for fixed_per_week rules
      const ok1 = await runIa1();
      if (!ok1) return;
      await runIa2();
    } finally {
      setRunning(null);
    }
  }

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-2.5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-blue-300">
        <Sparkles className="h-3.5 w-3.5" />
        AI synthesis passes
      </div>

      <Pill
        label="IA-1 Project Context"
        ranAt={ia1RunAt}
        running={running === 'ia1'}
        onClick={runIa1}
        disabled={running !== null && running !== 'ia1'}
      />
      <Pill
        label={`IA-2 Hidden Costs${
          ia2RunAt
            ? ` · ${ia2DerivativeLineCount} lines · ${ia2NewRulesCount} rule${ia2NewRulesCount === 1 ? '' : 's'} pending`
            : ''
        }`}
        ranAt={ia2RunAt}
        running={running === 'ia2'}
        onClick={runIa2}
        disabled={running !== null && running !== 'ia2'}
      />

      <div className="flex-1" />

      <Button
        size="sm"
        onClick={runAll}
        disabled={running !== null}
        title="Run IA-1 then IA-2 in sequence (~$0.80 total)"
      >
        {running === 'all' ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running all…
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" /> Run all
          </>
        )}
      </Button>
    </section>
  );
}

function Pill({
  label,
  ranAt,
  running,
  onClick,
  disabled,
}: {
  label: string;
  ranAt: string | null;
  running: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-md border border-border bg-canvas px-2 py-1 text-[11.5px] text-fg-default transition-colors hover:bg-sunken disabled:opacity-50"
    >
      {running ? (
        <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
      ) : ranAt ? (
        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
      ) : (
        <Clock className="h-3 w-3 text-fg-subtle" />
      )}
      <span className="font-medium">{label}</span>
      {ranAt && (
        <span className="text-[10.5px] text-fg-subtle">
          · {new Date(ranAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </button>
  );
}
