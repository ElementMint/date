import { generateMonth, getNextMonth, getPrevMonth, offsetMonth } from '../../src/core/calendar';
import type { CalendarMonth } from '../../src/core/types';

describe('generateMonth', () => {
  it('returns 6 rows of 7 days', () => {
    const result = generateMonth(2024, 5, { weekStart: 0 }); // June 2024
    expect(result.days).toHaveLength(6);
    for (const row of result.days) {
      expect(row).toHaveLength(7);
    }
  });

  it('returns correct year and month in the result', () => {
    const result = generateMonth(2024, 5, { weekStart: 0 });
    expect(result.year).toBe(2024);
    expect(result.month).toBe(5);
  });

  it('has exactly 42 total day cells (6 x 7)', () => {
    const result = generateMonth(2024, 5, { weekStart: 0 });
    const totalCells = result.days.flat().length;
    expect(totalCells).toBe(42);
  });

  describe('day numbering', () => {
    it('includes all days of the current month', () => {
      const result = generateMonth(2024, 5, { weekStart: 0 }); // June has 30 days
      const currentMonthDays = result.days.flat().filter(d => !d.isOtherMonth);
      expect(currentMonthDays).toHaveLength(30);
      const dayNumbers = currentMonthDays.map(d => d.day);
      for (let i = 1; i <= 30; i++) {
        expect(dayNumbers).toContain(i);
      }
    });

    it('fills leading days from previous month', () => {
      // June 1, 2024 is a Saturday. With weekStart=0 (Sunday), leading days = 6
      const result = generateMonth(2024, 5, { weekStart: 0 });
      const firstRow = result.days[0];
      const leadingDays = firstRow.filter(d => d.isOtherMonth);
      expect(leadingDays.length).toBeGreaterThan(0);
      // These should be May dates
      for (const d of leadingDays) {
        expect(d.date.getMonth()).toBe(4); // May
      }
    });

    it('fills trailing days from next month', () => {
      const result = generateMonth(2024, 5, { weekStart: 0 }); // June 2024
      const allDays = result.days.flat();
      const trailingDays = allDays.filter(
        d => d.isOtherMonth && d.date.getMonth() === 6, // July
      );
      expect(trailingDays.length).toBeGreaterThan(0);
    });
  });

  describe('isOtherMonth marking', () => {
    it('marks days from previous and next months as isOtherMonth', () => {
      const result = generateMonth(2024, 5, { weekStart: 0 });
      const allDays = result.days.flat();
      const otherMonth = allDays.filter(d => d.isOtherMonth);
      const currentMonth = allDays.filter(d => !d.isOtherMonth);

      // All current month days should be in month 5 (June)
      for (const d of currentMonth) {
        expect(d.date.getMonth()).toBe(5);
      }

      // Other month days should NOT be in month 5
      for (const d of otherMonth) {
        expect(d.date.getMonth()).not.toBe(5);
      }
    });
  });

  describe('today marking', () => {
    it('marks today correctly', () => {
      const now = new Date();
      const result = generateMonth(now.getFullYear(), now.getMonth(), { weekStart: 0 });
      const allDays = result.days.flat();
      const todayDays = allDays.filter(d => d.isToday);
      expect(todayDays).toHaveLength(1);
      expect(todayDays[0].date.getDate()).toBe(now.getDate());
    });

    it('does not mark today when viewing a different month', () => {
      // Use a month far from today
      const result = generateMonth(2000, 0, { weekStart: 0 });
      const allDays = result.days.flat();
      const todayDays = allDays.filter(d => d.isToday && !d.isOtherMonth);
      expect(todayDays).toHaveLength(0);
    });
  });

  describe('selected date marking', () => {
    it('marks a selected date', () => {
      const selected = new Date(2024, 5, 15);
      const result = generateMonth(2024, 5, { weekStart: 0, selected });
      const allDays = result.days.flat();
      const selectedDays = allDays.filter(d => d.isSelected);
      expect(selectedDays).toHaveLength(1);
      expect(selectedDays[0].date.getDate()).toBe(15);
    });

    it('marks multiple selected dates', () => {
      const selected = [new Date(2024, 5, 10), new Date(2024, 5, 20)];
      const result = generateMonth(2024, 5, { weekStart: 0, selected });
      const allDays = result.days.flat();
      const selectedDays = allDays.filter(d => d.isSelected);
      expect(selectedDays).toHaveLength(2);
    });

    it('marks no selected dates when selected is null', () => {
      const result = generateMonth(2024, 5, { weekStart: 0, selected: null });
      const allDays = result.days.flat();
      const selectedDays = allDays.filter(d => d.isSelected);
      expect(selectedDays).toHaveLength(0);
    });
  });

  describe('disabled dates', () => {
    it('disables dates before min', () => {
      const min = new Date(2024, 5, 15);
      const result = generateMonth(2024, 5, { weekStart: 0, min });
      const allDays = result.days.flat();
      const currentMonthDisabled = allDays.filter(
        d => d.isDisabled && !d.isOtherMonth,
      );
      // Days 1-14 should be disabled
      for (const d of currentMonthDisabled) {
        expect(d.date.getDate()).toBeLessThan(15);
      }
    });

    it('disables dates after max', () => {
      const max = new Date(2024, 5, 15);
      const result = generateMonth(2024, 5, { weekStart: 0, max });
      const allDays = result.days.flat();
      const currentMonthDisabledAfter = allDays.filter(
        d => d.isDisabled && !d.isOtherMonth && d.date.getDate() > 15,
      );
      expect(currentMonthDisabledAfter.length).toBeGreaterThan(0);
    });

    it('disables specific dates from disabledDates list', () => {
      const disabledDates = [new Date(2024, 5, 10), new Date(2024, 5, 20)];
      const result = generateMonth(2024, 5, { weekStart: 0, disabledDates });
      const allDays = result.days.flat();
      const day10 = allDays.find(d => !d.isOtherMonth && d.date.getDate() === 10);
      const day20 = allDays.find(d => !d.isOtherMonth && d.date.getDate() === 20);
      const day15 = allDays.find(d => !d.isOtherMonth && d.date.getDate() === 15);

      expect(day10!.isDisabled).toBe(true);
      expect(day20!.isDisabled).toBe(true);
      expect(day15!.isDisabled).toBe(false);
    });

    it('min date itself is not disabled', () => {
      const min = new Date(2024, 5, 15);
      const result = generateMonth(2024, 5, { weekStart: 0, min });
      const allDays = result.days.flat();
      const day15 = allDays.find(d => !d.isOtherMonth && d.date.getDate() === 15);
      expect(day15!.isDisabled).toBe(false);
    });
  });

  describe('weekStart values', () => {
    it('starts on Sunday when weekStart=0', () => {
      // June 2024: June 1 is Saturday (day 6)
      // With weekStart=0, first cell should be Sunday May 26
      const result = generateMonth(2024, 5, { weekStart: 0 });
      const firstDay = result.days[0][0];
      expect(firstDay.date.getDay()).toBe(0); // Sunday
    });

    it('starts on Monday when weekStart=1', () => {
      const result = generateMonth(2024, 5, { weekStart: 1 });
      const firstDay = result.days[0][0];
      expect(firstDay.date.getDay()).toBe(1); // Monday
    });

    it('starts on Saturday when weekStart=6', () => {
      const result = generateMonth(2024, 5, { weekStart: 6 });
      const firstDay = result.days[0][0];
      expect(firstDay.date.getDay()).toBe(6); // Saturday
    });

    it('all rows have consistent day-of-week columns with weekStart=1', () => {
      const result = generateMonth(2024, 5, { weekStart: 1 });
      for (const row of result.days) {
        // First column should always be Monday
        expect(row[0].date.getDay()).toBe(1);
        // Last column should always be Sunday
        expect(row[6].date.getDay()).toBe(0);
      }
    });
  });
});

describe('getNextMonth', () => {
  it('advances month within the same year', () => {
    expect(getNextMonth(2024, 5)).toEqual([2024, 6]);
  });

  it('wraps from December to January of next year', () => {
    expect(getNextMonth(2024, 11)).toEqual([2025, 0]);
  });

  it('advances from January', () => {
    expect(getNextMonth(2024, 0)).toEqual([2024, 1]);
  });
});

describe('getPrevMonth', () => {
  it('goes back a month within the same year', () => {
    expect(getPrevMonth(2024, 5)).toEqual([2024, 4]);
  });

  it('wraps from January to December of previous year', () => {
    expect(getPrevMonth(2024, 0)).toEqual([2023, 11]);
  });

  it('goes back from December', () => {
    expect(getPrevMonth(2024, 11)).toEqual([2024, 10]);
  });
});

describe('offsetMonth', () => {
  it('offsets forward by 1 month', () => {
    expect(offsetMonth(2024, 5, 1)).toEqual([2024, 6]);
  });

  it('offsets backward by 1 month', () => {
    expect(offsetMonth(2024, 5, -1)).toEqual([2024, 4]);
  });

  it('offsets forward across year boundary', () => {
    expect(offsetMonth(2024, 11, 1)).toEqual([2025, 0]);
  });

  it('offsets backward across year boundary', () => {
    expect(offsetMonth(2024, 0, -1)).toEqual([2023, 11]);
  });

  it('offsets by multiple months', () => {
    expect(offsetMonth(2024, 0, 14)).toEqual([2025, 2]); // March 2025
  });

  it('offsets backward by multiple months across years', () => {
    expect(offsetMonth(2024, 2, -15)).toEqual([2022, 11]); // December 2022
  });

  it('returns same month for offset 0', () => {
    expect(offsetMonth(2024, 5, 0)).toEqual([2024, 5]);
  });
});
