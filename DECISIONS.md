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
