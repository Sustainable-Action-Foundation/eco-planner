/** Minimum allowed username length, in Unicode code points. */
export const usernameMinLength = 2;
/** Maximum allowed username length, in Unicode code points. */
export const usernameMaxLength = 128;

/**
 * Allowed username characters: letters from any script (including combining marks),
 * digits, ".", "_" and "-". Anything else (spaces, "@", "/", "%", "#", "?", ...)
 * would break or alias the /user/[username] and /@username routes.
 * Kept as a source string so it can double as an <input pattern> attribute;
 * the hyphen is escaped because pattern compiles with the stricter v flag.
 */
const usernameCharClass = "[\\p{L}\\p{M}\\p{N}._\\-]";

/** Source for the <input pattern> attribute on signup; browsers anchor it and compile it with the v flag. */
export const usernamePattern = `${usernameCharClass}{${usernameMinLength},${usernameMaxLength}}`;

const usernameRegex = new RegExp(`^(?:${usernamePattern})$`, "u");

/** Whether the given string is allowed as a username. See {@link usernamePattern}. */
export function isValidUsername(username: string): boolean {
  return usernameRegex.test(username);
}

/**
 * Extracts the username from a /user/[username] route param.
 * Strips the "@" handle indicator and percent-decodes the segment, since Next
 * delivers it encoded on direct loads but decoded on client-side navigation.
 */
export function usernameFromParam(param: string): string {
  const stripped = param.replace(/^(@|%40)/, "");
  try {
    return decodeURIComponent(stripped);
  } catch {
    // Malformed escape sequence; keep the raw value (the user lookup will 404)
    return stripped;
  }
}
