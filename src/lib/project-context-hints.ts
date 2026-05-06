import type { Prisma } from '@prisma/client';
import type { SiteConditions, RequiredEquipment } from '@/components/estimate/project-context-card';

/**
 * ProjectContextHints — JSONB structure stored in Project.contextHints.
 *
 * Replaces the individual columns Project.stories, durationWeeks,
 * siteConditions, requiredEquipment, winterRisk, permitChecklist that
 * were dropped in migration demolish_phase1_analyst_schema.
 *
 * Populated by:
 * - IA-1 (Project Context Analyzer) in src/lib/ai-project-context.ts
 *   — runs as Suggestion, requires human approval before applying
 * - Cowork importer (Phase 2) — maps estimate_meta from imported JSON
 *   (see docs/cowork-import-schema.md)
 *
 * All fields optional; the JSON itself is nullable in Prisma.
 */
export type ProjectContextHints = {
  stories?: number | null;
  durationWeeks?: number | null;
  siteConditions?: SiteConditions | null;
  requiredEquipment?: RequiredEquipment[] | null;
  winterRisk?: boolean | null;
  permitChecklist?: string[] | null;
};

/**
 * Type-safe accessor for Project.contextHints.
 *
 * Prisma types contextHints as JsonValue. This helper casts to our
 * known shape, returning null if the field is null/undefined.
 *
 * Use this everywhere instead of inline `as ProjectContextHints` casts
 * to keep the cast centralized and easier to refactor later.
 */
export function getContextHints(
  raw: Prisma.JsonValue | null | undefined,
): ProjectContextHints | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as ProjectContextHints;
}

/**
 * Convert ProjectContextHints to Prisma.InputJsonValue for writes.
 * Use when calling prisma.project.update / create with contextHints data.
 */
export function toContextHintsInput(
  hints: ProjectContextHints | null | undefined,
): Prisma.InputJsonValue | null {
  if (hints === null || hints === undefined) return null;
  return hints as unknown as Prisma.InputJsonValue;
}
