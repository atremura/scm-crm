import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { put, del } from '@vercel/blob';
import { MAX_FILE_SIZE_BYTES, ALLOWED_EXTENSIONS } from '@/lib/bid-utils';
import { PROJECT_DOC_MAX_SIZE_BYTES, PROJECT_DOC_ALLOWED_EXTENSIONS } from '@/lib/takeoff-utils';

export { MAX_FILE_SIZE_BYTES, ALLOWED_EXTENSIONS };

export type SavedFile = {
  url: string; // full URL — Vercel Blob public URL, or /uploads/... for local
  fileName: string; // original file name
  fileSizeKb: number;
  fileType: string; // lowercase extension
};

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: 'TOO_LARGE' | 'BAD_TYPE' | 'IO',
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

type ValidateOpts = {
  maxSize?: number;
  allowedExts?: readonly string[];
};

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx === -1 ? '' : fileName.slice(idx + 1).toLowerCase();
}

export function validateFile(file: File, opts: ValidateOpts = {}): { ext: string } {
  const maxSize = opts.maxSize ?? MAX_FILE_SIZE_BYTES;
  const allowed = opts.allowedExts ?? ALLOWED_EXTENSIONS;

  if (file.size > maxSize) {
    const mb = Math.round(maxSize / 1024 / 1024);
    throw new StorageError(`File "${file.name}" exceeds the ${mb}MB limit`, 'TOO_LARGE');
  }

  const ext = getExtension(file.name);
  if (!allowed.includes(ext)) {
    throw new StorageError(
      `File type .${ext || '(unknown)'} not allowed. Allowed: ${allowed.join(', ')}`,
      'BAD_TYPE',
    );
  }
  return { ext };
}

/**
 * Which backend to use. Explicit via STORAGE_PROVIDER, or auto: blob if a
 * BLOB_READ_WRITE_TOKEN is set (we're in Vercel prod/preview), else local.
 */
function currentProvider(): 'local' | 'blob' {
  const p = process.env.STORAGE_PROVIDER?.toLowerCase();
  if (p === 'blob') return 'blob';
  if (p === 'local') return 'local';
  return process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'local';
}

function cleanPrefix(prefix: string): string {
  return prefix.replace(/^\/+|\/+$/g, '');
}

/**
 * Generic save. Prefer the module-specific helpers below (`saveBidFile`,
 * `saveProjectFile`) so callers don't have to know the path layout.
 *
 * pathPrefix is a posix path like "bids/<id>" or "projects/<id>". No leading
 * or trailing slashes.
 */
export async function saveFile(
  file: File,
  pathPrefix: string,
  opts: ValidateOpts = {},
): Promise<SavedFile> {
  const { ext } = validateFile(file, opts);
  const storedName = `${randomUUID()}.${ext}`;
  const prefix = cleanPrefix(pathPrefix);
  const key = `${prefix}/${storedName}`;

  if (currentProvider() === 'blob') {
    const result = await put(key, file, {
      access: 'public',
      contentType: file.type || undefined,
      // Our UUID already makes the key unique; don't double-suffix.
      addRandomSuffix: false,
    });
    return {
      url: result.url,
      fileName: file.name,
      fileSizeKb: Math.ceil(file.size / 1024),
      fileType: ext,
    };
  }

  // local — write to public/uploads/<prefix>/<uuid>.<ext>
  const dir = path.join(process.cwd(), 'public', 'uploads', ...prefix.split('/'));
  await mkdir(dir, { recursive: true });
  const absPath = path.join(dir, storedName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absPath, buffer);

  return {
    url: `/uploads/${key}`,
    fileName: file.name,
    fileSizeKb: Math.ceil(file.size / 1024),
    fileType: ext,
  };
}

/**
 * Delete a file previously produced by saveFile(). Accepts both
 * Vercel Blob URLs and /uploads/... local paths; silently skips anything else.
 */
export async function deleteFile(url: string): Promise<void> {
  if (!url) return;

  // Vercel Blob public URLs always live on *.public.blob.vercel-storage.com
  if (/\.blob\.vercel-storage\.com\//i.test(url)) {
    try {
      await del(url);
    } catch {
      throw new StorageError(`Failed to delete blob: ${url}`, 'IO');
    }
    return;
  }

  // Local filesystem under /public/uploads/
  if (url.startsWith('/uploads/')) {
    const rel = url.replace(/^\//, '');
    const abs = path.join(process.cwd(), 'public', rel);
    try {
      await unlink(abs);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== 'ENOENT') {
        throw new StorageError(`Failed to delete file: ${url}`, 'IO');
      }
    }
  }
}

// ============================================================
// Module-specific helpers — keep the path layout in one place.
// ============================================================

/** Bid attachments: 50MB cap, bid-specific extension whitelist. */
export async function saveBidFile(file: File, bidId: string): Promise<SavedFile> {
  return saveFile(file, `bids/${bidId}`);
}

/**
 * Project (takeoff) documents: 200MB cap, broader extension whitelist
 * (dwg/dxf/rvt/zip + the usual).
 */
export async function saveProjectFile(file: File, projectId: string): Promise<SavedFile> {
  return saveFile(file, `projects/${projectId}`, {
    maxSize: PROJECT_DOC_MAX_SIZE_BYTES,
    allowedExts: PROJECT_DOC_ALLOWED_EXTENSIONS,
  });
}

/** Company logo: 5MB cap, image-only. Used in proposal headers. */
export async function saveCompanyLogo(file: File, companyId: string): Promise<SavedFile> {
  return saveFile(file, `companies/${companyId}/logo`, {
    maxSize: 5 * 1024 * 1024,
    allowedExts: ['png', 'jpg', 'jpeg', 'webp', 'svg'],
  });
}
