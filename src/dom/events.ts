// ============================================================================
// events.ts - Event delegation system for the calendar
// ============================================================================

/** Supported delegated event types */
type DelegatedEventType = 'click' | 'keydown' | 'focusin' | 'focusout';

/** A delegated event handler function */
type DelegatedHandler<E extends Event = Event> = (
  event: E,
  matchedElement: HTMLElement,
) => void;

/** Internal registration for a single delegated handler */
interface DelegatedRegistration {
  eventType: DelegatedEventType;
  selector: string;
  handler: DelegatedHandler;
}

/**
 * EventDelegator provides efficient event delegation on a root element.
 *
 * Instead of attaching listeners to every interactive element in the calendar,
 * a single listener per event type is attached to the root. When an event fires,
 * the target is checked against registered CSS selectors and matching handlers
 * are called.
 *
 * This reduces memory usage and avoids re-binding when the DOM is updated.
 *
 * @example
 * ```ts
 * const delegator = new EventDelegator(calendarRoot);
 *
 * delegator.delegate('click', '.dp-day', (event, el) => {
 *   const date = el.getAttribute('data-date');
 *   // handle date selection
 * });
 *
 * delegator.delegate('click', '.dp-nav-prev', (event, el) => {
 *   // navigate to previous month
 * });
 *
 * // Later, to clean up:
 * delegator.destroy();
 * ```
 */
export class EventDelegator {
  private root: HTMLElement;
  private registrations: DelegatedRegistration[] = [];
  private rootListeners: Map<DelegatedEventType, (e: Event) => void> = new Map();
  private destroyed: boolean = false;

  /**
   * @param root - The root element to attach delegated listeners to.
   *               Typically the `.dp-calendar` container.
   */
  constructor(root: HTMLElement) {
    this.root = root;
  }

  /**
   * Registers a delegated event handler.
   *
   * When an event of the specified type fires within the root element,
   * the handler is called if the event target (or any ancestor up to
   * the root) matches the CSS selector.
   *
   * @param eventType - The DOM event type to listen for
   * @param selector  - CSS selector to match against the event target
   * @param handler   - Callback invoked with (event, matchedElement)
   */
  delegate<E extends Event = Event>(
    eventType: DelegatedEventType,
    selector: string,
    handler: DelegatedHandler<E>,
  ): void {
    if (this.destroyed) return;

    this.registrations.push({
      eventType,
      selector,
      handler: handler as DelegatedHandler,
    });

    // Ensure a root listener exists for this event type
    this.ensureRootListener(eventType);
  }

  /**
   * Removes all delegated handlers and detaches root listeners.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    for (const [eventType, listener] of this.rootListeners) {
      this.root.removeEventListener(eventType, listener);
    }

    this.rootListeners.clear();
    this.registrations.length = 0;
  }

  /**
   * Removes all handlers matching a specific event type and selector.
   *
   * @param eventType - The event type to match
   * @param selector  - The CSS selector to match
   */
  off(eventType: DelegatedEventType, selector: string): void {
    this.registrations = this.registrations.filter(
      (reg) => !(reg.eventType === eventType && reg.selector === selector),
    );
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Ensures exactly one root-level listener exists for the given event type.
   */
  private ensureRootListener(eventType: DelegatedEventType): void {
    if (this.rootListeners.has(eventType)) return;

    const listener = (event: Event): void => {
      this.handleEvent(eventType, event);
    };

    // Use capture for focus events to ensure we catch them before they bubble
    const useCapture = eventType === 'focusin' || eventType === 'focusout';
    this.root.addEventListener(eventType, listener, useCapture);
    this.rootListeners.set(eventType, listener);
  }

  /**
   * Master event handler that dispatches to matching delegated handlers.
   */
  private handleEvent(eventType: DelegatedEventType, event: Event): void {
    let target = event.target as Element | null;

    // SVG elements (path, svg, etc.) are not HTMLElement instances.
    // Walk up to the nearest HTMLElement so .matches() works.
    while (target && !(target instanceof HTMLElement)) {
      target = target.parentElement;
    }
    if (!target) return;

    // Find registrations for this event type
    const matchingRegs = this.registrations.filter(
      (reg) => reg.eventType === eventType,
    );

    if (matchingRegs.length === 0) return;

    // Walk up from the target to the root, checking selectors
    let current: HTMLElement | null = target as HTMLElement;

    while (current && current !== this.root.parentElement) {
      for (const reg of matchingRegs) {
        if (current.matches(reg.selector)) {
          reg.handler(event, current);
          return; // Stop after first match to prevent double-firing
        }
      }

      // Stop at the root element
      if (current === this.root) break;
      current = current.parentElement;
    }
  }
}
