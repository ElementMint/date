// ============================================================================
// accessibility.ts - ARIA attributes, live regions, and focus trap
// ============================================================================

/**
 * Manages accessibility concerns for the date picker calendar:
 * - Live region for screen reader announcements
 * - Proper ARIA roles on grid elements
 * - Focus trapping within the open calendar
 */
export class A11yManager {
  private liveRegion: HTMLElement | null = null;
  private calendarEl: HTMLElement | null = null;
  private trapHandler: ((e: KeyboardEvent) => void) | null = null;
  private previouslyFocused: HTMLElement | null = null;

  /**
   * Creates and appends an aria-live region to the document body.
   * The region is visually hidden but announced by screen readers.
   */
  constructor() {
    this.liveRegion = document.createElement('div');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    this.liveRegion.setAttribute('role', 'status');
    this.liveRegion.className = 'dp-sr-only';

    // Visually hidden but accessible to screen readers
    Object.assign(this.liveRegion.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: '0',
    });

    document.body.appendChild(this.liveRegion);
  }

  /**
   * Pushes a message into the live region for screen reader announcement.
   *
   * @param message - Plain text to announce
   */
  announce(message: string): void {
    if (!this.liveRegion) return;

    // Clear first so repeated identical messages are still announced
    this.liveRegion.textContent = '';

    // Use a microtask so the DOM mutation is observed as a change
    requestAnimationFrame(() => {
      if (this.liveRegion) {
        this.liveRegion.textContent = message;
      }
    });
  }

  /**
   * Announces a month/year navigation change.
   *
   * @param monthName - Localized month name (e.g. "January")
   * @param year      - Full year number
   */
  announceMonthChange(monthName: string, year: number): void {
    this.announce(`${monthName} ${year}`);
  }

  /**
   * Announces that a date has been selected.
   *
   * @param dateStr - Human-readable date string
   */
  announceSelection(dateStr: string): void {
    this.announce(`Selected: ${dateStr}`);
  }

  /**
   * Applies the correct ARIA roles and attributes to a calendar element
   * and its children, supplementing what the renderer already sets.
   *
   * @param el - The root .dp-calendar element
   */
  setCalendarRole(el: HTMLElement): void {
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');

    const grid = el.querySelector('.dp-grid');
    if (grid) {
      grid.setAttribute('role', 'grid');
    }

    const rows = el.querySelectorAll('.dp-row');
    rows.forEach((row) => {
      row.setAttribute('role', 'row');
    });

    const cells = el.querySelectorAll('.dp-day');
    cells.forEach((cell) => {
      cell.setAttribute('role', 'gridcell');
    });

    const weekdays = el.querySelector('.dp-weekdays');
    if (weekdays) {
      weekdays.setAttribute('role', 'row');
      const headers = weekdays.querySelectorAll('.dp-weekday');
      headers.forEach((header) => {
        header.setAttribute('role', 'columnheader');
      });
    }
  }

  /**
   * Enables a focus trap within the given calendar element.
   * Tab and Shift+Tab cycle through focusable elements inside the
   * calendar instead of leaving it.
   *
   * Stores a reference to the previously focused element so focus can
   * be restored when the trap is released.
   *
   * @param el - The calendar container to trap focus within
   */
  enableFocusTrap(el: HTMLElement): void {
    this.calendarEl = el;
    this.previouslyFocused = document.activeElement as HTMLElement | null;

    this.trapHandler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = this.getFocusableElements(el);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: if on the first element, wrap to the last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if on the last element, wrap to the first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    el.addEventListener('keydown', this.trapHandler);
  }

  /**
   * Disables the focus trap and restores focus to the element that was
   * focused before the trap was enabled.
   */
  disableFocusTrap(): void {
    if (this.calendarEl && this.trapHandler) {
      this.calendarEl.removeEventListener('keydown', this.trapHandler);
    }

    if (this.previouslyFocused && typeof this.previouslyFocused.focus === 'function') {
      this.previouslyFocused.focus();
    }

    this.trapHandler = null;
    this.calendarEl = null;
    this.previouslyFocused = null;
  }

  /**
   * Removes the live region from the DOM and cleans up all references.
   */
  destroy(): void {
    this.disableFocusTrap();

    if (this.liveRegion && this.liveRegion.parentNode) {
      this.liveRegion.parentNode.removeChild(this.liveRegion);
    }
    this.liveRegion = null;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Returns all focusable elements within the given container, in DOM order.
   */
  private getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"]):not([disabled])',
    ].join(', ');

    return Array.from(container.querySelectorAll<HTMLElement>(selector));
  }
}
