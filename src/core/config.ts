// ============================================================================
// config.ts - Configuration parser (reads data-* attributes from elements)
// ============================================================================

import type {
  DatePickerConfig,
  ValueType,
  Theme,
  WeekDay,
  SelectionMode,
  InputMode,
  AnalyticsMode,
  CalendarMode,
} from './types';

export const DEFAULT_CONFIG: DatePickerConfig = {
  format: 'YYYY-MM-DD',
  min: null,
  max: null,
  valueType: 'iso',
  selectionMode: 'single',
  inputMode: 'segmented',
  calendar: true,
  calendarMode: 'popup',
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
  dualMonth: false,
  minNights: 0,
  maxNights: 0,
  presets: false,
  timePicker: false,
  timeFormat: '24',
  dayDataUrl: '',
  mobileSheet: false,
  mobileBreakpoint: 640,
  disabledRules: '',
  slideAnimation: true,
  blockedCheckIn: '',
  blockedCheckOut: '',
  calendarOnly: false,
  portal: false,
  hideCalendarIcon: false,
  customHeader: '',
};

/** Minimal interface for the element parameter */
interface DatasetSource {
  dataset: Record<string, string | undefined>;
}

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
      ['single', 'range', 'week', 'month'],
      DEFAULT_CONFIG.selectionMode,
    ),
    inputMode: parseEnum<InputMode>(
      d.inputMode,
      ['segmented', 'native'],
      DEFAULT_CONFIG.inputMode,
    ),
    calendar: parseBool(d.calendar, DEFAULT_CONFIG.calendar),
    calendarMode: parseEnum<CalendarMode>(
      d.calendarMode,
      ['popup', 'inline'],
      DEFAULT_CONFIG.calendarMode,
    ),
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
    dualMonth: parseBool(d.dualMonth, DEFAULT_CONFIG.dualMonth),
    minNights: parseNumber(d.minNights, DEFAULT_CONFIG.minNights),
    maxNights: parseNumber(d.maxNights, DEFAULT_CONFIG.maxNights),
    presets: parseBool(d.presets, DEFAULT_CONFIG.presets),
    timePicker: parseBool(d.timePicker, DEFAULT_CONFIG.timePicker),
    timeFormat: parseEnum<'12' | '24'>(
      d.timeFormat,
      ['12', '24'],
      DEFAULT_CONFIG.timeFormat,
    ),
    dayDataUrl: parseString(d.dayDataUrl, DEFAULT_CONFIG.dayDataUrl),
    mobileSheet: parseBool(d.mobileSheet, DEFAULT_CONFIG.mobileSheet),
    mobileBreakpoint: parseNumber(d.mobileBreakpoint, DEFAULT_CONFIG.mobileBreakpoint),
    disabledRules: parseString(d.disabledRules, DEFAULT_CONFIG.disabledRules),
    slideAnimation: parseBool(d.slideAnimation, DEFAULT_CONFIG.slideAnimation),
    blockedCheckIn: parseString(d.blockedCheckIn, DEFAULT_CONFIG.blockedCheckIn),
    blockedCheckOut: parseString(d.blockedCheckOut, DEFAULT_CONFIG.blockedCheckOut),
    calendarOnly: parseBool(d.calendarOnly, DEFAULT_CONFIG.calendarOnly),
    portal: parseBool(d.portal, DEFAULT_CONFIG.portal),
    hideCalendarIcon: parseBool(d.hideCalendarIcon, DEFAULT_CONFIG.hideCalendarIcon),
    customHeader: parseString(d.customHeader, DEFAULT_CONFIG.customHeader),
  };
}

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

function parseNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  const num = parseInt(value, 10);
  return isNaN(num) ? fallback : num;
}

function parseCommaSeparated(value: string | undefined): string[] {
  if (!value || !value.trim()) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
