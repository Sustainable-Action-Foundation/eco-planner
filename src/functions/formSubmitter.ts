'use client';

import { TFunction } from "i18next";
import { isStandardObject, JSONValue } from "@/types";
import { SetStateAction } from "react";

/**
 * Submits the data from a form to the API and handles the response
 * @param target The URL to submit the form to
 * @param body A JSON string containing the data to be submitted
 * @param method The HTTP method to use; "POST", "PUT", "DELETE", or "PATCH"
 * @param t The translation function from i18next
 * @param loadingStateSetter A function to set the isLoading state of the form
 * @param defaultLocation A default location to redirect to if the API does not provide one
 * @param thenReplacement A function to handle the response data if the request is successful, replaces the default behavior
 * @param catchReplacement A function to handle errors if the request fails, replaces the default error handling
 */
export default function formSubmitter(
  target: string,
  body: string | null,
  method: "POST" | "PUT" | "DELETE" | "PATCH",
  t: TFunction,
  loadingStateSetter?: (value: SetStateAction<boolean>) => void,
  defaultLocation?: string,
  thenReplacement?: (data: { body: JSONValue, location?: string | null }) => void,
  catchReplacement?: (err: unknown) => void
): void {
  fetch(target, {
    method,
    body,
    headers: { 'Content-Type': 'application/json' },
  }).then(async (res) => {
    if (res.ok) {
      return { body: await (res.json() as Promise<JSONValue>), location: res.headers.get('Location') };
    } else {
      if (res.status >= 400) {
        const data = await (res.json() as Promise<JSONValue>);
        // Throw the message and any location provided by the API
        if (isStandardObject(data) && 'message' in data && typeof data.message === 'string') {
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw { message: data.message, location: res.headers.get('Location') };
        } else {
          // If the response is not a standard object, throw a generic error
          console.error('Unexpected non-ok response: ', res);
          throw new Error(t("common:something_went_wrong_with_details", { details: `Unexpected non-ok response, see terminal for more information. Status: ${res.status}, Status Text: ${res.statusText}` }));
        }
      } else {
        throw new Error(t("common:errors.something_went_wrong"));
      }
    }
  }).then(data => {
    if (thenReplacement) {
      thenReplacement(data);
      return;
    }
    if (loadingStateSetter) {
      loadingStateSetter(false);
    }
    // If the API provides a message, alert it
    if (isStandardObject(data.body) && 'message' in data.body && typeof data.body.message === 'string') {
      if (data.body.message) {
        alert(data.body.message);
      }
    }
    // Redirect to the location provided by the API, or, if missing, to nearest valid parent
    // POST is on pages such as /goal/create, which should default to / if no location is provided
    // PUT is on pages such as /goal/[id]/edit, which should default to /goal/[id] if no location is provided
    window.location.href = data.location ?? (defaultLocation ? defaultLocation : method.toUpperCase() == "POST" ? "../" : "./")
  }).catch((err: unknown) => {
    if (catchReplacement) {
      catchReplacement(err);
      return;
    }
    if (loadingStateSetter) {
      loadingStateSetter(false);
    }
    console.error(err);
    if (err instanceof Error) {
      alert(`${t("common:errors.something_went_wrong_with_details", { details: err.message })}`);
    } else if (isStandardObject(err) && 'message' in err && typeof err.message === 'string') {
      alert(`${t("common:errors.something_went_wrong_with_details", { details: err.message })}`);
      if ("location" in err && typeof err.location === 'string') {
        window.location.href = err.location;
      }
    }
  });
}