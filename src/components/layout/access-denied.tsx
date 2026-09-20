import { ShieldAlert } from "lucide-react";
import Link from "next/link";

/**
 * Shown when a signed-in person reaches a screen their role does not cover.
 *
 * It says what happened plainly rather than pretending the page does not
 * exist - the person is authenticated and trusted, just not for this.
 */
export function AccessDenied({ description }: { readonly description: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] border border-border-subtle bg-surface px-6 py-10">
      <ShieldAlert aria-hidden className="size-6 text-warn" />
      <h1 className="text-lg font-semibold tracking-tight text-ink">Acesso restrito</h1>
      <p className="max-w-prose text-sm leading-relaxed text-ink-muted">{description}</p>
      <Link
        href="/"
        className="mt-1 inline-flex h-9 items-center rounded-md border border-border-subtle px-3.5 text-sm font-medium text-ink transition-colors hover:bg-canvas"
      >
        Voltar para a visão geral
      </Link>
    </div>
  );
}
