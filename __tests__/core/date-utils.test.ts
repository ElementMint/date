import {
  getDaysInMonth,
  getFirstDayOfMonth,
  isLeapYear,
  isSameDay,
  isDateInRange,
  addDays,
  addMonths,
  addYears,
  toDateOnly,
  startOfMonth,
  endOfMonth,
  cloneDate,
  today,
  compareDays,
} from '../../src/core/date-utils';

describe('getDaysInMonth', () => {
  it('returns 31 for January', () => {
    expect(getDaysInMonth(2024, 0)).toBe(31);
  });

  it('returns 28 for February in a non-leap year', () => {
    expect(getDaysInMonth(2023, 1)).toBe(28);
  });

  it('returns 29 for February in a leap year', () => {
    expect(getDaysInMonth(2024, 1)).toBe(29);
  });

  it('returns 30 for April', () => {
    expect(getDaysInMonth(2024, 3)).toBe(30);
  });

  it('returns 31 for December', () => {
    expect(getDaysInMonth(2024, 11)).toBe(31);
  });

  it('handles February in century leap year (2000)', () => {
    expect(getDaysInMonth(2000, 1)).toBe(29);
  });

  it('handles February in century non-leap year (1900)', () => {
    expect(getDaysInMonth(1900, 1)).toBe(28);
  });
});

describe('getFirstDayOfMonth', () => {
  it('returns the correct day of week for a known date', () => {
    // January 1, 2024 is a Monday (1)
    expect(getFirstDayOfMonth(2024, 0)).toBe(1);
  });

  it('returns 0 for a month starting on Sunday', () => {
    // September 1, 2024 is a Sunday
    expect(getFirstDayOfMonth(2024, 8)).toBe(0);
  });
});

describe('isLeapYear', () => {
  it('returns true for years divisible by 4', () => {
    expect(isLeapYear(2024)).toBe(true);
  });

  it('returns false for years divisible by 100 but not 400', () => {
    expect(isLeapYear(1900)).toBe(false);
  });

  it('returns true for years divisible by 400', () => {
    expect(isLeapYear(2000)).toBe(true);
  });

  it('returns false for regular non-leap years', () => {
    expect(isLeapYear(2023)).toBe(false);
  });

  it('returns true for 2028', () => {
    expect(isLeapYear(2028)).toBe(true);
  });
});

describe('isSameDay', () => {
  it('returns true for the same date', () => {
    const a = new Date(2024, 5, 15);
    const b = new Date(2024, 5, 15);
    expect(isSameDay(a, b)).toBe(true);
  });

  it('returns true when times differ but same calendar day', () => {
    const a = new Date(2024, 5, 15, 8, 30);
    const b = new Date(2024, 5, 15, 22, 0);
    expect(isSameDay(a, b)).toBe(true);
  });

  it('returns false for different days', () => {
    const a = new Date(2024, 5, 15);
    const b = new Date(2024, 5, 16);
    expect(isSameDay(a, b)).toBe(false);
  });

  it('returns false for different months', () => {
    const a = new Date(2024, 5, 15);
    const b = new Date(2024, 6, 15);
    expect(isSameDay(a, b)).toBe(false);
  });

  it('returns false for different years', () => {
    const a = new Date(2024, 5, 15);
    const b = new Date(2025, 5, 15);
    expect(isSameDay(a, b)).toBe(false);
  });
});

describe('isDateInRange', () => {
  const date = new Date(2024, 5, 15);

  it('returns true when no min or max', () => {
    expect(isDateInRange(date)).toBe(true);
  });

  it('returns true when no min or max (explicit null)', () => {
    expect(isDateInRange(date, null, null)).toBe(true);
  });

  it('returns true when date equals min', () => {
    const min = new Date(2024, 5, 15);
    expect(isDateInRange(date, min)).toBe(true);
  });

  it('returns true when date equals max', () => {
    const max = new Date(2024, 5, 15);
    expect(isDateInRange(date, null, max)).toBe(true);
  });

  it('returns false when date is before min', () => {
    const min = new Date(2024, 5, 20);
    expect(isDateInRange(date, min)).toBe(false);
  });

  it('returns false when date is after max', () => {
    const max = new Date(2024, 5, 10);
    expect(isDateInRange(date, null, max)).toBe(false);
  });

  it('returns true when date is between min and max', () => {
    const min = new Date(2024, 5, 10);
    const max = new Date(2024, 5, 20);
    expect(isDateInRange(date, min, max)).toBe(true);
  });

  it('returns false when date is outside min and max range', () => {
    const min = new Date(2024, 5, 16);
    const max = new Date(2024, 5, 20);
    expect(isDateInRange(date, min, max)).toBe(false);
  });
});

describe('addDays', () => {
  it('adds positive days', () => {
    const result = addDays(new Date(2024, 0, 1), 5);
    expect(result.getDate()).toBe(6);
    expect(result.getMonth()).toBe(0);
  });

  it('subtracts when days is negative', () => {
    const result = addDays(new Date(2024, 0, 10), -5);
    expect(result.getDate()).toBe(5);
  });

  it('crosses month boundary forward', () => {
    const result = addDays(new Date(2024, 0, 31), 1);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(1);
  });

  it('crosses month boundary backward', () => {
    const result = addDays(new Date(2024, 1, 1), -1);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(31);
  });

  it('crosses year boundary', () => {
    const result = addDays(new Date(2024, 11, 31), 1);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(1);
  });

  it('does not mutate the original date', () => {
    const original = new Date(2024, 0, 1);
    const origTime = original.getTime();
    addDays(original, 10);
    expect(original.getTime()).toBe(origTime);
  });
});

describe('addMonths', () => {
  it('adds one month', () => {
    const result = addMonths(new Date(2024, 0, 15), 1);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(15);
  });

  it('subtracts months with negative value', () => {
    const result = addMonths(new Date(2024, 5, 15), -2);
    expect(result.getMonth()).toBe(3);
  });

  it('clamps day when target month is shorter (Jan 31 + 1 month)', () => {
    const result = addMonths(new Date(2024, 0, 31), 1);
    // Feb 2024 has 29 days (leap year)
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(29);
  });

  it('clamps day for non-leap year (Jan 31 + 1 month in 2023)', () => {
    const result = addMonths(new Date(2023, 0, 31), 1);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(28);
  });

  it('crosses year boundary forward', () => {
    const result = addMonths(new Date(2024, 11, 15), 1);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(0);
  });

  it('crosses year boundary backward', () => {
    const result = addMonths(new Date(2024, 0, 15), -1);
    expect(result.getFullYear()).toBe(2023);
    expect(result.getMonth()).toBe(11);
  });

  it('adds multiple months', () => {
    const result = addMonths(new Date(2024, 0, 15), 14);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(2); // March
  });

  it('does not mutate the original date', () => {
    const original = new Date(2024, 0, 31);
    const origTime = original.getTime();
    addMonths(original, 1);
    expect(original.getTime()).toBe(origTime);
  });
});

describe('addYears', () => {
  it('adds one year', () => {
    const result = addYears(new Date(2024, 5, 15), 1);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(15);
  });

  it('subtracts years with negative value', () => {
    const result = addYears(new Date(2024, 5, 15), -4);
    expect(result.getFullYear()).toBe(2020);
  });

  it('handles Feb 29 landing on a non-leap year by clamping to Feb 28', () => {
    const result = addYears(new Date(2024, 1, 29), 1);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(28);
  });

  it('handles Feb 29 landing on another leap year', () => {
    const result = addYears(new Date(2024, 1, 29), 4);
    expect(result.getFullYear()).toBe(2028);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(29);
  });

  it('does not mutate the original date', () => {
    const original = new Date(2024, 1, 29);
    const origTime = original.getTime();
    addYears(original, 1);
    expect(original.getTime()).toBe(origTime);
  });
});

describe('toDateOnly', () => {
  it('strips the time component', () => {
    const result = toDateOnly(new Date(2024, 5, 15, 13, 45, 30, 500));
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('preserves the date part', () => {
    const result = toDateOnly(new Date(2024, 5, 15, 13, 45));
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(15);
  });

  it('returns a new Date object', () => {
    const original = new Date(2024, 5, 15, 13, 45);
    const result = toDateOnly(original);
    expect(result).not.toBe(original);
  });
});

describe('startOfMonth', () => {
  it('returns the first day of the month at midnight', () => {
    const result = startOfMonth(new Date(2024, 5, 15, 10, 30));
    expect(result.getDate()).toBe(1);
    expect(result.getMonth()).toBe(5);
    expect(result.getFullYear()).toBe(2024);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });
});

describe('endOfMonth', () => {
  it('returns the last day of the month at 23:59:59.999', () => {
    const result = endOfMonth(new Date(2024, 5, 15));
    expect(result.getDate()).toBe(30); // June has 30 days
    expect(result.getMonth()).toBe(5);
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
    expect(result.getSeconds()).toBe(59);
    expect(result.getMilliseconds()).toBe(999);
  });

  it('handles February in leap year', () => {
    const result = endOfMonth(new Date(2024, 1, 1));
    expect(result.getDate()).toBe(29);
  });
});

describe('cloneDate', () => {
  it('returns a new Date with the same time', () => {
    const original = new Date(2024, 5, 15, 12, 30);
    const clone = cloneDate(original);
    expect(clone.getTime()).toBe(original.getTime());
    expect(clone).not.toBe(original);
  });
});

describe('today', () => {
  it('returns today at midnight', () => {
    const result = today();
    const now = new Date();
    expect(result.getFullYear()).toBe(now.getFullYear());
    expect(result.getMonth()).toBe(now.getMonth());
    expect(result.getDate()).toBe(now.getDate());
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });
});

describe('compareDays', () => {
  it('returns 0 for the same day', () => {
    expect(compareDays(new Date(2024, 5, 15), new Date(2024, 5, 15))).toBe(0);
  });

  it('returns -1 when a < b', () => {
    expect(compareDays(new Date(2024, 5, 14), new Date(2024, 5, 15))).toBe(-1);
  });

  it('returns 1 when a > b', () => {
    expect(compareDays(new Date(2024, 5, 16), new Date(2024, 5, 15))).toBe(1);
  });

  it('ignores time differences', () => {
    expect(
      compareDays(new Date(2024, 5, 15, 23, 59), new Date(2024, 5, 15, 0, 0)),
    ).toBe(0);
  });
});
