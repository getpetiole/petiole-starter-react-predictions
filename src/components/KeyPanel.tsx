// The key: pasted, checked against the API before it is kept, and kept in
// this tab or, when the visitor ticks it, on this device.
import { type FormEvent, useId, useState } from "react";

import { keyProblem, normaliseKey } from "../lib/key";
import type { Shown } from "../lib/messages";
import { KEYS_URL } from "../lib/petiole";

export function KeyPanel({
  needs,
  problem,
  onKey,
}: {
  /** What a key for this app needs, in words: "the Leaf area workflow". */
  needs: string;
  /** Why the last key did not do, if it did not. */
  problem: Shown | null;
  /** Tries a key, and answers why it did not do, or null. */
  onKey: (key: string, remember: boolean) => Promise<Shown | null>;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Shown | null>(problem);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const key = normaliseKey(value);
    const wrong = keyProblem(key);
    if (wrong) {
      setError({ message: wrong, requestId: null, code: null });
      return;
    }
    setBusy(true);
    setError(null);
    const refused = await onKey(key, remember);
    setBusy(false);
    if (refused) setError(refused);
  }

  return (
    <section className="card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Your API key</h2>
      <p>
        This app calls the Petiole API with an API key of your organisation&apos;s. Make one for it on{" "}
        <a href={KEYS_URL}>Keys &amp; access</a> in the Petiole platform, with {needs} and an expiry. Your
        organisation&apos;s daily limits bound what a key can spend, even one that leaks.
      </p>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <div className="field">
          <label htmlFor={`${id}-key`}>API key</label>
          <p id={`${id}-hint`} className="hint">
            It starts with <code>ptl_live_</code>.
          </p>
          <input
            id={`${id}-key`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
            aria-invalid={error ? true : undefined}
          />
          {error ? (
            <div id={`${id}-error`} className="field-error" role="alert">
              <p>{error.message}</p>
              {error.requestId ? (
                <p className="hint">
                  Request ID <code>{error.requestId}</code>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="field">
          <label className="check">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            Remember the key on this device
          </label>
          <p className="hint">
            Otherwise it is kept in this tab only, until you close it. Leave this unticked on a computer you share.
          </p>
        </div>
        <button type="submit" className="button primary" disabled={busy}>
          {busy ? "Checking the key…" : "Use this key"}
        </button>
      </form>
      <p className="hint">
        The key goes only to this site, over HTTPS, whose function passes it on to Petiole with each call and never
        keeps it.
      </p>
    </section>
  );
}
