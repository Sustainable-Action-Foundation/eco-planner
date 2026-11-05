import type { JSONValue } from "@/types";

/** A parsed JSON object (not an array); every key may be missing */
export type JsonObject = Partial<{ [key: string]: JSONValue }>;

/**
 * The request's JSON body, or null when it is missing or not valid JSON (a
 * literal `null` body also reads as null). Route handlers answer 400 on null
 * instead of letting `request.json()` throw into a 500.
 */
export async function readJson(request: Request): Promise<JSONValue | null> {
  return (request.json() as Promise<JSONValue>).catch(() => null);
}

/** The body when it is a JSON object (not an array), else null; for handlers that index into the body */
export async function readJsonObject(request: Request): Promise<JsonObject | null> {
  const body = await readJson(request);
  return typeof body === "object" && body !== null && !Array.isArray(body) ? body : null;
}
