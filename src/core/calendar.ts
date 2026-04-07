// ============================================================================
// calendar.ts - Calendar grid generation (no DOM dependencies)
// ============================================================================

import type { CalendarDay, CalendarMonth, WeekDay } from './types';
import {
  getDaysInMonth,
  getFirstDayOfMonth,
  isSameDay,
  isDateInRange,
  toDateOnly,
  compareDays,
} from './date-utils';

/** Options for calendar month generation */
export interface GenerateMonthOptions {
  /** First day of the week: 0=Sunday, 1=Monday, etc. */
  weekStart: WeekDay;
  /** Currently selected date(s) */
  selected?: Date | Date[] | null;
  /** Range start date */
  rangeStart?: Date | null;
  /** Range end date */
  rangeEnd?: Date | null;
  /** Hover-preview date for in-progress range picking */
  previewEnd?: Date | null;
  /** Minimum selectable date */
  min?: Date | null;
  /** Maximum selectable date */
  max?: Date | null;
  /** Specific dates to disable (in addition to min/max) */
  disabledDates?: Date[];
}

/** Number of rows in the calendar grid */
const GRID_ROWS = 6;
/** Number of columns (days per week) */
const GRID_COLS = 7;

/**
 * Checks whether a date matches any date in a list (by calendar day).
 */
function isInDateList(date: Date, list: Date[]): boolean {
  return list.some((d) => isSameDay(date, d));
}

/**
 * Checks whether a date is selected. Supports single or multiple selection.
 */
function isSelected(
  date: Date,
  selected: Date | Date[] | null | undefined,
): boolean {
  if (!selected) return false;
  if (Array.isArray(selected)) {
    return selected.some((s) => isSameDay(date, s));
  }
  return isSameDay(date, selected);
}

/**
 * Generates a full 6x7 calendar grid for the given month.
 *
 * The grid always has 6 rows of 7 days, filling in days from the
 * previous and next months as needed.
 *
 * @param year    - Full year (e.g. 2024)
 * @param month   - 0-indexed month (0 = January, 11 = December)
 * @param options - Configuration for the grid
 * @returns CalendarMonth with a 6x7 days grid
 */
export function generateMonth(
  year: number,
  month: number,
  options: GenerateMonthOptions,
): CalendarMonth {
  const {
    weekStart = 0,
    selected = null,
    rangeStart = null,
    rangeEnd = null,
    previewEnd = null,
    min = null,
    max = null,
    disabledDates = [],
  } = options;

  const today = toDateOnly(new Date());
  const totalDays = getDaysInMonth(year, month);
  const firstDow = getFirstDayOfMonth(year, month);

  // Calculate how many days from the previous month to show.
  // If firstDow === weekStart, we show 0 leading days from prev month,
  // but we still need a full grid.
  const leadingDays = (firstDow - weekStart + 7) % 7;

  // Calculate previous month info
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonthTotalDays = getDaysInMonth(prevYear, prevMonth);

  // Build flat list of all 42 days
  const allDays: CalendarDay[] = [];

  // Previous month trailing days
  for (let i = leadingDays - 1; i >= 0; i--) {
    const day = prevMonthTotalDays - i;
    const date = new Date(prevYear, prevMonth, day);
    allDays.push(
      createCalendarDay(
        date,
        day,
        true,
        today,
        selected,
        rangeStart,
        rangeEnd,
        previewEnd,
        min,
        max,
        disabledDates,
      ),
    );
  }

  // Current month days
  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, month, day);
    allDays.push(
      createCalendarDay(
        date,
        day,
        false,
        today,
        selected,
        rangeStart,
        rangeEnd,
        previewEnd,
        min,
        max,
        disabledDates,
      ),
    );
  }

  // Next month leading days
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const remaining = GRID_ROWS * GRID_COLS - allDays.length;
  for (let day = 1; day <= remaining; day++) {
    const date = new Date(nextYear, nextMonth, day);
    allDays.push(
      createCalendarDay(
        date,
        day,
        true,
        today,
        selected,
        rangeStart,
        rangeEnd,
        previewEnd,
        min,
        max,
        disabledDates,
      ),
    );
  }

  // Build 6x7 grid
  const days: CalendarDay[][] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    const week: CalendarDay[] = [];
    for (let col = 0; col < GRID_COLS; col++) {
      week.push(allDays[row * GRID_COLS + col]);
    }
    days.push(week);
  }

  return { year, month, days };
}

/**
 * Creates a single CalendarDay object.
 */
function createCalendarDay(
  date: Date,
  day: number,
  isOtherMonth: boolean,
  today: Date,
  selectedDate: Date | Date[] | null,
  rangeStart: Date | null,
  rangeEnd: Date | null,
  previewEnd: Date | null,
  min: Date | null,
  max: Date | null,
  disabledDates: Date[],
): CalendarDay {
  const outOfRange = !isDateInRange(date, min, max);
  const explicitlyDisabled = disabledDates.length > 0 && isInDateList(date, disabledDates);
  const activeRangeEnd = rangeEnd ?? previewEnd;
  const isRangeStart = rangeStart ? isSameDay(date, rangeStart) : false;
  const isRangeEnd =
    activeRangeEnd && (!rangeStart || !isSameDay(rangeStart, activeRangeEnd))
      ? isSameDay(date, activeRangeEnd)
      : false;
  const isInRange =
    rangeStart && activeRangeEnd
      ? isDayWithinRange(date, rangeStart, activeRangeEnd)
      : false;
  const selected = isSelected(date, selectedDate) || isRangeStart || isRangeEnd;

  return {
    date,
    day,
    isToday: isSameDay(date, today),
    isSelected: selected,
    isRangeStart,
    isRangeEnd,
    isInRange,
    isDisabled: outOfRange || explicitlyDisabled,
    isOtherMonth,
  };
}

function isDayWithinRange(
  date: Date,
  start: Date,
  end: Date,
): boolean {
  const dayOnly = toDateOnly(date);
  const startOnly = toDateOnly(start);
  const endOnly = toDateOnly(end);

  if (compareDays(startOnly, endOnly) <= 0) {
    return compareDays(dayOnly, startOnly) >= 0 && compareDays(dayOnly, endOnly) <= 0;
  }

  return compareDays(dayOnly, endOnly) >= 0 && compareDays(dayOnly, startOnly) <= 0;
}

/**
 * Returns the year and month for the next month.
 *
 * @param year  - Current year
 * @param month - Current month (0-indexed)
 * @returns [nextYear, nextMonth]
 */
export function getNextMonth(
  year: number,
  month: number,
): [number, number] {
  if (month === 11) return [year + 1, 0];
  return [year, month + 1];
}

/**
 * Returns the year and month for the previous month.
 *
 * @param year  - Current year
 * @param month - Current month (0-indexed)
 * @returns [prevYear, prevMonth]
 */
export function getPrevMonth(
  year: number,
  month: number,
): [number, number] {
  if (month === 0) return [year - 1, 11];
  return [year, month - 1];
}

/**
 * Returns the year and month offset by a given number of months.
 * Positive values go forward, negative go backward.
 */
export function offsetMonth(
  year: number,
  month: number,
  offset: number,
): [number, number] {
  const totalMonths = year * 12 + month + offset;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = ((totalMonths % 12) + 12) % 12;
  return [newYear, newMonth];
}
