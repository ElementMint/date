// ============================================================================
// plugins/index.ts - Plugin system for extending DatePicker
// ============================================================================

import type { DatePicker } from '../datepicker';

/**
 * Interface that all DatePicker plugins must implement.
 *
 * Plugins are a way to extend the picker's behaviour without modifying
 * the core code. They are registered globally and can be looked up by name.
 *
 * @example
 * ```ts
 * const highlightPlugin: DatePickerPlugin = {
 *   name: 'highlight-holidays',
 *   init(picker) {
 *     // Add custom behaviour when the picker initializes
 *   },
 *   destroy() {
 *     // Clean up when the picker is destroyed
 *   },
 * };
 *
 * registerPlugin(highlightPlugin);
 * ```
 */
export interface DatePickerPlugin {
  /** Unique plugin name used for lookup. */
  name: string;

  /**
   * Called when the plugin is applied to a DatePicker instance.
   *
   * @param picker - The DatePicker instance to extend
   */
  init(picker: DatePicker): void;

  /**
   * Called when the plugin should clean up (e.g., when the picker is
   * destroyed). Must remove any event listeners, DOM nodes, or other
   * resources created in `init()`.
   */
  destroy(): void;
}

/** Global registry of plugins, keyed by name. */
const registry = new Map<string, DatePickerPlugin>();

/**
 * Registers a plugin in the global registry.
 *
 * If a plugin with the same name already exists, it is replaced.
 *
 * @param plugin - The plugin to register
 */
export function registerPlugin(plugin: DatePickerPlugin): void {
  if (!plugin || !plugin.name) {
    throw new Error('DatePicker plugin must have a "name" property.');
  }
  registry.set(plugin.name, plugin);
}

/**
 * Retrieves a registered plugin by name.
 *
 * @param name - The plugin name to look up
 * @returns The plugin, or undefined if not found
 */
export function getPlugin(name: string): DatePickerPlugin | undefined {
  return registry.get(name);
}

/**
 * Removes a plugin from the global registry.
 *
 * @param name - The plugin name to remove
 * @returns True if a plugin was removed, false if it wasn't found
 */
export function removePlugin(name: string): boolean {
  return registry.delete(name);
}

/**
 * Returns all registered plugin names.
 */
export function getPluginNames(): string[] {
  return Array.from(registry.keys());
}

/**
 * Applies all registered plugins (or a specific list) to a DatePicker instance.
 * Typically called internally by DatePicker during initialization.
 *
 * @param picker      - The DatePicker instance
 * @param pluginNames - Optional list of plugin names to apply.
 *                      If omitted, all registered plugins are applied.
 * @returns Array of applied plugins (for later cleanup)
 */
export function applyPlugins(
  picker: DatePicker,
  pluginNames?: string[],
): DatePickerPlugin[] {
  const applied: DatePickerPlugin[] = [];
  const names = pluginNames ?? Array.from(registry.keys());

  for (const name of names) {
    const plugin = registry.get(name);
    if (plugin) {
      plugin.init(picker);
      applied.push(plugin);
    }
  }

  return applied;
}

/**
 * Destroys a list of plugins (calls `destroy()` on each).
 *
 * @param plugins - Array of plugin instances to destroy
 */
export function destroyPlugins(plugins: DatePickerPlugin[]): void {
  for (const plugin of plugins) {
    plugin.destroy();
  }
}
