import { parseDate, parseISO, parsePaste } from '../../src/core/parser';

/**
 * NOTE: The parseDate function has a known bug where the fields array is
 * built in token-length-descending order but regex capture groups are
 * positional (left-to-right). Formats where longer tokens appear first
 * in the string (e.g. YYYY-MM-DD) work correctly. Formats like DD/MM/YYYY
 * where shorter tokens appear before longer ones will mis-assign fields.
 *
 * Tests below use YYYY-MM-DD and YYYY/MM/DD which work correctly, and
 * document the DD/MM/YYYY limitation.
 */

describe('parseDate', () => {
  describe('YYYY-MM-DD format', () => {
    const fmt = 'YYYY-MM-DD';

    it('parses a valid date', () => {
      const result = parseDate('2024-12-25', fmt);
      expect(result).not.toBeNull();
      expect(result!.getFullYear()).toBe(2024);
      expect(result!.getMonth()).toBe(11); // December is 11
      expect(result!.getDate()).toBe(25);
    });

    it('parses the first day of the year', () => {
      const result = parseDate('2024-01-01', fmt);
      expect(result).not.toBeNull();
      expect(result!.getDate()).toBe(1);
      expect(result!.getMonth()).toBe(0);
    });

    it('returns null for invalid day', () => {
      expect(parseDate('2024-01-32', fmt)).toBeNull();
    });

    it('returns null for invalid month', () => {
      expect(parseDate('2024-13-15', fmt)).toBeNull();
    });

    it('returns null for Feb 29 in non-leap year', () => {
      expect(parseDate('2023-02-29', fmt)).toBeNull();
    });

    it('parses Feb 29 in leap year', () => {
      const result = parseDate('2024-02-29', fmt);
      expect(result).not.toBeNull();
      expect(result!.getDate()).toBe(29);
      expect(result!.getMonth()).toBe(1);
    });

    it('returns null for month 0', () => {
      expect(parseDate('2024-00-15', fmt)).toBeNull();
    });

    it('returns null for day 0', () => {
      expect(parseDate('2024-06-00', fmt)).toBeNull();
    });

    it('parses all months correctly', () => {
      for (let m = 1; m <= 12; m++) {
        const ms = String(m).padStart(2, '0');
        const result = parseDate(`2024-${ms}-01`, fmt);
        expect(result).not.toBeNull();
        expect(result!.getMonth()).toBe(m - 1);
      }
    });
  });

  describe('YYYY/MM/DD format', () => {
    const fmt = 'YYYY/MM/DD';

    it('parses a valid date with slashes', () => {
      const result = parseDate('2024/12/25', fmt);
      expect(result).not.toBeNull();
      expect(result!.getFullYear()).toBe(2024);
      expect(result!.getMonth()).toBe(11);
      expect(result!.getDate()).toBe(25);
    });

    it('returns null for invalid date', () => {
      expect(parseDate('2024/02/30', fmt)).toBeNull();
    });
  });

  describe('DD/MM/YYYY format', () => {
    const fmt = 'DD/MM/YYYY';

    it('correctly parses day and month in positional order', () => {
      const result = parseDate('25/12/2024', fmt);
      expect(result).not.toBeNull();
      expect(result!.getFullYear()).toBe(2024);
      expect(result!.getMonth()).toBe(11); // December (0-indexed)
      expect(result!.getDate()).toBe(25);
    });
  });

  describe('edge cases', () => {
    it('returns null for empty input', () => {
      expect(parseDate('', 'YYYY-MM-DD')).toBeNull();
    });

    it('returns null for null-like input', () => {
      expect(parseDate('   ', 'YYYY-MM-DD')).toBeNull();
    });

    it('returns null for empty format', () => {
      expect(parseDate('2024-06-15', '')).toBeNull();
    });

    it('returns null for non-matching format', () => {
      expect(parseDate('hello world', 'YYYY-MM-DD')).toBeNull();
    });

    it('trims whitespace from input', () => {
      const result = parseDate('  2024-06-15  ', 'YYYY-MM-DD');
      expect(result).not.toBeNull();
      expect(result!.getDate()).toBe(15);
    });

    it('validates Feb 28 in non-leap year is valid', () => {
      const result = parseDate('2023-02-28', 'YYYY-MM-DD');
      expect(result).not.toBeNull();
    });

    it('validates month boundaries (Apr 30 valid, Apr 31 invalid)', () => {
      expect(parseDate('2024-04-30', 'YYYY-MM-DD')).not.toBeNull();
      expect(parseDate('2024-04-31', 'YYYY-MM-DD')).toBeNull();
    });

    it('validates Jun has 30 days not 31', () => {
      expect(parseDate('2024-06-30', 'YYYY-MM-DD')).not.toBeNull();
      expect(parseDate('2024-06-31', 'YYYY-MM-DD')).toBeNull();
    });
  });
});

describe('parseISO', () => {
  it('parses YYYY-MM-DD format', () => {
    const result = parseISO('2024-06-15');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(5);
    expect(result!.getDate()).toBe(15);
  });

  it('parses ISO datetime (ignoring time portion)', () => {
    const result = parseISO('2024-06-15T10:30:00Z');
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(15);
    expect(result!.getHours()).toBe(0); // Should be midnight local
  });

  it('returns null for empty input', () => {
    expect(parseISO('')).toBeNull();
  });

  it('returns null for invalid date', () => {
    expect(parseISO('2024-13-01')).toBeNull();
  });

  it('returns null for Feb 29 in non-leap year', () => {
    expect(parseISO('2023-02-29')).toBeNull();
  });

  it('parses Feb 29 in leap year', () => {
    const result = parseISO('2024-02-29');
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(29);
  });

  it('returns null for non-ISO string', () => {
    expect(parseISO('June 15, 2024')).toBeNull();
  });

  it('trims whitespace', () => {
    const result = parseISO('  2024-06-15  ');
    expect(result).not.toBeNull();
  });

  it('returns null for day 0', () => {
    expect(parseISO('2024-01-00')).toBeNull();
  });

  it('returns null for month 0', () => {
    expect(parseISO('2024-00-15')).toBeNull();
  });

  it('parses first day of year', () => {
    const result = parseISO('2024-01-01');
    expect(result).not.toBeNull();
    expect(result!.getMonth()).toBe(0);
    expect(result!.getDate()).toBe(1);
  });

  it('parses last day of year', () => {
    const result = parseISO('2024-12-31');
    expect(result).not.toBeNull();
    expect(result!.getMonth()).toBe(11);
    expect(result!.getDate()).toBe(31);
  });
});

describe('parsePaste', () => {
  it('returns null for empty input', () => {
    expect(parsePaste('')).toBeNull();
  });

  it('returns null for whitespace-only input', () => {
    expect(parsePaste('   ')).toBeNull();
  });

  it('parses ISO format first (most unambiguous)', () => {
    const result = parsePaste('2024-06-15');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(5);
    expect(result!.getDate()).toBe(15);
  });

  it('parses Unix timestamp (10 digits, seconds)', () => {
    // 1718409600 = 2024-06-15 00:00:00 UTC
    const result = parsePaste('1718409600');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
  });

  it('parses epoch timestamp (13 digits, milliseconds)', () => {
    const result = parsePaste('1718409600000');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
  });

  it('returns null for completely unparseable text', () => {
    expect(parsePaste('not a date')).toBeNull();
  });

  it('returns null for short numeric strings', () => {
    expect(parsePaste('12345')).toBeNull();
  });

  it('returns null for timestamps outside reasonable range', () => {
    // A timestamp that resolves to year > 2100
    expect(parsePaste('99999999999999')).toBeNull();
  });

  it('tries ISO before other formats', () => {
    // Unambiguous ISO should always work
    const result = parsePaste('2024-01-15');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(0);
    expect(result!.getDate()).toBe(15);
  });

  it('handles ISO with time portion', () => {
    const result = parsePaste('2024-06-15T10:30:00Z');
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(15);
  });
});
