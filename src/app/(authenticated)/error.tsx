'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Boundary for the authenticated area (estimates, bids, takeoff, clients,
 * users, settings, etc). The (authenticated) layout — including the
 * sidebar — is preserved by Next when this boundary renders, so the user
 * keeps their navigation context. The 'Dashboard' link sends them to
 * /dashboard, the canonical landing for signed-in users.
 */
export default function AuthenticatedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[authenticated-error]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="flex items-center justify-center p-6 min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <CardTitle>This page failed to load</CardTitle>
          <CardDescription>
            Something unexpected happened. Try again, or go back to the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error.digest && (
            <p className="text-xs text-muted-foreground font-mono">Error ID: {error.digest}</p>
          )}
          <div className="flex gap-2">
            <Button onClick={reset} variant="default">
              <RotateCcw className="w-4 h-4 mr-2" />
              Try again
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
