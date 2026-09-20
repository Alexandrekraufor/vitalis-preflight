"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { z } from "zod";

import { StatCard } from "@/components/ui/stat-card";

/** The import endpoint's response is parsed, not asserted - it crosses the wire. */
const importSummarySchema = z.object({
  imported: z.number(),
  readyToSubmit: z.number(),
  needsCorrection: z.number(),
  reviewRequired: z.number(),
  newVersions: z.number(),
  automaticNormalizations: z.number(),
  rejected: z.array(z.object({ index: z.number(), idGuia: z.string().nullable() })),
});

const problemSchema = z.object({ error: z.object({ message: z.string() }) });

type ImportSummary = z.infer<typeof importSummarySchema>;

type State =
  | { readonly kind: "idle" }
  | { readonly kind: "uploading" }
  | { readonly kind: "done"; readonly summary: ImportSummary }
  | { readonly kind: "failed"; readonly message: string };

/**
 * The upload itself is the only interactive part of the application, so it is
 * the only Client Component that touches guide data. It posts to the same REST
 * endpoint a script would use - there is no private path for the browser.
 */
export function CsvImportForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });

  function pickFile(selected: File | null | undefined): void {
    setFile(selected ?? null);
    setState({ kind: "idle" });
  }

  function onDrop(event: DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    pickFile(event.dataTransfer.files[0]);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (file === null) return;

    setState({ kind: "uploading" });

    const body = new FormData();
    body.set("file", file);

    const response = await fetch("/api/internal/imports/csv", { method: "POST", body });
    const payload: unknown = await response.json();

    if (!response.ok) {
      const problem = problemSchema.safeParse(payload);
      setState({
        kind: "failed",
        message: problem.success
          ? problem.data.error.message
          : "Não foi possível importar o arquivo.",
      });
      return;
    }

    const summary = importSummarySchema.safeParse(payload);

    if (!summary.success) {
      setState({ kind: "failed", message: "A importação respondeu em um formato inesperado." });
      return;
    }

    setState({ kind: "done", summary: summary.data });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
          className="flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-border-subtle bg-canvas px-5 py-10 text-center transition-colors hover:border-brand"
        >
          <Upload aria-hidden className="size-6 text-ink-muted" />
          <span className="text-sm font-medium text-ink">
            {file === null ? "Arraste o CSV ou clique para selecionar" : file.name}
          </span>
          <span className="text-xs text-ink-muted">
            Exportação do sistema de gestão, com as 18 colunas originais.
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              pickFile(event.target.files?.[0])
            }
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={file === null || state.kind === "uploading"}
            className="rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state.kind === "uploading" ? "Validando guias…" : "Importar e validar"}
          </button>
          {state.kind === "failed" && (
            <p role="alert" className="text-sm text-danger">
              {state.message}
            </p>
          )}
        </div>
      </form>

      {state.kind === "done" && <ImportResult summary={state.summary} />}
    </div>
  );
}

function ImportResult({ summary }: { readonly summary: ImportSummary }) {
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Guias importadas" value={String(summary.imported)} />
        <StatCard label="Prontas para envio" value={String(summary.readyToSubmit)} tone="ready" />
        <StatCard label="Precisam corrigir" value={String(summary.needsCorrection)} tone="danger" />
        <StatCard label="Revisão humana" value={String(summary.reviewRequired)} tone="review" />
        <StatCard
          label="Normalizações"
          value={String(summary.automaticNormalizations)}
          hint={`${summary.newVersions} versões novas`}
        />
      </div>

      {summary.rejected.length > 0 && (
        <p className="text-sm text-warn">
          {summary.rejected.length} linha(s) não puderam ser interpretadas e não foram
          importadas: {summary.rejected.map((row) => row.idGuia ?? `linha ${row.index}`).join(", ")}.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <DownloadButton kind="ready" label="Baixar CSV das guias prontas" />
        <DownloadButton kind="pending" label="Baixar CSV das pendências" />
      </div>
    </div>
  );
}

/**
 * A GET form rather than a link: the target is a route handler that streams a
 * file, which `next/link` would try to client-navigate to.
 */
function DownloadButton({
  kind,
  label,
}: {
  readonly kind: "ready" | "pending";
  readonly label: string;
}) {
  return (
    <form action="/api/internal/guides/export" method="get">
      <input type="hidden" name="kind" value={kind} />
      <button
        type="submit"
        className="rounded-md border border-border-subtle px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas"
      >
        {label}
      </button>
    </form>
  );
}
