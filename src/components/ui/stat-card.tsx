"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type Tone = "neutral" | "ready" | "danger" | "review" | "warn";

const TONE_STYLES: Readonly<Record<Tone, string>> = {
  neutral: "text-ink",
  ready: "text-ready",
  danger: "text-danger",
  review: "text-review",
  warn: "text-warn",
};

const BG_STYLES: Readonly<Record<Tone, string>> = {
  neutral: "bg-slate-100 text-slate-500",
  ready: "bg-ready-soft text-ready",
  danger: "bg-danger-soft text-danger",
  review: "bg-review-soft text-review",
  warn: "bg-warn-soft text-warn",
};

interface StatCardProps {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly tone?: Tone;
  /**
   * Rendered element, not the icon component.
   *
   * This card runs on the client, and a component is a function: passing one
   * across the server/client boundary is what React refuses. An element is
   * serializable, so the caller writes `icon={<FileCheck2 />}`.
   */
  readonly icon?: ReactNode;
}

export function StatCard({ label, value, hint, tone = "neutral", icon }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-border-subtle bg-surface/80 backdrop-blur-2xl px-5 py-5 shadow-sm transition-all hover:shadow-premium"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent dark:from-white/[0.05]" />
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-ink-muted">{label}</div>
        {icon !== undefined && (
          <div aria-hidden className={`rounded-lg p-2 [&>svg]:size-4 ${BG_STYLES[tone]}`}>
            {icon}
          </div>
        )}
      </div>
      <p className={`numeric mt-4 text-3xl font-bold tracking-tight ${TONE_STYLES[tone]}`}>
        {value}
      </p>
      {hint !== undefined && <p className="mt-1 text-xs font-medium text-ink-muted/80">{hint}</p>}
    </motion.div>
  );
}
