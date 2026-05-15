'use client';

import { useRef, useState } from 'react';
import { Loader2, Upload, FileJson, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

/**
 * Result of the preview POST to /import-cowork.
 *
 * On HTTP 200 (kind='preview_success'), the import is persisted with
 * status='previewed' — parent should transition to preview stage to
 * show summary + warnings + apply/reject buttons.
 *
 * On HTTP 422 (kind='blocker'), the import is persisted with
 * status='failed' — parent shows blockers + offers reject only.
 *
 * On HTTP 409 (kind='conflict'), the same file hash was already
 * imported — parent can offer to open the existing import.
 *
 * On HTTP 400 (kind='zod_error' | 'bad_request'), payload didn't
 * match schema or body is malformed — parent shows generic error.
 */
export type UploadResult =
  | {
      kind: 'preview_success';
      importId: string;
      summary: Record<string, unknown>;
      warnings: unknown[];
    }
  | {
      kind: 'blocker';
      importId: string;
      blockers: unknown[];
      warnings: unknown[];
    }
  | {
      kind: 'conflict';
      existingImportId: string;
      existingStatus: string;
    }
  | {
      kind: 'zod_error';
      zodErrors: unknown;
    }
  | {
      kind: 'bad_request';
      message: string;
    };

type Props = {
  projectId: string;
  /**
   * Called after a successful upload + server response. Parent uses the
   * result to transition to the appropriate next stage (preview, blocker
   * view, conflict resolution, etc).
   */
  onUploadResult: (result: UploadResult) => void;
  /**
   * Called when user clicks Cancel button (only if onCancel is provided).
   * If not provided, no cancel button is rendered.
   */
  onCancel?: () => void;
};

const MAX_FILE_BYTES = 1_048_576; // 1 MiB — matches server limit

export function CoworkImportUploadStage({ projectId, onUploadResult, onCancel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  function selectFile(f: File) {
    // Validate extension client-side
    if (!f.name.toLowerCase().endsWith('.json')) {
      toast.error('Only .json files are accepted');
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      toast.error(
        `File too large (${Math.round(f.size / 1024)} KB). Maximum is ${MAX_FILE_BYTES / 1024} KB.`,
      );
      return;
    }
    setFile(f);
  }

  function handleFilePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) selectFile(f);
    // Reset input value so re-selecting the same file fires onChange again
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) selectFile(f);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  async function uploadFile() {
    if (!file) return;
    setUploading(true);

    try {
      const rawJsonString = await file.text();

      const res = await fetch(`/api/projects/${projectId}/import-cowork`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-file-name': file.name,
        },
        body: rawJsonString,
      });

      const data = await res.json();

      if (res.status === 200) {
        onUploadResult({
          kind: 'preview_success',
          importId: data.importId,
          summary: data.summary,
          warnings: data.warnings ?? [],
        });
        return;
      }

      if (res.status === 422 && data.blockers) {
        onUploadResult({
          kind: 'blocker',
          importId: data.importId,
          blockers: data.blockers,
          warnings: data.warnings ?? [],
        });
        return;
      }

      if (res.status === 409) {
        onUploadResult({
          kind: 'conflict',
          existingImportId: data.existingImportId,
          existingStatus: data.existingStatus,
        });
        return;
      }

      if (res.status === 400 && data.zodErrors) {
        onUploadResult({
          kind: 'zod_error',
          zodErrors: data.zodErrors,
        });
        return;
      }

      // Generic 400/403/404/413/500 fallthrough
      onUploadResult({
        kind: 'bad_request',
        message: data?.error ?? `Upload failed (HTTP ${res.status})`,
      });
    } catch (err) {
      console.error(err);
      toast.error('Network error during upload');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFilePickerChange}
        className="hidden"
        data-testid="file-input"
      />

      {!file && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={[
            'flex w-full flex-col items-center justify-center gap-3 rounded-md border border-dashed py-12 px-6 transition',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border/60 bg-muted/30 hover:bg-muted/50',
          ].join(' ')}
          data-testid="upload-dropzone"
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">Drop a Cowork JSON file here</p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse — max 1 MiB</p>
          </div>
        </button>
      )}

      {file && (
        <div
          className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-3"
          data-testid="selected-file"
        >
          <FileJson className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">{Math.round(file.size / 1024)} KB</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFile(null)}
            disabled={uploading}
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={uploading}>
            Cancel
          </Button>
        )}
        <Button onClick={uploadFile} disabled={!file || uploading}>
          {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Preview import
        </Button>
      </div>
    </div>
  );
}
