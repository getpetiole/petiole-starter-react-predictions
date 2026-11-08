// What a failed call says, in plain words: what went wrong and what to do,
// never the code, and the request's id to quote when asking Petiole about
// it. One message for each of the API's error codes (a contract test keeps
// them in step with the spec), one for each of this site's own, and one by
// HTTP status for a code this app does not know yet.
import { ApiError, ConnectionError, TimeoutError } from "@petiole/sdk";

const KEYS_PAGE = "Keys & access in the Petiole platform";

const BY_CODE: Record<string, string> = {
  // The API's.
  invalid_request: "Something in the request isn't right. Choose the photo again and try again.",
  unknown_workflow: "That workflow doesn't exist.",
  authentication_required: "Enter your API key to carry on.",
  invalid_api_key: `That API key isn't valid. Check it, or make a new one on ${KEYS_PAGE}.`,
  key_expired: `That API key has expired. Make a new one on ${KEYS_PAGE}.`,
  invalid_session: `That isn't an API key. Copy your key again from ${KEYS_PAGE}.`,
  session_expired: `That isn't an API key. Copy your key again from ${KEYS_PAGE}.`,
  workflow_not_allowed: "Your organisation can't use this yet. Contact Petiole to have it turned on.",
  organisation_suspended: "Your organisation's access is paused. Contact Petiole to have it restored.",
  not_a_member: `This key can't do that. Make a key on ${KEYS_PAGE}.`,
  user_required: `This key can't do that. Make a key on ${KEYS_PAGE}.`,
  owner_required: `This key can't do that. Make a key on ${KEYS_PAGE}.`,
  not_found: `Your key can't use this model. Make a key on ${KEYS_PAGE} whose scopes include a workflow that runs it.`,
  method_not_allowed: "That can't be done here. Reload the page and try again.",
  upload_incomplete: "The photo didn't finish uploading. Send it again.",
  analysis_not_ended: "This analysis hasn't finished yet.",
  model_not_callable: "This model runs only inside its workflows for now, so it can't be called on its own.",
  idempotency_key_mismatch: "This was already sent with another photo. Choose the photo again and try again.",
  idempotency_key_in_use: "This photo is already being looked at. Wait a moment, then try again.",
  image_too_large: "The photo is too large. Choose a smaller one.",
  unsupported_media_type: "That file type isn't supported. Choose a JPEG or PNG photo.",
  image_type_not_allowed: "That file type isn't supported. Choose a JPEG or PNG photo.",
  rate_limited: "That was a lot of requests at once. Wait a few seconds, then try again.",
  quota_exceeded:
    "Your organisation has used all of today's allowance, which starts again at midnight UTC. Try again then, or contact Petiole to raise the limit.",
  concurrency_limit_exceeded: "Your organisation has as much running as it can. Wait a moment, then try again.",
  internal_error: "Something went wrong at Petiole. Try again in a minute; if it keeps happening, contact Petiole.",
  not_implemented: "This isn't available yet.",
  service_unavailable: "Part of Petiole didn't answer in time, and nothing was done. Wait a few seconds, then try again.",
  model_starting: "The model was idle and is waking up, which takes up to a minute. Try again shortly.",
  // This site's own (server/forward.ts).
  api_unreachable: "This site can't reach Petiole right now. Wait a moment, then try again.",
  api_timeout: "Petiole took too long to answer. Wait a moment, then try again.",
  cross_site_request: "This site's API takes calls from its own pages only. Reload the page and try again.",
};

const CONNECTION = "This site can't be reached. Check your connection, then try again.";
const TIMEOUT = "There was no answer in time. Check your connection, then try again.";
const PAGE = "Something went wrong in this page. Reload it and try again.";

function byStatus(status: number): string {
  if (status === 401) return BY_CODE.invalid_api_key;
  if (status === 403) return `This key can't do that. Make a key on ${KEYS_PAGE}.`;
  if (status === 404) return BY_CODE.not_found;
  if (status === 413) return BY_CODE.image_too_large;
  if (status === 415) return BY_CODE.unsupported_media_type;
  if (status === 429) return BY_CODE.rate_limited;
  if (status === 503) return BY_CODE.service_unavailable;
  if (status === 504) return BY_CODE.api_timeout;
  if (status >= 500) return BY_CODE.internal_error;
  return BY_CODE.invalid_request;
}

/** The words for a failed call's code and status. */
export function messageFor(code: string | null | undefined, status: number): string {
  return (code && BY_CODE[code]) || byStatus(status);
}

/** The codes that have words of their own. */
export function knownCodes(): string[] {
  return Object.keys(BY_CODE);
}

/** A failure as the page shows it: the words, and the request's id when
 * the API or this site's function gave one. */
export interface Shown {
  message: string;
  requestId: string | null;
  code: string | null;
}

export function shown(error: unknown): Shown {
  if (error instanceof ApiError) {
    return { message: messageFor(error.code, error.status), requestId: error.requestId ?? null, code: error.code };
  }
  if (error instanceof TimeoutError) return { message: TIMEOUT, requestId: null, code: null };
  if (error instanceof ConnectionError) return { message: CONNECTION, requestId: null, code: null };
  console.error(error);
  return { message: PAGE, requestId: null, code: null };
}
