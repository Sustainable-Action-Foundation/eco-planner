'use client';

import { useEffect, useState } from "react";

/**
 * The moment the form was last shown, sent with edits for the API's stale-data check.
 *
 * With cacheComponents, hidden routes stay mounted in an Activity boundary, so reopening
 * an edit form after saving restores the same instance instead of remounting it; a plain
 * mount timestamp would then predate the save and every later submit would 409 as stale.
 * Effects are cleaned up when the route is hidden and re-created when it is shown again,
 * so refreshing the timestamp in an effect keeps it in step with what the user last saw.
 */
export function useFormTimestamp(): number {
  const [timestamp, setTimestamp] = useState(() => Date.now());
  useEffect(() => {
    setTimestamp(Date.now());
  }, []);
  return timestamp;
}
