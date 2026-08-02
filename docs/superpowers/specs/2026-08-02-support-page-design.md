# Support page — design

**Date:** 2026-08-02
**Owner decision pass:** this conversation
**Supersedes:** §5 of `docs/superpowers/specs/2026-07-28-owner-fix-list-round-2-design.md`
(owner fix-list item 11), which was specced but never built because its copy,
destination address and mail integration never arrived.

## 1. What this is

A public page where anyone — member, stranger, journalist — can write to the
movement. One form: who you are, how to reach you back, what you want to say.
The message is stored durably and read by a super-admin in the admin area.

It is a **contact** page, not a help desk and not a volunteering sign-up. That
was the owner's first decision this round and it determines every word on it.

## 2. Decisions taken in this conversation

1. **Purpose: contact.** Georgian built around `დაგვიკავშირდი`, not
   `დახმარება` (help desk) and not `მხარდაჭერა` (offers of support).
2. **Two contact fields, at least one required** — email and phone, each
   optional on its own. This deviates from the superseded §5, which had a single
   free-text `contact` field. The platform is phone-first everywhere else
   (people register with an SMS code and the app has no email field at all), so
   forcing either one alone would exclude real people.
3. **The page promises an answer, with no timeframe.** `გიპასუხებთ`, never
   "within N days" — a public promise a volunteer-run movement misses is worse
   than no promise.
4. **Informal singular register**, matching the shipped public voice
   (`დარეგისტრირდი`, `აირჩიე ის შენს დელეგატად`). The site is consistent on
   this; the page follows it.
5. **No email in v1.** See §7.

## 3. The copy block — authoritative bytes

These strings are the contract. Every one was approved by the owner in the
design conversation. Provenance is recorded because DESIGN.md forbids
hand-typed Georgian: `spliced` strings are byte-identical to text already
shipping in the repo, `new` strings are this page's own prose and are verified
by §9 instead.

| Role | String | Provenance |
|---|---|---|
| Page heading, `<h1>` | `დაგვიკავშირდი` | new |
| Lede | `მოგვწერე — ყველა შეტყობინებას ვკითხულობთ და გიპასუხებთ.` | new; the em dash is U+2014, already in use |
| Name label | `სახელი` | spliced — `app/(public)/join/JoinForm.tsx` |
| Email label | `ელ-ფოსტა (არასავალდებულო)` | `(არასავალდებულო)` spliced from `app/(admin)/admin/content/events/EventForm.tsx:85`; `ელ-ფოსტა` new |
| Phone label | `ტელეფონი (არასავალდებულო)` | both spliced — `app/(admin)/admin/verify/VerifyCard.tsx:125` + EventForm |
| Message label | `შეტყობინება` | new |
| Submit button | `გაგზავნა` | spliced — existing `ხელახლა გაგზავნა` |
| Success | `შეტყობინება გაიგზავნა. მალე გიპასუხებთ.` | `მალე` spliced; rest new |
| Send failure | `შეტყობინების გაგზავნა ვერ მოხერხდა, სცადე თავიდან.` | pattern spliced from JoinForm's `კოდის გაგზავნა ვერ მოხერხდა, სცადეთ თავიდან`, noun and register changed |
| Neither contact filled | `მიუთითე ელ-ფოსტა ან ტელეფონი.` | new |
| Rate limited | `ბევრი შეტყობინება გაიგზავნა — სცადე ცოტა ხნის შემდეგ.` | new |
| Footer link | `დაგვიკავშირდი` | new, same bytes as the heading |

No typographic quotation marks appear anywhere in this copy. That is
deliberate: the `U+201E`/`U+201C` pair is the repo's single most common
corruption vector, and this page has no need of it.

## 4. Data

New table `support_messages`:

| Column | Notes |
|---|---|
| `id` | `bigserial` primary key |
| `name` | not null |
| `email` | nullable |
| `phone` | nullable |
| `message` | not null |
| `ip_hash` | nullable; salted hash of the forwarded-for header, never the address |
| `created_at` | `timestamptz not null default now()` |

RLS on, all grants revoked from `anon` and `authenticated` — the table is
unreachable from client roles in both directions. Writing happens only through
a `security definer` RPC; reading only through an admin view.

`emailed_at` and `mark_support_message_emailed` from the superseded §5 are
**not** built. They exist only to serve mail, which is out of scope; the later
mail change adds them in its own migration.

**Migration:** `supabase/migrations/20260802120000_support_messages.sql`. The
version must sort after `20260729120000`, the latest applied — confirm with
`npx supabase migration list` before the owner pushes, and never amend an
already-pushed file.

## 5. Server flow

Public form → server action → zod parse → hash the forwarded-for header →
`submit_support_message(p_name, p_email, p_phone, p_message, p_ip_hash)` →
success or an honest failure. No mail step.

**The salt is derived, not configured.** The page must need no deployment setup
at all, so instead of a new `SUPPORT_MESSAGE_SALT` variable the action derives
its salt as `hmac-sha256(key = SUPABASE_SERVICE_ROLE_KEY, msg = "support-ip")`.
That key is already server-only and present in every environment. HMAC output
never reveals its key, so this neither weakens nor exposes the service
credential, and the stored hash is not brute-forceable across the IPv4 space
without it. A key rotation simply resets the rate-limit window, which is
harmless at a ten-minute horizon. The raw address is never stored, logged, or
put in a URL.

**Validation, identical on both sides** (`lib/support-schemas.ts` for the form
and the action, restated in the RPC because the server is the source of truth):

| Field | Rule |
|---|---|
| `name` | trimmed, 1–60 |
| `email` | optional; when present, trimmed, ≤120, and `z.string().email()`-valid. The RPC's own restatement checks for exactly one `@` with a non-empty local part and a dotted domain — deliberately looser than zod, because the server guard exists to stop nonsense, not to re-litigate address grammar |
| `phone` | optional; when present, trimmed, ≤40 |
| at least one of `email`/`phone` | required — surfaces as `მიუთითე ელ-ფოსტა ან ტელეფონი.` |
| `message` | trimmed, 10–2000 |

The RPC re-checks every rule and raises `invalid_support_message` on violation,
so a caller bypassing the form gains nothing.

**Spam control:** the RPC refuses when the same `ip_hash` has inserted 3 or more
rows in the preceding 10 minutes, raising `too_many_requests`, which the action
renders as the rate-limited line. `ip_hash` is salted and never appears in a URL.

## 6. Reading messages

`admin_support_messages`, a view gated on `has_any_admin_role('super_admin')`,
behind a read-only `/admin/support` list built with the existing `DataTable`
and registered in `lib/admin.ts`'s `TAB_MATRIX`. Without this the durable copy
would be unreadable, which would defeat its purpose.

## 7. Out of scope: email

The owner decided on 2026-08-02 that mail waits. `duru@solvio.dev` was a test
address and the real destination will differ, so nothing is hardcoded and no
integration is provisioned. Marketplace discovery was run and confirmed Resend
(`resend/resend-email`) remains the only messaging product, for whenever mail
returns.

**The operational consequence, stated plainly:** nothing notifies the owner. A
message sits in `/admin/support` until someone looks. The page tells visitors
`მალე გიპასუხებთ`, so that promise depends on the habit of checking until mail
ships. The success line stays honest regardless — the message really does reach
the movement.

## 8. Discoverability

A footer link in `app/(public)/layout.tsx`'s `footerLinks`, joining terms, news
and transparency. Not a top-nav entry: contact is a destination people go
looking for, not a section of the publication.

## 9. Georgian integrity

DESIGN.md's gate exists because models silently normalize quotes and can fuse
Latin or Greek homoglyphs into Georgian words. Most of this page's copy is
spliced, but the heading, lede, message label and three status lines are
genuinely new prose — the first new Georgian written in this repo rather than
carried in from the prototype.

Two verifications, both mandatory before commit:

1. `node scripts/ka-gate.mjs --diff main <files>` — Greek look-alikes, ASCII
   quotes adjacent to or inside Georgian, unbalanced quote pairs.
2. **A mixed-script scan**, which ka-gate deliberately does not do: assert that
   every Georgian-containing run in the new strings consists only of codepoints
   from the Georgian blocks, ASCII space, and the punctuation this copy uses
   (`.`, `,`, `(`, `)`, `-`, U+2014). A single Latin `a` fused inside a Georgian
   word passes ka-gate and would ship.

Additionally, every string marked `spliced` in §3 is asserted byte-identical to
its cited source, so a corrupted copy fails rather than ships.

## 10. Testing

- **Unit** — `lib/support-schemas.test.ts`: accepts a filled form with only an
  email; accepts one with only a phone; rejects one with neither; rejects an
  empty name, a 9-character message and a 2001-character message.
- **Unit** — the copy block's spliced strings verified against source bytes.
- **Database** — the RPC rejects a bypassing caller on each rule, and the
  fourth submission inside ten minutes from one `ip_hash` raises
  `too_many_requests`.
- **E2E** — a visitor fills the form and sees the success line; a super-admin
  sees the message at `/admin/support`; a member without the role does not.
- **Gates** — `npm test && npm run typecheck && npm run lint`, plus §9.

## 11. Not doing

- Email, per §7.
- Attachments, categories, ticket numbers, threading, or any reply-from-admin
  path. A message and a way to reach the sender is the whole product.
- A public "we received it" record. The visitor gets the success line; there is
  no status page to check.
