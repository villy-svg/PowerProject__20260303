// _shared/utils/retry.ts
// Generic exponential-backoff retry wrapper.
// Retryable error = network/5xx. Non-retryable = 4xx auth/not-found.

export interface RetryOptions {
  maxAttempts: number;   // Total attempts (first try + retries). Recommended: 3
  baseDelayMs: number;   // Delay before attempt 2. Doubles each time. Recommended: 500
  maxDelayMs: number;    // Cap on delay. Recommended: 8000
  jitter: boolean;       // Add ±20% random jitter to avoid thundering herd. Recommended: true
  label?: string;        // Human-readable label for logging
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 8000,
  jitter: true,
};

/**
 * Determines if an error is worth retrying.
 * DO NOT retry on credential errors (401/403) or not-found (404) —
 * these will never succeed on retry.
 */
function isRetryable(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  // Retry if: network timeout, 429 rate-limit, 5xx server error
  if (msg.includes("timeout") || msg.includes("network") || msg.includes("fetch")) return true;
  if (msg.includes("429") || msg.includes("rate limit") || msg.includes("too many")) return true;
  if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("504")) return true;
  // Do NOT retry on auth or client errors
  if (msg.includes("401") || msg.includes("403") || msg.includes("404")) return false;
  // Default: retry unknown errors (conservative — better to retry than lose data)
  return true;
}

/**
 * Runs `fn` up to `options.maxAttempts` times with exponential backoff.
 * Throws the last error if all attempts fail.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const label = opts.label ? `[${opts.label}] ` : "";

      if (attempt === opts.maxAttempts) {
        console.error(`${label}All ${opts.maxAttempts} attempts failed. Final error:`, String(err));
        break;
      }

      if (!isRetryable(err)) {
        console.error(`${label}Non-retryable error on attempt ${attempt}:`, String(err));
        break; // No point retrying auth/404 errors
      }

      // Exponential backoff: 500ms → 1000ms → 2000ms → (capped at maxDelayMs)
      let delay = Math.min(opts.baseDelayMs * Math.pow(2, attempt - 1), opts.maxDelayMs);
      if (opts.jitter) {
        delay = delay * (0.8 + Math.random() * 0.4); // ±20% jitter
      }

      console.warn(
        `${label}Attempt ${attempt} failed: ${String(err)}. Retrying in ${Math.round(delay)}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
