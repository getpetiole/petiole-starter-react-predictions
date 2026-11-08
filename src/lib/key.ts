// The visitor's API key: kept in this tab (sessionStorage) by default, or
// on this device (localStorage) when they tick Remember. It goes only to
// this site's own /api, over HTTPS, with each call; the site's function
// passes it on to the Petiole API and never keeps it.

export type KeyPlace = "tab" | "device";

export interface StoredKey {
  key: string;
  place: KeyPlace;
}

export interface Storages {
  tab: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  device: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
}

const NAME = "petiole.apiKey";

/** The browser's storages; null for one it refuses, as some private
 * windows do. */
export function browserStorages(): Storages {
  const get = (name: "sessionStorage" | "localStorage") => {
    try {
      return window[name];
    } catch {
      return null;
    }
  };
  return { tab: get("sessionStorage"), device: get("localStorage") };
}

export function readKey(storages: Storages = browserStorages()): StoredKey | null {
  for (const place of ["tab", "device"] as const) {
    try {
      const key = storages[place]?.getItem(NAME);
      if (key) return { key, place };
    } catch {
      // A storage the browser refuses holds nothing.
    }
  }
  return null;
}

/** Keeps the key in one place, and in that place only. False when the
 * browser refuses: then it lasts until the page is reloaded. */
export function saveKey(key: string, place: KeyPlace, storages: Storages = browserStorages()): boolean {
  clearKey(storages);
  try {
    const storage = storages[place];
    if (!storage) return false;
    storage.setItem(NAME, key);
    return true;
  } catch {
    return false;
  }
}

export function clearKey(storages: Storages = browserStorages()): void {
  for (const place of ["tab", "device"] as const) {
    try {
      storages[place]?.removeItem(NAME);
    } catch {
      // Nothing to clear.
    }
  }
}

/** The key as pasted, without what often comes with it: spaces, quotes, a
 * "Bearer " in front. */
export function normaliseKey(input: string): string {
  return input
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
}

/** Why a key will not do, before it is tried, or null. */
export function keyProblem(key: string): string | null {
  if (!key) return "Enter your API key.";
  if (!key.startsWith("ptl_live_")) {
    return "A Petiole API key starts with ptl_live_. Copy it again from Keys & access in the Petiole platform.";
  }
  if (/\s/.test(key)) return "The key has a space in it. Copy it again, in one piece.";
  return null;
}
