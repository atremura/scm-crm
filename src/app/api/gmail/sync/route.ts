import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import {
  gmailClientFromRefresh,
  listRecentMatching,
  fetchMessage,
  DEFAULT_BID_QUERY,
} from '@/lib/gmail';
import {
  ExtractedBidSchema,
  EXTRACTION_SYSTEM_PROMPT,
  buildUserMessage,
} from '@/lib/bid-extraction';
import { claude, EXTRACTION_MODEL, costForUsage } from '@/lib/claude-client';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { evaluateBid, type AutoCaptureSettings } from '@/lib/bid-evaluator';
import { acceptExtractionAsBid } from '@/lib/bid-creator';

const MAX_PER_RUN = 10;

/**
 * Pull auto-capture config from system_settings (per company) with sensible defaults.
 * `max_distance_miles` lives on Company now — not in settings — so we fetch both.
 */
async function loadAutoCaptureSettings(companyId: string): Promise<AutoCaptureSettings> {
  const [rows, company] = await Promise.all([
    prisma.systemSetting.findMany({
      where: {
        companyId,
        key: {
          in: [
            'auto_create_bids',
            'auto_min_confidence',
            'auto_allowed_states',
            'auto_qualified_status',
          ],
        },
      },
    }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { maxDistanceMiles: true },
    }),
  ]);
  const map: Record<string, string> = {};
  rows.forEach((r) => (map[r.key] = r.value));
  const states = (map.auto_allowed_states ?? 'MA, NH, RI, CT, VT, ME')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const qualifiedStatus =
    (map.auto_qualified_status as 'new' | 'qualified' | undefined) ?? 'qualified';
  return {
    enabled: (map.auto_create_bids ?? 'false') === 'true',
    minConfidence: parseInt(map.auto_min_confidence ?? '70', 10) || 70,
    allowedStates: states,
    qualifiedStatus,
    maxDistanceMiles: company?.maxDistanceMiles ?? 100,
  };
}

export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'bid', 'create'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const customQuery = url.searchParams.get('q');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '5', 10) || 5, MAX_PER_RUN);

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { gmailRefreshToken: true, gmailEmail: true },
  });

  if (!user?.gmailRefreshToken) {
    return NextResponse.json(
      { error: 'Gmail is not connected. Connect it from Settings.' },
      { status: 400 },
    );
  }

  const gmail = gmailClientFromRefresh(user.gmailRefreshToken);
  const query = customQuery?.trim() || DEFAULT_BID_QUERY;

  let messageRefs: { id: string; threadId: string }[] = [];
  try {
    messageRefs = await listRecentMatching(gmail, query, limit);
  } catch (err: any) {
    console.error('[gmail.sync] list failed', err?.message);
    return NextResponse.json(
      {
        error: err?.message ?? 'Failed to list Gmail messages — try reconnecting Gmail',
      },
      { status: 500 },
    );
  }

  if (messageRefs.length === 0) {
    await prisma.user.update({
      where: { id: ctx.userId },
      data: { gmailLastSyncAt: new Date() },
    });
    return NextResponse.json({
      processed: 0,
      skipped: 0,
      created: 0,
      messages: [],
      query,
    });
  }

  // Dedupe: find messages we've already extracted in this company. The
  // emailSubject is tagged with `[gmail:<msgId>]` so we can match by prefix.
  const seenIds = new Set<string>();
  const allExtractions = await prisma.bidExtraction.findMany({
    where: {
      companyId: ctx.companyId,
      emailSubject: { startsWith: '[gmail:' },
      extractedBy: ctx.userId,
    },
    select: { emailSubject: true },
  });
  allExtractions.forEach((e) => {
    const m = e.emailSubject?.match(/^\[gmail:([^\]]+)\]/);
    if (m) seenIds.add(m[1]);
  });

  const results: Array<{
    id: string;
    subject: string | null;
    from: string | null;
    extractionId?: string;
    bidId?: string;
    bidNumber?: string;
    autoStatus?: 'qualified' | 'rejected' | 'pending_review';
    autoReason?: string;
    error?: string;
    skipped?: boolean;
  }> = [];

  // Pull contextual settings once — scoped to this company.
  // `base_address` lives on Company now; `preferred_work_types` is still in settings.
  const [preferredRow, company] = await Promise.all([
    prisma.systemSetting.findUnique({
      where: { companyId_key: { companyId: ctx.companyId, key: 'preferred_work_types' } },
    }),
    prisma.company.findUnique({
      where: { id: ctx.companyId },
      select: { baseAddress: true },
    }),
  ]);

  // Auto-capture rules — drives whether we auto-create bids or leave for review
  const autoSettings = await loadAutoCaptureSettings(ctx.companyId);

  let created = 0;
  let autoQualified = 0;
  let autoRejected = 0;

  for (const ref of messageRefs) {
    if (seenIds.has(ref.id)) {
      results.push({ id: ref.id, subject: null, from: null, skipped: true });
      continue;
    }

    let parsed;
    try {
      parsed = await fetchMessage(gmail, ref.id);
    } catch (err: any) {
      results.push({
        id: ref.id,
        subject: null,
        from: null,
        error: err?.message ?? 'fetch failed',
      });
      continue;
    }

    if (!parsed.body || parsed.body.length < 30) {
      results.push({
        id: ref.id,
        subject: parsed.subject,
        from: parsed.from,
        error: 'Body too short to extract',
      });
      continue;
    }

    const userMessage = buildUserMessage({
      rawEmail: parsed.body,
      subject: parsed.subject,
      fromAddress: parsed.from,
      preferredWorkTypes: preferredRow?.value ?? null,
      baseLocation: company?.baseAddress ?? null,
      receivedDate: parsed.date
        ? parsed.date.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    });

    let response;
    try {
      response = await claude().messages.parse({
        model: EXTRACTION_MODEL,
        max_tokens: 4096,
        thinking: { type: 'adaptive' },
        system: [
          {
            type: 'text',
            text: EXTRACTION_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userMessage }],
        output_config: {
          // SDK 0.90 dropped the second `name` argument from zodOutputFormat.
          format: zodOutputFormat(ExtractedBidSchema),
        },
      });
    } catch (err: any) {
      results.push({
        id: ref.id,
        subject: parsed.subject,
        from: parsed.from,
        error: `Claude error: ${err?.message ?? 'unknown'}`,
      });
      continue;
    }

    const data = response.parsed_output;
    if (!data) {
      results.push({
        id: ref.id,
        subject: parsed.subject,
        from: parsed.from,
        error: 'Claude returned no parsed output',
      });
      continue;
    }

    const usage = response.usage;
    const cost = costForUsage(usage);

    let extractionId: string;
    try {
      const record = await prisma.bidExtraction.create({
        data: {
          companyId: ctx.companyId,
          rawEmail: parsed.body,
          // Tag the subject so we can dedupe later
          emailSubject: `[gmail:${ref.id}] ${parsed.subject ?? ''}`.slice(0, 500),
          fromAddress: parsed.from,
          extractedData: data as any,
          confidence: data.confidenceOverall,
          flags: data.flags,
          summary: data.summary,
          attachments: parsed.attachments.length > 0 ? (parsed.attachments as any) : undefined,
          modelUsed: EXTRACTION_MODEL,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          cacheReadTokens: usage.cache_read_input_tokens ?? 0,
          costCents: cost,
          status: 'pending',
          extractedBy: ctx.userId,
        },
        select: { id: true },
      });
      extractionId = record.id;
      created++;
    } catch (err: any) {
      results.push({
        id: ref.id,
        subject: parsed.subject,
        from: parsed.from,
        error: `DB error: ${err?.message ?? 'unknown'}`,
      });
      continue;
    }

    // Auto-capture evaluation (only when feature is ON and confidence is high enough)
    const decision = await evaluateBid(
      {
        projectAddress: data.projectAddress ?? null,
        stateHint: null, // rely on address parsing inside evaluator
        confidence: Number(data.confidenceOverall) || 0,
      },
      autoSettings,
    );

    if (decision.decision === 'needs_manual_review') {
      // Leave as pending — the usual review flow picks it up
      results.push({
        id: ref.id,
        subject: parsed.subject,
        from: parsed.from,
        extractionId,
        autoStatus: 'pending_review',
        autoReason: decision.reason,
      });
      continue;
    }

    // Auto-create the bid + client
    const companyName = (data as any)?.companyName?.trim() ?? '';
    if (!companyName) {
      // Claude didn't find a sender company — safer to send to manual review
      results.push({
        id: ref.id,
        subject: parsed.subject,
        from: parsed.from,
        extractionId,
        autoStatus: 'pending_review',
        autoReason: 'No company name detected in email',
      });
      continue;
    }

    try {
      const status =
        decision.decision === 'auto_create_qualified' ? autoSettings.qualifiedStatus : 'rejected';
      const result = await acceptExtractionAsBid(extractionId, {
        companyId: ctx.companyId,
        actorUserId: ctx.userId,
        newClient: {
          companyName,
          type: 'General Contractor',
          contactName: (data as any)?.contactName ?? null,
          contactEmail: (data as any)?.contactEmail ?? null,
          contactPhone: (data as any)?.contactPhone ?? null,
        },
        forceStatus: status,
        statusNote:
          decision.decision === 'auto_create_rejected'
            ? `Auto-rejected: ${decision.reason}`
            : `Auto-qualified by rules`,
        prefilledLat: decision.lat,
        prefilledLng: decision.lng,
        prefilledDistance: decision.distanceMiles,
      });

      if (status === 'rejected') autoRejected++;
      else autoQualified++;

      results.push({
        id: ref.id,
        subject: parsed.subject,
        from: parsed.from,
        extractionId,
        bidId: result.bidId,
        bidNumber: result.bidNumber,
        autoStatus: status === 'rejected' ? 'rejected' : 'qualified',
        autoReason: decision.decision === 'auto_create_rejected' ? decision.reason : undefined,
      });
    } catch (err: any) {
      console.error('[gmail.sync auto-create]', err);
      results.push({
        id: ref.id,
        subject: parsed.subject,
        from: parsed.from,
        extractionId,
        error: `Auto-create failed: ${err?.message ?? 'unknown'}`,
      });
    }
  }

  await prisma.user.update({
    where: { id: ctx.userId },
    data: { gmailLastSyncAt: new Date() },
  });

  return NextResponse.json({
    processed: messageRefs.length,
    skipped: results.filter((r) => r.skipped).length,
    created,
    autoQualified,
    autoRejected,
    pendingReview: results.filter((r) => r.autoStatus === 'pending_review').length,
    autoEnabled: autoSettings.enabled,
    messages: results,
    query,
  });
}
