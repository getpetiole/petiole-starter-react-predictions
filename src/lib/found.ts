// What a model found, as the page shows it and as it is downloaded. A score
// is the model's confidence, never a probability; boxes are in fractions of
// the photo, upright, so x * width and y * height place them on it.
import type { Detection, Prediction } from "@petiole/sdk";

/** The least score the model is asked for: lower than its own default, so
 * the slider can show what it was less sure of. */
export const LEAST_SCORE_ASKED = 0.1;
/** The slider's start: the leaf detector's own default. */
export const LEAST_SCORE_SHOWN = 0.25;

/** The detections at or above the least score shown. */
export function above(detections: readonly Detection[], least: number): Detection[] {
  return detections.filter((detection) => detection.score >= least);
}

/** "84%". */
export function percent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function plural(word: string, count: number): string {
  if (count === 1) return word;
  if (word.endsWith("f")) return `${word.slice(0, -1)}ves`;
  if (word.endsWith("y") && !/[aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

/** How many of each label, the most first: [["leaf", 12]]. */
export function countsByLabel(detections: readonly Detection[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const { label } of detections) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** "12 leaves", "1 leaf, 2 stems", "Nothing found". */
export function foundWords(detections: readonly Detection[]): string {
  const counts = countsByLabel(detections);
  if (counts.length === 0) return "Nothing found";
  return counts.map(([label, count]) => `${count} ${plural(label, count)}`).join(", ");
}

export interface PixelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A detection's box in pixels of a photo of this size. */
export function pixels(detection: Detection, width: number, height: number): PixelBox {
  return {
    x: Math.round(detection.bbox.x * width),
    y: Math.round(detection.bbox.y * height),
    width: Math.round(detection.bbox.width * width),
    height: Math.round(detection.bbox.height * height),
  };
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One row a detection: its label, its confidence and its box, in
 * fractions and in pixels of the photo, upright. */
export function toCsv(detections: readonly Detection[], width: number, height: number): string {
  const rows: (string | number)[][] = [
    ["n", "label", "confidence", "x", "y", "width", "height", "x_px", "y_px", "width_px", "height_px"],
  ];
  detections.forEach((detection, index) => {
    const box = pixels(detection, width, height);
    const { x, y, width: w, height: h } = detection.bbox;
    rows.push([index + 1, detection.label, round(detection.score), round(x), round(y), round(w), round(h), box.x, box.y, box.width, box.height]);
  });
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

/** The prediction as the API answered it, with only the detections shown. */
export function toJson(prediction: Prediction, detections: readonly Detection[]): string {
  return `${JSON.stringify({ ...prediction, detections }, null, 2)}\n`;
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** A file name from the photo's: "leaf.jpg" to "leaf-leaves.csv". */
export function exportName(photoName: string, suffix: string): string {
  const base =
    photoName
      .replace(/\.[^./\\]+$/, "")
      .replace(/[^\w.-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "photo";
  return `${base}-${suffix}`;
}
