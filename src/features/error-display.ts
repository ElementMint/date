// ============================================================================
// error-display.ts - Error message rendering and management
// ============================================================================

/**
 * Custom error message attribute names read from the input element.
 *
 * - `data-error-required` - message for required validation failure
 * - `data-error-min`      - message for min date violation
 * - `data-error-max`      - message for max date violation
 * - `data-error-custom`   - message for custom rule failure
 */
type ErrorAttribute =
  | 'data-error-required'
  | 'data-error-min'
  | 'data-error-max'
  | 'data-error-custom';

/**
 * Manages the display of validation error messages for a date picker input.
 *
 * Looks for an existing `[data-error-for="<inputId>"]` element in the DOM.
 * If none is found, one is created and inserted immediately after the input.
 *
 * The class:
 * - Adds/removes `.dp-error` on the input
 * - Sets `aria-invalid` and `aria-describedby` for accessibility
 * - Reads custom error messages from data attributes on the input
 */
export class ErrorDisplay {
  private inputEl: HTMLElement;
  private errorEl: HTMLElement;
  private inputId: string;
  private createdErrorEl: boolean = false;

  /**
   * @param inputEl - The date picker input element (or its wrapper)
   */
  constructor(inputEl: HTMLElement) {
    this.inputEl = inputEl;

    // Ensure the input has an id for aria-describedby linkage
    this.inputId = inputEl.id || this.generateId();
    if (!inputEl.id) {
      inputEl.id = this.inputId;
    }

    // Look for an existing error element
    const errorId = `${this.inputId}-error`;
    const existing = document.querySelector<HTMLElement>(
      `[data-error-for="${this.inputId}"]`,
    );

    if (existing) {
      this.errorEl = existing;
      if (!this.errorEl.id) {
        this.errorEl.id = errorId;
      }
    } else {
      // Create the error element and insert it after the input
      this.errorEl = document.createElement('div');
      this.errorEl.id = errorId;
      this.errorEl.className = 'dp-error-message';
      this.errorEl.setAttribute('data-error-for', this.inputId);
      this.errorEl.setAttribute('role', 'alert');
      this.errorEl.setAttribute('aria-live', 'polite');
      this.errorEl.style.display = 'none';

      // Insert after the input element
      const parent = inputEl.parentNode;
      if (parent) {
        const next = inputEl.nextSibling;
        if (next) {
          parent.insertBefore(this.errorEl, next);
        } else {
          parent.appendChild(this.errorEl);
        }
      }

      this.createdErrorEl = true;
    }
  }

  /**
   * Shows an error message.
   *
   * - Sets the error text content
   * - Adds `.dp-error` class to the input
   * - Sets `aria-invalid="true"` on the input
   * - Links the error element via `aria-describedby`
   *
   * @param message - The error message to display
   */
  show(message: string): void {
    this.errorEl.textContent = message;
    this.errorEl.style.display = '';

    this.inputEl.classList.add('dp-error');
    this.inputEl.setAttribute('aria-invalid', 'true');
    this.inputEl.setAttribute('aria-describedby', this.errorEl.id);
  }

  /**
   * Hides the error message and resets the input's error state.
   */
  hide(): void {
    this.errorEl.textContent = '';
    this.errorEl.style.display = 'none';

    this.inputEl.classList.remove('dp-error');
    this.inputEl.removeAttribute('aria-invalid');
    this.inputEl.removeAttribute('aria-describedby');
  }

  /**
   * Returns the custom error message for a given error type, if one is
   * defined via a data attribute on the input element.
   *
   * @param type - One of 'required', 'min', 'max', 'custom'
   * @returns The custom message, or null if not set
   */
  getCustomMessage(type: 'required' | 'min' | 'max' | 'custom'): string | null {
    const attrMap: Record<string, ErrorAttribute> = {
      required: 'data-error-required',
      min: 'data-error-min',
      max: 'data-error-max',
      custom: 'data-error-custom',
    };

    const attr = attrMap[type];
    if (!attr) return null;

    return this.inputEl.getAttribute(attr) || null;
  }

  /**
   * Shows a validation error, using a custom message from data attributes
   * if available, otherwise falling back to the provided default.
   *
   * @param type           - Error category for custom message lookup
   * @param defaultMessage - Fallback message if no custom one is set
   */
  showForType(
    type: 'required' | 'min' | 'max' | 'custom',
    defaultMessage: string,
  ): void {
    const custom = this.getCustomMessage(type);
    this.show(custom ?? defaultMessage);
  }

  /**
   * Removes the error element from the DOM (if it was created by this
   * class) and resets the input's error state.
   */
  destroy(): void {
    this.hide();

    if (this.createdErrorEl && this.errorEl.parentNode) {
      this.errorEl.parentNode.removeChild(this.errorEl);
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Generates a unique-ish ID for inputs that don't have one.
   */
  private generateId(): string {
    const random = Math.random().toString(36).substring(2, 8);
    return `dp-input-${random}`;
  }
}
