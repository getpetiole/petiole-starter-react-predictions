// The function's forwarding, on routes of the test's own and a fake fetch:
// the same in every web starter, whatever its routes.ts holds.
import { describe, expect, it, vi } from "vitest";

import { crossSite, forward, type ForwardOptions } from "./forward.ts";
import { NAME, type Route } from "./routes.ts";

const ROUTES: Route[] = [
  { method: "GET", path: "/v1/things", query: ["limit", "startingAfter"] },
  { method: "GET", path: "/v1/things/one/status" },
  { method: "POST", path: "/v1/things/one/predictions", body: true },
];

const KEY = "ptl_live_visitor";
const SITE_KEY = "ptl_live_site";
const SITE = "http://site.test";

function request(path: string, init: RequestInit = {}) {
  return new Request(`${SITE}${path}`, init);
}

function api(response: () => Response = () => Response.json({ object: "list", data: [], hasMore: false })) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return response();
  });
  return { calls, fetch: fetch as unknown as typeof globalThis.fetch };
}

function options(extra: Partial<ForwardOptions> & { fetch: typeof fetch }): ForwardOptions & { lines: string[] } {
  const lines: string[] = [];
  return { routes: ROUTES, upstream: "https://api.test", log: (line) => lines.push(line), lines, ...extra };
}

describe("forward", () => {
  it("sends a route on with the visitor's key, the route's own query and the headers it needs", async () => {
    const { calls, fetch } = api();
    const response = await forward(
      request("/api/v1/things?limit=100&startingAfter=thing&secret=1", {
        headers: { authorization: `Bearer ${KEY}`, accept: "application/json", cookie: "a=b", "x-forwarded-for": "1.2.3.4" },
      }),
      options({ fetch }),
    );
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.test/v1/things?limit=100&startingAfter=thing");
    const headers = new Headers(calls[0].init.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${KEY}`);
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("user-agent")).toBe(NAME);
    expect(headers.has("cookie")).toBe(false);
    expect(headers.has("x-forwarded-for")).toBe(false);
    expect(calls[0].init.redirect).toBe("manual");
  });

  it("uses the site's own key for a request that brings none, and the visitor's over it", async () => {
    const { calls, fetch } = api();
    await forward(request("/api/v1/things"), options({ fetch, apiKey: SITE_KEY }));
    await forward(request("/api/v1/things", { headers: { authorization: `Bearer ${KEY}` } }), options({ fetch, apiKey: SITE_KEY }));
    expect(calls.map((call) => new Headers(call.init.headers).get("authorization"))).toEqual([
      `Bearer ${SITE_KEY}`,
      `Bearer ${KEY}`,
    ]);
  });

  it("asks for a key when there is none, without calling the API", async () => {
    const { calls, fetch } = api();
    const response = await forward(request("/api/v1/things"), options({ fetch }));
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    const body = await response.json();
    expect(body).toMatchObject({ status: 401, code: "authentication_required" });
    expect(body.requestId).toMatch(/^fn_/);
    expect(response.headers.get("request-id")).toBe(body.requestId);
    expect(calls).toEqual([]);
  });

  it("refuses a bearer that is not an API key", async () => {
    const { calls, fetch } = api();
    const response = await forward(
      request("/api/v1/things", { headers: { authorization: "Bearer eyJhbGciOiJSUzI1NiJ9.session" } }),
      options({ fetch, apiKey: SITE_KEY }),
    );
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("invalid_api_key");
    expect(calls).toEqual([]);
  });

  it("refuses any other route or method", async () => {
    const { calls, fetch } = api();
    for (const [method, path] of [
      ["GET", "/api/v1/analyses"],
      ["POST", "/api/v1/things"],
      ["GET", "/api/v1/things/one/predictions"],
      ["POST", "/api/v1/things/one/status"],
      ["GET", "/api/v1/things/two/status"],
      ["GET", "/api/v1/things/"],
      ["GET", "/api/v1/things/one/../../usage"],
      ["GET", "/api"],
      ["GET", "/apiv1/things"],
      ["GET", "/v1/things"],
    ]) {
      const response = await forward(request(path, { method, headers: { authorization: `Bearer ${KEY}` } }), options({ fetch }));
      expect(response.status, `${method} ${path}`).toBe(404);
    }
    expect(calls).toEqual([]);
  });

  it("refuses a call from another site's page", async () => {
    const { calls, fetch } = api();
    const response = await forward(
      request("/api/v1/things/one/predictions", { method: "POST", headers: { "sec-fetch-site": "cross-site" } }),
      options({ fetch, apiKey: SITE_KEY }),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("cross_site_request");
    expect(calls).toEqual([]);
  });

  it("tells the site's own pages from others' by Sec-Fetch-Site", () => {
    expect(crossSite(new Headers())).toBe(false);
    expect(crossSite(new Headers({ "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(crossSite(new Headers({ "sec-fetch-site": "none" }))).toBe(false);
    expect(crossSite(new Headers({ "sec-fetch-site": "same-site" }))).toBe(true);
    expect(crossSite(new Headers({ "sec-fetch-site": "cross-site" }))).toBe(true);
  });

  it("sends a photo's body on as it came", async () => {
    const { calls, fetch } = api(() => Response.json({ object: "prediction" }));
    const form = new FormData();
    form.set("image", new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }), "leaf.jpg");
    const sent = new Request(`${SITE}/api/v1/things/one/predictions`, {
      method: "POST",
      headers: { authorization: `Bearer ${KEY}`, "idempotency-key": "k1" },
      body: form,
    });
    const type = sent.headers.get("content-type");
    const bytes = await sent.clone().arrayBuffer();
    await forward(sent, options({ fetch }));
    expect(calls[0].init.method).toBe("POST");
    expect(new Headers(calls[0].init.headers).get("content-type")).toBe(type);
    expect(new Headers(calls[0].init.headers).get("idempotency-key")).toBe("k1");
    expect(new Uint8Array(calls[0].init.body as ArrayBuffer)).toEqual(new Uint8Array(bytes));
  });

  it("refuses a body larger than Netlify takes", async () => {
    const { calls, fetch } = api();
    const response = await forward(
      request("/api/v1/things/one/predictions", {
        method: "POST",
        headers: { authorization: `Bearer ${KEY}`, "content-type": "application/octet-stream" },
        body: new Uint8Array(6 * 1024 * 1024 + 1),
      }),
      options({ fetch }),
    );
    expect(response.status).toBe(413);
    expect(calls).toEqual([]);
  });

  it("passes the API's problem on as it is, with the headers the page needs", async () => {
    const problem = { type: "https://docs.petiole.pro/errors/model_starting", title: "Starting", status: 503, code: "model_starting", requestId: "req_1" };
    const { fetch } = api(
      () =>
        new Response(JSON.stringify(problem), {
          status: 503,
          headers: { "content-type": "application/problem+json", "retry-after": "15", "request-id": "req_1", "set-cookie": "x=y", server: "gws" },
        }),
    );
    const response = await forward(
      request("/api/v1/things/one/status", { headers: { authorization: `Bearer ${KEY}` } }),
      options({ fetch }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(problem);
    expect(response.headers.get("retry-after")).toBe("15");
    expect(response.headers.get("request-id")).toBe("req_1");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(response.headers.has("server")).toBe(false);
  });

  it("answers 502 when the API cannot be reached, and 504 when it takes too long", async () => {
    const unreachable = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const slow = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))),
    ) as unknown as typeof fetch;
    const headers = { authorization: `Bearer ${KEY}` };
    const failed = await forward(request("/api/v1/things", { headers }), options({ fetch: unreachable }));
    expect(failed.status).toBe(502);
    expect((await failed.json()).code).toBe("api_unreachable");
    const late = await forward(request("/api/v1/things", { headers }), options({ fetch: slow, timeoutMs: 20 }));
    expect(late.status).toBe(504);
    expect((await late.json()).code).toBe("api_timeout");
  });

  it("logs one line a request, with neither the key nor the query", async () => {
    const { fetch } = api(() => Response.json({}, { headers: { "request-id": "req_2" } }));
    const sent = options({ fetch, apiKey: SITE_KEY });
    await forward(request("/api/v1/things?limit=5", { headers: { authorization: `Bearer ${KEY}` } }), sent);
    await forward(request("/api/v1/nothing"), sent);
    expect(sent.lines.map((line) => JSON.parse(line))).toEqual([
      { method: "GET", route: "/v1/things", status: 200, ms: expect.any(Number), requestId: "req_2" },
      { method: "GET", route: "not forwarded", status: 404, ms: expect.any(Number), requestId: expect.stringMatching(/^fn_/) },
    ]);
    expect(sent.lines.join("\n")).not.toMatch(/ptl_|limit/);
  });
});
