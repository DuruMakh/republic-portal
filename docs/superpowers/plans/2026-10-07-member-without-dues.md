# Member without dues — plan (2026-10-07)

Owner direction, in chat on 2026-10-07: dues are dropped for now; nobody will pay at this
stage, so the "active member" idea disappears and everyone who completed membership is
simply a member, everywhere. Payment UI is hidden behind one switch (owner chose hide
over delete), so dues can return by setting a variable and redeploying. Stacked on PR #26
(ADR-035); recorded as ADR-037.

## Decisions

1. **Labels, unconditional.** `profile_completed` and `active_member` both read `წევრი`
   (Pill, `MEMBER_STATUS_LABELS_KA`, `TEAM_STATUS_LABELS`). Every "აქტიური წევრი" label
   becomes `წევრი`. Bringing back an "active" tier is future design, not this switch.
2. **Counts count every member.** Additive migration (`CREATE OR REPLACE VIEW`, columns
   appended, grants preserved): `public_stats.members_total` (status in profile_completed,
   active_member) and `public_delegates.members` (open memberships, any member status).
   The homepage counter, ranking (`rankDelegates`), delegate page + share image, both
   cabinets' delegate cards and the membership wizard's delegate order read them.
   `delegate_panel` already returns `totalCount` (open memberships): the delegate cabinet
   shows it as `წევრი`, dropping the active card. Admin overview drops the active card
   (`total_completed` is already `წევრი`). The old columns stay for the hidden finance and
   admin finance tooling.
3. **Switch `SHOW_MEMBERSHIP_DUES`** (server-only, the word `true` shows; default hidden),
   `lib/membership-dues.ts`, same shape as ADR-034's finance switch. Hidden means: no
   `გადახდები` cabinet tab and `/me/billing` answers not-found; the membership wizard's
   second step confirms membership with no fee box or bank sentence (the action still
   sends the fixed tier the schema requires); the done page shows no transfer details or
   payment sentence; the `/me` invitation drops "monthly dues 10₾"; the profile header drops
   the payment reference code; the admin overview drops the dues-total card.
4. **Filters.** The delegate team table drops its status filter (both statuses are now the
   same word). The admin member list keeps `მხარდამჭერი` and `წევრი` (profile_completed)
   options and drops the active option while dues are hidden; its audited export keys on one
   status value, so merging statuses is left for when it is needed.
5. **Out of scope.** Admin finances tab, payment recording and settings (staff tooling);
   the hidden public finance page; the board admission path for members.

## Steps (TDD: failing test first in each)

1. `lib/membership-dues.ts` + test.
2. Labels: Pill, `lib/admin.ts`, `lib/cabinet.ts` + their tests; TeamTable filter removal.
3. Migration + `lib/supabase/types.ts`; `PublicDelegate.members`, `rankDelegates` by
   members; `public.ts` stats type; update every reader; tests.
4. Switch wiring: cabinet nav, billing not-found, wizard step 2, done page, `/me`, profile
   header, admin overview cards; tests.
5. Gates: migration count 33 → 34 in `production-db.yml` and its test; seed/verify scripts
   that read `active_supporters`; e2e wording.
6. Apply the migration to staging (`supabase db push --db-url`, additive only), verify the
   preview, ADR-037, PR stacked on #26. Production database: owner dispatches the gated
   production-db workflow when releasing the real site.
