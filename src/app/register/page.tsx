'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export default function RegisterPage() {
  const router = useRouter();

  // Company
  const [companyName, setCompanyName] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [baseAddress, setBaseAddress] = useState('');

  // Admin
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleCompanyNameChange(v: string) {
    setCompanyName(v);
    if (!slugManuallyEdited) {
      setCompanySlug(slugify(v));
    }
  }

  function handleSlugChange(v: string) {
    setSlugManuallyEdited(true);
    setCompanySlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (adminPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (adminPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!companySlug) {
      setError('Company slug is required');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          companySlug,
          baseAddress: baseAddress || null,
          adminName,
          adminEmail,
          adminPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Failed to create account');
        setLoading(false);
        return;
      }
      router.push('/login?registered=1');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-app lg:grid-cols-2">
      {/* LEFT — visual hero */}
      <div className="relative hidden flex-col items-center justify-center gap-10 overflow-hidden px-12 py-12 text-white lg:flex">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 80% at 30% 20%, #16295C 0%, #0E1E46 50%, #070C1F 100%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 80% 90%, rgba(58,90,122,0.30), transparent 40%), radial-gradient(circle at 20% 10%, rgba(58,90,122,0.20), transparent 30%)',
          }}
        />

        <div className="relative flex w-full flex-col items-center gap-2">
          <div className="text-[52px] font-bold leading-none tracking-[-0.04em] text-white">
            SCM
          </div>
          <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/55">
            System Construction Modular
          </div>
        </div>

        <div className="relative max-w-[460px] text-center">
          <h1 className="text-[36px] font-bold leading-[1.1] tracking-[-0.02em]">
            Set up your company<br />
            <span className="text-blue-400">in minutes.</span>
          </h1>
          <p className="mt-4 text-[14.5px] leading-[1.6] text-white/70">
            Create your SCM workspace, invite your team, and start capturing
            bids — all in one system built for construction.
          </p>
        </div>
      </div>

      {/* RIGHT — form */}
      <div className="flex flex-col items-center justify-center px-6 py-8 sm:px-12">
        <div className="w-full max-w-[440px]">
          <div className="mb-6 flex flex-col items-center gap-1 lg:hidden">
            <div className="text-[28px] font-bold leading-none tracking-[-0.03em] text-fg-default">
              SCM
            </div>
            <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-fg-subtle">
              System Construction Modular
            </div>
          </div>

          <h2 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-fg-default">
            Create your account
          </h2>
          <p className="mt-1.5 text-[13.5px] text-fg-muted">
            Set up your company and admin account to get started.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            {/* Company section */}
            <FieldGroup label="Company">
              <Field label="Company name" htmlFor="companyName">
                <input
                  id="companyName"
                  type="text"
                  value={companyName}
                  onChange={(e) => handleCompanyNameChange(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="Acme Construction"
                  className={inputCls}
                />
              </Field>
              <Field
                label="Company slug"
                htmlFor="companySlug"
                hint="Used for your workspace URL. Letters, numbers, and hyphens only."
              >
                <input
                  id="companySlug"
                  type="text"
                  value={companySlug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="acme"
                  className={inputCls}
                />
              </Field>
              <Field
                label="Base address"
                htmlFor="baseAddress"
                hint="Optional — used for distance-based bid qualification."
              >
                <input
                  id="baseAddress"
                  type="text"
                  value={baseAddress}
                  onChange={(e) => setBaseAddress(e.target.value)}
                  disabled={loading}
                  placeholder="Boston, MA"
                  className={inputCls}
                />
              </Field>
            </FieldGroup>

            {/* Admin section */}
            <FieldGroup label="Your admin account">
              <Field label="Your name" htmlFor="adminName">
                <input
                  id="adminName"
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="name"
                  className={inputCls}
                />
              </Field>
              <Field label="Your email" htmlFor="adminEmail">
                <input
                  id="adminEmail"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="email"
                  placeholder="you@company.com"
                  className={inputCls}
                />
              </Field>
              <Field label="Password" htmlFor="adminPassword" hint="At least 8 characters.">
                <div className="relative">
                  <input
                    id="adminPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="new-password"
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md text-fg-muted transition-colors hover:bg-sunken hover:text-fg-default"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <Field label="Confirm password" htmlFor="confirmPassword">
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  className={inputCls}
                />
              </Field>
            </FieldGroup>

            {error && (
              <div className="rounded-md border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12.5px] text-danger-500">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 inline-flex h-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-4 text-[14px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-[13px] text-fg-muted">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-blue-400 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'h-[40px] w-full rounded-lg border border-border bg-surface px-3.5 text-[13.5px] text-fg-default placeholder:text-fg-subtle focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60';

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
        {label}
      </h3>
      {children}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-fg-default">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11.5px] text-fg-subtle">{hint}</p>}
    </div>
  );
}
