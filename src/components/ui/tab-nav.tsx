import Link from "next/link";

export interface TabItem {
  readonly key: string;
  readonly href: string;
  readonly label: string;
  readonly hint?: string;
}

interface TabNavProps {
  readonly label: string;
  readonly items: readonly TabItem[];
  readonly active: string;
}

/**
 * Tabs as links, with the selected tab in the URL.
 *
 * Keeping the choice in the address bar means a tab is shareable, survives a
 * reload and needs no client-side JavaScript - the same reasoning that puts the
 * guide filters in the query string.
 */
export function TabNav({ label, items, active }: TabNavProps) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b border-border-subtle">
      {items.map((item) => {
        const selected = item.key === active;

        return (
          <Link
            key={item.key}
            href={item.href}
            role="tab"
            aria-selected={selected}
            scroll={false}
            className={`-mb-px flex flex-col gap-0.5 border-b-2 px-4 py-2.5 text-sm transition-colors ${
              selected
                ? "border-brand font-semibold text-brand"
                : "border-transparent text-ink-muted hover:border-border-subtle hover:text-ink"
            }`}
          >
            {item.label}
            {item.hint !== undefined && (
              <span className="text-xs font-normal text-ink-muted">{item.hint}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

interface SegmentedNavProps {
  readonly label: string;
  readonly items: readonly TabItem[];
  readonly active: string;
}

/**
 * Second level of navigation, under the tabs.
 *
 * A screen that answers three different questions should not stack all three
 * answers on one scroll: the reader has to skim past what they did not ask
 * for. Same URL-driven state as `TabNav`, different weight on screen.
 */
export function SegmentedNav({ label, items, active }: SegmentedNavProps) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg border border-border-subtle bg-surface p-1"
    >
      {items.map((item) => {
        const selected = item.key === active;

        return (
          <Link
            key={item.key}
            href={item.href}
            role="tab"
            aria-selected={selected}
            scroll={false}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              selected
                ? "bg-brand font-semibold text-white"
                : "text-ink-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
