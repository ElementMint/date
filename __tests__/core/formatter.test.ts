import {
  formatDate,
  formatForValue,
  getFormatTokens,
} from '../../src/core/formatter';

describe('getFormatTokens', () => {
  it('tokenizes DD/MM/YYYY', () => {
    const tokens = getFormatTokens('DD/MM/YYYY');
    expect(tokens).toHaveLength(5);
    expect(tokens[0]).toEqual({ token: 'DD', isDatePart: true, segmentType: 'day' });
    expect(tokens[1]).toEqual({ token: '/', isDatePart: false });
    expect(tokens[2]).toEqual({ token: 'MM', isDatePart: true, segmentType: 'month' });
    expect(tokens[3]).toEqual({ token: '/', isDatePart: false });
    expect(tokens[4]).toEqual({ token: 'YYYY', isDatePart: true, segmentType: 'year' });
  });

  it('tokenizes YYYY-MM-DD', () => {
    const tokens = getFormatTokens('YYYY-MM-DD');
    expect(tokens).toHaveLength(5);
    expect(tokens[0]).toEqual({ token: 'YYYY', isDatePart: true, segmentType: 'year' });
    expect(tokens[2]).toEqual({ token: 'MM', isDatePart: true, segmentType: 'month' });
    expect(tokens[4]).toEqual({ token: 'DD', isDatePart: true, segmentType: 'day' });
  });

  it('tokenizes D/M/YYYY with single-char tokens', () => {
    const tokens = getFormatTokens('D/M/YYYY');
    expect(tokens[0]).toEqual({ token: 'D', isDatePart: true, segmentType: 'day' });
    expect(tokens[2]).toEqual({ token: 'M', isDatePart: true, segmentType: 'month' });
  });

  it('tokenizes MMM DD, YYYY with spaces and comma', () => {
    const tokens = getFormatTokens('MMM DD, YYYY');
    expect(tokens[0]).toEqual({ token: 'MMM', isDatePart: true, segmentType: 'month' });
    expect(tokens[1]).toEqual({ token: ' ', isDatePart: false });
    expect(tokens[2]).toEqual({ token: 'DD', isDatePart: true, segmentType: 'day' });
    expect(tokens[3]).toEqual({ token: ', ', isDatePart: false });
    expect(tokens[4]).toEqual({ token: 'YYYY', isDatePart: true, segmentType: 'year' });
  });

  it('tokenizes MMMM D YYYY', () => {
    const tokens = getFormatTokens('MMMM D YYYY');
    expect(tokens[0]).toEqual({ token: 'MMMM', isDatePart: true, segmentType: 'month' });
    expect(tokens[2]).toEqual({ token: 'D', isDatePart: true, segmentType: 'day' });
    expect(tokens[4]).toEqual({ token: 'YYYY', isDatePart: true, segmentType: 'year' });
  });

  it('tokenizes YY format', () => {
    const tokens = getFormatTokens('DD/MM/YY');
    const yearToken = tokens.find(t => t.token === 'YY');
    expect(yearToken).toEqual({ token: 'YY', isDatePart: true, segmentType: 'year' });
  });

  it('returns empty array for empty format', () => {
    expect(getFormatTokens('')).toHaveLength(0);
  });
});

describe('formatDate', () => {
  const date = new Date(2024, 5, 5); // June 5, 2024

  it('formats DD as zero-padded day', () => {
    expect(formatDate(date, 'DD')).toBe('05');
  });

  it('formats D as non-padded day', () => {
    expect(formatDate(date, 'D')).toBe('5');
  });

  it('formats MM as zero-padded month', () => {
    expect(formatDate(date, 'MM')).toBe('06');
  });

  it('formats M as non-padded month', () => {
    expect(formatDate(date, 'M')).toBe('6');
  });

  it('formats YYYY as 4-digit year', () => {
    expect(formatDate(date, 'YYYY')).toBe('2024');
  });

  it('formats YY as 2-digit year', () => {
    expect(formatDate(date, 'YY')).toBe('24');
  });

  it('formats MMM as short month name', () => {
    const result = formatDate(date, 'MMM');
    expect(result).toBe('Jun');
  });

  it('formats MMMM as long month name', () => {
    const result = formatDate(date, 'MMMM');
    expect(result).toBe('June');
  });

  it('formats a full date string DD/MM/YYYY', () => {
    expect(formatDate(date, 'DD/MM/YYYY')).toBe('05/06/2024');
  });

  it('formats a full date string YYYY-MM-DD', () => {
    expect(formatDate(date, 'YYYY-MM-DD')).toBe('2024-06-05');
  });

  it('formats with mixed tokens and literals', () => {
    expect(formatDate(date, 'D MMMM YYYY')).toBe('5 June 2024');
  });

  it('handles double-digit day and month', () => {
    const dec25 = new Date(2024, 11, 25);
    expect(formatDate(dec25, 'DD/MM/YYYY')).toBe('25/12/2024');
  });

  it('pads year to 4 digits for years < 1000', () => {
    const oldDate = new Date(100, 0, 1);
    oldDate.setFullYear(100); // Avoid 1900 offset
    expect(formatDate(oldDate, 'YYYY')).toBe('0100');
  });
});

describe('formatForValue', () => {
  const date = new Date(2024, 5, 15); // June 15, 2024

  it('formats as ISO string for "iso" type', () => {
    expect(formatForValue(date, 'iso')).toBe('2024-06-15');
  });

  it('formats as epoch milliseconds for "epoch" type', () => {
    const result = formatForValue(date, 'epoch');
    expect(result).toBe(String(date.getTime()));
    expect(Number(result)).not.toBeNaN();
  });

  it('formats as unix seconds for "unix" type', () => {
    const result = formatForValue(date, 'unix');
    expect(result).toBe(String(Math.floor(date.getTime() / 1000)));
  });

  it('pads ISO month and day with zeros', () => {
    const jan1 = new Date(2024, 0, 1);
    expect(formatForValue(jan1, 'iso')).toBe('2024-01-01');
  });

  it('handles Dec 31 correctly in ISO', () => {
    const dec31 = new Date(2024, 11, 31);
    expect(formatForValue(dec31, 'iso')).toBe('2024-12-31');
  });
});
