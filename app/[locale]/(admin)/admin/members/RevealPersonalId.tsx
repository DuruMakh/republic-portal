"use client";

import { useState } from "react";
import type { RevealResult } from "./actions";

/**
 * Masked personal ID with deliberate, audited reveal (spec decision #5).
 * The server action is injected as a prop — testable without module mocks.
 */
export function RevealPersonalId({
  memberId,
  reveal,
}: {
  memberId: string;
  reveal: (memberId: string) => Promise<RevealResult>;
}) {
  const [state, setState] = useState<
    | { kind: "masked"; busy: boolean; error: string | null }
    | { kind: "revealed"; personalId: string | null }
  >({ kind: "masked", busy: false, error: null });

  async function onReveal() {
    setState({ kind: "masked", busy: true, error: null });
    const result = await reveal(memberId);
    if (result.ok) setState({ kind: "revealed", personalId: result.personalId });
    else setState({ kind: "masked", busy: false, error: result.error });
  }

  if (state.kind === "revealed") {
    return <span className="font-mono text-sm text-ink">{state.personalId ?? "—"}</span>;
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="text-muted-fg">
        •••••••••••
      </span>
      <button
        type="button"
        onClick={onReveal}
        disabled={state.busy}
        className="text-xs font-semibold text-brand hover:underline disabled:opacity-50"
      >
        ჩვენება
      </button>
      {state.error ? <span className="text-xs text-danger">{state.error}</span> : null}
    </span>
  );
}
