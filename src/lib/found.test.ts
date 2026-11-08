import type { Detection, Prediction } from "@petiole/sdk";
import { describe, expect, it } from "vitest";

import { labelPlace } from "./draw";
import { above, countsByLabel, exportName, foundWords, percent, pixels, toCsv, toJson } from "./found";

function leaf(score: number, label = "leaf"): Detection {
  return { label, score, bbox: { x: 0.1, y: 0.2, width: 0.25, height: 0.5 } };
}

describe("what was found", () => {
  it("is shown from the least score up", () => {
    const found = [leaf(0.9), leaf(0.3), leaf(0.12)];
    expect(above(found, 0.25)).toEqual([leaf(0.9), leaf(0.3)]);
    expect(above(found, 0.1)).toHaveLength(3);
  });

  it("is counted in words", () => {
    expect(foundWords([])).toBe("Nothing found");
    expect(foundWords([leaf(0.9)])).toBe("1 leaf");
    expect(foundWords([leaf(0.9), leaf(0.8)])).toBe("2 leaves");
    expect(foundWords([leaf(0.9), leaf(0.8, "stem"), leaf(0.7, "stem"), leaf(0.6)])).toBe("2 leaves, 2 stems");
    expect(foundWords([leaf(0.9, "berry"), leaf(0.9, "berry")])).toBe("2 berries");
    expect(countsByLabel([leaf(0.9, "stem"), leaf(0.9), leaf(0.9)])).toEqual([
      ["leaf", 2],
      ["stem", 1],
    ]);
  });

  it("is placed in pixels of the photo, upright", () => {
    expect(pixels(leaf(0.9), 4032, 3024)).toEqual({ x: 403, y: 605, width: 1008, height: 1512 });
  });

  it("downloads as CSV, a row a detection", () => {
    const csv = toCsv([leaf(0.94321), leaf(0.5, 'a "quoted", label')], 4000, 3000);
    expect(csv.split("\n")).toEqual([
      "n,label,confidence,x,y,width,height,x_px,y_px,width_px,height_px",
      "1,leaf,0.9432,0.1,0.2,0.25,0.5,400,600,1000,1500",
      '2,"a ""quoted"", label",0.5,0.1,0.2,0.25,0.5,400,600,1000,1500',
      "",
    ]);
  });

  it("downloads as JSON in the API's shape, with what is shown", () => {
    const prediction: Prediction = {
      object: "prediction",
      model: { id: "leaf-detector", version: "v7" },
      image: { width: 4032, height: 3024 },
      durationMs: 640,
      detections: [leaf(0.9), leaf(0.2)],
    };
    expect(JSON.parse(toJson(prediction, [leaf(0.9)]))).toEqual({ ...prediction, detections: [leaf(0.9)] });
  });

  it("names its files after the photo", () => {
    expect(exportName("IMG_0042.JPG", "found.csv")).toBe("IMG_0042-found.csv");
    expect(exportName("my leaf (1).jpeg", "found.png")).toBe("my-leaf-1-found.png");
    expect(exportName("", "found.json")).toBe("photo-found.json");
  });

  it("gives a score as a whole percentage", () => {
    expect(percent(0.944)).toBe("94%");
    expect(percent(0.1)).toBe("10%");
  });

  it("labels a box above it, or inside it at the photo's top", () => {
    expect(labelPlace(100, 200, 20)).toEqual({ x: 100, y: 172 });
    expect(labelPlace(100, 10, 20)).toEqual({ x: 100, y: 10 });
  });
});
