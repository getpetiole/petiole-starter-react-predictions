// A failure, in words, with the request's id to quote to Petiole, and a
// way to try again when there is one. It stays until it is resolved.
import type { Shown } from "../lib/messages";

export function Problem({ title, problem, onRetry }: { title: string; problem: Shown; onRetry?: () => void }) {
  return (
    <div className="problem" role="alert">
      <p className="problem-title">
        <span aria-hidden className="problem-mark">
          !
        </span>
        {title}
      </p>
      <p>{problem.message}</p>
      {problem.requestId ? (
        <p className="hint">
          Request ID <code>{problem.requestId}</code>: quote it if you contact Petiole about this.
        </p>
      ) : null}
      {onRetry ? (
        <button type="button" className="button secondary" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
