/**
 * Returns `path` if it is a same-origin relative path, otherwise `fallback`.
 * Guards redirect targets taken from the URL (e.g. `?from=`) against open redirects:
 * "//evil.com" and "/\evil.com" are protocol-relative to browsers, and anything not
 * starting with "/" may be an absolute URL.
 */
export function safeRedirectPath(path: string | null | undefined, fallback = "/"): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return fallback;
  }
  // Browsers strip tabs and newlines from URLs, so "/\t/evil.com" would become "//evil.com"
  if (/[\t\n\r]/.test(path)) {
    return fallback;
  }
  return path;
}
