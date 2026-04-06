// ============================================================================
// index.ts - Main ESM entry point for @elementmints/date
// ============================================================================
//
// This module re-exports the public API surface of the library.
// It does NOT auto-initialize; consumers call initAll() explicitly
// or create DatePicker instances manually.
// ============================================================================

// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------
export { DatePicker } from './datepicker';

// ---------------------------------------------------------------------------
// Auto-init functions
// ---------------------------------------------------------------------------
export { initAll, destroyAll, getInstance } from './auto-init/index';

// ---------------------------------------------------------------------------
// Web Component
// ---------------------------------------------------------------------------
export { DatePickerElement, defineElement } from './wrapper/web-component';

// ---------------------------------------------------------------------------
// Plugin system
// ---------------------------------------------------------------------------
export {
  registerPlugin,
  getPlugin,
  removePlugin,
  getPluginNames,
  applyPlugins,
  destroyPlugins,
} from './plugins/index';
export type { DatePickerPlugin } from './plugins/index';

// ---------------------------------------------------------------------------
// Core utilities
// ---------------------------------------------------------------------------
export { parseDate, parseISO, parsePaste } from './core/parser';
export { formatDate, formatForValue, getFormatTokens } from './core/formatter';
export { validateDate, validateRequired, validateMinMax, validateCustomRules, combineValidators } from './core/validator';
export { generateMonth, getNextMonth, getPrevMonth, offsetMonth } from './core/calendar';
export { parseConfig, mergeConfig, DEFAULT_CONFIG } from './core/config';
export { getMonthNames, getDayNames, getTextDirection, getFirstDayOfWeek } from './core/locale';
export {
  getDaysInMonth,
  getFirstDayOfMonth,
  isLeapYear,
  isSameDay,
  isDateInRange,
  addDays,
  addMonths,
  addYears,
  startOfMonth,
  endOfMonth,
  cloneDate,
  toDateOnly,
  today,
  compareDays,
} from './core/date-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type {
  DatePickerConfig,
  ValueType,
  Theme,
  SegmentType,
  DateSegment,
  CalendarDay,
  CalendarMonth,
  ValidationResult,
  DateFormatToken,
  WeekDay,
  ValidationRule,
} from './core/types';
