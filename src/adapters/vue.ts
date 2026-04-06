// ============================================================================
// vue.ts - Vue 3 adapter for DatePicker
// ============================================================================

import { DatePicker } from '../datepicker';

/** Props accepted by the Vue DatePicker component. */
export interface VueDatePickerProps {
  /** Current value in ISO format (v-model via modelValue). */
  modelValue?: string;
  /** Date format string, e.g. "DD/MM/YYYY". */
  format?: string;
  /** Display format (if different from value format). */
  formatDisplay?: string;
  /** Minimum selectable date (ISO string). */
  min?: string;
  /** Maximum selectable date (ISO string). */
  max?: string;
  /** Locale for month/day names. */
  locale?: string;
  /** Visual theme. */
  theme?: 'light' | 'dark' | 'system';
  /** First day of the week (0=Sun, 1=Mon, etc.). */
  weekStart?: number;
  /** Whether the picker is disabled. */
  disabled?: boolean;
  /** Whether a value is required. */
  required?: boolean;
  /** Placeholder text. */
  placeholder?: string;
}

/** Emits for the Vue DatePicker component. */
export interface VueDatePickerEmits {
  (e: 'update:modelValue', value: string): void;
  (e: 'change', value: string, date: Date | null): void;
}

/** Vue composition API subset needed by this adapter. */
export interface VueApi {
  defineComponent: any;
  h: any;
  ref: any;
  onMounted: any;
  onBeforeUnmount: any;
  watch: any;
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
};

/**
 * Factory function that creates a Vue 3 DatePicker component.
 *
 * Takes the Vue composition API functions as a parameter to avoid a hard
 * dependency, keeping the adapter tree-shakable.
 *
 * @example
 * ```ts
 * import { defineComponent, h, ref, onMounted, onBeforeUnmount, watch } from 'vue';
 * import { createVueDatePicker } from '@aspect/date/adapters/vue';
 *
 * const DatePickerInput = createVueDatePicker({
 *   defineComponent, h, ref, onMounted, onBeforeUnmount, watch,
 * });
 *
 * // In a template: <DatePickerInput v-model="date" format="DD/MM/YYYY" />
 * ```
 */
export function createVueDatePicker(vue: VueApi) {
  const { defineComponent, h, ref, onMounted, onBeforeUnmount, watch } = vue;

  return defineComponent({
    name: 'DatePicker',

    props: {
      modelValue: { type: String, default: undefined },
      format: { type: String, default: undefined },
      formatDisplay: { type: String, default: undefined },
      min: { type: String, default: undefined },
      max: { type: String, default: undefined },
      locale: { type: String, default: undefined },
      theme: { type: String as () => 'light' | 'dark' | 'system', default: undefined },
      weekStart: { type: Number, default: undefined },
      disabled: { type: Boolean, default: undefined },
      required: { type: Boolean, default: undefined },
      placeholder: { type: String, default: undefined },
    },

    emits: ['update:modelValue', 'change'],

    setup(props: VueDatePickerProps, { emit }: { emit: any }) {
      const inputRef = ref(null as HTMLInputElement | null);
      const pickerInstance = ref(null as DatePicker | null);

      /** Apply data-* attributes from props onto the input element. */
      function syncDataAttributes() {
        const el = inputRef.value;
        if (!el) return;

        for (const [prop, attr] of Object.entries(DATA_ATTR_MAP)) {
          const val = (props as any)[prop];
          if (val != null) {
            el.setAttribute(attr, String(val));
          } else {
            el.removeAttribute(attr);
          }
        }
      }

      /** Handle the datepicker:change custom event. */
      function handleChange(e: Event) {
        const detail = (e as CustomEvent).detail;
        const value: string = detail?.value ?? '';
        const date: Date | null = detail?.date ?? null;

        emit('update:modelValue', value);
        emit('change', value, date);
      }

      onMounted(() => {
        const el = inputRef.value;
        if (!el) return;

        // Set data attributes before constructing
        syncDataAttributes();

        const picker = new DatePicker(el);
        pickerInstance.value = picker;

        // Set initial value
        if (props.modelValue) {
          picker.setValue(props.modelValue);
        }

        el.addEventListener('datepicker:change', handleChange);
      });

      onBeforeUnmount(() => {
        const el = inputRef.value;
        if (el) {
          el.removeEventListener('datepicker:change', handleChange);
        }
        pickerInstance.value?.destroy();
        pickerInstance.value = null;
      });

      // Watch the modelValue for external changes
      watch(
        () => props.modelValue,
        (newVal: string | undefined) => {
          const picker = pickerInstance.value;
          if (!picker) return;
          if (newVal != null) {
            const current = picker.getValue();
            if (current !== newVal) {
              picker.setValue(newVal);
            }
          }
        },
      );

      // Watch config-related props and re-sync data attributes
      watch(
        () => [
          props.format,
          props.formatDisplay,
          props.min,
          props.max,
          props.locale,
          props.theme,
          props.weekStart,
        ],
        () => {
          syncDataAttributes();
        },
      );

      return () =>
        h('input', {
          ref: inputRef,
          type: 'text',
          'data-datepicker': '',
          disabled: props.disabled ?? undefined,
          required: props.required ?? undefined,
          placeholder: props.placeholder ?? undefined,
        });
    },
  });
}
