'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, X } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fileUrl: string | null;
  fileName: string | null;
  fileType?: string | null;
};

/**
 * Inline viewer for project documents. For PDFs and images we embed them
 * via <iframe> or <img> so the browser's native PDF viewer (Chrome, Edge,
 * Firefox, Safari) handles zoom/scroll/print/download — no heavy client
 * libraries needed. Other formats (dwg, zip, docx) are offered as downloads.
 */
export function PdfViewerDialog({
  open,
  onOpenChange,
  fileUrl,
  fileName,
  fileType,
}: Props) {
  if (!fileUrl) return null;

  const ext = (fileType ?? fileName?.split('.').pop() ?? '').toLowerCase();
  const isPdf = ext === 'pdf';
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext);
  const canEmbed = isPdf || isImage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[90vh] max-w-[1200px] flex-col gap-0 overflow-hidden p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          {fileName ?? 'Document viewer'}
        </DialogTitle>

        <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold text-fg-default">
              {fileName ?? 'Document'}
            </div>
            {ext && (
              <div className="text-[11px] uppercase tracking-wide text-fg-subtle">
                {ext}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button asChild variant="outline" size="sm">
              <a href={fileUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Open in new tab
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={fileUrl} download={fileName ?? undefined}>
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 bg-sunken">
          {isPdf && (
            <iframe
              src={fileUrl}
              title={fileName ?? 'PDF viewer'}
              className="h-full w-full border-0 bg-white"
            />
          )}
          {isImage && (
            <div className="flex h-full items-center justify-center overflow-auto p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fileUrl}
                alt={fileName ?? 'Document image'}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
          {!canEmbed && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="text-[15px] font-semibold text-fg-default">
                This file type can&apos;t be previewed inline
              </div>
              <p className="max-w-md text-[12.5px] text-fg-muted">
                {ext ? `.${ext} files` : 'This file'} open in a separate program.
                Use <b>Download</b> or <b>Open in new tab</b> above.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
