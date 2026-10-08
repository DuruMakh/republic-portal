# Spec: a member deletes their own account, and their data with it

**Date:** 2026-10-08. **Status:** draft for owner review. **Origin:** launch audit (blocker 2,
findings DATA-2, ADMIN-4, LEGAL-2) and the owner's request in chat: "lets add account delete
feature and it also deletes data".

## 1. In plain words (for the owner)

- Every signed-in person can delete their account from their profile page. They type a
  confirmation word and press one button. Deletion is immediate and cannot be undone.
- Everything that identifies them is erased: name, phone, personal ID number, birth date,
  region and city, job, membership history, delegate page and photo, sign-in account. They can
  register again later with the same phone and ID number, as a new person.
- Their past poll votes keep counting, with no name attached, so closed poll results never
  change.
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
| `poll_votes` | `member_id` (cascade) | kept; `member_id` set null (§4.1) |
| `event_rsvps` | `member_id` (cascade) | deleted |
| `payments` (none exist while dues are off) | `member_id` (cascade) | deleted; revisit with the lawyer before dues return |
| phone verification challenges and proofs | `user_id = auth.users.id` (cascade) | deleted |
| `audit_log` rows about the person (`target_id = id`) | names in `details` (`name`, `memberName`) | `details` loses every personal key and gains `"erased": true`; action, actor, target id and time stay (§4.3) |
| `audit_log` rows the person wrote as actor | only staff write audit rows | not reachable: staff cannot self-delete (§3.3) |
| support messages | not linked to accounts | untouched (out of scope, §7) |
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
- Results views count rows per option and are unaffected; "has voted" lookups by
  `member_id = auth.uid()` never match a null.

### 4.2 `memberships.note`

- `note text check (note in ('delegate_left'))`, nullable. Written only by the erasure function.

### 4.3 Audit scrub without breaking append-only

- `audit_log_immutable()` keeps refusing every update and delete, except an UPDATE when the
  transaction-local setting `app.erasing` is `on` and the row's `id`, `actor_id`, `action`,
  `target_type`, `target_id` and `created_at` are unchanged. Only the erasure function sets that
  setting (`set_config('app.erasing', 'on', true)`), and clients have no grant on `audit_log`
  at all, so the exception is reachable only from inside it.
- Keys removed from `details`: `name`, `memberName`, `firstName`, `lastName`, `personalId`,
  `phone`, `email`. Planning re-greps every `insert into public.audit_log` to confirm this list
  and whether any row names a person under a different target (for example a payment row whose
  target is the payment id).

### 4.4 Functions (all `security definer`, `search_path = ''`)

- `erase_account(p_user_id uuid) returns jsonb`: internal, no grant to any client role. In one
  transaction: refuse staff (`staff_account`); capture the delegate photo URL; move the delegate's
  team (§2); scrub the audit rows (§4.3); `delete from auth.users where id = p_user_id`
  (cascades everything in §2; a foreign-key violation here means staff history →
  `staff_history`). Returns `{ photoUrl }` for the Storage step.
- `delete_my_account(p_confirm text) returns jsonb`: granted to `authenticated`; checks
  `auth.uid()` and the confirmation word, calls `erase_account(auth.uid())`.
- `admin_delete_member(p_user_id uuid, p_reason text) returns jsonb`: granted to `authenticated`;
  `has_admin_role('super_admin')`, the reason length, not self; writes its own `member.delete`
  audit row (so the ADR-014 guard finds it in this function), then calls
  `erase_account(p_user_id)`.
- Planning must prove on staging that a function owned by `postgres` may `delete from
  auth.users` on the hosted platform (the staging-pinned probe `scripts/verify-account-deletion.mjs` does it with a
  throwaway user). Fallback if it may not: the server action deletes the auth user with the
  service-role admin API after the RPC succeeds, and the RPC leaves the final delete to it.

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
- SQL probes on staging (`scripts/verify-account-deletion.mjs`, pinned to the staging host): a throwaway member is erased; their vote
  survives with a null member and the option count is unchanged; a throwaway delegate's member
  lands on central with the note; a staff account is refused; the audit row loses `memberName`;
  a client cannot update `audit_log` even with `app.erasing` set (no grant).
- e2e (one journey, no extra SMS logins beyond the existing budget): a member deletes their
  account, lands on `/account-deleted`, and `/me` sends them to `/login`.
- Production: the migration-only release runs the production-db workflow's schema checks.

## 7. Out of scope

- Signed-in Google accounts that never registered (no profile): they hold only the Google email
  and possibly a phone proof; reachable later through the admin tool if needed.
- Support messages (not linked to accounts).
- A downloadable copy of one's data (the right of access goes through the contact page).
- Payment retention rules (no payments exist; decide with a lawyer before dues return).

## 8. Release

Two merges, as for every migration since merge became release:
1. Migration-only PR: §4 plus the production-db baseline count and generated types. After merge:
   staging apply, production dry-run and apply.
2. Code PR: §5, the policy sentence, tests. Owner sign-off on the preview, then merge = release.
