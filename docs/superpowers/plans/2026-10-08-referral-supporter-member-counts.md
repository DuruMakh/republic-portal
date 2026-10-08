# Referral card: supporters and members counted apart — plan (2026-10-08)

Owner direction, in chat on 2026-10-08: the referral link should report two separate counts,
`მხარდამჭერი` and `წევრი`. Someone who signs up through the link counts as a supporter; when
they finish the membership form they move across — supporters −1, members +1. Recorded as
ADR-039.

## Decisions (owner, in chat)

1. **What makes a `წევრი`.** Finishing the membership form is enough: status
   `profile_completed` or `active_member`, the same rule as `public_stats.members_total`
   (ADR-037). `registered` is a supporter. The board's review changes no status today and
   does not affect the count.
2. **Nothing is stored.** Both figures are counted from each referred person's current status
   on every read (CLAUDE.md: no derivable values as columns). The −1/+1 move is a consequence
   of the status changing, not a counter being updated.
3. **Earlier sign-ups carry over.** Both figures sum sign-ups through the person's own `M-`
   code AND, once approved, their delegate code — the existing rule for `referralCount`
   (20260729120000), applied to each half. Becoming a delegate drops nothing; new sign-ups add.
4. **Referral statistics only.** Not part of the ranking and unrelated to which delegate a
   member chooses (members choose and change their delegate freely). The ranking and the
   team figures (`totalCount`, `public_delegates.members`) are untouched.
5. **Delegate cabinet.** The three boxes under the referral card lose the `მხარდამჭერი` box
   (`registeredCount`): it would repeat the card's supporter figure while counting only the
   delegate code, missing earlier sign-ups. The team box is relabelled `გუნდის წევრი` so it
   is not confused with the card's `წევრი` line. *(Owner did not answer the relabel question
   before approving; this is the recommended default — say "leave it" and it reverts to
   `წევრი`.)*
6. **Release in two PRs**, the ADR-037 pattern: the real site deploys on every merge and the
   production migration runs only from main.
   - **PR A — database only.** Additive: `cabinet_state()` and `delegate_panel()` return two
     new keys, `referralSupporters` and `referralMembers`; every existing key, including
     `referralCount` and `registeredCount`, is kept, so running code is unaffected. Nothing
     anyone sees changes.
   - **PR B — the visible change**, opened after the owner has run the production migration
     for PR A.

## PR A steps (TDD: failing check first)

1. `e2e/referral-split.spec.ts` (runs in CI against staging on every PR): a referrer with a
   pending delegacy; a friend signs up through their `M-` link (1 supporter); the friend
   finishes the membership form (0 / 1); the referrer is approved and a second friend signs
   up through the delegate link (1 / 1, total 2) — asserted on both `cabinet_state()` and
   `delegate_panel()`. Fails before the migration. (`scripts/verify-schema.mjs` was the
   first choice, but it stops at its first probe since the Google sign-in change and is
   not run anywhere; fixing it is out of scope.) Helpers: `otpSession`/`clientFor` split
   out of `loginAs`, `seedRegisteredMember` takes an optional `signupRefCode`.
2. Migration `2026100812xxxx_referral_supporters_and_members.sql`: `create or replace` of both
   functions, bodies copied verbatim from 20260729120000 (the live definitions; no later
   migration redefines either), with only the two keys added. Same signatures, so grants
   carry over; `cabinet_state()` restates its grants as house style.
3. Migration baseline 34 → 35: `production-db.yml` and its two tests.
4. Apply to staging (`supabase db push`, additive only), the new spec goes green, CI green,
   Claude review, PR, owner merges, owner dispatches the production-db workflow.

## PR B steps (TDD)

1. Types: `CabinetState` and `DelegatePanelData` gain `referralSupporters` and
   `referralMembers`; the test fixtures (`lib/test-cabinet-state.ts` and the inline ones)
   follow.
2. `ReferralCard`: props `supporters` and `members` replace `count`; two rows, `მხარდამჭერი`
   then `წევრი`, values through `formatCountKa` (which already shows 0 for a missing figure).
   Test IDs `referral-supporters` and `referral-members`. Tests first.
3. Callers: `/me`, `/me/profile`, `/delegate` pass both figures with `?? 0`.
4. `/delegate`: drop the `registeredCount` box, relabel the team box `გუნდის წევრი`, grid of
   two. *(As built: `/delegate` has no page test — it is an async server page — so the box
   removal and relabel are covered on screen by `referral-split.spec`.)*
5. e2e: `referral-split.spec` signs the referrer into `/delegate` and reads the new test IDs
   (`referral-supporters`, `referral-members`); `cabinet.spec`'s member-pill check is pinned to
   the pill so the card's `წევრი` row cannot satisfy it.
6. `npm run ka:scan`, full gate set, `/qa` on the preview with screenshots of all three
   pages, ADR-039, PR, owner sign-off.

## Out of scope

- Removing `referralCount` and `registeredCount` from the database functions (harmless; a
  later clean-up once nothing reads them).
- The ranking, the team list, the board admission step.
