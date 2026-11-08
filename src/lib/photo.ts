// A photo made ready to send, in the browser. The site's function takes at
// most 6 MB a request on Netlify, and a photo's bytes travel base64-encoded,
// so about 4.5 MB of photo. A JPEG or PNG within that goes as it is: the
// API turns it upright by its EXIF orientation. Any other, such as a larger
// photo or a HEIC one the browser can open, is drawn upright and encoded as
// a JPEG, at its own size and a lower quality until it fits. What comes back
// is in fractions of the photo, so it fits the original at any size.
import { sniffContentType } from "@petiole/sdk";

/** The most a photo sent may weigh, with room for the request around it. */
export const MAX_SEND_BYTES = 4_400_000;
/** The largest canvas every browser draws: Safari on iOS draws no more. */
export const MAX_CANVAS_PIXELS = 16_777_216;
/** The most the API takes: 100 million pixels. */
export const MAX_API_PIXELS = 100_000_000;
const QUALITIES = [0.92, 0.85, 0.78, 0.7, 0.6, 0.5];
const SENT_AS_IS = new Set(["image/jpeg", "image/png"]);

export interface Prepared {
  /** What is sent. */
  blob: Blob;
  /** The photo's own size, upright, in pixels. */
  width: number;
  height: number;
  /** Whether it was re-encoded, and how. */
  changed: false | { width: number; height: number; quality: number };
}

/** Why a photo cannot be used, in words that say what to do. */
export class PhotoProblem extends Error {
  override name = "PhotoProblem";
}

export interface Picture {
  width: number;
  height: number;
  close(): void;
}

/** How a photo is opened and encoded: the browser's, or a test's. */
export interface PhotoTools<P extends Picture = Picture> {
  open(file: Blob): Promise<P>;
  encode(picture: P, width: number, height: number, quality: number): Promise<Blob>;
}

export async function preparePhoto<P extends Picture>(file: Blob, tools: PhotoTools<P>): Promise<Prepared> {
  if (file.size === 0) throw new PhotoProblem("This file is empty. Choose the photo again.");
  let picture: P;
  try {
    picture = await tools.open(file);
  } catch {
    throw new PhotoProblem("This browser can't open this file as a photo. Choose a JPEG or PNG photo.");
  }
  try {
    const { width, height } = picture;
    const type = await sniffContentType(file);
    if (type && SENT_AS_IS.has(type) && file.size <= MAX_SEND_BYTES && width * height <= MAX_API_PIXELS) {
      return { blob: file, width, height, changed: false };
    }
    let scale = Math.min(1, Math.sqrt(MAX_CANVAS_PIXELS / (width * height)));
    for (let attempt = 0; attempt < 4; attempt++, scale *= 0.75) {
      const size = { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
      for (const quality of QUALITIES) {
        const blob = await tools.encode(picture, size.width, size.height, quality);
        if (blob.size <= MAX_SEND_BYTES) return { blob, width, height, changed: { ...size, quality } };
      }
    }
    throw new PhotoProblem("This photo can't be made small enough to send. Choose a smaller one.");
  } finally {
    picture.close();
  }
}

/** The browser's tools: an ImageBitmap, upright by the photo's EXIF
 * orientation, drawn on a canvas on a white ground. */
export const browserTools: PhotoTools<ImageBitmap> = {
  open: (file) => createImageBitmap(file, { imageOrientation: "from-image" }),
  async encode(picture, width, height, quality) {
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d");
      if (!context) throw new PhotoProblem("This browser can't draw the photo. Try another browser.");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
      context.drawImage(picture, 0, 0, width, height);
      return canvas.convertToBlob({ type: "image/jpeg", quality });
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new PhotoProblem("This browser can't draw the photo. Try another browser.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(picture, 0, 0, width, height);
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new PhotoProblem("This browser can't encode the photo."))),
        "image/jpeg",
        quality,
      ),
    );
  },
};

/** Bytes as people read them: "4.2 MB", "640 KB". */
export function formatBytes(bytes: number): string {
  const mb = bytes / 1_000_000;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/** "4032 × 3024". */
export function formatSize(width: number, height: number): string {
  return `${width} × ${height}`;
}
