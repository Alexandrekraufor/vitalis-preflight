import type { ReactNode } from "react";

interface FieldProps {
  readonly label: string;
  readonly htmlFor: string;
  readonly hint?: string;
  readonly children: ReactNode;
}

/** A real `<label>` bound to the control, so clicking it focuses the input. */
export function Field({ label, htmlFor, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint !== undefined && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
