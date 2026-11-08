// A mock of the Petiole API for the tests, which Prism serves from the API's
// spec as published with the SDK this app depends on: openapi.yaml of
// getpetiole/petiole-sdk-typescript at the tag of the installed
// @petiole/sdk's version. A new SDK brings its spec to the tests with it.
//
// `node scripts/prism.mjs 4010` serves it on 127.0.0.1:4010 (`npm run mock`).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const PRISM = "@stoplight/prism-cli@5.16.0";

const require = createRequire(import.meta.url);

/** The installed SDK's version: the spec's. */
export function sdkVersion() {
  return JSON.parse(readFileSync(require.resolve("@petiole/sdk/package.json"), "utf8")).version;
}

export function specUrl(version = sdkVersion()) {
  return `https://raw.githubusercontent.com/getpetiole/petiole-sdk-typescript/v${version}/openapi.yaml`;
}

/** The spec's path, fetched once per version into node_modules/.cache. */
export async function specPath() {
  const version = sdkVersion();
  const dir = fileURLToPath(new URL("../node_modules/.cache/petiole-openapi/", import.meta.url));
  const file = `${dir}${version}.yaml`;
  if (existsSync(file)) return file;
  const response = await fetch(specUrl(version));
  if (!response.ok) throw new Error(`The spec of @petiole/sdk ${version}, ${specUrl(version)}, answered ${response.status}.`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, await response.text());
  return file;
}

/**
 * Prism on 127.0.0.1:port. Detached, it is in a process group of its own,
 * which is how it is stopped (`process.kill(-pid)`), since npx's child is
 * Prism; otherwise it is in its caller's, and stops with it.
 * @param {number} port
 * @param {{ output?: "ignore" | "inherit", detached?: boolean }} [options]
 * @returns {Promise<import("node:child_process").ChildProcess>}
 */
export async function startPrism(port, { output = "ignore", detached = true } = {}) {
  const spec = await specPath();
  return spawn("npx", ["--yes", PRISM, "mock", "--host", "127.0.0.1", "--port", String(port), "--cors", "false", spec], {
    stdio: ["ignore", output, "inherit"],
    detached,
  });
}

// As a command, Prism stays in this process's group, so whatever stops
// the group, Ctrl-C or Playwright, stops Prism too.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const prism = await startPrism(Number(process.argv[2] ?? 4010), { output: "inherit", detached: false });
  prism.on("exit", (/** @type {number | null} */ code) => process.exit(code ?? 0));
}
