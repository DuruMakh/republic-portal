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

## ADR-024 (2026-07-29): Owner fix-list round 2 — decisions taken in implementation

Source: the owner's "What to FIX" doc, remaining items 2/3/5/8b/9/12/16,
approved in one decision pass 2026-07-28, plus one follow-up decision taken
2026-07-29 (referral counts, below). **Item 11 (support page) was not built** —
it needs owner-supplied Georgian copy, a destination address and a provisioned
mail integration, and none arrived; the plan gated it rather than inventing
copy. **Item 13 was never specced** — its text was never supplied and the
source doc needs the owner's Google login.

**The finances "member" column was NOT redefined, and the spec's warning that
regional numbers would drop was wrong.** The spec approved by the owner said
the column counted every registrant and would be narrowed to completed
memberships, with every region's figure dropping as a result. Implementation
review found the opposite: `20260721120000:26` renamed the `member_status`
enum's original `draft` label to `registered`, and a stored view's predicate
binds to the enum's OID rather than its label — so `status <> 'draft'` had
silently continued to mean "completed memberships only" ever since. The column
was already honest; only its spelling misled. Round 2 therefore trades the
`active` column for collected money and redefines nothing, and the published
per-region figures are unchanged. Live verification after the push: the view's
per-region member sum (1775) reconciles exactly with a direct count of the same
predicate.

**Corollary, and it cost this round real time: `draft` is no longer a valid
`member_status` label at all.** Stored bodies predating the rename are safe
forever, but any NEW statement citing it raises 22P02 and rolls back the whole
push. One migration was written with it and caught in review before reaching
the database; a second near-miss came from a plan line-range citation that
would have copied an unrelated function's legitimate events-status `draft`
into a new statement. Convention (already set by `20260722120000:193-195`):
write today's equivalent out in full, never restate the original literal.

**Restated function bodies must come from the LIVE definition, not the one the
plan cites.** A plan citation pointed at `20260721120000`'s
`become_member_complete`, which `20260728100000` had already superseded with
round 1's personal-ID guard; copying it verbatim would have silently reverted
that guard. The implementer caught it. Same class of trap as the enum one:
migration history is append-only, so "the definition" is always the newest.

**`/delegates` retired into the ranking page** behind an exact-path permanent
redirect, so bookmarks and search results keep working and `/delegates/<slug>`
profile pages are untouched. The name/region filters that existed only on the
dying page moved onto the ranking page rather than being lost. `DelegateCard`
became dead code in the process (its only call site was the deleted directory)
and was removed with it — the spec's claim that the slug page still used it
was wrong.

**Membership is a fixed 10 GEL/month.** The picker is deleted from the wizard
and the billing page, `member_change_tier` is dropped, the admin tier
distribution is gone, and the database refuses any other value. Existing 5/20
members were moved to 10 by the migration. This is safe because
`payments.tier_gel_at_payment` freezes each payment's price and
`months_covered` is a generated column derived from it — re-tagging a profile
cannot retroactively change what a past payment bought. Verified live: zero of
1907 profiles carry any tier but 10 or null.

**Referral codes: every profile has one, and collision safety is by
construction.** Member codes are `M-` + 6 characters from the existing
alphabet; delegate codes can never contain a hyphen and payment references use
`GR-`, so `signup_ref_code` is unambiguous without any cross-table lookup.
Verified live: 1907 of 1907 profiles hold a well-formed unique code, and none
of the 16 delegate codes contains a hyphen. **That no-hyphen guarantee for
delegate codes rests on the generator, not a database constraint** —
`profiles.referral_code` carries a CHECK pinning the `M-` prefix
(`20260728142000:48-49`), but `delegates.referral_code` (`20260712212409:36`)
has no CHECK forbidding a hyphen at all. The actual guarantee is
`gen_funnel_code`'s hyphen-free alphabet plus the seeded `D`+digits shape
(`scripts/seed-staging.mjs`); a future change to delegate-code generation that
introduced a hyphen would silently break `signup_ref_code`'s unambiguity, with
nothing in the schema to catch it.

**Owner decision 2026-07-29 — an approved delegate's referral count sums both
codes.** The original "one person, one link" design counted whichever single
code was active, so a member who earned N sign-ups on their own link and was
later approved as a delegate would watch the count reset to 0 with those
attributions permanently invisible. Review surfaced it; the owner chose to sum.
The displayed link is unchanged (still the delegate code once approved) — only
the count widened. This landed in its own migration
(`20260729120000`) rather than in `20260728142000`, because the latter had
already been pushed: amending an applied migration makes the file lie about
what ran. `20260728142000` was restored byte-identical to its pushed state.

**The admin city filter is reconciled server-side against the region.**
`profiles` carries a composite FK `(city_id, region_id)`, so a stale city
combined with a changed region cannot match any row — the list would have
returned guaranteed-zero results behind a dropdown that had silently reset
itself to "all cities". A pure `reconcileCityFilter()` in `lib/admin.ts`
ignores a city that does not belong to the selected region, and the same
reconciliation feeds the list, the pagination links and the export.
`admin_export_members` gained `p_city_id` so the CSV honours the filter — the
file's own documented invariant is that the export must never see a different
row set than the list.

**Status vocabulary is disambiguated in one place per surface.**
`MEMBER_STATUS_LABELS_KA` (`lib/admin.ts`) and `TEAM_STATUS_LABELS`
(`lib/cabinet.ts`) now distinguish a member with no recorded payment from a
paying member in good standing; `Pill`'s own mirrored defaults follow, because
several pages render it without an explicit label.

**The round-1 caption under the no-delegate label stays removed** (owner, item
8b): it asserted that a person with no delegate is backing the central
movement, which the round-1 wording explicitly contradicts. Recorded here so a
later reader does not restore it as a perceived omission.

**Known staleness, deliberately deferred:** `scripts/security/*` (the recorded
corpus of the 2026-07-26 audit: `app-actions.mjs`, `arguments.mjs`,
`manifest.json`, `live-objects.json`, `coverage.mjs`) still catalogs the
dropped `member_change_tier` RPC — and the same staleness reaches beyond that
corpus. `docs/security/*` (`coverage.md`, `findings.md`, `ledger.json`,
`threat-model.md`) records the same RPC throughout; `lib/security/expectations.test.ts`
cites it too, harmlessly — it is a string fixture, not a live call, so the
suite stays green; and `scripts/security/probe.mjs`'s `profiles` read-column
list (`READ_COLUMNS["table:profiles"]`) predates `referral_code`
(`20260728142000_member_referral_codes.sql`) and so omits it. All of it
records what a completed audit probed at the time; rewriting the corpus is a
separate decision, and nothing in CI runs any of it.

---

## ADR-025 (2026-08-02): Support page ships as a contact page, without email

**The page is a contact page, not a help desk or a volunteering inbox.** Owner
decision in the design pass. Georgian is built around `დაგვიკავშირდი`, and the
whole copy block was settled with the owner rather than supplied by them —
recorded string by string, with provenance, in
`docs/superpowers/specs/2026-08-02-support-page-design.md` §3.

**Two optional contact fields, at least one required**, replacing the single
free-text `contact` field of the superseded round-2 §5. The platform is
phone-first everywhere else — people register with an SMS code and the app had
no email field anywhere before this page — so requiring either one alone would
have excluded real people.

**Informal singular register**, matching the shipped public voice
(`დარეგისტრირდი`, `აირჩიე ის შენს დელეგატად`). The codebase was mixed on this
in error strings; the public surfaces were not.

**Email is deliberately not built.** The owner deferred it on 2026-08-02: the
address supplied was a test one and the real destination will differ, so nothing
is provisioned and nothing is hardcoded. Marketplace discovery was run and
confirmed Resend (`resend/resend-email`) is still the only messaging product,
for whenever mail returns. Consequences, accepted knowingly: no `emailed_at`
column and no mark-as-emailed function until the change that actually sends
something adds them, and **nothing notifies the owner** — a message waits in
`/admin/support` until someone looks, while the page promises `მალე გიპასუხებთ`.

**No new dependency was added**, so this ADR records a design decision rather
than the dependency rationale CLAUDE.md requires. `npm install resend` never ran.

**The anti-spam salt is derived, not configured.** Rather than add a
`SUPPORT_MESSAGE_SALT` environment variable the owner would have to set, the
server action derives it as `hmac-sha256(SUPABASE_SERVICE_ROLE_KEY,
"support-ip")` — a secret the app already holds in every environment. HMAC
output never reveals its key, so this neither weakens nor exposes that
credential, and the page needs no deployment setup at all. When the secret is
absent the hash is `null` and throttling simply does not engage, which is
better than storing an address hash weak enough to reverse across IPv4.

**`submit_support_message` is gateless by design**, the third such exemption in
`verdict.tokens-drift.test.ts` and the plainest: EXECUTE is granted to `anon`
on purpose, because a public contact form has no caller identity to admit or
refuse. What protects it is that the table underneath is revoked from every
client role, making the RPC the only way in, and it restates every rule the
form enforces. Its two tokens (`invalid_support_message`, `too_many_requests`)
are classified POST_GATE: the throttle refuses how often, never who.

**Tooling fixed in passing:** `eslint` and `tsc` were both walking
`.claude/worktrees/`, up to seven complete copies of this repo, producing 86,639
lint problems and a failing typecheck locally. The directories are untracked so
CI never saw them; the configs now exclude `.claude`, making local agree with
CI. Worktrees are normal here and will recur, so this is the durable fix rather
than deleting the current ones.

**`scripts/mixed-script-scan.mjs` now exists.** DESIGN.md has called for a
mixed-script backstop since the integrity gate was written — ka-gate cannot see
a Latin letter fused inside a Georgian word — and there was never a tool.
Demonstrated against fixtures fusing U+006F (Latin o), U+043E (Cyrillic) and
U+03BF (Greek omicron) into the lede — named by codepoint here rather than
written as glyphs, since ka-gate rightly refuses a Greek look-alike in a source
file and flagged this very paragraph on the first attempt: ka-gate exits 0 on
all three fixtures, the new scan catches each by codepoint. The whole tracked codebase scans clean, which is the first evidence
this repo carries no homoglyph corruption; the 2026-07-28 audit checked quotes
only.

---

## ADR-026 (2026-08-02): Support-page code review — corrections to ADR-025

A max-effort review of the support branch (ten independent finder angles, then
mechanical verification) found fifteen defects, several of them in claims
ADR-025 itself makes. This log is append-only, so the corrections are recorded
here rather than by editing that entry.

**Correction 1 — ADR-025 says the RPC's "protection is that the table
underneath is revoked from every client role, so this function is the only way
in." That was false as shipped.** The migration created
`admin_support_messages` and granted SELECT without first revoking. On
instances with classic default privileges a new view is born with ALL granted
to client roles, and this one is single-relation over plain columns with no
`security_invoker` and no `WITH CHECK OPTION` — auto-updatable, executing DML
with the owner's RLS-exempt rights, and a view's `WHERE` does not constrain
INSERT. `anon` could have POSTed to `/rest/v1/admin_support_messages` and
written straight into `support_messages`, past RLS, past the table's own revoke
and past every validation rule. The repo had already written this trap down
(`20260719150000_community.sql:248`) and the plan for this branch contained the
revoke line; implementation dropped it. Now restored.

**Correction 2 — the throttle did not throttle.** `p_ip_hash` is the rate
limit's key and the *caller* supplies it, while EXECUTE was granted to `anon`.
Anyone holding the public anon key could call the RPC directly and omit the
argument — the `default null` short-circuits the check — or send a fresh random
value per call. EXECUTE is now revoked from `public`, `anon` and
`authenticated` and granted only to `service_role`; the server action calls it
through `lib/supabase/admin.ts`. Postgres cannot distinguish "our server" from
"a browser holding the same public key", so a credential the browser lacks is
the only thing that can. This also repairs the `GATELESS_BY_DESIGN` exemption,
which had inverted the property the other two entries share: all three are now
exempt because no client role can reach them.

**Correction 3 — "The whole tracked codebase scans clean" overstated what ran.**
The sweep covered quoted literals in `.ts`/`.tsx` only. Most user-facing
Georgian in this repo is bare JSX text, which the scanner could not see, and
running it over `.mjs` failed on the scanner's own source: its comments spelled
out the Latin, Cyrillic and Greek examples as literal glyphs, so ka-gate
rejected it and it flagged itself. Both are fixed — the examples are named by
codepoint, JSX text is scanned, and the claim now holds for
`.ts`/`.tsx`/`.mjs` quoted literals **and** JSX text, verified by `npm run
ka:scan`.

**The gate is now wired in.** `npm run ka:scan` exists, DESIGN.md's mandatory
gate block names it with its invocation instead of describing a backstop that
did not exist, and the script defaults to every tracked file so the command
behaves the same on the owner's Windows shell as in CI.

**A guard that reads migrations, not a snapshot.** The F5 view-write test
iterated `scripts/security/live-objects.json`, a frozen introspection snapshot,
so the missing revoke above passed 664 green tests: the new view was simply not
in the file. `schema-guards.test.ts` now also parses every `create view` out of
the migrations and asserts each has a matching revoke, which covers views this
repo has not added yet. Proven by removing the revoke line and watching it fail.

**Client and server measured different things.** zod counts UTF-16 code units
and Postgres `length()` counts characters, so a five-emoji message passed the
form and was refused by the database; and `btrim`'s one-argument form strips
ASCII space only, so a message of ten newlines satisfied the server's length
rule while the client rejected it. Both sides now count code points and trim
the same whitespace set.

**Errors now say something true.** A rejected server action left the submit
button disabled forever with no message; `invalid_support_message` was rendered
as "try again" for payloads that could never succeed; zod's English defaults
("Required", "Expected string, received null") were reachable as user-facing
copy on a public endpoint; and every field error collapsed into one unattached
line. Each is fixed, with a regression test.

**The inbox is readable.** It paged 50 rows with no pager, so message 51 was
unreachable forever, and it discarded the query error so an unmigrated or broken
view rendered as "there are no messages". It now paginates like every sibling
admin list and throws like them. The e2e suite, which wrote a real row to shared
staging on every CI run with no cleanup, now tags its rows and deletes them.

**Design-system debt paid rather than added.** `TextareaField` joins
`components/Field.tsx` (the shape `SelectField` already set) with a
`/styleguide` entry, instead of a fifth hand-rolled textarea copying Field's
label markup inline.
