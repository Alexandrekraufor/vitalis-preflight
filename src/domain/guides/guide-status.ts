/**
 * The three outcomes a preflight can produce. Deliberately not a boolean:
 * "cannot be submitted" splits into a problem the reception can fix and a
 * situation only a human can settle, and those lead to different work.
 */
export const GUIDE_STATUSES = [
  "READY_TO_SUBMIT",
  "NEEDS_CORRECTION",
  "REVIEW_REQUIRED",
] as const;

export type GuideStatus = (typeof GUIDE_STATUSES)[number];

const STATUS_LABELS: Readonly<Record<GuideStatus, string>> = {
  READY_TO_SUBMIT: "Pronta para envio",
  NEEDS_CORRECTION: "Precisa corrigir",
  REVIEW_REQUIRED: "Revisão humana",
};

export function guideStatusLabel(status: GuideStatus): string {
  return STATUS_LABELS[status];
}
