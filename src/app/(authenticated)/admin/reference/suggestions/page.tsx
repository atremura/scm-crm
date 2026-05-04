'use client';

import { useEffect, useState } from 'react';
import { Loader2, Check, X, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { ReferencePageShell } from '@/components/admin/reference-page-shell';
import { Button } from '@/components/ui/button';

type Suggestion = {
  id: string;
  type: string;
  payload: any;
  justification: string;
  confidence: number;
  status: string;
  modelUsed: string | null;
  costCents: number | string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  appliedToTable: string | null;
  createdAt: string;
};

export default function SuggestionsPage() {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/reference/suggestions?status=${status}`);
    if (!res.ok) {
      toast.error('Failed to load');
      setLoading(false);
      return;
    }
    const d = await res.json();
    setItems(d.items);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [status]);

  async function act(s: Suggestion, action: 'approve' | 'reject' | 'archive') {
    setWorking(s.id);
    const res = await fetch(`/api/admin/reference/suggestions/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const d = await res.json();
    setWorking(null);
    if (!res.ok) {
      toast.error(d?.error ?? `${action} failed`);
      return;
    }
    if (action === 'approve' && d.applied) {
      toast.success(`Approved → materialized ${d.applied.name}`);
    } else {
      toast.success(`Suggestion ${action}d`);
    }
    load();
  }

  return (
    <ReferencePageShell
      title="AI suggestions"
      subtitle="Review and approve rules / catalog entries that IA-2 proposed during estimate runs"
      toolbar={
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-canvas p-0.5 text-[12px]">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded px-2 py-1 transition-colors ${status === s ? 'bg-blue-500/15 text-blue-300' : 'text-fg-muted hover:text-fg-default'}`}
            >
              {s}
            </button>
          ))}
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12 text-fg-subtle">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface px-4 py-8 text-center text-[13px] text-fg-muted">
          No {status === 'all' ? '' : status} suggestions. Run IA-2 on an estimate to generate
          proposals.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
            <div
              key={s.id}
              className={`rounded-lg border bg-surface p-3 ${s.status === 'pending' ? 'border-warn-500/30' : 'border-border'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-fg-subtle/15 px-1.5 py-0.5 font-mono text-[10.5px] text-fg-muted">
                      {s.type}
                    </span>
                    <span className="font-semibold text-fg-default">
                      {s.payload?.name ?? '(unnamed)'}
                    </span>
                    <span className="text-[11px] text-fg-subtle">conf {s.confidence}</span>
                    {s.costCents != null && (
                      <span className="text-[11px] text-fg-subtle">
                        · ${(Number(s.costCents) / 100).toFixed(3)} model
                      </span>
                    )}
                    {s.appliedToTable && (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10.5px] text-emerald-400">
                        applied → {s.appliedToTable}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[12.5px] text-fg-default">{s.justification}</p>
                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-[11px] text-fg-subtle hover:text-fg-default">
                      Payload
                    </summary>
                    <pre className="mt-1 overflow-auto rounded bg-sunken/60 p-2 text-[10.5px] text-fg-muted">
                      {JSON.stringify(s.payload, null, 2)}
                    </pre>
                  </details>
                  {s.reviewNote && (
                    <p className="mt-1 text-[11px] italic text-fg-subtle">Note: {s.reviewNote}</p>
                  )}
                </div>
                {s.status === 'pending' && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={working === s.id}
                      onClick={() => act(s, 'approve')}
                      title="Approve & materialize"
                    >
                      <Check className="h-3.5 w-3.5 text-emerald-400" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={working === s.id}
                      onClick={() => act(s, 'reject')}
                      title="Reject"
                    >
                      <X className="h-3.5 w-3.5 text-danger-500" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={working === s.id}
                      onClick={() => act(s, 'archive')}
                      title="Archive"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </ReferencePageShell>
  );
}
