import { claude, EXTRACTION_MODEL } from '@/lib/claude-client';
import { prisma } from '@/lib/prisma';
import { BASE_SYSTEM_PROMPT } from './base-prompt';
import { buildTenantContext } from './tenant-context';
import { ScopeAnalystOutput, SUBMIT_SCOPE_TOOL } from './output-schema';
import { PROMPT_VERSION } from './versions';
import { calculateCostCents } from './cost';
import { ensureAnthropicFileId, FILES_API_BETA } from './anthropic-files';

/**
 * Two-stage orchestration for scope-analyst runs.
 *
 *   startScopeAnalysis(...)   — synchronous: validates inputs, creates
 *                               the ProjectAnalysisRun row in `pending`
 *                               state, kicks off the async worker, and
 *                               returns the runId immediately. Endpoint
 *                               handlers call this so the HTTP request
 *                               doesn't block on a 5–10 minute upload +
 *                               analysis.
 *
 *   processScopeAnalysis(...) — async worker: uploads PDFs to Anthropic
 *                               Files API (lazy, cached), calls the
 *                               Messages API with forced tool_use,
 *                               validates the output via Zod, and
 *                               writes the result back to the run row.
 *                               Errors land as status='failed' +
 *                               errorMessage.
 *
 * The endpoint fires the worker without `await`-ing it. In Node.js
 * runtime (dev server + Vercel Node functions) the promise keeps
 * running after the response. For Vercel Edge / serverless we'd need
 * `after()` from `next/server` — not used here yet.
 */

export type StartScopeAnalysisInput = {
  companyId: string;
  projectId: string;
  /** ProjectDocument.id values to feed the model. Re-validated here. */
  documentIds: string[];
};

export type StartScopeAnalysisResult = {
  runId: string;
  status: 'pending';
};

/**
 * Public entrypoint. Returns immediately with a runId; the caller polls
 * GET /analysis-runs/[runId] for completion.
 */
export async function startScopeAnalysis(
  input: StartScopeAnalysisInput,
): Promise<StartScopeAnalysisResult> {
  if (input.documentIds.length === 0) {
    throw new Error('At least one document is required for analysis');
  }

  // Defensive re-validation: tenant + project ownership.
  const documents = await prisma.projectDocument.findMany({
    where: {
      id: { in: input.documentIds },
      companyId: input.companyId,
      projectId: input.projectId,
    },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      fileSizeKb: true,
    },
    orderBy: { uploadedAt: 'asc' },
  });
  if (documents.length === 0) {
    throw new Error('No documents matched the requested IDs for this project');
  }

  const requestPayload = {
    model: EXTRACTION_MODEL,
    promptVersion: PROMPT_VERSION,
    documentCount: documents.length,
    documentIds: documents.map((d) => d.id),
    documentSummaries: documents.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      sizeKb: d.fileSizeKb,
    })),
  };

  const run = await prisma.projectAnalysisRun.create({
    data: {
      companyId: input.companyId,
      projectId: input.projectId,
      modelUsed: EXTRACTION_MODEL,
      promptVersion: PROMPT_VERSION,
      documentIds: documents.map((d) => d.id),
      requestPayload: requestPayload as any,
      responsePayload: {},
      status: 'pending',
    },
    select: { id: true },
  });

  // Fire-and-forget. We do NOT await this — the worker runs in the
  // background, and the caller returns the runId now so the HTTP
  // request finishes fast.
  void processScopeAnalysis({
    runId: run.id,
    companyId: input.companyId,
    projectId: input.projectId,
    documentIds: documents.map((d) => d.id),
  }).catch((err) => {
    // The worker handles its own DB updates on error; this catch is
    // last-line defense to keep the unhandled-rejection trap happy.
    console.error('[scope-analyst.run] background worker failed', err);
  });

  return { runId: run.id, status: 'pending' };
}

// ============================================================
// Background worker
// ============================================================

type ProcessScopeAnalysisInput = {
  runId: string;
  companyId: string;
  projectId: string;
  documentIds: string[];
};

async function processScopeAnalysis(input: ProcessScopeAnalysisInput): Promise<void> {
  try {
    // Upload PDFs to Anthropic SEQUENTIALLY — running them in parallel
    // (Promise.all) holds multiple Prisma connections open during the
    // multi-minute uploads, exhausting the pool and starving the
    // frontend's status polling. Sequential is also kinder to Anthropic's
    // upload rate limit on multi-hundred-MB files. Lazy + cached: first
    // call uploads, re-runs reuse anthropicFileId on ProjectDocument.
    const documentRefs: Array<{
      id: string;
      fileName: string;
      anthropicFileId: string;
    }> = [];
    for (const docId of input.documentIds) {
      const fileId = await ensureAnthropicFileId(docId, input.companyId);
      const doc = await prisma.projectDocument.findUnique({
        where: { id: docId },
        select: { id: true, fileName: true },
      });
      if (!doc) continue;
      documentRefs.push({
        id: doc.id,
        fileName: doc.fileName,
        anthropicFileId: fileId,
      });
    }

    const tenantContext = await buildTenantContext(input.companyId);

    // Cache breakpoints (in order):
    //   1. tenant context — first text block
    //   2. all-but-last documents flow normally
    //   3. last document gets cache_control so re-runs reuse the long PDF
    const userContent: any[] = [
      {
        type: 'text',
        text: tenantContext,
        cache_control: { type: 'ephemeral' },
      },
    ];
    for (let i = 0; i < documentRefs.length; i++) {
      const d = documentRefs[i];
      const isLast = i === documentRefs.length - 1;
      const block: any = {
        type: 'document',
        source: { type: 'file', file_id: d.anthropicFileId },
        title: d.fileName,
      };
      if (isLast) {
        block.cache_control = { type: 'ephemeral' };
      }
      userContent.push(block);
    }
    userContent.push({
      type: 'text',
      text: 'Analyze the attached construction documents and submit your scope via the submit_scope tool.',
    });

    // Anthropic Messages API call. We use beta.messages.create to
    // pass the Files API beta header. tool_choice forces the tool
    // call and gives us structured JSON we Zod-validate after.
    const response = await claude().beta.messages.create(
      {
        model: EXTRACTION_MODEL,
        max_tokens: 16384,
        system: [
          {
            type: 'text',
            text: BASE_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userContent }],
        tools: [SUBMIT_SCOPE_TOOL as any],
        tool_choice: { type: 'tool', name: 'submit_scope' },
      },
      {
        headers: { 'anthropic-beta': FILES_API_BETA },
        // Generous timeout: large PDFs + Opus 4.7 can run 3–5 min.
        timeout: 30 * 60 * 1000,
      },
    );

    const toolUse = (response.content as any[]).find(
      (block) => block.type === 'tool_use' && block.name === 'submit_scope',
    );
    if (!toolUse) {
      throw new Error(
        'Claude did not call the submit_scope tool — got: ' +
          (response.content as any[]).map((b) => b.type).join(', '),
      );
    }

    const validated = ScopeAnalystOutput.parse(toolUse.input);

    const usage = response.usage;
    const tokens = {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    };
    const costCents = calculateCostCents(EXTRACTION_MODEL, tokens);

    await prisma.projectAnalysisRun.update({
      where: { id: input.runId },
      data: {
        responsePayload: response as any,
        parsedResult: validated as any,
        inputTokens: tokens.inputTokens,
        outputTokens: tokens.outputTokens,
        cacheReadTokens: tokens.cacheReadTokens,
        cacheWriteTokens: tokens.cacheWriteTokens,
        costCents,
        itemsProposed: validated.preliminary_classifications.length,
        completedAt: new Date(),
      },
    });
  } catch (err: any) {
    const errorMessage = err?.message ?? (typeof err === 'string' ? err : 'Scope analysis failed');
    await prisma.projectAnalysisRun
      .update({
        where: { id: input.runId },
        data: {
          status: 'failed',
          errorMessage,
          completedAt: new Date(),
        },
      })
      .catch((dbErr) => {
        console.error('[scope-analyst.processScopeAnalysis] failed to record failure', dbErr);
      });
    console.error('[scope-analyst.processScopeAnalysis]', err);
  }
}

// Backwards-compat alias kept for existing import sites. New callers
// should use `startScopeAnalysis` directly.
export const runScopeAnalysis = startScopeAnalysis;
export type RunScopeAnalysisInput = StartScopeAnalysisInput;
export type RunScopeAnalysisResult = StartScopeAnalysisResult;
