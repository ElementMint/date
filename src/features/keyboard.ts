// ============================================================================
// keyboard.ts - Keyboard navigation for the calendar grid
// ============================================================================

/** Callbacks invoked by keyboard navigation actions */
export interface KeyboardCallbacks {
  /** Called when a date should be selected (Enter/Space) */
  onSelect: (dateStr: string) => void;
  /** Called to navigate to the previous month (PageUp) */
  onPrevMonth: () => void;
  /** Called to navigate to the next month (PageDown) */
  onNextMonth: () => void;
  /** Called to navigate to the previous year (Shift+PageUp) */
  onPrevYear: () => void;
  /** Called to navigate to the next year (Shift+PageDown) */
  onNextYear: () => void;
  /** Called when Escape is pressed to close the calendar */
  onClose: () => void;
}

/**
 * Manages keyboard navigation within a calendar grid element.
 *
 * Implements a roving tabindex pattern: only the currently focused day
 * has tabindex="0"; all other days have tabindex="-1". Arrow keys,
 * Home/End, and Page Up/Down move focus between days.
 */
export class KeyboardNavigation {
  private calendarEl: HTMLElement;
  private callbacks: KeyboardCallbacks;
  private handleKeyDown: (e: KeyboardEvent) => void;

  /**
   * @param calendarEl - The root .dp-calendar element
   * @param callbacks  - Action callbacks triggered by key presses
   */
  constructor(calendarEl: HTMLElement, callbacks: KeyboardCallbacks) {
    this.calendarEl = calendarEl;
    this.callbacks = callbacks;

    this.handleKeyDown = this.onKeyDown.bind(this);
    this.calendarEl.addEventListener('keydown', this.handleKeyDown);

    // Initialize roving tabindex on all day buttons
    this.initRovingTabindex();
  }

  /**
   * Removes all event listeners and cleans up references.
   */
  destroy(): void {
    this.calendarEl.removeEventListener('keydown', this.handleKeyDown);
  }

  /**
   * Sets focus to a specific day button by its data-date value.
   * Updates roving tabindex accordingly.
   *
   * @param dateStr - ISO date string (YYYY-MM-DD)
   */
  focusDate(dateStr: string): void {
    const target = this.calendarEl.querySelector<HTMLElement>(
      `.dp-day[data-date="${dateStr}"]`,
    );
    if (target) {
      this.setRovingFocus(target);
    }
  }

  /**
   * Sets focus to the first focusable day in the grid (today, selected,
   * or the first non-disabled day).
   */
  focusFirst(): void {
    const selected = this.calendarEl.querySelector<HTMLElement>(
      '.dp-day--selected:not([disabled])',
    );
    if (selected) {
      this.setRovingFocus(selected);
      return;
    }

    const today = this.calendarEl.querySelector<HTMLElement>(
      '.dp-day--today:not([disabled])',
    );
    if (today) {
      this.setRovingFocus(today);
      return;
    }

    const first = this.calendarEl.querySelector<HTMLElement>(
      '.dp-day:not([disabled]):not(.dp-day--other-month)',
    );
    if (first) {
      this.setRovingFocus(first);
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Sets all day buttons to tabindex="-1", then sets the initial
   * focusable day to tabindex="0".
   */
  private initRovingTabindex(): void {
    const allDays = this.getAllDayButtons();
    for (const day of allDays) {
      day.setAttribute('tabindex', '-1');
    }

    // Set the first appropriate day as focusable
    const selected = this.calendarEl.querySelector<HTMLElement>(
      '.dp-day--selected:not([disabled])',
    );
    const today = this.calendarEl.querySelector<HTMLElement>(
      '.dp-day--today:not([disabled])',
    );
    const firstEnabled = this.calendarEl.querySelector<HTMLElement>(
      '.dp-day:not([disabled]):not(.dp-day--other-month)',
    );

    const initial = selected ?? today ?? firstEnabled;
    if (initial) {
      initial.setAttribute('tabindex', '0');
    }
  }

  /**
   * Moves the roving tabindex to the target element and focuses it.
   */
  private setRovingFocus(target: HTMLElement): void {
    const allDays = this.getAllDayButtons();
    for (const day of allDays) {
      day.setAttribute('tabindex', '-1');
    }
    target.setAttribute('tabindex', '0');
    target.focus();
  }

  /**
   * Returns all .dp-day button elements within the grid.
   */
  private getAllDayButtons(): HTMLElement[] {
    return Array.from(
      this.calendarEl.querySelectorAll<HTMLElement>('.dp-day'),
    );
  }

  /**
   * Returns only non-disabled day buttons.
   */
  private getEnabledDayButtons(): HTMLElement[] {
    return Array.from(
      this.calendarEl.querySelectorAll<HTMLElement>(
        '.dp-day:not([disabled])',
      ),
    );
  }

  // Ensure getEnabledDayButtons is used (prevents noUnusedLocals error)
  /** Returns the count of enabled day buttons visible in the grid. */
  getEnabledDayCount(): number {
    return this.getEnabledDayButtons().length;
  }

  /**
   * Returns the currently focused day button, or null.
   */
  private getCurrentFocused(): HTMLElement | null {
    const active = document.activeElement as HTMLElement | null;
    if (active && active.classList.contains('dp-day')) {
      return active;
    }
    // Fall back to the element with tabindex="0"
    return this.calendarEl.querySelector<HTMLElement>(
      '.dp-day[tabindex="0"]',
    );
  }

  /**
   * Finds the index of the given element within the full flat list of day
   * buttons, and moves focus by `offset` positions.
   */
  private moveFocusByOffset(current: HTMLElement, offset: number): void {
    const allDays = this.getAllDayButtons();
    const currentIndex = allDays.indexOf(current);
    if (currentIndex === -1) return;

    const targetIndex = currentIndex + offset;

    // If the target is outside the rendered grid, let the month-change
    // callbacks handle navigation
    if (targetIndex < 0) {
      this.callbacks.onPrevMonth();
      return;
    }
    if (targetIndex >= allDays.length) {
      this.callbacks.onNextMonth();
      return;
    }

    const target = allDays[targetIndex];
    if (target && !target.hasAttribute('disabled')) {
      this.setRovingFocus(target);
    }
  }

  /**
   * Master keydown handler. Dispatches to the appropriate action.
   */
  private onKeyDown(e: KeyboardEvent): void {
    const current = this.getCurrentFocused();

    switch (e.key) {
      case 'ArrowLeft': {
        e.preventDefault();
        if (current) this.moveFocusByOffset(current, -1);
        break;
      }

      case 'ArrowRight': {
        e.preventDefault();
        if (current) this.moveFocusByOffset(current, 1);
        break;
      }

      case 'ArrowUp': {
        e.preventDefault();
        if (current) this.moveFocusByOffset(current, -7);
        break;
      }

      case 'ArrowDown': {
        e.preventDefault();
        if (current) this.moveFocusByOffset(current, 7);
        break;
      }

      case 'Home': {
        e.preventDefault();
        this.focusFirstDayOfMonth();
        break;
      }

      case 'End': {
        e.preventDefault();
        this.focusLastDayOfMonth();
        break;
      }

      case 'PageUp': {
        e.preventDefault();
        if (e.shiftKey) {
          this.callbacks.onPrevYear();
        } else {
          this.callbacks.onPrevMonth();
        }
        break;
      }

      case 'PageDown': {
        e.preventDefault();
        if (e.shiftKey) {
          this.callbacks.onNextYear();
        } else {
          this.callbacks.onNextMonth();
        }
        break;
      }

      case 'Enter':
      case ' ': {
        e.preventDefault();
        if (current) {
          const dateStr = current.getAttribute('data-date');
          if (dateStr && !current.hasAttribute('disabled')) {
            this.callbacks.onSelect(dateStr);
          }
        }
        break;
      }

      case 'Escape': {
        e.preventDefault();
        this.callbacks.onClose();
        break;
      }

      default:
        // No action for other keys
        break;
    }
  }

  /**
   * Moves focus to the first non-disabled, non-other-month day of the
   * currently displayed month.
   */
  private focusFirstDayOfMonth(): void {
    const first = this.calendarEl.querySelector<HTMLElement>(
      '.dp-day:not([disabled]):not(.dp-day--other-month)',
    );
    if (first) {
      this.setRovingFocus(first);
    }
  }

  /**
   * Moves focus to the last non-disabled, non-other-month day of the
   * currently displayed month.
   */
  private focusLastDayOfMonth(): void {
    const allInMonth = Array.from(
      this.calendarEl.querySelectorAll<HTMLElement>(
        '.dp-day:not([disabled]):not(.dp-day--other-month)',
      ),
    );
    const last = allInMonth[allInMonth.length - 1];
    if (last) {
      this.setRovingFocus(last);
    }
  }
}
