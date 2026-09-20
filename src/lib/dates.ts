/**
 * Calendar dates without time or timezone. The domain only ever reasons about
 * days ("the authorization is valid through the 24th"), so carrying a Date
 * object - and its timezone - would add ambiguity rather than precision.
 */
declare const isoDateBrand: unique symbol;

export type IsoDate = string & { readonly [isoDateBrand]: true };

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

export function isIsoDate(value: string): value is IsoDate {
  const match = ISO_DATE.exec(value);
  if (match === null) return false;
  const [, year, month, day] = match;
  return isRealCalendarDate(Number(year), Number(month), Number(day));
}

/** Returns the date, or `null` when the string is not a real `YYYY-MM-DD` day. */
export function toIsoDate(value: string): IsoDate | null {
  return isIsoDate(value) ? value : null;
}

/** Lexicographic comparison is chronological for `YYYY-MM-DD`. */
export function compareIsoDates(left: IsoDate, right: IsoDate): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function isBefore(left: IsoDate, right: IsoDate): boolean {
  return left < right;
}

/** Whole days from `from` to `to`; negative when `to` precedes `from`. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const millisecondsPerDay = 86_400_000;
  return Math.round((Date.parse(to) - Date.parse(from)) / millisecondsPerDay);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const shifted = new Date(Date.parse(date) + days * 86_400_000);
  return shifted.toISOString().slice(0, 10) as IsoDate;
}

/** `2026-08-19` -> `19/08/2026`, the format the clinic staff reads. */
export function formatBrazilianDate(date: IsoDate): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}
