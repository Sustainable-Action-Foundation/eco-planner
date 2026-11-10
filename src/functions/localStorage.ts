'use client';

import type { JSONValue } from "@/types";

// Silently fail if sessionStorage or localStorage is not available, but log an error to the user

// Client components render on the server too, where there is no storage to read or write
const isServer = typeof window === "undefined";

/** Stringifies `value` and stores it in sessionStorage under `key`. */
export function setSessionStorage(key: string, value: JSONValue) {
  if (isServer) return;
  if (!sessionStorage) {
    console.error('No sessionStorage available');
    return;
  }

  sessionStorage.setItem(key, JSON.stringify(value));
}

/** Stringifies `value` and stores it in localStorage under `key`. */
export function setLocalStorage(key: string, value: JSONValue) {
  if (isServer) return;
  if (!localStorage) {
    console.error('No localStorage available');
    return;
  }

  localStorage.setItem(key, JSON.stringify(value));
}

/** Retrieves the value stored under `key` in sessionStorage, parsed as JSON. */
export function getSessionStorage(key: string): JSONValue | null {
  if (isServer) return null;
  if (!sessionStorage) {
    console.error('No sessionStorage available');
    return null;
  }

  const value = sessionStorage.getItem(key);
  if (value) {
    return JSON.parse(value) as JSONValue;
  }
  return null;
}

/** Retrieves the value stored under `key` in localStorage, parsed as JSON. */
export function getLocalStorage(key: string): JSONValue | null {
  if (isServer) return null;
  if (!localStorage) {
    console.error('No localStorage available');
    return null;
  }

  const value = localStorage.getItem(key);
  if (value) {
    return JSON.parse(value) as JSONValue;
  }
  return null;
}

/** Retrieves all keys in sessionStorage. */
export function getSessionStorageKeys() {
  if (isServer) return [];
  if (!sessionStorage) {
    console.error('No sessionStorage available');
    return null;
  }

  return Object.keys(sessionStorage);
}

/** Retrieves all keys in localStorage. */
export function getLocalStorageKeys() {
  if (isServer) return [];
  if (!localStorage) {
    console.error('No localStorage available');
    return null;
  }

  return Object.keys(localStorage);
}

/** Removes the value stored under `key` in sessionStorage. */
export function removeSessionStorage(key: string) {
  if (isServer) return;
  if (!sessionStorage) {
    console.error('No sessionStorage available');
    return;
  }

  sessionStorage.removeItem(key);
}

/** Removes the value stored under `key` in localStorage. */
export function removeLocalStorage(key: string) {
  if (isServer) return;
  if (!localStorage) {
    console.error('No localStorage available');
    return;
  }

  localStorage.removeItem(key);
}
