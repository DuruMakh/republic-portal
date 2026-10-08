# Registration privacy consent — design

**Date:** 2026-10-08
**Owner decision pass:** this conversation

## 1. What this is

Registration today asks for no consent at all. The old `p_tc_accepted` / `terms_required`
check died with the progressive-registration rewrite (20260721120000), and the only
`წესები და პირობები` page holds the four **delegate** terms. An ordinary supporter can sign
up without agreeing to anything, and no general text exists to agree to.

This feature adds:

1. a public **privacy policy** page at `/privacy`;
2. one **required consent box** on the registration form (age 18+ and personal-data
   processing, in one sentence);
3. a one-line **notice** under the Google button;
4. a **stored proof of consent** (date + policy version) on every new profile, enforced by
   the server.

## 2. Legal basis (research summary, not legal advice)

Law of Georgia No. 3144 on Personal Data Protection (2023, in force 1 March 2024; supervised
by the State Audit Office since 2 March 2026, when the Personal Data Protection Service was
abolished):

- **Political opinions are special-category data (Art. 6).** Registering with a civic/
  political movement reveals one. Processing needs **written consent**; an electronic tick
  counts as written (Art. 3). The consent must be separate from other matters and in plain
  language. The Art. 6(k) exception for political associations' own members does not apply:
  the movement is not a registered organisation.
- **Notice at collection (Art. 24):** controller identity, purposes, whether data is
  mandatory, recipient **categories**, transfers abroad, retention, data-subject rights.
- **Rights (Arts. 13–20):** access, rectification, erasure, withdrawal of consent at any
  time without reasons; 10 working days to act.
- **Age (Art. 7):** own consent from 16; under 16 needs a parent's written consent. The
  platform sets 18+ (owner decision), so parental consent never arises.

(Superseded 2026-10-08: the owner dropped the draft banner at release; see ADR-041.) The text is marked as a working version pending legal review; a Georgian lawyer should read
it before launch.

## 3. Decisions taken in this conversation

1. **Approach 1 of 3:** one privacy page, one required box. No general rules-of-use page and
   no second box (YAGNI until the owner wants rules of use). The delegate terms page and its
   footer link stay unchanged.
2. **Controller:** named only as `მოძრაობა ქართული რესპუბლიკა`. No operator line, no
   registration number, no address (the movement is not registered).
3. **Minimum age: 18.** Folded into the consent sentence.
4. **Recipients by category, no company names** (owner instruction). Transfers abroad are
   still stated (EU), because the law requires it.
5. **No data-request channel and no self-service deletion for now.** The rights paragraph
   lists the rights (the law requires that) without naming a channel. Owner will add the
   channel later. See §9.
6. **No re-consent flow for existing accounts.** The only accounts are the two founders';
   their consent fields stay empty (no hand data edits, CLAUDE.md).
7. **Step-1 notice says `ეთანხმები`** (agree), not `ეცნობი` (owner correction). The step-2
   box remains: an implied "continuing = agreeing" is not written consent for special-
   category data.
8. **Consent date is not shown in the admin panel** for now; it is in the database.
9. **No policy section explaining political views as special-category data** (owner: not
   needed). The consent box is unchanged. The policy copy is a first version the owner will
   refine later; this round is about function.

## 4. User flow

**Step 1 — Google button (`/join`, Google mode).** Under the button, one line:
`Google-ით გაგრძელებით ეთანხმები ჩვენს კონფიდენციალურობის პოლიტიკას.` — the words
`კონფიდენციალურობის პოლიტიკას` link to `/privacy` (new tab). This informs before the first
data (Google email) reaches us.

**Step 2 — name, surname, phone.** Directly above the `კოდის მიღება` button, a required
`CheckboxField`:

`ვადასტურებ, რომ 18 წლის ან უფროსი ვარ და ვეთანხმები ჩემი პერსონალური მონაცემების დამუშავებას კონფიდენციალურობის პოლიტიკის შესაბამისად.`

The words `კონფიდენციალურობის პოლიტიკის` link to `/privacy` in a new tab, so typed input is
not lost.

- Unticked + button pressed → error under the box: `გასაგრძელებლად მონიშნე თანხმობა.`
  Nothing is sent (no SMS, no registration call). Ticking clears that error.
- The box gates the phone step on purpose: pressing the button sends the number to the SMS
  provider, which is processing.
- The `retry` phase (phone already verified, registration failed) keeps the tick from the
  form phase; the box stays visible and checked, and is still required.

**Legacy phone mode (`LegacyJoinForm`, demo site).** Same box and error, same position
(above its send-code button). Its server registration path enforces consent too (§6).

**Footer.** New link `კონფიდენციალურობა` → `/privacy`, placed right after the existing
`წესები` link. Sitemap gains `/privacy` (monthly, priority 0.3, like `/join/terms`).

**Mobile back header.** `/privacy` gets the same back-to-`/join` header as `/join/terms`
(`lib/mobile-nav.ts`), and joins the no-sticky-CTA set alongside it.

## 5. The policy page — `/privacy`

Public route `app/(public)/privacy/page.tsx`, same shell as `/join/terms` (Eyebrow, serif
H1, warning banner, ruled body). Metadata title:
`კონფიდენციალურობის პოლიტიკა — ქართული რესპუბლიკა`.

The copy below is authoritative. It is new prose except the banner, which is spliced from
`app/(public)/join/terms/page.tsx`. It deliberately contains no typographic quotes.

- **Eyebrow:** `პერსონალური მონაცემები`
- **H1:** `კონფიდენციალურობის პოლიტიკა`
- **Banner (spliced):** `სამუშაო ვერსია — ექვემდებარება იურიდიულ გადახედვას.`
- **Intro:** `ეს გვერდი გიხსნის, რა მონაცემებს ვაგროვებთ, რისთვის ვიყენებთ და ვინ ხედავს მათ. ვერსია 1, 2026 წლის ოქტომბერი.`

Sections (H2 + body), in this order. Where an item says bullet points, the page shows a bulleted list; the words in this spec are notes, not page text.

1. **`ვინ ვართ`** — `პლატფორმას მართავს მოძრაობა ქართული რესპუბლიკა. ის პასუხისმგებელია იმ პერსონალურ მონაცემებზე, რომლებსაც ამ საიტზე გვაწვდი.`
2. **`რა მონაცემებს ვაგროვებთ`** — bullet points:
   - `რეგისტრაციისას: Google ანგარიშის ელფოსტა, სახელი და გვარი, ტელეფონის ნომერი (დადასტურებული SMS კოდით) და რეფერალური კოდი, თუ ბმულით მოხვედი.`
   - `წევრობის განაცხადისას: დაბადების თარიღი, რეგიონი და ქალაქი, საქმიანობა და შენ მიერ არჩეული დელეგატი.`
   - `დელეგატად დამტკიცებისას: მოკლე ბიოგრაფია და ფოტო.`
   - `საიტით სარგებლობისას: ღონისძიებებზე დასწრების მონიშვნა, ხმა გამოკითხვებში და საკონტაქტო ფორმით გამოგზავნილი შეტყობინებები.`
3. **`რისთვის ვიყენებთ`** — `შენს მონაცემებს ვიყენებთ მხოლოდ მოძრაობის საქმიანობისთვის: რეგისტრაციისა და შესვლისთვის, წევრობისა და დელეგატების სისტემისთვის, ღონისძიებებისა და გამოკითხვების ორგანიზებისთვის და საჯარო სტატისტიკისთვის, რომელიც მხოლოდ ჯამურ რიცხვებს აჩვენებს. მონაცემებს არ ვყიდით და რეკლამისთვის არ ვიყენებთ.`
4. **`ვინ ხედავს შენს მონაცემებს`** — bullet points:
   - `მხარდამჭერის შესახებ საჯაროდ არაფერი ჩანს.`
   - `თუ წევრი გახდები და დელეგატს აირჩევ, ეს დელეგატი ხედავს შენს სახელს, გვარს, რეგისტრაციის თარიღს, სტატუსს და ღონისძიებებზე დასწრების მონიშვნას.`
   - `თუ დელეგატად დაგამტკიცებენ, საჯაროდ გამოჩნდება შენი სახელი, გვარი, რეგიონი, ფოტო, ბიოგრაფია და წევრების რაოდენობა.`
   - `სრულ მონაცემებს ხედავენ მხოლოდ პლატფორმის ადმინისტრატორები.`
   - `საჯაროდ ქვეყნდება მხოლოდ ჯამური რიცხვები, მათ შორის რეგიონების მიხედვით.`
5. **`ვის ვუზიარებთ`** — `მონაცემებს ვუზიარებთ მხოლოდ იმ მომსახურების მიმწოდებლებს, რომლებიც საიტის მუშაობისთვისაა საჭირო — ავტორიზაცია, SMS-ით დადასტურება, მონაცემთა შენახვა და ჰოსტინგი. ნაწილი მათგანი მონაცემებს ინახავს საქართველოს ფარგლებს გარეთ, ევროკავშირში. სხვა პირებს შენს მონაცემებს შენი თანხმობის გარეშე არ გადავცემთ, გარდა კანონით გათვალისწინებული შემთხვევებისა.`
6. **`რამდენ ხანს ვინახავთ`** — `მონაცემებს ვინახავთ, სანამ შენი ანგარიში აქტიურია. ამის შემდეგ მათ ვშლით ან ისე ვინახავთ, რომ შენი ამოცნობა შეუძლებელი იყოს.`
7. **`შენი უფლებები`** — `პერსონალურ მონაცემთა დაცვის შესახებ საქართველოს კანონის მიხედვით, შეგიძლია მოითხოვო შენი მონაცემების ნახვა, გასწორება ან წაშლა, ასევე ნებისმიერ დროს, მიზეზის განმარტების გარეშე, გაიხმო თანხმობა.`
8. **`ასაკი`** — `პლატფორმაზე რეგისტრაცია შეუძლია მხოლოდ 18 წლის ან უფროს პირს.`
9. **`ქუქი-ფაილები`** — `საიტი იყენებს მხოლოდ შესვლისთვის აუცილებელ ქუქი-ფაილებს. სათვალთვალო ან სარეკლამო ქუქი-ფაილებს არ ვიყენებთ.`
10. **`ცვლილებები`** — `თუ ამ პოლიტიკას შევცვლით, ახალ ვერსიას თარიღით აქ გამოვაქვეყნებთ.`

Facts the copy relies on (verified 2026-10-08 against main 63ad84b): no analytics or
tracking packages; public views expose only approved delegates' name/region/bio/photo/
member count plus aggregate counts; `delegate_team` returns name, sign-up date, status;
`delegate_team_rsvps` returns names of members going to upcoming events; the database is in
the EU (eu-central-1).

## 6. Data and enforcement

**Single source of the version.** `lib/privacy.ts` (pure) exports
`PRIVACY_POLICY_VERSION = "2026-10-v1"`. The database function holds the same literal; a
drift test reads the migration text and asserts the two match.

**Migration** `supabase/migrations/<ts>_registration_privacy_consent.sql` (additive):

- `profiles.privacy_accepted_at timestamptz null`, `profiles.privacy_version text null`.
  Nullable so existing rows stay valid; every row created after this migration has both.
- Both columns join the server-managed set in the existing profiles guard trigger (client
  roles cannot change them).
- `register(p_first_name, p_last_name, p_ref_code, p_privacy_version text default null)`:
  the old three-argument function is dropped and recreated with the extra argument, so there
  is exactly one overload. End state (after step 2, §8): before creating a profile it raises
  `privacy_consent_required` unless `p_privacy_version` equals the current version literal
  (step 1 refuses only a wrong version and lets a missing one through), then stamps
  `privacy_accepted_at = now()` and `privacy_version`. The duplicate-registration branch
  (profile already exists) is unchanged and does not touch consent.
- `register_google(..., p_privacy_version text default null)` likewise, passing it through.
- Grants on both functions are restored exactly as before (`register_google`: authenticated
  + service_role only).
- The `default null` keeps an old client calling with three arguments resolvable. In step 1
  that call still registers (no consent stamped); after step 2 it **fails closed** with
  `privacy_consent_required`.

**App side.**

- `lib/funnel-schemas.ts`: `registerSchema` and `registerActionSchema` gain
  `privacyConsent: z.literal(true)` with the Georgian error above, mapped to the box.
- `registerGoogleAction` and the legacy `actions.ts` register call pass
  `p_privacy_version: PRIVACY_POLICY_VERSION`; `privacy_consent_required` maps to the same
  Georgian error.
- `sendPhoneVerificationAction` input gains `privacyConsent: z.literal(true)`; it refuses
  without it, so no SMS goes out unconsented even if the page is bypassed.
- `lib/security/verdict.ts`: classify the new `privacy_consent_required` token (the
  tokens-drift test requires it).
- `CheckboxField` gains a `ReactNode` label (it is `string` today) so the sentence can carry
  the link. Styling is unchanged.

## 7. Testing

TDD, failing test first, for each of:

- schema: unticked → `privacyConsent` error; ticked → passes (both schemas).
- `GoogleJoinForm` / `LegacyJoinForm`: unticked press shows the error and calls neither
  action; ticked press proceeds; the link points to `/privacy`.
- `registerGoogleAction` / legacy action: sends the version; maps
  `privacy_consent_required`.
- `sendPhoneVerificationAction`: refuses without consent.
- version drift: `lib/privacy.ts` literal equals the migration literal.
- verdict tokens drift: new token classified.
- `/privacy` renders the H1, all 10 section headings and the banner; footer has the link;
  sitemap includes `/privacy`; mobile-nav back header and no-CTA set include it; the
  route-group not-found guard still passes.
- schema guard tests: new columns are server-managed.
- e2e on preview: register blocked without the tick, succeeds with it; the new profile row
  has both fields set.
- Georgian gates: `ka-gate --diff main` on every changed file (spec and plan included) and
  `npm run ka:scan`.

Owner evidence: preview URL + screenshots of `/privacy`, step 1 with the notice, step 2
unticked-error and ticked states, desktop and mobile.

## 8. Release

A merge to `main` deploys **both** sites (demo and real) at once, and the real site's
database can only be migrated afterwards, through the gated production-db workflow. So the
feature ships as two PRs and two migrations (found while planning; same pattern as
PR #28 → PR #27):

1. **PR A, expand.** `20261008140000_registration_privacy_consent.sql` adds the two columns
   and a `register()` / `register_google()` that **accept** an optional `p_privacy_version`:
   a wrong one is refused, a missing one is still allowed, so the code already live keeps
   working. Nothing visible changes. After merge, the workflow applies it.
2. **PR B, the feature.** The forms, actions, `/privacy` page, and
   `20261008150000_require_privacy_consent.sql`, which makes a missing version refuse. On
   merge the new code is served first and works against PR A's function. The workflow then
   applies the tightening.

- Step 1 reaches the staging database before PR A's preview. Step 2 reaches staging only
  **after PR B merges** (amended during execution): every PR's CI runs e2e against staging,
  and an open PR built on older `main` sends no version, so an early step 2 would break its
  registration tests. Until then PR B's e2e checks that a stale version is refused; the
  missing-version refusal is checked statically and then live right after merge.
- Migration baseline: 35 → 36 (PR A) → 37 (PR B), in `production-db.yml` and its two tests.
- The signature change also moves `scripts/production-db-schema-check.sql` and
  `lib/supabase/types.ts` to the four-argument functions.
- No new environment variables.
- ADR-041 in `DECISIONS.md` records the consent model and the deferrals in §9.

## 9. Out of scope (owner: later)

- A channel for data requests (see / correct / delete) and self-service account deletion
  or consent withdrawal. The law gives people these rights with a 10-working-day deadline;
  until a channel exists, requests can only arrive informally. Owner will add it later.
- General rules of use and a second consent box.
- Re-consent when the policy version changes.
- Showing consent date in the admin panel or member export.
- Legal review of the copy before launch.
