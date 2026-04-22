import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/permissions';
import { exchangeCodeForTokens } from '@/lib/gmail';

export async function GET(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) {
    // No session — bounce them through login first
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // The settings page renders a banner for ?gmail=success / ?gmail=error
  const settingsUrl = new URL('/settings', req.url);

  if (error) {
    settingsUrl.searchParams.set('gmail', 'error');
    settingsUrl.searchParams.set('reason', error);
    return NextResponse.redirect(settingsUrl);
  }

  if (!code) {
    settingsUrl.searchParams.set('gmail', 'error');
    settingsUrl.searchParams.set('reason', 'missing_code');
    return NextResponse.redirect(settingsUrl);
  }

  // Defense-in-depth: state should match the authenticated user
  if (state && state !== ctx.userId) {
    settingsUrl.searchParams.set('gmail', 'error');
    settingsUrl.searchParams.set('reason', 'state_mismatch');
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await prisma.user.update({
      where: { id: ctx.userId },
      data: {
        gmailEmail: tokens.email,
        gmailRefreshToken: tokens.refreshToken,
        gmailConnectedAt: new Date(),
      },
    });
    settingsUrl.searchParams.set('gmail', 'success');
    settingsUrl.searchParams.set('email', tokens.email);
    return NextResponse.redirect(settingsUrl);
  } catch (err: any) {
    console.error('[gmail.callback]', err);
    settingsUrl.searchParams.set('gmail', 'error');
    settingsUrl.searchParams.set(
      'reason',
      err?.message?.slice(0, 80) ?? 'exchange_failed'
    );
    return NextResponse.redirect(settingsUrl);
  }
}
