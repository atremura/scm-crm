'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  FileArchive,
  File as FileIcon,
  Trash2,
  Loader2,
  Search,
  Download,
  Eye,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  VALID_PROJECT_DOCUMENT_TYPES,
  PROJECT_DOC_MAX_SIZE_BYTES,
  PROJECT_DOC_ALLOWED_EXTENSIONS,
  type ProjectDocumentType,
} from '@/lib/takeoff-utils';
import { PdfViewerDialog } from '@/components/takeoff/pdf-viewer-dialog';

type ApiDocument = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string | null;
  fileSizeKb: number | null;
  documentType: string;
  note: string | null;
  uploadedAt: string;
  uploader: { id: string; name: string; email: string } | null;
};

type Props = {
  projectId: string;
};

const TYPE_LABELS: Record<ProjectDocumentType, string> = {
  plans: 'Plans',
  specs: 'Specs',
  addendum: 'Addendum',
  photo: 'Photo',
  other: 'Other',
};

const FILTER_TYPES: Array<{ key: 'all' | ProjectDocumentType; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'plans', label: 'Plans' },
  { key: 'specs', label: 'Specs' },
  { key: 'addendum', label: 'Addendum' },
  { key: 'photo', label: 'Photos' },
  { key: 'other', label: 'Other' },
];

const MAX_MB = Math.round(PROJECT_DOC_MAX_SIZE_BYTES / 1024 / 1024);

export function DocumentsPanel({ projectId }: Props) {
  const [docs, setDocs] = useState<ApiDocument[] | null>(null);
  const [filter, setFilter] = useState<'all' | ProjectDocumentType>('all');
  const [search, setSearch] = useState('');

  // Upload state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingType, setPendingType] = useState<ProjectDocumentType>('plans');
  const [pendingNote, setPendingNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Viewer + delete
  const [viewDoc, setViewDoc] = useState<ApiDocument | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<ApiDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadDocs() {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('type', filter);
    if (search) params.set('search', search);
    const res = await fetch(`/api/projects/${projectId}/documents?${params}`);
    if (res.ok) {
      const d = await res.json();
      setDocs(Array.isArray(d) ? d : []);
    } else {
      setDocs([]);
    }
  }

  useEffect(() => {
    loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, filter, search]);

  function handleFilesPicked(fl: FileList | File[] | null) {
    if (!fl) return;
    const arr = Array.from(fl);
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const f of arr) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      if (!PROJECT_DOC_ALLOWED_EXTENSIONS.includes(ext as any)) {
        rejected.push(`${f.name} (type .${ext || '?'} not allowed)`);
        continue;
      }
      if (f.size > PROJECT_DOC_MAX_SIZE_BYTES) {
        rejected.push(`${f.name} (over ${MAX_MB}MB)`);
        continue;
      }
      accepted.push(f);
    }
    if (rejected.length) toast.error(`Skipped: ${rejected.join(', ')}`);
    if (accepted.length) setPendingFiles((prev) => [...prev, ...accepted]);
  }

  function removePending(idx: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleUpload() {
    if (pendingFiles.length === 0) return;
    setUploading(true);

    let ok = 0;
    let fail = 0;
    for (const file of pendingFiles) {
      const form = new FormData();
      form.append('file', file);
      form.append('documentType', pendingType);
      if (pendingNote) form.append('note', pendingNote);

      try {
        const res = await fetch(`/api/projects/${projectId}/documents`, {
          method: 'POST',
          body: form,
        });
        if (res.ok) ok++;
        else {
          fail++;
          const d = await res.json().catch(() => ({}));
          console.error('Upload failed', file.name, d);
        }
      } catch (err) {
        fail++;
        console.error('Upload threw', file.name, err);
      }
    }

    if (ok > 0) toast.success(`${ok} file${ok === 1 ? '' : 's'} uploaded`);
    if (fail > 0) toast.error(`${fail} upload${fail === 1 ? '' : 's'} failed`);

    setPendingFiles([]);
    setPendingNote('');
    setUploading(false);
    await loadDocs();
  }

  async function confirmDelete() {
    if (!deleteDoc) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/documents/${deleteDoc.id}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? 'Failed to delete');
        return;
      }
      toast.success('Document deleted');
      setDeleteDoc(null);
      await loadDocs();
    } finally {
      setDeleting(false);
    }
  }

  const counts = useMemo(() => {
    const base: Record<string, number> = { all: docs?.length ?? 0 };
    for (const t of VALID_PROJECT_DOCUMENT_TYPES) base[t] = 0;
    docs?.forEach((d) => {
      base[d.documentType] = (base[d.documentType] ?? 0) + 1;
    });
    return base;
  }, [docs]);

  return (
    <div className="space-y-5">
      {/* Upload zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFilesPicked(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-500/5'
            : 'border-border bg-surface'
        }`}
      >
        <div className="p-5">
          <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
            <Upload className="h-7 w-7 shrink-0 text-fg-subtle" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-fg-default">
                Drop files here, or{' '}
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="text-blue-400 hover:underline"
                >
                  browse
                </button>
              </div>
              <div className="text-[11.5px] text-fg-subtle">
                Up to {MAX_MB}MB per file · {PROJECT_DOC_ALLOWED_EXTENSIONS.join(', ')}
              </div>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              accept={PROJECT_DOC_ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
              onChange={(e) => {
                handleFilesPicked(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          {pendingFiles.length > 0 && (
            <div className="mt-4 space-y-3 border-t border-border pt-4">
              {/* Type + note */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pendingType" className="text-[12.5px] font-semibold">
                    Document type
                  </Label>
                  <Select
                    value={pendingType}
                    onValueChange={(v) => setPendingType(v as ProjectDocumentType)}
                    disabled={uploading}
                  >
                    <SelectTrigger id="pendingType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VALID_PROJECT_DOCUMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pendingNote" className="text-[12.5px] font-semibold">
                    Note (optional)
                  </Label>
                  <Input
                    id="pendingNote"
                    value={pendingNote}
                    onChange={(e) => setPendingNote(e.target.value)}
                    placeholder="e.g. Revision 2 — post walkthrough"
                    disabled={uploading}
                  />
                </div>
              </div>

              {/* Pending list */}
              <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                {pendingFiles.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-3 px-3 py-2 text-[13px]"
                  >
                    <FileIconForExt fileName={f.name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-fg-default">{f.name}</div>
                      <div className="text-[11px] text-fg-subtle">
                        {(f.size / 1024 / 1024).toFixed(1)} MB
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePending(i)}
                      disabled={uploading}
                      className="grid h-7 w-7 place-items-center rounded text-fg-muted hover:bg-sunken hover:text-fg-default disabled:opacity-40"
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingFiles([])}
                  disabled={uploading}
                >
                  Clear
                </Button>
                <Button size="sm" onClick={handleUpload} disabled={uploading}>
                  {uploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5" />
                      Upload {pendingFiles.length} file
                      {pendingFiles.length === 1 ? '' : 's'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-[10px] bg-sunken p-1">
          {FILTER_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-all ${
                filter === t.key
                  ? 'bg-surface text-fg-default shadow-sm'
                  : 'text-fg-muted hover:text-fg-default'
              }`}
            >
              {t.label}
              {counts[t.key] !== undefined && counts[t.key] > 0 && (
                <span className="rounded-full bg-ink-200 px-1.5 text-[10px] font-semibold text-fg-muted">
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search file name or note"
            className="h-9 w-[260px] pl-8 text-[13px]"
          />
        </div>
      </div>

      {/* List */}
      {docs === null ? (
        <div className="flex items-center justify-center py-10 text-fg-subtle">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-sunken/40 py-12 text-center">
          <FileText className="mx-auto h-7 w-7 text-fg-subtle" />
          <p className="mt-2 text-[13px] text-fg-muted">
            {filter === 'all' && !search
              ? 'No documents yet. Drop files above to get started.'
              : 'No documents match this filter.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <ul className="divide-y divide-border">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-4 px-5 py-3 hover:bg-sunken/60"
              >
                <FileIconForExt fileName={d.fileName} />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setViewDoc(d)}
                    className="block truncate text-left text-[13.5px] font-semibold text-fg-default hover:text-blue-400"
                  >
                    {d.fileName}
                  </button>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-fg-subtle">
                    <span className="rounded bg-ink-100 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-fg-muted">
                      {TYPE_LABELS[d.documentType as ProjectDocumentType] ?? d.documentType}
                    </span>
                    {d.fileSizeKb && (
                      <span>{(d.fileSizeKb / 1024).toFixed(1)} MB</span>
                    )}
                    <span>{new Date(d.uploadedAt).toLocaleDateString()}</span>
                    {d.uploader && <span>· {d.uploader.name}</span>}
                  </div>
                  {d.note && (
                    <div className="mt-0.5 truncate text-[12px] text-fg-muted">
                      {d.note}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setViewDoc(d)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <a href={d.fileUrl} download={d.fileName}>
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteDoc(d)}
                    className="text-danger-500 hover:bg-danger-500/10 hover:text-danger-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Viewer */}
      <PdfViewerDialog
        open={!!viewDoc}
        onOpenChange={(v) => !v && setViewDoc(null)}
        fileUrl={viewDoc?.fileUrl ?? null}
        fileName={viewDoc?.fileName ?? null}
        fileType={viewDoc?.fileType ?? null}
      />

      {/* Delete confirm */}
      <Dialog open={!!deleteDoc} onOpenChange={(v) => !v && setDeleteDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document</DialogTitle>
            <DialogDescription>
              This permanently removes{' '}
              <b>{deleteDoc?.fileName}</b> and its file from storage. This
              can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteDoc(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FileIconForExt({ fileName }: { fileName: string }) {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (['pdf'].includes(ext)) {
    return <FileText className="h-5 w-5 shrink-0 text-danger-500" />;
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
    return <ImageIcon className="h-5 w-5 shrink-0 text-blue-400" />;
  }
  if (['zip'].includes(ext)) {
    return <FileArchive className="h-5 w-5 shrink-0 text-warn-500" />;
  }
  return <FileIcon className="h-5 w-5 shrink-0 text-fg-muted" />;
}
