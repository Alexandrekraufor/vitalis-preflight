import { CircleCheck, CircleSlash, TriangleAlert } from "lucide-react";

export type SurfaceState = "OPEN" | "CLOSED" | "DEMO";

interface SurfaceStatusProps {
  readonly state: SurfaceState;
  /** What the caller can reach in this state, in one sentence. */
  readonly detail: string;
}

const PRESENTATION: Readonly<
  Record<SurfaceState, { readonly label: string; readonly className: string }>
> = {
  OPEN: { label: "Credencial configurada", className: "bg-ready-soft text-ready" },
  CLOSED: { label: "Fechada", className: "bg-danger-soft text-danger" },
  DEMO: { label: "Modo demonstração", className: "bg-warn-soft text-warn" },
};

/**
 * Says whether a machine surface is reachable - never what the credential is.
 *
 * The page reads only whether a key is configured, so the screen can be shown
 * to anyone with a session without leaking the secret itself.
 */
export function SurfaceStatus({ state, detail }: SurfaceStatusProps) {
  const { label, className } = PRESENTATION[state];
  const Icon = state === "OPEN" ? CircleCheck : state === "DEMO" ? TriangleAlert : CircleSlash;

  return (
    <div className="flex items-start gap-3 border-b border-border-subtle px-5 py-4">
      <span className={`mt-0.5 flex size-7 items-center justify-center rounded-full ${className}`}>
        <Icon aria-hidden className="size-4" />
      </span>
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-sm text-ink-muted">{detail}</p>
      </div>
    </div>
  );
}

interface FactProps {
  readonly label: string;
  readonly value: string;
  readonly title?: string;
}

/** A labelled operational fact in the status rail. */
export function Fact({ label, value, title }: FactProps) {
  return (
    <div className="min-w-[9rem]">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-ink" title={title}>
        {value}
      </p>
    </div>
  );
}

export function HealthDot({ up, label }: { readonly up: boolean; readonly label: string }) {
  return (
    <div className="min-w-[9rem]">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-ink">
        <span aria-hidden className={`size-2 rounded-full ${up ? "bg-ready" : "bg-danger"}`} />
        {up ? "operacional" : "indisponível"}
      </p>
    </div>
  );
}
