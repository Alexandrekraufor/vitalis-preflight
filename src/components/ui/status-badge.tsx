import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { guideStatusLabel, type GuideStatus } from "@/domain/guides/guide-status";

interface StatusStyle {
  readonly icon: LucideIcon;
  readonly className: string;
}

/**
 * Status is carried by an icon and a word, never by colour alone — the palette
 * is a reinforcement so the screen still works for someone who cannot tell
 * amber from red, or who is printing it in black and white.
 */
const STATUS_STYLES: Readonly<Record<GuideStatus, StatusStyle>> = {
  READY_TO_SUBMIT: {
    icon: CheckCircle2,
    className: "bg-ready-soft text-ready border-ready/20",
  },
  NEEDS_CORRECTION: {
    icon: AlertTriangle,
    className: "bg-danger-soft text-danger border-danger/20",
  },
  REVIEW_REQUIRED: {
    icon: HelpCircle,
    className: "bg-review-soft text-review border-review/20",
  },
};

interface StatusBadgeProps {
  readonly status: GuideStatus;
  readonly size?: "sm" | "md";
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const { icon: Icon, className } = STATUS_STYLES[status];
  const sizing = size === "md" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium ${className} ${sizing}`}
    >
      <Icon aria-hidden className={size === "md" ? "size-4" : "size-3.5"} />
      {guideStatusLabel(status)}
    </span>
  );
}

interface SeverityBadgeProps {
  readonly severity: "BLOCKING" | "REVIEW" | "INFO";
}

const SEVERITY_LABELS: Readonly<Record<SeverityBadgeProps["severity"], string>> = {
  BLOCKING: "Bloqueia envio",
  REVIEW: "Decisão humana",
  INFO: "Informativo",
};

const SEVERITY_STYLES: Readonly<Record<SeverityBadgeProps["severity"], string>> = {
  BLOCKING: "bg-danger-soft text-danger border-danger/20",
  REVIEW: "bg-review-soft text-review border-review/20",
  INFO: "bg-canvas text-ink-muted border-border-subtle",
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${SEVERITY_STYLES[severity]}`}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
