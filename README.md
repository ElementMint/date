# @elementmint/date

[![npm version](https://img.shields.io/npm/v/@elementmint/date)](https://www.npmjs.com/package/@elementmint/date)
[![CI](https://github.com/ElementMint/date/actions/workflows/ci.yml/badge.svg)](https://github.com/ElementMint/date/actions/workflows/ci.yml)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@elementmint/date)](https://bundlephobia.com/package/@elementmint/date)
[![license](https://img.shields.io/npm/l/@elementmint/date)](https://github.com/ElementMint/date/blob/main/LICENSE)

A lightweight (**<10 KB** gzipped), dependency-free, attribute-driven date picker for the web. Drop in a script tag, add `data-datepicker` to an input, and you're done -- no configuration required.

## Features

- **Auto-init** -- just add `data-datepicker` to any `<input>` and the picker initializes itself
- **Segment editing** -- type directly into day, month, and year segments with arrow-key navigation
- **Dual format** -- separate display format (`DD/MM/YYYY`) from the submitted value (`ISO`, `epoch`, or `unix`)
- **Validation** -- built-in required, min/max range, and custom rules (`weekday`, `future`, `past`); async validation via URL
- **Accessibility** -- full ARIA attributes, focus trapping, screen-reader announcements, keyboard navigation
- **Internationalization** -- locale-aware month and day names powered by `Intl.DateTimeFormat`
- **Theming** -- light, dark, and system-preference themes via CSS custom properties
- **Zero dependencies** -- no runtime dependencies, ever

## Quick Start

### CDN

The fastest way to get started. Include the script and stylesheet, then add `data-datepicker` to an input:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@elementmint/date/dist/date.min.css">
<script src="https://cdn.jsdelivr.net/npm/@elementmint/date/dist/iife/date.min.js"></script>

<input type="text" data-datepicker>
```

That's it. The picker auto-initializes on `DOMContentLoaded`.

### NPM

```bash
npm install @elementmint/date
```

```js
import { initAll } from '@elementmint/date';
import '@elementmint/date/css';

// Initialize all [data-datepicker] elements on the page
initAll();
```

Or create instances manually:

```js
import { DatePicker } from '@elementmint/date';
import '@elementmint/date/css';

const picker = new DatePicker(document.getElementById('my-input'));
```

## HTML Attributes

All configuration is driven by `data-*` attributes on the input element (or its parent container).

| Attribute | Default | Description |
| --- | --- | --- |
| `data-datepicker` | -- | **Required.** Marks the element for auto-initialization. |
| `data-format` | `YYYY-MM-DD` | Display format string. Tokens: `DD`, `MM`, `YYYY`. |
| `data-min` | -- | Minimum selectable date (ISO string, e.g. `2026-01-01`). |
| `data-max` | -- | Maximum selectable date (ISO string, e.g. `2026-12-31`). |
| `data-value` | -- | Initial date value (ISO string). |
| `data-value-type` | `iso` | Output format for the submitted value: `iso`, `epoch`, or `unix`. |
| `data-locale` | `en` | BCP 47 locale tag for month/day names (e.g. `de-DE`, `fr-FR`, `ja`). |
| `data-week-start` | `1` | First day of the week: `0` = Sunday, `1` = Monday, ... `6` = Saturday. |
| `data-theme` | `system` | Visual theme: `light`, `dark`, or `system` (follows OS preference). |
| `data-placeholder` | -- | Placeholder text shown when the input is empty. |
| `data-required` | `false` | Whether a date value is required for form validation. |
| `data-disabled-dates` | -- | Comma-separated ISO date strings to disable (e.g. `2026-12-25,2026-01-01`). |
| `data-validate` | -- | Comma-separated validation rules: `weekday`, `future`, `past`. |
| `data-validate-url` | -- | URL for async server-side validation (receives a POST with the date). |
| `data-disabled` | `false` | Disables the date picker entirely. |
| `data-read-only` | `false` | Makes the input read-only (calendar still opens but value cannot change). |
| `data-name` | -- | Name attribute for the hidden form input used in submission. |
| `data-close-on-select` | `true` | Whether the calendar closes automatically after selecting a date. |
| `data-show-today` | `true` | Show the "Today" button in the calendar footer. |
| `data-show-clear` | `true` | Show the "Clear" button in the calendar footer. |
| `data-keyboard` | `true` | Enable keyboard navigation within the calendar. |
| `data-class-name` | -- | Custom CSS class(es) added to the picker wrapper element. |
| `data-position` | `auto` | Calendar popup position: `bottom`, `top`, or `auto`. |

## Examples

### Basic Date Picker

```html
<input type="text" data-datepicker>
```

### Min and Max Range

```html
<input type="text" data-datepicker
       data-min="2026-01-01"
       data-max="2026-12-31">
```

### Custom Display Format

```html
<input type="text" data-datepicker
       data-format="DD/MM/YYYY">
```

### Dark Theme

```html
<input type="text" data-datepicker
       data-theme="dark">
```

### Locale

```html
<input type="text" data-datepicker
       data-locale="de-DE"
       data-format="DD.MM.YYYY">
```

### Required with Validation

```html
<input type="text" data-datepicker
       data-required
       data-min="2026-01-01"
       data-placeholder="Select a date">
```

### Custom Validation Rules

```html
<!-- Weekdays only -->
<input type="text" data-datepicker
       data-validate="weekday">

<!-- Future dates only -->
<input type="text" data-datepicker
       data-validate="future">
```

### Async Server-Side Validation

```html
<input type="text" data-datepicker
       data-validate-url="/api/check-availability">
```

### Disabled Specific Dates

```html
<input type="text" data-datepicker
       data-disabled-dates="2026-12-25,2026-12-26,2026-01-01">
```

## JavaScript API

When using the IIFE bundle, the API is available on `window.DatePicker`. When using ES modules, import directly from the package.

### `DatePicker` (class)

```js
const el = document.querySelector('#my-input');
const picker = new DatePicker(el);

// Open / close the calendar
picker.open();
picker.close();

// Get and set the value
picker.getValue();          // Returns the value string (ISO/epoch/unix) or null
picker.setValue('2026-06-15'); // Set by ISO string
picker.setValue(new Date());   // Set by Date object

// Get and set the Date object
picker.getDate();           // Returns a Date or null
picker.setDate(new Date(2026, 5, 15));

// Tear down completely
picker.destroy();
```

### `initAll()` / `destroyAll()`

```js
import { initAll, destroyAll, getInstance } from '@elementmint/date';

// Initialize all [data-datepicker] elements
initAll();

// Get a specific instance
const picker = getInstance(document.getElementById('my-input'));

// Destroy all instances
destroyAll();
```

### Events

The date picker dispatches custom events on the input element:

| Event | Detail | Description |
| --- | --- | --- |
| `datepicker:change` | `{ value: string, date: Date }` | Fired when the selected date changes. |
| `datepicker:open` | -- | Fired when the calendar opens. |
| `datepicker:close` | -- | Fired when the calendar closes. |

```js
document.querySelector('#my-input').addEventListener('datepicker:change', (e) => {
  console.log('Selected:', e.detail.value, e.detail.date);
});
```

## Web Component

The `<date-picker>` custom element is automatically registered when using the IIFE bundle. With ES modules, call `defineElement()` first:

```js
import { defineElement } from '@elementmint/date';
defineElement();
```

```html
<date-picker data-format="DD/MM/YYYY" data-required></date-picker>
```

The element creates an `<input>` internally and supports the same `data-*` attributes. It also exposes `open()`, `close()`, `getValue()`, `setValue()`, `getDate()`, and `setDate()` methods directly on the DOM element.

## Framework Adapters

### React

```jsx
import React, { useState } from 'react';
import { createReactDatePicker } from '@elementmint/date/adapters/react';
import '@elementmint/date/css';

const DatePickerInput = createReactDatePicker(React);

function App() {
  const [value, setValue] = useState('');

  return (
    <DatePickerInput
      value={value}
      onChange={(v) => setValue(v)}
      format="DD/MM/YYYY"
      theme="system"
      placeholder="Pick a date"
    />
  );
}
```

### Vue

```vue
<script setup>
import { ref } from 'vue';
import { defineComponent, h, ref as vRef, onMounted, onBeforeUnmount, watch } from 'vue';
import { createVueDatePicker } from '@elementmint/date/adapters/vue';
import '@elementmint/date/css';

const DatePickerInput = createVueDatePicker({
  defineComponent, h, ref: vRef, onMounted, onBeforeUnmount, watch,
});

const date = ref('');
</script>

<template>
  <DatePickerInput v-model="date" format="DD/MM/YYYY" />
</template>
```

### Angular

```typescript
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { createAngularDatePicker } from '@elementmint/date/adapters/angular';

const { componentClass, metadata } = createAngularDatePicker({
  Component, Input, Output, EventEmitter,
});

@Component({
  selector: 'app-datepicker',
  template: `<input #inputEl type="text" data-datepicker />`,
})
export class DatePickerComponent extends componentClass {
  // Inherits all inputs, outputs, and lifecycle hooks
}
```

```html
<app-datepicker
  [value]="dateValue"
  [format]="'DD/MM/YYYY'"
  [theme]="'dark'"
  (dateChange)="onDateChange($event)">
</app-datepicker>
```

## Theming

The date picker is styled entirely with CSS custom properties. Override them to match your design system:

```css
:root {
  /* Colors */
  --dp-primary: #3b82f6;
  --dp-primary-hover: #2563eb;
  --dp-bg: #ffffff;
  --dp-surface: #ffffff;
  --dp-border: #e2e8f0;
  --dp-text: #1e293b;
  --dp-text-muted: #94a3b8;
  --dp-text-disabled: #cbd5e1;
  --dp-error: #ef4444;
  --dp-success: #22c55e;

  /* Layout */
  --dp-radius: 8px;
  --dp-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  --dp-day-size: 36px;

  /* Typography */
  --dp-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, sans-serif;
  --dp-font-size: 14px;

  /* Motion */
  --dp-transition-speed: 150ms;
}
```

Use the `data-theme` attribute (or the `--dp-*` variables directly) to switch between light and dark modes. The `system` theme automatically follows the user's OS preference via `prefers-color-scheme`.

## Browser Support

| Browser | Version |
|---|---|
| Chrome | 80+ |
| Firefox | 78+ |
| Safari | 14+ |
| Edge | 80+ |
| iOS Safari | 14+ |
| Chrome Android | 80+ |

The library uses `Intl.DateTimeFormat` for locale support and `customElements.define` for the Web Component. Both are widely supported in the listed browsers.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, coding standards, and the pull request process.

## License

[MIT](./LICENSE) -- Copyright (c) 2026 ElementMint
