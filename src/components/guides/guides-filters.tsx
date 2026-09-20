import { GUIDE_STATUSES, guideStatusLabel } from "@/domain/guides/guide-status";
import { CLINIC_UNITS } from "@/domain/guides/guide.types";

interface GuidesFiltersProps {
  readonly conventions: readonly string[];
  readonly selected: {
    readonly status?: string;
    readonly unit?: string;
    readonly convention?: string;
    readonly search?: string;
  };
}

const FIELD_CLASS =
  "h-9 rounded-md border border-border-subtle bg-surface px-2.5 text-sm text-ink";

/**
 * A plain GET form. The filter state lives in the URL, which makes every
 * filtered view shareable and bookmarkable — and needs no client-side
 * JavaScript to work.
 */
export function GuidesFilters({ conventions, selected }: GuidesFiltersProps) {
  return (
    <form
      action="/guias"
      method="get"
      className="flex flex-wrap items-end gap-3 border-b border-border-subtle px-5 py-4"
    >
      <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted">
        Status
        <select name="status" defaultValue={selected.status ?? ""} className={FIELD_CLASS}>
          <option value="">Todos</option>
          {GUIDE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {guideStatusLabel(status)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted">
        Unidade
        <select name="unit" defaultValue={selected.unit ?? ""} className={FIELD_CLASS}>
          <option value="">Todas</option>
          {CLINIC_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted">
        Convênio
        <select name="convention" defaultValue={selected.convention ?? ""} className={FIELD_CLASS}>
          <option value="">Todos</option>
          {conventions.map((convention) => (
            <option key={convention} value={convention}>
              {convention}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted">
        Buscar por guia ou paciente
        <input
          type="search"
          name="search"
          defaultValue={selected.search ?? ""}
          placeholder="G-2608-0041 ou P-1026"
          className={`${FIELD_CLASS} w-56`}
        />
      </label>

      <button
        type="submit"
        className="h-9 rounded-md bg-brand px-3.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
      >
        Filtrar
      </button>
    </form>
  );
}
