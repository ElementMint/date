// ============================================================================
// validator.ts - Validation system (no DOM dependencies)
// ============================================================================

import type { ValidationResult } from './types';
import { isSameDay, toDateOnly, isDateInRange } from './date-utils';
import { parseISO } from './parser';

/**
 * Validates that a value is non-empty when required.
 *
 * @param value - The raw input string
 * @returns ValidationResult
 */
export function validateRequired(value: string): ValidationResult {
  if (!value || !value.trim()) {
    return { valid: false, message: 'This field is required' };
  }
  return { valid: true };
}

/**
 * Validates that a date is within an optional min/max range (inclusive).
 *
 * @param date - The date to validate
 * @param min  - Minimum allowed date (inclusive), or undefined
 * @param max  - Maximum allowed date (inclusive), or undefined
 * @returns ValidationResult
 */
export function validateMinMax(
  date: Date,
  min?: Date | null,
  max?: Date | null,
): ValidationResult {
  if (!isDateInRange(date, min, max)) {
    if (min && max) {
      return {
        valid: false,
        message: `Date must be between ${formatSimple(min)} and ${formatSimple(max)}`,
      };
    }
    if (min) {
      return {
        valid: false,
        message: `Date must be on or after ${formatSimple(min)}`,
      };
    }
    if (max) {
      return {
        valid: false,
        message: `Date must be on or before ${formatSimple(max)}`,
      };
    }
  }
  return { valid: true };
}

/**
 * Simple date formatter for error messages (YYYY-MM-DD).
 */
function formatSimple(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses and validates a date against custom rules from a data-validate string.
 *
 * Supported rules (comma-separated):
 *  - "weekday"          - disallow weekends (Saturday/Sunday)
 *  - "future"           - date must be strictly in the future
 *  - "past"             - date must be strictly in the past
 *  - "not:YYYY-MM-DD"   - exclude a specific date
 *
 * @param date  - The date to validate
 * @param rules - Comma-separated rule string, e.g. "weekday,future,not:2024-12-25"
 * @returns ValidationResult (first failing rule wins)
 */
export function validateCustomRules(
  date: Date,
  rules: string,
): ValidationResult {
  if (!rules || !rules.trim()) {
    return { valid: true };
  }

  const ruleList = rules
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);

  const today = toDateOnly(new Date());
  const dateOnly = toDateOnly(date);

  for (const rule of ruleList) {
    const result = evaluateRule(rule, dateOnly, today);
    if (!result.valid) return result;
  }

  return { valid: true };
}

/**
 * Evaluates a single validation rule against a date.
 */
function evaluateRule(
  rule: string,
  date: Date,
  today: Date,
): ValidationResult {
  // "not:YYYY-MM-DD" - exclude specific date
  if (rule.startsWith('not:')) {
    const excluded = parseISO(rule.slice(4));
    if (excluded && isSameDay(date, excluded)) {
      return {
        valid: false,
        message: `${formatSimple(excluded)} is not available`,
      };
    }
    return { valid: true };
  }

  switch (rule) {
    case 'weekday': {
      const day = date.getDay();
      if (day === 0 || day === 6) {
        return { valid: false, message: 'Weekends are not allowed' };
      }
      return { valid: true };
    }

    case 'future': {
      if (date.getTime() <= today.getTime()) {
        return { valid: false, message: 'Date must be in the future' };
      }
      return { valid: true };
    }

    case 'past': {
      if (date.getTime() >= today.getTime()) {
        return { valid: false, message: 'Date must be in the past' };
      }
      return { valid: true };
    }

    default:
      // Unknown rules are silently accepted (forward-compatible)
      return { valid: true };
  }
}

/**
 * Combines multiple ValidationResults, returning the first failure
 * or a valid result if all pass.
 *
 * @param results - Spread of ValidationResult values
 * @returns The first invalid result, or { valid: true }
 */
export function combineValidators(
  ...results: ValidationResult[]
): ValidationResult {
  for (const result of results) {
    if (!result.valid) return result;
  }
  return { valid: true };
}

/**
 * Runs a full validation pipeline for a date.
 * Useful as a single entry point that checks required, min/max, and custom rules.
 *
 * @param value    - Raw input string (for required check)
 * @param date     - Parsed date (may be null if parsing failed)
 * @param options  - Validation options
 * @returns Combined ValidationResult
 */
export function validateDate(
  value: string,
  date: Date | null,
  options: {
    required?: boolean;
    min?: Date | null;
    max?: Date | null;
    rules?: string;
  } = {},
): ValidationResult {
  // Required check
  if (options.required) {
    const reqResult = validateRequired(value);
    if (!reqResult.valid) return reqResult;
  }

  // If no value and not required, it's valid
  if (!value || !value.trim()) {
    return { valid: true };
  }

  // If we have a value but couldn't parse it, that's invalid
  if (!date) {
    return { valid: false, message: 'Invalid date' };
  }

  // Min/max check
  const rangeResult = validateMinMax(date, options.min, options.max);
  if (!rangeResult.valid) return rangeResult;

  // Custom rules
  if (options.rules) {
    const customResult = validateCustomRules(date, options.rules);
    if (!customResult.valid) return customResult;
  }

  return { valid: true };
}
