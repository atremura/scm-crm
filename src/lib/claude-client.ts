import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

let _client: Anthropic | null = null;

/**
 * Read ANTHROPIC_API_KEY from process.env first, then fall back to
 * parsing .env directly. This handles Windows + Claude Code SDK
 * environments where the shell session ships ANTHROPIC_API_KEY="" —
 * dotenv refuses to overwrite an existing-but-empty var, so Next.js's
 * normal .env loading silently keeps the empty string.
 */
function resolveApiKey(): string | null {
  const fromEnv = (process.env.ANTHROPIC_API_KEY ?? '').trim();
  if (fromEnv.length > 0) return fromEnv;

  // Fallback: parse .env at project root
  try {
    const envPath = join(process.cwd(), '.env');
    if (!existsSync(envPath)) return null;
    const text = readFileSync(envPath, 'utf8');
    const match = text.match(/^ANTHROPIC_API_KEY\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\r\n]+))/m);
    if (match) {
      const v = (match[1] ?? match[2] ?? match[3] ?? '').trim();
      if (v.length > 0) return v;
    }
  } catch {
    // Ignore — caller below throws a clear error.
  }
  return null;
}

/**
 * Singleton Anthropic client. Reads ANTHROPIC_API_KEY from env (with
 * a .env fallback for Windows / Claude Code SDK shells).
 * Throws a clear error if the key is missing so callers fail fast.
 */
export function claude(): Anthropic {
  if (!_client) {
    const apiKey = resolveApiKey();
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is not set. Add it to .env to enable AI extraction.'
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export const EXTRACTION_MODEL = 'claude-opus-4-7';

/** Pricing per 1M tokens in USD cents (×100 for storage as Decimal cents) */
const OPUS_47_INPUT_CENTS_PER_1M = 500; // $5.00 → 500¢
const OPUS_47_OUTPUT_CENTS_PER_1M = 2500; // $25.00 → 2500¢
const OPUS_47_CACHE_READ_CENTS_PER_1M = 50; // ~10% of input

/**
 * Compute the approximate cost of a Claude call in cents (Decimal-friendly).
 * Cache reads are billed at ~10% of normal input price.
 */
export function costForUsage(usage: {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}): number {
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheCreate = usage.cache_creation_input_tokens ?? 0;
  // Cache creation costs ~1.25× input price
  const inputCents =
    (usage.input_tokens / 1_000_000) * OPUS_47_INPUT_CENTS_PER_1M +
    (cacheCreate / 1_000_000) * OPUS_47_INPUT_CENTS_PER_1M * 1.25 +
    (cacheRead / 1_000_000) * OPUS_47_CACHE_READ_CENTS_PER_1M;
  const outputCents = (usage.output_tokens / 1_000_000) * OPUS_47_OUTPUT_CENTS_PER_1M;
  return Math.round((inputCents + outputCents) * 10000) / 10000; // 4 decimal places
}
