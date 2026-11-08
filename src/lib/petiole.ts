// The Petiole API, as the page calls it: through this site's own /api, with
// the visitor's key, or with none when the site has its own
// (server/forward.ts). The SDK is the same one a server would use.
import { Petiole } from "@petiole/sdk";

/** Where Keys & access is, to make a key. */
export const KEYS_URL = "https://platform.petiole.pro/keys";

export function petiole(key: string | null): Petiole {
  return new Petiole({ apiKey: key, baseUrl: "/api" });
}

/** Waits for ms, or until signal aborts. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
