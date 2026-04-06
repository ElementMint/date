import { parseConfig, mergeConfig, DEFAULT_CONFIG } from '../../src/core/config';
import type { DatePickerConfig } from '../../src/core/types';

/** Helper to create a mock element with a dataset */
function mockElement(dataset: Record<string, string | undefined> = {}) {
  return { dataset };
}

describe('DEFAULT_CONFIG', () => {
  it('has sensible default values', () => {
    expect(DEFAULT_CONFIG.format).toBe('YYYY-MM-DD');
    expect(DEFAULT_CONFIG.min).toBeNull();
    expect(DEFAULT_CONFIG.max).toBeNull();
    expect(DEFAULT_CONFIG.valueType).toBe('iso');
    expect(DEFAULT_CONFIG.locale).toBe('en');
    expect(DEFAULT_CONFIG.weekStart).toBe(1);
    expect(DEFAULT_CONFIG.theme).toBe('system');
    expect(DEFAULT_CONFIG.placeholder).toBe('');
    expect(DEFAULT_CONFIG.required).toBe(false);
    expect(DEFAULT_CONFIG.disabledDates).toEqual([]);
    expect(DEFAULT_CONFIG.validate).toBe('');
    expect(DEFAULT_CONFIG.disabled).toBe(false);
    expect(DEFAULT_CONFIG.readOnly).toBe(false);
    expect(DEFAULT_CONFIG.name).toBe('');
    expect(DEFAULT_CONFIG.value).toBeNull();
    expect(DEFAULT_CONFIG.closeOnSelect).toBe(true);
    expect(DEFAULT_CONFIG.showToday).toBe(true);
    expect(DEFAULT_CONFIG.showClear).toBe(true);
    expect(DEFAULT_CONFIG.keyboard).toBe(true);
    expect(DEFAULT_CONFIG.className).toBe('');
    expect(DEFAULT_CONFIG.position).toBe('auto');
  });
});

describe('parseConfig', () => {
  it('returns defaults when no data attributes are set', () => {
    const config = parseConfig(mockElement());
    expect(config.format).toBe(DEFAULT_CONFIG.format);
    expect(config.min).toBeNull();
    expect(config.max).toBeNull();
    expect(config.valueType).toBe('iso');
    expect(config.locale).toBe('en');
    expect(config.weekStart).toBe(1);
    expect(config.required).toBe(false);
  });

  it('reads data-format', () => {
    const config = parseConfig(mockElement({ format: 'DD/MM/YYYY' }));
    expect(config.format).toBe('DD/MM/YYYY');
  });

  it('reads data-min and data-max', () => {
    const config = parseConfig(mockElement({
      min: '2024-01-01',
      max: '2024-12-31',
    }));
    expect(config.min).toBe('2024-01-01');
    expect(config.max).toBe('2024-12-31');
  });

  it('reads data-value-type with valid enum', () => {
    const config = parseConfig(mockElement({ valueType: 'epoch' }));
    expect(config.valueType).toBe('epoch');
  });

  it('falls back to default for invalid value-type', () => {
    const config = parseConfig(mockElement({ valueType: 'invalid' }));
    expect(config.valueType).toBe('iso');
  });

  it('reads data-locale', () => {
    const config = parseConfig(mockElement({ locale: 'fr' }));
    expect(config.locale).toBe('fr');
  });

  it('reads data-week-start as a number', () => {
    const config = parseConfig(mockElement({ weekStart: '0' }));
    expect(config.weekStart).toBe(0);
  });

  it('falls back to default for invalid week-start', () => {
    const config = parseConfig(mockElement({ weekStart: '7' }));
    expect(config.weekStart).toBe(1);
  });

  it('falls back to default for non-numeric week-start', () => {
    const config = parseConfig(mockElement({ weekStart: 'abc' }));
    expect(config.weekStart).toBe(1);
  });

  it('reads data-theme with valid enum', () => {
    const config = parseConfig(mockElement({ theme: 'dark' }));
    expect(config.theme).toBe('dark');
  });

  it('falls back to default for invalid theme', () => {
    const config = parseConfig(mockElement({ theme: 'blue' }));
    expect(config.theme).toBe('system');
  });

  it('reads data-placeholder', () => {
    const config = parseConfig(mockElement({ placeholder: 'Select a date' }));
    expect(config.placeholder).toBe('Select a date');
  });

  it('reads data-required as boolean', () => {
    // data-required with empty string (attribute present, no value) means true
    const config = parseConfig(mockElement({ required: '' }));
    expect(config.required).toBe(true);
  });

  it('reads data-required="true"', () => {
    const config = parseConfig(mockElement({ required: 'true' }));
    expect(config.required).toBe(true);
  });

  it('reads data-required="false"', () => {
    const config = parseConfig(mockElement({ required: 'false' }));
    expect(config.required).toBe(false);
  });

  it('reads data-disabled-dates as comma-separated strings', () => {
    const config = parseConfig(
      mockElement({ disabledDates: '2024-12-25,2024-01-01' }),
    );
    expect(config.disabledDates).toEqual(['2024-12-25', '2024-01-01']);
  });

  it('returns empty array for missing disabled-dates', () => {
    const config = parseConfig(mockElement());
    expect(config.disabledDates).toEqual([]);
  });

  it('reads data-validate', () => {
    const config = parseConfig(mockElement({ validate: 'weekday,future' }));
    expect(config.validate).toBe('weekday,future');
  });

  it('reads data-disabled as boolean', () => {
    const config = parseConfig(mockElement({ disabled: 'true' }));
    expect(config.disabled).toBe(true);
  });

  it('reads data-read-only as boolean', () => {
    const config = parseConfig(mockElement({ readOnly: 'true' }));
    expect(config.readOnly).toBe(true);
  });

  it('reads data-name', () => {
    const config = parseConfig(mockElement({ name: 'birth_date' }));
    expect(config.name).toBe('birth_date');
  });

  it('reads data-value', () => {
    const config = parseConfig(mockElement({ value: '2024-06-15' }));
    expect(config.value).toBe('2024-06-15');
  });

  it('reads data-close-on-select as boolean', () => {
    const config = parseConfig(mockElement({ closeOnSelect: 'false' }));
    expect(config.closeOnSelect).toBe(false);
  });

  it('reads data-show-today as boolean', () => {
    const config = parseConfig(mockElement({ showToday: 'false' }));
    expect(config.showToday).toBe(false);
  });

  it('reads data-show-clear as boolean', () => {
    const config = parseConfig(mockElement({ showClear: 'false' }));
    expect(config.showClear).toBe(false);
  });

  it('reads data-keyboard as boolean', () => {
    const config = parseConfig(mockElement({ keyboard: 'false' }));
    expect(config.keyboard).toBe(false);
  });

  it('reads data-class-name', () => {
    const config = parseConfig(mockElement({ className: 'my-picker' }));
    expect(config.className).toBe('my-picker');
  });

  it('reads data-position with valid enum', () => {
    const config = parseConfig(mockElement({ position: 'top' }));
    expect(config.position).toBe('top');
  });

  it('falls back to default for invalid position', () => {
    const config = parseConfig(mockElement({ position: 'left' }));
    expect(config.position).toBe('auto');
  });

  it('parses boolean "1" as true', () => {
    const config = parseConfig(mockElement({ required: '1' }));
    expect(config.required).toBe(true);
  });

  it('parses boolean "0" as false', () => {
    const config = parseConfig(mockElement({ required: '0' }));
    expect(config.required).toBe(false);
  });

  it('parses boolean "yes" as true', () => {
    const config = parseConfig(mockElement({ required: 'yes' }));
    expect(config.required).toBe(true);
  });

  it('parses boolean "no" as false', () => {
    const config = parseConfig(mockElement({ required: 'no' }));
    expect(config.required).toBe(false);
  });
});

describe('mergeConfig', () => {
  it('returns defaults when partial is empty', () => {
    const result = mergeConfig(DEFAULT_CONFIG, {});
    expect(result).toEqual(DEFAULT_CONFIG);
  });

  it('overlays provided values', () => {
    const result = mergeConfig(DEFAULT_CONFIG, {
      format: 'DD/MM/YYYY',
      locale: 'fr',
    });
    expect(result.format).toBe('DD/MM/YYYY');
    expect(result.locale).toBe('fr');
    // Other values should remain default
    expect(result.valueType).toBe('iso');
    expect(result.weekStart).toBe(1);
  });

  it('ignores undefined values in partial', () => {
    const result = mergeConfig(DEFAULT_CONFIG, {
      format: undefined,
    });
    expect(result.format).toBe(DEFAULT_CONFIG.format);
  });

  it('ignores null values in partial', () => {
    const result = mergeConfig(DEFAULT_CONFIG, {
      min: null,
    } as Partial<DatePickerConfig>);
    expect(result.min).toBeNull(); // stays as default null
  });

  it('allows overriding with non-null values', () => {
    const result = mergeConfig(DEFAULT_CONFIG, {
      min: '2024-01-01',
      max: '2024-12-31',
      required: true,
    });
    expect(result.min).toBe('2024-01-01');
    expect(result.max).toBe('2024-12-31');
    expect(result.required).toBe(true);
  });

  it('does not mutate the defaults object', () => {
    const originalFormat = DEFAULT_CONFIG.format;
    mergeConfig(DEFAULT_CONFIG, { format: 'DD.MM.YYYY' });
    expect(DEFAULT_CONFIG.format).toBe(originalFormat);
  });
});
