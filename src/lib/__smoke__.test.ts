import { describe, it, expect } from 'vitest';

describe('Vitest smoke test', () => {
  it('runs basic assertions', () => {
    expect(2 + 2).toBe(4);
    expect('hello').toContain('ell');
    expect([1, 2, 3]).toHaveLength(3);
  });

  it('handles async correctly', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });

  it('respects TypeScript types', () => {
    const fn = (x: number): number => x * 2;
    expect(fn(5)).toBe(10);
  });
});
