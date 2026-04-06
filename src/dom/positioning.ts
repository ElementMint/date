// ============================================================================
// positioning.ts - Popup positioning relative to a trigger element
// ============================================================================

/** Minimum gap between popup and viewport edge (px) */
const VIEWPORT_MARGIN = 8;

/** Gap between trigger and popup (px) */
const TRIGGER_GAP = 4;

/** Tracks active positioning instances for cleanup */
interface PositionBinding {
  trigger: HTMLElement;
  popup: HTMLElement;
  scrollHandler: () => void;
  resizeHandler: () => void;
}

/** Registry of active bindings, keyed by popup element */
const activeBindings = new WeakMap<HTMLElement, PositionBinding>();

/**
 * Positions a calendar popup element relative to a trigger element.
 *
 * The popup is placed below the trigger by default. If there is not enough
 * viewport space below, it flips above. Horizontal position is aligned to
 * the trigger's leading edge, accounting for RTL layouts and viewport bounds.
 *
 * The popup must be inside a positioned ancestor (position: relative).
 * Coordinates are calculated relative to the offset parent, not the page.
 *
 * Automatically recalculates on window scroll and resize (throttled).
 * Call `removePositioning(popup)` to stop tracking.
 */
export function positionCalendar(
  trigger: HTMLElement,
  popup: HTMLElement,
): void {
  // Clean up any existing binding for this popup
  removePositioning(popup);

  // Ensure popup is absolutely positioned
  popup.style.position = 'absolute';

  // Perform initial positioning
  applyPosition(trigger, popup);

  // Set up throttled scroll and resize handlers
  let scrollTicking = false;
  const scrollHandler = (): void => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      applyPosition(trigger, popup);
      scrollTicking = false;
    });
  };

  let resizeTicking = false;
  const resizeHandler = (): void => {
    if (resizeTicking) return;
    resizeTicking = true;
    requestAnimationFrame(() => {
      applyPosition(trigger, popup);
      resizeTicking = false;
    });
  };

  window.addEventListener('scroll', scrollHandler, { passive: true, capture: true });
  window.addEventListener('resize', resizeHandler, { passive: true });

  activeBindings.set(popup, {
    trigger,
    popup,
    scrollHandler,
    resizeHandler,
  });
}

/**
 * Removes scroll/resize listeners associated with a positioned popup.
 */
export function removePositioning(popup: HTMLElement): void {
  const binding = activeBindings.get(popup);
  if (!binding) return;

  window.removeEventListener('scroll', binding.scrollHandler, { capture: true });
  window.removeEventListener('resize', binding.resizeHandler);
  activeBindings.delete(popup);
}

/**
 * Calculates and applies the popup position relative to the offset parent.
 */
function applyPosition(trigger: HTMLElement, popup: HTMLElement): void {
  const triggerRect = trigger.getBoundingClientRect();
  const popupHeight = popup.offsetHeight || popup.getBoundingClientRect().height;
  const popupWidth = popup.offsetWidth || popup.getBoundingClientRect().width;

  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  // Get the offset parent's rect to calculate relative position
  const offsetParent = popup.offsetParent as HTMLElement | null;
  const parentRect = offsetParent
    ? offsetParent.getBoundingClientRect()
    : { top: 0, left: 0 };

  // Determine vertical position: prefer below, flip above if needed
  const spaceBelow = viewportHeight - triggerRect.bottom;
  const spaceAbove = triggerRect.top;

  let top: number;
  if (spaceBelow >= popupHeight + TRIGGER_GAP + VIEWPORT_MARGIN || spaceBelow >= spaceAbove) {
    // Place below the trigger
    top = triggerRect.bottom - parentRect.top + TRIGGER_GAP;
    popup.setAttribute('data-placement', 'bottom');
  } else {
    // Place above the trigger
    top = triggerRect.top - parentRect.top - popupHeight - TRIGGER_GAP;
    popup.setAttribute('data-placement', 'top');
  }

  // Determine horizontal position relative to offset parent
  const isRTL = isRTLLayout(trigger);
  let left: number;

  if (isRTL) {
    // Align right edge of popup to right edge of trigger
    left = triggerRect.right - parentRect.left - popupWidth;
  } else {
    // Align left edge of popup to left edge of trigger
    left = triggerRect.left - parentRect.left;
  }

  // Clamp horizontal to viewport bounds (converted to parent-relative coords)
  const maxLeft = viewportWidth - parentRect.left - popupWidth - VIEWPORT_MARGIN;
  const minLeft = -parentRect.left + VIEWPORT_MARGIN;
  left = Math.max(minLeft, Math.min(maxLeft, left));

  // Clamp vertical to avoid going above viewport
  const minTop = -parentRect.top + VIEWPORT_MARGIN;
  top = Math.max(minTop, top);

  // Apply styles
  popup.style.top = `${Math.round(top)}px`;
  popup.style.left = `${Math.round(left)}px`;
}

/**
 * Detects if the element is in an RTL layout context.
 */
function isRTLLayout(element: HTMLElement): boolean {
  const dir = element.closest('[dir]')?.getAttribute('dir');
  if (dir === 'rtl') return true;
  if (dir === 'ltr') return false;

  const computed = window.getComputedStyle(element);
  return computed.direction === 'rtl';
}
