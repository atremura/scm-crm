'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  errorMessage: string | null;
  reviewedAt: string | null;
  reviewer: { id: string; name: string } | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
};

type ApiDocument = {
  id: string;
  fileName: string;
  documentType: string;
  fileSizeKb: number | null;
};

type Props = {
  projectId: string;
};

// Anthropic Files API per-file cap. Sum across files isn't capped
// because each PDF is referenced by file_id (not inlined).
const PER_FILE_LIMIT_MB = 500;

export function AiAnalysisPanel({ projectId }: Props) {
  const router = useRouter();
  const [runs, setRuns] = useState<ApiRun[] | null>(null);
  const [documents, setDocuments] = useState<ApiDocument[]>([]);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);

  async function loadRuns() {
    const res = await fetch(`/api/projects/${projectId}/analysis-runs`);
    if (!res.ok) {
      setRuns([]);
      return;
    }
    setRuns(await res.json());
  }

  async function loadDocuments() {
    const res = await fetch(`/api/projects/${projectId}/documents`);
    if (!res.ok) return;
    const all: ApiDocument[] = await res.json();
    setDocuments(all);
    // Pre-select plans + specs + addendum by default
    const pre = new Set(
      all.filter((d) => ['plans', 'specs', 'addendum'].includes(d.documentType)).map((d) => d.id),
    );
    setSelectedDocIds(pre);
  }

  useEffect(() => {
    loadRuns();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  function openNewDialog() {
    loadDocuments();
    setNewDialogOpen(true);
  }

  function toggleDoc(id: string) {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedDocs = documents.filter((d) => selectedDocIds.has(d.id));
  const totalBytes = selectedDocs.reduce((acc, d) => acc + (d.fileSizeKb ?? 0) * 1024, 0);
  const totalMb = totalBytes / 1024 / 1024;
  const oversized = selectedDocs.filter((d) => (d.fileSizeKb ?? 0) / 1024 > PER_FILE_LIMIT_MB);
  const overLimit = oversized.length > 0;

  async function runAnalysis() {
    if (selectedDocIds.size === 0) {
      toast.error('Pick at least one document');
      return;
    }
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: Array.from(selectedDocIds) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Analysis failed to start');
        return;
      }
      // Endpoint returns 202 + { runId, status: 'pending' } — the worker
      // runs in the background. Take the user straight to the detail
      // page where they'll see the run progress + final result.
      toast.success(
        'Analysis started. PDFs are uploading + Claude is reading — this can take 1–5 minutes.',
      );
      setNewDialogOpen(false);
      router.push(`/takeoff/${projectId}/analysis-runs/${data.runId}`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-fg-default">AI Scope Analysis</h2>
          <p className="text-[12.5px] text-fg-muted">
            Claude reads the project documents and proposes a starting set of classifications.
            Review and accept what looks right.
          </p>
        </div>
        <Button onClick={openNewDialog} disabled={analyzing}>
          <Sparkles className="h-3.5 w-3.5" />
          {analyzing ? 'Analyzing…' : 'Run analysis'}
        </Button>
      </div>

      {runs === null ? (
        <div className="flex items-center justify-center py-10 text-fg-subtle">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-sunken/40 py-12 text-center">
          <Sparkles className="mx-auto h-7 w-7 text-fg-subtle" />
          <p className="mt-2 text-[13px] text-fg-muted">
            No analysis runs yet. Click <b>Run analysis</b> to get a first scope from the project
            documents.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-[12.5px]">
            <thead className="bg-sunken/70 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              <tr>
                <th className="px-3 py-2">Run</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Items</th>
                <th className="px-3 py-2 text-right">Cost</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-sunken/40">
                  <td className="px-3 py-2 font-mono text-[11px] text-fg-muted">
                    {r.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-3 py-2">
                    <RunStatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{r.itemsProposed}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {r.costCents !== null ? `$${(Number(r.costCents) / 100).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-fg-muted">{r.modelUsed}</td>
                  <td className="px-3 py-2 text-fg-muted">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                      <a href={`/takeoff/${projectId}/analysis-runs/${r.id}`}>
                        View <ChevronRight className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New analysis dialog */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Run AI scope analysis</DialogTitle>
            <DialogDescription>
              Pick the documents Claude should read. Plans + specs + addendum are pre-selected. Each
              file caps at {PER_FILE_LIMIT_MB} MB (Anthropic Files API limit) and the request caps
              at 600 pages total (Opus 4.7).
            </DialogDescription>
          </DialogHeader>

          <div className="my-2 max-h-[400px] overflow-y-auto rounded-md border border-border bg-sunken/30">
            {documents.length === 0 ? (
              <div className="px-4 py-6 text-center text-[13px] text-fg-subtle">
                No documents uploaded yet.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {documents.map((d) => {
                  const sizeMb = ((d.fileSizeKb ?? 0) / 1024).toFixed(1);
                  return (
                    <li
                      key={d.id}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-sunken/50"
                    >
                      <Checkbox
                        checked={selectedDocIds.has(d.id)}
                        onCheckedChange={() => toggleDoc(d.id)}
                      />
                      <FileText className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] text-fg-default">{d.fileName}</div>
                        <div className="text-[11px] text-fg-subtle">
                          {d.documentType} · {sizeMb} MB
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-[12.5px] ${
              overLimit
                ? 'border-danger-500/40 bg-danger-500/10 text-danger-500'
                : 'border-border bg-sunken/40 text-fg-muted'
            }`}
          >
            {overLimit ? (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success-500" />
            )}
            <span>
              Selected: <b>{selectedDocIds.size}</b> docs · <b>{totalMb.toFixed(1)} MB</b>
              {overLimit
                ? ` — file(s) over ${PER_FILE_LIMIT_MB} MB cap: ${oversized.map((d) => d.fileName).join(', ')}`
                : ` · estimated cost $1–$15 with cache. First analysis uploads PDFs to Anthropic (~10–60s); subsequent runs reuse the cached upload.`}
            </span>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewDialogOpen(false)} disabled={analyzing}>
              Cancel
            </Button>
            <Button
              onClick={runAnalysis}
              disabled={analyzing || overLimit || selectedDocIds.size === 0}
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Run analysis
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
  const label = status.replace(/_/g, ' ');
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-[1px] text-[11px] font-semibold uppercase ${color}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
