'use client';

import { useEffect } from 'react';

/**
 * Catastrophic boundary — catches errors that escape the root layout
 * itself. Reaching this boundary is rare (and severe), so the markup
 * is intentionally dependency-free: no shadcn, no Tailwind class names,
 * no Link. Inline styles only. The layout that loads our design system
 * has failed; we cannot trust anything downstream of it.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to server (visible in Vercel logs)
    console.error('[global-error]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          background: '#fafafa',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 32,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <h1
            style={{
              fontSize: 24,
              fontWeight: 600,
              margin: '0 0 12px 0',
              color: '#111',
            }}
          >
            Something went seriously wrong
          </h1>
          <p
            style={{
              color: '#666',
              fontSize: 15,
              lineHeight: 1.5,
              margin: '0 0 24px 0',
            }}
          >
            The application encountered a critical error and cannot recover. We&apos;ve been
            notified and are looking into it.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 12,
                color: '#999',
                fontFamily: 'monospace',
                margin: '0 0 24px 0',
              }}
            >
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              background: '#0070f3',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
