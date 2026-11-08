// /api/* in Vite's dev and preview servers, as the Netlify Function answers
// it on Netlify (server/forward.ts), so `npm run dev` needs nothing but
// Node; and the site's headers from netlify.toml in the preview server, so
// the end-to-end tests run under the same Content Security Policy.
import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { Plugin } from "vite";

import { forward, type ForwardOptions } from "./forward.ts";

export function petioleApi(options: ForwardOptions): Plugin {
  const middleware = (request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) => {
    if (!request.url?.startsWith("/api/")) {
      next();
      return;
    }
    answer(request, response, options).catch(next);
  };
  return {
    name: "petiole-api",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

async function answer(incoming: IncomingMessage, outgoing: ServerResponse, options: ForwardOptions) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of incoming) chunks.push(chunk as Buffer);
  const method = incoming.method ?? "GET";
  const request = new Request(new URL(incoming.url ?? "/", "http://localhost"), {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks),
  });
  const response = await forward(request, options);
  outgoing.statusCode = response.status;
  response.headers.forEach((value, name) => outgoing.setHeader(name, value));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}

/** The headers netlify.toml gives every page, from its [headers.values]. */
export function netlifyHeaders(file = new URL("../netlify.toml", import.meta.url)): Record<string, string> {
  const headers: Record<string, string> = {};
  let inValues = false;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[")) inValues = trimmed === "[headers.values]";
    const header = inValues ? /^([A-Za-z-]+)\s*=\s*"(.*)"$/.exec(trimmed) : null;
    if (header) headers[header[1]] = header[2];
  }
  return headers;
}
