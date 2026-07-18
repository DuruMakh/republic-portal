# Design Spec — Phase 5: Community

**Date:** 2026-07-19
**Status:** Approved in brainstorming (owner approved 12 product decisions and the
consolidated design). Ships as **v0.6.0**, PR "Phase 5 — Community (v0.6.0)".
**Parent spec:** `2026-07-12-republic-portal-production-design.md` (binding platform
spec; this document details its "Phase 5 — Community" roadmap row, the §6 public-site
news/events/transparency areas, the §6 member-cabinet polls/news/events areas, the §6
delegate team-RSVP overview, the §4 data-model rows for `news`, `events`,
`event_rsvps`, `polls`, `poll_votes`, and the §5 `editor` role).
**UX contract:** `prototype/index.html`, screen `me-polls` (markup ~792–806, logic
~1845–1883). News, events and the transparency page have **no prototype screens** —
they are the parent spec's approved "extras" and follow the design-system registers
(public = bold/patriotic, cabinet = calm, admin = dense; DESIGN.md).
**Known deviations from the prototype, all owner-approved:**

- The prototype's polls had no lifecycle. Real polls are draft → open → closed
  (manual, audited) with an optional end date the server enforces on its own.
- The prototype showed results only in the "already voted" state. Real rule (owner
  choice #4): voters see results while a poll is open; after close **every member**
  sees them; the public never does.
- Prototype toasts (`ხმა ჩაითვალა`) become inline confirmations (house pattern since
  Phase 2).
- The prototype's member nav had four tabs; the cabinet gains სიახლეები and
  ღონისძიებები (parent-spec extras), so members carry six.

---

## 1. Goal

Give the movement its public voice and its internal engagement loop: an editor-run
news feed (public or member-only per article) with shareable article pages, events
with member RSVP and a delegate team-attendance overview, internal polls whose
one-vote-per-member rule is a database constraint, and a public transparency page
whose every number is derived live from recorded payments and the member register —
never stored, never editable. All of it under the Phase 4 access model: self-gating
reads, audited SECURITY DEFINER mutations, RLS mirroring every visibility rule.

## 2. Decisions locked in brainstorming (owner-approved)

| # | Decision | Choice |
|---|---|---|
| 1 | News visibility | **Per-article**: editor picks საჯარო (public site + cabinet feed, OG tags) or წევრებისთვის (cabinet feed only, RLS-hidden from everyone else, requires completed registration at the DB level) |
| 2 | Poll authors | **editor + super_admin** (same content role as news/events; audit log records the actor either way) |
| 3 | Poll lifecycle | **Manual open/close + optional end date.** Draft → open (freezes question/options) → closed. All transitions audited. After `ends_at` passes, the server refuses votes even if nobody clicked close |
| 4 | Poll results | **Prototype rule**: while open — percentage bars + total only after casting your vote; after close — visible to all members; **never public** |
| 5 | Event capacity | **None in v1** (a later column, no rework) |
| 6 | RSVP cancellation | **Yes — toggle** მოვალ ⇄ გაუქმება any time before the event starts; one row per member per event flips status |
| 7 | Past events | **Archive section** (მომავალი / გასული); past pages stay live, RSVP locks at start time |
| 8 | RSVP counts | **Internal only** (member cabinet, delegate overview, admin). The public event page never shows a number |
| 9 | Transparency headline | Three counters: **სულ შეგროვებული საწევრო შენატანები (GEL) · რეგისტრირებული წევრი · დამტკიცებული დელეგატი**. (Active members deliberately *not* a headline counter) |
| 10 | Transparency money detail | **All-time only** — one figure, no per-year split, no charts |
| 11 | Transparency region table | Both columns per region: **რეგისტრირებული + აქტიური** |
| 12 | News body format | **Plain text + auto-links**: blank line = paragraph break; URLs become safe links automatically; no HTML/markdown stored; optional cover image (Supabase Storage) doubles as the OG image |

Design-gate approvals riding on the above: member-only articles render inside the
cabinet (`/me/news/…`), never on the public URL space; the admin surface is a single
**შიგთავსი** hub (`/admin/content/*`) rather than three top-level tabs; polls are
member-cabinet-only (no public surface at all); votes cannot be changed once cast
(prototype lock).

## 3. Screens

Public pages are server-rendered in the bold/patriotic register with the same ISR
caching as the rest of the public site (`revalidate = 60`), **plus**
`revalidatePath` on publish/unpublish/cancel so editors see their action live
immediately. Public shells stay session-agnostic (no per-user state in cacheable
HTML — Phase 3 principle). Cabinet pages are per-request SSR behind the existing
layout gates; `/me/*` is already NetworkOnly in the service worker, which is what
makes member-only content safe on shared devices. Georgian throughout; Georgian
typographic quotes are „ " (U+201E/U+201C), byte-exact.

### 3.1 Public — სიახლეები `/news` and `/news/[slug]`

- List: published **public** articles, newest first. Each card: cover thumbnail (if
  any), date (ka-GE), title, first ~2 lines of body. Empty state: „სიახლეები მალე
  გამოჩნდება".
- Article page: title (serif display), date, cover image (if any), body rendered by
  the §5 renderer (paragraphs + auto-links). Back link ← სიახლეები.
- Metadata (`generateMetadata`): `title` = article title — ქართული რესპუბლიკა;
  `description` = first ~160 chars of the body's first paragraph; `openGraph.images`
  = cover image, else the new branded default banner (§3.8). Unknown/unpublished/
  member-only slug → 404.
- Slugs: minted at **first publish** from the title via the §5 transliterator
  (`^[a-z0-9]+(-[a-z0-9]+)*$`, ≤80 — the delegate-slug rules), permanent thereafter
  (URL stability; unpublish → re-publish keeps it). Collision → `-2`/`-3` retry in
  the server action, mirroring delegate approval.

### 3.2 Public — ღონისძიებები `/events` and `/events/[slug]`

- List: **მომავალი** section (soonest first), then **გასული** (most recent first).
  Card: date/time (Tbilisi), title, location, cancelled pill when applicable. An
  event is "past" once `coalesce(ends_at, starts_at)` has passed.
- Detail page: title, full date/time (+ end time if set), location (free text),
  description via the same §5 renderer. `status = cancelled` → prominent
  „ღონისძიება გაუქმებულია" banner; the page stays live (links never break).
- **No attendee count anywhere public** (decision #8). One static CTA for every
  visitor (the cached shell is session-agnostic): „დასწრების აღნიშვნა კაბინეტში" →
  `/me/events`; signed-out visitors get bounced to `/login` by the existing cabinet
  gate. RSVP itself lives only in the cabinet.
- Metadata: title/description/OG with the default banner (events carry no images in
  v1). Draft slug → 404. Slug minting identical to news.

### 3.3 Public — გამჭვირვალობა `/transparency`

Exact content (owner approves this microcopy as part of the spec gate):

- H1: **გამჭვირვალობა**; intro line: „ღია მონაცემები მოძრაობის წევრობასა და
  შემოსავლებზე — პირდაპირ რეესტრიდან."
- Three `StatCard`s:
  - **შეგროვებული საწევრო შენატანები** — `N ₾` (ka-GE formatted), sublabel „სულ,
    დაარსებიდან" — the all-time sum of recorded, non-voided payments.
  - **რეგისტრირებული წევრი** — count of completed registrations
    (`status <> 'draft'`).
  - **დამტკიცებული დელეგატი** — count of approved delegates.
- Region table **წევრები რეგიონების მიხედვით**: 11 rows (all regions, zeros
  included), columns რეგიონი / რეგისტრირებული / აქტიური, ordered by registered
  desc, then name.
- Method note (small, muted): „მონაცემები გამოითვლება ავტომატურად: შენატანები —
  აღრიცხული საბანკო გადარიცხვებიდან, წევრობა — რეგისტრაციის რეესტრიდან. გვერდი
  ახლდება უწყვეტად."
- Every figure comes from the §4.4 anon-granted aggregate views at render time.
  Nothing on this page is stored or editable (parent-spec forbidden pattern).
- Metadata: static title/description + default OG banner.

### 3.4 Public header/footer

The public header and footer site-link blocks gain სიახლეები · ღონისძიებები ·
გამჭვირვალობა, following the existing responsive header patterns (no restyling).
Placement details follow the current component structure at implementation time.

### 3.5 Member cabinet — `/me/news`, `/me/events`, `/me/polls`

CabinetNav (members **and** delegates) gains სიახლეები, ღონისძიებები, გამოკითხვები.

- **`/me/news`** — the feed: published articles of *both* visibilities, newest
  first; member-only articles carry a „წევრებისთვის" pill. Public articles link to
  `/news/[slug]` (shareable); member-only ones open at **`/me/news/[slug]`**
  (NetworkOnly zone — never cached on shared devices, never OG-rendered). A
  member-only slug requested by a non-member (or via `/news/…`) is a 404.
- **`/me/events`** — upcoming events with live RSVP: primary button **მოვალ** ⇄
  ghost **გაუქმება** (toggle until `starts_at`; after that the controls lock with
  „რეგისტრაცია დახურულია"). Shows the member's own state („შენ მოდიხარ") and the
  internal going-count („სულ მოდის N წევრი"). Past events collapse into a compact
  გასული list without controls. Cancelled upcoming events render with the
  cancelled pill, controls removed.
- **`/me/polls`** — the prototype screen, made real: page head „შიდა გამოკითხვები /
  მიიღე მონაწილეობა მოძრაობის შიდა გადაწყვეტილებებში." Open polls first (newest
  first), then closed ones.
  - Open + not voted: option buttons (ghost, block, prototype layout); optional
    deadline line „ბოლო ვადა: <date>" when `ends_at` is set.
  - Open + voted: percentage bars + „✓ შენ უკვე მიეცი ხმა · სულ N ხმა" (prototype
    markup), the member's own choice marked.
  - Closed: bars + total for **everyone**, plus „გამოკითხვა დასრულებულია"; voters
    keep their own-choice mark.
  - Voting is one server action → §4.5 RPC; success re-renders bars inline (no
    toast). Double submit / late vote / closed poll → inline Georgian error from
    the RPC's token.

### 3.6 Delegate cabinet — team RSVP overview

The delegate panel gains a **გუნდის RSVP** section: each upcoming event with „შენი
გუნდიდან მოდის N" and, expanded, the names (first + last) of team members with a
current `going` RSVP. Served by the §4.5 `delegate_team_rsvps` read path — gated to
the caller's own delegates row exactly like `delegate_team`. Delegates RSVP for
themselves in `/me/events` like any member (they hold all three new member tabs).

### 3.7 Admin — შიგთავსი hub `/admin/content/*`

- AdminNav gains one tab **შიგთავსი** for `editor` + `super_admin` (TAB_MATRIX
  entry). An editor whose only role is `editor` is redirected from `/admin` to
  `/admin/content` (today they'd land on a staff-gated overview). The hub has a
  secondary nav (სიახლეები / ღონისძიებები / გამოკითხვები) over three routes:
  `/admin/content/news`, `/admin/content/events`, `/admin/content/polls` — dense
  register, admin list pattern (GET-form filters where useful, `adminControlClasses`
  controls, DataTable-style tables).
- **News**: table (title, visibility, status draft/published, published date,
  actions) + create/edit form: title, visibility radio (საჯარო / წევრებისთვის),
  body textarea, **live preview pane** running the same §5 renderer the public page
  uses, cover upload (JPEG/PNG/WebP ≤5MB — the Phase 4 photo-upload envelope:
  app-side role precheck + service-role storage write + re-checking audited RPC).
  Actions: შენახვა (draft), გამოქვეყნება (mints slug on first publish), მოხსნა
  (unpublish → back to draft; URL 404s until re-published), წაშლა (drafts that were
  never published only). Published articles are never hard-deleted — unpublish is
  the retraction path.
- **Events**: table + form: title, description (same renderer semantics), location,
  starts_at (+ optional ends_at) entered and displayed as Tbilisi wall time
  (ADR-016 discipline), stored timestamptz. Actions: შენახვა, გამოქვეყნება (mints
  slug), გაუქმება (cancelled banner goes live; RSVPs lock), წაშლა (never-published
  drafts only). Editing a published event is allowed (typo/venue fixes) and
  audited.
- **Polls**: table (question, status, votes so far, dates) + form: question,
  options (2–10 ordered rows), optional `ends_at`. Actions: შენახვა (draft only),
  გახსნა (open — freezes question/options), დახურვა, წაშლა (drafts only). Editor
  sees live per-option counts at all times (operational need; the anchoring rule
  protects voters, not staff).
- Every mutation is a §4.5 audited definer RPC; the audit viewer gains Georgian
  labels for the whole new taxonomy (§4.5 list).

### 3.8 Default OG banner

**Already exists** (Phase 1: `public/og-default.png`, generated by
`scripts/generate-og-default.mjs`; `app/layout.tsx` sets it as the site-wide
`openGraph.images` default with `metadataBase` from `lib/site.ts`). Phase 5 reuses
it: news-without-cover, events and transparency set it explicitly in their own
`generateMetadata` (Next.js metadata merging replaces the whole `openGraph` key,
so per-page metadata must restate the image).

## 4. Database (one migration)

All schema via one migration `supabase/migrations/<timestamp>_community.sql`,
applied with the documented pooler procedure. Enums as text + CHECK constraints (house style).
`created_by uuid references profiles(id) on delete set null` on authored rows is
internal (never exposed publicly; in practice authors are canonical admins —
e2e/per-run users can never author because they never hold the editor role). All
date-window checks use `tbilisi_today()` / timestamptz comparisons per ADR-016.

### 4.1 Tables

- `news`: id uuid PK default, title text (1–160), body text (non-empty), visibility
  text check in ('public','members'), status text check in ('draft','published'),
  slug text unique (null until first publish; regex + ≤80 check), image_url text
  null, published_at timestamptz null, created_by, created_at, updated_at.
- `events`: id, title (1–160), description text (non-empty), location text (1–200),
  starts_at timestamptz, ends_at timestamptz null (check ends_at > starts_at),
  status text check in ('draft','published','cancelled'), slug text unique (null
  until publish), published_at, created_by, created_at, updated_at.
- `event_rsvps`: event_id FK → events (cascade), member_id FK → profiles (cascade —
  e2e/staging cleanup precedent from payments), status text check in
  ('going','cancelled'), created_at, updated_at, **PK (event_id, member_id)** — one
  row per member per event by construction.
- `polls`: id, question text (1–300), status text check in ('draft','open',
  'closed'), ends_at timestamptz null, opened_at, closed_at, created_by,
  created_at, updated_at.
- `poll_options`: id uuid, poll_id FK → polls (cascade), position int (unique per
  poll), label text (1–120); **unique (poll_id, id)** so votes can FK the pair.
- `poll_votes`: poll_id, option_id, member_id FK → profiles (cascade), created_at;
  **PK (poll_id, member_id)** — *the* one-vote-per-member constraint (parent spec
  §4); **FK (poll_id, option_id) → poll_options (poll_id, id)** — a vote can never
  point at another poll's option.

### 4.2 Member/public read model (views, like `public_delegates`)

Base tables get **no** anon/authenticated SELECT grants; reads go through views:

- `public_news` — published + `visibility='public'` columns only (id, slug, title,
  body, image_url, published_at). Granted anon + authenticated.
- `public_events` — status in ('published','cancelled') (id, slug, title,
  description, location, starts_at, ends_at, status, published_at). Granted anon +
  authenticated. (Cancelled stays visible by design; drafts never appear.)
- `member_news` — published rows of both visibilities (id, slug, title, body,
  image_url, visibility, published_at — `visibility` drives the feed's
  „წევრებისთვის" pill), **self-gating**: returns zero rows unless `auth.uid()`
  has a completed registration (`registration_completed_at is not null`) — the
  DB-level meaning of „წევრებისთვის". Granted authenticated.
- `member_polls` — status in ('open','closed') with opened_at/closed_at/ends_at,
  self-gating on completed registration. Granted authenticated.
- `member_poll_options` — poll_id, option_id, position, label for open/closed
  polls, self-gating on completed registration. **This is what renders the option
  buttons before voting** — labels are always member-visible; only counts are
  gated. Granted authenticated.
- `poll_option_counts` — poll_id, option_id, votes::int, gated per poll: rows
  visible iff the caller has a completed registration AND (has a vote in that
  poll OR the poll is closed) — the decision-#4 rule, enforced in the database.
  Granted authenticated.
- `event_rsvps`: RLS SELECT own rows (`member_id = auth.uid()`) so the cabinet can
  join its own state; the internal going-count comes through
  `member_event_going_counts` (event_id, going::int; self-gating on completed
  registration).
- `poll_votes`: RLS SELECT own rows (`member_id = auth.uid()`) — how the cabinet
  knows whether you voted and marks your choice; never anyone else's row.
- Admin: `admin_news`, `admin_events` (+ per-event going counts), `admin_polls`
  (+ per-option counts) — self-gating definer views for editor|super_admin, ADR-014
  pattern (zero rows otherwise).

### 4.3 Transparency aggregates (anon-granted, aggregate-only)

- `transparency_stats` — single row: `total_gel` (sum of non-voided payments'
  amount_gel, all-time), `registered_members` (profiles status <> 'draft'),
  `approved_delegates`. (The existing `public_stats` home view stays untouched.)
- `transparency_regions` — one row per region (zeros included): region_id, name_ka,
  `registered` (status <> 'draft'), `active` (status = 'active_member' — the
  ADR-015 engine's derived value, kept current by recompute + nightly sweep).
- Both granted anon + authenticated. They expose sums/counts only — no row-level
  data — and are the only new public data surface.

### 4.4 Grants and RLS riders

- All six tables: RLS enabled; no direct table grants to anon; authenticated gets
  only own-row SELECT on `event_rsvps` and `poll_votes` (policy + column-scoped
  grant). All writes go through RPCs (`authenticated` EXECUTE grants on exactly
  the §4.5 functions).
- Storage: new **public bucket `news-images`** mirroring `delegate-photos` (public
  read; writes only via the service-role upload action paired with the re-checking
  RPC; versioned filename `<news_id>-<timestamp>.<ext>`, the delegate-photos
  convention — the row stores the full public URL in `image_url`, mirroring
  `delegates.photo_url`).

### 4.5 Mutation & scoped-read RPCs (SECURITY DEFINER, `search_path=''`, role check first, audit in-transaction)

Editor|super_admin (each writes its `audit_log` row in the same transaction; error
tokens for the Georgian mapping):

- `admin_save_news(p_id null, p_title, p_body, p_visibility)` → upsert draft/edit
  (`news.save`); editing a published article keeps it published (`news.update`
  when already published).
- `admin_publish_news(p_id, p_slug)` → validates completeness, sets status, mints
  the permanent slug on first publish (`news.publish`).
- `admin_unpublish_news(p_id)` (`news.unpublish`); `admin_delete_news(p_id)` —
  never-published drafts only (`news.delete`).
- `admin_set_news_image(p_id, p_image_url)` — pairs with the upload action
  (`news.set_image`).
- `admin_save_event(p_id null, p_title, p_description, p_location, p_starts_at,
  p_ends_at)` (`event.save` / `event.update` when already published),
  `admin_publish_event(p_id, p_slug)` (`event.publish`),
  `admin_cancel_event(p_id)` (`event.cancel`), `admin_delete_event(p_id)` —
  never-published drafts only (`event.delete`).
- `admin_save_poll(p_id null, p_question, p_options text[], p_ends_at)` — draft
  only; replaces options atomically (`poll.save`).
- `admin_open_poll(p_id)` — requires ≥2 options; freezes content (`poll.open`);
  `admin_close_poll(p_id)` (`poll.close`); `admin_delete_poll(p_id)` — drafts only
  (`poll.delete`).

Member RPCs (subject always `auth.uid()`, completed registration required,
validation in-DB, **no audit rows** — audit_log is the admin trail, matching the
funnel/cabinet precedent):

- `member_rsvp(p_event_id, p_going boolean)` — upsert the (event, member) row;
  rejects drafts, cancelled events, and `starts_at <= now()` (`rsvp_closed`).
- `member_cast_vote(p_poll_id, p_option_id)` — insert; rejects non-open polls and
  `ends_at < now()` (`poll_closed`); the PK turns a second vote into
  `already_voted` deterministically.
- `delegate_team_rsvps()` — read RPC gated to the caller's own delegates row
  (mirrors `delegate_team`): upcoming events + going-count + going names from the
  caller's current team.

### 4.6 Verification probes (`scripts/verify-schema.mjs`)

New Phase 5 block: anon sees `public_news`/`public_events`/`transparency_*` but
zero draft/member-only rows and no base tables; a pre-completion authenticated user
gets zero rows from the member views; a completed member sees member-only news,
sees an open poll's option labels **before** voting (`member_poll_options`) while
`poll_option_counts` stays empty until they vote or the poll closes, and reads back
their own vote (and only their own); double vote → `already_voted` (PK, not app
code); RSVP toggle keeps exactly one row; editor RPCs write audit rows
in-transaction; non-editor calling an editor RPC → role error; late vote past
`ends_at` → `poll_closed`.

### 4.7 Staging seed (`scripts/seed-staging.mjs`)

Extends the wipe-safe seed: ~6 news (mixed visibility, one with a seeded cover, one
draft), ~5 events (upcoming ×2, past ×2, cancelled ×1) with RSVPs spread across
teams, 3 polls (open-with-votes, open-untouched, closed-with-results). The seed writes
content rows directly (service role, like payments), stamping `created_by` = the
canonical editor admin (+995509000004); audit rows arise only from real RPC
actions, which probes/e2e perform as canonical admins; e2e per-run users
(`55XXXXXXX` phones, `9…` personal IDs) may only be targets/voters, never authors.

## 5. Domain logic (`lib/`, pure, TDD)

- `lib/content-render.ts` — `parseBody(text): Paragraph[]` where a paragraph is a
  list of text/link spans: blank-line splitting, `https?://` URL tokenization with
  trailing-punctuation trimming. Renders in React as elements (never
  `dangerouslySetInnerHTML`) with `rel="noopener noreferrer nofollow"`,
  `target="_blank"`. Also `excerpt(text, max): string` for list cards and OG
  descriptions (first paragraph, word-boundary trim, ellipsis).
- `lib/slug.ts` — **already exists** (Phase 1: `transliterateGeorgian` implements
  exactly the national romanization with apostrophes dropped; `slugBase`/`makeSlug`
  power delegate approval). Phase 5 generalizes without changing delegate behavior:
  `slugFrom(text, fallback)` (the current `slugBase` logic with a caller-chosen
  empty-romanization fallback) and `makeSlugFrom(text, fallback, taken)` (collision
  `-2`/`-3` suffixing); `slugBase`/`makeSlug` become thin wrappers with fallback
  `"delegati"`. News uses fallback `"article"`, events `"event"`. Shared by the
  publish server actions.
- `lib/community.ts` — `splitEvents(events, now)` → upcoming/past (by
  `coalesce(ends_at, starts_at)`); `rsvpOpen(event, now)`; `pollView(poll, myVote)`
  → 'buttons' | 'results-own' | 'results-closed' (decision #4 as one pure
  function); `percentages(counts)` — integer percentages summing sanely (largest-
  remainder), reused by cabinet and admin bars; Tbilisi date/time formatting via
  the existing `lib/cabinet.ts` helpers.
- `lib/content-schemas.ts` — zod for every boundary: news form (title 1–160, body
  1–20000, visibility enum), event form (fields + Tbilisi datetime parsing +
  ends-after-starts refinement), poll form (question 1–300, 2–10 options each
  1–120, unique-trimmed, optional future ends_at), rsvp input, vote input. Image
  upload constraints reuse the Phase 4 photo constants (`PHOTO_TYPES` /
  `PHOTO_MAX_BYTES` from `lib/admin-schemas.ts`) — identical rules, zero
  duplication.
- `lib/admin.ts` riders — შიგთავსი TAB_MATRIX entry (editor + super_admin), audit
  labels for the §4.5 taxonomy (e.g. `news.publish` → „სიახლის გამოქვეყნება",
  `poll.close` → „გამოკითხვის დახურვა"), content-status pill labels.
- `lib/cabinet.ts` riders — three new CabinetNav items for member and delegate
  role shapes.

## 6. Security & error handling

- **Access model unchanged from Phase 4 (ADR-014):** self-gating views for reads,
  audited definer RPCs for every admin mutation, thin zod server actions in front,
  error tokens → Georgian messages via the existing mapping. Client checks remain
  UX only.
- **Member-only content never enters a cacheable zone:** it renders exclusively
  under `/me/*` (service-worker NetworkOnly since Phase 0) and is excluded from
  `public_news` at the database level. Public pages stay session-agnostic (RSVP
  state and counts appear only in the cabinet), so ISR caching leaks nothing.
- **One vote per member is the `poll_votes` primary key**; option/poll integrity is
  the composite FK; open/close windows re-checked inside the RPC at vote time
  (`tbilisi`-consistent `now()` comparisons). RSVP windows likewise in-DB.
- **No service-role in any public path.** The single new service-role touch is the
  news-cover upload action (editor precheck + audited re-checking RPC), the exact
  Phase 4 photo envelope. Upload validates content-type + ≤5MB on both sides.
- **XSS surface is zero by construction:** bodies are stored as plain text and
  rendered as React elements; links get `noopener noreferrer nofollow`; no HTML
  ever round-trips.
- Public 404s for anything unpublished/member-only keep drafts unenumerable
  (slugs are only minted at publish, so draft URLs don't exist).
- **Accepted exposure (same model as delegate photos):** cover images — including
  member-only articles' covers — live in the public `news-images` bucket; anyone
  holding the exact URL sees the image (never the text). Paths embed unguessable
  UUIDs; covers are illustrative by policy — a member-only article that would need
  a sensitive image simply doesn't get one. The stricter alternative (private
  bucket + signed URLs) is recorded here as the later fix if that policy ever
  changes.
- Georgian inline errors for every failure token (`already_voted`, `poll_closed`,
  `rsvp_closed`, `invalid_slug`, role errors) in the house error-mapping location
  (`lib/funnel.ts`'s token → Georgian map, per the Phase 2–4 precedent).

## 7. Testing

- **Unit (Vitest, pure lib/):** renderer (paragraphs, links, punctuation edges,
  excerpt), transliteration + slug minting (Georgian titles, collisions, empty
  fallback), splitEvents/rsvpOpen boundary times (Tbilisi midnight edges),
  pollView matrix (all states × voted/not), percentages (rounding to 100),
  every zod schema (valid + each failure).
- **Component (Testing Library):** poll card (buttons ⇄ bars ⇄ closed states),
  RSVP toggle states + locked state, news form preview pane, admin poll form
  option rows.
- **e2e (Playwright, staging, canonical editor + per-run members):**
  1. *Content publishing:* editor drafts + publishes a public article and a
     member-only article → public page shows the first (with OG tags present),
     404s the second; member feed shows both; unpublish → public 404. Event
     publish → appears upcoming; cancel → banner.
  2. *RSVP + delegate overview:* member RSVPs, sees „შენ მოდიხარ", cancels,
     re-RSVPs; delegate's გუნდის RSVP shows the going count/name; count matches.
  3. *Polls:* editor creates + opens a poll; member votes → bars + total; second
     vote attempt fails with the Georgian message (DB constraint, asserted via a
     direct second RPC call too); editor closes → non-voting member now sees
     results; transparency page renders the seed-derived totals (spot-assert the
     three counters + one region row against seeded data).
- Existing e2e suites (funnel, cabinets, admin) stay green — CI runs everything.

## 8. Hygiene riders

- DESIGN.md + `/styleguide`: Phase 5 note (content cards, RSVP toggle pattern, poll
  bars reuse admin bar math; any new shared component gets a gallery sample).
- ARCHITECTURE.md: "Community (Phase 5)" section (views/RPCs model, member-only
  placement rule, transparency derivation).
- DECISIONS.md: **ADR-017** — content publishing model (per-article visibility via
  self-gating member views; member-only content confined to `/me/*`; plain-text
  renderer over markdown, zero new dependencies; slug minting at publish; polls'
  DB-constraint vote rule; transparency as anon aggregate views).
- CHANGELOG 0.6.0 + `package.json` version bump.
- No new npm dependencies anywhere in this phase.

## 9. Out of scope (deliberate, each a later add without rework)

Event capacity/waitlists; comments/reactions; push/email notifications; poll vote
changing or anonymous-to-admin voting; event images; monthly finance charts or
per-year splits; RSS; delegate-only news tier; scheduling posts; i18n.

## 10. Rollout & sign-off

Branch `claude/phase-5-community-8f6517` → migration to staging (documented pooler
procedure) → seed rewrite → probes green → UI tasks with TDD + per-task reviews →
whole-branch review → CI green → `/qa` on the Vercel preview → owner sign-off
package: preview URL; demo logins — editor +995509000004 (content flows), a seeded
member (feed/RSVP/vote), a seeded delegate (team RSVP), super_admin +995509000001
(audit trail of content actions); plain-language walkthrough with screenshots of:
public news/article/OG preview, events + cancelled banner, transparency page,
member feed with the member-only pill, RSVP toggle, poll voting before/after,
delegate team RSVP, admin შიგთავსი, audit rows. Merge only after owner approval;
never with failing CI.

## 11. Success criteria

- An editor (role granted via Phase 4 admin management) can draft, preview,
  publish, unpublish news (public and member-only), publish/cancel events, and run
  a poll end-to-end — every action visible in the audit viewer.
- A member sees exactly the right things: member-only news in the cabinet only;
  results only after voting or close; RSVP toggle honest until start time.
- A delegate sees their team's attendance; nobody else's.
- The public sees news/events/transparency with working OG previews, and can never
  reach drafts, member-only articles, RSVP data, or poll internals — verified at
  the database level by probes, not just by UI absence.
- `poll_votes`' primary key — not application code — is what makes double voting
  impossible; the probe proves it.
- Transparency figures equal the recorded-payments sum and register counts at all
  times, with no stored copy anywhere.
- All prior e2e suites still green; v0.6.0; owner sign-off recorded in the PR.
