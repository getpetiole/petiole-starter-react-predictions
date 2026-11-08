import { describe, expect, it } from "vitest";

import { MAX_CANVAS_PIXELS, MAX_SEND_BYTES, PhotoProblem, type PhotoTools, preparePhoto } from "./photo";

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const HEIC = [0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63];

function file(head: number[], size: number, type = ""): Blob {
  const bytes = new Uint8Array(size);
  bytes.set(head);
  return new Blob([bytes], { type });
}

/** A picture of width × height, encoded at quality to bytesAt(quality,
 * pixels) bytes. */
function tools(width: number, height: number, bytesAt: (quality: number, pixels: number) => number) {
  const encoded: { width: number; height: number; quality: number }[] = [];
  let closed = 0;
  const kit: PhotoTools = {
    open: async () => ({ width, height, close: () => void closed++ }),
    encode: async (_picture, w, h, quality) => {
      encoded.push({ width: w, height: h, quality });
      return new Blob([new Uint8Array(bytesAt(quality, w * h))], { type: "image/jpeg" });
    },
  };
  return { kit, encoded, closed: () => closed };
}

describe("a photo made ready to send", () => {
  it("goes as it is when it is a JPEG or PNG small enough", async () => {
    for (const head of [JPEG, PNG]) {
      const photo = file(head, 3_000_000);
      const { kit, encoded, closed } = tools(4032, 3024, () => 0);
      const prepared = await preparePhoto(photo, kit);
      expect(prepared).toEqual({ blob: photo, width: 4032, height: 3024, changed: false });
      expect(encoded).toEqual([]);
      expect(closed()).toBe(1);
    }
  });

  it("is re-encoded at its own size, at the best quality that fits", async () => {
    const { kit, encoded } = tools(4032, 3024, (quality) => (quality > 0.8 ? MAX_SEND_BYTES + 1 : MAX_SEND_BYTES - 1));
    const prepared = await preparePhoto(file(JPEG, 9_000_000), kit);
    expect(prepared.width).toBe(4032);
    expect(prepared.changed).toEqual({ width: 4032, height: 3024, quality: 0.78 });
    expect(encoded.map((each) => each.quality)).toEqual([0.92, 0.85, 0.78]);
    expect(prepared.blob.size).toBeLessThanOrEqual(MAX_SEND_BYTES);
  });

  it("is re-encoded when it is not a JPEG or PNG, such as HEIC", async () => {
    const { kit } = tools(4032, 3024, () => 2_000_000);
    const prepared = await preparePhoto(file(HEIC, 2_000_000, "image/heic"), kit);
    expect(prepared.changed).toEqual({ width: 4032, height: 3024, quality: 0.92 });
  });

  it("is drawn no larger than every browser's canvas, its shape kept", async () => {
    const { kit } = tools(8000, 6000, () => 3_000_000);
    const prepared = await preparePhoto(file(JPEG, 20_000_000), kit);
    expect(prepared.width).toBe(8000);
    const changed = prepared.changed as { width: number; height: number };
    expect(changed.width * changed.height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
    expect(changed.width / changed.height).toBeCloseTo(8000 / 6000, 2);
  });

  it("is made smaller only when no quality fits", async () => {
    const { kit, encoded } = tools(4000, 3000, (_quality, pixels) => (pixels > 7_000_000 ? MAX_SEND_BYTES + 1 : 1000));
    const prepared = await preparePhoto(file(PNG, 30_000_000), kit);
    expect(prepared.changed).toEqual({ width: 3000, height: 2250, quality: 0.92 });
    expect(encoded).toHaveLength(7);
  });

  it("is refused in words when it is empty, cannot be opened, or never fits", async () => {
    const { kit } = tools(100, 100, () => MAX_SEND_BYTES + 1);
    await expect(preparePhoto(new Blob([]), kit)).rejects.toThrow(/empty/);
    const broken: PhotoTools = { open: () => Promise.reject(new Error("decode")), encode: kit.encode };
    await expect(preparePhoto(file(JPEG, 10), broken)).rejects.toThrow(PhotoProblem);
    await expect(preparePhoto(file(JPEG, 10), broken)).rejects.toThrow(/JPEG or PNG/);
    await expect(preparePhoto(file(PNG, MAX_SEND_BYTES + 10), kit)).rejects.toThrow(/small enough/);
  });
});
