// The app: the key first, checked against the API, which also says the
// organisation's models; then the leaf detector on a photo.
import { ApiError, type Model } from "@petiole/sdk";
import { useEffect, useMemo, useState } from "react";

import { Detector } from "./components/Detector";
import { KeyPanel } from "./components/KeyPanel";
import { Problem } from "./components/Problem";
import { clearKey, type KeyPlace, readKey, saveKey } from "./lib/key";
import { messageFor, type Shown, shown } from "./lib/messages";
import { MODEL_ID } from "./lib/model";
import { KEYS_URL, petiole } from "./lib/petiole";

type Access =
  | { kind: "checking" }
  | { kind: "key"; problem: Shown | null }
  | { kind: "failed"; problem: Shown }
  /** place: where the key is kept; "site" for the site's own key, "page"
   * for one the browser would not keep. */
  | { kind: "open"; key: string | null; place: KeyPlace | "site" | "page"; models: Model[] };

/** What a key for this app needs. */
const NEEDS = "the Leaf area workflow, which runs the leaf detector,";

const WHERE: Record<Exclude<Extract<Access, { kind: "open" }>["place"], "site">, string> = {
  tab: "Your key is kept in this tab.",
  device: "Your key is kept on this device.",
  page: "Your key is kept until you reload the page: this browser keeps nothing.",
};

async function models(key: string | null): Promise<Model[]> {
  return (await petiole(key).models.list({ limit: 100 })).data;
}

/** What opens with the key kept from before, or with none, which the
 * site's own key answers when it has one. */
async function opening(): Promise<Access> {
  const stored = readKey();
  try {
    const list = await models(stored?.key ?? null);
    return { kind: "open", key: stored?.key ?? null, place: stored?.place ?? "site", models: list };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      if (stored) clearKey();
      return { kind: "key", problem: stored ? shown(error) : null };
    }
    return { kind: "failed", problem: shown(error) };
  }
}

export function App() {
  const [access, setAccess] = useState<Access>({ kind: "checking" });

  useEffect(() => {
    let live = true;
    void opening().then((next) => {
      if (live) setAccess(next);
    });
    return () => {
      live = false;
    };
  }, []);

  async function tryKey(key: string, remember: boolean): Promise<Shown | null> {
    try {
      const list = await models(key);
      const kept = saveKey(key, remember ? "device" : "tab");
      setAccess({ kind: "open", key, place: kept ? (remember ? "device" : "tab") : "page", models: list });
      return null;
    } catch (error) {
      return shown(error);
    }
  }

  function forget() {
    clearKey();
    setAccess({ kind: "key", problem: null });
  }

  const key = access.kind === "open" ? access.key : null;
  const api = useMemo(() => petiole(key), [key]);
  const model = access.kind === "open" ? access.models.find((each) => each.id === MODEL_ID) : undefined;

  return (
    <>
      <header className="top">
        <p className="brand">
          <span aria-hidden className="mark" />
          Leaf detector
        </p>
        {access.kind === "open" ? (
          <div className="key-state">
            {access.place === "site" ? (
              <p className="hint">This site calls Petiole with its own API key.</p>
            ) : (
              <>
                <p className="hint">{WHERE[access.place]}</p>
                <button type="button" className="button text" onClick={forget}>
                  Forget the key
                </button>
              </>
            )}
          </div>
        ) : null}
      </header>

      <main className="page">
        <h1>Find the leaves in a photo</h1>
        <p className="lede">
          The Petiole API&apos;s leaf detector finds each leaf in a photo and puts a box around it, with its confidence.
        </p>

        {access.kind === "checking" ? <p aria-live="polite">Checking the key…</p> : null}
        {access.kind === "failed" ? (
          <Problem
            title="Petiole couldn't be reached"
            problem={access.problem}
            onRetry={() => {
              setAccess({ kind: "checking" });
              void opening().then(setAccess);
            }}
          />
        ) : null}
        {access.kind === "key" ? <KeyPanel needs={NEEDS} problem={access.problem} onKey={tryKey} /> : null}
        {access.kind === "open" && model && model.callable ? <Detector api={api} model={model} /> : null}
        {access.kind === "open" && (!model || !model.callable) ? (
          <Problem
            title="This key can't use the leaf detector"
            problem={{
              message: model
                ? messageFor("model_not_callable", 409)
                : "Its organisation's workflows don't run the leaf detector, or the key's scopes leave them out. Make a key with the Leaf area workflow on Keys & access.",
              requestId: null,
              code: null,
            }}
          />
        ) : null}
        {access.kind === "open" && !model && access.place !== "site" ? (
          <p>
            <a href={KEYS_URL}>Make a key on Keys &amp; access</a>, then{" "}
            <button type="button" className="button text" onClick={forget}>
              use another key
            </button>
            .
          </p>
        ) : null}
      </main>

      <footer className="bottom">
        <p className="hint">
          Calls the Petiole API through this site&apos;s own function. Open source under MIT:{" "}
          <a href="https://github.com/getpetiole/petiole-starter-react-predictions">copy it to build your own</a>.
        </p>
      </footer>
    </>
  );
}
