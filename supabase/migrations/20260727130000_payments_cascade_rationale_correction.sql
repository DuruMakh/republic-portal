-- Security check-up, Task 13 — a factual correction to a security migration's
-- rationale. No privilege, policy, trigger or function body changes here.
--
-- THE FALSE SENTENCE. 20260727120000_payments_cascade_exemption.sql:56-58 argues
-- that the orphan condition is hard to reach, and ends:
--
--   "Reaching state (2) means deleting the profiles row first, which no client
--    role can do — `profiles` has no DELETE policy at all, and anon/authenticated
--    hold no DELETE privilege on it after CF4."
--
-- The second half of that clause is WRONG. CF4
-- (20260726120500_revoke_anon_profiles_grants.sql) revoked from `anon` ONLY, and
-- it is the only statement in the whole migration set that touches profiles'
-- DELETE privilege. `authenticated` therefore still holds the Supabase default,
-- and was never narrowed: the Phase-3 lockdown revoked only SELECT and UPDATE
-- from it (20260715120000:42, 20260717150000:929). Measured on this database:
--
--   role           | DELETE on profiles | INSERT | TRUNCATE | SELECT
--   anon           | false              | false  | false    | false
--   authenticated  | TRUE               | TRUE   | TRUE     | false
--   profiles policies with polcmd = 'd' (DELETE): 0
--
-- WHAT DOES NOT CHANGE, and why this is a correction rather than a fix. The
-- conclusion the sentence was supporting still holds, by two independent routes:
--
--   * RLS. `profiles` has RLS enabled and ZERO DELETE policies, and RLS with no
--     policy for a command is deny-all. So `authenticated`'s DELETE privilege
--     lets the statement RUN and it removes no row — the same
--     permitted-but-zero-rows shape recorded for app_settings and audit_log
--     (progress.md RF3/RF4). The grant is real; the deletion is not.
--   * Condition (1) closes the trigger REGARDLESS. Even granting an attacker the
--     profiles delete outright, the payments DELETE still has to arrive with the
--     privileges of payments' own owner, which no client role and no PostgREST
--     request ever has. The orphan test was never load-bearing on its own — that
--     is the whole reason it is a conjunction.
--
-- So no repair is warranted here and none is made. What is not acceptable is a
-- security migration asserting a grant fact that is not true: the next reader to
-- reason from it would conclude `profiles` is sealed against client deletion by
-- privilege, and build on that. The underlying wide default grant is already
-- tracked, unfixed and open, as report finding 12 / CF1 ("wide default grants,
-- row rules alone holding", Low) — deliberately NOT revoked here, because
-- narrowing default privileges across the schema is an owner decision that
-- ADR-021 and the launch-blocker list own, not a footnote to a payments trigger.
--
-- The corrected rationale is attached to the function itself so that it travels
-- with the object rather than living only in a file, since it is the file's
-- accuracy that failed.
comment on function public.payments_append_only() is
  $$Append-only guard for payments (finding L3-2). Corrections are voids, never rewrites or deletions (ADR-015).

Permits exactly three things:
  1. service_role, which seed-staging.mjs uses to wipe payments with parents alive (ADR-016);
  2. the void transition, defined by SHAPE (a live row gaining voided_at with every other column byte-identical) rather than by caller, so it does not exempt every SECURITY DEFINER function;
  3. a DELETE that is a referential cascade, and only that: it must run with the privileges of payments' OWNER (which is what a referential action is, and what no client role or PostgREST request can be) AND find the parent profiles row already gone.

Both cascade conditions are required. Condition 1 is what makes condition 2 truthful: profiles carries RLS, so `select 1 from public.profiles` otherwise answers with the CALLER's visibility, under which every profile but their own already looks deleted — the guard would fail open. They are nested ifs, not `and`, because PostgreSQL does not guarantee `and` evaluation order.

NOTE, correcting 20260727120000's header: `authenticated` DOES still hold table-wide DELETE, INSERT and TRUNCATE on profiles (CF4 revoked from anon only). Client deletion of a profile is stopped by RLS having zero DELETE policies, not by privilege — and condition 1 closes this trigger either way. Tracked as report finding 12 / CF1.$$;
