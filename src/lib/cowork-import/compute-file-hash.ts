import { createHash } from 'crypto';

/**
 * Compute SHA-256 hash of a JSON string for file deduplication.
 *
 * Used by the import endpoint to enforce idempotency: the same
 * JSON content imported twice into the same project must collide
 * on the unique constraint [projectId, fileHash], producing a 409
 * response on the second attempt.
 *
 * The caller is responsible for ensuring the input is a stable,
 * canonical serialization (e.g., from JSON.stringify on the parsed
 * object) — otherwise minor formatting differences (whitespace,
 * key order) produce different hashes for semantically equal payloads.
 */
export function computeFileHash(jsonString: string): string {
  return createHash('sha256').update(jsonString, 'utf8').digest('hex');
}
