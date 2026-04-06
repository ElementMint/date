// ============================================================================
// angular.ts - Angular adapter for DatePicker
// ============================================================================

import { DatePicker } from '../datepicker';

/** Angular-specific API subset needed by this adapter. */
export interface AngularApi {
  Component: any;
  Input: any;
  Output: any;
  EventEmitter: any;
  ElementRef?: any;
  OnInit?: any;
  OnDestroy?: any;
  OnChanges?: any;
  SimpleChanges?: any;
}

/** Shape of the change event emitted by the Angular component. */
export interface DatePickerChangeEvent {
  value: string;
  date: Date | null;
}

/** Attribute-prop mapping for data attributes. */
const DATA_ATTR_MAP: Record<string, string> = {
  format: 'data-format',
  formatDisplay: 'data-format-display',
  min: 'data-min',
  max: 'data-max',
  locale: 'data-locale',
  theme: 'data-theme',
  weekStart: 'data-week-start',
};

/**
 * Factory function that creates an Angular DatePicker component class.
 *
 * Since Angular decorators require the Angular compiler, this factory returns
 * an undecorated class. You must apply the `@Component` decorator yourself
 * (or use the helper metadata object returned alongside the class).
 *
 * @example
 * ```ts
 * // In your Angular module:
 * import { Component, Input, Output, EventEmitter } from '@angular/core';
 * import { createAngularDatePicker } from '@aspect/date/adapters/angular';
 *
 * const { componentClass, metadata } = createAngularDatePicker({
 *   Component, Input, Output, EventEmitter,
 * });
 *
 * // Option A: Apply decorator manually
 * const DatePickerComponent = Component(metadata)(componentClass);
 *
 * // Option B: Use as a base class
 * @Component({
 *   selector: 'app-datepicker',
 *   template: `<input #inputEl type="text" data-datepicker />`,
 * })
 * export class DatePickerComponent extends componentClass {
 *   // Inherits all inputs, outputs, and lifecycle hooks
 * }
 * ```
 *
 * @example
 * ```html
 * <!-- Template usage -->
 * <app-datepicker
 *   [value]="dateValue"
 *   [format]="'DD/MM/YYYY'"
 *   [min]="'2024-01-01'"
 *   [theme]="'dark'"
 *   (dateChange)="onDateChange($event)"
 *   (dateModelChange)="dateValue = $event"
 * ></app-datepicker>
 * ```
 */
export function createAngularDatePicker(ng: AngularApi) {
  const { EventEmitter } = ng;

  /**
   * Angular DatePicker component class.
   *
   * Inputs:
   * - `value` (string) - Current date value in ISO format.
   * - `format` (string) - Date format string, e.g. "DD/MM/YYYY".
   * - `formatDisplay` (string) - Display format if different from value format.
   * - `min` (string) - Minimum selectable date (ISO string).
   * - `max` (string) - Maximum selectable date (ISO string).
   * - `locale` (string) - Locale for month/day names.
   * - `theme` ('light' | 'dark' | 'system') - Visual theme.
   * - `weekStart` (number) - First day of the week (0=Sun, 1=Mon).
   * - `disabled` (boolean) - Whether the picker is disabled.
   * - `required` (boolean) - Whether a value is required.
   * - `placeholder` (string) - Placeholder text.
   *
   * Outputs:
   * - `dateChange` - Emits { value: string, date: Date | null } on selection.
   * - `dateModelChange` - Emits the ISO string value for two-way binding.
   */
  class DatePickerComponent {
    // --- Inputs ---

    /** Current value in ISO format. */
    value: string | undefined;

    /** Date format string, e.g. "DD/MM/YYYY". */
    format: string | undefined;

    /** Display format (if different from value format). */
    formatDisplay: string | undefined;

    /** Minimum selectable date (ISO string). */
    min: string | undefined;

    /** Maximum selectable date (ISO string). */
    max: string | undefined;

    /** Locale for month/day names. */
    locale: string | undefined;

    /** Visual theme. */
    theme: 'light' | 'dark' | 'system' | undefined;

    /** First day of the week (0=Sun, 1=Mon, etc.). */
    weekStart: number | undefined;

    /** Whether the picker is disabled. */
    disabled: boolean | undefined;

    /** Whether a value is required. */
    required: boolean | undefined;

    /** Placeholder text. */
    placeholder: string | undefined;

    // --- Outputs ---

    /** Emits on date selection with value and Date object. */
    dateChange = new EventEmitter();

    /** Emits the ISO string value for two-way binding. */
    dateModelChange = new EventEmitter();

    // --- Internal (prefixed with _ to indicate non-public) ---

    /** @internal */
    _pickerInstance: DatePicker | null = null;
    /** @internal */
    _inputElement: HTMLInputElement | null = null;
    /** @internal */
    _elementRef: any;
    /** @internal */
    _changeHandler: ((e: Event) => void) | null = null;

    constructor(elementRef: any) {
      this._elementRef = elementRef;
    }

    /** Called by Angular after input properties are set for the first time. */
    ngOnInit(): void {
      const hostEl: HTMLElement = this._elementRef.nativeElement;
      const input = hostEl.querySelector<HTMLInputElement>('input');
      if (!input) return;

      this._inputElement = input;

      // Apply data attributes before constructing
      this._syncDataAttributes();

      // Apply static attributes
      if (this.disabled) {
        input.setAttribute('disabled', '');
      }
      if (this.required) {
        input.setAttribute('required', '');
      }
      if (this.placeholder) {
        input.setAttribute('placeholder', this.placeholder);
      }

      this._pickerInstance = new DatePicker(input);

      // Set initial value
      if (this.value) {
        this._pickerInstance.setValue(this.value);
      }

      // Listen for changes
      this._changeHandler = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        const value: string = detail?.value ?? '';
        const date: Date | null = detail?.date ?? null;

        this.dateChange.emit({ value, date });
        this.dateModelChange.emit(value);
      };

      input.addEventListener('datepicker:change', this._changeHandler);
    }

    /** Called by Angular when any data-bound input property changes. */
    ngOnChanges(changes: any): void {
      if (!this._pickerInstance || !this._inputElement) return;

      // Sync value
      if (changes.value && !changes.value.firstChange) {
        const newVal = changes.value.currentValue;
        if (newVal != null) {
          const current = this._pickerInstance.getValue();
          if (current !== newVal) {
            this._pickerInstance.setValue(newVal);
          }
        }
      }

      // Sync data attributes for config props
      const configKeys = ['format', 'formatDisplay', 'min', 'max', 'locale', 'theme', 'weekStart'];
      const hasConfigChange = configKeys.some((k) => changes[k] && !changes[k].firstChange);
      if (hasConfigChange) {
        this._syncDataAttributes();
      }
    }

    /** Called by Angular when the component is destroyed. */
    ngOnDestroy(): void {
      if (this._inputElement && this._changeHandler) {
        this._inputElement.removeEventListener('datepicker:change', this._changeHandler);
      }
      this._pickerInstance?.destroy();
      this._pickerInstance = null;
      this._inputElement = null;
      this._changeHandler = null;
    }

    /** @internal Apply current input values as data-* attributes on the input element. */
    _syncDataAttributes(): void {
      const el = this._inputElement;
      if (!el) return;

      const values: Record<string, any> = {
        format: this.format,
        formatDisplay: this.formatDisplay,
        min: this.min,
        max: this.max,
        locale: this.locale,
        theme: this.theme,
        weekStart: this.weekStart,
      };

      for (const [prop, attr] of Object.entries(DATA_ATTR_MAP)) {
        const val = values[prop];
        if (val != null) {
          el.setAttribute(attr, String(val));
        } else {
          el.removeAttribute(attr);
        }
      }
    }
  }

  /** Component metadata suitable for passing to @Component(). */
  const metadata = {
    selector: 'dp-datepicker',
    template: '<input #inputEl type="text" data-datepicker />',
    styles: [':host { display: inline-block; }'],
  };

  return {
    /** The undecorated component class. Apply @Component(metadata) to use. */
    componentClass: DatePickerComponent,
    /** Default Angular component metadata. Override as needed. */
    metadata,
  };
}
