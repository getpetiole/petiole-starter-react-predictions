// The site's own API, /api/*: the browser's calls sent on to the Petiole
// API with an API key, for the routes in routes.ts and nothing else. It
// runs as the Netlify Function netlify/functions/api.ts, and in the dev
// and preview servers (server/vite-plugin.ts).
//
// The API sends no CORS headers, and a key in a page's code could be read
// by any script on the page, so the page calls this instead. The key is the
// visitor's, sent with each call in Authorization, or the site's own,
// PETIOLE_API_KEY, for a private site. It is passed on and never stored or
// logged. The API's answers, its errors included, go back as they came.
import { DEFAULT_BASE_URL } from "@petiole/sdk";

import { NAME, type Route, ROUTES } from "./routes.ts";

export interface ForwardOptions {
  /** The routes sent on: this starter's, routes.ts. */
  routes?: readonly Route[];
  /** The site's own key, PETIOLE_API_KEY, for a request that brings none. */
  apiKey?: string;
  /** The API's URL: production. Tests give a mock's. */
  upstream?: string;
  /** The fetch to call the API with. */
  fetch?: typeof fetch;
  /** How long the API is given, in milliseconds. */
  timeoutMs?: number;
  /** Where each request's line goes: the function's log. */
  log?: (line: string) => void;
}

const PREFIX = "/api";
// Netlify ends a function at 60 s; the API answers within 45 s, even for a
// model that is waking.
const TIMEOUT_MS = 55_000;
// Netlify takes 6 MB a request, and a photo's bytes arrive base64-encoded:
// about 4.5 MB of photo. The browser keeps to that (src/lib/photo.ts).
const MAX_BODY_BYTES = 6 * 1024 * 1024;

const REQUEST_HEADERS = ["accept", "content-type", "idempotency-key"];
const RESPONSE_HEADERS = [
  "content-type",
  "request-id",
  "retry-after",
  "ratelimit-limit",
  "ratelimit-remaining",
  "ratelimit-reset",
];
const KEY = /^Bearer (ptl_\S+)$/;

/** The answer to one request to /api/*. */
export async function forward(request: Request, options: ForwardOptions = {}): Promise<Response> {
  const started = Date.now();
  const log = options.log ?? ((line: string) => console.log(line));
  const id = `fn_${crypto.randomUUID()}`;
  const route = routeOf(request, options.routes ?? ROUTES);
  // One line a request: never a header, a body or a query.
  const answer = (response: Response) => {
    log(
      JSON.stringify({
        method: request.method,
        route: route?.path ?? "not forwarded",
        status: response.status,
        ms: Date.now() - started,
        requestId: response.headers.get("request-id"),
      }),
    );
    return response;
  };

  if (!route) {
    return answer(problem(404, "not_found", "This site sends on only the calls its own app makes.", id));
  }
  if (crossSite(request.headers)) {
    return answer(problem(403, "cross_site_request", "This site's API takes calls from its own pages only.", id));
  }
  const given = request.headers.get("authorization");
  const key = given === null ? options.apiKey : KEY.exec(given)?.[1];
  if (given !== null && !key) {
    return answer(problem(401, "invalid_api_key", "That is not a Petiole API key: one starts with ptl_.", id));
  }
  if (!key) {
    return answer(problem(401, "authentication_required", "Enter a Petiole API key.", id));
  }

  let body: ArrayBuffer | undefined;
  if (route.body) {
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) {
      return answer(problem(413, "image_too_large", "The photo is larger than this site can send on.", id));
    }
  }

  const headers = new Headers({ authorization: `Bearer ${key}`, "user-agent": NAME });
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }

  let upstream: Response;
  try {
    upstream = await (options.fetch ?? fetch)(apiUrl(options.upstream ?? DEFAULT_BASE_URL, route, request), {
      method: route.method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    return answer(
      timedOut
        ? problem(504, "api_timeout", "The Petiole API did not answer in time.", id)
        : problem(502, "api_unreachable", "The Petiole API could not be reached.", id),
    );
  }

  const out = new Headers({ "cache-control": "private, no-store" });
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) out.set(name, value);
  }
  return answer(new Response(await upstream.arrayBuffer(), { status: upstream.status, headers: out }));
}

/** The route a request is for, or undefined when it is not one of routes. */
export function routeOf(request: Request, routes: readonly Route[] = ROUTES): Route | undefined {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith(`${PREFIX}/`)) return undefined;
  const path = pathname.slice(PREFIX.length);
  return routes.find((route) => route.method === request.method && route.path === path);
}

/** Whether the browser says the request comes from another site's page. A
 * page cannot set Sec-Fetch-Site; a script outside a browser has no reason
 * to send it. */
export function crossSite(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site");
  return site !== null && site !== "same-origin" && site !== "none";
}

/** The API's URL for a request: the route's own path, built from ROUTES,
 * never from the request, with only the route's query parameters. */
function apiUrl(base: string, route: Route, request: Request): string {
  const url = new URL(route.path, base);
  const given = new URL(request.url).searchParams;
  for (const name of route.query ?? []) {
    const value = given.get(name);
    if (value !== null) url.searchParams.set(name, value);
  }
  return url.href;
}

/** An error of this site's own, shaped as the API's (problem details). */
export function problem(status: number, code: string, title: string, requestId: string): Response {
  return Response.json(
    { type: `https://docs.petiole.pro/errors/${code}`, title, status, code, requestId },
    {
      status,
      headers: {
        "content-type": "application/problem+json",
        "cache-control": "private, no-store",
        "request-id": requestId,
      },
    },
  );
}
