import type { LucideIcon } from "lucide-react";

type Tone = "neutral" | "ready" | "danger" | "review" | "warn";

const TONE_STYLES: Readonly<Record<Tone, string>> = {
  neutral: "text-ink",
  ready: "text-ready",
  danger: "text-danger",
  review: "text-review",
  warn: "text-warn",
};

interface StatCardProps {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly tone?: Tone;
  readonly icon?: LucideIcon;
}

export function StatCard({ label, value, hint, tone = "neutral", icon: Icon }: StatCardProps) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border-subtle bg-surface px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        {Icon !== undefined && <Icon aria-hidden className="size-4" />}
        {label}
      </div>
      <p className={`numeric mt-2 text-2xl font-semibold tracking-tight ${TONE_STYLES[tone]}`}>
        {value}
      </p>
      {hint !== undefined && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
