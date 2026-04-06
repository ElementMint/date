// ============================================================================
// parser.ts - Date parsing from strings (no DOM dependencies)
// ============================================================================

import { getDaysInMonth } from './date-utils';

/** Token patterns for format-string-based parsing */
interface ParseToken {
  token: string;
  regex: string;
  field: 'day' | 'month' | 'year';
}

const PARSE_TOKENS: ParseToken[] = [
  { token: 'YYYY', regex: '(\\d{4})', field: 'year' },
  { token: 'YY', regex: '(\\d{2})', field: 'year' },
  { token: 'MMMM', regex: '([A-Za-z]+)', field: 'month' },
  { token: 'MMM', regex: '([A-Za-z]{3})', field: 'month' },
  { token: 'MM', regex: '(\\d{2})', field: 'month' },
  { token: 'M', regex: '(\\d{1,2})', field: 'month' },
  { token: 'DD', regex: '(\\d{2})', field: 'day' },
  { token: 'D', regex: '(\\d{1,2})', field: 'day' },
];

/** Month name lookup (English, for MMM/MMMM parsing) */
const MONTH_NAMES_LONG = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTH_NAMES_SHORT = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

/**
 * Resolves a month string to a 1-based month number.
 * Handles numeric strings, short names ("Jan"), and long names ("January").
 */
function resolveMonth(value: string): number | null {
  // Numeric
  const num = parseInt(value, 10);
  if (!isNaN(num)) return num;

  // Name-based
  const lower = value.toLowerCase();
  let idx = MONTH_NAMES_LONG.indexOf(lower);
  if (idx !== -1) return idx + 1;
  idx = MONTH_NAMES_SHORT.indexOf(lower.slice(0, 3));
  if (idx !== -1) return idx + 1;

  return null;
}

/**
 * Resolves a year value, expanding 2-digit years.
 * 2-digit years 00-49 become 2000-2049, 50-99 become 1950-1999.
 */
function resolveYear(value: string): number | null {
  const num = parseInt(value, 10);
  if (isNaN(num)) return null;
  if (value.length <= 2) {
    return num < 50 ? 2000 + num : 1900 + num;
  }
  return num;
}

/**
 * Validates that day/month/year form a real calendar date.
 */
function isValidCalendarDate(
  year: number,
  month: number,
  day: number,
): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  if (day > getDaysInMonth(year, month - 1)) return false;
  if (year < 1 || year > 9999) return false;
  return true;
}

/**
 * Parses a date string according to a format string.
 * Supported tokens: YYYY, YY, MMMM, MMM, MM, M, DD, D
 *
 * @param input - The date string to parse, e.g. "25/12/2024"
 * @param format - The format string, e.g. "DD/MM/YYYY"
 * @returns The parsed Date (at midnight local time) or null if invalid.
 */
export function parseDate(input: string, format: string): Date | null {
  if (!input || !format) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // Build a regex from the format string by replacing tokens with capture groups
  let regexStr = format;
  const fields: Array<{ field: 'day' | 'month' | 'year'; token: string; position: number }> = [];

  // Sort tokens by length descending so YYYY matches before YY, etc.
  const sortedTokens = [...PARSE_TOKENS].sort(
    (a, b) => b.token.length - a.token.length,
  );

  // Track replacements to avoid double-replacing
  const placeholders: string[] = [];
  for (const pt of sortedTokens) {
    const idx = regexStr.indexOf(pt.token);
    if (idx !== -1) {
      const placeholder = `\x00${placeholders.length}\x00`;
      placeholders.push(pt.regex);
      fields.push({ field: pt.field, token: pt.token, position: idx });
      regexStr =
        regexStr.slice(0, idx) + placeholder + regexStr.slice(idx + pt.token.length);
    }
  }

  // Sort fields by their original position in the format string so they
  // align with the positional regex capture groups.
  fields.sort((a, b) => a.position - b.position);

  // Escape remaining literal characters for regex
  regexStr = regexStr.replace(/[.*+?^${}()|[\]\\]/g, (m) => {
    // Don't escape our placeholders
    if (m === '\x00') return m;
    return '\\' + m;
  });

  // Restore placeholders with actual regex groups
  for (let i = 0; i < placeholders.length; i++) {
    regexStr = regexStr.replace(`\x00${i}\x00`, placeholders[i]);
  }

  const regex = new RegExp(`^${regexStr}$`, 'i');
  const match = trimmed.match(regex);
  if (!match) return null;

  let day = 1;
  let month = 1;
  let year = 2000;

  for (let i = 0; i < fields.length; i++) {
    const raw = match[i + 1];
    const { field } = fields[i];

    if (field === 'year') {
      const y = resolveYear(raw);
      if (y === null) return null;
      year = y;
    } else if (field === 'month') {
      const m = resolveMonth(raw);
      if (m === null) return null;
      month = m;
    } else if (field === 'day') {
      const d = parseInt(raw, 10);
      if (isNaN(d)) return null;
      day = d;
    }
  }

  if (!isValidCalendarDate(year, month, day)) return null;
  return new Date(year, month - 1, day);
}

/**
 * Parses an ISO 8601 date string (YYYY-MM-DD or full ISO datetime).
 * Returns a Date at midnight local time, or null if invalid.
 */
export function parseISO(input: string): Date | null {
  if (!input) return null;

  const trimmed = input.trim();

  // Match YYYY-MM-DD (with optional time portion that we ignore)
  const isoDateRegex = /^(\d{4})-(\d{2})-(\d{2})/;
  const match = trimmed.match(isoDateRegex);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (!isValidCalendarDate(year, month, day)) return null;
  return new Date(year, month - 1, day);
}

/**
 * Formats to try when smart-parsing pasted text.
 * Order matters: more specific/common formats first.
 */
const PASTE_FORMATS = [
  // ISO
  'YYYY-MM-DD',
  // Common US
  'MM/DD/YYYY',
  'M/D/YYYY',
  // Common European
  'DD/MM/YYYY',
  'D/M/YYYY',
  'DD.MM.YYYY',
  'D.M.YYYY',
  // Dashed variants
  'DD-MM-YYYY',
  'D-M-YYYY',
  'MM-DD-YYYY',
  'M-D-YYYY',
  // Short year
  'DD/MM/YY',
  'MM/DD/YY',
  'DD.MM.YY',
  'DD-MM-YY',
  // With month names
  'D MMM YYYY',
  'DD MMM YYYY',
  'MMM D YYYY',
  'MMM DD YYYY',
  'D MMMM YYYY',
  'MMMM D YYYY',
];

/**
 * Attempts to parse a pasted string by trying multiple common date formats.
 * Also handles ISO 8601 and epoch timestamps.
 *
 * @param input - Raw pasted string
 * @returns Parsed Date or null
 */
export function parsePaste(input: string): Date | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try ISO first (most unambiguous)
  const isoResult = parseISO(trimmed);
  if (isoResult) return isoResult;

  // Try epoch/unix timestamps (all digits, reasonable range)
  if (/^\d{10,13}$/.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    // If 10 digits, treat as unix seconds; if 13, as milliseconds
    const ms = trimmed.length <= 10 ? num * 1000 : num;
    const d = new Date(ms);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 1970 && d.getFullYear() <= 2100) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
  }

  // Normalize common separators: replace commas, multiple spaces
  const normalized = trimmed.replace(/,/g, '').replace(/\s+/g, ' ');

  // Try each format
  for (const fmt of PASTE_FORMATS) {
    const result = parseDate(normalized, fmt);
    if (result) return result;
  }

  return null;
}
