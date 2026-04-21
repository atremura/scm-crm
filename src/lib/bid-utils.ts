export type UrgencyLevel = 'normal' | 'soon' | 'close' | 'critical' | 'overdue';

export type UrgencyMeta = {
  level: UrgencyLevel;
  daysUntil: number; // negative if overdue
  label: string;
  // Tailwind utility classes for badge / cell colors
  colorClass: string; // text color
  bgClass: string; // background tint
  pulse: boolean;
};

/**
 * Returns urgency info for a response deadline.
 * Thresholds:
 *   overdue   (<0 days)          → red + pulse
 *   critical  (0-1 days)         → red + pulse
 *   close     (1-3 days)         → orange
 *   soon      (3-7 days)         → yellow
 *   normal    (>7 days)          → green
 */
export function getUrgencyLevel(deadline: Date | null | undefined): UrgencyMeta | null {
  if (!deadline) return null;

  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntil = Math.floor((deadline.getTime() - now.getTime()) / msPerDay);

  if (daysUntil < 0) {
    return {
      level: 'overdue',
      daysUntil,
      label: `${Math.abs(daysUntil)}d overdue`,
      colorClass: 'text-danger-500',
      bgClass: 'bg-danger-500/15',
      pulse: true,
    };
  }
  if (daysUntil < 1) {
    return {
      level: 'critical',
      daysUntil,
      label: 'Due today',
      colorClass: 'text-danger-500',
      bgClass: 'bg-danger-500/15',
      pulse: true,
    };
  }
  if (daysUntil < 3) {
    return {
      level: 'close',
      daysUntil,
      label: `${daysUntil}d left`,
      colorClass: 'text-warn-500',
      bgClass: 'bg-warn-500/15',
      pulse: false,
    };
  }
  if (daysUntil < 7) {
    return {
      level: 'soon',
      daysUntil,
      label: `${daysUntil}d left`,
      colorClass: 'text-warn-500',
      bgClass: 'bg-warn-100/30',
      pulse: false,
    };
  }
  return {
    level: 'normal',
    daysUntil,
    label: `${daysUntil}d left`,
    colorClass: 'text-success-500',
    bgClass: 'bg-success-500/15',
    pulse: false,
  };
}

export const VALID_STATUSES = [
  'new',
  'qualified',
  'rejected',
  'sent_to_takeoff',
  'won',
  'lost',
] as const;

export type BidStatus = (typeof VALID_STATUSES)[number];

/**
 * Allowed status transitions. "rejected" is reachable from any state.
 */
const TRANSITIONS: Record<BidStatus, BidStatus[]> = {
  new: ['qualified', 'rejected'],
  qualified: ['sent_to_takeoff', 'rejected'],
  sent_to_takeoff: ['won', 'lost', 'rejected'],
  won: [],
  lost: [],
  rejected: [],
};

export function isValidTransition(from: BidStatus, to: BidStatus): boolean {
  if (to === 'rejected') return true; // always allowed
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export const VALID_SOURCES = ['manual', 'email_ai', 'portal_api'] as const;
export type BidSource = (typeof VALID_SOURCES)[number];

export const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type BidPriority = (typeof VALID_PRIORITIES)[number];

export const VALID_DOCUMENT_TYPES = [
  'plans',
  'specs',
  'contract',
  'exhibit',
  'photo',
  'other',
] as const;
export type DocumentType = (typeof VALID_DOCUMENT_TYPES)[number];

/** Upload limits — shared by server + client (safe for both). */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = [
  'pdf',
  'dwg',
  'rvt',
  'xls',
  'xlsx',
  'doc',
  'docx',
  'png',
  'jpg',
  'jpeg',
] as const;

export const VALID_WORK_TYPES = [
  'Finish Carpentry',
  'Siding',
  'Sheet Metal',
  'Roofing',
  'General Construction',
  'Other',
] as const;
