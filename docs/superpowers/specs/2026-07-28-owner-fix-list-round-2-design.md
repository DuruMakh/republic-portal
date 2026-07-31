# Owner Fix List — Round 2 Design

**Source:** owner "What to FIX" doc (2026-07-27), the remaining decision items, plus the
owner's decision message of 2026-07-28 ("all as recommended"). Round 1 = items
1/4/6/7/8a/10/14/15, shipped as PR #16, recorded in ADR-022.

**Scope:** doc items 2, 3, 5, 8b, 9, 11, 12, 16 + seven ride-along polish fixes carried
from round-1 reviews.

**Out of scope, tracked:** doc item **13** — the owner has not supplied its text and the
Google Doc needs their login (WebFetch returns the page shell, not the body). It rejoins
this branch as an extra task the moment the text arrives, or slides to round 3.

---

## Owner decisions this design implements

| # | Decision |
|---|---|
| 2 | Homepage gains full-width news + events sections; top-nav entries **stay** |
| 3 | რეიტინგი survives; `/delegates` index redirects; delegate profile pages untouched |
| 5 | Finances table = რეგიონი / წევრი / collected GEL; "წევრი" = completed membership |
| 8b | The removed caption stays removed |
| 9 | Fixed 10₾/month everywhere; existing 5₾/20₾ members moved to 10₾ |
| 11 | `/support` page: form → email + a durable database copy |
| 12 | Every person gets a referral link; members see a count, delegates keep their list |
| 16 | Admin city filter; status vocabulary disambiguated |
| — | Version at merge: **0.11.0**, covering rounds 1 and 2 together |

## Owner-supplied input still needed (does not block the plan)

1. **Support page Georgian copy** (item 11). Heading, lede, three field labels, submit
   button, success and failure lines. This is the only place in the round that needs
   *new* Georgian prose, and the house rule forbids hand-typing Georgian
   (DESIGN.md integrity gate + the transcription hazard). Everything else in this
   design is derived from existing repo bytes by **deletion or reuse only**.
2. **Destination email address** — consumed as the `SUPPORT_EMAIL_TO` environment
   variable, set by the owner at deploy time. Nothing in the code hardcodes it.
3. **Item 13 text.**

---

## 1. Homepage news + events (item 2)

**Files:** `app/(public)/page.tsx`, new `components/EventRow.tsx` (+ test),
`app/(public)/events/page.tsx`, styleguide, DESIGN.md.

Two new full-width sections in the **main column**, below the `join-strip` ladder,
in document order: news, then events. Each opens with `SectionRule` carrying a
`action={<Link>სრულად →</Link>}` — the same header/action pattern the right rail
already uses for რეიტინგი, so nothing new enters the design system for the headers.

- **News:** the 3 newest, rendered as `NewsCard variant="tile"` in `sm:grid-cols-3`.
  Reuses the variant round 1 shipped; no component change.
- **Events:** the next 3 upcoming, from `fetchPublicEvents()` + `splitEvents()`
  (`lib/community.ts`), the same helpers `/events` already uses.

`EventRow` today is a private function inside `app/(public)/events/page.tsx`. Two
call sites means it gets **extracted** to `components/EventRow.tsx` — copy-pasting it
is a forbidden pattern (CLAUDE.md). The extraction is byte-identical markup; the events
page imports it instead of declaring it. Styleguide entry + DESIGN.md row land in the
same task, per the DESIGN.md rule.

**The right-rail news box is deleted.** Otherwise the same three headlines appear twice
on one screen. The rail keeps რეესტრი and რეიტინგი and gets shorter, which is fine —
it is a sidebar, not a column that must match the main one.

**Empty states:** a section with nothing to show renders its heading and the existing
empty-state sentence from the corresponding full page (spliced, not written). No section
is hidden outright — a heading with an honest "nothing yet" line beats a homepage whose
shape changes depending on data.

**Nav:** unchanged by this item.

## 2. Delegates index retires into რეიტინგი (item 3)

**Files:** `next.config.ts`, delete `app/(public)/delegates/page.tsx`, delete
`components/DelegateDirectory.tsx` + test, new `components/LeaderboardDirectory.tsx`
(+ test), `app/(public)/leaderboard/page.tsx`, `app/(public)/layout.tsx`,
`app/sitemap.ts`, styleguide, e2e.

- **Redirect:** `next.config.ts` gains `redirects()` with
  `{ source: "/delegates", destination: "/leaderboard", permanent: true }`. An exact
  source matches only that path — `/delegates/<slug>` is untouched, which is what keeps
  every ranking row, the homepage top-five, the admin approval screen and the OG-image
  route working.
- **Filtering moves, it does not die.** `LeaderboardDirectory` is a client component
  holding the name search + region `Select` (markup and Georgian strings lifted verbatim
  from `DelegateDirectory`, including its no-results card and its count line) and
  rendering the filtered ranking through `LeaderRow`. `/leaderboard` becomes a fetch of
  delegates **and** regions.
- `DelegateDirectory` has no remaining call site and is deleted with its test.
  `DelegateCard` stays — `/delegates/<slug>` and the styleguide still use it.
- **Nav** drops `დელეგატები` (6 entries → 5). The styleguide's nav demo array drops it too.
- **Sitemap** drops the `/delegates` entry (a permanent redirect should not be advertised
  as a canonical URL); the per-delegate entries stay.

## 3. Finances page (item 5)

**Files:** new migration, `lib/supabase/public.ts`, `app/(public)/transparency/page.tsx`.

**Table becomes exactly three columns:** `რეგიონი | წევრი | შეგროვებული თანხა (₾)`,
sorted by collected amount descending, ties broken by name codepoint order (the existing
comparator — `localeCompare` is banned here, see the file's own comment).

**Definition change, and it is the load-bearing part.** Today's `წევრი` column counts
`status <> 'draft'`, i.e. everyone who ever registered. It becomes people who completed
membership: `status in ('profile_completed', 'active_member')`. Every region's number
drops relative to today; that is the intended correction and the owner has seen the
warning.

`transparency_regions` is redefined (drop + create, since column sets change; grants
restated) as:

```
region_id, name_ka,
members       = count(profiles where status in ('profile_completed','active_member')),
collected_gel = sum(payments.amount_gel where voided_at is null), joined via the payer's region
```

Money is attributed to the payer's **current** region — a member who moves takes their
history with them. This is stated on the page's existing footnote paragraph rather than
left implicit.

**The four summary boxes stay**, but the box labelled `წევრი` currently reads
`transparency_stats.registered_members`, which counts everyone — the same lie in a
different place. `transparency_stats` gains a `members` field with the new definition and
the box reads that. The `რეგისტრირებული` box keeps counting everyone, which is what its
label says.

## 4. Fixed 10₾ membership (item 9)

**Files:** new migration, `lib/funnel.ts`, `lib/funnel-schemas.ts`, delete
`components/TierPicker.tsx` + test, delete `app/(member)/me/billing/TierChange.tsx` +
test, `app/(member)/me/billing/page.tsx`, `app/(member)/me/membership/MembershipWizard.tsx`,
`components/TransferInstructions.tsx`, `app/(member)/me/actions.ts`,
`app/(admin)/admin/finances/page.tsx`, `app/(public)/page.tsx`, styleguide, DESIGN.md, e2e.

**TypeScript:** `TIERS = [5, 10, 20]` becomes `MEMBERSHIP_FEE_GEL = 10`, with
`type Tier = typeof MEMBERSHIP_FEE_GEL` so every existing `Tier` annotation keeps
compiling and the compiler finds each site that assumed a choice. `tierSchema` narrows to
`z.literal(10)`.

**UI:** `TierPicker` and `TierChange` are deleted, not hidden. The wizard's second step
becomes a confirmation panel stating the fee and carrying the same completion button and
the same bank-transfer footnote; the two-step `Stepper` is unchanged. The billing card
states the fee instead of offering a picker.

**Database** (one migration):
- `become_member_complete(p_tier int)` keeps its signature and raises `invalid_tier`
  for anything but 10. Keeping the signature avoids a drop/regrant and keeps the client
  contract stable.
- `member_change_tier(p_tier int)` is dropped, along with `changeTierAction`.
- Backfill `update profiles set membership_tier = 10` for every non-null row that is not
  already 10, **then** add `check (membership_tier is null or membership_tier = 10)`.
  `membership_tier` is a protected column (`protect_profile_columns`), so the migration
  must confirm whether that trigger fires for the migration role and, if it does,
  disable/re-enable it around the single statement. Verified in the plan, not assumed.
- `admin_finance_stats` drops `tier5_count` / `tier10_count` / `tier20_count`; the
  distribution block on the admin finances page goes with them. `mrr_gel` and
  `active_count` stay.

**History is not rewritten.** `payments.tier_gel_at_payment` is stored per payment and
`months_covered` is generated from it, so re-tagging a member's tier cannot retroactively
change what any past payment bought. This was verified before the recommendation and is
the reason the backfill is safe. Going forward, a former 5₾ payer owes 10₾/month.

**Copy** (all derived by **deleting characters from existing strings** — never retyped):
- `app/(public)/page.tsx` P2: `5, 10 ან 20₾` → `10₾` by removing `5, ` and ` ან 20`,
  and `არჩევითია ` is removed.
- `LADDER_2_PRICE`: `5/10/20₾ თვეში` → `10₾ თვეში` by removing `5/` and `/20`.
- Wizard step-2 lede: the "choose your fee" sentence is deleted whole; the following
  sentence stands alone.
- `TransferInstructions` takes the fee constant instead of a nullable tier.

## 5. Support page (item 11)

**Files:** new migration, new `app/(public)/support/page.tsx` + `SupportForm.tsx` +
`actions.ts`, new `lib/support-schemas.ts`, new `app/(admin)/admin/support/page.tsx`,
`app/(public)/layout.tsx` (footer link), `lib/admin.ts` (admin tab), DECISIONS.md.

**Provisioning first, then code** (Vercel Marketplace rule). `messaging` discovery
returns exactly one product: **Resend** (`resend/resend-email`). The owner runs the
provisioning command; `RESEND_API_KEY` arrives as a project environment variable. Two
further variables the owner sets: `SUPPORT_EMAIL_TO` (destination) and
`SUPPORT_EMAIL_FROM` (a verified sender on their domain). No code is written against a
mock, and the implementing task does not start until the integration exists.

**Flow:** public form → server action → *first* insert the row, *then* send the email.
That order is deliberate: if Resend is down, the message is already saved and the
visitor still gets a success answer. If the insert fails, the visitor sees an honest
failure. The row records whether the email left.

**Validation** with zod at both boundaries (`lib/support-schemas.ts`): name 1–60,
contact 1–120, message 10–2000. Server is the source of truth.

**Data:** `support_messages` (id, name, contact, message, created_at, emailed_at,
ip_hash). RLS denies everything by default; insertion happens only through a
`security definer` RPC callable by `anon` and `authenticated`, because the page is
public and a visitor need not have an account.

**Spam control:** the RPC rejects a submission when the same `ip_hash` has inserted more
than 3 rows in the preceding 10 minutes. `ip_hash` is a salted hash of the forwarded-for
header computed in the server action — never the raw address (privacy), and never in a
URL.

**Reading them back.** The database copy exists so nothing is lost; a table nobody can
read would not deliver that. So: an `admin_support_messages` view gated on `super_admin`
and a read-only `/admin/support` list. This is the one place this design does slightly
more than the literal decision, and it is called out here so the owner can veto it at
spec review.

**Discoverability:** a footer link, not a top-nav entry — support is a destination people
look for, not a section of the publication. Georgian label comes with the owner's copy block.

## 6. Countable referral links (item 12)

**Files:** new migration, move `app/(delegate)/delegate/ReferralCard.tsx` →
`components/ReferralCard.tsx` (+ test), `app/(delegate)/delegate/page.tsx`,
`app/(member)/me/page.tsx`, `lib/funnel.ts`, `lib/cabinet.ts`, styleguide, DESIGN.md.

**One person, one link.** Today only approved delegates have a referral code at all.
`profiles` gains `referral_code`, minted inside `register()` and backfilled for existing
rows. A person's link uses their **delegate** code when they are an approved delegate,
otherwise their profile code — so nobody ends up holding two links that mean different
things.

**Collision safety:** delegate codes are 6 characters from the `[A-HJKMNP-Z2-9]` alphabet
and payment references are `GR-XXXXXX`. Member codes are minted as **`M-XXXXXX`** from the
same alphabet. The hyphen cannot occur in a delegate code, so `signup_ref_code` can never
be ambiguous between the two tables — attribution stays exact by construction rather than
by a uniqueness check across two tables.

**Semantics:** a sign-up through a *member's* link credits that member's count and
nothing else. The newcomer is **not** bound to a delegate — a member has no delegacy to
pass on — and picks their own delegate as usual. Delegate links keep their existing
binding behaviour untouched.

**What each person sees:**
- **Member** (`/me`): link + QR + a single count. No names.
- **Delegate** (`/delegate`): the same card with its count, plus the existing team table
  of names — unchanged behaviour.

`ReferralCard` moves into `components/` (two call sites; extraction over duplication) and
takes an additional `count: number` prop. The count's Georgian label is **reused
byte-exact** from the delegate panel's existing registered-count label — no new string.

`cabinet_state()` returns `referralCode` and `referralCount`; `delegate_panel()` gains
`referralCount` (profiles whose `signup_ref_code` matches, any status — distinct from the
existing `registeredCount`, which is narrower).

## 7. Admin city filter + status vocabulary (item 16)

**Files:** new migration, `lib/admin-schemas.ts`, `lib/admin.ts`, `lib/cabinet.ts`,
`app/(admin)/admin/members/page.tsx`, `app/(admin)/admin/members/ExportControls.tsx`,
`lib/csv.ts` if it renders status, e2e.

**City filter:** a third dropdown after რეგიონი. `admin_members` currently exposes
`city_name_ka` but not `city_id`, so the view gains `p.city_id` and
`membersFilterSchema` gains `cityId`. The dropdown lists the cities of the selected
region, or all cities when no region is selected. It composes with the existing search,
region and status filters, and — critically — with the **CSV export**, which must never
see a different row set than the list (the file's existing invariant).

**Vocabulary.** Today's three labels are `რეგისტრირებული` / `წევრი` / `აქტიური`, where
`წევრი` looks like the better state and `აქტიური` never says what it is active *at*:

| State | Now | Becomes |
|---|---|---|
| Signed up, not a member | რეგისტრირებული | *unchanged* |
| Member, no payment recorded | წევრი | **წევრი (გადახდის გარეშე)** |
| Paying member in good standing | აქტიური | **აქტიური წევრი** |

Both new labels are assembled from existing repo bytes: `აქტიური წევრი` is lifted
whole from the homepage stat label, and `გადახდის გარეშე` from the homepage ladder's
first-rung description. No Georgian is typed.

Applied in **one place each**, so the site speaks one language: `MEMBER_STATUS_LABELS_KA`
(`lib/admin.ts` — member list, status filter, export) and `TEAM_STATUS_LABELS`
(`lib/cabinet.ts` — the delegate's team table, which carries the identical ambiguity).

## 8. The delegate caption (item 8b)

No code change. The line removed in round 1 stays removed; it asserted that a person with
no delegate is backing the central movement, which the new wording explicitly contradicts.
Recorded in the ADR so it is not "fixed" back in by a later reader.

## 9. Ride-along polish

Seven carries from round-1 reviews, no decisions attached:

1. **Styleguide** — the three `NewsCard` demos (row / lead / tile) are visually
   indistinguishable; each gets a label.
2. **`components/CabinetNav.test.tsx`** — restore the explainer comment above the
   `vi.hoisted` block.
3. **`app/(public)/join/JoinForm.test.tsx`** — delete the two
   "render JoinForm exactly as the first existing test does" instruction comments (the
   tests now *do* it), and drop the duplicated `(owner fix #6)` tag from the inner test
   name, keeping it on the describe.
4. **`components/NewsCard.test.tsx`** — the tile test asserts only the image ratio; it
   also asserts the `text-lg` heading and the `line-clamp-2` excerpt, which are the two
   things that actually distinguish tile from lead.
5. **`components/NewsCard.tsx`** — the `variant` JSDoc claims the homepage renders a
   row brief. It does not (it renders bare links today, and tiles after item 2). Corrected.
6. **`MembershipWizard`** — drop `maxLength={11}` from the personal-ID field so the paste
   normalisation added in round 1 is actually reachable instead of being pre-empted by
   the browser.
7. **`JoinForm.test.tsx`** — the "generic error routes to retry" test and the
   "non-auth failure keeps the proven session" regression now drive the identical setup;
   merge into one test that asserts the retry phase **and** the successful resubmit.

## 10. Release bookkeeping

- `CHANGELOG.md`: the existing `Unreleased` section (round 1) is renamed
  **`0.11.0 — Owner fix list (2026-07-28)`** and round 2's entries are folded into it.
  Round 1 never carried a version number, so both rounds ship as one release.
- `DECISIONS.md`: **ADR-024** (023 is the legacy-quote audit). Records every decision in
  the table above plus the three consequences a later reader would otherwise re-litigate:
  the region-member definition change, the tier backfill being safe because payments
  freeze their own price, and the `M-` prefix that makes referral attribution
  unambiguous.
- `DESIGN.md`: rows added for `EventRow`, `LeaderboardDirectory`, `ReferralCard`,
  `SupportForm`; the `TierPicker` row removed; the `NewsCard` row's variant note corrected.

## 11. Cross-cutting constraints

- **Georgian integrity.** No new Georgian is typed anywhere in this round. Every string is
  reused whole from an existing file or derived from one by deleting characters. The only
  exception is the support page, whose copy the owner supplies.
  `node scripts/ka-gate.mjs --diff main <files>` after every task touching Georgian.

  Every Georgian run in this document was machine-checked against repo bytes. Exactly
  three strings do not yet exist whole and are **composed from verified word sources**:

  | New string | Spliced from |
  |---|---|
  | `წევრი (გადახდის გარეშე)` | `lib/admin.ts` (`profile_completed`) + `app/(public)/page.tsx` (`LADDER_1_DESC`) |
  | `აქტიური წევრი` | `app/(public)/page.tsx` (`STAT_ACTIVE_LABEL`) — exists whole, copy it |
  | `შეგროვებული თანხა (₾)` | `app/(public)/transparency/page.tsx` + `app/(admin)/admin/finances/BulkMatch.tsx` |

  Compose them with a script that reads the source files; do not retype them from here.
- **Migrations** are authored here and **pushed by the owner** with a PowerShell command
  handed to them. Never applied from this session. Timestamps run after
  `20260728100000`.
- **Staging holds the owner's real account.** No reseeding, no wiping, no data repair by
  hand. The tier backfill is the one data-touching statement in the round and it runs in
  a reviewed migration.
- TypeScript strict, no `any`, no `@ts-ignore`. Domain logic pure in `lib/`. Zod at every
  boundary. Admin mutations write to `audit_log`. Server-side authorization on every
  mutation.
- **New dependency:** Resend, via the Vercel Marketplace. Recorded in DECISIONS.md as the
  rules require. Nothing else is added.
- TDD per task: failing test first, then implementation. Pure deletions use a grep gate
  instead, stated inline.

## 12. Risks

| Risk | Handling |
|---|---|
| Region member counts drop visibly on the finances page | Intended; owner warned before approval; stated in the changelog in plain language |
| `protect_profile_columns` blocks the tier backfill | The migration verifies trigger behaviour for the migration role before the update, and disables/re-enables around the single statement if needed |
| A member on 5₾ silently starts owing 10₾ | Called out in the changelog; the billing page states the fee plainly |
| Resend not provisioned when the support task starts | The task is ordered last among the feature tasks and blocks on the owner's provisioning step |
| `/delegates` redirect accidentally swallowing `/delegates/<slug>` | Exact-path source; an e2e assertion covers both paths |
| Referral code collision between members and delegates | Impossible by construction: `M-` prefix cannot occur in a delegate code |
