import { z } from 'zod';
import { VALID_PRIORITIES } from '@/lib/bid-utils';

/**
 * Strict Zod schema for what Claude must return when reading a bid email.
 * Every field is nullable so the model can express "not stated in the email"
 * instead of guessing. confidence + flags let the user judge quality.
 */
export const ExtractedBidSchema = z.object({
  // Client / sender
  companyName: z
    .string()
    .nullable()
    .describe('General contractor / company that sent this bid invite'),
  contactName: z.string().nullable().describe('Person who sent the email'),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),

  // Project basics
  projectName: z
    .string()
    .nullable()
    .describe('Short name of the project, e.g. "Seaport Tower — Interior Buildout"'),
  projectAddress: z
    .string()
    .nullable()
    .describe('Full job-site address. Include city + state + zip if mentioned.'),
  workType: z
    .string()
    .nullable()
    .describe(
      'Trade. Choose one of: Finish Carpentry, Siding, Sheet Metal, Roofing, General Construction. Use "Other" + describe if none fit.'
    ),
  responseDeadline: z
    .string()
    .nullable()
    .describe(
      'Deadline to submit the bid back to the GC, ISO 8601 date (YYYY-MM-DD). Resolve "next Friday" / "by EOW" relative to the email date.'
    ),
  priority: z
    .enum(VALID_PRIORITIES)
    .nullable()
    .describe(
      'Inferred from urgency in the email language. urgent if same-day, high if <3 days or "ASAP", medium default, low for distant deadlines.'
    ),

  // Industry-specific flags
  bondRequired: z.boolean().nullable(),
  unionJob: z.boolean().nullable(),
  prevailingWage: z.boolean().nullable(),
  davisBacon: z.boolean().nullable(),
  insuranceRequirements: z
    .string()
    .nullable()
    .describe('Insurance specifics if mentioned (limits, OCIP/CCIP, additional insured)'),

  // Auditor outputs
  notes: z
    .string()
    .nullable()
    .describe('Anything else in the email worth knowing — scope notes, walkthrough times, etc.'),
  summary: z.string().describe('1-2 sentence overview of what this bid is about'),
  confidenceOverall: z
    .number()
    .min(0)
    .max(100)
    .describe('Self-assessed extraction quality, 0-100'),
  flags: z
    .array(z.string())
    .describe(
      'Warnings or ambiguities you noticed: missing critical info, unclear deadline, address looks ambiguous, etc.'
    ),
});

export type ExtractedBid = z.infer<typeof ExtractedBidSchema>;

/**
 * Stable system prompt — cached aggressively across calls. Keep deterministic;
 * never interpolate timestamps, request IDs, or per-user data here.
 */
export const EXTRACTION_SYSTEM_PROMPT = `You are an extraction assistant for a construction-industry CRM. Your job: read a single bid-invitation email and return structured fields ready to populate a "new bid" form.

Hard rules:
- Use the JSON schema EXACTLY. Every field is required in shape, but use null when the email doesn't say.
- Never invent. If the email doesn't mention bond requirements, return null — not false.
- Resolve relative dates ("by Friday", "EOW", "next Tuesday") against the email's date if present, otherwise against the date the user provided. Output ISO 8601 (YYYY-MM-DD).
- workType: pick the closest of [Finish Carpentry, Siding, Sheet Metal, Roofing, General Construction, Other]. If you say "Other", explain in notes.
- summary: 1-2 sentences, plain English, neutral tone. No emojis, no salesy language.
- confidenceOverall: be honest. 90+ only if every key field (client, project, deadline, address) was clearly stated. 50-70 if you guessed several fields. <50 if it's barely a bid email.
- flags: surface anything a human reviewer should double-check before accepting — e.g. "deadline language is ambiguous", "no address", "could be a duplicate of an earlier email".

You will receive the email body (and possibly subject + sender) inside <email> tags. Return your structured result via the provided format.`;

export type ExtractInput = {
  rawEmail: string;
  subject?: string | null;
  fromAddress?: string | null;
  preferredWorkTypes?: string | null;
  baseLocation?: string | null;
  receivedDate?: string | null; // ISO date, used for relative date resolution
};

export function buildUserMessage(input: ExtractInput): string {
  const lines: string[] = [];
  if (input.preferredWorkTypes) {
    lines.push(`Our preferred work types: ${input.preferredWorkTypes}`);
  }
  if (input.baseLocation) {
    lines.push(`Our base location: ${input.baseLocation}`);
  }
  if (input.receivedDate) {
    lines.push(`Email received on: ${input.receivedDate}`);
  }
  lines.push('Extract the bid details from the following email:');
  lines.push('');
  lines.push('<email>');
  if (input.subject) lines.push(`Subject: ${input.subject}`);
  if (input.fromAddress) lines.push(`From: ${input.fromAddress}`);
  if (input.subject || input.fromAddress) lines.push('');
  lines.push(input.rawEmail.trim());
  lines.push('</email>');
  return lines.join('\n');
}
