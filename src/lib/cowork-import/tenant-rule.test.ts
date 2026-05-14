import { describe, it, expect } from 'vitest';
import { checkTenantSlugMatch } from './tenant-rule';

describe('checkTenantSlugMatch (Rule 8)', () => {
  it('passes when payload tenant_slug matches session', () => {
    const result = checkTenantSlugMatch('awg', 'awg');
    expect(result).toBeNull();
  });

  it('fails (BLOCKER) when payload tenant_slug differs from session', () => {
    const result = checkTenantSlugMatch('other-tenant', 'awg');
    expect(result).not.toBeNull();
    expect(result?.rule).toBe('TENANT_SLUG_MATCH');
    expect(result?.severity).toBe('BLOCKER');
    expect(result?.message).toContain('other-tenant');
    expect(result?.message).toContain('awg');
    expect(result?.context).toMatchObject({
      payloadTenantSlug: 'other-tenant',
      sessionTenantSlug: 'awg',
    });
  });

  it('fails (BLOCKER) when payload tenant_slug is null', () => {
    const result = checkTenantSlugMatch(null, 'awg');
    expect(result).not.toBeNull();
    expect(result?.rule).toBe('TENANT_SLUG_MATCH');
    expect(result?.severity).toBe('BLOCKER');
    expect(result?.message).toContain('missing');
    expect(result?.context).toMatchObject({
      payloadTenantSlug: null,
      sessionTenantSlug: 'awg',
    });
  });

  it('fails (BLOCKER) when payload tenant_slug is undefined', () => {
    const result = checkTenantSlugMatch(undefined, 'awg');
    expect(result).not.toBeNull();
    expect(result?.rule).toBe('TENANT_SLUG_MATCH');
    expect(result?.severity).toBe('BLOCKER');
  });

  it('is case-sensitive (slugs are conventionally lowercase)', () => {
    const result = checkTenantSlugMatch('AWG', 'awg');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('BLOCKER');
  });
});
