// ============================================================================
// wrapper/web-component.ts - Custom Element wrapper for DatePicker
// ============================================================================

import { DatePicker } from '../datepicker';

/**
 * All data-* attribute names that the DatePicker recognizes.
 * These are observed so that runtime attribute changes are reflected
 * into the picker configuration.
 */
const OBSERVED_ATTRS = [
  'data-format',
  'data-min',
  'data-max',
  'data-value-type',
  'data-locale',
  'data-week-start',
  'data-theme',
  'data-placeholder',
  'data-required',
  'data-disabled-dates',
  'data-validate',
  'data-disabled',
  'data-read-only',
  'data-name',
  'data-value',
  'data-close-on-select',
  'data-show-today',
  'data-show-clear',
  'data-keyboard',
  'data-class-name',
  'data-position',
  'data-validate-url',
  'data-datepicker',
];

/**
 * `<date-picker>` custom element.
 *
 * Wraps the DatePicker class in a Web Component. An `<input>` element
 * is automatically created inside the shadow-free light DOM. All
 * configuration is driven by attributes on the host element.
 *
 * @example
 * ```html
 * <date-picker data-format="DD/MM/YYYY" data-required></date-picker>
 * ```
 */
export class DatePickerElement extends HTMLElement {
  /** The DatePicker instance, created in connectedCallback. */
  private picker: DatePicker | null = null;

  /** The input element created for this component. */
  inputEl: HTMLInputElement | null = null;

  static get observedAttributes(): string[] {
    return OBSERVED_ATTRS;
  }

  /**
   * Called when the element is inserted into the DOM.
   * Creates an internal <input>, copies relevant attributes, and
   * instantiates the DatePicker.
   */
  connectedCallback(): void {
    // Avoid double init (e.g., moved in DOM)
    if (this.picker) return;

    // Create an input if one doesn't already exist
    let input = this.querySelector<HTMLInputElement>('input');
    if (!input) {
      input = document.createElement('input');
      input.type = 'text';
      this.appendChild(input);
    }
    this.inputEl = input;

    // Ensure the host has the data-datepicker attribute so parseConfig works
    if (!this.hasAttribute('data-datepicker')) {
      this.setAttribute('data-datepicker', '');
    }

    // Create the DatePicker, passing `this` so it reads config from the host
    this.picker = new DatePicker(this);
  }

  /**
   * Called when the element is removed from the DOM. Destroys the picker.
   */
  disconnectedCallback(): void {
    if (this.picker) {
      this.picker.destroy();
      this.picker = null;
    }
    this.inputEl = null;
  }

  /**
   * Called when an observed attribute changes. Destroys and re-creates
   * the picker so the new configuration takes effect.
   *
   * A full re-init is the safest approach because many config options
   * affect the segmented input structure, event bindings, etc.
   */
  attributeChangedCallback(
    _name: string,
    oldValue: string | null,
    newValue: string | null,
  ): void {
    // Only reinit if the value actually changed and the picker exists
    if (oldValue === newValue) return;
    if (!this.picker) return;

    // Preserve current selection
    const currentDate = this.picker.getDate();

    // Destroy and re-create
    this.picker.destroy();
    this.picker = null;
    this.inputEl = null;

    // Remove leftover DOM created by the previous picker
    // (the wrapper and hidden inputs)
    this.innerHTML = '';

    // Re-create input
    const input = document.createElement('input');
    input.type = 'text';
    this.appendChild(input);
    this.inputEl = input;

    this.picker = new DatePicker(this);

    // Restore selection if there was one
    if (currentDate) {
      this.picker.setDate(currentDate);
    }
  }

  // =========================================================================
  // Convenience property accessors (mirror the DatePicker API)
  // =========================================================================

  /** Opens the calendar popup. */
  open(): void {
    this.picker?.open();
  }

  /** Closes the calendar popup. */
  close(): void {
    this.picker?.close();
  }

  /** Returns the formatted value string, or null. */
  getValue(): string | null {
    return this.picker?.getValue() ?? null;
  }

  /** Sets the value from a Date or string. */
  setValue(date: Date | string): void {
    this.picker?.setValue(date);
  }

  /** Returns the currently selected Date, or null. */
  getDate(): Date | null {
    return this.picker?.getDate() ?? null;
  }

  /** Sets the date from a Date object. */
  setDate(date: Date): void {
    this.picker?.setDate(date);
  }
}

/**
 * Registers the `<date-picker>` custom element if it hasn't been defined yet.
 * Safe to call multiple times.
 */
export function defineElement(): void {
  if (
    typeof customElements !== 'undefined' &&
    !customElements.get('date-picker')
  ) {
    customElements.define('date-picker', DatePickerElement);
  }
}
