import type { ConsoleMessage, Page } from "playwright/test";

/*
 * Collects what would make a page "broken" for a user without the test
 * noticing otherwise: uncaught exceptions and `console.error` output.
 */

/**
 * Browser noise that is not an app error. Each entry documents why it is dropped:
 * - `Failed to load resource`: Chromium logs every non-2xx response (the 404 pages
 *   themselves, a redirect probe) as a console error; the status checks cover those.
 * - `Download the React DevTools`: dev-build banner (logged at error level by some builds).
 * - `AbortError` navigations: Firefox reports a fetch cut short by a client-side
 *   navigation (the login redirect, `router.push`) as an error, not a cancellation.
 * - `next dev` diagnostics replayed into the browser console, absent from production
 *   builds: cacheComponents' "encountered runtime/uncached data in generateMetadata()"
 *   (the metadata builders read the locale cookie and the entity), "Could not validate
 *   that a segment in your UI has instant navigation", and React's dev performance
 *   track failing `performance.measure` with a negative timestamp on prerendered pages
 *   (Chromium and Firefox word it differently).
 */
const benign = [
  /Failed to load resource/,
  /Download the React DevTools/,
  /AbortError|NetworkError when attempting to fetch resource|The operation was aborted/,
  /Next\.js encountered (runtime|uncached) data in `generateMetadata\(\)`/,
  /Could not validate that a segment in your UI has instant navigation/,
  /Failed to execute 'measure' on 'Performance'.*negative time stamp|Performance\.measure: Given attribute end cannot be negative/,
];

export type PageErrors = {
  /** What was recorded so far; console errors whose text needs resolving (see `settled`) land here late */
  messages: string[];
  /** The recorded errors once every console message's arguments have been resolved */
  settled: () => Promise<string[]>;
};

/**
 * The text of a console message. Firefox renders an Error argument as the bare
 * word "Error", so the arguments are read back for their messages and stacks.
 */
async function consoleText(message: ConsoleMessage): Promise<string> {
  const text = message.text();
  if (!/^(Error\b.*)?$/.test(text.trim()) || text.length > 40) return text;
  const parts = await Promise.all(message.args().map(arg => arg.evaluate(value => value instanceof Error ? `${value.name}: ${value.message}` : String(value)).catch(() => "")));
  return parts.filter(Boolean).join(" ") || text;
}

/** Starts recording `pageerror`s and `console.error`s on the page; await `settled()` after navigating. */
export function recordPageErrors(page: Page): PageErrors {
  const pending: Promise<void>[] = [];
  const errors: PageErrors = {
    messages: [],
    settled: async () => {
      await Promise.all(pending);
      return errors.messages;
    },
  };
  page.on("pageerror", (error) => {
    if (benign.some(pattern => pattern.test(error.message))) return;
    errors.messages.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    pending.push(consoleText(message).then(text => {
      if (benign.some(pattern => pattern.test(text))) return;
      errors.messages.push(`console.error: ${text}`);
    }));
  });
  return errors;
}
