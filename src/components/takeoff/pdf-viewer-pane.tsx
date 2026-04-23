'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Trash2,
  PanelRightClose,
  PanelRightOpen,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClassificationsSidebar } from '@/components/takeoff/classifications-sidebar';

type Props = {
  fileUrl: string;
  fileName: string;
  fileType?: string | null;
  onBack: () => void;
  onDelete?: () => void;
  rightMeta?: React.ReactNode;
  /** Project id — enables the classifications side panel. */
  projectId?: string;
  /** Fired after classifications change (so parent can refresh counts). */
  onClassificationsChange?: () => void;
};

/**
 * In-page (not modal) document viewer. Replaces the documents list while
 * open so the PDF fills the available area. Back button returns to the list.
 * PDFs embed via <iframe> (native browser viewer); images via <img>;
 * anything else falls back to a download prompt.
 */
export function PdfViewerPane({
  fileUrl,
  fileName,
  fileType,
  onBack,
  onDelete,
  rightMeta,
  projectId,
  onClassificationsChange,
}: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Default to fullscreen — the whole point of the viewer is to give the
  // estimator room. User can toggle back to inline to see the rest of the
  // app chrome (sidebar nav, etc).
  const [fullscreen, setFullscreen] = useState(true);

  // When fullscreen we overlay everything including the app shell. Prevent
  // the page underneath from scrolling while the viewer owns the viewport.
  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  // Esc exits fullscreen (but doesn't close the viewer — explicit Back for that).
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const ext = (fileType ?? fileName.split('.').pop() ?? '').toLowerCase();
  const isPdf = ext === 'pdf';
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext);
  const canEmbed = isPdf || isImage;
  const showSidebar = !!projectId && sidebarOpen;

  const containerCls = fullscreen
    ? 'fixed inset-0 z-50 flex flex-col overflow-hidden bg-app'
    : 'flex h-[calc(100vh-220px)] min-h-[520px] flex-col overflow-hidden rounded-lg border border-border bg-surface';

  return (
    <div className={containerCls}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-border bg-surface px-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold text-fg-default">
              {fileName}
            </div>
            {rightMeta && (
              <div className="truncate text-[11px] text-fg-subtle">{rightMeta}</div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button asChild variant="outline" size="sm">
            <a href={fileUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              New tab
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={fileUrl} download={fileName}>
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          </Button>
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-danger-500 hover:bg-danger-500/10 hover:text-danger-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          )}
          {projectId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={sidebarOpen ? 'Hide classifications' : 'Show classifications'}
              title={sidebarOpen ? 'Hide classifications' : 'Show classifications'}
            >
              {sidebarOpen ? (
                <PanelRightClose className="h-3.5 w-3.5" />
              ) : (
                <PanelRightOpen className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFullscreen((v) => !v)}
            aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
          >
            {fullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Body — split: viewer (grows) + classifications sidebar (fixed) */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 bg-sunken">
          {isPdf && (
            <iframe
              src={fileUrl}
              title={fileName}
              className="h-full w-full border-0 bg-white"
            />
          )}
          {isImage && (
            <div className="flex h-full items-center justify-center overflow-auto p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fileUrl}
                alt={fileName}
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
                Use <b>Download</b> or <b>New tab</b> above.
              </p>
            </div>
          )}
        </div>

        {showSidebar && (
          <div className="w-[340px] shrink-0">
            <ClassificationsSidebar
              projectId={projectId!}
              onChange={onClassificationsChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
