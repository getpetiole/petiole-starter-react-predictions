// The app: the key first, checked against the API, which also says the
// models it may use. A starter puts what it does where the list of models
// is.
import { ApiError, type Model } from "@petiole/sdk";
import { useEffect, useState } from "react";

import { KeyPanel } from "./components/KeyPanel";
import { Problem } from "./components/Problem";
import { clearKey, type KeyPlace, readKey, saveKey } from "./lib/key";
import { type Shown, shown } from "./lib/messages";
import { petiole } from "./lib/petiole";

type Access =
  | { kind: "checking" }
  | { kind: "key"; problem: Shown | null }
  | { kind: "failed"; problem: Shown }
  /** place: where the key is kept; "site" for the site's own key, "page"
   * for one the browser would not keep. */
  | { kind: "open"; key: string | null; place: KeyPlace | "site" | "page"; models: Model[] };

/** What a key for this app needs. */
const NEEDS = "the workflows it calls";

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

  return (
    <>
      <header className="top">
        <p className="brand">
          <span aria-hidden className="mark" />
          Petiole API starter
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
        <h1>A Petiole API starter</h1>
        <p className="lede">An app on the Petiole API, made from the starters&apos; skeleton.</p>

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
        {access.kind === "open" ? (
          <section className="card" aria-labelledby="models-title">
            <h2 id="models-title">Your key works</h2>
            {access.models.length ? (
              <>
                <p>It may use these models:</p>
                <ul>
                  {access.models.map((model) => (
                    <li key={model.id}>
                      {model.name}: {model.description}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>It may use no models: its scopes include no workflow that runs one.</p>
            )}
          </section>
        ) : null}
      </main>

      <footer className="bottom">
        <p className="hint">Calls the Petiole API through this site&apos;s own function. Open source under MIT.</p>
      </footer>
    </>
  );
}
