import type { IsoDate } from "@/lib/dates";

/**
 * Lets the report be pointed at any week. Without it the page always shows the
 * week of the most recent appointment, which a single out-of-range guide could
 * drag away from the data the owner actually wants to read.
 */
export function PeriodPicker({ through }: { readonly through: IsoDate }) {
  return (
    <form action="/relatorio/terca" method="get" className="flex items-end gap-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted">
        Semana encerrada em
        <input
          type="date"
          name="through"
          defaultValue={through}
          className="h-9 rounded-md border border-border-subtle bg-surface px-2.5 text-sm text-ink"
        />
      </label>
      <button
        type="submit"
        className="h-9 rounded-md border border-border-subtle px-3.5 text-sm font-medium text-ink transition-colors hover:bg-canvas"
      >
        Atualizar
      </button>
    </form>
  );
}
