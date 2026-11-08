// What this site's function sends on to the Petiole API: these routes, and
// nothing else. A starter adds the routes its app calls; the function
// refuses everything else.

/** This starter, as the function names itself to the API (User-Agent):
 * its repository's name. */
export const NAME = "petiole-starter-react-skeleton";

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
];
