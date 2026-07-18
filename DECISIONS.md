# Decisions (append-only ADR log)

## ADR-001 (2026-07-12): Stack = Next.js + TypeScript + Supabase + Vercel

AI is the only engineer → choose the stack AI is most fluent in. Supabase gives Postgres,
phone-OTP auth with pluggable SMS hook, storage, RLS. Vercel gives per-PR previews (the
owner sign-off mechanism). Alternatives: Django (fights PWA/interactive funnel), SvelteKit
(less AI fluency).

## ADR-002 (2026-07-12): PWA-first mobile; Capacitor wrap later

One codebase. Store apps only when presence matters — no rewrite required.

## ADR-003 (2026-07-12): v1 payments are manual bank transfers

Finance admin records transfers matched by per-member reference codes; statuses derive
from recorded payments. A gateway later is just another `source` value.

## ADR-004 (2026-07-12): Staged OTP delivery

Send-SMS hook architecture from day one; dev/staging delivers to dev_otp_inbox
(on-screen); production switches the hook to a Georgian SMS provider before launch.

## ADR-005 (2026-07-12): No Docker; staging cloud project is the dev database

Owner machine stays simple. Migrations via supabase CLI against staging, then prod.
Unit tests never touch the DB (pure lib/); e2e runs against staging.

## ADR-006 (2026-07-12): Personal IDs rely on platform at-rest encryption + RLS + audit

Column-level encryption deferred; revisit at Phase 6 /cso audit before public launch.

## ADR-007 (2026-07-13): Version baseline = current stable majors

Scaffold upgraded to Next 16 + TypeScript 6 at foundation time ("floors, not pins").
Consequences recorded for future work: Turbopack is the default for dev AND build
(webpack-plugin-based tools like @serwist/next need Turbopack-aware setup);
middleware.ts is deprecated in favor of proxy.ts; `next lint` is removed (CI runs
`eslint .`). ESLint held at 9.x because eslint-config-next's bundled plugins peer-cap
at ^9 — revisit when eslint-config-next supports ESLint 10.

## ADR-008 (2026-07-13): PWA service worker built by hand-rolled esbuild step, not @serwist/next

@serwist/next's Next.js integration is a webpack plugin (`withSerwistInit` wraps
`next.config.ts` and hooks webpack compilation) and does not support Turbopack builds
in its current stable release (9.5.11, npm dist-tag `latest`). Turbopack support only
exists via `@serwist/turbopack`, published solely under the `10.0.0-preview.*` line
(latest: `10.0.0-preview.14`, dist-tag `preview`, last published 10 months ago) — an
unreleased, unmaintained-looking preview, not something to depend on for a foundation
scaffold. Confirmed via serwist.pages.dev docs and `npm view @serwist/turbopack`/`serwist`.

Instead: `app/sw.ts` (hand-written) imports the framework-agnostic `Serwist` runtime
class from `serwist` and `defaultCache` from `@serwist/next/worker` (a pure
`RuntimeCaching[]` config, no webpack coupling — matches only on request URL/headers,
so it's correct regardless of bundler). `scripts/build-sw.mjs` bundles it with esbuild
into `public/sw.js` as a `postbuild` step (npm's implicit hook after `build`), so it
never runs during `next dev` or affects the Turbopack build graph. Precache entries are
a small hand-picked list of stable app-shell URLs (`/`, `/offline`, icons, manifest)
rather than a generated content-hash manifest of `.next/static` — `@serwist/build`'s
`injectManifest` doesn't bundle its input and Turbopack's static output layout isn't
documented for third-party manifest tooling, so hand-picking avoids depending on
undocumented internals. `ServiceWorkerRegistration` (client component in
`app/layout.tsx`) only calls `navigator.serviceWorker.register()` when
`NODE_ENV === "production"`, so the worker is inert in dev even if a stale
`public/sw.js` exists on disk from an earlier build. `public/sw.js` stays gitignored
and eslint-ignored (generated artifact, rebuilt every production build).

New dependency: `esbuild` (devDependency, pinned `^0.28.1` — already present in the
tree as a transitive dependency at that exact version, so this made it explicit
rather than implicit) — used only by `scripts/build-sw.mjs`.

## ADR-009 (2026-07-15): Funnel mutations are SECURITY DEFINER Postgres RPCs

Every registration-funnel write (funnel_start / funnel_save_profile / funnel_complete) is
one definer function: atomic by construction, subject always auth.uid(), all validation
re-checked in-DB, exposed to `authenticated` only. Server actions stay thin (zod parse +
RPC call + Georgian error mapping). Rejected: service-role TS orchestration (multi-write
non-atomic without a pg driver dependency) and client-direct writes under RLS (violates
server-source-of-truth). Rider: the client `update` grant on `profiles` is revoked — no
legitimate direct client write path remains until Phase 3's scoped cabinet editing.
Note (deferred from Phase 0): the composite FK `profiles(city_id, region_id)` uses MATCH
SIMPLE, so a partial update (one column NULL) would bypass the city-in-region pairing;
acceptable because the funnel RPC always writes both together and validates the pair.

## ADR-010 (2026-07-15): Payment reference codes are platform-issued, not personal IDs

Members get a permanent random `GR-XXXXXX` code (31-char Crockford-style alphabet, no
I/L/O/0/1) generated in-DB at funnel completion; new delegates' referral codes use the
same generator (6 chars, no prefix; seeded `D#####` codes coexist). The owner explicitly
rejected personal-ID-as-reference after a data-protection briefing (IDs would leak into
bank statements and finance tooling). Bank recipient details ship as clearly-marked
placeholders in `lib/bank-details.ts` until the owner opens the account (launch-checklist
item; swapping = editing that one module).

## ADR-012 (2026-07-16): Typed Supabase clients omit the ssr helpers' own `<Database>` generic

`lib/supabase/types.ts` hand-maintains the `Database` type (ADR-005: no `supabase gen types`
without local Docker). Wiring it into the five client factories (Phase 3 hygiene item) surfaced
a real dependency-version-skew bug, not a `types.ts` drift issue: `@supabase/ssr@0.6.1`'s
`createBrowserClient`/`createServerClient` `.d.ts` files import `GenericSchema` from
`"@supabase/supabase-js/dist/module/lib/types"`, a path that no longer exists in the installed
`@supabase/supabase-js@2.110.2` (its build output was restructured to a flat `dist/index.d.mts`).
`skipLibCheck: true` (tsconfig) silences the resulting unresolved-module error inside that `.d.ts`
rather than failing the build, and the import silently resolves to `any`; that `any` then flows
into ssr's `SupabaseClient<Database, SchemaName, Schema>` return-type expression and lands in the
wrong positional slot against the current (also restructured) `SupabaseClient` class signature —
RPC argument objects were typed as unassignable to `undefined`, and every table/view row typed as
`never`. Confirmed by isolated repro: calling the _same_ `@supabase/supabase-js` `createClient`
(used unmodified by `lib/supabase/admin.ts` and `lib/supabase/public.ts`) with `<Database>` types
correctly; only the three `@supabase/ssr`-routed factories (`client.ts`, `server.ts`,
`middleware.ts`) were affected.

Fix: those three factories call `createBrowserClient`/`createServerClient` **without** an explicit
`<Database>` argument, and instead type the function's return (`client.ts`, `server.ts`) or the
local variable (`middleware.ts`) as `SupabaseClient<Database>` — imported directly from
`@supabase/supabase-js`, whose own default type-parameter resolution is unaffected by ssr's broken
passthrough. Since ssr's un-parameterized return type involves `any` throughout, the assignment to
the explicitly-typed target succeeds without a cast. Zero runtime difference (same function calls,
same arguments); purely a types-only workaround. Rejected: bumping `@supabase/ssr` to a version
whose `.d.ts` no longer deep-imports the old path — `0.6.1` → latest (`0.12.3`) is a 6-minor-version
jump with real behavioral changes upstream (cookie handling, `get`/`set`/`remove` deprecation) that
this types-only task's "behavior must not change" constraint rules out; revisit as its own
reviewed/tested upgrade.

## ADR-013 (2026-07-15): Cabinet DB access is a mixed model — scoped grant + definer RPCs

Phase 2 revoked the blanket client `update` on profiles and kept the "own profile
updatable" RLS policy dormant for exactly this phase. Phase 3 re-grants `UPDATE`
on precisely (first_name, last_name, region_id, city_id, employment): three
independent locks — the column-scoped grant (any other column is 42501), the
own-row RLS policy, and the protect_profile_columns() trigger as depth against
future grant-widening. Everything compound or protected stays SECURITY DEFINER
RPCs per ADR-009: member_change_delegate (atomic close-then-open membership
history), member_change_tier (trigger-protected column), delegate_panel /
delegate_team (own-delegates-row-gated reads; referral codes stay out of every
table grant and public view). Rejected: all-RPC uniformity (wastes the prepared
RLS path and adds definer surface for single-column own-row writes) and
client-direct membership writes (close/open is not atomic from the client).

## ADR-011 (2026-07-15): QR codes via `uqr` (first new dependency since zod)

The delegate panel needs a QR of the referral link (parent spec §6). Writing a
QR encoder is wheel-reinvention with real failure modes; `uqr` (MIT, unjs) is
zero-dependency, TypeScript-native ESM with a pure `renderSVG(value): string` —
no canvas, no DOM, works identically in jsdom tests and the browser. Rejected:
`qrcode` (drags pngjs/dijkstrajs and server-canvas paths we don't need),
`qrcode-generator` (venerable but untyped UMD-global style). Rendered client-side
so the encoded origin is the one the delegate is actually on
(window.location.origin — previews encode the preview URL, production the real one).

## ADR-014 (2026-07-17): Admin access = self-gating definer views + in-transaction-audit RPCs

Admin reads are owner-executed views that check has_any_admin_role(auth.uid()) in
their WHERE — non-admins get zero rows — and physically exclude personal_id and
birth_date. Admin mutations are SECURITY DEFINER RPCs: role check first, all
effects plus the audit_log insert in ONE transaction, so an unaudited admin action
is unrepresentable. Rider: the blanket authenticated SELECT grant on profiles was
narrowed to an explicit column list without personal_id/birth_date (verified: no
client-path code ever read them — they are write-only through funnel_save_profile).
Exactly two audited paths return a personal ID: the reveal RPCs
(admin_reveal_personal_id — super_admin; admin_reveal_applicant_personal_id —
verifier scope) and admin_export_members with p_include_ids (super_admin).
Rejected: service-role reads behind app checks (one forgotten check = full
exposure, no DB backstop) and all-RPC reads (hand-wired filter/paging plumbing for
zero extra safety over self-gating views). Operational consequence: audit_log
actors are permanent (plain FK + append-only trigger blocks even ON DELETE SET
NULL), so e2e/probe users must never act as admins — canonical seeded admins
(+99550900000{1..4}) do; targets are stored as text and stay deletable; the
staging seed skips the canonical admins in its wipe for the same reason. The very
first super_admin is bootstrapped by `scripts/grant-admin.mjs` (service role,
completed members only), which writes the same `admin.grant_role` audit row with
a null actor and a `via` marker — bootstrap grants stay visible in the viewer.

## ADR-015 (2026-07-17): Active-member engine — 30-day months, snapshot tiers, grace, nightly sweep

months = greatest(1, floor(amount_gel / tier_gel_at_payment)) as a GENERATED
STORED column — tier snapshotted at recording so later tier changes never rewrite
history. Coverage folds payments in paid_at order:
end = greatest(prev_end, paid_at) + months × 30 days; a member is active while
current_date ≤ end + active_grace_days (app_settings, default 30 → a single
monthly payment = exactly 60 days, the owner's chosen window). lib/active.ts
mirrors the SQL; the schema probe replays the shared fixtures against both.
profiles.status is written ONLY by the engine (plus the funnel's
draft→profile_completed); the seed now writes payment histories and derives.
Payments are immutable — corrections are voids (voided_at/by/reason, audited,
required reason). Duplicate protection is two-layer: referenced (single-entry)
payments hit the live-rows-only unique index on bank_reference (a voided
reference is reusable), and bulk rows — which carry no reference — are guarded
in-RPC by a live member+amount+date check, so a double-pasted statement is
unrecordable on either path. payments.member_id now cascades on profile deletion (e2e/staging
cleanup; the platform has no member-deletion flow; audit targets are text).
Expiry runs nightly via pg_cron ('active-member-sweep', 01:00 UTC = 05:00
Tbilisi), auditing system.active_sweep with the demoted count.

## ADR-016 (2026-07-18): Post-review hardening batch (v0.5.0 fix pass)

An adversarial 10-angle review of the Phase 4 branch confirmed 26 defects; all
were fixed pre-release. Decisions worth recording:

- **Tbilisi is THE day source, in SQL too.** All RPC date windows and the
  active-member engine now call tbilisi_today() ((now() at time zone
  'Asia/Tbilisi')::date) instead of current_date (UTC session day). Previously
  a payment dated "today" was rejected between 00:00 and 04:00 Tbilisi and
  active-ness flipped 4h late; TS (todayTbilisiIso) and SQL now agree at every
  hour. One TBILISI_OFFSET_MS constant (lib/cabinet.ts) feeds every TS helper.
- **Reference-less payments get the member+amount+date duplicate backstop in
  admin_record_payment too** — the live-ref unique index cannot see NULL
  references, and the reference field is optional, so the same transfer entered
  twice with the field blank double-credited a member. Distinct same-day
  same-amount transfers stay recordable: give them their distinct bank refs.
- **Approval requires registration_completed_at.** The delegates row exists
  from funnel step 2, so an abandoned applicant could be approved and published
  with no tier and no reference code. The queue view also hides incomplete
  applicants (they reappear the moment they finish step 3).
- **CSV cells are formula-neutralized** (leading = @ tab, and non-numeric +/-,
  prefixed with an apostrophe): member-supplied names must never execute in the
  finance team's Excel (CSV injection). Phones and amounts pass through.
- **payments column privileges**: members read exactly the billing-page columns
  of their own rows; recorded_by / voided_by / void_reason (may name fraud
  suspicions) are admin-view-only. Enforced with a column-level grant.
- **Last-super-admin guard is serialized** with pg_advisory_xact_lock — the
  count check alone was check-then-act under concurrency.
- **serverActions.bodySizeLimit stays 6mb globally** (Next has no per-action
  override; needed by the 5MB photo upload). Accepted exposure: every public
  action also takes 6MB bodies pre-zod. Revisit if uploads move to signed
  direct-to-storage URLs (the deeper fix, deferred).
- **The seed survives real staging life**: it wipes payments outright, skips
  every append-only audit actor (not just the 4 canonical admins), reuses an
  orphaned canonical auth user after a mid-seed crash, and widens the
  approved-delegates assertion by wipe survivors — reseeding can no longer
  brick on FK 23503, "phone already registered", or a QA payment.
