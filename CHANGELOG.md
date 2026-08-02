# Changelog

## 0.12.0 - The support page (2026-08-02)

A new page where anyone can write to the movement, reachable from the link in the
footer of every public page (11).

- Someone visiting the site can leave their name, a message, and either an email
  address or a phone number - whichever they actually use. At least one of the two
  is required, because a message nobody can reply to helps neither side.
- Every message is stored, and you read them in the admin area under a new
  Messages tab that only a super-admin can open. The list pages 50 at a time, so
  nothing ever falls out of reach.
- The same person can send three messages every ten minutes. Beyond that they are
  asked to wait, which is what stops the page being used to flood you.
- **No email is sent yet.** This was your decision: the address available was a
  test one and the real destination will differ. Until that is wired up, nothing
  notifies you - messages wait in the admin area until you look. The page tells
  visitors they will get an answer, so that promise rests on the habit of checking.

### Also in this release

- A round of code review found fifteen problems in the above before it shipped,
  including two that would have let a stranger write into the message table
  directly and one that made the three-per-ten-minutes limit ignorable. All were
  fixed and each is now covered by a test that fails against the old code.
- The project gained a checker for a specific kind of invisible text corruption -
  a Latin or Russian letter hidden inside a Georgian word, which looks perfect on
  screen. The whole codebase was checked with it and is clean. This is the first
  time that has been verified.
- Two project tools that had quietly stopped working properly on your machine were
  repaired, so problems now show up locally instead of only in the cloud.


## 0.11.0 — The owner fix list (2026-07-29)

Both rounds of the fix list ship together; round 1 never carried a version number
of its own.

### Round 2

- The home page now carries a proper news section and an events section, each with
  a "see more" link, instead of a small news box tucked into the side column (2)
- The delegates list page is gone: it duplicated the ranking page, so the ranking
  page survives and the old address forwards to it automatically. Nothing is lost
  — individual delegate pages are untouched, and the search-by-name and
  filter-by-region controls that only existed on the old page now live on the
  ranking page (3)
- The finances page now shows, for each region, how many members it has and how
  much money has been collected there. The "active" column it replaces is gone.
  Money is attributed to the region a member lives in now, so someone who moves
  takes their history with them. **The member numbers themselves do not change** —
  that column already counted members rather than everyone who registered, despite
  earlier advice to the contrary (5)
- Membership is a fixed 10₾ a month. The 5/10/20 choice is gone from the sign-up
  wizard, from the payments page, from the home page text and from the admin
  statistics, and the database now refuses any other amount. Members who were on
  5₾ or 20₾ are now on 10₾. **Nobody loses paid-up time**: every payment
  permanently records the price it was made at, so past payments still buy exactly
  the months they always bought (9)
- Everyone now has their own referral link, not just approved delegates, and can
  see how many people have registered through it. Members see a number only, never
  a list of names. Someone who joins through a member's link is not assigned a
  delegate — they choose their own, as before. If a member later becomes a
  delegate, their earlier sign-ups still count towards their total (12)
- The admin member list can be filtered by city, and the filter applies to the CSV
  export as well as to what is on screen. Choosing a city and then switching to a
  region that does not contain it no longer produces a silently empty list (16)
- The three member statuses no longer read as a puzzle: "registered", "member (no
  payment)" and "active member" now say plainly what each one is, everywhere they
  appear — the list, the filter, the export and the delegate's own team table (16)
- The caption under "I have no delegate" stays removed, as decided — it claimed
  something the new wording contradicts (8b)

Two items on the list are **not** in this release: the support page (11), which is
waiting on its Georgian wording and a destination address, and item 13, whose text
was never supplied.

Decisions behind round 2, including two corrections to what was originally
promised, are recorded in ADR-024.

### Round 1

- New dropdown look across the whole site: every select field now matches the design
  system's underline style instead of the plain browser default (1)
- The news front page now leads with one large story above a grid of the rest, and
  article photos are bounded instead of stretching oversized (4)
- The join form no longer shows the phone-number section heading twice (6)
- In the member cabinet, only the page you're actually on lights up in the navigation
  — no more two tabs highlighted at once (7)
- The "saves automatically" caption under the membership form is gone (8)
- Personal ID is now asked when becoming a member, not at initial sign-up: /join
  collects only name, surname and phone, and the duplicate-ID check moved to the
  membership step with it (10)
- The city picker lists every municipality in the country plus all ten Tbilisi
  districts, instead of the previous partial list (14)
- Member pages that show no chosen delegate now read „არ მყავს დელეგატი“ instead of a
  default that implied automatic backing of the central movement (15)

Decisions behind these fixes are recorded in ADR-022.

## 0.10.0 — The security check-up (2026-07-27)

- A full security review of the platform, and the most important result is what
  it did NOT find. Across more than 1,800 individual permission checks — every
  place the software decides whether someone is allowed to do something, tried
  from twelve different starting positions, from a stranger with no account up to
  the super-admin — the permission model did not break once. Nobody can promote
  themselves to a higher position; no member can obtain another member's ID
  number, date of birth or phone number; a vote cannot be cast twice or altered
  after the fact; the record of who did what could not be added to, changed or
  removed, attacked as a stranger, as an ordinary member and as the super-admin
  alike; and every published figure is worked out fresh each time rather than
  stored somewhere it could be edited
- What the review did find sits in one place: the sign-up path, not the vault.
  Fourteen findings were confirmed, and every serious one is about how somebody
  gets into the platform in the first place, or about what the sign-up form is
  willing to tell a stranger who asks. Nothing was found wrong with what happens
  to people's data once they are inside
- Six of the fourteen are repaired in this release: the sign-in-code page no
  longer answers the question "does this phone number have an account"; nobody
  can become a member without a verified phone number, whatever they signed up
  with; a stranger now holds no access of any kind to the member table or to the
  payments table; the anonymous write permissions found on eleven internal
  screens are removed from all twenty-four, not only the eleven; a recorded
  payment can no longer be altered or deleted, only added and voided; and the
  delegacy request that permanently removed an admin's ability to move a member
  between delegates is fixed, which frees the six members already stranded by it
- Eight remain open by decision rather than by oversight, and they are named in
  the report rather than quietly dropped: the personal-ID squatting finding
  deferred by the owner on 26 July; the registration form confirming to a
  stranger that a given government ID is already on the platform; the
  sign-in-code page still handing a working code to a stranger for a number with
  no account; sessions that never end; the revenue figure being what members say
  they intend to pay rather than what they have paid; and three low-severity
  items with no route to real harm today
- The items that must be closed before real people register are kept in
  `docs/security/LAUNCH-BLOCKERS.md`, a standing list nothing drops off: if a
  release ends without addressing an item, it stays on the list. The owner asked
  to be reminded before the site goes live, and that list is the reminder
- One correction the owner is owed: they were told the phone-number disclosure
  was fixed. It was fixed in the code, and the code had never reached the site —
  so the live site went on serving the flawed version. Every repair here is
  re-tested against the real address after it is deployed, not before, and
  "fixed" no longer means "fixed in a file"
- Impact today, stated plainly and unchanged throughout the report: the public
  address currently serves the practice database, whose roughly 1,900 people are
  invented, so real-world harm from every finding is near zero today. Every
  severity in the report describes harm at launch, with real members
- Nothing about how the platform looks or behaves has changed: no page, flow,
  label, wording or number moved. The repairs are permission and database-rule
  changes only, carried by 597 automated tests and 52 end-to-end journeys, plus a
  live harness that performs each original attack against the practice database
  and confirms it now fails
- The practice database was reset to its documented population as part of this
  release; what the reset could not remove, and why, is recorded in
  `docs/security/residue.md`. The whole result, written to be read without
  opening a single file of code, is `docs/security/report.md`

## 0.9.0 — The Kronika redesign (2026-07-24)

- Complete visual redesign of the whole platform to the "Kronika" civic-newspaper
  identity: a warm paper-and-ink palette with a single brand red, serif display
  numerals and headlines, and hairline rules in place of boxes and drop shadows.
  Every one of the 46 pages was re-dressed — the front page, the delegate registry
  and leaderboard, news and events, the transparency ledger, the join and
  membership flow, the member cabinet, the delegate desk, and the full admin
  surface — behind unchanged component contracts
- Zero behaviour change and zero database change: no business logic, API, query,
  validation, or schema was touched. This release changes only how the app looks,
  not what it does — every existing flow, permission, and number works exactly as
  before, verified by the full test suite (481 unit + 52 end-to-end), a
  zero-drift schema probe, and an independent whole-branch review
- The front page is now an editorial front page: a short manifesto, the
  how-to-join ladder, a live registry rail, the five-strong leaderboard, and a
  news box — all drawn from the same live data as before
- New brand assets: paper-toned social-share cards with the serif wordmark, plus
  refreshed application icons and favicon; the retired navy, gold, and blue
  accents are fully removed
- Accessibility: section titles across the site are proper headings again, and
  empty navigation landmarks were removed from the cabinet, delegate, and admin
  chrome, so screen-reader users can move between sections cleanly (regressions
  caught and repaired during release QA)

## 0.8.0 — Phase 6 R2: The ladder and the numbers (2026-07-23)

- Delegacy is now a member-only request from the cabinet („გახდი დელეგატი"):
  the delegate terms + one confirm button, landing in the existing admin
  verification queue. Someone is a delegate ONLY once approved — pending and
  rejected requesters keep their full member life untouched, and rejection is
  a calm final state (re-request is an admin decision)
- The database makes a delegate without a completed membership unrepresentable
  (trigger), and approval closes the new delegate's own membership inside the
  same audited operation — delegates back no one (Phase 3 canon)
- The public numbers show both rungs honestly: a cumulative „რეგისტრირებული"
  counter (total registry — never shrinks) on the homepage and transparency
  page beside the active-member figure; the header CTA now reads
  „დარეგისტრირდი"; delegate-page supporter copy describes what actually
  happens (support is expressed through membership)
- Admin overview grows to seven cards (registered, members, conversion —
  members ÷ registered); the members table shows who invited each
  registered-only row instead of the old mislabel
- Phase-5 riders + R1 review carries absorbed (ADR-019): whitespace-aware text
  guards (the staging probe caught Postgres btrim stripping spaces only —
  fixed in a follow-up migration), pinned news-image URLs, cancel-guard
  conditional DML, RSVP row locking, an 80-char slug cap with one shared
  slug-mint helper, stable poll-form option keys, poll-list revalidation,
  consolidated e2e OTP/login helpers, and a login page that surfaces a failed
  state lookup instead of bouncing existing members to /join
- Post-review hardening (15-finding max-effort review, fixed before merge):
  approved-only routing gates everywhere (pending/rejected requesters keep
  /me/delegate and the membership pages, and may change their delegate); the
  login lookup failure gained a real retry that never re-submits the
  single-use OTP; referral codes are case-normalized so hand-typed links keep
  attribution; a referral-code collision no longer masquerades as „already
  requested"; the slug-collision blind spot at the 80-char cap is closed; the
  public delegate terms returned at /join/terms so accepted terms stay
  readable; a database CHECK ties the two membership-standing bases together

## 0.7.0 — Phase 6 R1: Progressive registration (front door) (2026-07-21)

- One light registration door (/join): name, surname, personal ID, mobile +
  6-digit OTP — under a minute — replaces the 3-step member/delegate funnel.
  New base standing „რეგისტრირებული" (registered), not yet a member.
- Becoming a member moved inside the cabinet: a two-step wizard (legal profile →
  fee tier) that issues the permanent GR- bank reference code; delegate choice
  is a member privilege („ცენტრალური მოძრაობა" default)
- Standing-aware cabinet: registered tier gets events + RSVP, public news, and a
  profile with a "become a member" call to action; members keep polls, member
  news, delegate choice, and billing
- Public homepage delegate pitch retired for a single registration CTA; delegacy
  returns as a member-only request in Release 2
- Vocabulary: „წევრი" now labels the member standing and „რეგისტრირებული" the
  light tier, consistently across cabinet, delegate team, and admin surfaces
- Data model (ADR-018): member_status „draft" renamed to „registered";
  register / become_member_save_profile / become_member_complete / cabinet_state
  RPCs replace the funnel surface; a membership row is created only at completion
- Post-review hardening (max-effort review, fixed before merge): dev-OTP endpoint
  withholds codes for any existing account (closes a preview-only takeover oracle
  for the new registered tier); registration and membership flows recover from a
  transient network failure instead of freezing; an absent-profile cabinet state
  is now a typed impossibility (no more 500s); the staging seed no longer opens a
  membership for registered-standing rows, with a live D1 self-check

## 0.6.0 — Phase 5: Community (2026-07-19)

- Public news (/news + article pages with OG tags), per-article visibility:
  public or member-only (member-only lives in the cabinet feed only)
- Public events (/events + detail): upcoming/past archive, cancellation banner,
  Tbilisi wall-time display; no public attendee counts
- Transparency page (/transparency): total membership contributions (GEL,
  all-time), registered members, approved delegates, region table
  (registered + active) — every figure derived live, nothing stored
- Member cabinet: news feed (member-only pill), events with RSVP toggle
  (მოვალ ⇄ გაუქმება until start) + internal going counts, polls with the
  prototype voting UX — one vote per member enforced by the database
- Delegate panel: team RSVP overview (who from my team is coming)
- Admin შიგთავსი hub (editor + super_admin): news with live preview + audited
  cover upload, events publish/cancel, polls draft→open→closed with optional
  end date; every action audited in-transaction
- 15 new audit actions with Georgian viewer labels

## 0.5.0 — Phase 4: Admin CRM (2026-07-17)

- /admin area with DB-enforced roles (super_admin / verifier / finance / editor)
- Delegate verification: approve (mints the public slug — page + referral link live
  instantly), reversible reject with internal notes, bio/photo editing (Storage)
- Member management: search/filter/pagination, audited personal-ID reveals,
  audited CSV export (personal IDs super_admin-only, off by default)
- Payment recording: single entry + bulk paste matching by GR-code with
  classify-then-confirm preview (all-or-nothing), void with required reason
- Active-member engine: amount buys 30-day months (min 1, stacking), configurable
  grace (default 30), instant recompute + nightly sweep; seed now derives statuses
- Reassignment of ცენტრალური მოძრაობა members to delegates (history kept)
- Append-only audit log for every admin action + viewer with filters
- Personal-ID column lockdown: exactly two audited read paths remain
- Pre-release hardening pass, 2026-07-18 (ADR-016): Tbilisi-aligned date checks
  in SQL, duplicate backstop for reference-less single payments, approval
  requires a completed registration, CSV formula-injection neutralization,
  member-facing payments columns restricted, serialized last-super-admin guard,
  honest bulk previews (within-batch duplicates, real calendar dates, code
  word-boundary), fresh finance stats after recording, reseed survives real
  staging life

## 0.4.0 — 2026-07-16 (Phase 3: cabinets)

- Member cabinet: profile editing (five scoped fields; phone + personal ID
  visibly locked), delegate change with full history and instant counters,
  payments page — permanent GR-code + transfer instructions + tier change +
  honest empty history.
- Delegate panel: live referral link + QR (uqr, ADR-011), live counts
  (active / total / drafts), leaderboard-consistent rank, searchable team
  table; pending and rejected states; sign-out.
- Referral links live end-to-end; login/funnel handoff — completed users land
  in the cabinet, the funnel is one-way; session-aware public header.
- DB: column-scoped profile UPDATE re-grant + four cabinet RPCs (ADR-013);
  funnel_start referral-input cap; funnel_state exposes status + timestamps.
- Hygiene: typed Database generic on all supabase factories; staging e2e-user
  sweep + login e2e teardown fix; REFERENCE_CODE_RE derived from the alphabet;
  deterministic seeded-referral pick; OtpVerification robustness minors;
  TransferInstructions shared.

## 0.3.0 — Phase 2: Registration funnel (2026-07-15)

- Real 3-step /join funnel (member + delegate variants): contact + 6-digit OTP with
  resumable server-side drafts
- Legal profile step: duplicate personal-ID check, region→city cascade, delegate
  binding (referral links pre-fill, „ცენტრალური მოძრაობა" default)
- Tier step: 5/10/20 GEL + manual bank-transfer instructions with permanent
  per-member GR-XXXXXX reference codes (placeholder recipient details until launch)
- Delegate T&C (placeholder terms page) + pending-approval end state; pending
  delegates on no public surface
- Four SECURITY DEFINER RPCs as the sole client write path to profiles (client
  UPDATE grant revoked); statuses stay derived
- Login routes by funnel state
- Dev OTP endpoint hardened: refuses completed/active accounts, purges stale codes
  (closes the Phase 0 oracle)
- e2e: five funnel journeys (member/delegate/dup/resume/referral) on a
  collision-safe 55-block per-run phone scheme

## 0.2.0 — Phase 1: Public core

- Real public site on seeded staging data: home (hero + live counters), delegate
  directory (search + region filter), leaderboard (top-3 medals), delegate pages
  at /delegates/<slug>
- Public read model: public_delegates + public_stats views; delegates base table
  sealed from client reads; profiles.created_at now server-managed
- Per-delegate OG share cards (next/og + bundled Noto Sans Georgian), default OG
  image, env-gated robots.txt, sitemap
- Deterministic staging seed (prototype roster: 15 delegates, ~1.9k members, guarded)
- Demo-data banner on all non-production environments
- e2e: public-pages suite; CI e2e now runs against the production build (next start)
- Hygiene: BOM cleanup, Field id fix, actions v5, DESIGN.md clarifications

## 0.1.0 — Phase 0: Foundation

- Next.js + TypeScript app with Georgian design system (tokens, 6 components, /styleguide)
- Supabase schema v1: profiles, delegates, memberships, payments, admin_roles, audit_log
  (append-only), regions/cities seed, RLS everywhere
- Phone-OTP auth with dev-mode delivery (Send-SMS hook → dev_otp_inbox)
- PWA shell (manifest, icons, service worker)
- CI (typecheck, lint, format, unit, build, e2e vs staging) on GitHub Actions
- Vercel: production + per-PR previews pointed at staging
