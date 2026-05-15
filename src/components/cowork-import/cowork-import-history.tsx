'use client';

import { useEffect, useState } from 'react';
import { Loader2, FileJson, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * Status of an EstimateImport row.
 *
 * Mirrors EstimateImport.status string in the database. Each status
 * gets its own badge color in the UI.
 */
type ImportStatus = 'previewed' | 'applied' | 'rejected' | 'failed';

type ImportRow = {
  id: string;
  fileName: string;
  fileHash: string;
  schemaVersion: string;
  status: ImportStatus;
  estimateId: string | null;
  appliedById: string | null;
  appliedAt: string | null;
  rejectedById: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

type Props = {
  projectId: string;
  onSelectImport: (importId: string) => void;
  /**
   * Bumping this number triggers a re-fetch. Parent components can
   * use this to force the list to refresh after creating or rejecting
   * an import.
   */
  refreshKey?: number;
};

/**
 * Visual status descriptor for an import row.
 */
const STATUS_VARIANTS: Record<ImportStatus, { label: string; className: string }> = {
  previewed: {
    label: 'Previewed',
    className: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  },
  applied: {
    label: 'Applied',
    className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-slate-500/15 text-slate-600 border-slate-500/30',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-500/15 text-red-600 border-red-500/30',
  },
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CoworkImportHistory({ projectId, onSelectImport, refreshKey = 0 }: Props) {
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/import-cowork`);
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) {
            toast.error(data?.error ?? 'Failed to load import history');
          }
          return;
        }
        if (!cancelled) {
          setImports(data.imports ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error('Network error loading history');
          console.error(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading import history...
      </div>
    );
  }

  if (imports.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-sm text-muted-foreground">
        No Cowork imports yet for this project.
      </div>
    );
  }

  return (
    <div className="space-y-2" role="list" aria-label="Cowork imports">
      {imports.map((row) => {
        const variant = STATUS_VARIANTS[row.status];
        return (
          <Button
            key={row.id}
            variant="ghost"
            className="w-full justify-start gap-3 py-2 h-auto"
            onClick={() => onSelectImport(row.id)}
            role="listitem"
          >
            <FileJson className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0 text-left">
              <div className="truncate text-sm font-medium">{row.fileName}</div>
              <div className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</div>
            </div>
            <Badge variant="outline" className={variant.className}>
              {variant.label}
            </Badge>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        );
      })}
    </div>
  );
}
