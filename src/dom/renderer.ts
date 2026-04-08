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
 * Builds the ordered weekday header names array.
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
function renderDayCell(day: CalendarDay, _config?: DatePickerConfig): HTMLElement {
  const classes: string[] = ['dp-day'];
  if (day.isToday) classes.push('dp-day--today');
  if (day.isSelected) classes.push('dp-day--selected');
  if (day.isRangeStart) classes.push('dp-day--range-start');
  if (day.isRangeEnd) classes.push('dp-day--range-end');
  if (day.isInRange) classes.push('dp-day--in-range');
  if (day.isDisabled) classes.push('dp-day--disabled');
  if (day.isOtherMonth) classes.push('dp-day--other-month');
  if (day.available === false) classes.push('dp-day--unavailable');
  if (day.blockedCheckIn) classes.push('dp-day--blocked-checkin');
  if (day.blockedCheckOut) classes.push('dp-day--blocked-checkout');

  const isoDate = toISODateString(day.date);

  const cell = el('button', classes, {
    type: 'button',
    'data-date': isoDate,
    'aria-label': isoDate,
    role: 'gridcell',
  });

  if (day.isDisabled || day.available === false) {
    cell.setAttribute('aria-disabled', 'true');
    cell.setAttribute('disabled', '');
  }

  if (day.isSelected) {
    cell.setAttribute('aria-selected', 'true');
  }

  if (day.isToday) {
    cell.setAttribute('aria-current', 'date');
  }

  const label = el('span', 'dp-day-label');
  label.textContent = String(day.day);
  cell.appendChild(label);

  // Price overlay
  if (day.price != null && !day.isOtherMonth) {
    const priceEl = el('span', 'dp-day-price');
    priceEl.textContent = typeof day.price === 'number' ? `$${day.price}` : String(day.price);
    cell.appendChild(priceEl);
  }

  return cell;
}

// ============================================================================
// Weekday row builder
// ============================================================================

function buildWeekdayRow(config: RenderConfig): HTMLElement {
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
  return weekdayRow;
}

// ============================================================================
// Day grid builder
// ============================================================================

function buildDayGrid(month: CalendarMonth, config: RenderConfig): HTMLElement {
  const monthNames = getMonthNames(config.locale, 'long');
  const monthName = monthNames[month.month] ?? '';

  const grid = el('div', 'dp-grid', {
    role: 'grid',
    'aria-label': `${monthName} ${month.year}`,
  });

  for (let row = 0; row < month.days.length; row++) {
    const weekRow = el('div', 'dp-row', { role: 'row' });
    const week = month.days[row];
    for (let col = 0; col < week.length; col++) {
      weekRow.appendChild(renderDayCell(week[col], config));
    }
    grid.appendChild(weekRow);
  }

  return grid;
}

// ============================================================================
// Single month panel (header + weekdays + grid)
// ============================================================================

function buildMonthPanel(
  month: CalendarMonth,
  config: RenderConfig,
  opts: { showPrev: boolean; showNext: boolean },
): HTMLElement {
  const panel = el('div', 'dp-month-panel');
  const monthNames = getMonthNames(config.locale, 'long');
  const monthName = monthNames[month.month] ?? '';

  // Header
  const header = el('div', 'dp-header');

  if (opts.showPrev) {
    const prevBtn = el('button', 'dp-nav-prev', {
      type: 'button',
      'aria-label': 'Previous',
      'data-action': 'prev',
    });
    prevBtn.innerHTML = (config as RenderConfig).iconPrev ?? DEFAULT_ICON_PREV;
    header.appendChild(prevBtn);
  } else {
    header.appendChild(el('div'));
  }

  const title = el('div', 'dp-title', {
    'aria-live': 'polite',
    role: 'heading',
    'aria-level': '2',
  });

  const monthBtn = el('button', 'dp-month-btn', {
    type: 'button',
    'aria-label': `Select month, current: ${monthName}`,
    'data-action': 'show-months',
  });
  monthBtn.textContent = monthName;

  const yearBtn = el('button', 'dp-year-btn', {
    type: 'button',
    'aria-label': `Select year, current: ${month.year}`,
    'data-action': 'show-years',
  });
  yearBtn.textContent = String(month.year);

  title.appendChild(monthBtn);
  title.appendChild(yearBtn);
  header.appendChild(title);

  if (opts.showNext) {
    const nextBtn = el('button', 'dp-nav-next', {
      type: 'button',
      'aria-label': 'Next',
      'data-action': 'next',
    });
    nextBtn.innerHTML = (config as RenderConfig).iconNext ?? DEFAULT_ICON_NEXT;
    header.appendChild(nextBtn);
  } else {
    header.appendChild(el('div'));
  }

  panel.appendChild(header);

  // Weekday headers
  panel.appendChild(buildWeekdayRow(config));

  // Body with day grid
  const body = el('div', 'dp-body');
  body.appendChild(buildDayGrid(month, config));

  // Month picker (hidden initially)
  const monthsGrid = renderMonthsGrid(config.locale, month.month);
  body.appendChild(monthsGrid);

  // Year picker (hidden initially)
  const yearsGrid = renderYearsGrid(month.year, month.year);
  body.appendChild(yearsGrid);

  panel.appendChild(body);

  return panel;
}

// ============================================================================
// Main calendar renderer
// ============================================================================

export function renderCalendar(
  month: CalendarMonth,
  config: RenderConfig,
  nextMonth?: CalendarMonth,
): HTMLElement {
  const direction = getTextDirection(config.locale);
  const monthNames = getMonthNames(config.locale, 'long');
  const monthName = monthNames[month.month] ?? '';
  const isDual = config.dualMonth && config.selectionMode === 'range' && nextMonth;

  const calendarClasses = ['dp-calendar'];
  if (isDual) calendarClasses.push('dp-calendar--dual');
  if (config.calendarMode === 'inline') calendarClasses.push('dp-calendar--inline');

  const calendar = el('div', calendarClasses, {
    role: 'dialog',
    'aria-label': `Calendar: ${monthName} ${month.year}`,
    dir: direction,
    'data-view': 'days',
  });

  if (isDual && nextMonth) {
    // Dual month view
    const leftPanel = buildMonthPanel(month, config, { showPrev: true, showNext: false });
    const rightPanel = buildMonthPanel(nextMonth, config, { showPrev: false, showNext: true });
    rightPanel.classList.add('dp-month-panel--right');
    calendar.appendChild(leftPanel);
    calendar.appendChild(rightPanel);
  } else {
    // Single month view
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

    const monthBtn = el('button', 'dp-month-btn', {
      type: 'button',
      'aria-label': `Select month, current: ${monthName}`,
      'data-action': 'show-months',
    });
    monthBtn.textContent = monthName;

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
    calendar.appendChild(buildWeekdayRow(config));

    // Body container
    const body = el('div', 'dp-body');

    // Day grid
    body.appendChild(buildDayGrid(month, config));

    // Month picker
    body.appendChild(renderMonthsGrid(config.locale, month.month));

    // Year picker
    body.appendChild(renderYearsGrid(month.year, month.year));

    calendar.appendChild(body);
  }

  // Time picker
  if (config.timePicker) {
    calendar.appendChild(renderTimePicker(config));
  }

  // Presets bar
  if (config.presets && config.selectionMode === 'range') {
    calendar.appendChild(renderPresetsBar());
  }

  return calendar;
}

// ============================================================================
// Time picker panel
// ============================================================================

function renderTimePicker(config: RenderConfig): HTMLElement {
  const wrapper = el('div', 'dp-time');

  const hourInput = document.createElement('input');
  hourInput.type = 'text';
  hourInput.className = 'dp-time-segment';
  hourInput.setAttribute('data-time-part', 'hour');
  hourInput.setAttribute('inputmode', 'numeric');
  hourInput.setAttribute('maxlength', '2');
  hourInput.setAttribute('placeholder', 'HH');
  hourInput.setAttribute('aria-label', 'Hour');
  hourInput.value = '12';
  wrapper.appendChild(hourInput);

  const sep = el('span', 'dp-time-separator');
  sep.textContent = ':';
  wrapper.appendChild(sep);

  const minInput = document.createElement('input');
  minInput.type = 'text';
  minInput.className = 'dp-time-segment';
  minInput.setAttribute('data-time-part', 'minute');
  minInput.setAttribute('inputmode', 'numeric');
  minInput.setAttribute('maxlength', '2');
  minInput.setAttribute('placeholder', 'MM');
  minInput.setAttribute('aria-label', 'Minute');
  minInput.value = '00';
  wrapper.appendChild(minInput);

  if (config.timeFormat === '12') {
    const amBtn = el('button', ['dp-time-period', 'dp-time-period--active'], {
      type: 'button',
      'data-period': 'AM',
      'aria-label': 'AM',
    });
    amBtn.textContent = 'AM';
    wrapper.appendChild(amBtn);

    const pmBtn = el('button', 'dp-time-period', {
      type: 'button',
      'data-period': 'PM',
      'aria-label': 'PM',
    });
    pmBtn.textContent = 'PM';
    wrapper.appendChild(pmBtn);
  }

  return wrapper;
}

// ============================================================================
// Presets bar
// ============================================================================

export function renderPresetsBar(): HTMLElement {
  const bar = el('div', 'dp-presets');

  const presetDefs = [
    { label: 'Tonight', key: 'tonight' },
    { label: 'This Weekend', key: 'this-weekend' },
    { label: 'Next 7 Days', key: 'next-7' },
    { label: 'Next 30 Days', key: 'next-30' },
  ];

  for (const preset of presetDefs) {
    const btn = el('button', 'dp-preset-btn', {
      type: 'button',
      'data-preset': preset.key,
      'aria-label': preset.label,
    });
    btn.textContent = preset.label;
    bar.appendChild(btn);
  }

  return bar;
}

// ============================================================================
// Month picker panel
// ============================================================================

export function renderMonthsGrid(locale: string, currentMonth: number): HTMLElement {
  const monthNames = getMonthNames(locale, 'short');
  const grid = el('div', 'dp-months-grid', {
    role: 'grid',
    'aria-label': 'Select a month',
  });
  grid.style.display = 'none';

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

export function updateMonthsGrid(grid: HTMLElement, selectedMonth: number): void {
  const cells = grid.querySelectorAll('.dp-month-cell');
  cells.forEach((cell, i) => {
    cell.classList.toggle('dp-month-cell--selected', i === selectedMonth);
  });
}

// ============================================================================
// Year picker panel
// ============================================================================

const YEAR_RANGE = 12;

export function getYearRangeStart(year: number): number {
  return year - (year % YEAR_RANGE);
}

export function renderYearsGrid(year: number, selectedYear: number): HTMLElement {
  const startYear = getYearRangeStart(year);
  const grid = el('div', 'dp-years-grid', {
    role: 'grid',
    'aria-label': `Select a year: ${startYear} – ${startYear + YEAR_RANGE - 1}`,
    'data-range-start': String(startYear),
  });
  grid.style.display = 'none';

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

export function updateYearsGrid(grid: HTMLElement, rangeStart: number, selectedYear: number): void {
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

// ============================================================================
// Mobile sheet wrapper
// ============================================================================

export function renderMobileSheet(calendarEl: HTMLElement, title: string): { backdrop: HTMLElement; sheet: HTMLElement } {
  const backdrop = el('div', 'dp-sheet-backdrop');

  const sheet = el('div', ['dp-calendar', 'dp-calendar--sheet']);
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', title);

  const sheetHeader = el('div', 'dp-sheet-header');

  const sheetTitle = el('span', 'dp-sheet-title');
  sheetTitle.textContent = title;

  const closeBtn = el('button', 'dp-sheet-close', {
    type: 'button',
    'aria-label': 'Close',
  });
  closeBtn.textContent = '×';

  sheetHeader.appendChild(sheetTitle);
  sheetHeader.appendChild(closeBtn);
  sheet.appendChild(sheetHeader);

  // Move calendar content into sheet
  while (calendarEl.firstChild) {
    sheet.appendChild(calendarEl.firstChild);
  }

  return { backdrop, sheet };
}
