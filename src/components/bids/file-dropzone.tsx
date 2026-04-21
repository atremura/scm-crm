'use client';

import { useRef, useState } from 'react';
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  VALID_DOCUMENT_TYPES,
  type DocumentType,
} from '@/lib/bid-utils';
import { toast } from 'sonner';

export type StagedFile = {
  file: File;
  id: string; // client-side id
  documentType: DocumentType;
};

type Props = {
  files: StagedFile[];
  onFilesChange: (files: StagedFile[]) => void;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getExt(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  if (i === -1) return '';
  return fileName.slice(i + 1).toLowerCase();
}

function inferType(fileName: string): DocumentType {
  const ext = getExt(fileName);
  if (['png', 'jpg', 'jpeg'].includes(ext)) return 'photo';
  if (['pdf', 'dwg', 'rvt'].includes(ext)) return 'plans';
  return 'other';
}

export function FileDropzone({ files, onFilesChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  function addFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    const accepted: StagedFile[] = [];
    for (const f of arr) {
      const ext = getExt(f.name);
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast.error(`"${f.name}" — type .${ext || '?'} not allowed`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`"${f.name}" exceeds 50MB`);
        continue;
      }
      accepted.push({
        file: f,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        documentType: inferType(f.name),
      });
    }
    if (accepted.length > 0) {
      onFilesChange([...files, ...accepted]);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  function updateType(id: string, documentType: DocumentType) {
    onFilesChange(
      files.map((f) => (f.id === id ? { ...f, documentType } : f))
    );
  }

  function remove(id: string) {
    onFilesChange(files.filter((f) => f.id !== id));
  }

  return (
    <div className="space-y-3">
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-500/5'
            : 'border-border bg-sunken/30 hover:border-blue-500/50 hover:bg-sunken/60'
        }`}
      >
        <Upload className="h-8 w-8 text-fg-subtle" />
        <p className="mt-3 text-[14px] font-semibold text-fg-default">
          Drag files here or click to browse
        </p>
        <p className="mt-1 text-[12px] text-fg-muted">
          PDF, DWG, RVT, XLS, DOC, PNG, JPG · up to 50MB per file
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-blue-500/10 text-blue-500">
                {['png', 'jpg', 'jpeg'].includes(getExt(f.file.name)) ? (
                  <ImageIcon className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-fg-default">
                  {f.file.name}
                </div>
                <div className="mt-0.5 text-[11.5px] text-fg-muted">
                  {formatSize(f.file.size)} · .{getExt(f.file.name)}
                </div>
              </div>
              <Select
                value={f.documentType}
                onValueChange={(v) => updateType(f.id, v as DocumentType)}
              >
                <SelectTrigger className="w-[130px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALID_DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => remove(f.id)}
                className="grid h-8 w-8 place-items-center rounded-md text-fg-muted transition-colors hover:bg-sunken hover:text-danger-500"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
