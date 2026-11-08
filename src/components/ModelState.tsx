// A model's state: a dot and a word, never the colour alone.
import { type ModelState as State, STATES } from "../lib/model";

export function ModelState({ state, detail = false }: { state: State | null; detail?: boolean }) {
  return (
    <span className="state" role="status" aria-live="polite">
      <span aria-hidden className={`dot ${state ?? "checking"}`} />
      <span>
        <span className="visually-hidden">State: </span>
        {state ? STATES[state].label : "Checking…"}
        {detail && state ? <span className="hint"> · {STATES[state].detail}</span> : null}
      </span>
    </span>
  );
}
