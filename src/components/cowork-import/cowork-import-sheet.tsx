'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import { CoworkImportHistory } from './cowork-import-history';
import { CoworkImportUploadStage } from './cowork-import-upload-stage';
import {
  CoworkImportPreviewStage,
  type CoworkPayloadPreview,
  type IntegrityFlag,
  type PreviewSummary,
} from './cowork-import-preview-stage';
import { CoworkImportRejectStage } from './cowork-import-reject-stage';

type ImportDetail = {
  id: string;
  fileName: string;
  status: 'previewed' | 'failed' | 'applied' | 'rejected';
  rawPayload: unknown;
  previewSummary: unknown;
  appliedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
};

/**
 * State machine for the sheet's current view.
 *
 * Each kind represents a distinct screen the user can see. Transitions
 * are explicit (no implicit fall-through), and most preserve the
 * importId across kinds so we can return to the same import after a
 * sub-flow (reject, error).
 */
type Stage =
  | { kind: 'history' }
  | { kind: 'upload' }
  | {
      kind: 'preview';
      importId: string;
      loading: boolean;
      detail: ImportDetail | null;
      error: string | null;
    }
  | { kind: 'reject'; importId: string; fileName: string };

type Props = {
  /**
   * Whether the sheet is currently open. Controlled by parent.
   */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Project UUID. Used in all API calls.
   */
  projectId: string;
};

/**
 * Helper to extract summary and warnings/blockers from a previewSummary
 * blob (which is a Json field in Prisma — opaque).
 *
 * Defensive: returns null if shape is unexpected.
 */
function extractSummary(previewSummary: unknown): {
  summary?: PreviewSummary;
  warnings: IntegrityFlag[];
  blockers: IntegrityFlag[];
} {
  if (!previewSummary || typeof previewSummary !== 'object') {
    return { warnings: [], blockers: [] };
  }
  const ps = previewSummary as Record<string, unknown>;
  return {
    summary: (ps.summary as PreviewSummary) ?? undefined,
    warnings: (ps.warnings as IntegrityFlag[]) ?? [],
    blockers: (ps.blockers as IntegrityFlag[]) ?? [],
  };
}

/**
 * Helper to extract a CoworkPayloadPreview subset from rawPayload.
 *
 * Returns null if rawPayload is missing or malformed.
 */
function extractPayloadPreview(rawPayload: unknown): CoworkPayloadPreview | null {
  if (!rawPayload || typeof rawPayload !== 'object') return null;
  return rawPayload as CoworkPayloadPreview;
}

export function CoworkImportSheet({ open, onOpenChange, projectId }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: 'history' });
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [isApplying, setIsApplying] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // Reset to history when sheet closes (after close animation finishes).
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStage({ kind: 'history' });
        setIsApplying(false);
        setIsRejecting(false);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Fetch full detail when entering preview stage.
  useEffect(() => {
    if (stage.kind !== 'preview' || stage.detail !== null) return;

    // Capture importId while TS still knows the discriminant, so the
    // async closure below doesn't need a re-cast after `await`.
    const importId = stage.importId;
    let cancelled = false;

    async function fetchDetail() {
      try {
        const res = await fetch(`/api/projects/${projectId}/import-cowork/${importId}`);
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setStage((prev) =>
            prev.kind === 'preview'
              ? {
                  ...prev,
                  loading: false,
                  error: data?.error ?? 'Failed to load import',
                }
              : prev,
          );
          return;
        }

        setStage((prev) =>
          prev.kind === 'preview'
            ? { ...prev, loading: false, detail: data.import, error: null }
            : prev,
        );
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setStage((prev) =>
          prev.kind === 'preview' ? { ...prev, loading: false, error: 'Network error' } : prev,
        );
      }
    }

    fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [stage, projectId]);

  function goToHistory() {
    setStage({ kind: 'history' });
    setHistoryRefreshKey((k) => k + 1);
  }

  function goToUpload() {
    setStage({ kind: 'upload' });
  }

  const goToPreview = useCallback((importId: string) => {
    setStage({
      kind: 'preview',
      importId,
      loading: true,
      detail: null,
      error: null,
    });
  }, []);

  function goToReject(importId: string, fileName: string) {
    setStage({ kind: 'reject', importId, fileName });
  }

  async function handleApply() {
    if (stage.kind !== 'preview' || !stage.detail) return;
    setIsApplying(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/import-cowork/${stage.importId}/apply`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Failed to apply import');
        return;
      }
      toast.success('Import applied — creating estimate...');
      // Navigate after a brief delay to let toast register
      setTimeout(() => {
        window.location.href = `/estimates/${data.estimateId}`;
      }, 200);
    } catch (err) {
      console.error(err);
      toast.error('Network error during apply');
    } finally {
      setIsApplying(false);
    }
  }

  async function handleReject(rejectionReason: string) {
    if (stage.kind !== 'reject') return;
    setIsRejecting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/import-cowork/${stage.importId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Failed to reject import');
        return;
      }
      toast.success('Import rejected');
      goToHistory();
    } catch (err) {
      console.error(err);
      toast.error('Network error during reject');
    } finally {
      setIsRejecting(false);
    }
  }

  // --- Render branches -----------------------------------------------------

  function renderHistoryStage() {
    return (
      <div className="space-y-4">
        <Button onClick={goToUpload} variant="default" className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          New Cowork import
        </Button>
        <div>
          <h3 className="text-sm font-medium mb-2">Recent imports</h3>
          <CoworkImportHistory
            projectId={projectId}
            onSelectImport={goToPreview}
            refreshKey={historyRefreshKey}
          />
        </div>
      </div>
    );
  }

  function renderUploadStage() {
    return (
      <CoworkImportUploadStage
        projectId={projectId}
        onCancel={goToHistory}
        onUploadResult={(result) => {
          switch (result.kind) {
            case 'preview_success':
              goToPreview(result.importId);
              return;
            case 'blocker':
              goToPreview(result.importId);
              return;
            case 'conflict':
              toast.error(
                `Already imported (status: ${result.existingStatus}). Opening existing import.`,
              );
              goToPreview(result.existingImportId);
              return;
            case 'zod_error':
              toast.error('Payload does not match Cowork schema v1.0.0');
              return;
            case 'bad_request':
              toast.error(result.message);
              return;
          }
        }}
      />
    );
  }

  function renderPreviewStage() {
    if (stage.kind !== 'preview') return null;

    if (stage.loading) {
      return (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading import details...
        </div>
      );
    }

    if (stage.error) {
      return (
        <div className="space-y-3">
          <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-3 text-sm">
            {stage.error}
          </div>
          <Button variant="outline" onClick={goToHistory}>
            Back to history
          </Button>
        </div>
      );
    }

    if (!stage.detail) return null;

    const detail = stage.detail;
    const { summary, warnings, blockers } = extractSummary(detail.previewSummary);
    const payload = extractPayloadPreview(detail.rawPayload);

    return (
      <CoworkImportPreviewStage
        fileName={detail.fileName}
        status={detail.status}
        summary={summary}
        warnings={warnings}
        blockers={blockers}
        payload={payload ?? undefined}
        appliedAt={detail.appliedAt}
        rejectionReason={detail.rejectionReason}
        onApplyRequested={handleApply}
        onRejectRequested={() => goToReject(detail.id, detail.fileName)}
        onBack={goToHistory}
        isApplying={isApplying}
      />
    );
  }

  function renderRejectStage() {
    if (stage.kind !== 'reject') return null;
    return (
      <CoworkImportRejectStage
        fileName={stage.fileName}
        onConfirm={handleReject}
        onBack={() => goToPreview(stage.importId)}
        isSubmitting={isRejecting}
      />
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-5xl w-full overflow-y-auto p-6">
        <SheetHeader className="space-y-2 mb-4">
          <SheetTitle>Cowork import</SheetTitle>
          <SheetDescription>Import Cowork-generated estimates into this project.</SheetDescription>
        </SheetHeader>

        {stage.kind === 'history' && renderHistoryStage()}
        {stage.kind === 'upload' && renderUploadStage()}
        {stage.kind === 'preview' && renderPreviewStage()}
        {stage.kind === 'reject' && renderRejectStage()}
      </SheetContent>
    </Sheet>
  );
}
