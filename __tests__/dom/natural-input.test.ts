import {
  NaturalDateInput,
  supportsNaturalInputFormat,
} from '../../src/dom/natural-input';

function press(input: HTMLInputElement, key: string): void {
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('NaturalDateInput', () => {
  let input: HTMLInputElement;
  let naturalInput: NaturalDateInput;

  beforeEach(() => {
    input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
    naturalInput = new NaturalDateInput(input, 'DD/MM/YYYY');
    input.focus();
    input.setSelectionRange(0, 0);
  });

  afterEach(() => {
    naturalInput.destroy();
    document.body.innerHTML = '';
  });

  it('supports numeric formats with different token widths and separators', () => {
    expect(supportsNaturalInputFormat('DD/MM/YYYY')).toBe(true);
    expect(supportsNaturalInputFormat('D/M/YYYY')).toBe(true);
    expect(supportsNaturalInputFormat('DD.MM.YYYY')).toBe(true);
    expect(supportsNaturalInputFormat('M-D-YY')).toBe(true);
    expect(supportsNaturalInputFormat('YYYY-MM-DD')).toBe(true);
    expect(supportsNaturalInputFormat('DD MMM YYYY')).toBe(false);
  });

  it('auto-inserts separators when segments complete', () => {
    press(input, '1');
    expect(input.value).toBe('1');
    expect(input.selectionStart).toBe(1);

    press(input, '2');
    expect(input.value).toBe('12/');
    expect(input.selectionStart).toBe(3);

    press(input, '0');
    expect(input.value).toBe('12/0');
    expect(input.selectionStart).toBe(4);

    press(input, '5');
    expect(input.value).toBe('12/05/');
    expect(input.selectionStart).toBe(6);
  });

  it('clears naturally across separators with backspace', () => {
    naturalInput.setDate(new Date(2026, 4, 12));
    input.setSelectionRange(3, 3);

    press(input, 'Backspace');
    expect(input.value).toBe('1/05/2026');
    expect(input.selectionStart).toBe(1);

    press(input, '2');
    expect(input.value).toBe('12/05/2026');
    expect(input.selectionStart).toBe(3);
  });

  it('supports variable-width day and month tokens with manual separator jumps', () => {
    naturalInput.destroy();
    naturalInput = new NaturalDateInput(input, 'D/M/YYYY');
    input.focus();
    input.setSelectionRange(0, 0);

    press(input, '4');
    expect(input.value).toBe('4');

    press(input, '/');
    expect(input.value).toBe('4/');
    expect(input.selectionStart).toBe(2);

    press(input, '2');
    expect(input.value).toBe('4/2');

    press(input, '/');
    expect(input.value).toBe('4/2/');
    expect(input.selectionStart).toBe(4);

    press(input, '2');
    press(input, '0');
    press(input, '2');
    press(input, '6');

    expect(input.value).toBe('4/2/2026');
  });

  it('renders dates without zero padding for D and M tokens', () => {
    naturalInput.destroy();
    naturalInput = new NaturalDateInput(input, 'D.M.YYYY');

    naturalInput.setDate(new Date(2026, 1, 4));
    expect(input.value).toBe('4.2.2026');
  });
});
