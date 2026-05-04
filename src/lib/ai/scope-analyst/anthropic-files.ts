import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { toFile } from '@anthropic-ai/sdk/uploads';
import { claude } from '@/lib/claude-client';
import { prisma } from '@/lib/prisma';

/**
 * Required beta header for Anthropic Files API access. Bumped when
 * Anthropic graduates the API out of beta — keep an eye on
 * https://docs.anthropic.com/en/docs/build-with-claude/files for changes.
 */
export const FILES_API_BETA = 'files-api-2025-04-14';

/**
 * Lazily ensures a ProjectDocument is uploaded to the Anthropic Files
 * API and returns its file_id. Subsequent calls reuse the cached id
 * stored in `project_documents.anthropic_file_id`.
 *
 * Strategy:
 *   1. Read the cached anthropicFileId; if present, return it.
 *   2. Otherwise resolve the document bytes:
 *      - Vercel Blob URL (https) — fetch via HTTP
 *      - Local /uploads/...     — read from filesystem
 *   3. Upload via client.beta.files.upload(...) — works for files up to 500 MB.
 *   4. Persist the file_id back to the row so re-runs skip the upload.
 *
 * Files API operations are FREE (no storage cost). We only pay for
 * input tokens when the PDF is actually processed in a Messages call.
 */
export async function ensureAnthropicFileId(
  documentId: string,
  companyId: string,
): Promise<string> {
  const doc = await prisma.projectDocument.findFirst({
    where: { id: documentId, companyId },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      fileType: true,
      anthropicFileId: true,
    },
  });
  if (!doc) {
    throw new Error(`Document ${documentId} not found for company ${companyId}`);
  }
  if (doc.anthropicFileId) {
    return doc.anthropicFileId;
  }

  // Read the bytes — local /uploads/... or remote https://...
  let bytes: Buffer;
  if (/^https?:\/\//i.test(doc.fileUrl)) {
    const res = await fetch(doc.fileUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch document ${doc.id}: HTTP ${res.status} ${res.statusText}`);
    }
    const ab = await res.arrayBuffer();
    bytes = Buffer.from(ab);
  } else if (doc.fileUrl.startsWith('/uploads/')) {
    const rel = doc.fileUrl.replace(/^\//, '');
    bytes = await readFile(path.join(process.cwd(), 'public', rel));
  } else {
    throw new Error(`Unsupported document URL scheme for ${doc.id}: ${doc.fileUrl}`);
  }

  // The SDK helper `toFile` wraps a Buffer/Stream into the multipart
  // upload format. Pass MIME type explicitly so Anthropic indexes it
  // correctly (their server-side defaults are unreliable with .pdf
  // extensions only).
  const mimeType = guessMimeType(doc.fileType, doc.fileName);
  const fileForUpload = await toFile(bytes, doc.fileName, {
    type: mimeType,
  });

  // 30-minute timeout for large PDFs. The SDK default is short and
  // chokes on multi-hundred-MB files even on a fast connection.
  const uploaded = await claude().beta.files.upload(
    {
      file: fileForUpload,
    },
    {
      headers: { 'anthropic-beta': FILES_API_BETA },
      timeout: 30 * 60 * 1000,
    },
  );

  await prisma.projectDocument.update({
    where: { id: doc.id },
    data: { anthropicFileId: uploaded.id },
  });

  return uploaded.id;
}

function guessMimeType(fileType: string | null, fileName: string): string {
  const ext = (fileType ?? fileName.split('.').pop() ?? '').toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}
