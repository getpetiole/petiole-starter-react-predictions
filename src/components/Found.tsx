// What the model found: drawn on the photo, the least score shown on a
// slider, the counts by label, a table, and the downloads.
import type { Prediction } from "@petiole/sdk";
import { useId, useMemo, useState } from "react";

import { annotatedPng } from "../lib/draw";
import { above, countsByLabel, exportName, foundWords, LEAST_SCORE_ASKED, LEAST_SCORE_SHOWN, percent, pixels, toCsv, toJson } from "../lib/found";
import { Overlay } from "./Overlay";

export interface ShownPhoto {
  name: string;
  /** What was sent, and is shown. */
  blob: Blob;
  url: string;
  /** Its size as shown, in pixels. */
  shownWidth: number;
  shownHeight: number;
  /** The photo's own size, upright, in pixels. */
  width: number;
  height: number;
}

function points(count: number): string {
  return `${count} ${count === 1 ? "point" : "points"}`;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function Found({ photo, prediction }: { photo: ShownPhoto; prediction: Prediction | null }) {
  const id = useId();
  const [least, setLeast] = useState(LEAST_SCORE_SHOWN);
  const [drawing, setDrawing] = useState(false);
  const shown = useMemo(() => above(prediction?.detections ?? [], least), [prediction, least]);
  const counts = countsByLabel(shown);

  async function png() {
    setDrawing(true);
    try {
      download(await annotatedPng(photo.blob, shown), exportName(photo.name, "found.png"));
    } finally {
      setDrawing(false);
    }
  }

  return (
    <div className="found">
      <figure className="photo">
        <img src={photo.url} alt={prediction ? `Your photo, with ${foundWords(shown).toLowerCase()} drawn on it` : "Your photo"} />
        {prediction ? <Overlay detections={shown} width={photo.shownWidth} height={photo.shownHeight} /> : null}
      </figure>

      {prediction ? (
        <section aria-labelledby={`${id}-title`} className="stack">
          <h2 id={`${id}-title`}>
            {foundWords(shown)}
            <span className="hint"> · in {prediction.durationMs} ms</span>
          </h2>

          <div className="field">
            <label htmlFor={`${id}-least`}>
              Least confidence shown: <output htmlFor={`${id}-least`}>{percent(least)}</output>
            </label>
            <input
              id={`${id}-least`}
              type="range"
              min={LEAST_SCORE_ASKED}
              max={0.95}
              step={0.05}
              value={least}
              onChange={(event) => setLeast(Number(event.target.value))}
              aria-describedby={`${id}-least-hint`}
            />
            <p id={`${id}-least-hint`} className="hint">
              The leaf detector&apos;s own is {percent(LEAST_SCORE_SHOWN)}. A score is the model&apos;s confidence, not a
              probability. Of {prediction.detections.length} found at {percent(LEAST_SCORE_ASKED)} or more,{" "}
              {shown.length} {shown.length === 1 ? "is" : "are"} shown.
            </p>
          </div>

          {counts.length > 1 ? (
            <ul className="counts">
              {counts.map(([label, count]) => (
                <li key={label}>
                  {label}: {count}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => download(new Blob([toCsv(shown, photo.width, photo.height)], { type: "text/csv" }), exportName(photo.name, "found.csv"))}
            >
              Download CSV
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => download(new Blob([toJson(prediction, shown)], { type: "application/json" }), exportName(photo.name, "found.json"))}
            >
              Download JSON
            </button>
            <button type="button" className="button secondary" disabled={drawing} onClick={() => void png()}>
              {drawing ? "Drawing the PNG…" : "Download annotated PNG"}
            </button>
          </div>

          {shown.length > 0 ? (
            <div className="table-wrap">
              <table aria-label="What the model found">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Found</th>
                    <th scope="col" className="number">
                      Confidence
                    </th>
                    <th scope="col">Where on the photo, in pixels</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((detection, index) => {
                    const box = pixels(detection, photo.width, photo.height);
                    return (
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td>{detection.label}</td>
                        <td className="number">{percent(detection.score)}</td>
                        <td className="number-text">
                          x {box.x}, y {box.y}, {box.width} × {box.height}
                          {detection.polygons?.[0] ? `, outlined in ${points(detection.polygons[0].length)}` : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Nothing at this confidence or more. Move the slider left to see what the model was less sure of.</p>
          )}
          <p className="hint">
            A model finds things; it measures nothing. For the leaves&apos; areas, use a workflow, such as Leaf area.
          </p>
        </section>
      ) : null}
    </div>
  );
}
