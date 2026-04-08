// ============================================================================
// input-mask.ts - Segment-based input editing
// ============================================================================

import type { DateSegment, SegmentType } from '../core/types';
import { getFormatTokens } from '../core/formatter';
import { parsePaste } from '../core/parser';
import { getDaysInMonth } from '../core/date-utils';

/** Internal mutable segment used during editing */
interface EditableSegment {
  type: SegmentType;
  value: string;
  placeholder: string;
  start: number;
  end: number;
  maxLength: number;
  minValue: number;
  maxValue: number;
  /** Accumulated typed characters for multi-keystroke entry */
  buffer: string;
}

/** Configuration for segment limits */
const SEGMENT_LIMITS: Record<string, { min: number; max: number }> = {
  day: { min: 1, max: 31 },
  month: { min: 1, max: 12 },
  year: { min: 1, max: 9999 },
  hour: { min: 0, max: 23 },
  minute: { min: 0, max: 59 },
};

/** Placeholder text for each segment type */
const SEGMENT_PLACEHOLDERS: Record<string, string> = {
  DD: 'DD',
  D: 'D',
  MM: 'MM',
  M: 'M',
  YYYY: 'YYYY',
  YY: 'YY',
};

/**
 * SegmentedInput provides keyboard-navigable, segment-based date editing
 * on a standard <input> element. Each date part (day, month, year) is an
 * independently editable segment that the user can tab/arrow through.
 */
export class SegmentedInput {
  private input: HTMLInputElement;
  private hiddenInput: HTMLInputElement | null = null;
  private segments: EditableSegment[] = [];
  private separators: Array<{ text: string; position: number }> = [];
  private activeIndex: number = 0;
  private format: string;
  private destroyed: boolean = false;

  // Bound handlers for cleanup
  private handleKeyDown: (e: KeyboardEvent) => void;
  private handleInput: (e: Event) => void;
  private handlePaste: (e: ClipboardEvent) => void;
  private handleClick: (e: MouseEvent) => void;
  private handleFocus: (e: FocusEvent) => void;
  private bufferTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * @param inputElement - The visible input element to enhance
   * @param format       - Date format string, e.g. "DD/MM/YYYY"
   */
  constructor(inputElement: HTMLInputElement, format: string) {
    this.input = inputElement;
    this.format = format;

    this.buildSegments();
    this.renderDisplay();

    // Create a hidden input for form submission with the formatted value
    this.hiddenInput = document.createElement('input');
    this.hiddenInput.type = 'hidden';
    this.hiddenInput.name = this.input.name || '';
    if (this.input.name) {
      this.input.removeAttribute('name');
      this.input.setAttribute('data-dp-display', 'true');
    }
    this.input.parentNode?.insertBefore(this.hiddenInput, this.input.nextSibling);

    // Bind event handlers
    this.handleKeyDown = this.onKeyDown.bind(this);
    this.handleInput = this.onInput.bind(this);
    this.handlePaste = this.onPaste.bind(this);
    this.handleClick = this.onClick.bind(this);
    this.handleFocus = this.onFocus.bind(this);

    this.input.addEventListener('keydown', this.handleKeyDown);
    this.input.addEventListener('input', this.handleInput);
    this.input.addEventListener('paste', this.handlePaste);
    this.input.addEventListener('click', this.handleClick);
    this.input.addEventListener('focus', this.handleFocus);

    // Prevent default caret behavior - we manage selection ourselves
    this.input.setAttribute('inputmode', 'numeric');
  }

  /**
   * Returns the current date value, or null if incomplete.
   */
  getValue(): Date | null {
    let day = 1;
    let month = 0;
    let year = 2000;
    let hasDay = false;
    let hasMonth = false;
    let hasYear = false;

    for (const seg of this.segments) {
      if (!seg.value || seg.value === seg.placeholder) continue;

      const num = parseInt(seg.value, 10);
      if (isNaN(num)) continue;

      switch (seg.type) {
        case 'day':
          day = num;
          hasDay = true;
          break;
        case 'month':
          month = num - 1; // 0-indexed
          hasMonth = true;
          break;
        case 'year':
          year = seg.maxLength === 2 ? (num < 50 ? 2000 + num : 1900 + num) : num;
          hasYear = true;
          break;
      }
    }

    if (!hasDay || !hasMonth || !hasYear) return null;
    if (month < 0 || month > 11) return null;
    if (day < 1 || day > getDaysInMonth(year, month)) return null;

    return new Date(year, month, day);
  }

  /**
   * Sets the input to display the given date.
   */
  setValue(date: Date | null): void {
    if (!date) {
      for (const seg of this.segments) {
        seg.value = '';
        seg.buffer = '';
      }
      this.renderDisplay();
      this.syncHiddenInput();
      return;
    }

    for (const seg of this.segments) {
      switch (seg.type) {
        case 'day':
          seg.value = String(date.getDate()).padStart(seg.maxLength, '0');
          break;
        case 'month':
          seg.value = String(date.getMonth() + 1).padStart(seg.maxLength, '0');
          break;
        case 'year':
          if (seg.maxLength === 2) {
            seg.value = String(date.getFullYear()).slice(-2);
          } else {
            seg.value = String(date.getFullYear()).padStart(seg.maxLength, '0');
          }
          break;
      }
      seg.buffer = '';
    }

    this.renderDisplay();
    this.syncHiddenInput();
  }

  /**
   * Returns a snapshot of all segments as immutable DateSegment objects.
   */
  getSegments(): DateSegment[] {
    return this.segments.map((seg) => ({
      type: seg.type,
      value: seg.value || seg.placeholder,
      placeholder: seg.placeholder,
      start: seg.start,
      end: seg.end,
    }));
  }

  /**
   * Removes all event listeners and cleans up.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.input.removeEventListener('keydown', this.handleKeyDown);
    this.input.removeEventListener('input', this.handleInput);
    this.input.removeEventListener('paste', this.handlePaste);
    this.input.removeEventListener('click', this.handleClick);
    this.input.removeEventListener('focus', this.handleFocus);

    if (this.bufferTimeout !== null) {
      clearTimeout(this.bufferTimeout);
    }

    // Restore name attribute
    if (this.hiddenInput?.name) {
      this.input.name = this.hiddenInput.name;
    }

    this.hiddenInput?.remove();
    this.hiddenInput = null;
  }

  // ---------------------------------------------------------------------------
  // Segment construction
  // ---------------------------------------------------------------------------

  /**
   * Parses the format string into editable segments and separators.
   */
  private buildSegments(): void {
    const tokens = getFormatTokens(this.format);
    this.segments = [];
    this.separators = [];

    let pos = 0;

    for (const token of tokens) {
      if (token.isDatePart && token.segmentType) {
        const placeholder = SEGMENT_PLACEHOLDERS[token.token] ?? token.token;
        const maxLength = token.token.length;
        const limits = SEGMENT_LIMITS[token.segmentType];

        this.segments.push({
          type: token.segmentType,
          value: '',
          placeholder,
          start: pos,
          end: pos + maxLength,
          maxLength,
          minValue: limits.min,
          maxValue: limits.max,
          buffer: '',
        });

        pos += maxLength;
      } else {
        this.separators.push({ text: token.token, position: pos });
        pos += token.token.length;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Display rendering
  // ---------------------------------------------------------------------------

  /**
   * Renders the current segment state into the visible input's value
   * and positions the selection to highlight the active segment.
   */
  private renderDisplay(): void {
    const tokens = getFormatTokens(this.format);
    let display = '';
    let segIdx = 0;

    for (const token of tokens) {
      if (token.isDatePart && token.segmentType) {
        const seg = this.segments[segIdx];
        if (seg) {
          display += seg.value || seg.placeholder;
          segIdx++;
        }
      } else {
        display += token.token;
      }
    }

    this.input.value = display;
    this.highlightActiveSegment();
  }

  /**
   * Highlights the active segment by setting the input selection range.
   */
  private highlightActiveSegment(): void {
    const seg = this.segments[this.activeIndex];
    if (!seg) return;

    // Recalculate positions based on actual display values
    const positions = this.calculateSegmentPositions();
    const pos = positions[this.activeIndex];
    if (pos) {
      // Use requestAnimationFrame to ensure the selection sticks
      requestAnimationFrame(() => {
        if (!this.destroyed) {
          this.input.setSelectionRange(pos.start, pos.end);
        }
      });
    }
  }

  /**
   * Calculates actual character positions for each segment in the current
   * display string.
   */
  private calculateSegmentPositions(): Array<{ start: number; end: number }> {
    const tokens = getFormatTokens(this.format);
    const positions: Array<{ start: number; end: number }> = [];
    let pos = 0;

    for (const token of tokens) {
      if (token.isDatePart && token.segmentType) {
        const segIdx = positions.length;
        const seg = this.segments[segIdx];
        const text = seg ? (seg.value || seg.placeholder) : token.token;
        positions.push({ start: pos, end: pos + text.length });
        pos += text.length;
      } else {
        pos += token.token.length;
      }
    }

    return positions;
  }

  /**
   * Syncs the hidden input value with the current date.
   */
  private syncHiddenInput(): void {
    if (!this.hiddenInput) return;

    const date = this.getValue();
    if (date) {
      const y = String(date.getFullYear()).padStart(4, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      this.hiddenInput.value = `${y}-${m}-${d}`;
    } else {
      this.hiddenInput.value = '';
    }

    // Dispatch change event on the hidden input for form frameworks
    this.hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  private onKeyDown(e: KeyboardEvent): void {
    if (this.destroyed) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this.moveToPrevSegment();
        break;

      case 'ArrowRight':
        e.preventDefault();
        this.moveToNextSegment();
        break;

      case 'Tab':
        if (e.shiftKey) {
          if (this.activeIndex > 0) {
            e.preventDefault();
            this.moveToPrevSegment();
          }
          // Otherwise let Tab leave the input naturally
        } else {
          if (this.activeIndex < this.segments.length - 1) {
            e.preventDefault();
            this.moveToNextSegment();
          }
          // Otherwise let Tab leave the input naturally
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.incrementActiveSegment(1);
        break;

      case 'ArrowDown':
        e.preventDefault();
        this.incrementActiveSegment(-1);
        break;

      case 'Backspace':
      case 'Delete':
        e.preventDefault();
        this.clearActiveSegment();
        break;

      default:
        // Allow digit entry
        if (/^\d$/.test(e.key)) {
          e.preventDefault();
          this.typeDigit(e.key);
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          // Block non-digit, non-control characters
          e.preventDefault();
        }
        break;
    }
  }

  /**
   * Suppresses the default input event since we manage the value ourselves.
   */
  private onInput(event: Event): void {
    event.preventDefault();
    // Re-render to fix any changes made by the browser
    this.renderDisplay();
  }

  private onPaste(e: ClipboardEvent): void {
    e.preventDefault();
    const text = e.clipboardData?.getData('text');
    if (!text) return;

    const date = parsePaste(text);
    if (date) {
      this.setValue(date);
      // Move focus to last segment after pasting
      this.activeIndex = this.segments.length - 1;
      this.highlightActiveSegment();
    }
  }

  private onClick(_e: MouseEvent): void {
    const cursorPos = this.input.selectionStart ?? 0;
    const positions = this.calculateSegmentPositions();

    // Find which segment the click landed in
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      if (cursorPos >= pos.start && cursorPos <= pos.end) {
        this.activeIndex = i;
        this.highlightActiveSegment();
        return;
      }
    }

    // If click is past all segments, select the last one
    if (positions.length > 0) {
      this.activeIndex = positions.length - 1;
      this.highlightActiveSegment();
    }
  }

  private onFocus(_e: FocusEvent): void {
    this.highlightActiveSegment();
  }

  // ---------------------------------------------------------------------------
  // Segment navigation
  // ---------------------------------------------------------------------------

  private moveToNextSegment(): void {
    this.commitBuffer();
    if (this.activeIndex < this.segments.length - 1) {
      this.activeIndex++;
      this.highlightActiveSegment();
    }
  }

  private moveToPrevSegment(): void {
    this.commitBuffer();
    if (this.activeIndex > 0) {
      this.activeIndex--;
      this.highlightActiveSegment();
    }
  }

  // ---------------------------------------------------------------------------
  // Segment value manipulation
  // ---------------------------------------------------------------------------

  /**
   * Increments or decrements the active segment's numeric value.
   */
  private incrementActiveSegment(delta: number): void {
    const seg = this.segments[this.activeIndex];
    if (!seg) return;

    this.commitBuffer();

    let current = parseInt(seg.value, 10);
    if (isNaN(current)) {
      // Start from a sensible default
      current = seg.type === 'year' ? new Date().getFullYear() : seg.minValue;
    }

    current += delta;

    // Wrap around within bounds
    if (current > seg.maxValue) current = seg.minValue;
    if (current < seg.minValue) current = seg.maxValue;

    seg.value = String(current).padStart(seg.maxLength, '0');
    seg.buffer = '';

    this.renderDisplay();
    this.syncHiddenInput();
  }

  /**
   * Processes a single digit keystroke for the active segment.
   * Accumulates digits until the segment is full, then auto-advances.
   */
  private typeDigit(digit: string): void {
    const seg = this.segments[this.activeIndex];
    if (!seg) return;

    // Reset buffer timeout
    if (this.bufferTimeout !== null) {
      clearTimeout(this.bufferTimeout);
    }

    seg.buffer += digit;

    if (seg.buffer.length >= seg.maxLength) {
      // Buffer is full - commit and advance
      this.commitSegmentBuffer(seg);
      if (this.activeIndex < this.segments.length - 1) {
        this.activeIndex++;
      }
    } else {
      // Show partial buffer
      seg.value = seg.buffer.padStart(seg.maxLength, '0');

      // Set a timeout to commit the buffer if the user pauses
      this.bufferTimeout = setTimeout(() => {
        this.commitBuffer();
      }, 1000);
    }

    this.renderDisplay();
    this.syncHiddenInput();
  }

  /**
   * Commits the accumulated buffer for a segment, clamping it to valid range.
   */
  private commitSegmentBuffer(seg: EditableSegment): void {
    if (!seg.buffer) return;

    let num = parseInt(seg.buffer, 10);
    if (isNaN(num)) {
      seg.buffer = '';
      return;
    }

    // Clamp to valid range
    num = Math.max(seg.minValue, Math.min(seg.maxValue, num));
    seg.value = String(num).padStart(seg.maxLength, '0');
    seg.buffer = '';
  }

  /**
   * Commits the buffer on the currently active segment.
   */
  private commitBuffer(): void {
    if (this.bufferTimeout !== null) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }

    const seg = this.segments[this.activeIndex];
    if (seg && seg.buffer) {
      this.commitSegmentBuffer(seg);
      this.renderDisplay();
      this.syncHiddenInput();
    }
  }

  /**
   * Clears the active segment's value.
   */
  private clearActiveSegment(): void {
    const seg = this.segments[this.activeIndex];
    if (!seg) return;

    seg.value = '';
    seg.buffer = '';

    this.renderDisplay();
    this.syncHiddenInput();
  }
}
