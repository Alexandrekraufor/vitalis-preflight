import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/ui/theme-toggle";

interface PageHeaderProps {
  readonly title: string;
  /** Rendered below the bar, in the scrolling content, where it belongs. */
  readonly description?: string;
  readonly action?: ReactNode;
}

/**
 * The application header: where the reader is, what they can do here, and the
 * theme switch.
 *
 * It stays pinned while the page scrolls, so the primary action of a screen is
 * never something you have to scroll back up to find. The explanatory sentence
 * is deliberately *not* in the bar - it is read once and then only takes up
 * room.
 */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border-subtle bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[76rem] flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-8">
          <h1 className="truncate text-lg font-semibold tracking-tight text-ink">{title}</h1>
          <div className="flex items-center gap-2.5">
            {action}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {description !== undefined && (
        <div className="mx-auto w-full max-w-[76rem] px-5 pt-6 md:px-8">
          <p className="max-w-3xl text-sm leading-relaxed text-ink-muted">{description}</p>
        </div>
      )}
    </>
  );
}
