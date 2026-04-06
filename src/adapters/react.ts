// ============================================================================
// react.ts - React adapter for DatePicker (no JSX, uses createElement)
// ============================================================================

import { DatePicker } from '../datepicker';

/** Props for the React DatePicker component. */
export interface DatePickerProps {
  value?: string;
  onChange?: (value: string, date: Date | null) => void;
  format?: string;
  formatDisplay?: string;
  min?: string;
  max?: string;
  locale?: string;
  theme?: 'light' | 'dark' | 'system';
  weekStart?: number;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  [key: string]: unknown;
}

/** Attribute-prop mapping for data attributes. */
const DATA_ATTR_MAP: Record<string, string> = {
  format: 'data-format',
  formatDisplay: 'data-format-display',
  min: 'data-min',
  max: 'data-max',
  locale: 'data-locale',
  theme: 'data-theme',
  weekStart: 'data-week-start',
  placeholder: 'data-placeholder',
};

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Minimal React-like interface to avoid importing React types. */
interface ReactLike {
  createElement: (...args: any[]) => any;
  useRef: (init: any) => { current: any };
  useEffect: (fn: () => any, deps?: any[]) => void;
  useCallback: (fn: any, deps: any[]) => any;
  forwardRef: (render: any) => any;
  [key: string]: any;
}

// Known props that should NOT be spread onto the DOM element
const KNOWN_PROPS = new Set([
  'value', 'onChange', 'format', 'formatDisplay', 'min', 'max',
  'locale', 'theme', 'weekStart', 'disabled', 'required', 'placeholder',
  'className', 'id', 'name',
]);

/**
 * Factory function that creates a React DatePicker component.
 *
 * Takes the React library as a parameter to avoid a hard dependency,
 * keeping the adapter tree-shakable and compatible with any React version.
 *
 * @example
 * ```ts
 * import React from 'react';
 * import { createReactDatePicker } from '@elementmint/date/adapters/react';
 *
 * const DatePickerInput = createReactDatePicker(React);
 *
 * function App() {
 *   const [value, setValue] = React.useState('');
 *   return React.createElement(DatePickerInput, {
 *     value,
 *     onChange: (v) => setValue(v),
 *     format: 'DD/MM/YYYY',
 *   });
 * }
 * ```
 */
export function createReactDatePicker(
  React: ReactLike,
): any {
  const { createElement, useRef, useEffect, useCallback, forwardRef } = React;

  const ReactDatePicker = forwardRef(function ReactDatePicker(
    props: DatePickerProps,
    externalRef: any,
  ) {
    const {
      value,
      onChange,
      format,
      formatDisplay,
      min,
      max,
      locale,
      theme,
      weekStart,
      disabled,
      required,
      placeholder,
      className,
      id,
      name,
    } = props;

    // Collect unknown props to spread
    const restProps: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      if (!KNOWN_PROPS.has(key)) {
        restProps[key] = props[key];
      }
    }

    const inputRef = useRef(null as HTMLInputElement | null);
    const pickerRef = useRef(null as DatePicker | null);
    const onChangeRef = useRef(onChange);

    // Keep the onChange ref current without triggering effects
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    // Sync data-* attributes onto the input element
    useEffect(() => {
      const el = inputRef.current;
      if (!el) return;

      const attrProps: Record<string, any> = {
        format,
        formatDisplay,
        min,
        max,
        locale,
        theme,
        weekStart,
      };

      for (const [prop, attr] of Object.entries(DATA_ATTR_MAP)) {
        const val = attrProps[prop];
        if (val != null) {
          el.setAttribute(attr, String(val));
        } else {
          el.removeAttribute(attr);
        }
      }
    }, [format, formatDisplay, min, max, locale, theme, weekStart]);

    // Initialize and destroy the DatePicker instance
    useEffect(() => {
      const el = inputRef.current;
      if (!el) return;

      const picker = new DatePicker(el);
      pickerRef.current = picker;

      // Set initial value if provided
      if (value) {
        picker.setValue(value);
      }

      // Listen for change events dispatched by the DatePicker
      const handleChange = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (onChangeRef.current) {
          onChangeRef.current(detail?.value ?? '', detail?.date ?? null);
        }
      };

      el.addEventListener('datepicker:change', handleChange);

      return () => {
        el.removeEventListener('datepicker:change', handleChange);
        picker.destroy();
        pickerRef.current = null;
      };
    }, []);

    // Sync the controlled value prop
    useEffect(() => {
      if (pickerRef.current && value != null) {
        const currentValue = pickerRef.current.getValue();
        if (currentValue !== value) {
          pickerRef.current.setValue(value);
        }
      }
    }, [value]);

    // Merge refs so consumers can also get a ref to the input
    const setRef = useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof externalRef === 'function') {
          externalRef(node);
        } else if (externalRef) {
          externalRef.current = node;
        }
      },
      [externalRef],
    );

    return createElement('input', {
      ...restProps,
      ref: setRef,
      type: 'text',
      'data-datepicker': '',
      disabled: disabled ?? undefined,
      required: required ?? undefined,
      placeholder: placeholder ?? undefined,
      className: className ?? undefined,
      id: id ?? undefined,
      name: name ?? undefined,
    });
  });

  ReactDatePicker.displayName = 'DatePicker';

  return ReactDatePicker;
}
