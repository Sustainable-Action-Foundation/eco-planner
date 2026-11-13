"use client";

import { useIsClient } from "@/functions/useClientState";

/**
 * A `<form>` that cannot be clicked or submitted until React has hydrated it. The server sends
 * forms as real markup, so they are on screen before their scripts run. In that gap a click
 * on a controlled radio or checkbox would be undone at hydration, and a submit would be sent
 * natively by the browser (a GET to the current URL, with the fields in the address).
 * Until hydration, pointer events are off and the method is "dialog", which submits nothing
 * outside a `<dialog>`. Typing stays possible: React replays it into the fields' state.
 */
export default function HydratedForm(props: React.ComponentProps<"form">) {
  const isClient = useIsClient();

  if (isClient) {
    return <form {...props} />;
  }

  return <form {...props} method="dialog" style={{ ...props.style, pointerEvents: "none" }} />;
}
