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

## ADR-017 (2026-07-19): Community content model — visibility views, PK votes, plain-text bodies

News/events/polls extend the Phase 4 lock pattern instead of inventing a new
one: zero client grants on base tables; anon → public_* views (published+public
only) and aggregate-only transparency views; completed members → self-gating
member_* views (registration_completed_at is the DB meaning of „წევრებისთვის");
editor|super_admin → self-gating admin_* views; every editor mutation a
SECURITY DEFINER RPC with its audit row in the same transaction. Member-only
articles render exclusively under /me/news/* — the service worker's NetworkOnly
zone — so shared-device caches never hold them; their covers sit in the public
news-images bucket (delegate-photos model: unguessable UUID paths, illustrative
by policy; private bucket + signed URLs recorded as the later fix). One vote
per member is the poll_votes PRIMARY KEY with a composite FK
(poll_id, option_id) → poll_options — a second vote or a cross-poll option is
unrepresentable; votes are immutable (prototype lock) and results visibility
(voted-or-closed) is enforced IN the poll_option_counts view, with option
LABELS separately member-visible via member_poll_options so ballots can render.
Bodies are plain text (blank-line paragraphs + auto-linked URLs) rendered to
React elements by lib/content-render — no markdown dependency, no stored HTML,
no dangerouslySetInnerHTML; escalate to a markdown subset only via a future
ADR. Slugs romanize titles through the existing lib/slug (national 2002,
apostrophes dropped), mint at first publish, permanent thereafter. Rejected:
RLS-policy-per-table reads (views centralize the visibility rules exactly like
public_delegates/admin_*), stored RSVP/vote counters (derivable — forbidden),
event capacity/waitlists and vote-changing (out of scope v1, spec §9).

## ADR-018 (2026-07-21): Progressive registration — supporter-first funnel, phases renumbered

Owner-driven UX pivot before launch (spec:
docs/superpowers/specs/2026-07-21-progressive-registration-design.md). The public entry
becomes one light registration (name, surname, personal ID, mobile + OTP); becoming a
member moves into the cabinet (profile + delegate choice + tier); delegacy becomes a
member-only one-confirm request feeding the existing verification queue. Key owner
decisions: delegate backing stays a member privilege (referrals remembered silently,
prefilled at upgrade); personal ID stays in the light form (verifiable citizen list);
registered tier gets events + RSVP (mobilization) but not polls/member news/billing;
the public delegate pitch is retired; public counters show registered AND active
members, both derived. Delivered as two releases (v0.7.0 front door, v0.8.0 ladder +
numbers); the launch checklist shifts to Phase 7. Rationale: the old funnel demanded
nine decisions including a fee tier before anyone was "in", and offered no
member→delegate path at all; pre-launch is the cheapest moment this rework will ever
have.

## ADR-019 (2026-07-22): R2 — delegacy on approval, cumulative counters, rider absorption

Release 2 of progressive registration (spec 2026-07-22, v0.8.0). Decisions:

- **Delegacy is a role only once approved.** Routing/nav gate on approved status;
  pending/rejected requesters live in the member cabinet. A DB trigger makes a
  delegates row without a completed member profile unrepresentable, retiring the
  R1 latent redirect loop structurally. request_delegacy() is the only creation
  path (definer, member-gated, rejected-is-final per D7).
- **Approval closes the new delegate's own membership.** Delegates back no one
  (Phase 3 canon); the membership survives the pending wait so rejection leaves
  member life untouched. Rider inside admin_approve_delegate, same audit row.
- **The public "registered" number is cumulative** (count of all profiles) —
  breadth that never shrinks on upgrade; the disjoint split (registered / member /
  active — exactly the member_status enum) is admin-only, summing to the total.
- **Phase 5 hardening queue absorbed** (R2 was "the next hardening migration"):
  conditional-DML cancel guard, btrim body CHECKs + RPC guards, invalid_visibility
  token, supabase.co+filename-shape image pin (events have no image RPC — the
  recorded "both RPCs" premise was wrong), member_rsvp FOR SHARE, 80-char slug cap
  in lib/slug (the "SQL" premise was wrong — minting is app-side), one shared
  resolvePublishSlug helper, PollForm stable keys, poll-list revalidation,
  .order("id") on the two verification-side paged sums.
- **delegate_panel's draftCount → registeredCount** (churn-control keep from R1,
  now closed); pending_delegate_id FK → on delete set null; register() maps the
  duplicate-ID race to the same field-specific token as the pre-check
  (constraint-name dispatch); /login surfaces lookup failures instead of bouncing
  members to /join; header CTA is „დარეგისტრირდი“ („გახდი წევრი“ now means only
  the in-cabinet membership journey).

## ADR-020 (2026-07-23): Kronika (D3) redesign — the newspaper identity

Full visual/UX redesign around the owner's Kronika (D3) mock (spec
`docs/superpowers/specs/2026-07-23-kronika-redesign-design.md`, target v0.9.0).
Decisions:

- **Kronika D3 is the look-and-layout contract.** Bundle at
  `prototype/kronika-d3/`: the standalone mock, the decoded template (the
  byte-splice authority for all Georgian copy), and the brand assets.
  `prototype/index.html` is superseded (kept for history). Shipped v0.8.0
  behavior, flows, labels and data rules win over mock fiction everywhere;
  every substitution is ledgered in the spec (§4.1, §5.6).
- **Brand assets are canonical; the one red is `#9F1D35`** (pixel-sampled,
  identical across all red logo files). It replaces brand `#C8102E` AND danger
  `#B3261E`; navy/gold/info-blue are retired; warm ink `#1A1611` + paper
  `#F7F2E9` become the materials; rules replace shadows; serif takes names,
  dates and numerals.
- **Scope: all 46 pages including admin; one release (v0.9.0); reskin &
  recompose** — component contracts frozen, zero DB changes, routes/RLS/zod/
  formatters untouched; system-first build with an early styleguide+homepage
  owner checkpoint on a Vercel preview.
- **Header CTA becomes „შემოგვიერთდი“** (owner choice, mock voice),
  amending ADR-019's „დარეგისტრირდი“ line; the transparency nav label
  becomes „ფინანსები“; leaderboard medals give way to the
  numbered-index look; nav count badges (open polls / pending verifications)
  and the homepage news teaser are the only behavior-adjacent additions.
- **Marketing copy is the mock's voice, byte-spliced; functional copy stays
  shipped wording.** The manifesto's fixed-20₾ clause is corrected to the real
  5/10/20₾ tiers via an owner-reviewed replacement clause (spec §4.1).

## ADR-021 (2026-07-26): Security check-up outcomes — two owner decisions

Taken at the Phase 6 security check-up (spec
`docs/superpowers/specs/2026-07-25-security-checkup-design.md`, report
`docs/security/report.md`). Both decisions are the owner's, recorded here because they
close standing questions rather than because they change code.

- **Personal-ID column encryption: NOT adopted.** This audit is the "Phase 6 /cso audit"
  that ADR-006 named as the point to revisit column-level encryption for `personal_id`.
  The owner reviewed the options and declined for now. ADR-006's deferral is therefore
  **resolved, not still open**: IDs continue to rely on platform at-rest encryption, RLS,
  the column-grant seal and audited reveals. The cheaper exposure reduction identified in
  the same review — revoking the `anon` column grants on `personal_id`/`birth_date`/`phone`
  — is adopted instead and ships in this phase. Revisit only if the threat model changes
  (seizure/compulsion is the case at-rest encryption does not cover).

- **The dev-OTP account-manufacture finding is a testing-configuration artifact.** Owner's
  correction, and it is correct: `/api/dev/otp` is gated on `NEXT_PUBLIC_APP_ENV` being
  `development`/`preview`, and at launch the flag flips to `production` and real SMS
  delivers codes to the handset — both already on the launch checklist. The finding
  therefore retires at launch and is not a production design flaw.
  **What that argument does NOT cover, and what becomes load-bearing instead:** email
  sign-up is enabled and auto-confirmed on the Supabase project, and `register()` has no
  null-phone guard — so account manufacture survives the flip, with no phone involved. In
  production, email sign-up becomes the sole manufacture route and therefore the enabler
  standing behind the deferred personal-ID squatting finding. The code half (the
  null-phone guard) ships in this phase; disabling the email provider is a project setting
  and remains an owner action, tracked in `docs/security/LAUNCH-BLOCKERS.md`.

## ADR-022 (2026-07-28): Owner fix-list round 1 — decisions taken in implementation

Source: the owner's "What to FIX" doc (2026-07-27), items 1/4/6/7/8a/14/15, plus item 10
as clarified in chat on 2026-07-28. Item 16 and the remaining decision-items are deferred
to the next round.

- **Selects stay native under a design-system dress** (`Select` / `SelectField`): the
  OS-native open list is accepted as a GOV.UK-style trade-off; a custom listbox is worth
  building only if the owner's preview verdict demands it.
- **„არ მყავს დელეგატი“ replaces „ცენტრალური მოძრაობა“** on member surfaces only — admin
  vocabulary waits on item 16's wording decision.
- **`/join` loses its §-numbered section headings** (item 6 clarification): the phone
  heading is deleted outright, and the field labels carry the naming on their own.
- **`cities` is completed to the 64 standard election municipalities + 10 Tbilisi
  raions** (74 rows; the legacy თბილისი row stays, for FK integrity). Spelling
  adjudication, recorded here: the plan drafted the two-word „თეთრი წყარო“;
  implementation checked it against Georgian Wikipedia and the municipality's official
  domain and corrected it to the official one-word „თეთრიწყარო“.
- **Personal ID moves to membership, not registration** (item 10): `/join` collects only
  name, surname and phone; the membership wizard asks for the ID only while the profile
  still lacks one. `become_member_save_profile()` validates and writes it race-safely
  (unqualified-column coalesce — a review fix over the plan's draft SQL);
  `become_member_complete()` refuses to complete without it; immutability still runs
  entirely through the definer-RPC-only write path. LB-1 (personal-ID squatting, deferred
  2026-07-26) is narrowed at the `/join` door but NOT closed — it relocates to the
  membership step, and `docs/security/LAUNCH-BLOCKERS.md` remains authoritative.
- **Coordination fact, recorded for the record:** the security branch's `register()`
  null-phone guard (94d56fb) was ALREADY merged into `main` before this branch's
  migration restated `register()`; the restatement was verified line-by-line (task
  review) to carry every accumulated guard forward — no pending merge race,
  contrary to the plan's earlier warning.

## ADR-023 (2026-07-28): Legacy Georgian-quote corruption accepted as-is; gate stays diff-scoped

A whole-repo audit (2026-07-28, refreshed at the round-1 merge 5b054b2;
codepoint-built per-file balance checks) found 28 tracked files where U+201E
openers do not match U+201C/U+201D closers -- the historical "silent
normalization" corruption from before the 2026-07-19 Phase 5 incident taught
the splice-don't-retype rule. Every instance was classified: 12 internal docs
(specs, plans, CHANGELOG, ARCHITECTURE, this log) carry the bulk; 13 code
files (app/, e2e/, lib/cabinet.ts, lib/format.ts, one SQL migration) carry it
in comments ONLY -- no rendered string and no e2e assertion literal in the
shipped app is corrupted; lib/content-render.ts is legitimately unbalanced
(lone quote characters in its trailing-punctuation regex class, not
corruption); and the single rendered occurrence is one demo-fixture employer
line duplicated across the two prototype/kronika-d3 HTML mocks (prototype,
not product).

**Owner decision: accept the legacy as-is -- no sweep.** A repair sweep of
history-laden files (this log is append-only) would be churn without user
benefit. `scripts/ka-gate.mjs` stays diff-scoped and keeps blocking NEW
corruption; its header's stale "three legacy files" note is corrected to
point here. Because the gate checks added lines, any edit touching a legacy
line must leave it clean -- the debt retires organically. Proof the path
works: round 1's own edits already retired e2e/registration.spec.ts's one
legacy instance in passing. Prototype fixture polish (the two kronika-d3
lines) stays optional and unscheduled.
