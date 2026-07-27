-- Security check-up fix wave, amendment (Task 12b) — finding L3-2, corrected.
--
-- THIS SUPERSEDES THE RATIONALE AT 20260726122000_payments_append_only.sql:30-39.
-- That comment justified exempting `service_role` and `supabase_auth_admin` on
-- the ground that "deleting an auth user cascades auth.users -> profiles ->
-- payments as supabase_auth_admin". THAT IS FALSE, and the trigger it justified
-- blocked the very cascade it set out to permit. The comment is the record of
-- why, so it is corrected here rather than left standing.
--
-- PostgreSQL performs a referential action with the privileges of the
-- REFERENCING table's owner, not those of the session role. Measured on this
-- database, not reasoned about:
--
--   owner of public.payments                                      = postgres
--   has_table_privilege('supabase_auth_admin','payments','DELETE') = false
--   GoTrue deleteUser() on a member holding one payment            = HTTP 500
--   the same profiles -> payments cascade, in a rolled-back probe  =
--                                     refused: 'payments are append-only'
--
-- So inside the cascade `current_user` is `postgres`, neither exempt name
-- matches, and the DELETE branch fires. The `supabase_auth_admin` branch was
-- unreachable in both directions — that role holds no DELETE on payments, so a
-- cascade is the only way it could ever arrive, and a cascade is not run as it.
-- It is removed rather than left as a comment about a role that cannot appear.
--
-- WHAT THIS BROKE. All of it real, none of it hypothetical:
--   e2e/admin-helpers.ts:102        deletes phase-4 users whose payments cascade,
--                                   and admin-payments.spec.ts gives that user
--                                   three payments. Line 118 only console.warn()s,
--                                   so CI STAYS GREEN while silently leaving an
--                                   undeletable member behind on staging every run.
--   scripts/sweep-staging-e2e.mjs:74  the tool for clearing that debris — now sets
--                                   a failing exit code on exactly those users.
--   scripts/seed-staging.mjs:199    THROWS on a failed deleteUser, at step 0,
--                                   BEFORE the payments wipe at :231. Latent today
--                                   only because the current debris identities
--                                   happen to have no payments.
--   docs/security/threat-model.md:197  records these cascades as deliberate, added
--                                   for staging cleanup under ADR-015. This broke
--                                   a designed invariant.
--
-- THE FIX, and why it is not an owner exemption. `current_user = <owner>` alone
-- would exempt every SECURITY DEFINER function in the schema, present and
-- future — precisely the protection this trigger exists to provide, and the
-- reason the void rule above is defined by SHAPE rather than by caller. What
-- goes through is a CONJUNCTION that describes a cascade and nothing else:
--
--   1. the DELETE is being performed with the privileges of payments' own
--      owner — which is what a referential action is, and what no client role
--      and no PostgREST request can ever be; AND
--   2. the parent `profiles` row is ALREADY GONE — the payment is an orphan the
--      foreign key is in the middle of collecting.
--
-- A SECURITY DEFINER function satisfies (1) and fails (2): the member whose
-- payment it is trying to rewrite still exists, so it is still refused. A
-- direct attack fails both. Reaching state (2) means deleting the profiles row
-- first, which no client role can do — `profiles` has no DELETE policy at all,
-- and anon/authenticated hold no DELETE privilege on it after CF4.
--
-- WHY BOTH CONDITIONS, and not just the orphan test. Condition (1) is not
-- decoration: it is what makes (2) TRUSTWORTHY. `profiles` carries RLS, so
-- `select 1 from public.profiles` answers with the CALLER's visibility. To the
-- table owner RLS does not apply and the answer is the truth; to `authenticated`
-- the policy is `auth.uid() = id`, so every profile except the caller's own
-- looks ALREADY GONE. Without condition (1), a client role that ever regained
-- DELETE on payments would be waved through on every row but its own — the
-- trigger would fail OPEN, and fail open more widely than it fails today.
--
-- They are written as NESTED `if`s rather than one `and`-joined condition on
-- purpose: PostgreSQL does not guarantee the evaluation order of `and`
-- operands, so an `and` would leave it to the planner whether the RLS-scoped
-- read happens at all under a client role. plpgsql statements are sequential,
-- so nesting makes "the owner test is reached first" a fact rather than a hope.
--
-- THE UPDATE BRANCH IS DELIBERATELY UNCHANGED, and the same reasoning is what
-- says so. Measured: all three of payments' foreign keys carry confupdtype='a'
-- (NO ACTION), so no referential action can ever deliver an UPDATE to this
-- table — only ON UPDATE CASCADE / SET NULL / SET DEFAULT could, and none
-- exists. An UPDATE of an orphaned payment would not be a cascade; it would be
-- a rewrite, and the void rule keeps it refused.
--
-- audit_log's trigger (20260712212409_initial_schema.sql:82), which this one was
-- modelled on, is ALSO deliberately unchanged — the same reasoning, read the
-- other way. audit_log's only foreign key is actor_id -> profiles with
-- confdeltype='a', so nothing cascades into audit_log and no referential action
-- can ever reach its trigger. Deleting a profile that has ever acted is refused
-- by the foreign key itself (23503), which is exactly what seed-staging.mjs:196
-- already documents and works around. Copying this exemption there would loosen
-- a table that needs nothing.
create or replace function payments_append_only() returns trigger language plpgsql as $$
begin
  -- Unchanged: seed-staging.mjs wipes payments outright with the service key on
  -- every reseed (ADR-016), while the parent profiles rows are still alive — so
  -- the orphan rule below would not cover it.
  if current_user = 'service_role' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    -- The cascade, and nothing else. Both conditions, in this order — see above.
    if current_user = pg_catalog.pg_get_userbyid(
         (select c.relowner from pg_catalog.pg_class c where c.oid = tg_relid))
    then
      -- Reached only with the owner's privileges, so RLS does not apply here
      -- and this answer is the truth rather than the caller's visibility.
      if not exists (select 1 from public.profiles where id = old.member_id) then
        return old;
      end if;
    end if;
    raise exception 'payments are append-only';
  end if;
  if old.voided_at is not null or new.voided_at is null then
    raise exception 'payments are append-only';
  end if;
  if (new.id, new.member_id, new.amount_gel, new.paid_at, new.bank_reference, new.source,
      new.recorded_by, new.created_at, new.tier_gel_at_payment)
     is distinct from
     (old.id, old.member_id, old.amount_gel, old.paid_at, old.bank_reference, old.source,
      old.recorded_by, old.created_at, old.tier_gel_at_payment) then
    raise exception 'payments are append-only';
  end if;
  return new;
end $$;
