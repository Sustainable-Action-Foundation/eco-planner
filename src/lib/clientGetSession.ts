'use server';

import { cookies } from "next/headers";
import { getSession } from "./session";

/**
 * Gets user session data from cookies sent to the server.
 * Be careful with this one, as it might expose this data to the user, and allow them to change it client-side.
 * All APIs and locked pages should verify the user through cookies before allowing any changes, not rely on any value passed from the user.
 */
export default async function clientGetUserSession() {
  return (await getSession(cookies())).user
}