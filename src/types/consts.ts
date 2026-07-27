/** A regex to match UUIDs. Allows all UUIDs of all versions and variants, even non-standard ones, as specified by RFC 9562 */
export const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
