# What the practice database still carries, and why

**27 July 2026 · companion to `report.md` · staging project `orcxtbedkexoclbfgvzd`**

The security check-up attacked the practice database for three days. It created accounts, minted
sign-in codes, wrote news, events and polls, recorded payments and drove twelve invented people
through every standing the platform has. This document is the accounting: what the reset removed,
what it could not remove, and **why** each surviving thing could not go.

**The exit criterion is not "no trace".** It cannot be, and pretending otherwise would be the more
dangerous claim. The record of who did what is deliberately append-only — that is one of the
platform's strongest controls, re-verified during this very audit — so any account that performed an
audited admin action can never be deleted. The audit performed 884 such actions. The criterion that
was actually met is narrower and more useful:

> **the seeded population is restored exactly, every survivor is named, and nothing the audit
> created appears in any figure the movement publishes.**

---

## 1. The documented population, restored

| Figure | Documented | Now |
| --- | --- | --- |
| Active members | 1,636 | **1,636** |
| Completed (not yet paid) | 134 | **134** + the 4 canonical admins = 138 |
| Registered only | 132 | **132** |
| Approved delegates | 12 | **12** |
| Profiles in total | 1,906 | **1,906** |
| Auth accounts in total | 1,906 | **1,906** |
| Auth accounts with no profile | 0 | **0** |
| `public_stats.registered_total` | 1,906 | **1,906** |
| `transparency_stats.registered_members` | 1,774 | **1,774** |

`scripts/verify-schema.mjs` — which asserts exact seeded facts and had been red for months on
count drift — passes end to end again. The sweep run **after** the full end-to-end suite found
**0 users to delete**, with the counts already at 12 / 1,636.

## 2. What the reset removed

- **21 debris accounts**, all pre-dating this work and all previously undeletable. They sat in
  three bands: the twelve `90990020001`–`012` fixtures, seven in the `995090010xx` band (the
  audit's own actors A3–A8 plus one team-member fixture), and two strays. Before: 13 approved
  delegates and 1,640 active members. After: 12 and 1,636.
  **They could not be deleted before this branch.** The append-only trigger added for finding 11
  stood in front of the `profiles → payments` cascade it was written to permit, so deleting any
  member holding a payment failed. That is the defect the cascade-exemption migration repaired, and
  this sweep is its proof: 21 deletions, 0 failures.
- **1,922 auth accounts wiped and 1,902 rebuilt** by `scripts/seed-staging.mjs`, together with
  every payment, every membership and the whole sign-in-code table.
- **Every account the audit created.** Audit-tagged accounts: **0**. Profiles in the audit's
  `9…` personal-ID band: **0**. Profiles in the `+99555` end-to-end phone band: **0**.
- **The content the census had piled up over thirteen runs.** The public news view had been
  showing 175 of 691 rows and the events view 370 of 679; they now show 16 of 54 and 32 of 54.

## 3. What survived, and why it could not go

### 3.1 The four canonical admin accounts

| Role | Standing | Audit-log rows it wrote |
| --- | --- | --- |
| super_admin | profile_completed | 567 |
| verifier | profile_completed | 322 |
| finance | profile_completed | 411 |
| editor | profile_completed | 1,020 |

**Why they cannot be deleted.** `audit_log.actor_id` references `profiles` with `ON DELETE NO
ACTION`, and `audit_log` is append-only twice over — RLS admits no write policy, and a trigger
refuses every UPDATE and DELETE. So the referencing rows can never be cleared, and while they exist
the foreign key refuses to delete the account: PostgreSQL answers `23503`. There is no order of
operations that gets around it, which is why `seed-staging.mjs` skips these accounts by name rather
than trying and failing halfway through the wipe.

This is not a defect. It is threat T8 holding: an admin cannot act and then erase themselves. The
audit tested exactly that, as a stranger, as an ordinary member and as the super-admin, and could
not add, alter or remove a single row.

The reset **does** clear every other reference that would block an admin deletion — it wipes
payments outright (`recorded_by` / `voided_by` are also `NO ACTION`), nulls `app_settings.updated_by`,
and lets `delegates` cascade away. `audit_log` is the one it cannot touch, and it is the one that
matters.

### 3.2 The audit-log rows themselves — 2,352, permanently

1,468 pre-date this work; **884 were written between 25 and 27 July** by the audit and its
harnesses. 32 carry no actor at all (system actions). **Every actor in the entire table is one of
the four accounts above** — zero non-canonical actors survive, so the audit added volume to the
record, not identities.

### 3.3 Fifty sign-in codes, transient

`dev_otp_inbox` holds 50 rows, minted minutes ago by the end-to-end suite. These are not permanent:
the dev-OTP route deletes anything older than an hour on every call, and the next reseed empties the
table outright. They are listed here only because "we checked and there were none" would have been
untrue at the moment of writing.

## 4. Presence in the audit log is fine; presence in the figures is not

The four survivors are checked against every number the platform publishes:

- **Not counted as members.** All four stand at `profile_completed`, so **0 of them** appear in
  `active_members` (1,636) or in any member total.
- **They back no delegate's public figure.** Each holds one seed-created membership bound to a
  delegate, but `public_delegates.active_supporters` counts active members only — measured on the
  one delegate they point at: public figure **294**, active members bound **294**, total rows bound
  322. The admins are in the 322 and not in the 294.
- **They are in no delegate listing.** None holds a `delegates` row of any status.
- **They hold no payment**, so they enter no money figure.
- **They are in the two total-registry figures** — `registered_total` (1,906) and
  `transparency_stats.registered_members` (1,774) — because those count everyone who has completed
  registration, and these four have. That has always been true of them; both figures are at their
  documented seeded values, which is the point.

Their memberships are created by the seed in its own step, not left behind by the audit. Nothing in
this section is audit residue; it is the documented shape of the seeded database.

## 5. One method note, for whoever reseeds next

**Drop `.superpowers/sdd/actor-session-cache.json` whenever you sweep or reseed.** A JWT is a signed
claim, not a lookup, so it stays valid-looking after the account it names is deleted. The cache
checks the only thing it can check — expiry — and handed back all twelve sessions as hits, pointing
at accounts that no longer existed. The census then failed loudly at
`register failed for 509001003: phone_required`, which is finding 4's new guard doing its job. It
failing loudly was luck: a stale session normally degrades every probe to "not authenticated",
which reads as a clean result.

## 6. Where the numbers come from

`docs/security/residue.json` records every row the audit created, run by run, and is the machine
evidence behind section 2. The counts in sections 1 and 4 were read from the live database on
27 July after the final reseed and the full end-to-end suite. `scripts/sweep-staging-e2e.mjs`
(dry run) and `scripts/verify-schema.mjs` both agree with them.
