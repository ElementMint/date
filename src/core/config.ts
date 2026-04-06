// ============================================================================
// config.ts - Configuration parser (reads data-* attributes from elements)
// ============================================================================
//
// NOTE: parseConfig() accepts an HTMLElement parameter, but this module does
// NOT import or use any DOM APIs itself. It reads properties from the object
// passed in. This keeps the module testable in non-browser environments by
// passing a mock object with a `dataset` property.
// ============================================================================

import type {
  DatePickerConfig,
  ValueType,
  Theme,
  WeekDay,
  SelectionMode,
  InputMode,
  AnalyticsMode,
} from './types';

/**
 * Default configuration values.
 * Every option has a sensible default so the picker works out of the box.
 */
export const DEFAULT_CONFIG: DatePickerConfig = {
  format: 'YYYY-MM-DD',
  min: null,
  max: null,
  valueType: 'iso',
  selectionMode: 'single',
  inputMode: 'segmented',
  calendar: true,
  locale: 'en',
  weekStart: 1,
  theme: 'system',
  placeholder: '',
  required: false,
  disabledDates: [],
  validate: '',
  disabled: false,
  readOnly: false,
  name: '',
  value: null,
  closeOnSelect: true,
  showToday: true,
  showClear: true,
  keyboard: true,
  className: '',
  position: 'auto',
  rangeSeparator: ' to ',
  analytics: 'events',
};

/** Minimal interface for the element parameter (avoids hard DOM dependency) */
interface DatasetSource {
  dataset: Record<string, string | undefined>;
}

/**
 * Parses all data-* attributes from an element into a DatePickerConfig.
 *
 * Attribute mapping (kebab-case data attributes -> config keys):
 *   data-format        -> format
 *   data-min           -> min
 *   data-max           -> max
 *   data-value-type    -> valueType
 *   data-selection-mode-> selectionMode
 *   data-input-mode    -> inputMode
 *   data-calendar      -> calendar
 *   data-locale        -> locale
 *   data-week-start    -> weekStart
 *   data-theme         -> theme
 *   data-placeholder   -> placeholder
 *   data-required      -> required
 *   data-disabled-dates-> disabledDates (comma-separated ISO strings)
 *   data-validate      -> validate
 *   data-disabled      -> disabled
 *   data-read-only     -> readOnly
 *   data-name          -> name
 *   data-value         -> value
 *   data-close-on-select -> closeOnSelect
 *   data-show-today    -> showToday
 *   data-show-clear    -> showClear
 *   data-keyboard      -> keyboard
 *   data-class-name    -> className
 *   data-position      -> position
 *   data-range-separator -> rangeSeparator
 *   data-analytics     -> analytics
 *
 * @param element - An object with a `dataset` property (HTMLElement or mock)
 * @returns Parsed DatePickerConfig (unrecognized attributes are ignored)
 */
export function parseConfig(element: DatasetSource): DatePickerConfig {
  const d = element.dataset;

  return {
    format: parseString(d.format, DEFAULT_CONFIG.format),
    min: d.min ?? DEFAULT_CONFIG.min,
    max: d.max ?? DEFAULT_CONFIG.max,
    valueType: parseEnum<ValueType>(
      d.valueType,
      ['iso', 'epoch', 'unix'],
      DEFAULT_CONFIG.valueType,
    ),
    selectionMode: parseEnum<SelectionMode>(
      d.selectionMode,
      ['single', 'range'],
      DEFAULT_CONFIG.selectionMode,
    ),
    inputMode: parseEnum<InputMode>(
      d.inputMode,
      ['segmented', 'native'],
      DEFAULT_CONFIG.inputMode,
    ),
    calendar: parseBool(d.calendar, DEFAULT_CONFIG.calendar),
    locale: parseString(d.locale, DEFAULT_CONFIG.locale),
    weekStart: parseWeekDay(d.weekStart, DEFAULT_CONFIG.weekStart),
    theme: parseEnum<Theme>(
      d.theme,
      ['light', 'dark', 'system'],
      DEFAULT_CONFIG.theme,
    ),
    placeholder: parseString(d.placeholder, DEFAULT_CONFIG.placeholder),
    required: parseBool(d.required, DEFAULT_CONFIG.required),
    disabledDates: parseCommaSeparated(d.disabledDates),
    validate: parseString(d.validate, DEFAULT_CONFIG.validate),
    disabled: parseBool(d.disabled, DEFAULT_CONFIG.disabled),
    readOnly: parseBool(d.readOnly, DEFAULT_CONFIG.readOnly),
    name: parseString(d.name, DEFAULT_CONFIG.name),
    value: d.value ?? DEFAULT_CONFIG.value,
    closeOnSelect: parseBool(d.closeOnSelect, DEFAULT_CONFIG.closeOnSelect),
    showToday: parseBool(d.showToday, DEFAULT_CONFIG.showToday),
    showClear: parseBool(d.showClear, DEFAULT_CONFIG.showClear),
    keyboard: parseBool(d.keyboard, DEFAULT_CONFIG.keyboard),
    className: parseString(d.className, DEFAULT_CONFIG.className),
    position: parseEnum<'bottom' | 'top' | 'auto'>(
      d.position,
      ['bottom', 'top', 'auto'],
      DEFAULT_CONFIG.position,
    ),
    rangeSeparator: parseString(
      d.rangeSeparator,
      DEFAULT_CONFIG.rangeSeparator,
    ),
    analytics: parseEnum<AnalyticsMode>(
      d.analytics,
      ['off', 'events', 'datalayer'],
      DEFAULT_CONFIG.analytics,
    ),
  };
}

/**
 * Merges a partial config (from parsed attributes) with defaults.
 * Explicit `null` and `undefined` values in `parsed` are replaced by defaults.
 *
 * @param defaults - Base default config
 * @param parsed   - Partial config to overlay
 * @returns Merged DatePickerConfig
 */
export function mergeConfig(
  defaults: DatePickerConfig,
  parsed: Partial<DatePickerConfig>,
): DatePickerConfig {
  const result = { ...defaults };

  for (const key of Object.keys(parsed) as Array<keyof DatePickerConfig>) {
    const value = parsed[key];
    if (value !== undefined && value !== null) {
      (result as any)[key] = value;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal parsing helpers
// ---------------------------------------------------------------------------

function parseString(value: string | undefined, fallback: string): string {
  return value != null && value !== '' ? value : fallback;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  // data-required (no value) means the attribute is present -> true
  if (value === '') return true;
  const lower = value.toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes') return true;
  if (lower === 'false' || lower === '0' || lower === 'no') return false;
  return fallback;
}

function parseEnum<T extends string>(
  value: string | undefined,
  allowed: T[],
  fallback: T,
): T {
  if (value && allowed.includes(value as T)) return value as T;
  return fallback;
}

function parseWeekDay(
  value: string | undefined,
  fallback: WeekDay,
): WeekDay {
  if (value === undefined || value === null) return fallback;
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 0 || num > 6) return fallback;
  return num as WeekDay;
}

function parseCommaSeparated(value: string | undefined): string[] {
  if (!value || !value.trim()) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
