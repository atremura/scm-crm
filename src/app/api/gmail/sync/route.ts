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

const MAX_PER_RUN = 10;

export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'bid', 'create'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const customQuery = url.searchParams.get('q');
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') || '5', 10) || 5,
    MAX_PER_RUN
  );

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { gmailRefreshToken: true, gmailEmail: true },
  });

  if (!user?.gmailRefreshToken) {
    return NextResponse.json(
      { error: 'Gmail is not connected. Connect it from Settings.' },
      { status: 400 }
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
        error:
          err?.message ?? 'Failed to list Gmail messages — try reconnecting Gmail',
      },
      { status: 500 }
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

  // Skip messages we've already extracted before
  const existing = await prisma.bidExtraction.findMany({
    where: { fromAddress: { in: messageRefs.map((m) => m.id) } },
    select: { fromAddress: true },
  });
  // We use fromAddress as a soft "seen" key here. Simpler than a new column;
  // we tag the extraction's emailSubject with `[Gmail msg <id>]` so we can
  // also dedupe by subject prefix below.
  const seenIds = new Set<string>();
  const allExtractions = await prisma.bidExtraction.findMany({
    where: {
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
    error?: string;
    skipped?: boolean;
  }> = [];

  // Pull contextual settings once
  const [preferredRow, baseRow] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: 'preferred_work_types' } }),
    prisma.systemSetting.findUnique({ where: { key: 'base_address' } }),
  ]);

  let created = 0;

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
      baseLocation: baseRow?.value ?? null,
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
          format: zodOutputFormat(ExtractedBidSchema, 'extracted_bid'),
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

    try {
      const record = await prisma.bidExtraction.create({
        data: {
          rawEmail: parsed.body,
          // Tag the subject so we can dedupe later
          emailSubject: `[gmail:${ref.id}] ${parsed.subject ?? ''}`.slice(0, 500),
          fromAddress: parsed.from,
          extractedData: data as any,
          confidence: data.confidenceOverall,
          flags: data.flags,
          summary: data.summary,
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
      created++;
      results.push({
        id: ref.id,
        subject: parsed.subject,
        from: parsed.from,
        extractionId: record.id,
      });
    } catch (err: any) {
      results.push({
        id: ref.id,
        subject: parsed.subject,
        from: parsed.from,
        error: `DB error: ${err?.message ?? 'unknown'}`,
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
    messages: results,
    query,
  });
}
