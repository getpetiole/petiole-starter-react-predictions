// The page's calls, made with the SDK as the page makes them, through the
// site's function, to Prism's mock of the API's spec: Prism refuses any
// request the spec does not allow, and answers as the spec says.
import { readFileSync } from "node:fs";

import { ApiError, Petiole } from "@petiole/sdk";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { specPath } from "../../scripts/prism.mjs";
import { forward } from "../../server/forward.ts";
import { MODEL_ID, ROUTES } from "../../server/routes.ts";
import { knownCodes } from "../../src/lib/messages";
import { PRISM_URL } from "./prism";

const KEY = `ptl_live_${"a1B2".repeat(10)}xyz`;
const SITE = "http://site.test";
const METHODS = ["get", "post", "put", "patch", "delete"];
// The smallest JPEG's bytes do: Prism reads the form, not the photo.
const PHOTO = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9])], {
  type: "image/jpeg",
});

const spec = parse(readFileSync(await specPath(), "utf8"));

function site(siteKey?: string) {
  const lines: string[] = [];
  const upstream: string[] = [];
  const toApi: typeof fetch = (input, init) => {
    upstream.push(String(input));
    return fetch(input, init);
  };
  const call = (request: Request) =>
    forward(request, { apiKey: siteKey, upstream: PRISM_URL, fetch: toApi, log: (line) => lines.push(line) });
  const api = (key: string | null) =>
    new Petiole({ apiKey: key, baseUrl: `${SITE}/api`, maxRetries: 0, fetch: (input, init) => call(new Request(input, init)) });
  return { api, call, lines, upstream };
}

describe("through the site's function", () => {
  it("lists the models with the visitor's key", async () => {
    const { api } = site();
    const list = await api(KEY).models.list({ limit: 100 });
    expect(list.object).toBe("list");
    expect(Array.isArray(list.data)).toBe(true);
  });

  it("lists them with the site's own key when the page sends none", async () => {
    const { api } = site(KEY);
    expect((await api(null).models.list()).object).toBe("list");
  });

  it("refuses a page that sends no key when the site has none, without calling the API", async () => {
    const { api, upstream } = site();
    const error = await api(null).models.list().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("authentication_required");
    expect(upstream).toEqual([]);
  });

  it("gets the model and its state", async () => {
    const { api } = site();
    expect((await api(KEY).models.get(MODEL_ID)).object).toBe("model");
    const status = await api(KEY).models.status(MODEL_ID);
    expect(["ready", "starting", "unavailable"]).toContain(status.status);
  });

  it("predicts on a photo, as the page asks", async () => {
    const { api } = site();
    const prediction = await api(KEY).models.predict(MODEL_ID, PHOTO, { confThreshold: 0.1, maxDetections: 300 });
    expect(prediction.object).toBe("prediction");
    expect(Array.isArray(prediction.detections)).toBe(true);
  });

  it("refuses every other route of the API, and tricks, without calling the API", async () => {
    const { call, upstream } = site(KEY);
    const refused: [string, string][] = [];
    for (const [template, item] of Object.entries<Record<string, unknown>>(spec.paths)) {
      const path = template.replace(/\{[^}]+\}/g, "x");
      for (const method of METHODS.filter((each) => each in item).map((each) => each.toUpperCase())) {
        if (!ROUTES.some((route) => route.method === method && route.path === path)) refused.push([method, `/api${path}`]);
      }
    }
    refused.push(
      ["GET", "/api/v1/models/sam2-small/status"],
      ["POST", "/api/v1/models/sam2-small/predictions"],
      ["GET", `/api/v1/models/${MODEL_ID}/../../usage`],
      ["GET", `/api/v1/models/${MODEL_ID}%2Fstatus`],
      ["GET", "/v1/models"],
      ["DELETE", "/api/v1/models"],
    );
    expect(refused.length).toBeGreaterThan(10);
    for (const [method, path] of refused) {
      const response = await call(new Request(`${SITE}${path}`, { method, headers: { authorization: `Bearer ${KEY}` } }));
      expect(response.status, `${method} ${path}`).toBe(404);
    }
    expect(upstream).toEqual([]);
  });

  it("logs a line a request, and never the key", async () => {
    const { api, lines } = site(KEY);
    await api(KEY).models.list();
    await api(null).models.status(MODEL_ID);
    await api(KEY).models.predict(MODEL_ID, PHOTO);
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(line).not.toContain(KEY);
      expect(Object.keys(JSON.parse(line)).sort()).toEqual(["method", "ms", "requestId", "route", "status"]);
    }
  });
});

describe("the spec", () => {
  it("has every route the function forwards", () => {
    const templates = Object.keys(spec.paths);
    for (const route of ROUTES) {
      const template = templates.find((each) => new RegExp(`^${each.replace(/\{[^}]+\}/g, "[^/]+")}$`).test(route.path));
      expect(template && spec.paths[template][route.method.toLowerCase()], `${route.method} ${route.path}`).toBeTruthy();
    }
  });

  it("has no error code the page has no words for", () => {
    const codes: string[] = spec.components.schemas.Problem.properties.code["x-extensible-enum"];
    expect(codes.length).toBeGreaterThan(10);
    expect(codes.filter((code) => !knownCodes().includes(code))).toEqual([]);
  });
});
