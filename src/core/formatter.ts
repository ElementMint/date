// ============================================================================
// formatter.ts - Date formatting (no DOM dependencies)
// ============================================================================

import type { DateFormatToken, ValueType } from './types';

/**
 * Ordered list of recognized date-part tokens from longest to shortest.
 * Order matters: longer tokens must be matched before shorter ones
 * (e.g., "MMMM" before "MMM" before "MM" before "M").
 */
const TOKEN_PATTERNS: string[] = [
  'MMMM', 'MMM', 'MM', 'M',
  'YYYY', 'YY',
  'DD', 'D',
];

/** Regex that matches any known token */
const TOKEN_REGEX = new RegExp(
  `(${TOKEN_PATTERNS.join('|')})`,
  'g',
);

/**
 * Maps a token string to its segment type.
 */
function tokenToSegmentType(
  token: string,
): 'day' | 'month' | 'year' | undefined {
  switch (token) {
    case 'D':
    case 'DD':
      return 'day';
    case 'M':
    case 'MM':
    case 'MMM':
    case 'MMMM':
      return 'month';
    case 'YY':
    case 'YYYY':
      return 'year';
    default:
      return undefined;
  }
}

/**
 * Pads a number with leading zeros to the specified length.
 */
function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

/**
 * Returns the localized month name for a given 0-indexed month.
 */
function getMonthName(
  month: number,
  style: 'long' | 'short',
  locale: string = 'en',
): string {
  const date = new Date(2000, month, 1);
  try {
    return new Intl.DateTimeFormat(locale, { month: style }).format(date);
  } catch {
    // Fallback for environments without Intl
    const names =
      style === 'long'
        ? [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December',
          ]
        : [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
          ];
    return names[month] ?? '';
  }
}

/**
 * Replaces a single token with the formatted value from the given date.
 */
function formatToken(
  token: string,
  date: Date,
  locale: string = 'en',
): string {
  const day = date.getDate();
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();

  switch (token) {
    case 'D':
      return String(day);
    case 'DD':
      return pad(day, 2);
    case 'M':
      return String(month + 1);
    case 'MM':
      return pad(month + 1, 2);
    case 'MMM':
      return getMonthName(month, 'short', locale);
    case 'MMMM':
      return getMonthName(month, 'long', locale);
    case 'YY':
      return String(year).slice(-2);
    case 'YYYY':
      return pad(year, 4);
    default:
      return token;
  }
}

/**
 * Tokenizes a format string into an array of DateFormatToken objects.
 * Each element is either a date-part token (DD, MM, YYYY, etc.) or
 * a literal string (separators, spaces, etc.).
 *
 * @param format - The format string, e.g. "DD/MM/YYYY"
 * @returns Array of DateFormatToken
 */
export function getFormatTokens(format: string): DateFormatToken[] {
  const tokens: DateFormatToken[] = [];
  let lastIndex = 0;

  // Reset the regex
  TOKEN_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = TOKEN_REGEX.exec(format)) !== null) {
    // Add any literal text before this token
    if (match.index > lastIndex) {
      tokens.push({
        token: format.slice(lastIndex, match.index),
        isDatePart: false,
      });
    }

    const tokenStr = match[0];
    tokens.push({
      token: tokenStr,
      isDatePart: true,
      segmentType: tokenToSegmentType(tokenStr),
    });

    lastIndex = match.index + tokenStr.length;
  }

  // Add any trailing literal text
  if (lastIndex < format.length) {
    tokens.push({
      token: format.slice(lastIndex),
      isDatePart: false,
    });
  }

  return tokens;
}

/**
 * Formats a Date according to the given format string.
 *
 * Supported tokens:
 *  - DD   - Day of month, zero-padded (01-31)
 *  - D    - Day of month (1-31)
 *  - MM   - Month, zero-padded (01-12)
 *  - M    - Month (1-12)
 *  - MMM  - Month name, short (Jan, Feb, ...)
 *  - MMMM - Month name, long (January, February, ...)
 *  - YYYY - 4-digit year
 *  - YY   - 2-digit year
 *
 * @param date   - The Date to format
 * @param format - The format string, e.g. "DD/MM/YYYY"
 * @param locale - Optional locale for month names (default: "en")
 * @returns The formatted date string
 */
export function formatDate(
  date: Date,
  format: string,
  locale: string = 'en',
): string {
  const tokens = getFormatTokens(format);
  return tokens
    .map((t) => (t.isDatePart ? formatToken(t.token, date, locale) : t.token))
    .join('');
}

/**
 * Formats a Date for the specified value output type.
 *
 * - 'iso'   -> "YYYY-MM-DD"
 * - 'epoch' -> milliseconds since Unix epoch as a string
 * - 'unix'  -> seconds since Unix epoch as a string
 *
 * @param date      - The Date to format
 * @param valueType - The output format type
 * @returns Formatted string representation
 */
export function formatForValue(date: Date, valueType: ValueType): string {
  switch (valueType) {
    case 'iso': {
      const y = pad(date.getFullYear(), 4);
      const m = pad(date.getMonth() + 1, 2);
      const d = pad(date.getDate(), 2);
      return `${y}-${m}-${d}`;
    }
    case 'epoch':
      return String(date.getTime());
    case 'unix':
      return String(Math.floor(date.getTime() / 1000));
    default:
      return formatDate(date, 'YYYY-MM-DD');
  }
}
