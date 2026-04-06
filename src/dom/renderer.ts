// ============================================================================
// renderer.ts - Calendar DOM rendering (day grid, month picker, year picker)
// ============================================================================

import type { CalendarMonth, CalendarDay, DatePickerConfig } from '../core/types';
import { getMonthNames, getDayNames, getTextDirection } from '../core/locale';

/** Extended config that supports optional icon overrides */
interface RenderConfig extends DatePickerConfig {
  iconPrev?: string;
  iconNext?: string;
}

/** Default SVG chevron pointing left (previous) */
const DEFAULT_ICON_PREV =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
  '<path d="M10 12L6 8L10 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';

/** Default SVG chevron pointing right (next) */
const DEFAULT_ICON_NEXT =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
  '<path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';

/** Calendar view modes */
export type CalendarView = 'days' | 'months' | 'years';

/**
 * Creates a DOM element with optional attributes and class names.
 */
function el(
  tag: string,
  classNames?: string | string[],
  attrs?: Record<string, string>,
): HTMLElement {
  const element = document.createElement(tag);
  if (classNames) {
    const names = Array.isArray(classNames) ? classNames : [classNames];
    for (const name of names) {
      if (name) element.classList.add(name);
    }
  }
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      element.setAttribute(key, value);
    }
  }
  return element;
}

/**
 * Formats day.date to an ISO date string (YYYY-MM-DD) for data attributes.
 */
function toISODateString(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Builds the ordered weekday header names array, rotated to start on
 * the configured weekStart day.
 */
function getOrderedDayNames(locale: string, weekStart: number): string[] {
  const allNames = getDayNames(locale, 'narrow');
  const ordered: string[] = [];
  for (let i = 0; i < 7; i++) {
    ordered.push(allNames[(weekStart + i) % 7]);
  }
  return ordered;
}

/**
 * Creates a single day cell element.
 */
function renderDayCell(day: CalendarDay): HTMLElement {
  const classes: string[] = ['dp-day'];
  if (day.isToday) classes.push('dp-day--today');
  if (day.isSelected) classes.push('dp-day--selected');
  if (day.isRangeStart) classes.push('dp-day--range-start');
  if (day.isRangeEnd) classes.push('dp-day--range-end');
  if (day.isInRange) classes.push('dp-day--in-range');
  if (day.isDisabled) classes.push('dp-day--disabled');
  if (day.isOtherMonth) classes.push('dp-day--other-month');

  const isoDate = toISODateString(day.date);

  const cell = el('button', classes, {
    type: 'button',
    'data-date': isoDate,
    'aria-label': isoDate,
    role: 'gridcell',
  });

  if (day.isDisabled) {
    cell.setAttribute('aria-disabled', 'true');
    cell.setAttribute('disabled', '');
  }

  if (day.isSelected) {
    cell.setAttribute('aria-selected', 'true');
  }

  if (day.isToday) {
    cell.setAttribute('aria-current', 'date');
  }

  cell.textContent = String(day.day);

  return cell;
}

// ============================================================================
// Main calendar renderer (day view)
// ============================================================================

/**
 * Renders a complete calendar popup DOM structure for the given month.
 *
 * Structure:
 *   .dp-calendar
 *     .dp-header
 *       button.dp-nav-prev
 *       .dp-title
 *         button.dp-month-btn  (clickable month name)
 *         button.dp-year-btn   (clickable year)
 *       button.dp-nav-next
 *     .dp-weekdays (role="row")
 *     .dp-body
 *       .dp-grid (role="grid") — day view (default)
 *       .dp-months-grid        — month picker (hidden by default)
 *       .dp-years-grid         — year picker (hidden by default)
 */
export function renderCalendar(
  month: CalendarMonth,
  config: RenderConfig,
): HTMLElement {
  const direction = getTextDirection(config.locale);
  const monthNames = getMonthNames(config.locale, 'long');
  const monthName = monthNames[month.month] ?? '';

  // Root container
  const calendar = el('div', 'dp-calendar', {
    role: 'dialog',
    'aria-label': `Calendar: ${monthName} ${month.year}`,
    dir: direction,
    'data-view': 'days',
  });

  // Header
  const header = el('div', 'dp-header');

  const prevBtn = el('button', 'dp-nav-prev', {
    type: 'button',
    'aria-label': 'Previous',
    'data-action': 'prev',
  });
  prevBtn.innerHTML = (config as RenderConfig).iconPrev ?? DEFAULT_ICON_PREV;

  const title = el('div', 'dp-title', {
    'aria-live': 'polite',
    role: 'heading',
    'aria-level': '2',
  });

  // Clickable month button
  const monthBtn = el('button', 'dp-month-btn', {
    type: 'button',
    'aria-label': `Select month, current: ${monthName}`,
    'data-action': 'show-months',
  });
  monthBtn.textContent = monthName;

  // Clickable year button
  const yearBtn = el('button', 'dp-year-btn', {
    type: 'button',
    'aria-label': `Select year, current: ${month.year}`,
    'data-action': 'show-years',
  });
  yearBtn.textContent = String(month.year);

  title.appendChild(monthBtn);
  title.appendChild(yearBtn);

  const nextBtn = el('button', 'dp-nav-next', {
    type: 'button',
    'aria-label': 'Next',
    'data-action': 'next',
  });
  nextBtn.innerHTML = (config as RenderConfig).iconNext ?? DEFAULT_ICON_NEXT;

  header.appendChild(prevBtn);
  header.appendChild(title);
  header.appendChild(nextBtn);
  calendar.appendChild(header);

  // Weekday headers
  const weekdayRow = el('div', 'dp-weekdays', { role: 'row' });
  const dayNames = getOrderedDayNames(config.locale, config.weekStart);
  const fullDayNames = getDayNames(config.locale, 'long');
  const orderedFullNames: string[] = [];
  for (let i = 0; i < 7; i++) {
    orderedFullNames.push(fullDayNames[(config.weekStart + i) % 7]);
  }

  for (let i = 0; i < 7; i++) {
    const dayHeader = el('span', 'dp-weekday', {
      role: 'columnheader',
      'aria-label': orderedFullNames[i],
    });
    dayHeader.textContent = dayNames[i];
    weekdayRow.appendChild(dayHeader);
  }
  calendar.appendChild(weekdayRow);

  // Body container (holds all three views)
  const body = el('div', 'dp-body');

  // Day grid (default view)
  const grid = el('div', 'dp-grid', {
    role: 'grid',
    'aria-label': `${monthName} ${month.year}`,
  });

  for (let row = 0; row < month.days.length; row++) {
    const weekRow = el('div', 'dp-row', { role: 'row' });
    const week = month.days[row];
    for (let col = 0; col < week.length; col++) {
      weekRow.appendChild(renderDayCell(week[col]));
    }
    grid.appendChild(weekRow);
  }

  body.appendChild(grid);

  // Month picker (hidden initially)
  const monthsGrid = renderMonthsGrid(config.locale, month.month);
  body.appendChild(monthsGrid);

  // Year picker (hidden initially)
  const yearsGrid = renderYearsGrid(month.year, month.year);
  body.appendChild(yearsGrid);

  calendar.appendChild(body);

  return calendar;
}

// ============================================================================
// Month picker panel
// ============================================================================

/**
 * Renders a 4x3 grid of month buttons.
 */
export function renderMonthsGrid(locale: string, currentMonth: number): HTMLElement {
  const monthNames = getMonthNames(locale, 'short');
  const grid = el('div', 'dp-months-grid', {
    role: 'grid',
    'aria-label': 'Select a month',
  });
  grid.style.display = 'none'; // hidden by default

  for (let i = 0; i < 12; i++) {
    const classes = ['dp-month-cell'];
    if (i === currentMonth) classes.push('dp-month-cell--selected');

    const btn = el('button', classes, {
      type: 'button',
      'data-month': String(i),
      'data-action': 'select-month',
      'aria-label': monthNames[i],
    });
    btn.textContent = monthNames[i];
    grid.appendChild(btn);
  }

  return grid;
}

/**
 * Updates an existing months grid to reflect a new selected month.
 */
export function updateMonthsGrid(grid: HTMLElement, selectedMonth: number): void {
  const cells = grid.querySelectorAll('.dp-month-cell');
  cells.forEach((cell, i) => {
    cell.classList.toggle('dp-month-cell--selected', i === selectedMonth);
  });
}

// ============================================================================
// Year picker panel
// ============================================================================

/** Number of years shown in the year picker */
const YEAR_RANGE = 12;

/**
 * Returns the start year for a year range containing the given year.
 */
export function getYearRangeStart(year: number): number {
  return year - (year % YEAR_RANGE);
}

/**
 * Renders a 4x3 grid of year buttons for a range containing the given year.
 */
export function renderYearsGrid(year: number, selectedYear: number): HTMLElement {
  const startYear = getYearRangeStart(year);
  const grid = el('div', 'dp-years-grid', {
    role: 'grid',
    'aria-label': `Select a year: ${startYear} – ${startYear + YEAR_RANGE - 1}`,
    'data-range-start': String(startYear),
  });
  grid.style.display = 'none'; // hidden by default

  for (let i = 0; i < YEAR_RANGE; i++) {
    const y = startYear + i;
    const classes = ['dp-year-cell'];
    if (y === selectedYear) classes.push('dp-year-cell--selected');

    const btn = el('button', classes, {
      type: 'button',
      'data-year': String(y),
      'data-action': 'select-year',
      'aria-label': String(y),
    });
    btn.textContent = String(y);
    grid.appendChild(btn);
  }

  return grid;
}

/**
 * Rebuilds the year grid for a new range.
 */
export function updateYearsGrid(grid: HTMLElement, rangeStart: number, selectedYear: number): void {
  // Clear existing cells
  grid.innerHTML = '';
  grid.setAttribute('aria-label', `Select a year: ${rangeStart} – ${rangeStart + YEAR_RANGE - 1}`);
  grid.setAttribute('data-range-start', String(rangeStart));

  for (let i = 0; i < YEAR_RANGE; i++) {
    const y = rangeStart + i;
    const classes = ['dp-year-cell'];
    if (y === selectedYear) classes.push('dp-year-cell--selected');

    const btn = el('button', classes, {
      type: 'button',
      'data-year': String(y),
      'data-action': 'select-year',
      'aria-label': String(y),
    });
    btn.textContent = String(y);
    grid.appendChild(btn);
  }
}
