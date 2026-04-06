// ============================================================================
// async-validation.ts - Async date validation via a remote URL
// ============================================================================

import type { ValidationResult } from '../core/types';

/** Options for configuring the async validator */
export interface AsyncValidatorOptions {
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
}

/**
 * Validates dates asynchronously by calling a remote endpoint.
 *
 * Features:
 * - Debounces requests to avoid flooding the server
 * - Cancels in-flight requests when a new one is triggered
 * - Caches results keyed by ISO date string
 * - Shows/hides a loader element inside the input container
 */
export class AsyncValidator {
  private url: string;
  private inputEl: HTMLElement;
  private debounceMs: number;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private abortController: AbortController | null = null;
  private cache: Map<string, ValidationResult> = new Map();
  private loaderEl: HTMLElement | null = null;
  private destroyed: boolean = false;

  /**
   * @param url     - Remote endpoint URL. A `?date=YYYY-MM-DD` query parameter
   *                  will be appended for each validation request.
   * @param inputEl - The input wrapper element (used to host the loader spinner)
   * @param options - Optional configuration overrides
   */
  constructor(
    url: string,
    inputEl: HTMLElement,
    options: AsyncValidatorOptions = {},
  ) {
    this.url = url;
    this.inputEl = inputEl;
    this.debounceMs = options.debounceMs ?? 300;

    this.createLoader();
  }

  /**
   * Validates a date against the remote endpoint.
   *
   * Returns a cached result if available. Otherwise debounces, sends a
   * GET request, and returns the server's ValidationResult.
   *
   * @param date - The date to validate
   * @returns Promise resolving to a ValidationResult
   */
  validate(date: Date): Promise<ValidationResult> {
    if (this.destroyed) {
      return Promise.resolve({ valid: true });
    }

    const dateStr = toISODateString(date);

    // Return cached result if available
    const cached = this.cache.get(dateStr);
    if (cached) {
      return Promise.resolve(cached);
    }

    // Cancel any pending debounce timer
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Cancel any in-flight request
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    return new Promise<ValidationResult>((resolve) => {
      this.debounceTimer = setTimeout(() => {
        this.executeRequest(dateStr).then(resolve).catch(() => {
          // On network error, treat as valid (fail open)
          resolve({ valid: true });
        });
      }, this.debounceMs);
    });
  }

  /**
   * Clears the result cache. Useful after configuration changes.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Cancels any in-flight request, removes the loader, and cleans up.
   */
  destroy(): void {
    this.destroyed = true;

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.hideLoader();
    if (this.loaderEl && this.loaderEl.parentNode) {
      this.loaderEl.parentNode.removeChild(this.loaderEl);
    }
    this.loaderEl = null;

    this.cache.clear();
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Creates the loader spinner element and appends it to the input container.
   * The loader is hidden by default.
   */
  private createLoader(): void {
    this.loaderEl = document.createElement('span');
    this.loaderEl.className = 'dp-loader';
    this.loaderEl.setAttribute('aria-hidden', 'true');
    this.loaderEl.style.display = 'none';
    this.inputEl.appendChild(this.loaderEl);
  }

  /**
   * Shows the loader spinner.
   */
  private showLoader(): void {
    if (this.loaderEl) {
      this.loaderEl.style.display = '';
    }
  }

  /**
   * Hides the loader spinner.
   */
  private hideLoader(): void {
    if (this.loaderEl) {
      this.loaderEl.style.display = 'none';
    }
  }

  /**
   * Sends a GET request to the validation endpoint and processes the response.
   *
   * @param dateStr - ISO date string (YYYY-MM-DD)
   * @returns ValidationResult from the server
   */
  private async executeRequest(dateStr: string): Promise<ValidationResult> {
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    this.showLoader();

    try {
      const separator = this.url.includes('?') ? '&' : '?';
      const requestUrl = `${this.url}${separator}date=${encodeURIComponent(dateStr)}`;

      const response = await fetch(requestUrl, {
        method: 'GET',
        signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return { valid: true };
      }

      const data: ValidationResult = await response.json();

      // Normalize the response
      const result: ValidationResult = {
        valid: Boolean(data.valid),
        message: data.message ?? undefined,
      };

      // Cache the result
      this.cache.set(dateStr, result);

      return result;
    } catch (error: unknown) {
      // Aborted requests are not errors
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { valid: true };
      }
      // Network errors fail open
      return { valid: true };
    } finally {
      this.hideLoader();
      this.abortController = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a Date to an ISO date string (YYYY-MM-DD).
 */
function toISODateString(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
