export type ActorId = `A${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12}`;

export type SurfaceKind =
  "function" | "view" | "table" | "policy" | "trigger" | "action" | "endpoint" | "bucket";

export type Expectation = "allow" | "deny";
export type Verdict = "clear" | "finding" | "needs-live-proof";

export interface Surface {
  readonly id: string;
  readonly kind: SurfaceKind;
  readonly name: string;
  readonly layer: "db" | "app";
  readonly overrides?: Readonly<Partial<Record<ActorId, Expectation>>>;
}

export interface ProbeOutcome {
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly rowCount: number;
}

export interface LedgerRow {
  readonly surfaceId: string;
  readonly actor: ActorId;
  readonly expectation: Expectation;
  readonly ruleDerived: boolean;
  readonly outcome: ProbeOutcome;
  readonly verdict: Verdict;
}
