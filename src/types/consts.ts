/** A regex to match UUIDs. Allows all UUIDs of all versions and variants, even non-standard ones, as specified by RFC 9562 */
export const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const ClientError = {
  AccessDenied: "You either don't have access to this entry or are trying to edit an entry that doesn't exist",
  BadSession: "Bad session cookie; you have been logged out. Please log in and try again.",
  IllegalParent: "You are trying to connect this object to a parent you don't have access to or that doesn't exist",
  StaleData: "Stale data; please refresh and try again",
} as const;
