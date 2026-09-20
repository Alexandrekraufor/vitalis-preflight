/**
 * Money is kept as an integer number of centavos. Floating point cannot
 * represent R$ 62,00 exactly, and this application compares billed amounts
 * against reference tables - a cent of drift would be a phantom finding.
 */
declare const moneyBrand: unique symbol;

export type Money = number & { readonly [moneyBrand]: true };

export const ZERO: Money = 0 as Money;

export function fromCents(cents: number): Money {
  if (!Number.isInteger(cents)) {
    throw new TypeError(`Money must be an integer number of cents, received ${cents}`);
  }
  return cents as Money;
}

/**
 * Parses a decimal amount written with either separator (`62.00` or `62,00`).
 * Returns `null` for anything that is not an unambiguous amount.
 */
export function parseMoney(value: string): Money | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const normalized = trimmed.replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const [whole, fraction = ""] = normalized.split(".");
  const sign = normalized.startsWith("-") ? -1 : 1;
  const cents =
    Math.abs(Number(whole)) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));

  return fromCents(sign * cents);
}

export function sum(values: readonly Money[]): Money {
  return fromCents(values.reduce<number>((total, value) => total + value, 0));
}

/** `6200` -> `"62.00"`, the shape PostgreSQL `numeric` and JSON consumers expect. */
export function toDecimalString(value: Money): string {
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  return `${sign}${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

/**
 * `6200` -> `"R$ 62,00"`, `138100` -> `"R$ 1.381,00"`.
 *
 * Grouping is done on the digits of the integer amount rather than through a
 * `Number`, so a large total is never routed through floating point just to be
 * printed. Without the thousands separator a reader has to count digits to
 * know whether they are looking at hundreds or thousands.
 */
export function formatBrl(value: Money): string {
  const decimal = toDecimalString(value);
  const negative = decimal.startsWith("-");
  const [whole = "0", cents = "00"] = (negative ? decimal.slice(1) : decimal).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${negative ? "-" : ""}R$ ${grouped},${cents}`;
}
