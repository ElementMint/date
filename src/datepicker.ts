// ============================================================================
// datepicker.ts - Main DatePicker class that orchestrates all modules
// ============================================================================

import type {
  DatePickerConfig,
  CalendarMonth,
  ValidationResult,
} from './core/types';
import { parseConfig } from './core/config';
import { parseDate, parseISO } from './core/parser';
import { formatDate, formatForValue } from './core/formatter';
import { validateDate } from './core/validator';
import { generateMonth, offsetMonth } from './core/calendar';
import { getMonthNames } from './core/locale';
import {
  renderCalendar,
  updateMonthsGrid,
  updateYearsGrid,
  getYearRangeStart,
  type CalendarView,
} from './dom/renderer';
import { SegmentedInput } from './dom/input-mask';
import { positionCalendar, removePositioning } from './dom/positioning';
import { diffCalendarGrid } from './dom/diff';
import { EventDelegator } from './dom/events';
import { KeyboardNavigation } from './features/keyboard';
import { A11yManager } from './features/accessibility';
import { ErrorDisplay } from './features/error-display';
import { AsyncValidator } from './features/async-validation';

/**
 * Main DatePicker class. Wraps an HTMLInputElement (or an element containing
 * one) and provides a full calendar popup with segmented input, keyboard
 * navigation, accessibility, validation, and error display.
 */
export class DatePicker {
  private config: DatePickerConfig;
  private inputEl: HTMLInputElement;
  private wrapperEl: HTMLElement | null = null;
  private calendarEl: HTMLElement | null = null;
  private hiddenInput: HTMLInputElement | null = null;
  private segmentedInput: SegmentedInput | null = null;
  private keyboard: KeyboardNavigation | null = null;
  private a11y: A11yManager;
  private errorDisplay: ErrorDisplay | null = null;
  private asyncValidator: AsyncValidator | null = null;
  private events: EventDelegator | null = null;
  private currentMonth: { year: number; month: number };
  private selectedDate: Date | null = null;
  private isOpen: boolean = false;
  private destroyed: boolean = false;
  private currentView: CalendarView = 'days';
  private yearRangeStart: number = 0;

  // Bound listeners for cleanup
  private boundClickOutside: (e: MouseEvent) => void;
  private boundInputChange: () => void;
  private boundToggleClick: (e: MouseEvent) => void;

  constructor(element: HTMLElement) {
    if (element instanceof HTMLInputElement) {
      this.inputEl = element;
    } else {
      const input = element.querySelector<HTMLInputElement>('input');
      if (input) {
        this.inputEl = input;
      } else {
        throw new Error(
          'DatePicker: element must be an <input> or contain one.',
        );
      }
    }

    this.config = parseConfig(element);

    const now = new Date();
    this.currentMonth = { year: now.getFullYear(), month: now.getMonth() };
    this.yearRangeStart = getYearRangeStart(now.getFullYear());

    this.boundClickOutside = this.handleClickOutside.bind(this);
    this.boundInputChange = this.onInputChange.bind(this);
    this.boundToggleClick = this.onToggleClick.bind(this);

    this.a11y = new A11yManager();
    this.init();
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  open(): void {
    if (this.isOpen || this.destroyed) return;
    this.openCalendar();
  }

  close(): void {
    if (!this.isOpen || this.destroyed) return;
    this.closeCalendar();
  }

  getValue(): string | null {
    if (!this.selectedDate) return null;
    return formatForValue(this.selectedDate, this.config.valueType);
  }

  setValue(date: Date | string): void {
    let d: Date | null = null;
    if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'string') {
      d = parseDate(date, this.config.format) ?? parseISO(date);
    }
    if (d) {
      this.selectDate(d);
    }
  }

  getDate(): Date | null {
    return this.selectedDate ? new Date(this.selectedDate.getTime()) : null;
  }

  setDate(date: Date): void {
    this.selectDate(date);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.isOpen) {
      this.closeCalendar();
    }

    document.removeEventListener('mousedown', this.boundClickOutside);

    this.segmentedInput?.destroy();
    this.keyboard?.destroy();
    this.events?.destroy();
    this.a11y.destroy();
    this.errorDisplay?.destroy();
    this.asyncValidator?.destroy();

    if (this.calendarEl && this.calendarEl.parentNode) {
      this.calendarEl.parentNode.removeChild(this.calendarEl);
    }

    const toggle = this.wrapperEl?.querySelector('.dp-toggle');
    if (toggle) {
      toggle.removeEventListener('click', this.boundToggleClick as EventListener);
    }

    if (this.hiddenInput && this.hiddenInput.parentNode) {
      this.hiddenInput.parentNode.removeChild(this.hiddenInput);
    }

    if (this.wrapperEl && this.wrapperEl.parentNode) {
      this.wrapperEl.parentNode.insertBefore(this.inputEl, this.wrapperEl);
      this.wrapperEl.parentNode.removeChild(this.wrapperEl);
    }

    this.calendarEl = null;
    this.wrapperEl = null;
    this.hiddenInput = null;
    this.segmentedInput = null;
    this.keyboard = null;
    this.events = null;
    this.errorDisplay = null;
    this.asyncValidator = null;
  }

  // ===========================================================================
  // Initialisation
  // ===========================================================================

  private init(): void {
    this.createWrapper();
    this.setupInput();
    this.setupErrorDisplay();
    this.setupAsyncValidator();

    if (this.config.value) {
      const d = parseISO(this.config.value) ??
        parseDate(this.config.value, this.config.format);
      if (d) {
        this.selectedDate = d;
        this.currentMonth = { year: d.getFullYear(), month: d.getMonth() };
        this.yearRangeStart = getYearRangeStart(d.getFullYear());
        this.segmentedInput?.setValue(d);
        this.updateHiddenInput();
      }
    }

    if (this.config.disabled) {
      this.inputEl.setAttribute('disabled', '');
    }
    if (this.config.readOnly) {
      this.inputEl.setAttribute('readonly', '');
    }

    if (this.config.className && this.wrapperEl) {
      const classes = this.config.className.split(/\s+/).filter(Boolean);
      for (const cls of classes) {
        this.wrapperEl.classList.add(cls);
      }
    }

    if (this.wrapperEl) {
      this.wrapperEl.setAttribute('data-theme', this.config.theme);
    }

    document.addEventListener('mousedown', this.boundClickOutside);
  }

  private createWrapper(): void {
    this.wrapperEl = document.createElement('div');
    this.wrapperEl.className = 'dp-input';
    this.wrapperEl.style.position = 'relative';

    const parent = this.inputEl.parentNode;
    if (parent) {
      parent.insertBefore(this.wrapperEl, this.inputEl);
    }
    this.wrapperEl.appendChild(this.inputEl);

    this.hiddenInput = document.createElement('input');
    this.hiddenInput.type = 'hidden';
    if (this.config.name) {
      this.hiddenInput.name = this.config.name;
      this.inputEl.removeAttribute('name');
    }
    this.wrapperEl.appendChild(this.hiddenInput);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'dp-toggle';
    toggle.setAttribute('aria-label', 'Open calendar');
    toggle.setAttribute('tabindex', '-1');
    toggle.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<path d="M5 1V3M11 1V3M1 6H15M2 3H14C14.5523 3 15 3.44772 15 4V14C15 14.5523 14.5523 15 14 15H2C1.44772 15 1 14.5523 1 14V4C1 3.44772 1.44772 3 2 3Z" ' +
      'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
    toggle.addEventListener('click', this.boundToggleClick as EventListener);
    this.wrapperEl.appendChild(toggle);
  }

  private setupInput(): void {
    if (this.config.placeholder) {
      this.inputEl.setAttribute('placeholder', this.config.placeholder);
    }

    this.inputEl.setAttribute('role', 'combobox');
    this.inputEl.setAttribute('aria-haspopup', 'dialog');
    this.inputEl.setAttribute('aria-expanded', 'false');
    this.inputEl.setAttribute('autocomplete', 'off');

    this.segmentedInput = new SegmentedInput(this.inputEl, this.config.format);
    this.inputEl.addEventListener('blur', this.boundInputChange);
  }

  private setupErrorDisplay(): void {
    if (this.wrapperEl) {
      this.errorDisplay = new ErrorDisplay(this.wrapperEl);
    }
  }

  private setupAsyncValidator(): void {
    const url = this.inputEl.getAttribute('data-validate-url') ??
      this.inputEl.closest('[data-datepicker]')?.getAttribute('data-validate-url');
    if (url && this.wrapperEl) {
      this.asyncValidator = new AsyncValidator(url, this.wrapperEl);
    }
  }

  // ===========================================================================
  // Calendar lifecycle
  // ===========================================================================

  private openCalendar(): void {
    if (this.config.disabled || this.config.readOnly) return;

    this.isOpen = true;
    this.currentView = 'days';
    this.inputEl.setAttribute('aria-expanded', 'true');

    const monthData = this.generateCurrentMonth();
    this.calendarEl = renderCalendar(monthData, this.config);
    this.calendarEl.style.zIndex = '9999';

    if (this.wrapperEl) {
      this.wrapperEl.appendChild(this.calendarEl);
    }

    positionCalendar(this.inputEl, this.calendarEl);

    this.a11y.setCalendarRole(this.calendarEl);
    this.a11y.enableFocusTrap(this.calendarEl);

    const monthNames = getMonthNames(this.config.locale, 'long');
    this.a11y.announceMonthChange(
      monthNames[this.currentMonth.month] ?? '',
      this.currentMonth.year,
    );

    this.setupCalendarEvents();

    if (this.config.keyboard) {
      this.setupKeyboardNav();
    }

    this.inputEl.dispatchEvent(
      new CustomEvent('datepicker:open', { bubbles: true }),
    );
  }

  private closeCalendar(): void {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.currentView = 'days';
    this.inputEl.setAttribute('aria-expanded', 'false');

    if (this.keyboard) {
      this.keyboard.destroy();
      this.keyboard = null;
    }

    if (this.events) {
      this.events.destroy();
      this.events = null;
    }

    this.a11y.disableFocusTrap();

    if (this.calendarEl) {
      removePositioning(this.calendarEl);
      if (this.calendarEl.parentNode) {
        this.calendarEl.parentNode.removeChild(this.calendarEl);
      }
      this.calendarEl = null;
    }

    this.inputEl.dispatchEvent(
      new CustomEvent('datepicker:close', { bubbles: true }),
    );
  }

  // ===========================================================================
  // Event setup
  // ===========================================================================

  private setupCalendarEvents(): void {
    if (!this.calendarEl) return;

    this.events = new EventDelegator(this.calendarEl);

    // Day selection
    this.events.delegate('click', '.dp-day', (_event, el) => {
      if (this.currentView !== 'days') return;
      const dateStr = el.getAttribute('data-date');
      if (dateStr && !el.hasAttribute('disabled')) {
        const d = parseISO(dateStr);
        if (d) {
          this.selectDate(d);
          if (this.config.closeOnSelect) {
            this.closeCalendar();
          }
        }
      }
    });

    // Prev/next navigation (works differently per view)
    this.events.delegate('click', '.dp-nav-prev', () => {
      this.navigatePrev();
    });

    this.events.delegate('click', '.dp-nav-next', () => {
      this.navigateNext();
    });

    // Show month picker
    this.events.delegate('click', '.dp-month-btn', () => {
      if (this.currentView === 'months') {
        this.switchView('days');
      } else {
        this.switchView('months');
      }
    });

    // Show year picker
    this.events.delegate('click', '.dp-year-btn', () => {
      if (this.currentView === 'years') {
        this.switchView('days');
      } else {
        this.switchView('years');
      }
    });

    // Month selection
    this.events.delegate('click', '.dp-month-cell', (_event, el) => {
      const monthStr = el.getAttribute('data-month');
      if (monthStr != null) {
        this.currentMonth.month = parseInt(monthStr, 10);
        this.switchView('days');
        this.renderCurrentMonth();
        this.announceCurrentMonth();
      }
    });

    // Year selection
    this.events.delegate('click', '.dp-year-cell', (_event, el) => {
      const yearStr = el.getAttribute('data-year');
      if (yearStr != null) {
        this.currentMonth.year = parseInt(yearStr, 10);
        this.yearRangeStart = getYearRangeStart(this.currentMonth.year);
        this.switchView('days');
        this.renderCurrentMonth();
        this.announceCurrentMonth();
      }
    });
  }

  private setupKeyboardNav(): void {
    if (!this.calendarEl) return;

    this.keyboard = new KeyboardNavigation(this.calendarEl, {
      onSelect: (dateStr: string) => {
        if (this.currentView !== 'days') return;
        const d = parseISO(dateStr);
        if (d) {
          this.selectDate(d);
          if (this.config.closeOnSelect) {
            this.closeCalendar();
          }
        }
      },
      onPrevMonth: () => this.navigatePrev(),
      onNextMonth: () => this.navigateNext(),
      onPrevYear: () => {
        if (this.currentView === 'days') {
          this.navigateMonth(-12);
        } else {
          this.navigatePrev();
        }
      },
      onNextYear: () => {
        if (this.currentView === 'days') {
          this.navigateMonth(12);
        } else {
          this.navigateNext();
        }
      },
      onClose: () => this.closeCalendar(),
    });

    this.keyboard.focusFirst();
  }

  // ===========================================================================
  // View switching
  // ===========================================================================

  private switchView(view: CalendarView): void {
    if (!this.calendarEl) return;

    this.currentView = view;
    this.calendarEl.setAttribute('data-view', view);

    const dayGrid = this.calendarEl.querySelector('.dp-grid') as HTMLElement | null;
    const monthsGrid = this.calendarEl.querySelector('.dp-months-grid') as HTMLElement | null;
    const yearsGrid = this.calendarEl.querySelector('.dp-years-grid') as HTMLElement | null;
    const weekdays = this.calendarEl.querySelector('.dp-weekdays') as HTMLElement | null;

    // Hide all, then show the active one
    if (dayGrid) dayGrid.style.display = view === 'days' ? '' : 'none';
    if (monthsGrid) monthsGrid.style.display = view === 'months' ? '' : 'none';
    if (yearsGrid) yearsGrid.style.display = view === 'years' ? '' : 'none';
    if (weekdays) weekdays.style.display = view === 'days' ? '' : 'none';

    // Update the month/year buttons to show active state
    const monthBtn = this.calendarEl.querySelector('.dp-month-btn');
    const yearBtn = this.calendarEl.querySelector('.dp-year-btn');
    monthBtn?.classList.toggle('dp-month-btn--active', view === 'months');
    yearBtn?.classList.toggle('dp-year-btn--active', view === 'years');

    // Update panels content
    if (view === 'months' && monthsGrid) {
      updateMonthsGrid(monthsGrid, this.currentMonth.month);
    }
    if (view === 'years' && yearsGrid) {
      this.yearRangeStart = getYearRangeStart(this.currentMonth.year);
      updateYearsGrid(yearsGrid, this.yearRangeStart, this.currentMonth.year);
    }

    // Update prev/next button labels
    const prevBtn = this.calendarEl.querySelector('.dp-nav-prev');
    const nextBtn = this.calendarEl.querySelector('.dp-nav-next');
    if (view === 'days') {
      prevBtn?.setAttribute('aria-label', 'Previous month');
      nextBtn?.setAttribute('aria-label', 'Next month');
    } else if (view === 'months') {
      prevBtn?.setAttribute('aria-label', 'Previous year');
      nextBtn?.setAttribute('aria-label', 'Next year');
    } else if (view === 'years') {
      prevBtn?.setAttribute('aria-label', 'Previous 12 years');
      nextBtn?.setAttribute('aria-label', 'Next 12 years');
    }

    // Announce the view change
    if (view === 'months') {
      this.a11y.announce(`Select month for ${this.currentMonth.year}`);
    } else if (view === 'years') {
      this.a11y.announce(
        `Select year: ${this.yearRangeStart} to ${this.yearRangeStart + 11}`,
      );
    }
  }

  // ===========================================================================
  // Navigation (context-aware: depends on current view)
  // ===========================================================================

  private navigatePrev(): void {
    switch (this.currentView) {
      case 'days':
        this.navigateMonth(-1);
        break;
      case 'months':
        this.currentMonth.year -= 1;
        this.updateHeaderText();
        this.a11y.announce(`Year: ${this.currentMonth.year}`);
        break;
      case 'years':
        this.yearRangeStart -= 12;
        this.updateYearsPanel();
        this.a11y.announce(
          `Years: ${this.yearRangeStart} to ${this.yearRangeStart + 11}`,
        );
        break;
    }
  }

  private navigateNext(): void {
    switch (this.currentView) {
      case 'days':
        this.navigateMonth(1);
        break;
      case 'months':
        this.currentMonth.year += 1;
        this.updateHeaderText();
        this.a11y.announce(`Year: ${this.currentMonth.year}`);
        break;
      case 'years':
        this.yearRangeStart += 12;
        this.updateYearsPanel();
        this.a11y.announce(
          `Years: ${this.yearRangeStart} to ${this.yearRangeStart + 11}`,
        );
        break;
    }
  }

  private updateYearsPanel(): void {
    if (!this.calendarEl) return;
    const yearsGrid = this.calendarEl.querySelector('.dp-years-grid') as HTMLElement | null;
    if (yearsGrid) {
      updateYearsGrid(yearsGrid, this.yearRangeStart, this.currentMonth.year);
    }
  }

  private updateHeaderText(): void {
    if (!this.calendarEl) return;
    const monthNames = getMonthNames(this.config.locale, 'long');
    const monthBtn = this.calendarEl.querySelector('.dp-month-btn');
    const yearBtn = this.calendarEl.querySelector('.dp-year-btn');
    if (monthBtn) monthBtn.textContent = monthNames[this.currentMonth.month] ?? '';
    if (yearBtn) yearBtn.textContent = String(this.currentMonth.year);
  }

  private announceCurrentMonth(): void {
    const monthNames = getMonthNames(this.config.locale, 'long');
    this.a11y.announceMonthChange(
      monthNames[this.currentMonth.month] ?? '',
      this.currentMonth.year,
    );
  }

  // ===========================================================================
  // Date selection and month navigation
  // ===========================================================================

  private selectDate(date: Date): void {
    this.selectedDate = date;
    this.currentMonth = { year: date.getFullYear(), month: date.getMonth() };
    this.yearRangeStart = getYearRangeStart(date.getFullYear());

    this.segmentedInput?.setValue(date);
    this.updateHiddenInput();

    const formatted = formatDate(date, this.config.format, this.config.locale);
    this.a11y.announceSelection(formatted);

    if (this.isOpen && this.calendarEl) {
      this.renderCurrentMonth();
    }

    this.runValidation();

    this.inputEl.dispatchEvent(
      new CustomEvent('datepicker:change', {
        bubbles: true,
        detail: { date, value: this.getValue() },
      }),
    );
  }

  private navigateMonth(offset: number): void {
    const [newYear, newMonth] = offsetMonth(
      this.currentMonth.year,
      this.currentMonth.month,
      offset,
    );
    this.currentMonth = { year: newYear, month: newMonth };
    this.renderCurrentMonth();
    this.updateHeaderText();
    this.announceCurrentMonth();

    if (this.keyboard) {
      requestAnimationFrame(() => {
        this.keyboard?.focusFirst();
      });
    }
  }

  private renderCurrentMonth(): void {
    if (!this.calendarEl) return;

    const monthData = this.generateCurrentMonth();
    diffCalendarGrid(this.calendarEl, monthData, this.config);
    this.updateHeaderText();
  }

  private generateCurrentMonth(): CalendarMonth {
    const disabledDates = this.config.disabledDates
      .map((s) => parseISO(s))
      .filter((d): d is Date => d !== null);

    const min = this.config.min ? parseISO(this.config.min) : null;
    const max = this.config.max ? parseISO(this.config.max) : null;

    return generateMonth(
      this.currentMonth.year,
      this.currentMonth.month,
      {
        weekStart: this.config.weekStart,
        selected: this.selectedDate,
        min,
        max,
        disabledDates,
      },
    );
  }

  // ===========================================================================
  // Validation
  // ===========================================================================

  private validate(): ValidationResult {
    const displayValue = this.inputEl.value;
    const min = this.config.min ? parseISO(this.config.min) : null;
    const max = this.config.max ? parseISO(this.config.max) : null;

    return validateDate(displayValue, this.selectedDate, {
      required: this.config.required,
      min,
      max,
      rules: this.config.validate,
    });
  }

  private async runValidation(): Promise<void> {
    const syncResult = this.validate();
    if (!syncResult.valid) {
      this.errorDisplay?.show(syncResult.message ?? 'Invalid date');
      return;
    }

    if (this.asyncValidator && this.selectedDate) {
      try {
        const asyncResult = await this.asyncValidator.validate(this.selectedDate);
        if (!asyncResult.valid) {
          this.errorDisplay?.show(asyncResult.message ?? 'Date not available');
          return;
        }
      } catch {
        // Async validation failure is non-blocking
      }
    }

    this.errorDisplay?.hide();
  }

  // ===========================================================================
  // Event handlers
  // ===========================================================================

  private handleClickOutside(e: MouseEvent): void {
    if (!this.isOpen || !this.calendarEl || !this.wrapperEl) return;

    const target = e.target as Node;
    if (
      !this.wrapperEl.contains(target) &&
      !this.calendarEl.contains(target)
    ) {
      this.closeCalendar();
    }
  }

  private onInputChange(): void {
    if (this.destroyed) return;

    const date = this.segmentedInput?.getValue() ?? null;

    if (date) {
      this.selectedDate = date;
      this.currentMonth = {
        year: date.getFullYear(),
        month: date.getMonth(),
      };
      this.updateHiddenInput();
    } else {
      this.selectedDate = null;
      this.updateHiddenInput();
    }

    this.runValidation();

    if (this.isOpen && this.calendarEl) {
      this.renderCurrentMonth();
    }
  }

  private onToggleClick(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    if (this.isOpen) {
      this.closeCalendar();
    } else {
      this.openCalendar();
    }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private updateHiddenInput(): void {
    if (!this.hiddenInput) return;

    if (this.selectedDate) {
      this.hiddenInput.value = formatForValue(
        this.selectedDate,
        this.config.valueType,
      );
    } else {
      this.hiddenInput.value = '';
    }

    this.hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
