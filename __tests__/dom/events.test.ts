import { EventDelegator } from '../../src/dom/events';

describe('EventDelegator', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    root.innerHTML = `
      <div class="dp-grid">
        <button class="dp-day" data-date="2024-06-15">15</button>
        <button class="dp-day" data-date="2024-06-16">16</button>
        <button class="dp-nav-prev">Prev</button>
        <button class="dp-nav-next">Next</button>
      </div>
    `;
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.removeChild(root);
  });

  describe('delegate()', () => {
    it('registers a handler that fires on matching element click', () => {
      const delegator = new EventDelegator(root);
      const handler = jest.fn();

      delegator.delegate('click', '.dp-day', handler);

      const dayButton = root.querySelector('.dp-day') as HTMLElement;
      dayButton.click();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.any(Event), dayButton);

      delegator.destroy();
    });

    it('does not fire handler for non-matching elements', () => {
      const delegator = new EventDelegator(root);
      const handler = jest.fn();

      delegator.delegate('click', '.dp-day', handler);

      const navButton = root.querySelector('.dp-nav-prev') as HTMLElement;
      navButton.click();

      expect(handler).not.toHaveBeenCalled();

      delegator.destroy();
    });

    it('supports multiple handlers for different selectors', () => {
      const delegator = new EventDelegator(root);
      const dayHandler = jest.fn();
      const navHandler = jest.fn();

      delegator.delegate('click', '.dp-day', dayHandler);
      delegator.delegate('click', '.dp-nav-prev', navHandler);

      const dayButton = root.querySelector('.dp-day') as HTMLElement;
      dayButton.click();

      expect(dayHandler).toHaveBeenCalledTimes(1);
      expect(navHandler).not.toHaveBeenCalled();

      const navButton = root.querySelector('.dp-nav-prev') as HTMLElement;
      navButton.click();

      expect(navHandler).toHaveBeenCalledTimes(1);

      delegator.destroy();
    });

    it('does nothing when destroyed before delegating', () => {
      const delegator = new EventDelegator(root);
      delegator.destroy();

      const handler = jest.fn();
      delegator.delegate('click', '.dp-day', handler);

      const dayButton = root.querySelector('.dp-day') as HTMLElement;
      dayButton.click();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('event bubbling', () => {
    it('handles events on child elements that bubble to matching parent', () => {
      const delegator = new EventDelegator(root);
      const handler = jest.fn();

      delegator.delegate('click', '.dp-grid', handler);

      // Click on a child of .dp-grid
      const dayButton = root.querySelector('.dp-day') as HTMLElement;
      dayButton.click();

      expect(handler).toHaveBeenCalledTimes(1);
      // The matched element should be .dp-grid, not the button
      expect(handler.mock.calls[0][1].classList.contains('dp-grid')).toBe(true);

      delegator.destroy();
    });

    it('fires only the most specific (first matching) handler when event bubbles', () => {
      const delegator = new EventDelegator(root);
      const dayHandler = jest.fn();
      const gridHandler = jest.fn();

      delegator.delegate('click', '.dp-day', dayHandler);
      delegator.delegate('click', '.dp-grid', gridHandler);

      const dayButton = root.querySelector('.dp-day') as HTMLElement;
      dayButton.click();

      // Only the day handler fires; grid handler does not (prevents double-firing)
      expect(dayHandler).toHaveBeenCalledTimes(1);
      expect(gridHandler).toHaveBeenCalledTimes(0);

      delegator.destroy();
    });
  });

  describe('destroy()', () => {
    it('removes all event listeners', () => {
      const delegator = new EventDelegator(root);
      const handler = jest.fn();

      delegator.delegate('click', '.dp-day', handler);

      delegator.destroy();

      const dayButton = root.querySelector('.dp-day') as HTMLElement;
      dayButton.click();

      expect(handler).not.toHaveBeenCalled();
    });

    it('can be called multiple times safely', () => {
      const delegator = new EventDelegator(root);
      delegator.delegate('click', '.dp-day', jest.fn());

      delegator.destroy();
      expect(() => delegator.destroy()).not.toThrow();
    });
  });

  describe('off()', () => {
    it('removes handlers for a specific event type and selector', () => {
      const delegator = new EventDelegator(root);
      const dayHandler = jest.fn();
      const navHandler = jest.fn();

      delegator.delegate('click', '.dp-day', dayHandler);
      delegator.delegate('click', '.dp-nav-prev', navHandler);

      delegator.off('click', '.dp-day');

      const dayButton = root.querySelector('.dp-day') as HTMLElement;
      dayButton.click();
      expect(dayHandler).not.toHaveBeenCalled();

      const navButton = root.querySelector('.dp-nav-prev') as HTMLElement;
      navButton.click();
      expect(navHandler).toHaveBeenCalledTimes(1);

      delegator.destroy();
    });
  });

  describe('different event types', () => {
    it('supports keydown events', () => {
      const delegator = new EventDelegator(root);
      const handler = jest.fn();

      delegator.delegate('keydown', '.dp-day', handler);

      const dayButton = root.querySelector('.dp-day') as HTMLElement;
      const event = new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' });
      dayButton.dispatchEvent(event);

      expect(handler).toHaveBeenCalledTimes(1);

      delegator.destroy();
    });

    it('only fires handlers for the correct event type', () => {
      const delegator = new EventDelegator(root);
      const clickHandler = jest.fn();
      const keyHandler = jest.fn();

      delegator.delegate('click', '.dp-day', clickHandler);
      delegator.delegate('keydown', '.dp-day', keyHandler);

      const dayButton = root.querySelector('.dp-day') as HTMLElement;
      dayButton.click();

      expect(clickHandler).toHaveBeenCalledTimes(1);
      expect(keyHandler).not.toHaveBeenCalled();

      delegator.destroy();
    });
  });
});
