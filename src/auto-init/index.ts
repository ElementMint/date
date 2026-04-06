// ============================================================================
// auto-init/index.ts - Automatic DatePicker initialization and DOM watching
// ============================================================================

import { DatePicker } from '../datepicker';

/** Selector for elements that should be enhanced with a DatePicker */
const SELECTOR = '[data-datepicker]';

/** WeakMap of element -> DatePicker instance for tracking */
const instances = new WeakMap<HTMLElement, DatePicker>();

/** MutationObserver watching for new datepicker elements in the DOM */
let observer: MutationObserver | null = null;

/**
 * Initializes DatePicker instances on all matching elements in the document.
 * Newly added elements are automatically picked up via a MutationObserver
 * on `document.body`.
 *
 * Elements that already have a DatePicker instance are skipped.
 *
 * @returns Array of newly created DatePicker instances
 */
export function initAll(): DatePicker[] {
  const created: DatePicker[] = [];

  const elements = document.querySelectorAll<HTMLElement>(SELECTOR);
  for (const el of elements) {
    if (!instances.has(el)) {
      const picker = new DatePicker(el);
      instances.set(el, picker);
      created.push(picker);
    }
  }

  // Set up the mutation observer if it hasn't been created yet
  if (!observer) {
    startObserver();
  }

  return created;
}

/**
 * Destroys all tracked DatePicker instances and disconnects the
 * MutationObserver. After calling this, no automatic initialization
 * will occur until `initAll()` is called again.
 */
export function destroyAll(): void {
  // Stop watching for new elements
  if (observer) {
    observer.disconnect();
    observer = null;
  }

  // Destroy all tracked instances.
  // We query the DOM again because WeakMap does not support iteration.
  const elements = document.querySelectorAll<HTMLElement>(SELECTOR);
  for (const el of elements) {
    const picker = instances.get(el);
    if (picker) {
      picker.destroy();
      instances.delete(el);
    }
  }
}

/**
 * Returns the DatePicker instance associated with an element, if any.
 *
 * @param element - The element to look up
 * @returns The DatePicker instance, or undefined
 */
export function getInstance(element: HTMLElement): DatePicker | undefined {
  return instances.get(element);
}

// =============================================================================
// MutationObserver
// =============================================================================

/**
 * Starts a MutationObserver on document.body that watches for new elements
 * with the [data-datepicker] attribute being added to the DOM.
 */
function startObserver(): void {
  if (typeof MutationObserver === 'undefined') return;

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;

      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;

        // Check the node itself
        if (node.matches(SELECTOR) && !instances.has(node)) {
          const picker = new DatePicker(node);
          instances.set(node, picker);
        }

        // Check descendants
        const descendants = node.querySelectorAll<HTMLElement>(SELECTOR);
        for (const el of descendants) {
          if (!instances.has(el)) {
            const picker = new DatePicker(el);
            instances.set(el, picker);
          }
        }
      }

      // Clean up removed nodes
      for (const node of mutation.removedNodes) {
        if (!(node instanceof HTMLElement)) continue;

        if (node.matches(SELECTOR)) {
          destroyInstance(node);
        }

        const descendants = node.querySelectorAll<HTMLElement>(SELECTOR);
        for (const el of descendants) {
          destroyInstance(el);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/**
 * Destroys and removes a single tracked instance.
 */
function destroyInstance(element: HTMLElement): void {
  const picker = instances.get(element);
  if (picker) {
    picker.destroy();
    instances.delete(element);
  }
}
