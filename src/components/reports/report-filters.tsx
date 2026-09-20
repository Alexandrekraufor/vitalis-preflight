"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { CLINIC_UNITS, type ClinicUnit } from "@/domain/guides/guide.types";
import type { IsoDate } from "@/lib/dates";

export interface PeriodPreset {
  readonly days: number;
  readonly href: string;
  readonly active: boolean;
}

export interface SelectedReportFilters {
  readonly days: number;
  readonly from: IsoDate;
  readonly through: IsoDate;
  readonly unit?: ClinicUnit;
  readonly convention?: string;
  /** True when the window came from explicit dates instead of a preset. */
  readonly customRange: boolean;
}

interface ReportFiltersProps {
  readonly presets: readonly PeriodPreset[];
  readonly conventions: readonly string[];
  readonly selected: SelectedReportFilters;
}

const FIELD_CLASS =
  "h-9 rounded-md border border-border-subtle bg-surface px-2.5 text-sm text-ink transition-colors hover:border-ink-muted focus-visible:border-brand";

/**
 * What the report is about: which window, which unit, which convention.
 *
 * The filters live in the URL, so a report is a link somebody can send. The
 * presets are links too, which keeps the unit and the convention while only
 * the window changes; the date fields state a window of their own and win
 * over the preset.
 */
export function ReportFilters({ presets, conventions, selected }: ReportFiltersProps) {
  const form = useRef<HTMLFormElement>(null);
  const filtered =
    selected.unit !== undefined || selected.convention !== undefined || selected.customRange;

  return (
    <section className="rounded-[var(--radius-card)] border border-border-subtle bg-surface shadow-premium">
      <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-5 py-3.5">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
          Período
        </span>
        {presets.map((preset) => (
          <Link
            key={preset.days}
            href={preset.href}
            scroll={false}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              preset.active && !selected.customRange
                ? "bg-brand font-semibold text-white"
                : "border border-border-subtle text-ink-muted hover:border-border-strong hover:text-ink"
            }`}
          >
            {preset.days} dias
          </Link>
        ))}
        {selected.customRange && (
          <span className="rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-white">
            personalizado
          </span>
        )}
      </div>

      <form
        ref={form}
        action="/relatorio/terca"
        method="get"
        className="flex flex-wrap items-end gap-3 px-5 py-4"
      >
        {/* The preset travels as a hidden field so that changing the unit keeps
            the window the reader chose, instead of silently turning it into a
            custom range. Filling both dates overrides it. */}
        {!selected.customRange && <input type="hidden" name="dias" value={selected.days} />}

        <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted">
          De
          <input
            type="date"
            name="de"
            defaultValue={selected.customRange ? selected.from : ""}
            className={`numeric ${FIELD_CLASS}`}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted">
          Até
          <input
            type="date"
            name="ate"
            defaultValue={selected.customRange ? selected.through : ""}
            className={`numeric ${FIELD_CLASS}`}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted">
          Unidade
          <select
            name="unidade"
            defaultValue={selected.unit ?? ""}
            onChange={() => form.current?.requestSubmit()}
            className={FIELD_CLASS}
          >
            <option value="">Todas as unidades</option>
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
            name="convenio"
            defaultValue={selected.convention ?? ""}
            onChange={() => form.current?.requestSubmit()}
            className={FIELD_CLASS}
          >
            <option value="">Todos os convênios</option>
            {conventions.map((convention) => (
              <option key={convention} value={convention}>
                {convention}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="h-9 rounded-md bg-brand px-3.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
        >
          Aplicar
        </button>

        {filtered && (
          <Link
            href="/relatorio/terca"
            className="inline-flex h-9 items-center gap-1 rounded-md px-2.5 text-sm font-medium text-brand transition-colors hover:bg-brand-soft"
          >
            <X aria-hidden className="size-3.5" />
            Limpar
          </Link>
        )}

        <p className="basis-full text-xs text-ink-muted">
          Janela atual: {selected.from} a {selected.through}. Preencha as duas datas para um
          período próprio.
        </p>
      </form>
    </section>
  );
}
