import type { ReactNode } from "react";

interface PageHeaderProps {
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      </div>
      {action}
    </header>
  );
}
