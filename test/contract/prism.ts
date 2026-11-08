// Starts the Prism mock of the API's spec on 127.0.0.1:4011 for the contract
// tests, and stops it after them.
import type { ChildProcess } from "node:child_process";

import { startPrism } from "../../scripts/prism.mjs";

export const PRISM_URL = "http://127.0.0.1:4011";

let prism: ChildProcess | undefined;

export async function setup() {
  const started = await startPrism(4011);
  prism = started;
  const deadline = Date.now() + 120_000;
  for (;;) {
    try {
      // Any answer will do: without a key Prism's is 401.
      await fetch(`${PRISM_URL}/v1/models`);
      return;
    } catch {
      if (started.exitCode !== null) throw new Error(`Prism exited with ${started.exitCode}`);
      if (Date.now() > deadline) throw new Error("Prism did not start in two minutes");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

export function teardown() {
  if (prism?.pid) process.kill(-prism.pid, "SIGTERM");
}
