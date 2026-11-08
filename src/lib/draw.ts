// How what was found is drawn: a box with its label and score, an outline
// as a filled polygon, the same on the page (components/Overlay.tsx) and in
// the annotated PNG. Sizes are in the photo's pixels, so the labels read the
// same on a photo of any size.
import type { Detection } from "@petiole/sdk";

import { MAX_CANVAS_PIXELS } from "./photo";
import { percent } from "./found";

export const COLOURS = {
  stroke: "#ff7a00",
  fill: "rgba(255, 122, 0, 0.25)",
  label: "#ff7a00",
  labelText: "#1b1b1b",
};

/** A label's text: "leaf 94%". */
export function labelText(detection: Detection): string {
  return `${detection.label} ${percent(detection.score)}`;
}

/** The label's font size for a photo of this size, in its pixels. */
export function labelSize(width: number, height: number): number {
  return Math.max(12, Math.round(Math.min(width, height) / 32));
}

/** The width of a line in the annotated PNG. */
export function lineWidth(width: number, height: number): number {
  return Math.max(2, Math.round(Math.min(width, height) / 400));
}

/** Where a label goes: above the box when there is room, inside it when
 * not. y is the label's top. */
export function labelPlace(boxX: number, boxY: number, size: number): { x: number; y: number } {
  const height = size * 1.4;
  return { x: boxX, y: boxY >= height ? boxY - height : boxY };
}

/** The photo with what was found drawn on it, as a PNG, at the photo's own
 * size or the largest canvas every browser draws. */
export async function annotatedPng(photo: Blob, detections: readonly Detection[]): Promise<Blob> {
  const picture = await createImageBitmap(photo, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, Math.sqrt(MAX_CANVAS_PIXELS / (picture.width * picture.height)));
    const width = Math.floor(picture.width * scale);
    const height = Math.floor(picture.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No 2D canvas");
    context.drawImage(picture, 0, 0, width, height);
    drawFound(context, detections, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The PNG was not made"))), "image/png"),
    );
  } finally {
    picture.close();
  }
}

export function drawFound(
  context: CanvasRenderingContext2D,
  detections: readonly Detection[],
  width: number,
  height: number,
): void {
  const line = lineWidth(width, height);
  const size = labelSize(width, height);
  context.lineWidth = line;
  context.lineJoin = "round";
  for (const detection of detections) {
    context.strokeStyle = COLOURS.stroke;
    context.fillStyle = COLOURS.fill;
    for (const polygon of detection.polygons ?? []) {
      if (polygon.length < 3) continue;
      context.beginPath();
      polygon.forEach((point, index) => {
        const x = point.x * width;
        const y = point.y * height;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
      context.fill();
      context.stroke();
    }
    const { x, y, width: w, height: h } = detection.bbox;
    context.strokeRect(x * width, y * height, w * width, h * height);
  }
  context.font = `600 ${size}px system-ui, sans-serif`;
  context.textBaseline = "top";
  for (const detection of detections) {
    const text = labelText(detection);
    const place = labelPlace(detection.bbox.x * width, detection.bbox.y * height, size);
    const pad = size * 0.2;
    context.fillStyle = COLOURS.label;
    context.fillRect(place.x, place.y, context.measureText(text).width + pad * 2, size * 1.4);
    context.fillStyle = COLOURS.labelText;
    context.fillText(text, place.x + pad, place.y + size * 0.2);
  }
}
