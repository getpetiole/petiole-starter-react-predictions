// Predict and see: the model's state, asked as the page opens, which wakes
// it; a photo made ready in the browser; the model asked once it is awake,
// so no call waits out its start; and what it found.
import type { Model, Petiole, Prediction } from "@petiole/sdk";
import { useEffect, useRef, useState } from "react";

import { LEAST_SCORE_ASKED } from "../lib/found";
import { type Shown, shown } from "../lib/messages";
import { browserTools, formatBytes, formatSize, PhotoProblem, preparePhoto } from "../lib/photo";
import { type ModelState as State, STATUS_POLL_MS, STATES, untilAwake } from "../lib/model";
import { Found, type ShownPhoto } from "./Found";
import { ModelState } from "./ModelState";
import { PhotoPicker } from "./PhotoPicker";
import { Problem } from "./Problem";

type Stage = "idle" | "preparing" | "checking" | "waking" | "asking";

const SAYS: Record<Exclude<Stage, "idle">, string> = {
  preparing: "Making the photo ready to send…",
  checking: "Checking the model is awake…",
  waking: "The model was idle and is waking up, which takes up to a minute. The photo goes as soon as it is ready.",
  asking: "Sending the photo; the model is looking at it…",
};

export function Detector({ api, model }: { api: Petiole; model: Model }) {
  const [state, setState] = useState<State | null>(null);
  const [stateProblem, setStateProblem] = useState<Shown | null>(null);
  const [photo, setPhoto] = useState<(ShownPhoto & { note: string }) | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [failure, setFailure] = useState<{ title: string; problem: Shown } | null>(null);
  const running = useRef<AbortController | null>(null);

  // The model's state as the page opens, which wakes it, and again while
  // it wakes.
  useEffect(() => {
    const controller = new AbortController();
    untilAwake(api, model.id, setState, controller.signal).catch((error: unknown) => {
      if (!controller.signal.aborted) setStateProblem(shown(error));
    });
    return () => controller.abort();
  }, [api, model.id]);

  // The photo's URL, given back when another is chosen or the page goes.
  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.url) : undefined), [photo]);

  async function choose(file: File) {
    running.current?.abort();
    setPrediction(null);
    setFailure(null);
    setStage("preparing");
    try {
      const prepared = await preparePhoto(file, browserTools);
      const shownSize = prepared.changed || { width: prepared.width, height: prepared.height };
      const size = `${formatSize(prepared.width, prepared.height)} px`;
      let note = `${size}, ${formatBytes(prepared.blob.size)}, sent as it is.`;
      if (prepared.changed) {
        const quality = `${Math.round(prepared.changed.quality * 100)}% quality`;
        const smaller = prepared.changed.width !== prepared.width;
        note = smaller
          ? `${size}, sent as a ${formatBytes(prepared.blob.size)} JPEG of ${formatSize(shownSize.width, shownSize.height)} px at ${quality}.`
          : `${size}, sent as a ${formatBytes(prepared.blob.size)} JPEG at ${quality}.`;
      }
      setPhoto({
        name: file.name || "photo.jpg",
        blob: prepared.blob,
        url: URL.createObjectURL(prepared.blob),
        shownWidth: shownSize.width,
        shownHeight: shownSize.height,
        width: prepared.width,
        height: prepared.height,
        note,
      });
    } catch (error) {
      setPhoto(null);
      setFailure({
        title: "This photo can't be used",
        problem: error instanceof PhotoProblem ? { message: error.message, requestId: null, code: null } : shown(error),
      });
    } finally {
      setStage("idle");
    }
  }

  async function find() {
    if (!photo) return;
    const controller = new AbortController();
    running.current = controller;
    const { signal } = controller;
    setFailure(null);
    setPrediction(null);
    try {
      // Asked again: a model goes back to sleep after some idle minutes.
      setStage("checking");
      const awake = await untilAwake(
        api,
        model.id,
        (next) => {
          setState(next);
          if (next === "starting") setStage("waking");
        },
        signal,
      );
      if (awake !== "ready") {
        const message = awake === "starting" ? `${model.name} is still waking up. Try again in a minute.` : STATES.unavailable.detail;
        setFailure({ title: "The model isn't ready", problem: { message, requestId: null, code: null } });
        return;
      }
      setStage("asking");
      setPrediction(
        await api.models.predict(model.id, photo.blob, {
          confThreshold: LEAST_SCORE_ASKED,
          maxDetections: 300,
          maxWaitMs: 60_000,
          signal,
        }),
      );
    } catch (error) {
      if (!signal.aborted) setFailure({ title: "The leaves weren't found", problem: shown(error) });
    } finally {
      if (running.current === controller) {
        running.current = null;
        setStage("idle");
      }
    }
  }

  const busy = stage !== "idle";

  return (
    <div className="stack">
      <section className="card model" aria-labelledby="model-title">
        <div>
          <h2 id="model-title">{model.name}</h2>
          <p>{model.description}</p>
        </div>
        <ModelState state={state} detail />
        {stateProblem ? <Problem title="The model's state couldn't be checked" problem={stateProblem} /> : null}
      </section>

      <PhotoPicker disabled={busy} onPhoto={(file) => void choose(file)} />

      {photo ? <p className="hint">{photo.note}</p> : null}

      {photo ? (
        <div className="actions">
          <button type="button" className="button primary" disabled={busy} onClick={() => void find()}>
            {busy && stage !== "preparing" ? "Finding the leaves…" : prediction ? "Find them again" : "Find the leaves"}
          </button>
        </div>
      ) : null}

      <div aria-live="polite" className="stage">
        {stage !== "idle" ? <p>{SAYS[stage]}</p> : null}
        {stage === "waking" ? <p className="hint">Checked every {STATUS_POLL_MS / 1000} s.</p> : null}
      </div>

      {failure ? (
        <Problem title={failure.title} problem={failure.problem} onRetry={photo && !busy ? () => void find() : undefined} />
      ) : null}

      {photo ? <Found photo={photo} prediction={prediction} /> : null}
    </div>
  );
}
