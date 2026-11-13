"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { Dispatch, SetStateAction } from "react";

function subscribeToNothing() {
  return () => { /* empty */ };
}

/**
 * False on the server and while hydrating, true from then on (and from the first render of
 * anything mounted later). Client components are rendered on the server too, and the
 * hydrating render has to produce the same markup: what only the browser knows (storage,
 * the location) can be used once this is true.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribeToNothing, () => true, () => false);
}

/**
 * `useState` for state that starts from something only the browser knows. The server and the
 * hydrating render get `serverValue`; right after hydration the state becomes `readClient()`,
 * and stays whatever is set from then on.
 */
export function useClientState<T>(serverValue: T, readClient: () => T): [T, Dispatch<SetStateAction<T>>] {
  const isClient = useIsClient();
  // Read once per mount, not on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo(() => isClient ? readClient() : serverValue, [isClient]);
  const [chosen, setChosen] = useState<{ value: T } | null>(null);

  const setValue = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    setChosen(previous => ({
      value: typeof action === "function"
        ? (action as (previous: T) => T)(previous ? previous.value : initial)
        : action,
    }));
  }, [initial]);

  return [chosen ? chosen.value : initial, setValue];
}
