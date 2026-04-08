// ============================================================================
// datepicker.ts - Main DatePicker class that orchestrates all modules
// ============================================================================

import type {
  DatePickerConfig,
  CalendarMonth,
  ValidationResult,
  DateRangeValue,
  DayData,
  DisabledDateRule,
} from './core/types';
import { parseConfig } from './core/config';
import { parseDate, parseISO } from './core/parser';
import { formatDate, formatForValue, getFormatTokens } from './core/formatter';
import { validateDate } from './core/validator';
import { generateMonth, offsetMonth } from './core/calendar';
import { getMonthNames } from './core/locale';
import { compareDays, toDateOnly, isSameDay, addDays } from './core/date-utils';
import {
  renderCalendar,
  updateMonthsGrid,
  updateYearsGrid,
  getYearRangeStart,
  renderMobileSheet,
  type CalendarView,
} from './dom/renderer';
import { SegmentedInput } from './dom/input-mask';
import { NaturalDateInput, supportsNaturalInputFormat } from './dom/natural-input';
import { positionCalendar, removePositioning } from './dom/positioning';
import { diffCalendarGrid } from './dom/diff';
import { EventDelegator } from './dom/events';
import { KeyboardNavigation } from './features/keyboard';
import { A11yManager } from './features/accessibility';
import { ErrorDisplay } from './features/error-display';
import { AsyncValidator } from './features/async-validation';

/**
 * Main DatePicker class.
 */
export class DatePicker {
  private config: DatePickerConfig;
  private inputEl: HTMLInputElement;
  private wrapperEl: HTMLElement | null = null;
  private calendarEl: HTMLElement | null = null;
  private hiddenInput: HTMLInputElement | null = null;
  private segmentedInput: SegmentedInput | null = null;
  private naturalInput: NaturalDateInput | null = null;
  private keyboard: KeyboardNavigation | null = null;
  private a11y: A11yManager;
  private errorDisplay: ErrorDisplay | null = null;
  private asyncValidator: AsyncValidator | null = null;
  private events: EventDelegator | null = null;
  private currentMonth: { year: number; month: number };
  private selectedDate: Date | null = null;
  private rangeStartDate: Date | null = null;
  private rangeEndDate: Date | null = null;
  private isOpen: boolean = false;
  private destroyed: boolean = false;
  private currentView: CalendarView = 'days';
  private yearRangeStart: number = 0;
  private touchStartX: number | null = null;
  private touchStartY: number | null = null;
  private slideDirection: 'left' | 'right' | null = null;
  private dayDataCache: Map<string, DayData> = new Map();
  private disabledRules: DisabledDateRule[] = [];
  private selectedHour: number = 12;
  private selectedMinute: number = 0;
  private selectedPeriod: 'AM' | 'PM' = 'AM';
  private sheetBackdrop: HTMLElement | null = null;
  private splitInputContainer: HTMLElement | null = null;
  private portalContainer: HTMLElement | null = null;

  // Bound listeners for cleanup
  private boundClickOutside: (e: MouseEvent) => void;
  private boundInputChange: () => void;
  private boundToggleClick: (e: MouseEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;

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
    this.boundTouchStart = this.onTouchStart.bind(this);
    this.boundTouchEnd = this.onTouchEnd.bind(this);

    // Parse disabled rules
    if (this.config.disabledRules) {
      try {
        this.disabledRules = JSON.parse(this.config.disabledRules);
      } catch {
        this.disabledRules = [];
      }
    }

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
    if (this.config.selectionMode === 'range' || this.config.selectionMode === 'week') {
      if (!this.rangeStartDate) return null;
      const start = formatForValue(this.rangeStartDate, this.config.valueType);
      if (!this.rangeEndDate) return start;
      const end = formatForValue(this.rangeEndDate, this.config.valueType);
      return `${start},${end}`;
    }

    if (this.config.selectionMode === 'month') {
      if (!this.selectedDate) return null;
      return `${this.selectedDate.getFullYear()}-${String(this.selectedDate.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!this.selectedDate) return null;
    return formatForValue(this.selectedDate, this.config.valueType);
  }

  setValue(date: Date | string): void {
    if (this.config.selectionMode === 'range') {
      if (typeof date === 'string') {
        const parsed = this.parseRangeInput(date);
        if (parsed) {
          this.setRange(parsed.start, parsed.end);
        }
      }
      return;
    }

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
    if (this.config.selectionMode === 'range' || this.config.selectionMode === 'week') {
      return this.rangeStartDate ? new Date(this.rangeStartDate.getTime()) : null;
    }
    return this.selectedDate ? new Date(this.selectedDate.getTime()) : null;
  }

  setDate(date: Date): void {
    this.selectDate(date);
  }

  getRange(): DateRangeValue {
    return {
      start: this.rangeStartDate ? new Date(this.rangeStartDate.getTime()) : null,
      end: this.rangeEndDate ? new Date(this.rangeEndDate.getTime()) : null,
    };
  }

  setRange(start: Date | string | null, end: Date | string | null): void {
    const parsedStart = this.resolveDateLike(start);
    const parsedEnd = this.resolveDateLike(end);

    this.rangeStartDate = parsedStart ? toDateOnly(parsedStart) : null;
    this.rangeEndDate = parsedEnd ? toDateOnly(parsedEnd) : null;
    this.selectedDate = null;

    const visibleDate = this.rangeEndDate ?? this.rangeStartDate;
    if (visibleDate) {
      this.currentMonth = {
        year: visibleDate.getFullYear(),
        month: visibleDate.getMonth(),
      };
      this.yearRangeStart = getYearRangeStart(visibleDate.getFullYear());
    }

    this.syncVisibleInput();
    this.updateHiddenInput();

    if (this.isOpen && this.calendarEl) {
      this.renderCurrentMonth();
    }

    this.runValidation();
  }

  getTime(): { hour: number; minute: number; period?: string } {
    return {
      hour: this.selectedHour,
      minute: this.selectedMinute,
      ...(this.config.timeFormat === '12' ? { period: this.selectedPeriod } : {}),
    };
  }

  /** Load day data for availability/pricing overlays */
  setDayData(data: DayData[]): void {
    for (const item of data) {
      this.dayDataCache.set(item.date, item);
    }
    if (this.isOpen && this.calendarEl) {
      this.renderCurrentMonth();
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.isOpen) {
      this.closeCalendar();
    }

    document.removeEventListener('mousedown', this.boundClickOutside);

    this.segmentedInput?.destroy();
    this.naturalInput?.destroy();
    this.keyboard?.destroy();
    this.events?.destroy();
    this.a11y.destroy();
    this.errorDisplay?.destroy();
    this.asyncValidator?.destroy();

    if (this.calendarEl && this.calendarEl.parentNode) {
      this.calendarEl.parentNode.removeChild(this.calendarEl);
    }

    if (this.sheetBackdrop && this.sheetBackdrop.parentNode) {
      this.sheetBackdrop.parentNode.removeChild(this.sheetBackdrop);
    }

    const toggle = this.wrapperEl?.querySelector('.dp-toggle');
    if (toggle) {
      toggle.removeEventListener('click', this.boundToggleClick as EventListener);
    }

    this.inputEl.removeEventListener('blur', this.boundInputChange);
    this.inputEl.removeEventListener('input', this.boundInputChange);

    if (this.hiddenInput && this.hiddenInput.parentNode) {
      this.hiddenInput.parentNode.removeChild(this.hiddenInput);
    }

    if (this.splitInputContainer && this.splitInputContainer.parentNode) {
      this.splitInputContainer.parentNode.removeChild(this.splitInputContainer);
    }

    if (this.portalContainer && this.portalContainer.parentNode) {
      this.portalContainer.parentNode.removeChild(this.portalContainer);
    }

    if (this.wrapperEl && this.wrapperEl.parentNode) {
      this.wrapperEl.parentNode.insertBefore(this.inputEl, this.wrapperEl);
      this.wrapperEl.parentNode.removeChild(this.wrapperEl);
    }

    this.calendarEl = null;
    this.wrapperEl = null;
    this.hiddenInput = null;
    this.segmentedInput = null;
    this.naturalInput = null;
    this.keyboard = null;
    this.events = null;
    this.errorDisplay = null;
    this.asyncValidator = null;
    this.sheetBackdrop = null;
    this.splitInputContainer = null;
    this.portalContainer = null;
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
      if (this.config.selectionMode === 'range') {
        const parsedRange = this.parseRangeInput(this.config.value);
        if (parsedRange) {
          this.setRange(parsedRange.start, parsedRange.end);
        }
      } else {
        const d = parseISO(this.config.value) ??
          parseDate(this.config.value, this.config.format);
        if (d) {
          this.selectedDate = d;
          this.currentMonth = { year: d.getFullYear(), month: d.getMonth() };
          this.yearRangeStart = getYearRangeStart(d.getFullYear());
          this.segmentedInput?.setValue(d);
          this.syncVisibleInput();
          this.updateHiddenInput();
        }
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

    if (this.config.calendar) {
      document.addEventListener('mousedown', this.boundClickOutside);
    }

    // Inline mode: open immediately
    if (this.config.calendarMode === 'inline' && this.config.calendar) {
      this.openCalendar();
    }

    // Fetch day data if URL provided
    if (this.config.dayDataUrl) {
      this.fetchDayData();
    }
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

    // Calendar-only mode: make input readonly so user must use the calendar
    if (this.config.calendarOnly) {
      this.inputEl.setAttribute('readonly', '');
      this.inputEl.style.cursor = 'pointer';
      // Open calendar on input click in calendarOnly mode
      this.inputEl.addEventListener('click', () => {
        if (!this.isOpen) this.openCalendar();
      });
    }

    // Build split input for native mode when calendar is present
    if (this.config.inputMode === 'native' && this.config.calendar && this.usesNaturalInput() && !this.config.calendarOnly) {
      this.buildSplitInput();
    }

    if (this.config.calendar && !this.config.hideCalendarIcon) {
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
  }

  private buildSplitInput(): void {
    if (!this.wrapperEl) return;

    // Hide the original input visually
    this.inputEl.style.position = 'absolute';
    this.inputEl.style.opacity = '0';
    this.inputEl.style.pointerEvents = 'none';
    this.inputEl.style.width = '0';
    this.inputEl.style.height = '0';
    this.inputEl.style.overflow = 'hidden';

    const container = document.createElement('div');
    container.className = 'dp-split-input';
    this.splitInputContainer = container;

    const tokens = getFormatTokens(this.config.format);

    let fieldIndex = 0;
    for (const token of tokens) {
      if (!token.isDatePart) {
        const sep = document.createElement('span');
        sep.className = 'dp-split-sep';
        sep.textContent = token.token;
        container.appendChild(sep);
        continue;
      }

      const field = document.createElement('input');
      field.type = 'text';
      field.inputMode = 'numeric';
      field.className = 'dp-split-field';
      field.setAttribute('data-segment-type', token.segmentType || '');
      field.setAttribute('data-token', token.token);

      switch (token.token) {
        case 'D':
          field.placeholder = 'D';
          field.maxLength = 2;
          field.classList.add('dp-split-field--day');
          break;
        case 'DD':
          field.placeholder = 'DD';
          field.maxLength = 2;
          field.classList.add('dp-split-field--day');
          break;
        case 'M':
          field.placeholder = 'M';
          field.maxLength = 2;
          field.classList.add('dp-split-field--month');
          break;
        case 'MM':
          field.placeholder = 'MM';
          field.maxLength = 2;
          field.classList.add('dp-split-field--month');
          break;
        case 'YY':
          field.placeholder = 'YY';
          field.maxLength = 2;
          field.classList.add('dp-split-field--year-short');
          break;
        case 'YYYY':
          field.placeholder = 'YYYY';
          field.maxLength = 4;
          field.classList.add('dp-split-field--year');
          break;
      }

      const currentFieldIndex = fieldIndex;
      field.addEventListener('input', () => {
        this.onSplitFieldInput(field, currentFieldIndex);
      });
      field.addEventListener('keydown', (e) => {
        this.onSplitFieldKeydown(e, field, currentFieldIndex);
      });

      container.appendChild(field);
      fieldIndex++;
    }

    this.wrapperEl.insertBefore(container, this.inputEl);
  }

  private onSplitFieldInput(field: HTMLInputElement, _fieldIndex: number): void {
    // Only allow digits
    field.value = field.value.replace(/\D/g, '');

    // Auto-advance to next field when full
    if (field.value.length >= field.maxLength) {
      const next = field.nextElementSibling;
      if (next) {
        // Skip separators
        const nextField = next.classList.contains('dp-split-field')
          ? next as HTMLInputElement
          : next.nextElementSibling as HTMLInputElement | null;
        if (nextField && nextField.classList.contains('dp-split-field')) {
          nextField.focus();
          nextField.select();
        }
      }
    }

    this.syncFromSplitFields();
  }

  private onSplitFieldKeydown(e: KeyboardEvent, field: HTMLInputElement, _fieldIndex: number): void {
    if (e.key === 'Backspace' && field.value === '') {
      e.preventDefault();
      // Move to previous field
      let prev = field.previousElementSibling;
      while (prev && !prev.classList.contains('dp-split-field')) {
        prev = prev.previousElementSibling;
      }
      if (prev && prev instanceof HTMLInputElement) {
        prev.focus();
        prev.setSelectionRange(prev.value.length, prev.value.length);
      }
    }

    if (e.key === 'ArrowRight' && field.selectionStart === field.value.length) {
      let next = field.nextElementSibling;
      while (next && !next.classList.contains('dp-split-field')) {
        next = next.nextElementSibling;
      }
      if (next && next instanceof HTMLInputElement) {
        e.preventDefault();
        next.focus();
        next.setSelectionRange(0, 0);
      }
    }

    if (e.key === 'ArrowLeft' && field.selectionStart === 0) {
      let prev = field.previousElementSibling;
      while (prev && !prev.classList.contains('dp-split-field')) {
        prev = prev.previousElementSibling;
      }
      if (prev && prev instanceof HTMLInputElement) {
        e.preventDefault();
        prev.focus();
        prev.setSelectionRange(prev.value.length, prev.value.length);
      }
    }

    // Allow separator keys to advance
    if (e.key === '/' || e.key === '-' || e.key === '.') {
      e.preventDefault();
      let next = field.nextElementSibling;
      while (next && !next.classList.contains('dp-split-field')) {
        next = next.nextElementSibling;
      }
      if (next && next instanceof HTMLInputElement) {
        next.focus();
        next.select();
      }
    }
  }

  private syncFromSplitFields(): void {
    if (!this.splitInputContainer) return;

    const fields = this.splitInputContainer.querySelectorAll<HTMLInputElement>('.dp-split-field');
    const parts: Record<string, string> = {};

    fields.forEach((field) => {
      const token = field.getAttribute('data-token') || '';
      parts[token] = field.value;
    });

    // Build the formatted string
    let formatted = this.config.format;
    for (const [token, value] of Object.entries(parts)) {
      formatted = formatted.replace(token, value);
    }

    this.inputEl.value = formatted;
    this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private updateSplitFieldsFromDate(date: Date | null): void {
    if (!this.splitInputContainer) return;
    const fields = this.splitInputContainer.querySelectorAll<HTMLInputElement>('.dp-split-field');

    if (!date) {
      fields.forEach((field) => { field.value = ''; });
      return;
    }

    fields.forEach((field) => {
      const token = field.getAttribute('data-token') || '';
      switch (token) {
        case 'D':
          field.value = String(date.getDate());
          break;
        case 'DD':
          field.value = String(date.getDate()).padStart(2, '0');
          break;
        case 'M':
          field.value = String(date.getMonth() + 1);
          break;
        case 'MM':
          field.value = String(date.getMonth() + 1).padStart(2, '0');
          break;
        case 'YY':
          field.value = String(date.getFullYear()).slice(-2);
          break;
        case 'YYYY':
          field.value = String(date.getFullYear()).padStart(4, '0');
          break;
      }
    });
  }

  private setupInput(): void {
    if (this.config.placeholder) {
      this.inputEl.setAttribute('placeholder', this.config.placeholder);
    }

    if (this.config.calendar) {
      this.inputEl.setAttribute('role', 'combobox');
      this.inputEl.setAttribute('aria-haspopup', 'dialog');
      this.inputEl.setAttribute('aria-expanded', 'false');
    } else {
      this.inputEl.removeAttribute('role');
      this.inputEl.removeAttribute('aria-haspopup');
      this.inputEl.removeAttribute('aria-expanded');
    }
    this.inputEl.setAttribute('autocomplete', 'off');

    // In calendarOnly mode, skip all input editing handlers
    if (this.config.calendarOnly) {
      this.segmentedInput = null;
      this.naturalInput = null;
      return;
    }

    if (this.usesSegmentedInput()) {
      this.segmentedInput = new SegmentedInput(this.inputEl, this.config.format);
      this.naturalInput = null;
      this.inputEl.addEventListener('blur', this.boundInputChange);
    } else if (this.splitInputContainer) {
      // Split input mode: don't create NaturalDateInput, use split fields
      this.segmentedInput = null;
      this.naturalInput = null;
      this.inputEl.addEventListener('input', this.boundInputChange);
      this.inputEl.addEventListener('blur', this.boundInputChange);
    } else {
      this.segmentedInput = null;
      this.naturalInput = this.usesNaturalInput()
        ? new NaturalDateInput(this.inputEl, this.config.format)
        : null;
      this.inputEl.addEventListener('input', this.boundInputChange);
      this.inputEl.addEventListener('blur', this.boundInputChange);
    }
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
    if (!this.config.calendar || this.config.disabled || (this.config.readOnly && !this.config.calendarOnly)) return;

    this.isOpen = true;
    this.currentView = 'days';
    this.inputEl.setAttribute('aria-expanded', 'true');

    const monthData = this.generateCurrentMonth();
    const nextMonthData = this.config.dualMonth && this.config.selectionMode === 'range'
      ? this.generateNextMonth()
      : undefined;

    this.calendarEl = renderCalendar(monthData, this.config, nextMonthData);
    this.calendarEl.style.zIndex = '9999';

    this.appendCalendarExtras();

    // Check for mobile sheet mode
    if (this.config.mobileSheet && window.innerWidth <= this.config.mobileBreakpoint) {
      this.openAsMobileSheet();
      return;
    }

    if (this.config.calendarMode === 'inline' && this.wrapperEl) {
      this.calendarEl.style.zIndex = 'auto';
      this.wrapperEl.appendChild(this.calendarEl);
    } else if (this.config.portal) {
      // Portal mode: append to document.body and position using fixed/absolute
      this.portalContainer = document.createElement('div');
      this.portalContainer.className = 'dp-portal';
      this.portalContainer.style.position = 'absolute';
      this.portalContainer.style.zIndex = '99999';
      this.portalContainer.appendChild(this.calendarEl);
      document.body.appendChild(this.portalContainer);
      this.calendarEl.style.position = 'static';
      this.positionPortal();
    } else if (this.wrapperEl) {
      this.wrapperEl.appendChild(this.calendarEl);
      positionCalendar(this.inputEl, this.calendarEl);
    }

    this.a11y.setCalendarRole(this.calendarEl);
    if (this.config.calendarMode !== 'inline') {
      this.a11y.enableFocusTrap(this.calendarEl);
    }

    const monthNames = getMonthNames(this.config.locale, 'long');
    this.a11y.announceMonthChange(
      monthNames[this.currentMonth.month] ?? '',
      this.currentMonth.year,
    );

    this.setupCalendarEvents();
    this.setupTouchSupport();

    if (this.config.keyboard) {
      this.setupKeyboardNav();
    }

    this.trackAnalytics('open');

    this.inputEl.dispatchEvent(
      new CustomEvent('datepicker:open', { bubbles: true }),
    );
  }

  private openAsMobileSheet(): void {
    if (!this.calendarEl) return;

    const { backdrop, sheet } = renderMobileSheet(this.calendarEl, 'Select Date');
    this.sheetBackdrop = backdrop;
    this.calendarEl = sheet;

    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);

    // Close on backdrop click
    backdrop.addEventListener('click', () => this.closeCalendar());
    sheet.querySelector('.dp-sheet-close')?.addEventListener('click', () => this.closeCalendar());

    this.a11y.setCalendarRole(sheet);
    this.setupCalendarEvents();
    this.setupTouchSupport();

    if (this.config.keyboard) {
      this.setupKeyboardNav();
    }
  }

  private closeCalendar(): void {
    if (!this.isOpen) return;

    // Don't close inline calendars
    if (this.config.calendarMode === 'inline') return;

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

    this.teardownTouchSupport();

    this.a11y.disableFocusTrap();

    // Clean up mobile sheet
    if (this.sheetBackdrop && this.sheetBackdrop.parentNode) {
      this.sheetBackdrop.parentNode.removeChild(this.sheetBackdrop);
      this.sheetBackdrop = null;
    }

    if (this.calendarEl) {
      removePositioning(this.calendarEl);
      if (this.calendarEl.parentNode) {
        this.calendarEl.parentNode.removeChild(this.calendarEl);
      }
      this.calendarEl = null;
    }

    // Clean up portal container
    if (this.portalContainer && this.portalContainer.parentNode) {
      this.portalContainer.parentNode.removeChild(this.portalContainer);
      this.portalContainer = null;
    }

    this.inputEl.dispatchEvent(
      new CustomEvent('datepicker:close', { bubbles: true }),
    );
    this.trackAnalytics('close');
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
          if (this.shouldCloseOnSelection()) {
            this.closeCalendar();
          }
        }
      }
    });

    // Prev/next navigation
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
        if (this.config.selectionMode === 'month') {
          this.selectMonthMode(parseInt(monthStr, 10));
        } else {
          this.currentMonth.month = parseInt(monthStr, 10);
          this.switchView('days');
          this.renderCurrentMonth();
          this.announceCurrentMonth();
        }
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

    // Clear button
    this.events.delegate('click', '.dp-clear-btn', () => {
      this.clearSelection();
    });

    // Today button
    this.events.delegate('click', '.dp-today-btn', () => {
      this.goToToday();
    });

    // Preset buttons
    this.events.delegate('click', '.dp-preset-btn', (_event, el) => {
      const presetKey = el.getAttribute('data-preset');
      if (presetKey) {
        this.applyPreset(presetKey);
      }
    });

    // Time picker events
    if (this.config.timePicker) {
      this.setupTimePickerEvents();
    }

    // Week picker: row hover highlighting
    if (this.config.selectionMode === 'week') {
      this.setupWeekPickerEvents();
    }
  }

  private setupTimePickerEvents(): void {
    if (!this.calendarEl) return;

    const hourInput = this.calendarEl.querySelector('[data-time-part="hour"]') as HTMLInputElement;
    const minInput = this.calendarEl.querySelector('[data-time-part="minute"]') as HTMLInputElement;

    if (hourInput) {
      hourInput.addEventListener('change', () => {
        let val = parseInt(hourInput.value, 10);
        const max = this.config.timeFormat === '12' ? 12 : 23;
        const min = this.config.timeFormat === '12' ? 1 : 0;
        if (isNaN(val)) val = min;
        val = Math.max(min, Math.min(max, val));
        this.selectedHour = val;
        hourInput.value = String(val).padStart(2, '0');
        this.emitChangeEvent(this.selectedDate);
      });
    }

    if (minInput) {
      minInput.addEventListener('change', () => {
        let val = parseInt(minInput.value, 10);
        if (isNaN(val)) val = 0;
        val = Math.max(0, Math.min(59, val));
        this.selectedMinute = val;
        minInput.value = String(val).padStart(2, '0');
        this.emitChangeEvent(this.selectedDate);
      });
    }

    // AM/PM toggle
    this.events?.delegate('click', '.dp-time-period', (_event, el) => {
      const period = el.getAttribute('data-period') as 'AM' | 'PM';
      if (period) {
        this.selectedPeriod = period;
        const periods = this.calendarEl?.querySelectorAll('.dp-time-period');
        periods?.forEach((p) => {
          p.classList.toggle('dp-time-period--active', p.getAttribute('data-period') === period);
        });
        this.emitChangeEvent(this.selectedDate);
      }
    });
  }

  private setupWeekPickerEvents(): void {
    if (!this.calendarEl) return;

    // Hover highlighting for week rows
    this.calendarEl.addEventListener('mouseover', (e) => {
      const target = (e.target as HTMLElement).closest('.dp-day');
      if (!target || this.currentView !== 'days') return;

      const rows = this.calendarEl?.querySelectorAll('.dp-row');
      rows?.forEach((row) => {
        row.classList.remove('dp-row--week-hover');
        if (row.contains(target)) {
          row.classList.add('dp-row--week-hover');
        }
      });
    });

    this.calendarEl.addEventListener('mouseleave', () => {
      const rows = this.calendarEl?.querySelectorAll('.dp-row');
      rows?.forEach((row) => row.classList.remove('dp-row--week-hover'));
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
          if (this.shouldCloseOnSelection()) {
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

    // For dual-month, only switch view on the left panel
    const body = this.config.dualMonth
      ? this.calendarEl.querySelector('.dp-month-panel .dp-body') as HTMLElement
      : this.calendarEl.querySelector('.dp-body') as HTMLElement;

    if (!body) return;

    const dayGrid = body.querySelector('.dp-grid') as HTMLElement | null;
    const monthsGrid = body.querySelector('.dp-months-grid') as HTMLElement | null;
    const yearsGrid = body.querySelector('.dp-years-grid') as HTMLElement | null;

    const weekdays = this.config.dualMonth
      ? this.calendarEl.querySelector('.dp-month-panel .dp-weekdays') as HTMLElement
      : this.calendarEl.querySelector('.dp-weekdays') as HTMLElement;

    if (dayGrid) dayGrid.style.display = view === 'days' ? '' : 'none';
    if (monthsGrid) monthsGrid.style.display = view === 'months' ? '' : 'none';
    if (yearsGrid) yearsGrid.style.display = view === 'years' ? '' : 'none';
    if (weekdays) weekdays.style.display = view === 'days' ? '' : 'none';

    const monthBtn = this.calendarEl.querySelector('.dp-month-btn');
    const yearBtn = this.calendarEl.querySelector('.dp-year-btn');
    monthBtn?.classList.toggle('dp-month-btn--active', view === 'months');
    yearBtn?.classList.toggle('dp-year-btn--active', view === 'years');

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

    if (view === 'months') {
      this.a11y.announce(`Select month for ${this.currentMonth.year}`);
    } else if (view === 'years') {
      this.a11y.announce(
        `Select year: ${this.yearRangeStart} to ${this.yearRangeStart + 11}`,
      );
    }

    this.trackAnalytics('view_change', { view });
  }

  // ===========================================================================
  // Navigation
  // ===========================================================================

  private navigatePrev(): void {
    switch (this.currentView) {
      case 'days':
        this.slideDirection = 'right';
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
        this.slideDirection = 'left';
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
    if (this.config.selectionMode === 'range') {
      this.selectRangeDate(date);
      return;
    }

    if (this.config.selectionMode === 'week') {
      this.selectWeekDate(date);
      return;
    }

    if (this.config.selectionMode === 'month') {
      // In month mode, clicking a day selects the whole month
      this.selectMonthMode(date.getMonth());
      return;
    }

    this.selectSingleDate(date);
  }

  private selectSingleDate(date: Date): void {
    const normalized = toDateOnly(date);
    this.selectedDate = normalized;
    this.rangeStartDate = null;
    this.rangeEndDate = null;
    this.currentMonth = {
      year: normalized.getFullYear(),
      month: normalized.getMonth(),
    };
    this.yearRangeStart = getYearRangeStart(normalized.getFullYear());

    this.segmentedInput?.setValue(normalized);
    this.updateSplitFieldsFromDate(normalized);
    this.syncVisibleInput();
    this.updateHiddenInput();

    const formatted = this.formatDisplayDate(normalized);
    this.a11y.announceSelection(formatted);

    if (this.isOpen && this.calendarEl) {
      this.renderCurrentMonth();
    }

    this.runValidation();
    this.emitChangeEvent(normalized);
    this.trackAnalytics('select', {
      value: this.getValue(),
      displayValue: formatted,
    });
  }

  private selectRangeDate(date: Date): void {
    const normalized = toDateOnly(date);

    // Check blocked check-in/check-out
    if (this.isBlockedCheckIn(normalized) && !this.rangeStartDate) {
      return; // Can't start range on blocked check-in day
    }
    if (this.isBlockedCheckOut(normalized) && this.rangeStartDate && !this.rangeEndDate) {
      return; // Can't end range on blocked check-out day
    }

    if (!this.rangeStartDate || this.rangeEndDate) {
      this.rangeStartDate = normalized;
      this.rangeEndDate = null;
      this.selectedDate = null;
      this.currentMonth = {
        year: normalized.getFullYear(),
        month: normalized.getMonth(),
      };
      this.yearRangeStart = getYearRangeStart(normalized.getFullYear());
      this.syncVisibleInput();
      this.updateHiddenInput();

      if (this.isOpen && this.calendarEl) {
        this.renderCurrentMonth();
      }

      const formattedStart = this.formatDisplayDate(normalized);
      this.a11y.announce(`Start date selected ${formattedStart}`);
      this.emitChangeEvent(null);
      this.trackAnalytics('range_start', {
        range: this.getRange(),
        value: this.getValue(),
      });
      return;
    }

    if (compareDays(normalized, this.rangeStartDate) < 0) {
      this.rangeStartDate = normalized;
      this.rangeEndDate = null;
      this.currentMonth = {
        year: normalized.getFullYear(),
        month: normalized.getMonth(),
      };
      this.yearRangeStart = getYearRangeStart(normalized.getFullYear());
      this.syncVisibleInput();
      this.updateHiddenInput();

      if (this.isOpen && this.calendarEl) {
        this.renderCurrentMonth();
      }

      this.a11y.announce(`Start date updated to ${this.formatDisplayDate(normalized)}`);
      this.emitChangeEvent(null);
      this.trackAnalytics('range_restart', {
        range: this.getRange(),
        value: this.getValue(),
      });
      return;
    }

    // Validate min/max nights
    const nights = this.calculateNights(this.rangeStartDate, normalized);
    if (this.config.minNights > 0 && nights < this.config.minNights) {
      this.a11y.announce(`Minimum ${this.config.minNights} nights required`);
      return;
    }
    if (this.config.maxNights > 0 && nights > this.config.maxNights) {
      this.a11y.announce(`Maximum ${this.config.maxNights} nights allowed`);
      return;
    }

    this.rangeEndDate = normalized;
    this.currentMonth = {
      year: normalized.getFullYear(),
      month: normalized.getMonth(),
    };
    this.yearRangeStart = getYearRangeStart(normalized.getFullYear());
    this.syncVisibleInput();
    this.updateHiddenInput();

    if (this.isOpen && this.calendarEl) {
      this.renderCurrentMonth();
    }

    const startText = this.rangeStartDate
      ? this.formatDisplayDate(this.rangeStartDate)
      : '';
    const endText = this.formatDisplayDate(normalized);
    this.a11y.announce(`Selected range ${startText} to ${endText} (${nights} nights)`);

    this.runValidation();
    this.emitChangeEvent(null);
    this.trackAnalytics('range_complete', {
      range: this.getRange(),
      value: this.getValue(),
      nights,
    });
  }

  private selectWeekDate(date: Date): void {
    const normalized = toDateOnly(date);

    // Find the start of the week
    const dayOfWeek = normalized.getDay();
    const diff = (dayOfWeek - this.config.weekStart + 7) % 7;
    const weekStart = addDays(normalized, -diff);
    const weekEnd = addDays(weekStart, 6);

    this.rangeStartDate = weekStart;
    this.rangeEndDate = weekEnd;
    this.selectedDate = normalized;
    this.currentMonth = {
      year: normalized.getFullYear(),
      month: normalized.getMonth(),
    };

    this.syncVisibleInput();
    this.updateHiddenInput();

    if (this.isOpen && this.calendarEl) {
      this.renderCurrentMonth();
      // Add week-selected class to the row
      this.highlightSelectedWeekRow();
    }

    this.runValidation();
    this.emitChangeEvent(normalized);
    this.trackAnalytics('select', {
      mode: 'week',
      value: this.getValue(),
      weekStart: formatForValue(weekStart, 'iso'),
      weekEnd: formatForValue(weekEnd, 'iso'),
    });
  }

  private highlightSelectedWeekRow(): void {
    if (!this.calendarEl || !this.rangeStartDate) return;

    const rows = this.calendarEl.querySelectorAll('.dp-row');
    rows.forEach((row) => {
      row.classList.remove('dp-row--week-selected');
      const cells = row.querySelectorAll('.dp-day');
      for (const cell of cells) {
        const dateStr = cell.getAttribute('data-date');
        if (dateStr) {
          const d = parseISO(dateStr);
          if (d && this.rangeStartDate && isSameDay(d, this.rangeStartDate)) {
            row.classList.add('dp-row--week-selected');
            break;
          }
        }
      }
    });
  }

  private selectMonthMode(monthIndex: number): void {
    const year = this.currentMonth.year;
    this.selectedDate = new Date(year, monthIndex, 1);
    this.currentMonth.month = monthIndex;

    this.syncVisibleInput();
    this.updateHiddenInput();

    if (this.isOpen && this.calendarEl) {
      this.renderCurrentMonth();
    }

    this.emitChangeEvent(this.selectedDate);
    this.trackAnalytics('select', {
      mode: 'month',
      value: this.getValue(),
      selectedMonth: monthIndex + 1,
      selectedYear: year,
    });

    if (this.shouldCloseOnSelection()) {
      this.closeCalendar();
    }
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

    this.trackAnalytics('navigate', {
      direction: offset > 0 ? 'next' : 'previous',
      month: this.currentMonth.month + 1,
      year: this.currentMonth.year,
      view: this.currentView,
    });
  }

  private renderCurrentMonth(): void {
    if (!this.calendarEl) return;

    if (this.config.dualMonth && this.config.selectionMode === 'range') {
      // Re-render both panels for dual month
      this.rerenderDualMonth();
      return;
    }

    const monthData = this.generateCurrentMonth();

    // Apply slide animation
    if (this.config.slideAnimation && this.slideDirection) {
      this.applySlideAnimation(monthData);
    } else {
      diffCalendarGrid(this.calendarEl, monthData, this.config);
    }

    this.updateHeaderText();
    this.slideDirection = null;

    // Re-highlight week row if in week mode
    if (this.config.selectionMode === 'week') {
      this.highlightSelectedWeekRow();
    }
  }

  private applySlideAnimation(monthData: CalendarMonth): void {
    if (!this.calendarEl) return;

    const grid = this.calendarEl.querySelector('.dp-grid') as HTMLElement;
    if (!grid) {
      diffCalendarGrid(this.calendarEl, monthData, this.config);
      return;
    }

    const direction = this.slideDirection;

    // Remove previous animation classes
    grid.classList.remove('dp-grid--slide-left', 'dp-grid--slide-right');

    // Update the grid content
    diffCalendarGrid(this.calendarEl, monthData, this.config);

    // Force reflow to restart animation
    void grid.offsetWidth;

    // Apply slide class
    if (direction === 'left') {
      grid.classList.add('dp-grid--slide-left');
    } else if (direction === 'right') {
      grid.classList.add('dp-grid--slide-right');
    }

    // Remove animation class after it finishes
    grid.addEventListener('animationend', () => {
      grid.classList.remove('dp-grid--slide-left', 'dp-grid--slide-right');
    }, { once: true });
  }

  private rerenderDualMonth(): void {
    if (!this.calendarEl) return;

    // Full re-render for dual month since diffing is per-panel
    const monthData = this.generateCurrentMonth();
    const nextMonthData = this.generateNextMonth();

    const newCalendar = renderCalendar(monthData, this.config, nextMonthData);

    // Replace content
    this.calendarEl.innerHTML = newCalendar.innerHTML;

    // Copy attributes
    for (const attr of newCalendar.attributes) {
      this.calendarEl.setAttribute(attr.name, attr.value);
    }

    // Re-append extras that renderCalendar doesn't produce
    this.appendCalendarExtras();

    // Re-setup events
    if (this.events) {
      this.events.destroy();
    }
    this.setupCalendarEvents();
  }

  private generateCurrentMonth(): CalendarMonth {
    const disabledDates = this.config.disabledDates
      .map((s) => parseISO(s))
      .filter((d): d is Date => d !== null);

    // Add recurring disabled dates
    const recurringDisabled = this.getRecurringDisabledDates(
      this.currentMonth.year,
      this.currentMonth.month,
    );
    disabledDates.push(...recurringDisabled);

    const min = this.config.min ? parseISO(this.config.min) : null;
    const max = this.config.max ? parseISO(this.config.max) : null;

    const month = generateMonth(
      this.currentMonth.year,
      this.currentMonth.month,
      {
        weekStart: this.config.weekStart,
        selected: this.selectedDate,
        rangeStart: this.rangeStartDate,
        rangeEnd: this.rangeEndDate,
        min,
        max,
        disabledDates,
      },
    );

    // Apply day data overlays
    this.applyDayData(month);

    // Apply blocked check-in/out markers
    this.applyBlockedDays(month);

    return month;
  }

  private generateNextMonth(): CalendarMonth {
    const [nextYear, nextMonth] = offsetMonth(
      this.currentMonth.year,
      this.currentMonth.month,
      1,
    );

    const disabledDates = this.config.disabledDates
      .map((s) => parseISO(s))
      .filter((d): d is Date => d !== null);

    const recurringDisabled = this.getRecurringDisabledDates(nextYear, nextMonth);
    disabledDates.push(...recurringDisabled);

    const min = this.config.min ? parseISO(this.config.min) : null;
    const max = this.config.max ? parseISO(this.config.max) : null;

    const month = generateMonth(nextYear, nextMonth, {
      weekStart: this.config.weekStart,
      selected: this.selectedDate,
      rangeStart: this.rangeStartDate,
      rangeEnd: this.rangeEndDate,
      min,
      max,
      disabledDates,
    });

    this.applyDayData(month);
    this.applyBlockedDays(month);

    return month;
  }

  // ===========================================================================
  // Day data, disabled rules, blocked days
  // ===========================================================================

  private applyDayData(month: CalendarMonth): void {
    for (const week of month.days) {
      for (const day of week) {
        const isoStr = this.toISOStr(day.date);
        const data = this.dayDataCache.get(isoStr);
        if (data) {
          day.price = data.price ?? null;
          day.available = data.available;
          day.blockedCheckIn = data.blockedCheckIn;
          day.blockedCheckOut = data.blockedCheckOut;
          if (data.available === false) {
            day.isDisabled = true;
          }
        }
      }
    }
  }

  private applyBlockedDays(month: CalendarMonth): void {
    const checkInDays = this.parseBlockedDays(this.config.blockedCheckIn);
    const checkOutDays = this.parseBlockedDays(this.config.blockedCheckOut);

    if (checkInDays.length === 0 && checkOutDays.length === 0) return;

    for (const week of month.days) {
      for (const day of week) {
        const dow = day.date.getDay();
        if (checkInDays.includes(dow)) {
          day.blockedCheckIn = true;
        }
        if (checkOutDays.includes(dow)) {
          day.blockedCheckOut = true;
        }
      }
    }
  }

  private parseBlockedDays(str: string): number[] {
    if (!str) return [];
    return str.split(',').map(Number).filter((n) => !isNaN(n) && n >= 0 && n <= 6);
  }

  private isBlockedCheckIn(date: Date): boolean {
    const checkInDays = this.parseBlockedDays(this.config.blockedCheckIn);
    if (checkInDays.includes(date.getDay())) return true;
    const data = this.dayDataCache.get(this.toISOStr(date));
    return data?.blockedCheckIn === true;
  }

  private isBlockedCheckOut(date: Date): boolean {
    const checkOutDays = this.parseBlockedDays(this.config.blockedCheckOut);
    if (checkOutDays.includes(date.getDay())) return true;
    const data = this.dayDataCache.get(this.toISOStr(date));
    return data?.blockedCheckOut === true;
  }

  private getRecurringDisabledDates(year: number, month: number): Date[] {
    const dates: Date[] = [];
    if (this.disabledRules.length === 0) return dates;

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (const rule of this.disabledRules) {
      if (rule.type === 'weekday' && rule.days) {
        for (let day = 1; day <= daysInMonth; day++) {
          const d = new Date(year, month, day);
          if (rule.days.includes(d.getDay())) {
            dates.push(d);
          }
        }
      } else if (rule.type === 'monthly' && rule.dayOfMonth) {
        if (rule.dayOfMonth <= daysInMonth) {
          dates.push(new Date(year, month, rule.dayOfMonth));
        }
      } else if (rule.type === 'yearly' && rule.month && rule.day) {
        if (month === rule.month - 1 && rule.day <= daysInMonth) {
          dates.push(new Date(year, month, rule.day));
        }
      }
    }

    return dates;
  }

  private calculateNights(start: Date, end: Date): number {
    const s = toDateOnly(start).getTime();
    const e = toDateOnly(end).getTime();
    return Math.round((e - s) / (1000 * 60 * 60 * 24));
  }

  private toISOStr(date: Date): string {
    const y = String(date.getFullYear()).padStart(4, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ===========================================================================
  // Presets
  // ===========================================================================

  private applyPreset(key: string): void {
    const today = toDateOnly(new Date());
    let start: Date | null = null;
    let end: Date | null = null;

    switch (key) {
      case 'tonight':
        start = today;
        end = addDays(today, 1);
        break;
      case 'this-weekend': {
        const dayOfWeek = today.getDay();
        const daysToFriday = (5 - dayOfWeek + 7) % 7;
        start = addDays(today, daysToFriday === 0 && dayOfWeek === 5 ? 0 : daysToFriday);
        end = addDays(start, 2);
        break;
      }
      case 'next-7':
        start = today;
        end = addDays(today, 7);
        break;
      case 'next-30':
        start = today;
        end = addDays(today, 30);
        break;
    }

    if (start && end) {
      this.setRange(start, end);
      this.trackAnalytics('preset', { preset: key });

      if (this.shouldCloseOnSelection()) {
        this.closeCalendar();
      }
    }
  }

  // ===========================================================================
  // Async day data fetching
  // ===========================================================================

  private async fetchDayData(): Promise<void> {
    if (!this.config.dayDataUrl) return;

    const year = this.currentMonth.year;
    const month = this.currentMonth.month + 1;
    const url = this.config.dayDataUrl
      .replace('{year}', String(year))
      .replace('{month}', String(month));

    try {
      const response = await fetch(url);
      if (response.ok) {
        const data: DayData[] = await response.json();
        this.setDayData(data);
      }
    } catch {
      // Non-blocking
    }
  }

  // ===========================================================================
  // Validation
  // ===========================================================================

  private validate(): ValidationResult {
    const min = this.config.min ? parseISO(this.config.min) : null;
    const max = this.config.max ? parseISO(this.config.max) : null;

    if (this.config.selectionMode === 'range' || this.config.selectionMode === 'week') {
      if (!this.rangeStartDate && !this.rangeEndDate) {
        return this.config.required
          ? { valid: false, message: 'Please select a date range' }
          : { valid: true };
      }

      if (!this.rangeStartDate || !this.rangeEndDate) {
        return { valid: true };
      }

      if (compareDays(this.rangeEndDate, this.rangeStartDate) < 0) {
        return { valid: false, message: 'End date must be after start date' };
      }

      // Min/max nights validation
      if (this.config.selectionMode === 'range') {
        const nights = this.calculateNights(this.rangeStartDate, this.rangeEndDate);
        if (this.config.minNights > 0 && nights < this.config.minNights) {
          return { valid: false, message: `Minimum ${this.config.minNights} nights required` };
        }
        if (this.config.maxNights > 0 && nights > this.config.maxNights) {
          return { valid: false, message: `Maximum ${this.config.maxNights} nights allowed` };
        }
      }

      const startText = this.formatDisplayDate(this.rangeStartDate);
      const endText = this.formatDisplayDate(this.rangeEndDate);
      const startResult = validateDate(startText, this.rangeStartDate, {
        required: true,
        min,
        max,
        rules: this.config.validate,
      });
      if (!startResult.valid) return startResult;

      return validateDate(endText, this.rangeEndDate, {
        required: true,
        min,
        max,
        rules: this.config.validate,
      });
    }

    const displayValue = this.inputEl.value;
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
      !this.calendarEl.contains(target) &&
      (!this.portalContainer || !this.portalContainer.contains(target))
    ) {
      this.closeCalendar();
    }
  }

  private onInputChange(): void {
    if (this.destroyed) return;

    if (this.segmentedInput) {
      const date = this.segmentedInput.getValue() ?? null;

      if (date) {
        // Validate against disabled dates on manual input
        if (this.isDateDisabled(date)) {
          this.errorDisplay?.show('This date is not available');
          this.selectedDate = null;
          this.updateHiddenInput();
          return;
        }
        this.selectedDate = toDateOnly(date);
        this.currentMonth = {
          year: date.getFullYear(),
          month: date.getMonth(),
        };
        this.updateHiddenInput();
      } else {
        this.selectedDate = null;
        this.updateHiddenInput();
      }
    } else {
      this.applyNativeInputValue();
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

    if (this.config.selectionMode === 'range' || this.config.selectionMode === 'week') {
      if (this.rangeStartDate && this.rangeEndDate) {
        this.hiddenInput.value = [
          formatForValue(this.rangeStartDate, this.config.valueType),
          formatForValue(this.rangeEndDate, this.config.valueType),
        ].join(',');
      } else if (this.rangeStartDate) {
        this.hiddenInput.value = formatForValue(
          this.rangeStartDate,
          this.config.valueType,
        );
      } else {
        this.hiddenInput.value = '';
      }
    } else if (this.config.selectionMode === 'month') {
      if (this.selectedDate) {
        this.hiddenInput.value = `${this.selectedDate.getFullYear()}-${String(this.selectedDate.getMonth() + 1).padStart(2, '0')}`;
      } else {
        this.hiddenInput.value = '';
      }
    } else if (this.selectedDate) {
      this.hiddenInput.value = formatForValue(
        this.selectedDate,
        this.config.valueType,
      );
    } else {
      this.hiddenInput.value = '';
    }

    this.hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  private usesSegmentedInput(): boolean {
    return this.config.selectionMode === 'single' && this.config.inputMode === 'segmented';
  }

  private usesNaturalInput(): boolean {
    return this.config.selectionMode === 'single' &&
      this.config.inputMode === 'native' &&
      supportsNaturalInputFormat(this.config.format);
  }

  private shouldCloseOnSelection(): boolean {
    if (!this.config.closeOnSelect) return false;
    if (this.config.calendarMode === 'inline') return false;
    if (this.config.selectionMode === 'range') {
      return Boolean(this.rangeStartDate && this.rangeEndDate);
    }
    return true;
  }

  private resolveDateLike(value: Date | string | null): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    return this.parseManualDate(value);
  }

  private parseManualDate(value: string): Date | null {
    return parseISO(value) ?? parseDate(value, this.config.format);
  }

  private parseRangeInput(value: string): DateRangeValue | null {
    if (!value.trim()) {
      return { start: null, end: null };
    }

    const parts = value
      .split(this.config.rangeSeparator)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      return { start: null, end: null };
    }

    if (parts.length === 1) {
      const start = this.parseManualDate(parts[0]);
      return start ? { start, end: null } : null;
    }

    const start = this.parseManualDate(parts[0]);
    const end = this.parseManualDate(parts[1]);
    if (!start || !end) return null;
    return { start, end };
  }

  private formatDisplayDate(date: Date): string {
    return formatDate(date, this.config.format, this.config.locale);
  }

  private syncVisibleInput(): void {
    if (this.segmentedInput && this.config.selectionMode === 'single') {
      this.segmentedInput.setValue(this.selectedDate);
      return;
    }

    if (this.naturalInput && this.config.selectionMode === 'single') {
      this.naturalInput.setDate(this.selectedDate);
      return;
    }

    if (this.config.selectionMode === 'range' || this.config.selectionMode === 'week') {
      if (!this.rangeStartDate) {
        this.inputEl.value = '';
        return;
      }

      const start = this.formatDisplayDate(this.rangeStartDate);
      if (!this.rangeEndDate) {
        this.inputEl.value = start;
        return;
      }

      const end = this.formatDisplayDate(this.rangeEndDate);
      this.inputEl.value = `${start}${this.config.rangeSeparator}${end}`;
      return;
    }

    if (this.config.selectionMode === 'month' && this.selectedDate) {
      const monthNames = getMonthNames(this.config.locale, 'long');
      this.inputEl.value = `${monthNames[this.selectedDate.getMonth()]} ${this.selectedDate.getFullYear()}`;
      return;
    }

    this.inputEl.value = this.selectedDate ? this.formatDisplayDate(this.selectedDate) : '';
  }

  private applyNativeInputValue(): void {
    const raw = this.inputEl.value.trim();

    if (!raw) {
      this.selectedDate = null;
      this.rangeStartDate = null;
      this.rangeEndDate = null;
      this.updateHiddenInput();
      return;
    }

    if (this.config.selectionMode === 'range') {
      const parsedRange = this.parseRangeInput(raw);
      if (parsedRange) {
        this.rangeStartDate = parsedRange.start ? toDateOnly(parsedRange.start) : null;
        this.rangeEndDate = parsedRange.end ? toDateOnly(parsedRange.end) : null;
        const visibleDate = this.rangeEndDate ?? this.rangeStartDate;
        if (visibleDate) {
          this.currentMonth = {
            year: visibleDate.getFullYear(),
            month: visibleDate.getMonth(),
          };
          this.yearRangeStart = getYearRangeStart(visibleDate.getFullYear());
        }
      } else {
        this.rangeStartDate = null;
        this.rangeEndDate = null;
      }
      this.updateHiddenInput();
      this.trackAnalytics('manual_input', {
        mode: 'range',
        value: this.getValue(),
      });
      return;
    }

    const parsed = this.parseManualDate(raw);
    if (parsed) {
      // Validate against disabled dates on manual input
      if (this.isDateDisabled(parsed)) {
        this.errorDisplay?.show('This date is not available');
        this.selectedDate = null;
        this.updateHiddenInput();
        return;
      }
      const normalized = toDateOnly(parsed);
      this.selectedDate = normalized;
      this.currentMonth = {
        year: normalized.getFullYear(),
        month: normalized.getMonth(),
      };
      this.yearRangeStart = getYearRangeStart(normalized.getFullYear());
    } else {
      this.selectedDate = null;
    }

    this.updateHiddenInput();
    this.trackAnalytics('manual_input', {
      mode: 'single',
      value: this.getValue(),
    });
  }

  private emitChangeEvent(date: Date | null): void {
    this.inputEl.dispatchEvent(
      new CustomEvent('datepicker:change', {
        bubbles: true,
        detail: {
          date,
          range: this.getRange(),
          mode: this.config.selectionMode,
          value: this.getValue(),
          ...(this.config.timePicker ? { time: this.getTime() } : {}),
        },
      }),
    );
  }

  private trackAnalytics(
    action: string,
    detail: Record<string, unknown> = {},
  ): void {
    if (this.config.analytics === 'off') return;

    const payload = {
      action,
      mode: this.config.selectionMode,
      inputMode: this.config.inputMode,
      calendar: this.config.calendar,
      pickerName: this.config.name || this.inputEl.id || null,
      value: this.getValue(),
      range: this.getRange(),
      month: this.currentMonth.month + 1,
      year: this.currentMonth.year,
      ...detail,
    };

    this.inputEl.dispatchEvent(
      new CustomEvent('datepicker:analytics', {
        bubbles: true,
        detail: payload,
      }),
    );

    if (this.config.analytics === 'datalayer') {
      const win = window as Window & {
        dataLayer?: Array<Record<string, unknown>>;
      };
      if (Array.isArray(win.dataLayer)) {
        win.dataLayer.push({
          event: 'datepicker',
          ...payload,
        });
      }
    }
  }

  /** Appends custom header + footer (clear/today) to the calendar element */
  private appendCalendarExtras(): void {
    if (!this.calendarEl) return;

    // Remove existing extras to avoid duplication
    this.calendarEl.querySelector('.dp-custom-header')?.remove();
    this.calendarEl.querySelector('.dp-footer')?.remove();

    // Add custom header if configured
    if (this.config.customHeader) {
      const customHeaderEl = document.createElement('div');
      customHeaderEl.className = 'dp-custom-header';
      customHeaderEl.innerHTML = this.config.customHeader;
      this.calendarEl.insertBefore(customHeaderEl, this.calendarEl.firstChild);
    }

    // Add clear/today button footer
    if (this.config.showClear || this.config.showToday) {
      const footer = document.createElement('div');
      footer.className = 'dp-footer';

      if (this.config.showClear) {
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'dp-clear-btn';
        clearBtn.textContent = 'Clear';
        clearBtn.setAttribute('aria-label', 'Clear selection');
        clearBtn.setAttribute('data-action', 'clear');
        footer.appendChild(clearBtn);
      }

      if (this.config.showToday && this.config.selectionMode !== 'month') {
        const todayBtn = document.createElement('button');
        todayBtn.type = 'button';
        todayBtn.className = 'dp-today-btn';
        todayBtn.textContent = 'Today';
        todayBtn.setAttribute('aria-label', 'Go to today');
        todayBtn.setAttribute('data-action', 'today');
        footer.appendChild(todayBtn);
      }

      this.calendarEl.appendChild(footer);
    }
  }

  /** Check if a date falls on a disabled date (static or recurring) */
  private isDateDisabled(date: Date): boolean {
    const normalized = toDateOnly(date);
    const isoStr = this.toISOStr(normalized);

    // Check static disabled dates
    if (this.config.disabledDates.includes(isoStr)) {
      return true;
    }

    // Check min/max bounds
    if (this.config.min) {
      const min = parseISO(this.config.min);
      if (min && compareDays(normalized, min) < 0) return true;
    }
    if (this.config.max) {
      const max = parseISO(this.config.max);
      if (max && compareDays(normalized, max) > 0) return true;
    }

    // Check recurring disabled rules
    for (const rule of this.disabledRules) {
      if (rule.type === 'weekday' && rule.days && rule.days.includes(normalized.getDay())) {
        return true;
      }
      if (rule.type === 'monthly' && rule.dayOfMonth === normalized.getDate()) {
        return true;
      }
      if (rule.type === 'yearly' && rule.month === normalized.getMonth() + 1 && rule.day === normalized.getDate()) {
        return true;
      }
    }

    // Check day data cache
    const data = this.dayDataCache.get(isoStr);
    if (data?.available === false) return true;

    return false;
  }

  /** Clear the current selection */
  private clearSelection(): void {
    this.selectedDate = null;
    this.rangeStartDate = null;
    this.rangeEndDate = null;

    this.segmentedInput?.setValue(null);
    this.naturalInput?.setDate(null);
    this.updateSplitFieldsFromDate(null);
    this.syncVisibleInput();
    this.updateHiddenInput();
    this.errorDisplay?.hide();

    if (this.isOpen && this.calendarEl) {
      this.renderCurrentMonth();
    }

    this.emitChangeEvent(null);
    this.trackAnalytics('clear');

    // Close the calendar after clearing (unless inline)
    if (this.config.calendarMode !== 'inline') {
      this.closeCalendar();
    }
  }

  /** Navigate to today's date and select it */
  private goToToday(): void {
    const now = toDateOnly(new Date());
    this.currentMonth = { year: now.getFullYear(), month: now.getMonth() };
    this.yearRangeStart = getYearRangeStart(now.getFullYear());

    if (!this.isDateDisabled(now)) {
      // selectDate handles single/range/week/month dispatch
      this.selectDate(now);
    }

    if (this.isOpen && this.calendarEl) {
      this.renderCurrentMonth();
      this.updateHeaderText();
    }

    this.trackAnalytics('today');
  }

  /** Position the portal container relative to the input */
  private positionPortal(): void {
    if (!this.portalContainer) return;

    const rect = this.inputEl.getBoundingClientRect();
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    const scrollY = window.scrollY || document.documentElement.scrollTop;

    this.portalContainer.style.top = `${rect.bottom + scrollY + 4}px`;
    this.portalContainer.style.left = `${rect.left + scrollX}px`;

    // After rendering, check if it overflows the viewport and flip if needed
    requestAnimationFrame(() => {
      if (!this.portalContainer) return;
      const portalRect = this.portalContainer.getBoundingClientRect();
      if (portalRect.bottom > window.innerHeight) {
        this.portalContainer.style.top = `${rect.top + scrollY - portalRect.height - 4}px`;
      }
      // Clamp horizontal
      if (portalRect.right > window.innerWidth) {
        this.portalContainer.style.left = `${window.innerWidth - portalRect.width - 8 + scrollX}px`;
      }
    });
  }

  private setupTouchSupport(): void {
    if (!this.calendarEl) return;
    this.calendarEl.addEventListener('touchstart', this.boundTouchStart, {
      passive: true,
    });
    this.calendarEl.addEventListener('touchend', this.boundTouchEnd, {
      passive: true,
    });
  }

  private teardownTouchSupport(): void {
    if (!this.calendarEl) return;
    this.calendarEl.removeEventListener('touchstart', this.boundTouchStart);
    this.calendarEl.removeEventListener('touchend', this.boundTouchEnd);
  }

  private onTouchStart(e: TouchEvent): void {
    const touch = e.changedTouches[0];
    if (!touch) return;
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  }

  private onTouchEnd(e: TouchEvent): void {
    if (this.currentView !== 'days') return;

    const touch = e.changedTouches[0];
    if (!touch || this.touchStartX === null || this.touchStartY === null) {
      return;
    }

    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    this.touchStartX = null;
    this.touchStartY = null;

    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) {
      return;
    }

    if (deltaX < 0) {
      this.slideDirection = 'left';
      this.navigateMonth(1);
      this.trackAnalytics('swipe', { direction: 'left' });
    } else {
      this.slideDirection = 'right';
      this.navigateMonth(-1);
      this.trackAnalytics('swipe', { direction: 'right' });
    }
  }
}
