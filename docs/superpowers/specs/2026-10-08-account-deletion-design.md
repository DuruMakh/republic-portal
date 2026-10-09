# Spec: a member deletes their own account, and their data with it

**Date:** 2026-10-08. **Status:** approved by the owner 2026-10-08. **Origin:** launch audit (blocker 2,
findings DATA-2, ADMIN-4, LEGAL-2) and the owner's request in chat: "lets add account delete
feature and it also deletes data".

## 1. In plain words (for the owner)

- Every signed-in person can delete their account from their profile page. They type a
  confirmation word and press one button. Deletion is immediate and cannot be undone.
- Everything that identifies them is erased: name, personal ID number, birth date, region and
  city, job, membership history, delegate page and photo, sign-in account, and the phone number
  on their profile. They can register again later with the same phone and ID number, as a new
  person. One copy of the phone number stays for a short while: the anonymized SMS rate-limit
  record of a code sent in the last 24 hours, kept so that deleting and registering again cannot
  reset the send limits. An hourly job removes it within about a day (25 hours at most) of that
  code being sent. Database backups and service logs are not erased; they expire on their own
  (§2, §7).
- Their votes in finished polls keep counting, with no name attached, so closed poll results never
  change. A vote in a poll that is still running is removed, so nobody can delete, register again
  and vote twice.
- If a delegate deletes their account, their public page disappears. Their members move to the
  central movement and see a note asking them to choose a new delegate.
- Staff with an admin role cannot delete themselves; another top-level admin removes the role
  first. This protects the last admin and the audit trail.
- The audit log keeps the record of what staff did, but the deleted person's name is removed.
- A top-level admin can also delete someone's account on request (for example someone who lost
  their Google account and wrote through the contact page). That is recorded in the audit log
  with the reason, without the person's name.
- The privacy policy's rights section then says: "you can delete your account yourself on your
  profile page."

### Owner decisions (2026-10-08)

The owner answered "continue" to the seven proposals a–g; all are taken as recommended:
(a) immediate after a typed confirmation, no undo period; (b) everything personal erased,
re-registration possible; (c) poll votes kept anonymously; (d) a deleted delegate's members move
to the central movement with a note; (e) staff with a role cannot self-delete; (f) audit rows
keep the action, lose the name; (g) a super_admin can delete on request.

## 2. What is erased, kept, or untouched

| Data | Today's link to the person | After deletion |
|---|---|---|
| `auth.users` row, identities, sessions, refresh tokens (Google email, Google name/photo) | the person | deleted (Supabase auth cascades) |
| `profiles` row: names, phone, personal ID, birth date, region, city, employment, consent stamp, referral code, status | `id = auth.users.id` (cascade) | deleted |
| `memberships` (own history) | `member_id` (cascade) | deleted |
| `delegates` row: bio, photo URL, slug, status | `id = profiles.id` (cascade) | deleted; public page and leaderboard entry vanish on the next cache refresh (≤ 60 s) |
| delegate photo file in Storage | path inside `delegates.photo_url` | deleted through the Storage API after the database step (§5) |
| other members' memberships pointing at this delegate | `memberships.delegate_id` (no action, would block) | open rows closed and replaced by a central membership marked `note = 'delegate_left'`; closed rows get `delegate_id = null` |
| other profiles' `pending_delegate_id` | FK on delete set null | cleared (already the FK rule) |
| `poll_votes` in polls still running (open, deadline not passed) | `member_id` (cascade) | deleted, so a person who deletes and registers again cannot vote twice (§4.1) |
| `poll_votes` in closed or past-deadline polls | `member_id` (cascade) | kept; `member_id` set null, results unchanged (§4.1) |
| `event_rsvps` | `member_id` (cascade) | deleted |
| `payments` (none exist while dues are off) | `member_id` (cascade) | deleted; revisit with the lawyer before dues return |
| phone verification challenges and proofs | `user_id = auth.users.id` (cascade) | deleted |
| SMS send reservations (`phone_verification_send_reservations`) | `user_id` (was cascade) | older than 24 hours: deleted by the erasure (no send limit looks further back). Newer: kept, `user_id` set null, so deleting and registering again cannot reset the per-number and site-wide send limits; an hourly pg_cron job (minute 17) deletes anonymized ones older than 24 hours, so the phone number is gone within about a day (25 hours at most) of the last code being sent (`20261009160000`, hourly since `20261009170000`) |
| Supabase auth's own log (`auth.audit_log_entries`: sign-ins, token events, email, IP) | the person as `payload.actor_id`, no foreign key | rows with the person as actor deleted, best effort: lacking the privilege never blocks the erasure (§4.4) |
| `audit_log` rows about the person (`target_id = id`, payment rows through `details.memberId`, other members' reassign rows through `fromDelegateId` / `toDelegateId`) | names in `details` (§4.3 lists the keys) | `details` loses every personal key and gains `"erased": true`; action, actor, target id and time stay (§4.3) |
| `audit_log` rows the person wrote as actor | only staff write audit rows | not reachable: staff cannot self-delete (§3.3) |
| support messages | not linked to accounts | not erased (out of scope, §7) |
| database backups, platform logs (Supabase, Vercel) | copies and request logs | not erased; they expire on their own retention (out of scope, §7) |
| other people who joined through the person's referral code | they store the code text only | untouched; counts are derived and simply stop including them |

## 3. Behaviour

### 3.1 Member self-deletion (`/me/profile`)

- A "Delete account" section at the bottom of the profile page (danger styling from DESIGN.md).
  It lists what is erased and what stays anonymous, and for an approved delegate adds that their
  public page goes and their members move to the central movement.
- One text field: the person types the confirmation word (Georgian, set in the copy table during
  planning). The button stays disabled until the word matches exactly. One click deletes.
- Success: the session is signed out and the person lands on a public page, `/account-deleted`,
  saying the account and data are deleted. No cabinet chrome.
- Failure: a Georgian error under the button; nothing is half-deleted (§4.4).

### 3.2 Delegate's members

- A member whose open membership was replaced because their delegate deleted their account sees
  a note on `/me/delegate` ("your delegate left the platform; choose a new one") until they choose
  a delegate. The note is driven by `memberships.note = 'delegate_left'` on the open row; choosing
  a delegate through the existing change flow opens a new row without the note.

### 3.3 Staff

- Anyone holding an `admin_roles` row sees the section with the button disabled and the
  explanation; the server refuses too (`staff_account`).
- Former staff (no role now, but they recorded payments, approved delegates or wrote audit rows)
  cannot be deleted without breaking the audit trail's foreign keys; the server refuses with
  `staff_history` and the page tells them to contact the board. Rare; acceptable.

### 3.4 Admin deletion on request (`/admin/members`)

- super_admin only. Each member row gets a "delete" action that opens an inline confirmation with
  a required reason (free text, 5–300 characters) and the member's name typed back as the
  confirmation. Same erasure as §3.1. Audit row: actor = the admin, action
  `member.delete`, target = the person's id, details `{ "reason": … }` with no name.
- Refused for staff accounts (`staff_account` / `staff_history`), like self-deletion.

## 4. Database design

### 4.1 `poll_votes` keeps anonymous votes

- Replace the primary key `(poll_id, member_id)` with a surrogate `id bigserial` key, make
  `member_id` nullable, change its FK to `on delete set null`, and add
  `unique (poll_id, member_id)`. Postgres treats nulls as distinct, so anonymous votes never
  collide and one vote per member stays enforced by the unique constraint: `member_cast_vote`
  still gets `unique_violation` on a second vote (planning must confirm it catches by error class,
  not by constraint name).
- The admin results views count rows per option and are unaffected. The member results view
  `poll_option_counts` counted `member_id`, which skips an anonymous vote, so it is redefined to
  count `option_id` (same columns and grants; `20261009140000`). "Has voted" lookups by
  `member_id = auth.uid()` never match a null.
- Votes in polls still running (status `open` and `ends_at` null or not yet passed, exactly what
  `member_cast_vote` still accepts) are deleted at erasure, after locking those polls `FOR SHARE`
  as `member_cast_vote` does; only closed or past-deadline votes stay anonymously
  (`20261009150000`).

### 4.2 `memberships.note`

- `note text check (note in ('delegate_left'))`, nullable. Written only by the erasure function.

### 4.3 Audit scrub without breaking append-only

- `audit_log_immutable()` keeps refusing every update and delete, except an UPDATE when the
  transaction-local setting `app.erasing` is `on`, the current role is the owner of
  `erase_account()` (looked up in the catalog), and the row's `id`, `actor_id`, `action`,
  `target_type`, `target_id` and `created_at` are unchanged. Only the erasure function sets that
  setting (`set_config('app.erasing', 'on', true)`; a schema guard keeps `app.erasing` inside it
  and the trigger). The client roles do hold the platform's default table grants on `audit_log`
  (measured on staging), but row level security with no policy shows them no row and lets them
  change none; the owner lock means no other role can use the exception, service_role included
  (proven on staging).
- Keys removed from `details` (every `insert into public.audit_log` re-read 2026-10-08): `name`,
  `memberName`, `slug` (the delegate's name transliterated, on `delegate.approve`), `firstName`,
  `lastName`, `personalId`, `phone`, `email`; `from` / `to` on `delegate.update_name`; the admin's
  `note` on `delegate.reject` only; `fromName` / `toName` on another member's `member.reassign`
  when the person was that delegate (matched through `fromDelegateId` / `toDelegateId`). Payment
  rows target the payment id and name the person through the companion `details.memberId`; those
  rows lose the keys above too. Kept on purpose: `member.delete`'s reason (the admin is told not
  to write the name in it). Not scrubbed: free-text payment fields (`payment.void` reason,
  `payment.record` bank reference) and `member.export` searches; no payments exist, revisit when
  dues return.

### 4.4 Functions (all `security definer`, `search_path = ''`)

- `erase_account(p_user_id uuid) returns jsonb`: internal. EXECUTE is revoked from public, anon,
  authenticated and service_role (the platform's default privileges grant service_role; no
  server code needs it, the app calls the two wrappers). In one transaction: lock the person's
  profile row, their own open membership row and their delegate row (a concurrent reassignment
  or delegate change of or to the departing person finishes first or waits); refuse staff
  (`staff_account`); capture the delegate photo URL; delete the votes in polls still running
  (§4.1); move the delegate's team (§2; the team is the set of rows the closing UPDATE ends,
  `returning member_id`, so a member who moves away meanwhile cannot collide); scrub the audit
  rows (§4.3); delete the person's rows from Supabase auth's own log, best effort; delete the
  person's SMS send reservations older than 24 hours;
  `delete from auth.users where id = p_user_id` (cascades everything in §2; a foreign-key
  violation here means staff history → `staff_history`, with the blocking key in the error
  detail). Returns `{ photoUrl }` for the Storage step.
- `delete_my_account(p_confirm text) returns jsonb`: granted to `authenticated`; checks
  `auth.uid()` and the confirmation word, calls `erase_account(auth.uid())`.
- `admin_delete_member(p_user_id uuid, p_reason text) returns jsonb`: granted to `authenticated`;
  `has_admin_role('super_admin')`, the reason length, not self; writes its own `member.delete`
  audit row (so the ADR-014 guard finds it in this function), then calls
  `erase_account(p_user_id)`.
- No admin action racing an erasure can write a named audit row after the scrub.
  `admin_approve_delegate`, `admin_reject_delegate`, `admin_update_delegate_name`
  (`20261009160000`) and `admin_update_delegate_profile` (`20261009170000`) raise
  `invalid_target` when their UPDATE finds the person gone, before their audit insert.
  `admin_reveal_personal_id`, `admin_reveal_applicant_personal_id` and `admin_void_payment` read
  the profile `FOR SHARE`, wait for an erasure in flight and then refuse (`20261009170000`). The
  others that name a person (role grant, reassignment, recording a payment) insert a row
  referencing the person and wait on the same lock; revoking a role targets staff, whom the
  erasure refuses.
- An hourly pg_cron job, `purge-anonymous-sms-reservations` (minute 17), deletes SMS send
  reservations with no account that are older than 24 hours (`20261009170000`; daily in
  `20261009160000`). The production schema check fails the job if it is missing or changed.
- Proven on staging (2026-10-08, `scripts/verify-account-deletion.mjs` with throwaway users): a
  function owned by `postgres` may `delete from auth.users` on the hosted platform, so the
  fallback (the server action deleting the auth user with the service-role admin API) is not
  needed. Production: the schema check runs after `supabase db push`, so it fails the job if
  `postgres` loses DELETE on `auth.users` or any of the three functions' EXECUTE grants drift,
  but it cannot prevent the apply.

## 5. Application

- Server action `deleteMyAccount` (zod: the confirmation word): `getUser()`, RPC, then the
  Storage removal of the returned photo path with the service-role client (best effort, logged on
  failure; the path is server-derived, never client input), then `signOut`, then redirect to
  `/account-deleted`.
- Admin action `deleteMember` (zod: user id, reason, typed name): RPC, Storage removal,
  `revalidatePath('/admin/members')`.
- Error codes mapped to Georgian in `mapFunnelError`: `staff_account`, `staff_history`,
  `invalid_confirmation`, `invalid_reason`, `cannot_delete_self` (admin path).
- `/account-deleted`: public, static, Georgian, noindex, a link home.
- Privacy policy: the rights section adds the self-service sentence; retention sentence becomes
  "until you delete your account". The version stays `2026-10-v1` (a new way to exercise an
  existing right, not a new use of data).

## 6. Tests and checks

- Unit: zod schemas; both actions (fake Supabase, as in `_test-utils/fake-supabase.ts`); the
  danger section's states (member, delegate with team count, staff disabled); `/account-deleted`;
  the policy sentence.
- SQL probes on staging (`scripts/verify-account-deletion.mjs`, pinned to the staging host): a
  throwaway member is erased; their vote in a running poll is deleted, while their votes in a
  closed and a past-deadline poll survive with a null member and unchanged counts; their SMS send
  reservation older than 24 hours is deleted, the recent ones survive with a null user, and the
  one linked to a verification challenge loses the challenge; the purge job's command removes
  only anonymized reservations older than 24 hours; their rows in Supabase auth's log are
  deleted; a throwaway delegate's member lands on central with the note; a staff account is
  refused, and former staff are refused as `staff_history` naming the key; the audit rows lose
  every personal key; clients see and change no `audit_log` row (row level security with no
  policy), and service_role is refused by the trigger even with `app.erasing` set (owner lock).
- e2e (one journey, no extra SMS logins beyond the existing budget): a member deletes their
  account, lands on `/account-deleted`, and `/me` sends them to `/login`.
- Production: the migration-only release runs the production-db workflow's schema checks, which
  assert the three functions' EXECUTE grants and `postgres`'s DELETE on `auth.users`.

## 7. Out of scope

- Signed-in Google accounts that never registered (no profile): they hold only the Google email
  and possibly a phone proof; reachable later through the admin tool if needed.
- Support messages (not linked to accounts).
- Database backups and platform logs (Supabase, Vercel): not erased; they expire on their own
  retention. The privacy policy must say so rather than claim they are erased.
- A downloadable copy of one's data (the right of access goes through the contact page).
- Payment retention rules (no payments exist; decide with a lawyer before dues return).

## 8. Release

Two merges, as for every migration since merge became release:
1. Migration-only PR: §4 plus the production-db baseline count and generated types. After merge:
   staging apply, production dry-run and apply.
2. Code PR: §5, the policy sentence, tests. Owner sign-off on the preview, then merge = release.
