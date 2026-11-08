// What this site's function sends on to the Petiole API: these routes, and
// nothing else. The app calls one model, the leaf detector. To call
// another, add its routes here; the function refuses everything else.

/** This starter, as the function names itself to the API (User-Agent). */
export const NAME = "petiole-starter-react-predictions";

/** The model the app calls. */
export const MODEL_ID = "leaf-detector";

export interface Route {
  method: "GET" | "POST";
  /** The API's path, exactly. */
  path: string;
  /** The query parameters sent on, if any. */
  query?: readonly string[];
  /** Whether the request's body is sent on. */
  body?: boolean;
}

export const ROUTES: readonly Route[] = [
  // The key checked, and the models it may call.
  { method: "GET", path: "/v1/models", query: ["limit", "startingAfter"] },
  { method: "GET", path: `/v1/models/${MODEL_ID}` },
  // Whether the model can answer now. Asking wakes it.
  { method: "GET", path: `/v1/models/${MODEL_ID}/status` },
  // A photo, and what the model found in it.
  { method: "POST", path: `/v1/models/${MODEL_ID}/predictions`, body: true },
];
