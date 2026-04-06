import {
  validateRequired,
  validateMinMax,
  validateCustomRules,
  combineValidators,
  validateDate,
} from '../../src/core/validator';

describe('validateRequired', () => {
  it('returns invalid for empty string', () => {
    const result = validateRequired('');
    expect(result.valid).toBe(false);
    expect(result.message).toBeDefined();
  });

  it('returns invalid for whitespace-only string', () => {
    const result = validateRequired('   ');
    expect(result.valid).toBe(false);
  });

  it('returns valid for non-empty string', () => {
    const result = validateRequired('2024-06-15');
    expect(result.valid).toBe(true);
    expect(result.message).toBeUndefined();
  });

  it('returns valid for any non-empty text', () => {
    expect(validateRequired('hello').valid).toBe(true);
  });
});

describe('validateMinMax', () => {
  const date = new Date(2024, 5, 15); // June 15, 2024

  it('returns valid when no min or max', () => {
    expect(validateMinMax(date).valid).toBe(true);
  });

  it('returns valid when date equals min', () => {
    const min = new Date(2024, 5, 15);
    expect(validateMinMax(date, min).valid).toBe(true);
  });

  it('returns valid when date equals max', () => {
    const max = new Date(2024, 5, 15);
    expect(validateMinMax(date, null, max).valid).toBe(true);
  });

  it('returns invalid when date is before min', () => {
    const min = new Date(2024, 5, 20);
    const result = validateMinMax(date, min);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('on or after');
  });

  it('returns invalid when date is after max', () => {
    const max = new Date(2024, 5, 10);
    const result = validateMinMax(date, null, max);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('on or before');
  });

  it('returns valid when date is within min-max range', () => {
    const min = new Date(2024, 5, 10);
    const max = new Date(2024, 5, 20);
    expect(validateMinMax(date, min, max).valid).toBe(true);
  });

  it('returns invalid with both min and max message when out of range', () => {
    const min = new Date(2024, 5, 16);
    const max = new Date(2024, 5, 20);
    const result = validateMinMax(date, min, max);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('between');
  });
});

describe('validateCustomRules', () => {
  describe('weekday rule', () => {
    it('returns valid for a weekday', () => {
      // June 17, 2024 is a Monday
      const monday = new Date(2024, 5, 17);
      expect(validateCustomRules(monday, 'weekday').valid).toBe(true);
    });

    it('returns invalid for Saturday', () => {
      // June 15, 2024 is a Saturday
      const saturday = new Date(2024, 5, 15);
      const result = validateCustomRules(saturday, 'weekday');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Weekends');
    });

    it('returns invalid for Sunday', () => {
      // June 16, 2024 is a Sunday
      const sunday = new Date(2024, 5, 16);
      expect(validateCustomRules(sunday, 'weekday').valid).toBe(false);
    });
  });

  describe('future rule', () => {
    it('returns invalid for today', () => {
      const now = new Date();
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const result = validateCustomRules(todayDate, 'future');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('future');
    });

    it('returns invalid for a past date', () => {
      const pastDate = new Date(2000, 0, 1);
      expect(validateCustomRules(pastDate, 'future').valid).toBe(false);
    });

    it('returns valid for a far future date', () => {
      const futureDate = new Date(2099, 11, 31);
      expect(validateCustomRules(futureDate, 'future').valid).toBe(true);
    });
  });

  describe('past rule', () => {
    it('returns invalid for today', () => {
      const now = new Date();
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const result = validateCustomRules(todayDate, 'past');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('past');
    });

    it('returns valid for a past date', () => {
      const pastDate = new Date(2000, 0, 1);
      expect(validateCustomRules(pastDate, 'past').valid).toBe(true);
    });

    it('returns invalid for a future date', () => {
      const futureDate = new Date(2099, 11, 31);
      expect(validateCustomRules(futureDate, 'past').valid).toBe(false);
    });
  });

  describe('not:date rule', () => {
    it('returns invalid when date matches excluded date', () => {
      const date = new Date(2024, 11, 25);
      const result = validateCustomRules(date, 'not:2024-12-25');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('not available');
    });

    it('returns valid when date does not match excluded date', () => {
      const date = new Date(2024, 11, 26);
      expect(validateCustomRules(date, 'not:2024-12-25').valid).toBe(true);
    });
  });

  describe('combined rules', () => {
    it('stops at the first failing rule', () => {
      // Saturday, use weekday + future rules
      const saturday = new Date(2024, 5, 15);
      const result = validateCustomRules(saturday, 'weekday,future');
      expect(result.valid).toBe(false);
      // Weekday should fail first
      expect(result.message).toContain('Weekends');
    });
  });

  describe('edge cases', () => {
    it('returns valid for empty rules string', () => {
      expect(validateCustomRules(new Date(), '').valid).toBe(true);
    });

    it('returns valid for whitespace-only rules', () => {
      expect(validateCustomRules(new Date(), '   ').valid).toBe(true);
    });

    it('silently accepts unknown rules', () => {
      expect(validateCustomRules(new Date(), 'unknown_rule').valid).toBe(true);
    });
  });
});

describe('combineValidators', () => {
  it('returns valid when all results are valid', () => {
    const result = combineValidators(
      { valid: true },
      { valid: true },
      { valid: true },
    );
    expect(result.valid).toBe(true);
  });

  it('returns the first invalid result', () => {
    const result = combineValidators(
      { valid: true },
      { valid: false, message: 'First error' },
      { valid: false, message: 'Second error' },
    );
    expect(result.valid).toBe(false);
    expect(result.message).toBe('First error');
  });

  it('returns valid for no arguments', () => {
    expect(combineValidators().valid).toBe(true);
  });

  it('returns the single invalid result', () => {
    const result = combineValidators({ valid: false, message: 'Error' });
    expect(result.valid).toBe(false);
  });
});

describe('validateDate', () => {
  it('returns valid for empty non-required input', () => {
    expect(validateDate('', null).valid).toBe(true);
  });

  it('returns invalid for empty required input', () => {
    const result = validateDate('', null, { required: true });
    expect(result.valid).toBe(false);
    expect(result.message).toContain('required');
  });

  it('returns invalid when value exists but date is null', () => {
    const result = validateDate('invalid-text', null);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Invalid');
  });

  it('validates min/max range', () => {
    const date = new Date(2024, 5, 15);
    const min = new Date(2024, 5, 20);
    const result = validateDate('2024-06-15', date, { min });
    expect(result.valid).toBe(false);
  });

  it('validates custom rules', () => {
    const saturday = new Date(2024, 5, 15);
    const result = validateDate('15/06/2024', saturday, { rules: 'weekday' });
    expect(result.valid).toBe(false);
  });

  it('returns valid when all checks pass', () => {
    const date = new Date(2024, 5, 17); // Monday
    const result = validateDate('17/06/2024', date, {
      required: true,
      min: new Date(2024, 5, 1),
      max: new Date(2024, 5, 30),
      rules: 'weekday',
    });
    expect(result.valid).toBe(true);
  });
});
