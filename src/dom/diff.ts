// ============================================================================
// diff.ts - Efficient DOM updates for the calendar grid
// ============================================================================

import type { CalendarMonth, CalendarDay, DatePickerConfig } from '../core/types';
import { getMonthNames } from '../core/locale';

/**
 * Formats a Date as "YYYY-MM-DD" for data-attribute comparison.
 */
function toISODateString(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** CSS class constants matching renderer.ts */
const CLS_TODAY = 'dp-day--today';
const CLS_SELECTED = 'dp-day--selected';
const CLS_RANGE_START = 'dp-day--range-start';
const CLS_RANGE_END = 'dp-day--range-end';
const CLS_IN_RANGE = 'dp-day--in-range';
const CLS_DISABLED = 'dp-day--disabled';
const CLS_OTHER_MONTH = 'dp-day--other-month';

/**
 * Diffs an existing calendar DOM structure against new month data and
 * applies only the changes.
 */
export function diffCalendarGrid(
  calendar: HTMLElement,
  newMonth: CalendarMonth,
  config: DatePickerConfig,
): void {
  // Update the title (month button + year button)
  updateTitle(calendar, newMonth, config);

  // Update the grid cells
  const grid = calendar.querySelector('.dp-grid');
  if (!grid) return;

  const rows = grid.querySelectorAll('.dp-row');

  for (let rowIdx = 0; rowIdx < newMonth.days.length; rowIdx++) {
    const row = rows[rowIdx];
    if (!row) continue;

    const cells = row.querySelectorAll('.dp-day') as NodeListOf<HTMLElement>;
    const week = newMonth.days[rowIdx];

    for (let colIdx = 0; colIdx < week.length; colIdx++) {
      const cell = cells[colIdx];
      if (!cell) continue;

      const day = week[colIdx];
      updateDayCell(cell, day);
    }
  }

  // Update the grid's aria-label
  const monthNames = getMonthNames(config.locale, 'long');
  const monthName = monthNames[newMonth.month] ?? '';
  const titleText = `${monthName} ${newMonth.year}`;
  grid.setAttribute('aria-label', titleText);
}

/**
 * Updates the title elements within the calendar header.
 */
function updateTitle(
  calendar: HTMLElement,
  newMonth: CalendarMonth,
  config: DatePickerConfig,
): void {
  const monthNames = getMonthNames(config.locale, 'long');
  const monthName = monthNames[newMonth.month] ?? '';

  // Update month button
  const monthBtn = calendar.querySelector('.dp-month-btn');
  if (monthBtn && monthBtn.textContent !== monthName) {
    monthBtn.textContent = monthName;
    monthBtn.setAttribute('aria-label', `Select month, current: ${monthName}`);
  }

  // Update year button
  const yearStr = String(newMonth.year);
  const yearBtn = calendar.querySelector('.dp-year-btn');
  if (yearBtn && yearBtn.textContent !== yearStr) {
    yearBtn.textContent = yearStr;
    yearBtn.setAttribute('aria-label', `Select year, current: ${yearStr}`);
  }

  // Update calendar aria-label
  calendar.setAttribute('aria-label', `Calendar: ${monthName} ${newMonth.year}`);
}

/**
 * Updates a single day cell element to match the given CalendarDay data.
 */
function updateDayCell(cell: HTMLElement, day: CalendarDay): void {
  const newDateStr = toISODateString(day.date);
  const oldDateStr = cell.getAttribute('data-date');
  const label = cell.querySelector('.dp-day-label');

  if (oldDateStr !== newDateStr) {
    cell.setAttribute('data-date', newDateStr);
    cell.setAttribute('aria-label', newDateStr);
    if (label) {
      label.textContent = String(day.day);
    }
  } else if (label && label.textContent !== String(day.day)) {
    label.textContent = String(day.day);
  }

  toggleClass(cell, CLS_TODAY, day.isToday);
  toggleClass(cell, CLS_SELECTED, day.isSelected);
  toggleClass(cell, CLS_RANGE_START, day.isRangeStart);
  toggleClass(cell, CLS_RANGE_END, day.isRangeEnd);
  toggleClass(cell, CLS_IN_RANGE, day.isInRange);
  toggleClass(cell, CLS_DISABLED, day.isDisabled);
  toggleClass(cell, CLS_OTHER_MONTH, day.isOtherMonth);

  updateAria(cell, 'aria-disabled', day.isDisabled ? 'true' : null);
  updateAria(cell, 'aria-selected', day.isSelected ? 'true' : null);
  updateAria(cell, 'aria-current', day.isToday ? 'date' : null);

  if (day.isDisabled) {
    cell.setAttribute('disabled', '');
  } else {
    cell.removeAttribute('disabled');
  }
}

function toggleClass(
  element: HTMLElement,
  className: string,
  shouldHave: boolean,
): void {
  const has = element.classList.contains(className);
  if (shouldHave && !has) {
    element.classList.add(className);
  } else if (!shouldHave && has) {
    element.classList.remove(className);
  }
}

function updateAria(
  element: HTMLElement,
  attr: string,
  value: string | null,
): void {
  const current = element.getAttribute(attr);
  if (value === null) {
    if (current !== null) {
      element.removeAttribute(attr);
    }
  } else {
    if (current !== value) {
      element.setAttribute(attr, value);
    }
  }
}
