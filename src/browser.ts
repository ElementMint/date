// ============================================================================
// browser.ts - IIFE / CDN entry point for @elementmints/date
// ============================================================================
//
// This file is intended to be the entry point for a UMD/IIFE bundle that
// runs when included via a <script> tag. It:
//   1. Exposes the DatePicker class and utilities on `window.DatePicker`
//   2. Registers the <date-picker> custom element
//   3. Auto-initializes all [data-datepicker] elements on DOMContentLoaded
// ============================================================================

import { DatePicker } from './datepicker';
import { initAll, destroyAll, getInstance } from './auto-init/index';
import { DatePickerElement, defineElement } from './wrapper/web-component';
import { registerPlugin, getPlugin } from './plugins/index';
import { parseDate, parseISO, parsePaste } from './core/parser';
import { formatDate, formatForValue } from './core/formatter';
import { generateMonth } from './core/calendar';
import { parseConfig, DEFAULT_CONFIG } from './core/config';

import type { DatePickerPlugin } from './plugins/index';

// ---------------------------------------------------------------------------
// Build the public namespace
// ---------------------------------------------------------------------------

const DatePickerLib = {
  DatePicker,
  DatePickerElement,
  initAll,
  destroyAll,
  getInstance,
  defineElement,
  registerPlugin,
  getPlugin,
  parseDate,
  parseISO,
  parsePaste,
  formatDate,
  formatForValue,
  generateMonth,
  parseConfig,
  DEFAULT_CONFIG,
} as const;

// ---------------------------------------------------------------------------
// Expose on window
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    DatePicker: typeof DatePickerLib;
  }
}

if (typeof window !== 'undefined') {
  window.DatePicker = DatePickerLib;
}

// ---------------------------------------------------------------------------
// Auto-init on DOMContentLoaded
// ---------------------------------------------------------------------------

function autoInit(): void {
  defineElement();
  initAll();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit, { once: true });
  } else {
    // DOM is already ready (script loaded with defer or at end of body)
    autoInit();
  }
}

// ---------------------------------------------------------------------------
// Export for bundlers that consume this entry point as ESM
// ---------------------------------------------------------------------------

export {
  DatePicker,
  DatePickerElement,
  initAll,
  destroyAll,
  getInstance,
  defineElement,
  registerPlugin,
  getPlugin,
  parseDate,
  parseISO,
  parsePaste,
  formatDate,
  formatForValue,
  generateMonth,
  parseConfig,
  DEFAULT_CONFIG,
};

export type { DatePickerPlugin };
