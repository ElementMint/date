// ============================================================================
// natural-input.ts - Natural masked input editing for numeric date formats
// ============================================================================

import type { SegmentType } from '../core/types';
import { getFormatTokens } from '../core/formatter';
import { parseDate, parseISO, parsePaste } from '../core/parser';

type SupportedToken = 'D' | 'DD' | 'M' | 'MM' | 'YY' | 'YYYY';

interface SegmentState {
  token: SupportedToken;
  type: SegmentType;
  minLength: number;
  maxLength: number;
  value: string;
}

interface SegmentLayout {
  start: number;
  end: number;
}

interface SeparatorLayout {
  start: number;
  end: number;
}

interface InputLayout {
  display: string;
  segments: SegmentLayout[];
  separators: Array<SeparatorLayout | null>;
}

interface LogicalCaret {
  segmentIndex: number;
  offset: number;
}

const SUPPORTED_TOKENS = new Set<SupportedToken>(['D', 'DD', 'M', 'MM', 'YY', 'YYYY']);

function isDigitKey(value: string): boolean {
  return /^\d$/.test(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function supportsNaturalInputFormat(format: string): boolean {
  const tokens = getFormatTokens(format);
  if (!tokens.some((token) => token.isDatePart)) {
    return false;
  }

  return tokens.every((token) => {
    if (!token.isDatePart) return true;
    return SUPPORTED_TOKENS.has(token.token as SupportedToken);
  });
}

function getSegmentLengths(token: SupportedToken): { minLength: number; maxLength: number } {
  switch (token) {
    case 'D':
    case 'M':
      return { minLength: 1, maxLength: 2 };
    case 'DD':
    case 'MM':
    case 'YY':
    case 'YYYY':
      return { minLength: token.length, maxLength: token.length };
    default:
      return { minLength: 1, maxLength: 2 };
  }
}

export class NaturalDateInput {
  private input: HTMLInputElement;
  private format: string;
  private segments: SegmentState[] = [];
  private separators: string[] = [];
  private layout: InputLayout = {
    display: '',
    segments: [],
    separators: [],
  };
  private applyingValue: boolean = false;
  private dispatchingInput: boolean = false;

  private readonly handleKeyDown: (event: KeyboardEvent) => void;
  private readonly handleInput: () => void;
  private readonly handlePaste: (event: ClipboardEvent) => void;

  constructor(input: HTMLInputElement, format: string) {
    if (!supportsNaturalInputFormat(format)) {
      throw new Error(`NaturalDateInput: unsupported format "${format}"`);
    }

    this.input = input;
    this.format = format;

    this.buildPattern();
    this.handleKeyDown = this.onKeyDown.bind(this);
    this.handleInput = this.onInput.bind(this);
    this.handlePaste = this.onPaste.bind(this);

    this.input.addEventListener('keydown', this.handleKeyDown);
    this.input.addEventListener('input', this.handleInput);
    this.input.addEventListener('paste', this.handlePaste);
    this.input.setAttribute('inputmode', 'numeric');

    const initialCaret = this.syncFromText(this.input.value);
    this.render(initialCaret);
  }

  destroy(): void {
    this.input.removeEventListener('keydown', this.handleKeyDown);
    this.input.removeEventListener('input', this.handleInput);
    this.input.removeEventListener('paste', this.handlePaste);
  }

  setDate(date: Date | null): void {
    if (!date) {
      this.clearSegments();
      this.render({ segmentIndex: 0, offset: 0 });
      return;
    }

    this.fillFromDate(date);

    const lastIndex = this.segments.length - 1;
    this.render({
      segmentIndex: lastIndex,
      offset: this.segments[lastIndex]?.value.length ?? 0,
    });
  }

  private buildPattern(): void {
    const tokens = getFormatTokens(this.format);
    let pendingSeparator = '';

    for (const token of tokens) {
      if (!token.isDatePart) {
        if (this.segments.length > 0) {
          pendingSeparator += token.token;
        }
        continue;
      }

      if (!token.segmentType || !SUPPORTED_TOKENS.has(token.token as SupportedToken)) {
        continue;
      }

      if (this.segments.length > 0) {
        this.separators.push(pendingSeparator);
        pendingSeparator = '';
      }

      const lengths = getSegmentLengths(token.token as SupportedToken);

      this.segments.push({
        token: token.token as SupportedToken,
        type: token.segmentType,
        minLength: lengths.minLength,
        maxLength: lengths.maxLength,
        value: '',
      });
    }

    while (this.separators.length < Math.max(0, this.segments.length - 1)) {
      this.separators.push('');
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (isDigitKey(event.key)) {
      event.preventDefault();
      this.commit(this.insertDigits(event.key));
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      this.commit(this.deleteBackward());
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      this.commit(this.deleteForward());
      return;
    }

    if (this.isSeparatorKey(event.key)) {
      const nextCaret = this.jumpToNextSegment();
      if (nextCaret) {
        event.preventDefault();
        this.commit(nextCaret);
      }
      return;
    }

    if (event.key.length === 1) {
      event.preventDefault();
    }
  }

  private onInput(): void {
    if (this.applyingValue || this.dispatchingInput) {
      return;
    }

    const caretPos = this.input.selectionStart ?? this.input.value.length;
    const nextCaret = this.syncFromText(this.input.value, caretPos);
    this.render(nextCaret);
  }

  private onPaste(event: ClipboardEvent): void {
    const raw = event.clipboardData?.getData('text') ?? '';
    if (!raw) return;

    event.preventDefault();

    const parsed = parsePaste(raw);
    if (parsed) {
      this.setDate(parsed);
      this.emitInputEvent();
      return;
    }

    const digits = raw.replace(/\D/g, '');
    if (!digits) return;

    this.commit(this.insertDigits(digits));
  }

  private insertDigits(text: string): LogicalCaret {
    const start = this.input.selectionStart ?? this.layout.display.length;
    const end = this.input.selectionEnd ?? start;
    let caret =
      end > start
        ? this.clearSelection(start, end)
        : this.resolveCaret(start);

    for (const digit of text) {
      caret = this.insertDigit(caret, digit);
    }

    return caret;
  }

  private insertDigit(caret: LogicalCaret, digit: string): LogicalCaret {
    let segmentIndex = clamp(caret.segmentIndex, 0, this.segments.length - 1);
    let offset = caret.offset;

    while (segmentIndex < this.segments.length) {
      const segment = this.segments[segmentIndex];
      const length = segment.value.length;
      const position = clamp(offset, 0, length);
      const nextSegmentIndex = segmentIndex + 1;

      if (length < segment.maxLength) {
        segment.value =
          segment.value.slice(0, position) +
          digit +
          segment.value.slice(position);
        if (segment.value.length > segment.maxLength) {
          segment.value = segment.value.slice(0, segment.maxLength);
        }

        const nextOffset = clamp(position + 1, 0, segment.value.length);
        if (
          segment.value.length === segment.maxLength &&
          nextOffset >= segment.value.length &&
          nextSegmentIndex < this.segments.length
        ) {
          return { segmentIndex: nextSegmentIndex, offset: 0 };
        }

        return { segmentIndex, offset: nextOffset };
      }

      if (position < segment.maxLength) {
        segment.value =
          segment.value.slice(0, position) +
          digit +
          segment.value.slice(position + 1);

        if (position + 1 >= segment.maxLength && nextSegmentIndex < this.segments.length) {
          return { segmentIndex: nextSegmentIndex, offset: 0 };
        }

        return { segmentIndex, offset: clamp(position + 1, 0, segment.maxLength) };
      }

      if (nextSegmentIndex >= this.segments.length) {
        return { segmentIndex, offset: segment.value.length };
      }

      segmentIndex = nextSegmentIndex;
      offset = 0;
    }

    const lastIndex = this.segments.length - 1;
    return {
      segmentIndex: lastIndex,
      offset: this.segments[lastIndex]?.value.length ?? 0,
    };
  }

  private deleteBackward(): LogicalCaret {
    const start = this.input.selectionStart ?? this.layout.display.length;
    const end = this.input.selectionEnd ?? start;

    if (end > start) {
      return this.clearSelection(start, end);
    }

    const target = this.findPreviousEditable(start);
    if (!target) {
      return { segmentIndex: 0, offset: 0 };
    }

    const segment = this.segments[target.segmentIndex];
    segment.value =
      segment.value.slice(0, target.offset) +
      segment.value.slice(target.offset + 1);

    return {
      segmentIndex: target.segmentIndex,
      offset: target.offset,
    };
  }

  private deleteForward(): LogicalCaret {
    const start = this.input.selectionStart ?? this.layout.display.length;
    const end = this.input.selectionEnd ?? start;

    if (end > start) {
      return this.clearSelection(start, end);
    }

    const target = this.findNextEditable(start);
    if (!target) {
      const lastIndex = this.segments.length - 1;
      return {
        segmentIndex: lastIndex,
        offset: this.segments[lastIndex]?.value.length ?? 0,
      };
    }

    const segment = this.segments[target.segmentIndex];
    segment.value =
      segment.value.slice(0, target.offset) +
      segment.value.slice(target.offset + 1);

    return {
      segmentIndex: target.segmentIndex,
      offset: target.offset,
    };
  }

  private clearSelection(start: number, end: number): LogicalCaret {
    const snapshot = this.layout;
    const caret = this.resolveCaret(start);

    for (let i = 0; i < this.segments.length; i++) {
      const range = snapshot.segments[i];
      const overlapStart = Math.max(start, range.start);
      const overlapEnd = Math.min(end, range.end);

      if (overlapStart >= overlapEnd) {
        continue;
      }

      const localStart = overlapStart - range.start;
      const localEnd = overlapEnd - range.start;
      const segment = this.segments[i];
      segment.value =
        segment.value.slice(0, localStart) + segment.value.slice(localEnd);
    }

    return caret;
  }

  private jumpToNextSegment(): LogicalCaret | null {
    const caretPos = this.input.selectionStart ?? this.layout.display.length;
    const caret = this.resolveCaret(caretPos);
    const current = this.segments[caret.segmentIndex];

    if (
      current &&
      current.value.length >= current.minLength &&
      caret.segmentIndex < this.segments.length - 1
    ) {
      return {
        segmentIndex: caret.segmentIndex + 1,
        offset: 0,
      };
    }

    return null;
  }

  private isSeparatorKey(key: string): boolean {
    return this.separators.some((separator) => separator.includes(key));
  }

  private findPreviousEditable(
    caretPos: number,
  ): LogicalCaret | null {
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const range = this.layout.segments[i];
      const size = this.segments[i].value.length;
      if (size === 0 || caretPos <= range.start) {
        continue;
      }

      const offset = Math.min(caretPos - range.start, size) - 1;
      if (offset >= 0) {
        return { segmentIndex: i, offset };
      }
    }

    return null;
  }

  private findNextEditable(
    caretPos: number,
  ): LogicalCaret | null {
    for (let i = 0; i < this.segments.length; i++) {
      const range = this.layout.segments[i];
      const size = this.segments[i].value.length;
      if (size === 0) {
        continue;
      }

      if (caretPos <= range.start) {
        return { segmentIndex: i, offset: 0 };
      }

      if (caretPos < range.end) {
        return {
          segmentIndex: i,
          offset: clamp(caretPos - range.start, 0, size - 1),
        };
      }
    }

    return null;
  }

  private resolveCaret(caretPos: number): LogicalCaret {
    for (let i = 0; i < this.segments.length; i++) {
      const range = this.layout.segments[i];
      if (caretPos <= range.end) {
        return {
          segmentIndex: i,
          offset: clamp(caretPos - range.start, 0, this.segments[i].value.length),
        };
      }

      const separator = this.layout.separators[i];
      if (separator && caretPos <= separator.end) {
        if (i < this.segments.length - 1) {
          return { segmentIndex: i + 1, offset: 0 };
        }

        return {
          segmentIndex: i,
          offset: this.segments[i].value.length,
        };
      }
    }

    const lastIndex = this.segments.length - 1;
    return {
      segmentIndex: lastIndex,
      offset: this.segments[lastIndex]?.value.length ?? 0,
    };
  }

  private syncFromText(text: string, caretPos?: number): LogicalCaret {
    const trimmed = text.trim();
    if (!trimmed) {
      this.clearSegments();
      return { segmentIndex: 0, offset: 0 };
    }

    const parsed = parseDate(trimmed, this.format) ?? parseISO(trimmed);
    if (parsed) {
      this.fillFromDate(parsed);
      const lastIndex = this.segments.length - 1;
      return {
        segmentIndex: lastIndex,
        offset: this.segments[lastIndex]?.value.length ?? 0,
      };
    }

    const digits = trimmed.replace(/\D/g, '');
    let offset = 0;

    for (const segment of this.segments) {
      segment.value = digits.slice(offset, offset + segment.maxLength);
      offset += segment.value.length;
    }

    const digitsBeforeCaret = caretPos == null
      ? digits.length
      : (trimmed.slice(0, caretPos).match(/\d/g) ?? []).length;

    return this.resolveCaretFromDigitCount(digitsBeforeCaret);
  }

  private resolveCaretFromDigitCount(digitCount: number): LogicalCaret {
    let remaining = digitCount;

    for (let i = 0; i < this.segments.length; i++) {
      const size = this.segments[i].value.length;
      if (remaining <= size) {
        return { segmentIndex: i, offset: remaining };
      }
      remaining -= size;
    }

    const lastIndex = this.segments.length - 1;
    return {
      segmentIndex: lastIndex,
      offset: this.segments[lastIndex]?.value.length ?? 0,
    };
  }

  private clearSegments(): void {
    for (const segment of this.segments) {
      segment.value = '';
    }
  }

  private fillFromDate(date: Date): void {
    for (const segment of this.segments) {
      switch (segment.token) {
        case 'D':
          segment.value = String(date.getDate());
          break;
        case 'DD':
          segment.value = String(date.getDate()).padStart(2, '0');
          break;
        case 'M':
          segment.value = String(date.getMonth() + 1);
          break;
        case 'MM':
          segment.value = String(date.getMonth() + 1).padStart(2, '0');
          break;
        case 'YY':
          segment.value = String(date.getFullYear()).slice(-2);
          break;
        case 'YYYY':
          segment.value = String(date.getFullYear()).padStart(4, '0');
          break;
      }
    }
  }

  private commit(nextCaret: LogicalCaret): void {
    this.render(nextCaret);
    this.emitInputEvent();
  }

  private emitInputEvent(): void {
    this.dispatchingInput = true;
    this.input.dispatchEvent(new Event('input', { bubbles: true }));
    this.dispatchingInput = false;
  }

  private render(nextCaret: LogicalCaret): void {
    this.layout = this.buildLayout(nextCaret);
    this.applyingValue = true;
    this.input.value = this.layout.display;

    const pos = this.toDisplayPosition(nextCaret);
    this.input.setSelectionRange(pos, pos);
    this.applyingValue = false;
  }

  private buildLayout(activeCaret: LogicalCaret): InputLayout {
    const segments: SegmentLayout[] = [];
    const separators: Array<SeparatorLayout | null> = [];
    let display = '';
    let cursor = 0;

    for (let i = 0; i < this.segments.length; i++) {
      const value = this.segments[i].value;
      const start = cursor;
      display += value;
      cursor += value.length;
      segments.push({ start, end: cursor });

      const separatorText = this.separators[i] ?? '';
      if (
        separatorText &&
        this.shouldShowSeparator(i, activeCaret.segmentIndex)
      ) {
        const separatorStart = cursor;
        display += separatorText;
        cursor += separatorText.length;
        separators.push({ start: separatorStart, end: cursor });
      } else {
        separators.push(null);
      }
    }

    return { display, segments, separators };
  }

  private shouldShowSeparator(index: number, activeSegmentIndex: number): boolean {
    if (index >= this.segments.length - 1) {
      return false;
    }

    const current = this.segments[index];
    if (current.value.length === current.maxLength) {
      return true;
    }

    if (activeSegmentIndex > index && current.value.length >= current.minLength) {
      return true;
    }

    for (let i = index + 1; i < this.segments.length; i++) {
      if (this.segments[i].value.length > 0) {
        return current.value.length > 0 || i > index;
      }
    }

    return false;
  }

  private toDisplayPosition(caret: LogicalCaret): number {
    const segmentIndex = clamp(caret.segmentIndex, 0, this.segments.length - 1);
    const range = this.layout.segments[segmentIndex];
    const offset = clamp(caret.offset, 0, this.segments[segmentIndex].value.length);
    return range.start + offset;
  }
}
