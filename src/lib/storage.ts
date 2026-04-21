import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { MAX_FILE_SIZE_BYTES, ALLOWED_EXTENSIONS } from '@/lib/bid-utils';

export { MAX_FILE_SIZE_BYTES, ALLOWED_EXTENSIONS };

export type SavedFile = {
  url: string; // e.g. /uploads/bids/{bidId}/{uuid}.pdf
  fileName: string; // original file name
  fileSizeKb: number;
  fileType: string; // lowercase extension (pdf, dwg, ...)
};

export class StorageError extends Error {
  constructor(message: string, public readonly code: 'TOO_LARGE' | 'BAD_TYPE' | 'IO') {
    super(message);
    this.name = 'StorageError';
  }
}

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  if (idx === -1) return '';
  return fileName.slice(idx + 1).toLowerCase();
}

export function validateFile(file: File): { ext: string } {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new StorageError(
      `File "${file.name}" exceeds the 50MB limit`,
      'TOO_LARGE'
    );
  }
  const ext = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new StorageError(
      `File type .${ext || '(unknown)'} not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      'BAD_TYPE'
    );
  }
  return { ext };
}

export async function saveFile(file: File, bidId: string): Promise<SavedFile> {
  const { ext } = validateFile(file);

  const dir = path.join(process.cwd(), 'public', 'uploads', 'bids', bidId);
  await mkdir(dir, { recursive: true });

  const storedName = `${randomUUID()}.${ext}`;
  const absPath = path.join(dir, storedName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absPath, buffer);

  return {
    url: `/uploads/bids/${bidId}/${storedName}`,
    fileName: file.name,
    fileSizeKb: Math.ceil(file.size / 1024),
    fileType: ext,
  };
}

export async function deleteFile(url: string): Promise<void> {
  if (!url.startsWith('/uploads/')) return;
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
