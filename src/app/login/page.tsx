'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get('registered') === '1';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
        setLoading(false);
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-app lg:grid-cols-2">
      {/* LEFT — visual hero (hidden on mobile) */}
      <div className="relative hidden flex-col items-center justify-center gap-12 overflow-hidden px-12 py-12 text-white lg:flex">
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
          <div className="text-[56px] font-bold leading-none tracking-[-0.04em] text-white">
            SCM
          </div>
          <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/55">
            System Construction Modular
          </div>
        </div>

        <div className="relative max-w-[480px] text-center">
          <h1 className="text-[44px] font-bold leading-[1.08] tracking-[-0.025em]">
            Every bid.
            <br />
            Every project.
            <br />
            <span className="text-blue-400">One system.</span>
          </h1>
          <p className="mt-4 text-[15px] leading-[1.6] text-white/70">
            From bid capture to field execution — SCM replaces the
            spreadsheets, the email threads, and the back-of-envelope math with a
            single source of truth, powered by AI.
          </p>
        </div>

        <div className="relative flex gap-8">
          <StatPill label="Active Bids" value="24" />
          <StatPill label="Pipeline" value="$4.8M" />
          <StatPill label="Win Rate" value="34%" />
        </div>
      </div>

      {/* RIGHT — form */}
      <div className="flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-[380px]">
          {/* Mobile-only brand */}
          <div className="mb-6 flex flex-col items-center gap-1 lg:hidden">
            <div className="text-[32px] font-bold leading-none tracking-[-0.03em] text-fg-default">
              SCM
            </div>
            <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-fg-subtle">
              System Construction Modular
            </div>
          </div>

          <h2 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-fg-default">
            Sign in to SCM
          </h2>
          <p className="mt-1.5 text-[14px] text-fg-muted">
            Sign in to manage your construction projects.
          </p>

          {justRegistered && (
            <div className="mt-5 rounded-md border border-success-500/30 bg-success-500/10 px-3 py-2.5 text-[12.5px] text-success-500">
              Account created! Please log in with your new credentials.
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-[13px] font-semibold text-fg-default">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
                disabled={loading}
                className="h-[42px] rounded-lg border border-border bg-surface px-3.5 text-[13.5px] text-fg-default placeholder:text-fg-subtle focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[13px] font-semibold text-fg-default">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  className="h-[42px] w-full rounded-lg border border-border bg-surface px-3.5 pr-10 text-[13.5px] text-fg-default placeholder:text-fg-subtle focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
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
            </div>

            <div className="flex items-center justify-between text-[13px]">
              <label className="flex cursor-pointer items-center gap-2 text-fg-muted">
                <input
                  type="checkbox"
                  checked={keepSignedIn}
                  onChange={(e) => setKeepSignedIn(e.target.checked)}
                  className="h-[15px] w-[15px] cursor-pointer accent-blue-500"
                />
                Keep me signed in
              </label>
              <Link href="#" className="font-medium text-blue-400 hover:underline">
                Forgot password?
              </Link>
            </div>

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
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="my-6 flex items-center gap-2.5 text-[12px] text-fg-subtle">
            <span className="h-px flex-1 bg-border" />
            or continue with
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <SsoButton provider="google" />
            <SsoButton provider="microsoft" />
          </div>

          <p className="mt-6 text-center text-[13px] text-fg-muted">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-semibold text-blue-400 hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-left">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/55">
        {label}
      </div>
      <div className="mt-1 text-[24px] font-bold tracking-[-0.02em]">{value}</div>
    </div>
  );
}

function SsoButton({ provider }: { provider: 'google' | 'microsoft' }) {
  return (
    <button
      type="button"
      disabled
      title="Coming soon"
      className="inline-flex h-[42px] items-center justify-center gap-2 rounded-lg border border-border bg-surface text-[13px] font-medium text-fg-default transition-colors hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-60"
    >
      {provider === 'google' ? (
        <svg width="16" height="16" viewBox="0 0 48 48">
          <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 23 23">
          <rect width="10" height="10" x="1" y="1" fill="#F25022" />
          <rect width="10" height="10" x="12" y="1" fill="#7FBA00" />
          <rect width="10" height="10" x="1" y="12" fill="#00A4EF" />
          <rect width="10" height="10" x="12" y="12" fill="#FFB900" />
        </svg>
      )}
      {provider === 'google' ? 'Google' : 'Microsoft'}
    </button>
  );
}
