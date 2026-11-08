import { ApiError, ConnectionError, TimeoutError } from "@petiole/sdk";
import { describe, expect, it, vi } from "vitest";

import { messageFor, shown } from "./messages";

describe("the words for a failure", () => {
  it("are the code's, or the status's for a code this app does not know", () => {
    expect(messageFor("quota_exceeded", 429)).toMatch(/today's allowance/);
    expect(messageFor("a_code_from_later", 429)).toMatch(/a lot of requests/);
    expect(messageFor("unexpected_response", 502)).toMatch(/went wrong at Petiole/);
    expect(messageFor(null, 413)).toMatch(/too large/);
  });

  it("never show the code itself", () => {
    expect(messageFor("model_starting", 503)).not.toContain("model_starting");
  });

  it("carry the request's id to quote", () => {
    const problem = { type: "t", title: "Not valid", status: 401, code: "invalid_api_key", requestId: "req_01" };
    const error = new ApiError(401, problem, "req_01");
    expect(shown(error)).toEqual({ message: messageFor("invalid_api_key", 401), requestId: "req_01", code: "invalid_api_key" });
  });

  it("say when the site cannot be reached or does not answer", () => {
    expect(shown(new ConnectionError("down")).message).toMatch(/can't be reached/);
    expect(shown(new TimeoutError("slow")).message).toMatch(/no answer in time/);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(shown(new Error("bug")).message).toMatch(/Reload/);
    error.mockRestore();
  });
});
