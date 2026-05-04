import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import { claude, EXTRACTION_MODEL, costForUsage } from '@/lib/claude-client';
import {
  ExtractedBidSchema,
  EXTRACTION_SYSTEM_PROMPT,
  buildUserMessage,
} from '@/lib/bid-extraction';

const requestSchema = z.object({
  rawEmail: z.string().min(20),
  subject: z.string().optional().nullable(),
  fromAddress: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'bid', 'create'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let parsed;
  try {
    const body = await req.json();
    parsed = requestSchema.parse(body);
  } catch (err: any) {
    const issue = err?.issues?.[0]?.message ?? err?.message ?? 'Invalid payload';
    return NextResponse.json({ error: issue }, { status: 400 });
  }

  // Pull contextual settings to help the model resolve relative dates and infer work type.
  // Settings are scoped per company; base_address also lives on Company.
  const [preferredRow, company] = await Promise.all([
    prisma.systemSetting.findUnique({
      where: { companyId_key: { companyId: ctx.companyId, key: 'preferred_work_types' } },
    }),
    prisma.company.findUnique({
      where: { id: ctx.companyId },
      select: { baseAddress: true },
    }),
  ]);

  const userMessage = buildUserMessage({
    rawEmail: parsed.rawEmail,
    subject: parsed.subject ?? null,
    fromAddress: parsed.fromAddress ?? null,
    preferredWorkTypes: preferredRow?.value ?? null,
    baseLocation: company?.baseAddress ?? null,
    receivedDate: new Date().toISOString().slice(0, 10),
  });

  let response;
  try {
    // Use messages.parse() — validates response against the Zod schema and
    // returns parsed_output already typed. zodOutputFormat handles wiring.
    response = await claude().messages.parse({
      model: EXTRACTION_MODEL,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      // Cache the system prompt — it doesn't change between calls.
      system: [
        {
          type: 'text',
          text: EXTRACTION_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
      output_config: {
        // SDK 0.90 dropped the second `name` argument from zodOutputFormat —
        // the schema's name is now derived from the Zod type itself.
        format: zodOutputFormat(ExtractedBidSchema),
      },
    });
  } catch (err: any) {
    console.error('[bids.extract.POST] Claude error:', err?.message ?? err);
    if (err?.status === 401) {
      return NextResponse.json(
        { error: 'Anthropic API key is invalid or missing' },
        { status: 500 },
      );
    }
    if (err?.status === 429) {
      return NextResponse.json(
        { error: 'Rate limited by the AI service. Please retry in a moment.' },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: err?.message ?? 'AI extraction failed' }, { status: 500 });
  }

  const data = response.parsed_output;
  if (!data) {
    return NextResponse.json(
      { error: 'AI returned no parseable output. Try again with a longer email body.' },
      { status: 500 },
    );
  }

  const usage = response.usage;
  const cost = costForUsage(usage);

  try {
    const record = await prisma.bidExtraction.create({
      data: {
        companyId: ctx.companyId,
        rawEmail: parsed.rawEmail,
        emailSubject: parsed.subject ?? null,
        fromAddress: parsed.fromAddress ?? null,
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
      select: {
        id: true,
        extractedData: true,
        confidence: true,
        flags: true,
        summary: true,
        modelUsed: true,
        inputTokens: true,
        outputTokens: true,
        cacheReadTokens: true,
        costCents: true,
        createdAt: true,
      },
    });
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    console.error('[bids.extract.POST] DB error:', err);
    return NextResponse.json({ error: 'Failed to save extraction' }, { status: 500 });
  }
}
