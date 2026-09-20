"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { formatBrazilianDate, toIsoDate } from "@/lib/dates";

import { GUIDE_STATUSES, guideStatusLabel, type GuideStatus } from "@/domain/guides/guide-status";
import { CLINIC_UNITS, type ClinicUnit } from "@/domain/guides/guide.types";

export interface SelectedGuideFilters {
  readonly status?: GuideStatus;
  readonly unit?: ClinicUnit;
  readonly convention?: string;
  readonly search?: string;
  readonly from?: string;
  readonly through?: string;
}

interface GuidesFiltersProps {
  readonly conventions: readonly string[];
  readonly selected: SelectedGuideFilters;
}

const FIELD_CLASS =
  "h-9 rounded-md border border-border-subtle bg-surface px-2.5 text-sm text-ink transition-colors hover:border-ink-muted focus-visible:border-accent";

/**
 * A plain GET form: the filter state lives in the URL, so every filtered view
 * is shareable, bookmarkable and survives a reload.
 *
 * Changing a select submits immediately - a filter that needs a second click
 * to take effect reads as a filter that does not work. The submit button stays
 * for the text field and for a browser without JavaScript, where the form
 * still works exactly as before.
 */
/** Shows the window the way a person writes it, whichever end was given. */
function formatPeriod(from: string | undefined, through: string | undefined): string {
  const start = from === undefined ? null : toIsoDate(from);
  const end = through === undefined ? null : toIsoDate(through);

  if (start !== null && end !== null) {
    return `${formatBrazilianDate(start)} a ${formatBrazilianDate(end)}`;
  }
  if (start !== null) return `a partir de ${formatBrazilianDate(start)}`;
  if (end !== null) return `até ${formatBrazilianDate(end)}`;
  return "";
}

export function GuidesFilters({ conventions, selected }: GuidesFiltersProps) {
  const form = useRef<HTMLFormElement>(null);

  const active = [
    selected.status === undefined
      ? null
      : { key: "status", label: `Status: ${guideStatusLabel(selected.status)}` },
    selected.unit === undefined ? null : { key: "unit", label: `Unidade: ${selected.unit}` },
    selected.convention === undefined
      ? null
      : { key: "convention", label: `Convênio: ${selected.convention}` },
    selected.search === undefined ? null : { key: "search", label: `Busca: ${selected.search}` },
    selected.from === undefined && selected.through === undefined
      ? null
      : {
          key: "period",
          label: `Período: ${formatPeriod(selected.from, selected.through)}`,
        },
  ].filter((chip) => chip !== null);

  return (
    <div className="border-b border-border-subtle">
      <form
        ref={form}
        action="/guias"
        method="get"
        className="flex flex-wrap items-end gap-3 px-5 py-4"
      >
        {selected.from !== undefined && (
          <input type="hidden" name="from" value={selected.from} />
        )}
        {selected.through !== undefined && (
          <input type="hidden" name="through" value={selected.through} />
        )}

        <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted">
          Status
          <select
            name="status"
            defaultValue={selected.status ?? ""}
            onChange={() => form.current?.requestSubmit()}
            className={FIELD_CLASS}
          >
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
          <select
            name="unit"
            defaultValue={selected.unit ?? ""}
            onChange={() => form.current?.requestSubmit()}
            className={FIELD_CLASS}
          >
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
          <select
            name="convention"
            defaultValue={selected.convention ?? ""}
            onChange={() => form.current?.requestSubmit()}
            className={FIELD_CLASS}
          >
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

      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
          {active.map((chip) => (
            <span
              key={chip.key}
              className="rounded-full bg-canvas px-2.5 py-1 text-xs text-ink-muted"
            >
              {chip.label}
            </span>
          ))}
          <Link
            href="/guias"
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-brand transition-colors hover:bg-brand-soft"
          >
            <X aria-hidden className="size-3" />
            Limpar filtros
          </Link>
        </div>
      )}
    </div>
  );
}
