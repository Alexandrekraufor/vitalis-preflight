import type { ReactNode } from "react";

export function DataTable({ children }: { readonly children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function TableHead({ columns }: { readonly columns: readonly string[] }) {
  return (
    <thead>
      <tr className="border-b border-border-subtle text-left">
        {columns.map((column) => (
          <th
            key={column}
            scope="col"
            className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted"
          >
            {column}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function TableRow({ children }: { readonly children: ReactNode }) {
  return (
    <tr className="border-b border-border-subtle last:border-0 hover:bg-canvas">{children}</tr>
  );
}

export function TableCell({
  children,
  className = "",
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return <td className={`px-4 py-2.5 align-middle text-ink ${className}`}>{children}</td>;
}
