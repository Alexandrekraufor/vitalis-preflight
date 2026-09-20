"use client";

import { useEffect, useState } from "react";

export interface DocsIndexEntry {
  readonly href: string;
  readonly label: string;
}

/**
 * The table of contents, pinned beside the reference.
 *
 * It stays put while the page scrolls and marks where the reader is, which is
 * what makes a long reference navigable instead of a wall. `self-start` is
 * what actually makes it stick: a stretched grid item has no room to move, so
 * without it the sidebar scrolls away with the content.
 */
export function DocsIndex({ entries }: { readonly entries: readonly DocsIndexEntry[] }) {
  const [active, setActive] = useState<string | null>(entries.at(0)?.href ?? null);

  useEffect(() => {
    const ids = entries.map((entry) => entry.href.slice(1));
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null);

    if (sections.length === 0) return;

    // The rootMargin keeps the "current" section the one under the header
    // rather than whatever happens to touch the bottom of the viewport.
    const observer = new IntersectionObserver(
      (records) => {
        const visible = records
          .filter((record) => record.isIntersecting)
          .toSorted((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)
          .at(0);

        if (visible !== undefined) setActive(`#${visible.target.id}`);
      },
      { rootMargin: "-88px 0px -70% 0px", threshold: 0 },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [entries]);

  return (
    <nav
      aria-label="Índice"
      className="hidden self-start md:sticky md:top-[5.5rem] md:block"
    >
      <p className="px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-faint">
        Nesta página
      </p>
      <ul className="max-h-[calc(100dvh-9rem)] overflow-y-auto border-l border-border-subtle">
        {entries.map((entry) => {
          const selected = entry.href === active;

          return (
            <li key={entry.href}>
              <a
                href={entry.href}
                aria-current={selected ? "location" : undefined}
                onClick={() => setActive(entry.href)}
                className={`-ml-px block border-l-2 py-1.5 pl-3 pr-2 text-sm transition-colors ${
                  selected
                    ? "border-brand font-medium text-brand"
                    : "border-transparent text-ink-muted hover:border-border-strong hover:text-ink"
                }`}
              >
                {entry.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
