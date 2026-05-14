import { describe, it, expect } from 'vitest';
import { computeFileHash } from './compute-file-hash';

describe('computeFileHash', () => {
  it('produces a 64-character hex string (256 bits)', () => {
    const hash = computeFileHash('{"hello":"world"}');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic — same input produces same hash', () => {
    const input = '{"a":1,"b":2}';
    expect(computeFileHash(input)).toBe(computeFileHash(input));
  });

  it('different inputs produce different hashes', () => {
    const a = computeFileHash('{"a":1}');
    const b = computeFileHash('{"a":2}');
    expect(a).not.toBe(b);
  });

  it('whitespace differences produce different hashes (no canonicalization)', () => {
    // Caller is responsible for canonical serialization.
    const compact = computeFileHash('{"a":1}');
    const spaced = computeFileHash('{ "a": 1 }');
    expect(compact).not.toBe(spaced);
  });

  it('matches known SHA-256 fixture for the empty object', () => {
    // sha256("{}") in any reliable hex tool
    const hash = computeFileHash('{}');
    expect(hash).toBe('44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a');
  });
});
