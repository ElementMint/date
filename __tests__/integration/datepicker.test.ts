import { DatePicker } from '../../src/datepicker';

describe('DatePicker integration', () => {
  let input: HTMLInputElement;
  let container: HTMLElement;
  let picker: DatePicker;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('data-datepicker', '');
    container.appendChild(input);
  });

  afterEach(() => {
    if (picker) {
      try {
        picker.destroy();
      } catch {
        // Already destroyed in test
      }
    }
    document.body.removeChild(container);
  });

  describe('constructor and DOM setup', () => {
    it('wraps the input in a .dp-input container', () => {
      picker = new DatePicker(input);
      const wrapper = input.closest('.dp-input');
      expect(wrapper).not.toBeNull();
      expect(wrapper!.contains(input)).toBe(true);
    });

    it('creates a toggle button', () => {
      picker = new DatePicker(input);
      const wrapper = input.closest('.dp-input');
      const toggle = wrapper!.querySelector('.dp-toggle');
      expect(toggle).not.toBeNull();
      expect(toggle!.getAttribute('aria-label')).toBe('Open calendar');
    });

    it('creates a hidden input for form submission', () => {
      picker = new DatePicker(input);
      const wrapper = input.closest('.dp-input');
      const hidden = wrapper!.querySelector('input[type="hidden"]');
      expect(hidden).not.toBeNull();
    });

    it('sets ARIA attributes on the input', () => {
      picker = new DatePicker(input);
      expect(input.getAttribute('role')).toBe('combobox');
      expect(input.getAttribute('aria-haspopup')).toBe('dialog');
      expect(input.getAttribute('aria-expanded')).toBe('false');
      expect(input.getAttribute('autocomplete')).toBe('off');
    });

    it('throws when element has no input', () => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      expect(() => new DatePicker(div)).toThrow('must be an <input> or contain one');
      document.body.removeChild(div);
    });

    it('finds input inside a wrapper element', () => {
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-datepicker', '');
      const innerInput = document.createElement('input');
      innerInput.type = 'text';
      wrapper.appendChild(innerInput);
      document.body.appendChild(wrapper);

      const p = new DatePicker(wrapper);
      expect(innerInput.getAttribute('role')).toBe('combobox');

      p.destroy();
      document.body.removeChild(wrapper);
    });
  });

  describe('open/close', () => {
    beforeEach(() => {
      picker = new DatePicker(input);
    });

    it('opens the calendar on open()', () => {
      picker.open();
      const calendar = document.querySelector('.dp-calendar');
      expect(calendar).not.toBeNull();
      expect(input.getAttribute('aria-expanded')).toBe('true');
    });

    it('closes the calendar on close()', () => {
      picker.open();
      picker.close();
      const calendar = document.querySelector('.dp-calendar');
      expect(calendar).toBeNull();
      expect(input.getAttribute('aria-expanded')).toBe('false');
    });

    it('opens on toggle button click', () => {
      const toggle = input.closest('.dp-input')!.querySelector('.dp-toggle') as HTMLElement;
      toggle.click();
      const calendar = document.querySelector('.dp-calendar');
      expect(calendar).not.toBeNull();
    });

    it('closes on second toggle button click', () => {
      const toggle = input.closest('.dp-input')!.querySelector('.dp-toggle') as HTMLElement;
      toggle.click(); // open
      toggle.click(); // close
      const calendar = document.querySelector('.dp-calendar');
      expect(calendar).toBeNull();
    });

    it('dispatches datepicker:open event', () => {
      const handler = jest.fn();
      input.addEventListener('datepicker:open', handler);
      picker.open();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('dispatches datepicker:close event', () => {
      const handler = jest.fn();
      input.addEventListener('datepicker:close', handler);
      picker.open();
      picker.close();
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('date selection', () => {
    beforeEach(() => {
      picker = new DatePicker(input);
    });

    it('selects a date via click on a day cell', () => {
      picker.open();
      const dayButton = document.querySelector('.dp-day:not([disabled])') as HTMLElement;
      expect(dayButton).not.toBeNull();

      dayButton.click();

      // Calendar should close (closeOnSelect defaults to true)
      expect(document.querySelector('.dp-calendar')).toBeNull();
      // getValue should return something
      expect(picker.getValue()).not.toBeNull();
    });

    it('updates input value after date selection', () => {
      picker.open();
      const dayButton = document.querySelector('.dp-day:not([disabled]):not(.dp-day--other-month)') as HTMLElement;
      if (dayButton) {
        dayButton.click();
        // Input should have a formatted value
        expect(input.value).not.toBe('');
      }
    });

    it('dispatches datepicker:change event on selection', () => {
      const handler = jest.fn();
      input.addEventListener('datepicker:change', handler);

      picker.open();
      const dayButton = document.querySelector('.dp-day:not([disabled])') as HTMLElement;
      if (dayButton) {
        dayButton.click();
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail).toHaveProperty('date');
        expect(handler.mock.calls[0][0].detail).toHaveProperty('value');
      }
    });
  });

  describe('getValue/setValue API', () => {
    beforeEach(() => {
      picker = new DatePicker(input);
    });

    it('getValue returns null when no date is selected', () => {
      expect(picker.getValue()).toBeNull();
    });

    it('setValue with a Date object sets the value', () => {
      const date = new Date(2024, 5, 15);
      picker.setValue(date);
      expect(picker.getValue()).not.toBeNull();
      // Default valueType is 'iso'
      expect(picker.getValue()).toBe('2024-06-15');
    });

    it('setValue with an ISO string sets the value', () => {
      picker.setValue('2024-06-15');
      expect(picker.getValue()).toBe('2024-06-15');
    });

    it('getDate returns a Date object', () => {
      picker.setValue(new Date(2024, 5, 15));
      const date = picker.getDate();
      expect(date).toBeInstanceOf(Date);
      expect(date!.getFullYear()).toBe(2024);
      expect(date!.getMonth()).toBe(5);
      expect(date!.getDate()).toBe(15);
    });

    it('getDate returns null when no date is selected', () => {
      expect(picker.getDate()).toBeNull();
    });

    it('getDate returns a clone (not the internal reference)', () => {
      picker.setValue(new Date(2024, 5, 15));
      const d1 = picker.getDate();
      const d2 = picker.getDate();
      expect(d1).not.toBe(d2);
      expect(d1!.getTime()).toBe(d2!.getTime());
    });
  });

  describe('destroy()', () => {
    it('unwraps the input from the wrapper', () => {
      picker = new DatePicker(input);
      const wrapper = input.closest('.dp-input');
      expect(wrapper).not.toBeNull();

      picker.destroy();

      // Input should no longer be inside .dp-input
      expect(input.closest('.dp-input')).toBeNull();
      // Input should still be in the DOM
      expect(document.body.contains(input)).toBe(true);
    });

    it('removes the calendar element if open', () => {
      picker = new DatePicker(input);
      picker.open();
      expect(document.querySelector('.dp-calendar')).not.toBeNull();

      picker.destroy();
      expect(document.querySelector('.dp-calendar')).toBeNull();
    });

    it('removes hidden input', () => {
      picker = new DatePicker(input);
      picker.destroy();
      const hidden = container.querySelector('input[type="hidden"]');
      expect(hidden).toBeNull();
    });

    it('open/close no-ops after destroy', () => {
      picker = new DatePicker(input);
      picker.destroy();

      // These should not throw
      picker.open();
      picker.close();
      expect(document.querySelector('.dp-calendar')).toBeNull();
    });
  });

  describe('data-min/data-max disable dates', () => {
    it('disables dates before min', () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      // Set min to the 15th of current month
      const minDate = `${year}-${String(month + 1).padStart(2, '0')}-15`;
      input.setAttribute('data-min', minDate);
      picker = new DatePicker(input);
      picker.open();

      const disabledDays = document.querySelectorAll('.dp-day--disabled');
      expect(disabledDays.length).toBeGreaterThan(0);

      // Check that disabled buttons have the disabled attribute
      for (const day of Array.from(disabledDays)) {
        expect(day.hasAttribute('disabled') || day.getAttribute('aria-disabled') === 'true').toBe(true);
      }
    });

    it('disables dates after max', () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const maxDate = `${year}-${String(month + 1).padStart(2, '0')}-15`;
      input.setAttribute('data-max', maxDate);
      picker = new DatePicker(input);
      picker.open();

      const disabledDays = document.querySelectorAll('.dp-day--disabled');
      expect(disabledDays.length).toBeGreaterThan(0);
    });
  });

  describe('data-format-display changes display format', () => {
    it('uses DD/MM/YYYY format for display', () => {
      input.setAttribute('data-format', 'DD/MM/YYYY');
      picker = new DatePicker(input);

      picker.setValue(new Date(2024, 11, 25)); // December 25, 2024

      // The input should show the date in DD/MM/YYYY format
      expect(input.value).toBe('25/12/2024');
    });

    it('uses YYYY-MM-DD format for display', () => {
      input.setAttribute('data-format', 'YYYY-MM-DD');
      picker = new DatePicker(input);

      picker.setValue(new Date(2024, 5, 15));
      expect(input.value).toBe('2024-06-15');
    });
  });

  describe('initial value from data-value', () => {
    it('sets initial value from data-value attribute', () => {
      input.setAttribute('data-value', '2024-06-15');
      picker = new DatePicker(input);

      expect(picker.getValue()).toBe('2024-06-15');
      expect(picker.getDate()!.getFullYear()).toBe(2024);
      expect(picker.getDate()!.getMonth()).toBe(5);
      expect(picker.getDate()!.getDate()).toBe(15);
    });
  });

  describe('disabled and read-only states', () => {
    it('applies disabled attribute when data-disabled is set', () => {
      input.setAttribute('data-disabled', 'true');
      picker = new DatePicker(input);
      expect(input.hasAttribute('disabled')).toBe(true);
    });

    it('applies readonly attribute when data-read-only is set', () => {
      input.setAttribute('data-read-only', 'true');
      picker = new DatePicker(input);
      expect(input.hasAttribute('readonly')).toBe(true);
    });

    it('does not open when disabled', () => {
      input.setAttribute('data-disabled', 'true');
      picker = new DatePicker(input);
      picker.open();
      expect(document.querySelector('.dp-calendar')).toBeNull();
    });
  });

  describe('calendar rendering', () => {
    it('renders header with clickable month and year buttons', () => {
      picker = new DatePicker(input);
      picker.open();

      const title = document.querySelector('.dp-title');
      expect(title).not.toBeNull();

      const monthBtn = document.querySelector('.dp-month-btn');
      const yearBtn = document.querySelector('.dp-year-btn');
      expect(monthBtn).not.toBeNull();
      expect(yearBtn).not.toBeNull();
      expect(monthBtn!.textContent).toMatch(/\w+/); // e.g. "April"
      expect(yearBtn!.textContent).toMatch(/\d{4}/); // e.g. "2026"
    });

    it('renders navigation buttons', () => {
      picker = new DatePicker(input);
      picker.open();

      expect(document.querySelector('.dp-nav-prev')).not.toBeNull();
      expect(document.querySelector('.dp-nav-next')).not.toBeNull();
    });

    it('renders weekday headers', () => {
      picker = new DatePicker(input);
      picker.open();

      const weekdays = document.querySelectorAll('.dp-weekday');
      expect(weekdays.length).toBe(7);
    });

    it('renders 6 rows in the grid', () => {
      picker = new DatePicker(input);
      picker.open();

      const rows = document.querySelectorAll('.dp-row');
      expect(rows.length).toBe(6);
    });

    it('renders 42 day cells total', () => {
      picker = new DatePicker(input);
      picker.open();

      const days = document.querySelectorAll('.dp-day');
      expect(days.length).toBe(42);
    });
  });
});
