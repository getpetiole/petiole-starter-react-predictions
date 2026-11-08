import type { ModelStatus, Petiole } from "@petiole/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type ModelState, STATUS_POLL_MS, untilAwake, WAKE_MAX_MS } from "./model";

function api(states: ModelState[]) {
  const status = vi.fn(async (): Promise<ModelStatus> => ({
    object: "model_status",
    model: "leaf-detector",
    status: states.length > 1 ? states.shift()! : states[0],
    checkedAt: new Date().toISOString(),
  }));
  return { api: { models: { status } } as unknown as Petiole, status };
}

describe("a model woken and waited for", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("is asked until it is ready, every few seconds, saying each state", async () => {
    const { api: petiole, status } = api(["starting", "starting", "ready"]);
    const seen: ModelState[] = [];
    const awake = untilAwake(petiole, "leaf-detector", (state) => seen.push(state));
    await vi.advanceTimersByTimeAsync(STATUS_POLL_MS * 2);
    expect(await awake).toBe("ready");
    expect(seen).toEqual(["starting", "starting", "ready"]);
    expect(status).toHaveBeenCalledTimes(3);
  });

  it("answers at once when it is ready or unavailable", async () => {
    expect(await untilAwake(api(["ready"]).api, "leaf-detector", () => {})).toBe("ready");
    expect(await untilAwake(api(["unavailable"]).api, "leaf-detector", () => {})).toBe("unavailable");
  });

  it("gives up after two minutes still starting", async () => {
    const { api: petiole } = api(["starting"]);
    const awake = untilAwake(petiole, "leaf-detector", () => {});
    await vi.advanceTimersByTimeAsync(WAKE_MAX_MS + STATUS_POLL_MS);
    expect(await awake).toBe("starting");
  });

  it("stops when the page lets go", async () => {
    const { api: petiole, status } = api(["starting"]);
    const controller = new AbortController();
    const awake = untilAwake(petiole, "leaf-detector", () => {}, controller.signal);
    await vi.advanceTimersByTimeAsync(1);
    controller.abort(new Error("gone"));
    await expect(awake).rejects.toThrow("gone");
    expect(status).toHaveBeenCalledTimes(1);
  });
});
