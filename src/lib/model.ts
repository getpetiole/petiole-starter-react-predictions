// A model's state, and waking it: a model that has been idle sleeps, and
// asking its state wakes it, which takes up to a minute.
import type { Petiole } from "@petiole/sdk";

import { sleep } from "./petiole";

export { MODEL_ID } from "../../server/routes";

export type ModelState = "ready" | "starting" | "unavailable";

/** A model's state in words, as the Petiole platform says it. */
export const STATES: Record<ModelState, { label: string; detail: string }> = {
  ready: { label: "Ready", detail: "It answers now." },
  starting: { label: "Waking up", detail: "It was idle and is starting, which takes up to a minute." },
  unavailable: { label: "Unavailable", detail: "It can't answer at the moment. Try again later." },
};

/** How often a waking model's state is asked again. */
export const STATUS_POLL_MS = 5_000;
/** How long a model is waited for before the page gives up. */
export const WAKE_MAX_MS = 120_000;

/** Asks the model's state until it is not starting, telling onState each
 * answer, and answers the last: ready, unavailable, or still starting after
 * WAKE_MAX_MS. Asking wakes a model that is asleep. */
export async function untilAwake(
  api: Petiole,
  model: string,
  onState: (state: ModelState) => void,
  signal?: AbortSignal,
  now = () => Date.now(),
): Promise<ModelState> {
  const deadline = now() + WAKE_MAX_MS;
  for (;;) {
    const { status } = await api.models.status(model, { signal });
    onState(status);
    if (status !== "starting" || now() >= deadline) return status;
    await sleep(STATUS_POLL_MS, signal);
  }
}
