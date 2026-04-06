// ============================================================================
// locale.ts - i18n support using Intl APIs (no DOM dependencies)
// ============================================================================

/**
 * Known RTL language codes (ISO 639-1). This is used as a fallback
 * when the Intl.Locale API is not available.
 */
const RTL_LANGUAGES = new Set([
  'ar', 'arc', 'dv', 'fa', 'ha', 'he', 'khw', 'ks', 'ku',
  'ps', 'ur', 'yi',
]);

/**
 * Returns an array of month names for the given locale.
 *
 * @param locale - BCP 47 locale string, e.g. "en", "fr", "ar-SA"
 * @param format - "long" (January) or "short" (Jan)
 * @returns Array of 12 month name strings (index 0 = January)
 */
export function getMonthNames(
  locale: string,
  format: 'long' | 'short' = 'long',
): string[] {
  const names: string[] = [];
  try {
    const formatter = new Intl.DateTimeFormat(locale, { month: format });
    for (let m = 0; m < 12; m++) {
      const date = new Date(2000, m, 1);
      names.push(formatter.format(date));
    }
  } catch {
    // Fallback to English
    const fallback =
      format === 'long'
        ? [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December',
          ]
        : [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
          ];
    return fallback;
  }
  return names;
}

/**
 * Returns an array of day-of-week names for the given locale.
 *
 * @param locale - BCP 47 locale string
 * @param format - "long" (Monday), "short" (Mon), or "narrow" (M)
 * @returns Array of 7 day name strings (index 0 = Sunday)
 */
export function getDayNames(
  locale: string,
  format: 'long' | 'short' | 'narrow' = 'short',
): string[] {
  const names: string[] = [];
  try {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: format });
    // Use a known Sunday as base: Jan 4, 2023 is a Wednesday...
    // Jan 1, 2023 is a Sunday
    for (let d = 0; d < 7; d++) {
      const date = new Date(2023, 0, 1 + d); // Jan 1 = Sunday
      names.push(formatter.format(date));
    }
  } catch {
    // Fallback
    if (format === 'narrow') {
      return ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    }
    if (format === 'short') {
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    }
    return [
      'Sunday', 'Monday', 'Tuesday', 'Wednesday',
      'Thursday', 'Friday', 'Saturday',
    ];
  }
  return names;
}

/**
 * Determines the text direction for a given locale.
 * Uses the Intl.Locale API when available, with a fallback
 * lookup table for known RTL languages.
 *
 * @param locale - BCP 47 locale string
 * @returns 'ltr' or 'rtl'
 */
export function getTextDirection(locale: string): 'ltr' | 'rtl' {
  // Try Intl.Locale if available (modern browsers & Node 12+)
  try {
    const loc = new Intl.Locale(locale);
    // getTextInfo is a newer API (Chrome 99+, Node 21+)
    if ('getTextInfo' in loc && typeof (loc as any).getTextInfo === 'function') {
      const info = (loc as any).getTextInfo();
      if (info && info.direction) {
        return info.direction === 'rtl' ? 'rtl' : 'ltr';
      }
    }
    // textInfo property (older spec variant)
    if ('textInfo' in loc && (loc as any).textInfo?.direction) {
      return (loc as any).textInfo.direction === 'rtl' ? 'rtl' : 'ltr';
    }
  } catch {
    // Ignore — fall through to manual lookup
  }

  // Extract the language subtag (before any hyphen or underscore)
  const lang = locale.split(/[-_]/)[0].toLowerCase();
  return RTL_LANGUAGES.has(lang) ? 'rtl' : 'ltr';
}

/**
 * Formats a date using the locale's default date style.
 *
 * @param date   - Date to format
 * @param locale - BCP 47 locale string
 * @returns Locale-formatted date string
 */
export function formatLocaleDate(date: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    // Fallback to ISO-like format
    const y = String(date.getFullYear()).padStart(4, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/**
 * Returns the conventional first day of the week for a locale.
 * 0 = Sunday, 1 = Monday, etc.
 *
 * Uses Intl.Locale.prototype.weekInfo when available, otherwise
 * falls back to a heuristic (Monday for most locales, Sunday for
 * the US and a few others).
 */
export function getFirstDayOfWeek(locale: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  try {
    const loc = new Intl.Locale(locale);
    // Modern API: getWeekInfo()
    if ('getWeekInfo' in loc && typeof (loc as any).getWeekInfo === 'function') {
      const info = (loc as any).getWeekInfo();
      if (info && typeof info.firstDay === 'number') {
        // Intl uses 1=Mon..7=Sun; convert to 0=Sun..6=Sat
        return (info.firstDay === 7 ? 0 : info.firstDay) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
      }
    }
    // Older spec variant: weekInfo property
    if ('weekInfo' in loc && (loc as any).weekInfo?.firstDay != null) {
      const fd = (loc as any).weekInfo.firstDay;
      return (fd === 7 ? 0 : fd) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    }
  } catch {
    // Ignore
  }

  // Fallback heuristic: Sunday-start countries
  const region = extractRegion(locale);
  const sundayCountries = new Set([
    'US', 'CA', 'JP', 'TW', 'KR', 'IL', 'SA', 'AE', 'BH',
    'DZ', 'EG', 'IQ', 'JO', 'KW', 'LY', 'OM', 'QA', 'SY', 'YE',
    'PH', 'PR', 'ZA', 'IN', 'BR', 'GT', 'HN', 'SV', 'NI', 'PA',
    'DO', 'BZ', 'MX', 'CO', 'VE', 'PE', 'AU', 'NZ',
  ]);

  return sundayCountries.has(region) ? 0 : 1;
}

/**
 * Extracts the region subtag from a locale string.
 * Returns uppercase region code, or empty string if none found.
 */
function extractRegion(locale: string): string {
  try {
    const loc = new Intl.Locale(locale);
    return loc.region?.toUpperCase() ?? '';
  } catch {
    // Manual extraction: look for 2-letter uppercase after hyphen
    const parts = locale.split(/[-_]/);
    for (const part of parts) {
      if (part.length === 2 && part === part.toUpperCase()) {
        return part;
      }
    }
    return '';
  }
}
