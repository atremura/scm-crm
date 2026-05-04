import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type LogoBuffer = {
  buffer: Buffer;
  extension: 'png' | 'jpeg' | 'gif';
};

/**
 * Loads a Company.logoUrl into a buffer suitable for exceljs.addImage().
 * Supports both Vercel Blob URLs and local /uploads/... paths.
 *
 * exceljs.addImage only accepts png/jpeg/gif. Returns null on any failure
 * (template falls back to text-only header) — never throws.
 */
export async function loadLogoBuffer(logoUrl: string | null): Promise<LogoBuffer | null> {
  if (!logoUrl) return null;
  try {
    let buffer: Buffer;
    if (/^https?:\/\//i.test(logoUrl)) {
      const res = await fetch(logoUrl);
      if (!res.ok) return null;
      buffer = Buffer.from(await res.arrayBuffer());
    } else if (logoUrl.startsWith('/uploads/')) {
      const rel = logoUrl.replace(/^\//, '');
      buffer = await readFile(path.join(process.cwd(), 'public', rel));
    } else {
      return null;
    }

    // Sniff format from URL extension. SVG isn't supported by exceljs —
    // skip silently.
    const lower = logoUrl.toLowerCase();
    if (lower.endsWith('.png') || lower.endsWith('.webp')) {
      // exceljs can read most PNG/WebP via the png decoder
      return { buffer, extension: 'png' };
    }
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      return { buffer, extension: 'jpeg' };
    }
    if (lower.endsWith('.gif')) {
      return { buffer, extension: 'gif' };
    }
    return null;
  } catch (err) {
    console.warn('[exports.logo] failed to load:', err);
    return null;
  }
}
