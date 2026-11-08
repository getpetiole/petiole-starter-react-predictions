import { describe, expect, it } from "vitest";

import { clearKey, keyProblem, normaliseKey, readKey, saveKey, type Storages } from "./key";

function storage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (name: string) => items.get(name) ?? null,
    setItem: (name: string, value: string) => void items.set(name, value),
    removeItem: (name: string) => void items.delete(name),
  };
}

function storages(): Storages & { tab: ReturnType<typeof storage>; device: ReturnType<typeof storage> } {
  return { tab: storage(), device: storage() };
}

describe("the key's storage", () => {
  it("keeps the key in this tab, or on this device, and in one place only", () => {
    const kept = storages();
    expect(readKey(kept)).toBeNull();
    expect(saveKey("ptl_live_a", "tab", kept)).toBe(true);
    expect(readKey(kept)).toEqual({ key: "ptl_live_a", place: "tab" });
    expect(saveKey("ptl_live_b", "device", kept)).toBe(true);
    expect(readKey(kept)).toEqual({ key: "ptl_live_b", place: "device" });
    expect(kept.tab.items.size).toBe(0);
  });

  it("forgets it everywhere", () => {
    const kept = storages();
    saveKey("ptl_live_a", "device", kept);
    clearKey(kept);
    expect(readKey(kept)).toBeNull();
    expect(kept.device.items.size).toBe(0);
  });

  it("says when the browser keeps nothing", () => {
    const refusing: Storages = {
      tab: {
        getItem: () => {
          throw new Error("SecurityError");
        },
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
        removeItem: () => {
          throw new Error("SecurityError");
        },
      },
      device: null,
    };
    expect(saveKey("ptl_live_a", "tab", refusing)).toBe(false);
    expect(saveKey("ptl_live_a", "device", refusing)).toBe(false);
    expect(readKey(refusing)).toBeNull();
  });
});

describe("a key as pasted", () => {
  it("loses the spaces, quotes and Bearer that come with it", () => {
    expect(normaliseKey("  ptl_live_abc \n")).toBe("ptl_live_abc");
    expect(normaliseKey('"ptl_live_abc"')).toBe("ptl_live_abc");
    expect(normaliseKey("Bearer ptl_live_abc")).toBe("ptl_live_abc");
  });

  it("is refused in words when it cannot be a key", () => {
    expect(keyProblem("")).toMatch(/Enter/);
    expect(keyProblem("sk-123")).toMatch(/starts with ptl_live_/);
    expect(keyProblem("ptl_live_ab cd")).toMatch(/space/);
    expect(keyProblem("ptl_live_abcd")).toBeNull();
  });
});
