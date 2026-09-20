"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

interface SubmitButtonProps {
  readonly children: ReactNode;
  readonly pendingLabel: string;
  readonly variant?: "primary" | "secondary" | "danger";
  readonly className?: string;
}

const VARIANTS = {
  primary: "bg-brand text-white hover:bg-brand-hover",
  secondary: "border border-border-subtle bg-surface text-ink hover:bg-canvas",
  danger: "border border-danger/25 bg-danger-soft text-danger hover:bg-danger/10",
} as const;

/**
 * Submit control that reports progress from the form's own pending state.
 *
 * `aria-busy` and the changed label mean the feedback is announced, not just
 * shown — and the button disables itself, so a double click cannot fire the
 * action twice.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className = "",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
