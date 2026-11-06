import { CHARTER_NIGHTS } from './constants';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Strictly parses YYYY-MM-DD (rejects 2027-02-30 and similar). Returns a UTC midnight Date or null. */
export function parseISODate(value: unknown): Date | null {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (isNaN(date.getTime())) return null;
  return toISODate(date) === value ? date : null;
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isValidDate(value: unknown): boolean {
  return parseISODate(value) !== null;
}

export function isSaturday(value: string): boolean {
  return parseISODate(value)?.getUTCDay() === 6;
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

/** A "future" date is strictly after today (UTC). */
export function isFutureDate(value: string, now: Date = new Date()): boolean {
  return isValidDate(value) && value > todayISO(now);
}

export function addDays(value: string, days: number): string {
  const date = parseISODate(value);
  if (!date) throw new Error(`Invalid date: ${value}`);
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

export function deriveEndDate(startDate: string): string {
  return addDays(startDate, CHARTER_NIGHTS);
}

function shortDay(value: string): string {
  const date = parseISODate(value)!;
  return `${DAYS[date.getUTCDay()]} ${String(date.getUTCDate()).padStart(2, '0')} ${MONTHS[date.getUTCMonth()]}`;
}

/** 'Sat 12 Jun – Sat 19 Jun 2027 · 7 nights' */
export function formatDateRange(startDate: string, endDate: string = deriveEndDate(startDate)): string {
  const year = parseISODate(endDate)!.getUTCFullYear();
  return `${shortDay(startDate)} – ${shortDay(endDate)} ${year} · ${CHARTER_NIGHTS} nights`;
}

export function formatShortDate(value: string): string {
  const date = parseISODate(value.slice(0, 10));
  if (!date) return value;
  return `${String(date.getUTCDate()).padStart(2, '0')} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** All Saturdays (ISO strings) within the given month. */
export function saturdaysInMonth(year: number, month: number): string[] {
  const result: string[] = [];
  const d = new Date(Date.UTC(year, month, 1));
  while (d.getUTCMonth() === month) {
    if (d.getUTCDay() === 6) result.push(toISODate(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return result;
}
