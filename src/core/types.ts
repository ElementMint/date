// ============================================================================
// types.ts - All TypeScript interfaces and types for the date picker library
// ============================================================================

/** Output value format */
export type ValueType = 'iso' | 'epoch' | 'unix';

/** Selection mode */
export type SelectionMode = 'single' | 'range';

/** Visible input editing mode */
export type InputMode = 'segmented' | 'native';

/** Analytics integration mode */
export type AnalyticsMode = 'off' | 'events' | 'datalayer';

/** Visual theme */
export type Theme = 'light' | 'dark' | 'system';

/** Segment type within a formatted date string */
export type SegmentType = 'day' | 'month' | 'year';

/** A single editable segment of a date input */
export interface DateSegment {
  type: SegmentType;
  value: string;
  placeholder: string;
  /** Start index within the formatted string */
  start: number;
  /** End index within the formatted string */
  end: number;
}

/** Represents a single day cell in the calendar grid */
export interface CalendarDay {
  date: Date;
  day: number;
  isToday: boolean;
  isSelected: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  isInRange: boolean;
  isDisabled: boolean;
  isOtherMonth: boolean;
}

/** Represents a selected range of dates */
export interface DateRangeValue {
  start: Date | null;
  end: Date | null;
}

/** Represents a full month calendar grid */
export interface CalendarMonth {
  year: number;
  month: number;
  /** 6 rows x 7 columns grid */
  days: CalendarDay[][];
}

/** Result of a validation check */
export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/** A parsed token from a date format string */
export interface DateFormatToken {
  /** The token literal, e.g. "DD", "MM", "YYYY", or a separator like "/" */
  token: string;
  /** Whether this token represents a date part (true) or a literal separator (false) */
  isDatePart: boolean;
  /** Which segment type this token maps to, if it is a date part */
  segmentType?: SegmentType;
}

/** Days of the week, 0 = Sunday through 6 = Saturday */
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Custom validation rule names */
export type ValidationRule = 'weekday' | 'future' | 'past' | string;

/** Full configuration for the date picker, derived from data-* attributes */
export interface DatePickerConfig {
  /** Date format string, e.g. "DD/MM/YYYY" */
  format: string;
  /** Minimum selectable date (ISO string or Date) */
  min: string | null;
  /** Maximum selectable date (ISO string or Date) */
  max: string | null;
  /** Output value type */
  valueType: ValueType;
  /** Single-date picker or hotel-style range picker */
  selectionMode: SelectionMode;
  /** Native typing or guided segmented editing */
  inputMode: InputMode;
  /** Whether the popup calendar UI is enabled */
  calendar: boolean;
  /** Locale for month/day names */
  locale: string;
  /** First day of the week (0=Sun, 1=Mon, etc.) */
  weekStart: WeekDay;
  /** Visual theme */
  theme: Theme;
  /** Placeholder text shown when empty */
  placeholder: string;
  /** Whether a value is required */
  required: boolean;
  /** Comma-separated disabled dates in ISO format */
  disabledDates: string[];
  /** Validation rules string, e.g. "weekday,future" */
  validate: string;
  /** Whether the picker is initially disabled */
  disabled: boolean;
  /** Whether the picker is read-only */
  readOnly: boolean;
  /** Name attribute for form submission */
  name: string;
  /** Initial value (ISO string) */
  value: string | null;
  /** Close the calendar on date selection */
  closeOnSelect: boolean;
  /** Show today button */
  showToday: boolean;
  /** Show clear button */
  showClear: boolean;
  /** Enable keyboard navigation */
  keyboard: boolean;
  /** Custom CSS class(es) to add to the root element */
  className: string;
  /** Position of the calendar popup */
  position: 'bottom' | 'top' | 'auto';
  /** Separator used when displaying a range */
  rangeSeparator: string;
  /** Analytics integration strategy */
  analytics: AnalyticsMode;
}
