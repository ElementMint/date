// ============================================================================
// date-utils.ts - Pure date utility functions (no DOM dependencies)
// ============================================================================

/**
 * Returns the number of days in the given month.
 * Month is 0-indexed (0 = January, 11 = December).
 */
export function getDaysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of the current month
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Returns the day of the week for the first day of the given month.
 * 0 = Sunday, 6 = Saturday.
 */
export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/**
 * Checks whether the given year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Checks whether two dates represent the same calendar day
 * (ignoring time components).
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Checks whether a date falls within an optional min/max range (inclusive).
 * If min or max is undefined/null, that bound is not checked.
 */
export function isDateInRange(
  date: Date,
  min?: Date | null,
  max?: Date | null,
): boolean {
  const d = toDateOnly(date);
  if (min) {
    const minD = toDateOnly(min);
    if (d.getTime() < minD.getTime()) return false;
  }
  if (max) {
    const maxD = toDateOnly(max);
    if (d.getTime() > maxD.getTime()) return false;
  }
  return true;
}

/**
 * Returns a new Date that is `days` days after the given date.
 * Negative values go backwards.
 */
export function addDays(date: Date, days: number): Date {
  const result = cloneDate(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Returns a new Date that is `months` months after the given date.
 * If the target month has fewer days, the day is clamped to the last
 * day of that month (e.g., Jan 31 + 1 month = Feb 28/29).
 */
export function addMonths(date: Date, months: number): Date {
  const result = cloneDate(date);
  const targetMonth = result.getMonth() + months;
  const day = result.getDate();

  // Set to day 1 first to avoid overflow when setting month
  result.setDate(1);
  result.setMonth(targetMonth);

  // Clamp the day to the max days in the target month
  const maxDay = getDaysInMonth(result.getFullYear(), result.getMonth());
  result.setDate(Math.min(day, maxDay));

  return result;
}

/**
 * Returns a new Date that is `years` years after the given date.
 * Handles Feb 29 -> Feb 28 when landing on a non-leap year.
 */
export function addYears(date: Date, years: number): Date {
  const result = cloneDate(date);
  const targetYear = result.getFullYear() + years;
  const month = result.getMonth();
  const day = result.getDate();

  // Clamp Feb 29 to Feb 28 before setting the year to prevent
  // setFullYear from rolling the date into March.
  if (month === 1 && day === 29 && !isLeapYear(targetYear)) {
    result.setDate(28);
  }

  result.setFullYear(targetYear);

  return result;
}

/**
 * Returns a new Date representing the first day of the given date's month,
 * with time set to midnight.
 */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Returns a new Date representing the last day of the given date's month,
 * with time set to 23:59:59.999.
 */
export function endOfMonth(date: Date): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = getDaysInMonth(year, month);
  return new Date(year, month, lastDay, 23, 59, 59, 999);
}

/**
 * Returns a shallow clone of the given Date object.
 */
export function cloneDate(date: Date): Date {
  return new Date(date.getTime());
}

/**
 * Strips the time component from a Date, returning a new Date at midnight.
 */
export function toDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Returns today's date with time stripped (midnight).
 */
export function today(): Date {
  return toDateOnly(new Date());
}

/**
 * Compares two dates by calendar day. Returns:
 *  -1 if a < b, 0 if same day, 1 if a > b
 */
export function compareDays(a: Date, b: Date): -1 | 0 | 1 {
  const aOnly = toDateOnly(a).getTime();
  const bOnly = toDateOnly(b).getTime();
  if (aOnly < bOnly) return -1;
  if (aOnly > bOnly) return 1;
  return 0;
}
